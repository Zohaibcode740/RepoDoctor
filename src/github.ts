
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

const GITHUB_API_URL = "https://api.github.com";
const GITHUB_HOSTS = new Set([
  "github.com",
  "www.github.com"
]);

const CLONE_TIMEOUT = 120_000;

export interface GithubRepositoryInfo {
  fullName: string;
  stars: number;
  forks: number;
  openIssues: number;
  watchers: number;
  defaultBranch: string;
  language: string | null;
  archived: boolean;
  pushedAt: string;
}

interface GithubApiRepository {
  full_name?: string;
  stargazers_count?: number;
  forks_count?: number;
  open_issues_count?: number;
  watchers_count?: number;
  default_branch?: string;
  language?: string | null;
  archived?: boolean;
  pushed_at?: string;
}

/**
 * Check whether a value is a GitHub repository URL.
 *
 * Supported:
 *   https://github.com/facebook/react
 *   https://github.com/facebook/react.git
 *   https://github.com/facebook/react/
 *   https://www.github.com/facebook/react
 *
 * Query strings and fragments are rejected because they are not
 * meaningful for repository cloning/API lookup.
 */
export function isGithubUrl(
  value: string
): boolean {
  try {
    const url = new URL(value);

    if (
      url.protocol !== "https:" &&
      url.protocol !== "http:"
    ) {
      return false;
    }

    if (!GITHUB_HOSTS.has(
      url.hostname.toLowerCase()
    )) {
      return false;
    }

    if (
      url.search ||
      url.hash
    ) {
      return false;
    }

    const parts = url.pathname
      .split("/")
      .filter(Boolean);

    if (parts.length !== 2) {
      return false;
    }

    const owner = parts[0]?.trim();
    const repository =
      parts[1]
        ?.replace(/\.git$/i, "")
        .trim();

    return Boolean(
      owner &&
      repository
    );
  } catch {
    return false;
  }
}

/**
 * Extract owner/repository from a GitHub URL.
 */
function getGithubRepositoryPath(
  repositoryUrl: string
): string {
  let url: URL;

  try {
    url = new URL(repositoryUrl);
  } catch {
    throw new Error(
      "Invalid GitHub repository URL."
    );
  }

  if (
    url.protocol !== "https:" &&
    url.protocol !== "http:"
  ) {
    throw new Error(
      "Invalid GitHub repository URL. Use an HTTP or HTTPS GitHub URL."
    );
  }

  if (
    !GITHUB_HOSTS.has(
      url.hostname.toLowerCase()
    )
  ) {
    throw new Error(
      "Invalid GitHub repository URL. Expected a github.com repository URL."
    );
  }

  if (
    url.search ||
    url.hash
  ) {
    throw new Error(
      "Invalid GitHub repository URL. Query strings and fragments are not supported."
    );
  }

  const parts = url.pathname
    .split("/")
    .filter(Boolean);

  if (parts.length !== 2) {
    throw new Error(
      "Invalid GitHub repository URL. Expected: https://github.com/owner/repository"
    );
  }

  const owner =
    parts[0]?.trim();

  const repository =
    parts[1]
      ?.replace(/\.git$/i, "")
      .trim();

  if (
    !owner ||
    !repository
  ) {
    throw new Error(
      "Invalid GitHub repository URL."
    );
  }

  return `${owner}/${repository}`;
}

/**
 * Fetch repository metadata from GitHub.
 */
export async function getGithubRepositoryInfo(
  repositoryUrl: string
): Promise<GithubRepositoryInfo> {
  if (!isGithubUrl(repositoryUrl)) {
    throw new Error(
      "Invalid GitHub repository URL. Expected: https://github.com/owner/repository"
    );
  }

  const repository =
    getGithubRepositoryPath(
      repositoryUrl
    );

  let response: Response;

  try {
    response = await fetch(
      `${GITHUB_API_URL}/repos/${repository}`,
      {
        headers: {
          Accept:
            "application/vnd.github+json",
          "User-Agent":
            "RepoDoctor/0.1.0"
        }
      }
    );
  } catch {
    throw new Error(
      "Could not connect to GitHub. Check your internet connection."
    );
  }

  if (!response.ok) {
    if (
      response.status === 404
    ) {
      throw new Error(
        `GitHub repository "${repository}" was not found. Make sure the owner/repository name is correct and the repository is public.`
      );
    }

    if (
      response.status === 403
    ) {
      const remaining =
        response.headers.get(
          "x-ratelimit-remaining"
        );

      if (
        remaining === "0"
      ) {
        throw new Error(
          "GitHub API rate limit exceeded. Try again later."
        );
      }

      throw new Error(
        "GitHub API request was forbidden (HTTP 403)."
      );
    }

    if (
      response.status === 429
    ) {
      throw new Error(
        "GitHub API rate limit exceeded. Try again later."
      );
    }

    if (
      response.status >= 500
    ) {
      throw new Error(
        `GitHub is currently unavailable (HTTP ${response.status}). Try again later.`
      );
    }

    throw new Error(
      `GitHub API request failed with status ${response.status}.`
    );
  }

  let data: GithubApiRepository;

  try {
    data =
      (await response.json()) as GithubApiRepository;
  } catch {
    throw new Error(
      "GitHub returned an invalid API response."
    );
  }

  if (
    !data.full_name ||
    !data.default_branch ||
    !data.pushed_at
  ) {
    throw new Error(
      "GitHub returned incomplete repository information."
    );
  }

  return {
    fullName:
      data.full_name,

    stars:
      data.stargazers_count ?? 0,

    forks:
      data.forks_count ?? 0,

    openIssues:
      data.open_issues_count ?? 0,

    watchers:
      data.watchers_count ?? 0,

    defaultBranch:
      data.default_branch,

    language:
      data.language ?? null,

    archived:
      data.archived ?? false,

    pushedAt:
      data.pushed_at
  };
}

