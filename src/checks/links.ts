import fs from "node:fs";
import path from "node:path";
import type { CheckResult } from "../types.js";

interface LinkIssue {
  link: string;
  reason: string;
}

function extractLinks(content: string): string[] {
  const links = new Set<string>();

  // Markdown links: [text](url)
  const markdownRegex = /\[[^\]]*\]\(([^)]+)\)/g;

  for (const match of content.matchAll(markdownRegex)) {
    const link = match[1]?.trim();

    if (link) {
      links.add(link);
    }
  }

  // Raw URLs
  const urlRegex = /https?:\/\/[^\s<>)"]+/g;

  for (const match of content.matchAll(urlRegex)) {
    links.add(match[0]);
  }

  return [...links];
}

function checkLocalLink(
  repoPath: string,
  link: string
): LinkIssue | null {
  const cleanLink = link.split("#")[0].trim();

  if (!cleanLink || cleanLink.startsWith("http")) {
    return null;
  }

  if (
    cleanLink.startsWith("mailto:") ||
    cleanLink.startsWith("tel:")
  ) {
    return null;
  }

  const targetPath = path.resolve(repoPath, cleanLink);

  if (!fs.existsSync(targetPath)) {
    return {
      link,
      reason: "File does not exist"
    };
  }

  return null;
}

export function checkLinks(repoPath: string): CheckResult {
  const readmePath = path.join(repoPath, "README.md");

  if (!fs.existsSync(readmePath)) {
    return {
      id: "links",
      name: "Documentation Links",
      category: "Documentation",
      severity: "info",
      passed: true,
      score: 100,
      message: "README not found, so no documentation links were checked."
    };
  }

  const content = fs.readFileSync(readmePath, "utf8");
  const links = extractLinks(content);

  const issues: LinkIssue[] = [];

  for (const link of links) {
    const issue = checkLocalLink(repoPath, link);

    if (issue) {
      issues.push(issue);
    }
  }

  if (issues.length === 0) {
    return {
      id: "links",
      name: "Documentation Links",
      category: "Documentation",
      severity: "info",
      passed: true,
      score: 100,
      message: `Checked ${links.length} link(s). No broken local links found.`
    };
  }

  const score = Math.max(
    0,
    Math.round(
      ((links.length - issues.length) / Math.max(links.length, 1)) * 100
    )
  );

  return {
    id: "links",
    name: "Documentation Links",
    category: "Documentation",
    severity: issues.length >= 3 ? "warning" : "info",
    passed: false,
    score,
    message: `Found ${issues.length} broken local link(s).`,
    recommendation: issues
      .map((issue) => `${issue.link} — ${issue.reason}`)
      .join("; ")
  };
}