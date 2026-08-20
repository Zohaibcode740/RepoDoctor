import fs from "node:fs";
import path from "node:path";
import type { CheckResult } from "../types.js";

interface WorkflowAnalysis {
  workflows: number;
  hasNodeSetup: boolean;
  hasDependencyInstall: boolean;
  hasTests: boolean;
  hasBuild: boolean;
  hasCaching: boolean;
  hasSecurityAudit: boolean;
}

function getWorkflowFiles(
  repoPath: string
): string[] {
  const workflowsDir = path.join(
    repoPath,
    ".github",
    "workflows"
  );

  if (!fs.existsSync(workflowsDir)) {
    return [];
  }

  try {
    return fs
      .readdirSync(workflowsDir)
      .filter(
        (file) =>
          file.endsWith(".yml") ||
          file.endsWith(".yaml")
      )
      .map((file) =>
        path.join(
          workflowsDir,
          file
        )
      );
  } catch {
    return [];
  }
}

function readWorkflows(
  files: string[]
): string {
  return files
    .map((file) => {
      try {
        return fs.readFileSync(
          file,
          "utf8"
        );
      } catch {
        return "";
      }
    })
    .join("\n");
}

function analyzeWorkflows(
  content: string,
  workflowCount: number
): WorkflowAnalysis {
  return {
    workflows: workflowCount,

    hasNodeSetup:
      /actions\/setup-node@/i.test(
        content
      ),

    hasDependencyInstall:
      /\bnpm\s+(ci|install)\b|\byarn\s+install\b|\bpnpm\s+install\b/i.test(
        content
      ),

    hasTests:
      /\bnpm\s+(run\s+)?test\b|\byarn\s+test\b|\bpnpm\s+(run\s+)?test\b|\bnpx\s+(vitest|jest|mocha)\b/i.test(
        content
      ),

    hasBuild:
      /\bnpm\s+run\s+build\b|\byarn\s+build\b|\bpnpm\s+(run\s+)?build\b/i.test(
        content
      ),

    hasCaching:
      /cache:\s*(npm|yarn|pnpm)/i.test(
        content
      ) ||
      /actions\/cache@/i.test(
        content
      ),

    hasSecurityAudit:
      /\bnpm\s+audit\b|\bpnpm\s+audit\b|\byarn\s+audit\b|\btrivy\b|\bsnyk\b/i.test(
        content
      )
  };
}

export function checkGithubActions(
  repoPath: string
): CheckResult {
  const workflowFiles =
    getWorkflowFiles(repoPath);

  if (workflowFiles.length === 0) {
    return {
      id: "github-actions",
      name: "GitHub Actions",
      category: "CI/CD",
      severity: "warning",
      passed: false,
      score: 0,
      message:
        "No GitHub Actions workflow found.",
      recommendation:
        "Add CI to automatically install dependencies, run tests and build the project."
    };
  }

  const content =
    readWorkflows(
      workflowFiles
    );

  const analysis =
    analyzeWorkflows(
      content,
      workflowFiles.length
    );

  let score = 20;

  if (analysis.hasNodeSetup) {
    score += 15;
  }

  if (analysis.hasDependencyInstall) {
    score += 15;
  }

  if (analysis.hasTests) {
    score += 20;
  }

  if (analysis.hasBuild) {
    score += 15;
  }

  if (analysis.hasCaching) {
    score += 10;
  }

  if (analysis.hasSecurityAudit) {
    score += 5;
  }

  score = Math.min(
    score,
    100
  );

  const details: string[] = [];

  details.push(
    `${analysis.workflows} workflow(s) found`
  );

  if (analysis.hasNodeSetup) {
    details.push(
      "Node setup"
    );
  }

  if (analysis.hasDependencyInstall) {
    details.push(
      "dependencies installed"
    );
  }

  if (analysis.hasTests) {
    details.push(
      "tests executed"
    );
  }

  if (analysis.hasBuild) {
    details.push(
      "build executed"
    );
  }

  if (analysis.hasCaching) {
    details.push(
      "dependency caching"
    );
  }

  if (analysis.hasSecurityAudit) {
    details.push(
      "security audit"
    );
  }

  const missing: string[] = [];

  if (!analysis.hasNodeSetup) {
    missing.push(
      "Add actions/setup-node"
    );
  }

  if (!analysis.hasDependencyInstall) {
    missing.push(
      "Install dependencies with npm ci/install"
    );
  }

  if (!analysis.hasTests) {
    missing.push(
      "Run automated tests"
    );
  }

  if (!analysis.hasBuild) {
    missing.push(
      "Run the production build"
    );
  }

  if (!analysis.hasCaching) {
    missing.push(
      "Add dependency caching"
    );
  }

  if (!analysis.hasSecurityAudit) {
    missing.push(
      "Consider adding a dependency security audit"
    );
  }

  let severity:
    CheckResult["severity"] =
    "info";

  if (score < 70) {
    severity = "warning";
  }

  if (score < 40) {
    severity = "critical";
  }

  return {
    id: "github-actions",
    name: "GitHub Actions",
    category: "CI/CD",
    severity,
    passed: score >= 70,
    score,
    message:
      details.join(", ") + ".",
    recommendation:
      missing.length > 0
        ? missing.join("; ") + "."
        : undefined
  };
}