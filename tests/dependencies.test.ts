import { describe, expect, it } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { checkDependencies } from "../src/checks/dependencies.js";

function createTempRepo(
  packageJson: object
): string {
  const repoPath = fs.mkdtempSync(
    path.join(
      os.tmpdir(),
      "repodoctor-test-"
    )
  );

  fs.writeFileSync(
    path.join(
      repoPath,
      "package.json"
    ),
    JSON.stringify(
      packageJson,
      null,
      2
    )
  );

  return repoPath;
}

describe("Dependencies checker", () => {
  it(
    "returns 100 when no dependencies exist",
    async () => {
      const repo =
        createTempRepo({});

      const result =
        await checkDependencies(repo);

      expect(result.score).toBe(100);
      expect(result.passed).toBe(true);
    }
  );

  it(
    "handles missing package.json",
    async () => {
      const repoPath =
        fs.mkdtempSync(
          path.join(
            os.tmpdir(),
            "repodoctor-test-"
          )
        );

      const result =
        await checkDependencies(repoPath);

      expect(result.score).toBe(100);
      expect(result.passed).toBe(true);
    }
  );
});