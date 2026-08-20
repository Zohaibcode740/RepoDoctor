export type Severity = "critical" | "warning" | "info";

export interface CheckResult {
  id: string;
  name: string;
  category: string;
  severity: Severity;
  passed: boolean;
  score: number;
  message: string;
  recommendation?: string;
}

export interface RepositoryReport {
  path: string;
  score: number;
  checks: CheckResult[];
}

export interface GitHubRepositoryInfo {
  owner: string;
  name: string;
  fullName: string;

  description: string | null;

  stars: number;
  forks: number;
  openIssues: number;
  watchers: number;

  defaultBranch: string;

  language: string | null;

  archived: boolean;
  disabled: boolean;

  createdAt: string;
  updatedAt: string;
  pushedAt: string | null;

  htmlUrl: string;

  license: string | null;
}