/**
 * Clone a GitHub repository into a temporary directory.
 */
export async function cloneGithubRepository(
  repositoryUrl: string
): Promise<string> {
  if (!isGithubUrl(repositoryUrl)) {
    throw new Error(
      "Invalid GitHub repository URL. Expected: https://github.com/owner/repository"
    );
  }

  const repository =
    getGithubRepositoryPath(
      repositoryUrl
    );

  const tempRoot =
    fs.mkdtempSync(
      path.join(
        os.tmpdir(),
        "repodoctor-"
      )
    );

  const target =
    path.join(
      tempRoot,
      "repository"
    );

  try {
    await execFileAsync(
      "git",
      [
        "clone",
        "--depth",
        "1",
        "--no-tags",
        "--single-branch",
        repositoryUrl,
        target
      ],
      {
        timeout:
          CLONE_TIMEOUT,

        windowsHide:
          true,

        maxBuffer:
          5 * 1024 * 1024
      }
    );

    if (
      !fs.existsSync(target)
    ) {
      throw new Error(
        "Git clone completed but the repository directory was not created."
      );
    }

    return target;
  } catch (error) {
    removeTemporaryDirectory(
      tempRoot
    );

    if (
      isExecTimeoutError(error)
    ) {
      throw new Error(
        `GitHub repository "${repository}" took too long to clone.`
      );
    }

    if (
      isGitNotFoundError(error)
    ) {
      throw new Error(
        "Git is not installed or could not be found in PATH."
      );
    }

    if (
      isPermissionError(error)
    ) {
      throw new Error(
        `Permission denied while cloning GitHub repository "${repository}".`
      );
    }

    throw new Error(
      `Failed to clone GitHub repository "${repository}". Make sure Git is installed and the repository is public.`
    );
  }
}

/**
 * Remove a temporary RepoDoctor repository.
 *
 * Cleanup is intentionally best-effort because Windows can briefly
 * keep Git files locked after the child process exits.
 */
export function cleanupRepository(
  repoPath: string
): void {
  if (
    !repoPath
  ) {
    return;
  }

  const tempRoot =
    findRepoDoctorTempRoot(
      repoPath
    );

  if (!tempRoot) {
    return;
  }

  removeTemporaryDirectory(
    tempRoot
  );
}

/**
 * Find the RepoDoctor temporary directory.
 */
function findRepoDoctorTempRoot(
  repoPath: string
): string | null {
  const absolutePath =
    path.resolve(repoPath);

  const repositoryName =
    path.basename(
      absolutePath
    );

  if (
    repositoryName !==
    "repository"
  ) {
    return null;
  }

  const tempRoot =
    path.dirname(
      absolutePath
    );

  if (
    !path.basename(
      tempRoot
    ).startsWith(
      "repodoctor-"
    )
  ) {
    return null;
  }

  return tempRoot;
}

/**
 * Best-effort temporary directory removal.
 */
function removeTemporaryDirectory(
  directory: string
): void {
  try {
    fs.rmSync(
      directory,
      {
        recursive: true,
        force: true,
        maxRetries: 5,
        retryDelay: 150
      }
    );
  } catch {
    /*
     * Windows can temporarily hold a file handle after git exits.
     * Cleanup should never make an otherwise successful scan fail.
     */
  }
}

function isExecTimeoutError(
  error: unknown
): boolean {
  if (
    !error ||
    typeof error !== "object"
  ) {
    return false;
  }

  const value =
    error as {
      killed?: boolean;
      signal?: string;
      code?: string;
    };

  return (
    value.killed === true ||
    value.signal === "SIGTERM" ||
    value.code === "ETIMEDOUT"
  );
}

function isGitNotFoundError(
  error: unknown
): boolean {
  if (
    !error ||
    typeof error !== "object"
  ) {
    return false;
  }

  const value =
    error as {
      code?: string;
      message?: string;
    };

  return (
    value.code ===
      "ENOENT" ||
    value.message?.includes(
      "ENOENT"
    ) === true
  );
}

function isPermissionError(
  error: unknown
): boolean {
  if (
    !error ||
    typeof error !== "object"
  ) {
    return false;
  }

  const value =
    error as {
      code?: string;
      message?: string;
    };

  return (
    value.code ===
      "EACCES" ||
    value.code ===
      "EPERM" ||
    value.message?.includes(
      "Permission denied"
    ) === true
  );
}