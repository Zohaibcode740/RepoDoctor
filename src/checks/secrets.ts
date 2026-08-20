import fs from "node:fs";
import path from "node:path";

import type { CheckResult } from "../types.js";

interface SecretPattern {
  name: string;
  pattern: RegExp;
  severity: "warning" | "critical";
}

interface SecretFinding {
  name: string;
  file: string;
  line: number;
  severity: "warning" | "critical";
}

/**
 * Strong credential patterns.
 *
 * These are intentionally strict enough to catch common
 * real-world credential formats without scanning arbitrary
 * strings as secrets.
 */
const SECRET_PATTERNS: SecretPattern[] = [
  {
    name: "AWS Access Key",
    pattern: /\bAKIA[0-9A-Z]{12,20}\b/g,
    severity: "critical"
  },

  {
    name: "GitHub Personal Access Token",
    pattern: /\bghp_[A-Za-z0-9_]{20,}\b/g,
    severity: "critical"
  },

  {
    name: "GitHub Token",
    pattern: /\bgithub_pat_[A-Za-z0-9_]{20,}\b/g,
    severity: "critical"
  },

  {
    name: "Private Key",
    pattern:
      /-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----/g,
    severity: "critical"
  },

  {
    name: "Database Connection String",
    pattern:
      /\b(?:mongodb(?:\+srv)?|postgres(?:ql)?|mysql):\/\/[^\s"'`]+/gi,
    severity: "critical"
  },

  {
    name: "Generic API Key",
    pattern:
      /\b(?:api[_-]?key|apikey)\s*[:=]\s*(?:"[^"\r\n]*"|'[^'\r\n]*'|`[^`\r\n]*`)/gi,
    severity: "warning"
  },

  {
    name: "Generic Secret",
    pattern:
      /\b(?:secret|token|password|passwd)\s*[:=]\s*(?:"[^"\r\n]*"|'[^'\r\n]*'|`[^`\r\n]*`)/gi,
    severity: "warning"
  }
];

/**
 * Generated/vendor directories that should never be scanned.
 */
const IGNORED_DIRECTORIES = new Set([
  ".git",
  ".hg",
  ".svn",

  "node_modules",

  "dist",
  "build",
  "coverage",

  ".next",
  ".nuxt",
  ".turbo",
  ".cache",
  ".parcel-cache",

  "out",
  "target",

  "vendor"
]);

/**
 * Lock files contain package metadata rather than application
 * credentials and can create noisy false positives.
 */
const IGNORED_FILES = new Set([
  "package-lock.json",
  "pnpm-lock.yaml",
  "yarn.lock",
  "bun.lockb",
  "composer.lock",
  "cargo.lock"
]);

/**
 * Test/example/fixture directories.
 *
 * RepoDoctor's own tests intentionally contain fake credentials.
 * These files must not be reported during a repository scan.
 */
const FIXTURE_DIRECTORIES = new Set([
  "test",
  "tests",
  "__tests__",

  "example",
  "examples",

  "sample",
  "samples",

  "fixture",
  "fixtures",

  "__fixtures__",

  "__mocks__",
  "mock",
  "mocks"
]);

/**
 * Text files that are reasonable candidates for scanning.
 */
const TEXT_EXTENSIONS = new Set([
  ".js",
  ".jsx",
  ".ts",
  ".tsx",

  ".mjs",
  ".cjs",

  ".json",

  ".yaml",
  ".yml",

  ".toml",
  ".ini",
  ".cfg",
  ".conf",
  ".config",

  ".env",

  ".md",
  ".txt",

  ".html",
  ".css",
  ".scss",

  ".xml",
  ".properties",

  ".sh",
  ".bash",
  ".zsh",
  ".ps1",

  ".py",
  ".rb",
  ".go",
  ".java",
  ".php",
  ".rs",
  ".swift",
  ".kt"
]);

/**
 * Avoid scanning very large files.
 */
const MAX_FILE_SIZE = 1024 * 1024;

/**
 * Values that are obviously examples/placeholders.
 */
const PLACEHOLDER_VALUES = new Set([
  "secret",
  "password",
  "passwd",
  "token",

  "your-secret",
  "your_secret",

  "your-token",
  "your_token",

  "your-password",
  "your_password",

  "your-api-key",
  "your_api_key",

  "changeme",
  "change-me",
  "change_me",

  "replace-me",
  "replace_me",

  "replace-this",
  "replace_this",

  "example",
  "example-value",
  "example_value",
  "example-secret",
  "example_secret",

  "dummy",
  "dummy-secret",
  "dummy_secret",

  "fake",
  "fake-secret",
  "fake_secret",

  "test",
  "testing",

  "localhost",

  "null",
  "undefined"
]);

/**
 * Determine whether a path is inside an ignored directory.
 */
function shouldIgnorePath(
  repoPath: string,
  filePath: string
): boolean {
  const relativePath = path.relative(
    repoPath,
    filePath
  );

  const parts = relativePath
    .split(path.sep)
    .filter(Boolean);

  return parts.some((part) =>
    IGNORED_DIRECTORIES.has(
      part.toLowerCase()
    )
  );
}

/**
 * Determine whether a file is a test/example/fixture file.
 *
 * This is intentionally based on the path rather than file content.
 * That makes the behavior deterministic and predictable.
 */
function isFixtureFile(
  repoPath: string,
  filePath: string
): boolean {
  const relativePath = path.relative(
    repoPath,
    filePath
  );

  const parts = relativePath
    .split(path.sep)
    .filter(Boolean)
    .map((part) =>
      part.toLowerCase()
    );

  if (
    parts.some((part) =>
      FIXTURE_DIRECTORIES.has(part)
    )
  ) {
    return true;
  }

  const fileName = path
    .basename(filePath)
    .toLowerCase();

  return (
    fileName.includes(".test.") ||
    fileName.includes(".spec.") ||
    fileName.includes(".fixture.") ||
    fileName.includes(".example.") ||
    fileName.includes(".sample.")
  );
}

/**
 * Determine whether a file should be scanned.
 */
function shouldScanFile(
  filePath: string
): boolean {
  const extension = path
    .extname(filePath)
    .toLowerCase();

  const baseName = path
    .basename(filePath)
    .toLowerCase();

  return (
    TEXT_EXTENSIONS.has(extension) ||
    baseName === ".env" ||
    baseName.startsWith(".env.")
  );
}

/**
 * Determine whether a value is an obvious placeholder.
 */
function looksLikePlaceholder(
  value: string
): boolean {
  const normalized = value
    .trim()
    .replace(
      /^["'`]+|["'`]+$/g,
      ""
    )
    .toLowerCase();

  if (
    PLACEHOLDER_VALUES.has(
      normalized
    )
  ) {
    return true;
  }

  if (
    normalized.includes("your-") ||
    normalized.includes("your_") ||
    normalized.includes("replace-") ||
    normalized.includes("replace_") ||
    normalized.includes("example-") ||
    normalized.includes("example_") ||
    normalized.includes("dummy-") ||
    normalized.includes("dummy_") ||
    normalized.includes("fake-") ||
    normalized.includes("fake_")
  ) {
    return true;
  }

  if (
    /^x{4,}$/i.test(normalized)
  ) {
    return true;
  }

  if (
    /^0{8,}$/.test(normalized)
  ) {
    return true;
  }

  return false;
}

/**
 * Extract a quoted value from a pattern match.
 */
function extractQuotedValue(
  text: string
): string {
  const match = text.match(
    /["'`]([^"'`]*)["'`]/
  );

  return (
    match?.[1] ??
    text
  );
}

/**
 * Decide whether a generic API key/secret looks realistic.
 *
 * Generic names such as "token" and "password" occur constantly
 * in normal source code, so they need stronger validation.
 */
function looksLikeRealGenericSecret(
  value: string
): boolean {
  const normalized =
    value.trim();

  if (
    normalized.length < 12
  ) {
    return false;
  }

  if (
    looksLikePlaceholder(
      normalized
    )
  ) {
    return false;
  }

  if (
    /^https?:\/\//i.test(
      normalized
    )
  ) {
    return false;
  }

  /*
   * Ignore environment/template references.
   */
  if (
    normalized.includes("${") ||
    normalized.includes("{{") ||
    normalized.includes("<%")
  ) {
    return false;
  }

  /*
   * Ignore obvious variable references such as:
   *
   * API_KEY
   * process.env.API_KEY
   */
  if (
    /^[A-Z_][A-Z0-9_]*$/.test(
      normalized
    )
  ) {
    return false;
  }

  const hasLetters =
    /[a-z]/i.test(
      normalized
    );

  const hasNumbers =
    /\d/.test(normalized);

  const hasSymbols =
    /[^a-z0-9\s]/i.test(
      normalized
    );

  return (
    hasLetters &&
    (hasNumbers ||
      hasSymbols)
  );
}

/**
 * Recursively collect candidate files.
 */
function collectFiles(
  repoPath: string,
  currentPath: string = repoPath
): string[] {
  const files: string[] = [];

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
    return files;
  }

  for (
    const entry of entries
  ) {
    const fullPath =
      path.join(
        currentPath,
        entry.name
      );

    /*
     * Ignore generated/vendor directories.
     */
    if (
      shouldIgnorePath(
        repoPath,
        fullPath
      )
    ) {
      continue;
    }

    if (
      entry.isDirectory()
    ) {
      files.push(
        ...collectFiles(
          repoPath,
          fullPath
        )
      );

      continue;
    }

    if (
      !entry.isFile()
    ) {
      continue;
    }

    if (
      IGNORED_FILES.has(
        entry.name.toLowerCase()
      )
    ) {
      continue;
    }

    if (
      !shouldScanFile(
        fullPath
      )
    ) {
      continue;
    }

    try {
      const stat =
        fs.statSync(
          fullPath
        );

      if (
        stat.size >
        MAX_FILE_SIZE
      ) {
        continue;
      }
    } catch {
      continue;
    }

    files.push(
      fullPath
    );
  }

  return files;
}

/**
 * Create a normalized finding object.
 */
function createFinding(
  repoPath: string,
  filePath: string,
  line: number,
  secret: SecretPattern
): SecretFinding {
  return {
    name: secret.name,

    file: path.relative(
      repoPath,
      filePath
    ),

    line,

    severity:
      secret.severity
  };
}

/**
 * Decide whether a finding should be reported.
 */
function shouldReportFinding(
  finding: SecretFinding,
  value: string
): boolean {
  /*
   * Generic credentials require stronger evidence.
   */
  if (
    finding.name ===
      "Generic API Key" ||
    finding.name ===
      "Generic Secret"
  ) {
    return looksLikeRealGenericSecret(
      value
    );
  }

  /*
   * Strong credential patterns are always reported
   * when they occur in normal source files.
   */
  return true;
}

/**
 * Scan a single file.
 */
function scanFile(
  repoPath: string,
  filePath: string
): SecretFinding[] {
  /*
   * This is the critical rule:
   *
   * tests/examples/fixtures/mocks are not scanned.
   *
   * RepoDoctor's own tests contain intentionally fake
   * AWS/GitHub/private-key credentials. They are fixtures,
   * not leaked credentials.
   */
  if (
    isFixtureFile(
      repoPath,
      filePath
    )
  ) {
    return [];
  }

  let content: string;

  try {
    content =
      fs.readFileSync(
        filePath,
        "utf8"
      );
  } catch {
    return [];
  }

  const findings: SecretFinding[] =
    [];

  const lines =
    content.split(
      /\r?\n/
    );

  /*
   * ---------------------------------------------------------
   * PASS 1: known credential patterns
   * ---------------------------------------------------------
   */
  for (
    let lineIndex = 0;
    lineIndex < lines.length;
    lineIndex++
  ) {
    const line =
      lines[lineIndex];

    for (
      const secret of SECRET_PATTERNS
    ) {
      secret.pattern.lastIndex =
        0;

      let match:
        | RegExpExecArray
        | null;

      while (
        (match =
          secret.pattern.exec(
            line
          )) !== null
      ) {
        const matchedText =
          match[0];

        const value =
          extractQuotedValue(
            matchedText
          );

        const finding =
          createFinding(
            repoPath,
            filePath,
            lineIndex + 1,
            secret
          );

        if (
          shouldReportFinding(
            finding,
            value
          )
        ) {
          findings.push(
            finding
          );
        }

        /*
         * Prevent an infinite loop if a future pattern
         * accidentally becomes zero-length.
         */
        if (
          match.index ===
          secret.pattern.lastIndex
        ) {
          secret.pattern.lastIndex++;
        }
      }
    }
  }

  /*
   * ---------------------------------------------------------
   * PASS 2: multiline API-key assignment
   *
   * Example:
   *
   * const apiKey =
   *   "sk_live_1234567890abcdef";
   * ---------------------------------------------------------
   */
  const normalizedLines =
    lines.map(
      (line) =>
        line.trim()
    );

  for (
    let i = 0;
    i <
    normalizedLines.length;
    i++
  ) {
    const current =
      normalizedLines[i];

    const isApiKeyAssignment =
      /\b(?:api[_-]?key|apikey)\s*[:=]\s*$/i.test(
        current
      );

    if (
      !isApiKeyAssignment
    ) {
      continue;
    }

    const next =
      normalizedLines[i + 1];

    if (
      !next
    ) {
      continue;
    }

    const valueMatch =
      next.match(
        /^["'`]([^"'`]+)["'`][;,]?$/
      );

    if (
      !valueMatch
    ) {
      continue;
    }

    const value =
      valueMatch[1];

    const finding:
      SecretFinding = {
      name:
        "Generic API Key",

      file:
        path.relative(
          repoPath,
          filePath
        ),

      line:
        i + 1,

      severity:
        "warning"
    };

    if (
      shouldReportFinding(
        finding,
        value
      )
    ) {
      findings.push(
        finding
      );
    }
  }

  /*
   * ---------------------------------------------------------
   * PASS 3: remove duplicate findings
   * ---------------------------------------------------------
   */
  const uniqueFindings =
    new Map<
      string,
      SecretFinding
    >();

  for (
    const finding of findings
  ) {
    const key = [
      finding.name,
      finding.file,
      finding.line,
      finding.severity
    ].join("|");

    uniqueFindings.set(
      key,
      finding
    );
  }

  return Array.from(
    uniqueFindings.values()
  );
}

/**
 * Public RepoDoctor secret check.
 */
export function checkSecrets(
  repoPath: string
): CheckResult {
  const files =
    collectFiles(
      repoPath
    );

  const findings:
    SecretFinding[] = [];

  for (
    const file of files
  ) {
    findings.push(
      ...scanFile(
        repoPath,
        file
      )
    );
  }

  const criticalCount =
    findings.filter(
      (finding) =>
        finding.severity ===
        "critical"
    ).length;

  const warningCount =
    findings.filter(
      (finding) =>
        finding.severity ===
        "warning"
    ).length;

  /*
   * No findings = perfect security score.
   */
  if (
    findings.length === 0
  ) {
    return {
      id:
        "secrets",

      name:
        "Secret Detection",

      category:
        "Security",

      severity:
        "info",

      passed:
        true,

      score:
        100,

      message:
        `Scanned ${files.length} text file(s). No obvious secrets detected.`
    };
  }

  /*
   * Critical credentials have a much bigger impact
   * than generic warnings.
   */
  const score =
    Math.max(
      0,
      100 -
        criticalCount * 30 -
        warningCount * 10
    );

  const summary =
    findings
      .slice(0, 5)
      .map(
        (finding) =>
          `${finding.name} at ${finding.file}:${finding.line}`
      )
      .join("; ");

  return {
    id:
      "secrets",

    name:
      "Secret Detection",

    category:
      "Security",

    severity:
      criticalCount > 0
        ? "critical"
        : "warning",

    passed:
      false,

    score,

    message:
      `Found ${findings.length} possible secret(s): ` +
      `${criticalCount} critical, ` +
      `${warningCount} warning.`,

    recommendation:
      `Review: ${summary}`
  };
}