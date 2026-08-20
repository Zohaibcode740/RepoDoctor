import type {
  CheckResult,
  RepositoryReport
} from "./types.js";

import { checkReadme } from "./checks/readme.js";
import { checkLicense } from "./checks/license.js";
import { checkTests } from "./checks/tests.js";
import { checkGitignore } from "./checks/gitignore.js";
import { checkGithubActions } from "./checks/github-actions.js";
import { checkLinks } from "./checks/links.js";
import { checkDependencies } from "./checks/dependencies.js";
import { checkSecrets } from "./checks/secrets.js";

interface CheckWeight {
  id: string;
  weight: number;
}

const CHECK_WEIGHTS: CheckWeight[] = [
  {
    id: "secrets",
    weight: 20
  },
  {
    id: "tests",
    weight: 15
  },
  {
    id: "github-actions",
    weight: 15
  },
  {
    id: "dependencies",
    weight: 15
  },
  {
    id: "readme",
    weight: 10
  },
  {
    id: "license",
    weight: 10
  },
  {
    id: "gitignore",
    weight: 5
  },
  {
    id: "links",
    weight: 10
  }
];

export async function scanRepository(
  repoPath: string
): Promise<RepositoryReport> {
  const checks: CheckResult[] = [
    checkReadme(repoPath),
    checkLicense(repoPath),
    checkTests(repoPath),
    checkGitignore(repoPath),
    checkGithubActions(repoPath),
    checkLinks(repoPath),
    await checkDependencies(repoPath),
    checkSecrets(repoPath)
  ];

  const score =
    calculateScore(checks);

  return {
    path: repoPath,
    score,
    checks
  };
}

function calculateScore(
  checks: CheckResult[]
): number {
  if (checks.length === 0) {
    return 0;
  }

  const weightMap =
    new Map(
      CHECK_WEIGHTS.map(
        (item) => [
          item.id,
          item.weight
        ]
      )
    );

  let weightedScore = 0;
  let totalWeight = 0;

  for (const check of checks) {
    const weight =
      weightMap.get(check.id);

    if (
      weight === undefined
    ) {
      continue;
    }

    weightedScore +=
      check.score * weight;

    totalWeight += weight;
  }

  if (totalWeight === 0) {
    return 0;
  }

  let score =
    weightedScore / totalWeight;

  const criticalChecks =
    checks.filter(
      (check) =>
        check.severity ===
        "critical"
    );

  const failedCriticalChecks =
    criticalChecks.filter(
      (check) =>
        !check.passed
    );

  if (
    failedCriticalChecks.length > 0
  ) {
    score -=
      failedCriticalChecks.length *
      10;
  }

  return Math.max(
    0,
    Math.min(
      100,
      Math.round(score)
    )
  );
}