import fs from "node:fs";
import path from "node:path";
import type { CheckResult } from "../types.js";

interface PackageJson {
  scripts?: Record<string, string>;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
}

interface TestInfo {
  files: number;
  framework: string | null;
  testScript: boolean;
  testDirectory: boolean;
}

const TEST_FILE_PATTERNS = [
  /\.test\.(js|jsx|ts|tsx|mjs|cjs)$/,
  /\.spec\.(js|jsx|ts|tsx|mjs|cjs)$/
];

const TEST_FRAMEWORKS = [
  {
    name: "Vitest",
    packages: ["vitest"]
  },
  {
    name: "Jest",
    packages: ["jest", "@jest/core"]
  },
  {
    name: "Mocha",
    packages: ["mocha"]
  },
  {
    name: "Playwright",
    packages: [
      "@playwright/test"
    ]
  },
  {
    name: "Cypress",
    packages: ["cypress"]
  },
  {
    name: "Node Test Runner",
    packages: []
  }
];

const IGNORED_DIRECTORIES = new Set([
  "node_modules",
  ".git",
  "dist",
  "build",
  "coverage",
  ".next",
  ".turbo"
]);

function readPackageJson(
  repoPath: string
): PackageJson | null {
  const packagePath =
    path.join(
      repoPath,
      "package.json"
    );

  if (!fs.existsSync(packagePath)) {
    return null;
  }

  try {
    return JSON.parse(
      fs.readFileSync(
        packagePath,
        "utf8"
      )
    ) as PackageJson;
  } catch {
    return null;
  }
}

function detectFramework(
  pkg: PackageJson
): string | null {
  const installed = new Set([
    ...Object.keys(
      pkg.dependencies ?? {}
    ),
    ...Object.keys(
      pkg.devDependencies ?? {}
    )
  ]);

  for (
    const framework of TEST_FRAMEWORKS
  ) {
    if (
      framework.packages.some(
        (name) =>
          installed.has(name)
      )
    ) {
      return framework.name;
    }
  }

  // Node's built-in test runner
  const allScripts =
    Object.values(
      pkg.scripts ?? {}
    ).join(" ");

  if (
    /\bnode\s+--test\b/.test(
      allScripts
    )
  ) {
    return "Node Test Runner";
  }

  return null;
}

function hasTestScript(
  pkg: PackageJson
): boolean {
  const scripts =
    pkg.scripts ?? {};

  return Boolean(
    scripts.test &&
    scripts.test.trim().length > 0
  );
}

function scanTestFiles(
  repoPath: string
): number {
  let count = 0;

  function walk(
    currentPath: string
  ): void {
    let entries: fs.Dirent[];

    try {
      entries =
        fs.readdirSync(
          currentPath,
          {
            withFileTypes: true
          }
        );
    } catch {
      return;
    }

    for (
      const entry of entries
    ) {
      if (
        IGNORED_DIRECTORIES.has(
          entry.name
        )
      ) {
        continue;
      }

      const fullPath =
        path.join(
          currentPath,
          entry.name
        );

      if (
        entry.isDirectory()
      ) {
        walk(fullPath);
        continue;
      }

      if (
        TEST_FILE_PATTERNS.some(
          (pattern) =>
            pattern.test(
              entry.name
            )
        )
      ) {
        count++;
      }
    }
  }

  walk(repoPath);

  return count;
}

function hasTestDirectory(
  repoPath: string
): boolean {
  const possibleDirectories = [
    "__tests__",
    "tests",
    "test",
    "spec"
  ];

  return possibleDirectories.some(
    (directory) =>
      fs.existsSync(
        path.join(
          repoPath,
          directory
        )
      )
  );
}

export function checkTests(
  repoPath: string
): CheckResult {
  const pkg =
    readPackageJson(repoPath);

  const testFiles =
    scanTestFiles(repoPath);

  const testDirectory =
    hasTestDirectory(repoPath);

  const framework =
    pkg
      ? detectFramework(pkg)
      : null;

  const testScript =
    pkg
      ? hasTestScript(pkg)
      : false;

  const info: TestInfo = {
    files: testFiles,
    framework,
    testScript,
    testDirectory
  };

  /*
   * Scoring
   *
   * Test files       = 50 points
   * Framework        = 20 points
   * npm test script  = 20 points
   * Test directory   = 10 points
   */

  let score = 0;

  if (info.files > 0) {
    score += 50;
  }

  if (info.framework) {
    score += 20;
  }

  if (info.testScript) {
    score += 20;
  }

  if (info.testDirectory) {
    score += 10;
  }

  score = Math.min(
    score,
    100
  );

  // Nothing test-related found
  if (
    testFiles === 0 &&
    !framework &&
    !testScript &&
    !testDirectory
  ) {
    return {
      id: "tests",
      name: "Tests",
      category: "Quality",
      severity: "warning",
      passed: false,
      score: 0,
      message:
        "No test files, test framework, or test script were detected.",
      recommendation:
        "Add automated tests for important application logic."
    };
  }

  const details: string[] = [];

  if (framework) {
    details.push(
      `Framework: ${framework}`
    );
  }

  if (testFiles > 0) {
    details.push(
      `${testFiles} test file(s)`
    );
  }

  if (testScript) {
    details.push(
      "test script configured"
    );
  }

  if (testDirectory) {
    details.push(
      "test directory found"
    );
  }

  let severity:
    CheckResult["severity"] =
    "info";

  if (score < 50) {
    severity = "warning";
  }

  return {
    id: "tests",
    name: "Tests",
    category: "Quality",
    severity,
    passed: score >= 70,
    score,
    message:
      details.join(", ") + ".",
    recommendation:
      score < 70
        ? "Add more automated tests and ensure the test script runs them."
        : undefined
  };
}