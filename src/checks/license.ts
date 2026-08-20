import fs from "node:fs";
import path from "node:path";
import type { CheckResult } from "../types.js";

export function checkLicense(repoPath: string): CheckResult {
  const files = [
    "LICENSE",
    "LICENSE.md",
    "LICENSE.txt"
  ];

  const exists = files.some((file) =>
    fs.existsSync(path.join(repoPath, file))
  );

  return {
    id: "license",
    name: "License",
    category: "Open Source",
    severity: exists ? "info" : "warning",
    passed: exists,
    score: exists ? 100 : 0,
    message: exists
      ? "License file found."
      : "No license file found.",
    recommendation: exists
      ? undefined
      : "Add an appropriate open-source license such as MIT."
  };
}