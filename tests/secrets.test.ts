import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import {
  afterEach,
  describe,
  expect,
  it
} from "vitest";

import { checkSecrets } from "../src/checks/secrets.js";

const temporaryDirectories: string[] =
  [];

function createTempRepository(): string {
  const repoPath =
    fs.mkdtempSync(
      path.join(
        os.tmpdir(),
        "repodoctor-test-"
      )
    );

  temporaryDirectories.push(
    repoPath
  );

  return repoPath;
}

function writeFile(
  repoPath: string,
  relativePath: string,
  content: string
): void {
  const filePath =
    path.join(
      repoPath,
      relativePath
    );

  fs.mkdirSync(
    path.dirname(filePath),
    {
      recursive: true
    }
  );

  fs.writeFileSync(
    filePath,
    content,
    "utf8"
  );
}

afterEach(() => {
  for (
    const directory of
      temporaryDirectories.splice(0)
  ) {
    fs.rmSync(
      directory,
      {
        recursive: true,
        force: true
      }
    );
  }
});

describe("checkSecrets", () => {
  it("passes when no obvious secrets are present", () => {
    const repoPath =
      createTempRepository();

    writeFile(
      repoPath,
      "src/index.ts",
      `
        const message = "hello world";
        console.log(message);
      `
    );

    const result =
      checkSecrets(repoPath);

    expect(result.id).toBe(
      "secrets"
    );

    expect(result.passed).toBe(
      true
    );

    expect(result.score).toBe(
      100
    );

    expect(result.severity).toBe(
      "info"
    );

    expect(result.message).toContain(
      "No obvious secrets detected."
    );
  });

  it("detects an AWS access key", () => {
    const repoPath =
      createTempRepository();

    writeFile(
      repoPath,
      "config.ts",
      `
        const accessKey =
          "AKIA1234567890ABCD";
      `
    );

    const result =
      checkSecrets(repoPath);

    expect(result.passed).toBe(
      false
    );

    expect(result.severity).toBe(
      "critical"
    );

    expect(result.score).toBeLessThan(
      100
    );

    expect(result.message).toContain(
      "1 possible secret(s)"
    );

    expect(result.message).toContain(
      "1 critical"
    );

    expect(
      result.recommendation
    ).toContain(
      "AWS Access Key"
    );
  });

  it("detects a GitHub personal access token", () => {
    const repoPath =
      createTempRepository();

    writeFile(
      repoPath,
      "config.ts",
      `
        const token =
          "ghp_abcdefghijklmnopqrstuvwxyz123456";
      `
    );

    const result =
      checkSecrets(repoPath);

    expect(result.passed).toBe(
      false
    );

    expect(result.severity).toBe(
      "critical"
    );

    expect(
      result.recommendation
    ).toContain(
      "GitHub Personal Access Token"
    );
  });

  it("detects a GitHub fine-grained token", () => {
    const repoPath =
      createTempRepository();

    writeFile(
      repoPath,
      "config.ts",
      `
        const token =
          "github_pat_abcdefghijklmnopqrstuvwxyz123456";
      `
    );

    const result =
      checkSecrets(repoPath);

    expect(result.passed).toBe(
      false
    );

    expect(result.severity).toBe(
      "critical"
    );

    expect(
      result.recommendation
    ).toContain(
      "GitHub Token"
    );
  });

  it("detects a private key", () => {
    const repoPath =
      createTempRepository();

    writeFile(
      repoPath,
      "private-key.txt",
      `
-----BEGIN RSA PRIVATE KEY-----
example-private-key-content
-----END RSA PRIVATE KEY-----
      `
    );

    const result =
      checkSecrets(repoPath);

    expect(result.passed).toBe(
      false
    );

    expect(result.severity).toBe(
      "critical"
    );

    expect(
      result.recommendation
    ).toContain(
      "Private Key"
    );
  });

  it("ignores obvious placeholder generic secrets", () => {
    const repoPath =
      createTempRepository();

    writeFile(
      repoPath,
      "config.ts",
      `
        const password = "your-password";
        const token = "your-token";
        const secret = "changeme";
        const apiKey = "example-secret";
      `
    );

    const result =
      checkSecrets(repoPath);

    expect(result.passed).toBe(
      true
    );

    expect(result.score).toBe(
      100
    );
  });

  it("ignores generic secrets inside example files", () => {
    const repoPath =
      createTempRepository();

    writeFile(
      repoPath,
      "examples/auth/index.js",
      `
        const password =
          "my-example-password-12345";
      `
    );

    const result =
      checkSecrets(repoPath);

    expect(result.passed).toBe(
      true
    );

    expect(result.score).toBe(
      100
    );
  });

  it("ignores generic secrets inside test files", () => {
    const repoPath =
      createTempRepository();

    writeFile(
      repoPath,
      "tests/auth.test.ts",
      `
        const token =
          "test-token-value-12345";
      `
    );

    const result =
      checkSecrets(repoPath);

    expect(result.passed).toBe(
      true
    );

    expect(result.score).toBe(
      100
    );
  });

  it("detects a realistic generic secret in normal source code", () => {
    const repoPath =
      createTempRepository();

    writeFile(
      repoPath,
      "src/config.ts",
      `
        const apiKey =
          "sk_live_1234567890abcdef";
      `
    );

    const result =
      checkSecrets(repoPath);

    expect(result.passed).toBe(
      false
    );

    expect(result.severity).toBe(
      "warning"
    );

    expect(result.score).toBeLessThan(
      100
    );

    expect(
      result.recommendation
    ).toContain(
      "Generic API Key"
    );
  });

  it("ignores node_modules and dist directories", () => {
    const repoPath =
      createTempRepository();

    writeFile(
      repoPath,
      "node_modules/package/index.js",
      `
        const password =
          "real-secret-value-123456";
      `
    );

    writeFile(
      repoPath,
      "dist/index.js",
      `
        const token =
          "real-token-value-123456";
      `
    );

    const result =
      checkSecrets(repoPath);

    expect(result.passed).toBe(
      true
    );

    expect(result.score).toBe(
      100
    );
  });
});