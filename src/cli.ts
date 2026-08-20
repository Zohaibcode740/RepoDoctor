#!/usr/bin/env node

import path from "node:path";
import fs from "node:fs";

import { Command } from "commander";
import chalk from "chalk";
import ora from "ora";

import { scanRepository } from "./scanner.js";

import {
  isGithubUrl,
  cloneGithubRepository,
  cleanupRepository,
  getGithubRepositoryInfo
} from "./github.js";

const program = new Command();

program
  .name("repodoctor")
  .description("GitHub repository health checker")
  .version("0.1.0");

program
  .command("scan")
  .description("Scan a local repository or GitHub repository")
  .argument(
    "[target]",
    "Repository path or GitHub URL",
    "."
  )
  .option(
    "--json",
    "Output the scan result as JSON"
  )
  .option(
    "--report <file>",
    "Save the scan result as a JSON report"
  )
  .action(
    async (
      target: string,
      options: {
        json?: boolean;
        report?: string;
      }
    ) => {
      const spinner = ora(
        "Preparing repository..."
      ).start();

      let repoPath: string | null = null;
      let temporaryRepository = false;

      try {
        let githubInfo = null;

        /*
         * Determine whether the target is a local
         * repository or a GitHub repository.
         */
        if (isGithubUrl(target)) {
          spinner.text =
            "Fetching GitHub repository information...";

          githubInfo =
            await getGithubRepositoryInfo(target);

          spinner.text =
            "Cloning GitHub repository...";

          repoPath =
            await cloneGithubRepository(target);

          temporaryRepository = true;
        } else {
          repoPath = path.resolve(target);

          spinner.text =
            "Scanning repository...";
        }

        if (!repoPath) {
          throw new Error(
            "Repository path could not be determined."
          );
        }

        spinner.text =
          "Scanning repository...";

        const report =
          await scanRepository(repoPath);

        const output = {
          ...report,
          github: githubInfo
        };

        /*
         * Stop the spinner before doing any output.
         */
        spinner.stop();

        /*
         * --report
         */
        if (options.report) {
          const reportPath =
            path.resolve(options.report);

          fs.writeFileSync(
            reportPath,
            JSON.stringify(
              output,
              null,
              2
            ),
            "utf8"
          );

          console.log(
            chalk.green(
              `Report saved to: ${reportPath}`
            )
          );
        }

        /*
         * --json
         */
        if (options.json) {
          console.log(
            JSON.stringify(
              output,
              null,
              2
            )
          );
        }

        /*
         * Normal terminal output.
         */
        if (
          !options.json &&
          !options.report
        ) {
          printHumanReport(output);
        }

        /*
         * Cleanup temporary GitHub repository.
         */
        if (
          temporaryRepository &&
          repoPath
        ) {
          cleanupRepository(repoPath);

          repoPath = null;
          temporaryRepository = false;
        }
      } catch (error) {
        /*
         * Stop the spinner before printing the error.
         *
         * This is important on Windows because abruptly
         * terminating the Node process while ora/libuv
         * still owns terminal handles can produce:
         *
         * Assertion failed:
         * !(handle->flags & UV_HANDLE_CLOSING)
         */
        spinner.stop();

        /*
         * Cleanup temporary repository if one was created.
         */
        if (
          temporaryRepository &&
          repoPath
        ) {
          cleanupRepository(repoPath);

          repoPath = null;
          temporaryRepository = false;
        }

        const message =
          error instanceof Error
            ? error.message
            : "Unknown error";

        if (options.json) {
          console.log(
            JSON.stringify(
              {
                error: message
              },
              null,
              2
            )
          );
        } else {
          console.error(
            chalk.red("Scan failed.")
          );

          console.error(message);
        }

        /*
         * IMPORTANT:
         *
         * Do NOT use process.exit(1) here.
         *
         * process.exit() terminates Node immediately and can
         * cause Windows/libuv handle assertions when ora or
         * other async resources are still being cleaned up.
         *
         * process.exitCode allows Node to finish cleanup normally.
         */
        process.exitCode = 1;

        return;
      }
    }
  );

function printHumanReport(
  report: {
    path: string;
    score: number;
    checks: Array<{
      name: string;
      score: number;
      passed: boolean;
      severity: string;
      message: string;
      recommendation?: string;
    }>;
    github: {
      fullName: string;
      stars: number;
      forks: number;
      openIssues: number;
      watchers: number;
      defaultBranch: string;
      language: string | null;
      archived: boolean;
      pushedAt: string;
    } | null;
  }
): void {
  console.log();

  console.log(
    chalk.bold("RepoDoctor")
  );

  console.log(
    "────────────────────────"
  );

  /*
   * GitHub metadata.
   */
  if (report.github) {
    console.log(
      chalk.bold(
        "GitHub Repository"
      )
    );

    console.log(
      `  Repository: ${report.github.fullName}`
    );

    console.log(
      `  Stars: ${report.github.stars.toLocaleString()}`
    );

    console.log(
      `  Forks: ${report.github.forks.toLocaleString()}`
    );

    console.log(
      `  Open Issues: ${report.github.openIssues.toLocaleString()}`
    );

    console.log(
      `  Watchers: ${report.github.watchers.toLocaleString()}`
    );

    console.log(
      `  Default Branch: ${report.github.defaultBranch}`
    );

    console.log(
      `  Language: ${
        report.github.language ?? "Unknown"
      }`
    );

    console.log(
      `  Archived: ${
        report.github.archived
          ? "Yes"
          : "No"
      }`
    );

    console.log(
      `  Last Push: ${
        new Date(
          report.github.pushedAt
        ).toLocaleString()
      }`
    );

    console.log();
  }

  /*
   * Overall score.
   */
  console.log(
    `Health Score: ${formatScore(
      report.score
    )}`
  );

  console.log();

  /*
   * Individual checks.
   */
  for (const check of report.checks) {
    const icon =
      check.passed
        ? "✓"
        : "✗";

    const color =
      check.severity === "critical"
        ? chalk.red
        : check.severity === "warning"
          ? chalk.yellow
          : chalk.green;

    console.log(
      `${color(icon)} ${
        check.name
      }: ${check.score}/100`
    );

    console.log(
      `  ${check.message}`
    );

    if (check.recommendation) {
      console.log(
        chalk.gray(
          `  → ${check.recommendation}`
        )
      );
    }

    console.log();
  }
}

function formatScore(
  score: number
): string {
  if (score >= 80) {
    return chalk.green(
      `${score}/100`
    );
  }

  if (score >= 60) {
    return chalk.yellow(
      `${score}/100`
    );
  }

  return chalk.red(
    `${score}/100`
  );
}

program.parseAsync().catch(
  (error: unknown) => {
    const message =
      error instanceof Error
        ? error.message
        : "Unknown error";

    console.error(
      chalk.red("Unexpected CLI error.")
    );

    console.error(message);

    /*
     * Again, don't abruptly call process.exit().
     */
    process.exitCode = 1;
  }
);