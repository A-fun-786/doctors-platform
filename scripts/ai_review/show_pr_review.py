#!/usr/bin/env python3
"""
Fetch and display the latest `agy` AI Code Review status and PR comment for a pull request.

Designed for AI coding assistants and developers before/during `gh pr merge` so all
AI-detected findings are surfaced automatically even when the check is non-mandatory.
"""

from __future__ import annotations

import argparse
import json
import shutil
import subprocess
import sys
from typing import Any

COMMENT_MARKER = "<!-- agy-ai-code-review -->"


def run_gh(args: list[str]) -> subprocess.CompletedProcess[str]:
    gh_bin = shutil.which("gh")
    if not gh_bin:
        raise RuntimeError("GitHub CLI (`gh`) is not installed or not in PATH.")
    return subprocess.run(
        [gh_bin, *args],
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
        check=False,
    )


def extract_ai_review_comment(comments: list[dict[str, Any]]) -> dict[str, Any] | None:
    """Return the latest PR comment containing the `agy` review marker."""
    for comment in reversed(comments):
        body = comment.get("body")
        if isinstance(body, str) and COMMENT_MARKER in body:
            return comment
    return None


def extract_ai_check_status(status_checks: list[dict[str, Any]]) -> dict[str, Any] | None:
    """Extract the `AI Code Review` check entry from `gh pr view --json statusCheckRollup`."""
    for item in status_checks:
        if item.get("name") == "AI Code Review" or item.get("context") == "AI Code Review":
            return item
    return None


def resolve_pr_context(pr_ref: str | None) -> tuple[str, int, str, dict[str, Any] | None]:
    view_args = ["pr", "view"]
    if pr_ref:
        view_args.append(pr_ref)
    view_args.extend(["--json", "number,url,headRepositoryOwner,baseRefName,headRefName,statusCheckRollup"])

    res = run_gh(view_args)
    if res.returncode != 0:
        raise RuntimeError(res.stderr.strip() or res.stdout.strip() or "Failed to query PR via `gh pr view`.")

    data = json.loads(res.stdout)
    number = int(data["number"])
    url = str(data.get("url", ""))
    checks = data.get("statusCheckRollup") or []
    ai_check = extract_ai_check_status(checks)

    # Derive owner/repo reliably from `gh repo view`.
    repo_res = run_gh(["repo", "view", "--json", "nameWithOwner"])
    if repo_res.returncode != 0:
        raise RuntimeError(repo_res.stderr.strip() or "Failed to resolve repository via `gh repo view`.")
    repo_slug = json.loads(repo_res.stdout)["nameWithOwner"]
    return repo_slug, number, url, ai_check


def format_pr_review_output(
    repo_slug: str,
    pr_number: int,
    pr_url: str,
    ai_check: dict[str, Any] | None,
    comment: dict[str, Any] | None,
) -> str:
    lines = [
        "=" * 72,
        f"AI Code Review Summary for {repo_slug}#{pr_number}",
        f"PR URL: {pr_url}",
    ]
    if ai_check:
        status = ai_check.get("status") or ai_check.get("state") or "UNKNOWN"
        conclusion = ai_check.get("conclusion") or "PENDING"
        lines.append(f"Check (`AI Code Review`): status={status}, conclusion={conclusion}")
    else:
        lines.append("Check (`AI Code Review`): NOT FOUND (workflow may not have started or workflow file is not on base branch yet)")

    lines.append("-" * 72)
    if comment:
        body = comment["body"].replace(COMMENT_MARKER, "").strip()
        lines.append(body)
        if comment.get("updated_at"):
            lines.append("")
            lines.append(f"(Last updated: {comment['updated_at']})")
    else:
        lines.append("No `agy` AI Code Review comment found on this PR yet.")
    lines.append("=" * 72)
    return "\n".join(lines)


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        description="Display the latest `agy` AI Code Review status and PR comment for a pull request."
    )
    parser.add_argument(
        "pr",
        nargs="?",
        default=None,
        help="PR number, URL, or branch (defaults to current branch's PR).",
    )
    args = parser.parse_args(argv)

    try:
        repo_slug, pr_number, pr_url, ai_check = resolve_pr_context(args.pr)
        comments_res = run_gh(
            ["api", "--paginate", f"/repos/{repo_slug}/issues/{pr_number}/comments"]
        )
        if comments_res.returncode != 0:
            raise RuntimeError(
                comments_res.stderr.strip() or "Failed to fetch PR comments via `gh api`."
            )
        comments = json.loads(comments_res.stdout or "[]")
        comment = extract_ai_review_comment(comments)
        print(format_pr_review_output(repo_slug, pr_number, pr_url, ai_check, comment))
        return 0
    except Exception as exc:  # noqa: BLE001
        print(f"[ai-review] Unable to fetch PR AI review summary: {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main())
