import fs from "node:fs";
import path from "node:path";

import type { CheckResult } from "../types.js";

interface PackageJson {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
}

interface NpmPackageData {
  "dist-tags"?: {
    latest?: string;
  };
}

interface DependencyStatus {
  name: string;
  current: string;
  latest: string | null;
  type:
    | "major"
    | "minor"
    | "patch"
    | "up-to-date"
    | "unknown";
}

async function getLatestVersion(
  packageName: string
): Promise<string | null> {
  try {
    const response = await fetch(
      `https://registry.npmjs.org/${encodeURIComponent(
        packageName
      )}`,
      {
        headers: {
          Accept: "application/json"
        }
      }
    );

    if (!response.ok) {
      return null;
    }

    const data =
      (await response.json()) as NpmPackageData;

    return (
      data["dist-tags"]?.latest ??
      null
    );
  } catch {
    return null;
  }
}

function cleanVersion(
  version: string
): string {
  return version
    .replace(
      /^[~^<>=\s]*/,
      ""
    )
    .split(" ")[0]
    .trim();
}

function parseVersion(
  version: string
): [number, number, number] | null {
  const cleaned =
    cleanVersion(version);

  const match =
    cleaned.match(
      /^(\d+)\.(\d+)\.(\d+)/
    );

  if (!match) {
    return null;
  }

  return [
    Number(match[1]),
    Number(match[2]),
    Number(match[3])
  ];
}

function compareVersions(
  current: string,
  latest: string
): DependencyStatus["type"] {
  const currentVersion =
    parseVersion(current);

  const latestVersion =
    parseVersion(latest);

  if (
    !currentVersion ||
    !latestVersion
  ) {
    return "unknown";
  }

  const [
    currentMajor,
    currentMinor,
    currentPatch
  ] = currentVersion;

  const [
    latestMajor,
    latestMinor,
    latestPatch
  ] = latestVersion;

  /*
   * A registry version lower than the current
   * version is not considered an update.
   */
  if (
    latestMajor < currentMajor ||
    (
      latestMajor === currentMajor &&
      latestMinor < currentMinor
    ) ||
    (
      latestMajor === currentMajor &&
      latestMinor === currentMinor &&
      latestPatch < currentPatch
    )
  ) {
    return "up-to-date";
  }

  if (
    latestMajor > currentMajor
  ) {
    return "major";
  }

  if (
    latestMinor > currentMinor
  ) {
    return "minor";
  }

  if (
    latestPatch > currentPatch
  ) {
    return "patch";
  }

  return "up-to-date";
}

function calculateScore(
  total: number,
  major: number,
  minor: number,
  patch: number
): number {
  if (total === 0) {
    return 100;
  }

  /*
   * Dependency freshness should affect the
   * repository score, but it should not destroy
   * the entire score simply because a package has
   * a newer major release.
   *
   * Major update  = 8 points
   * Minor update  = 3 points
   * Patch update  = 1 point
   *
   * The penalty is normalized by dependency count.
   */
  const penalty =
    major * 8 +
    minor * 3 +
    patch * 1;

  const normalizedPenalty =
    (penalty / total) * 10;

  return Math.max(
    0,
    Math.round(
      100 - normalizedPenalty
    )
  );
}

