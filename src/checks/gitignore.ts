import fs from "node:fs";
import path from "node:path";
import type { CheckResult } from "../types.js";

export function checkGitignore(repoPath: string): CheckResult {
  const file = path.join(repoPath, ".gitignore");

  if (!fs.existsSync(file)) {
    return {
      id: "gitignore",
      name: ".gitignore",
      category: "Repository",
      severity: "warning",
      passed: false,
      score: 0,
      message: ".gitignore is missing.",
      recommendation:
        "Add a .gitignore file for dependencies, secrets and build files."
    };
  }

  const content = fs.readFileSync(file, "utf8");

  const hasEnvRule = /(^|\r?\n)\s*\.env(?:\s|$)/.test(content);

  return {
    id: "gitignore-env",
    name: ".gitignore",
    category: "Repository",
    severity: hasEnvRule ? "info" : "warning",
    passed: hasEnvRule,
    score: hasEnvRule ? 100 : 50,
    message: hasEnvRule
      ? ".gitignore exists and ignores .env."
      : ".gitignore exists but .env is not explicitly ignored.",
    recommendation: hasEnvRule
      ? undefined
      : "Add .env to .gitignore to reduce accidental secret commits."
  };
}