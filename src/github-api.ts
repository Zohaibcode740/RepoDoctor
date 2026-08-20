import type { GitHubRepositoryInfo } from "./types.js";

function parseGithubUrl(
  githubUrl: string
): { owner: string; repo: string } {
  const url = new URL(githubUrl);

  if (url.hostname !== "github.com") {
    throw new Error("Only github.com URLs are supported.");
  }

  const parts = url.pathname
    .split("/")
    .filter(Boolean);

  if (parts.length < 2) {
    throw new Error(
      "Invalid GitHub repository URL."
    );
  }

  return {
    owner: parts[0],
    repo: parts[1].replace(/\.git$/, "")
  };
}

export async function getGithubRepositoryInfo(
  githubUrl: string
): Promise<GitHubRepositoryInfo> {
  const { owner, repo } =
    parseGithubUrl(githubUrl);

  const response = await fetch(
    `https://api.github.com/repos/${encodeURIComponent(
      owner
    )}/${encodeURIComponent(repo)}`,
    {
      headers: {
        Accept:
          "application/vnd.github+json",
        "User-Agent": "RepoDoctor"
      }
    }
  );

  if (!response.ok) {
    if (response.status === 404) {
      throw new Error(
        "GitHub repository was not found. Check the URL and make sure the repository is public."
      );
    }

    if (response.status === 403) {
      throw new Error(
        "GitHub API rate limit exceeded. Try again later or configure a GitHub token."
      );
    }

    throw new Error(
      `GitHub API request failed with status ${response.status}.`
    );
  }

  const data =
    (await response.json()) as GithubApiResponse;

  return {
    owner: data.owner.login,
    name: data.name,
    fullName: data.full_name,
    description: data.description,
    stars: data.stargazers_count,
    forks: data.forks_count,
    openIssues: data.open_issues_count,
    watchers: data.watchers_count,
    defaultBranch: data.default_branch,
    language: data.language,
    archived: data.archived,
    disabled: data.disabled,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
    pushedAt: data.pushed_at,
    htmlUrl: data.html_url,
    license: data.license?.spdx_id ?? null
  };
}

interface GithubApiResponse {
  name: string;
  full_name: string;

  owner: {
    login: string;
  };

  description: string | null;

  stargazers_count: number;
  forks_count: number;
  open_issues_count: number;
  watchers_count: number;

  default_branch: string;

  language: string | null;

  archived: boolean;
  disabled: boolean;

  created_at: string;
  updated_at: string;
  pushed_at: string | null;

  html_url: string;

  license: {
    spdx_id: string | null;
  } | null;
}