export async function checkDependencies(
  repoPath: string
): Promise<CheckResult> {
  const packagePath =
    path.join(
      repoPath,
      "package.json"
    );

  if (
    !fs.existsSync(packagePath)
  ) {
    return {
      id: "dependencies",
      name: "Dependencies",
      category: "Dependencies",
      severity: "info",
      passed: true,
      score: 100,
      message:
        "No package.json found. Dependency check skipped."
    };
  }

  let pkg: PackageJson;

  try {
    pkg =
      JSON.parse(
        fs.readFileSync(
          packagePath,
          "utf8"
        )
      );
  } catch {
    return {
      id: "dependencies",
      name: "Dependencies",
      category: "Dependencies",
      severity: "critical",
      passed: false,
      score: 0,
      message:
        "package.json could not be parsed.",
      recommendation:
        "Fix the invalid package.json syntax."
    };
  }

  const dependencies = {
    ...(pkg.dependencies ?? {}),
    ...(pkg.devDependencies ?? {})
  };

  const names =
    Object.keys(dependencies);

  if (
    names.length === 0
  ) {
    return {
      id: "dependencies",
      name: "Dependencies",
      category: "Dependencies",
      severity: "info",
      passed: true,
      score: 100,
      message:
        "No dependencies found."
    };
  }

  const statuses: DependencyStatus[] =
    [];

  for (
    const name of names
  ) {
    const current =
      dependencies[name];

    const latest =
      await getLatestVersion(
        name
      );

    const type =
      latest
        ? compareVersions(
            current,
            latest
          )
        : "unknown";

    statuses.push({
      name,
      current,
      latest,
      type
    });
  }

  const majorUpdates =
    statuses.filter(
      (dependency) =>
        dependency.type ===
        "major"
    );

  const minorUpdates =
    statuses.filter(
      (dependency) =>
        dependency.type ===
        "minor"
    );

  const patchUpdates =
    statuses.filter(
      (dependency) =>
        dependency.type ===
        "patch"
    );

  const upToDate =
    statuses.filter(
      (dependency) =>
        dependency.type ===
        "up-to-date"
    );

  const unknown =
    statuses.filter(
      (dependency) =>
        dependency.type ===
        "unknown"
    );

  const score =
    calculateScore(
      names.length,
      majorUpdates.length,
      minorUpdates.length,
      patchUpdates.length
    );

  /*
   * Major updates are a warning.
   * Five or more major updates are critical,
   * because that usually indicates significant
   * dependency maintenance debt.
   */
  let severity:
    CheckResult["severity"] =
    "info";

  if (
    majorUpdates.length > 0 ||
    minorUpdates.length > 0 ||
    patchUpdates.length > 0
  ) {
    severity = "warning";
  }

  if (
    majorUpdates.length >= 5
  ) {
    severity = "critical";
  }

  const hasUpdates =
    majorUpdates.length > 0 ||
    minorUpdates.length > 0 ||
    patchUpdates.length > 0;

  const summary =
    `${names.length} dependencies checked. ` +
    `${majorUpdates.length} major, ` +
    `${minorUpdates.length} minor, ` +
    `${patchUpdates.length} patch update(s) available.` +
    (
      upToDate.length > 0
        ? ` ${upToDate.length} up to date.`
        : ""
    ) +
    (
      unknown.length > 0
        ? ` ${unknown.length} could not be checked.`
        : ""
    );

  const recommendations: string[] =
    [];

  if (
    majorUpdates.length > 0
  ) {
    recommendations.push(
      "Major updates: " +
        majorUpdates
          .map(
            (dependency) =>
              `${dependency.name} ${dependency.current} -> ${dependency.latest}`
          )
          .join(", ")
    );
  }

  if (
    minorUpdates.length > 0
  ) {
    recommendations.push(
      "Minor updates: " +
        minorUpdates
          .map(
            (dependency) =>
              `${dependency.name} ${dependency.current} -> ${dependency.latest}`
          )
          .join(", ")
    );
  }

  if (
    patchUpdates.length > 0
  ) {
    recommendations.push(
      "Patch updates: " +
        patchUpdates
          .map(
            (dependency) =>
              `${dependency.name} ${dependency.current} -> ${dependency.latest}`
          )
          .join(", ")
    );
  }

  if (
    unknown.length > 0
  ) {
    recommendations.push(
      `${unknown.length} dependencies could not be checked because their latest version could not be retrieved.`
    );
  }

  return {
    id: "dependencies",
    name: "Dependencies",
    category: "Dependencies",
    severity,
    passed: !hasUpdates,
    score,
    message:
      hasUpdates
        ? summary
        : `All ${names.length} dependencies appear up to date.`,
    recommendation:
      recommendations.length > 0
        ? recommendations.join(
            "\n  "
          )
        : undefined
  };
}