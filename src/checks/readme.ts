import fs from "node:fs";
import path from "node:path";
import type { CheckResult } from "../types.js";

export function checkReadme(repoPath: string): CheckResult {
  const possibleFiles = [
    "README.md",
    "README",
    "README.txt"
  ];

  const exists = possibleFiles.some((file) =>
    fs.existsSync(path.join(repoPath, file))
  );

  if (!exists) {
    return {
      id: "readme-exists",
      name: "README",
      category: "Documentation",
      severity: "critical",
      passed: false,
      score: 0,
      message: "README file is missing.",
      recommendation: "Add a README.md explaining the project, installation and usage."
    };
  }

  const readmePath = possibleFiles
    .map((file) => path.join(repoPath, file))
    .find((file) => fs.existsSync(file));

  if (!readmePath) {
    throw new Error("README could not be found.");
  }

  const content = fs.readFileSync(readmePath, "utf8");

  const hasInstallation =
    /installation|install|setup/i.test(content);

  const hasUsage =
    /usage|example|getting started/i.test(content);

  let score = 40;

  if (hasInstallation) score += 30;
  if (hasUsage) score += 30;

  return {
    id: "readme-quality",
    name: "README Quality",
    category: "Documentation",
    severity: score >= 70 ? "info" : "warning",
    passed: score >= 70,
    score,
    message:
      score >= 70
        ? "README contains basic installation and usage information."
        : "README exists but appears incomplete.",
    recommendation:
      score >= 70
        ? undefined
        : "Add installation, setup and usage instructions."
  };
}