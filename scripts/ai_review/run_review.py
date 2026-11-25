#!/usr/bin/env python3
"""
Centralized AI Code Review runner powered by Antigravity CLI (`agy`).

Shared by both:
  - Local Git pre-push hook (.githooks/pre-push)
  - GitHub Actions Pull Request workflow (.github/workflows/ai-code-review.yml)

Exit codes:
  0 - PASS (no CRITICAL or HIGH findings, or no reviewable code changes)
  1 - BLOCK (one or more CRITICAL or HIGH findings detected)
  2 - FAIL CLOSED (execution error, auth error, timeout, malformed output, or safety violation)
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import shutil
import subprocess
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Any

ZERO_SHA = "0" * 40
EMPTY_TREE_SHA = "4b825dc642cb6eb9a060e54bf8d69288fbee4904"

ALLOWED_SEVERITIES = ("CRITICAL", "HIGH", "MEDIUM", "LOW")
BLOCKING_SEVERITIES = frozenset({"CRITICAL", "HIGH"})
ALLOWED_CATEGORIES = frozenset(
    {
        "security",
        "auth_rbac",
        "bug_edge_case",
        "architecture",
        "naming",
        "api_database",
        "regression",
        "testing",
        "agents_md",
    }
)
REQUIRED_FINDING_FIELDS = (
    "severity",
    "category",
    "file",
    "line",
    "explanation",
    "suggested_fix",
)

# Lockfiles are intentionally NOT ignored so supply-chain/integrity changes are reviewed.
IGNORED_DIFF_SUFFIXES = (
    ".tsbuildinfo",
    ".min.js",
    ".min.css",
    ".map",
    ".png",
    ".jpg",
    ".jpeg",
    ".gif",
    ".ico",
    ".webp",
    ".pdf",
    ".woff",
    ".woff2",
    ".ttf",
    ".zip",
    ".apk",
    ".aab",
    ".db",
    ".sqlite3",
)

PROTECTED_REVIEW_PREFIXES = (
    ".github/workflows/",
    ".github/CODEOWNERS",
    "scripts/ai_review/",
    ".agents/",
    ".githooks/",
    "scripts/install-git-hooks.sh",
)

DEFAULT_MAX_DIFF_CHARS = 80_000
DEFAULT_TIMEOUT_SECONDS = 180
COMMENT_MARKER = "<!-- agy-ai-code-review -->"


class ReviewExecutionError(RuntimeError):
    """Raised whenever review execution, auth, parsing, schema, or safety fails."""


@dataclass(frozen=True)
class PushRef:
    local_ref: str
    local_sha: str
    remote_ref: str
    remote_sha: str


def repo_root_from_script() -> Path:
    return Path(__file__).resolve().parents[2]


def run_git(args: list[str], cwd: Path, check: bool = True) -> subprocess.CompletedProcess[str]:
    result = subprocess.run(
        ["git", *args],
        cwd=str(cwd),
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
        check=False,
    )
    if check and result.returncode != 0:
        raise ReviewExecutionError(
            f"git {' '.join(args)} failed (exit {result.returncode}): {result.stderr.strip()}"
        )
    return result


def parse_pre_push_stdin(raw: str) -> list[PushRef]:
    refs: list[PushRef] = []
    for line in raw.splitlines():
        stripped = line.strip()
        if not stripped:
            continue
        parts = stripped.split()
        if len(parts) != 4:
            raise ReviewExecutionError(f"Malformed pre-push stdin line: {stripped!r}")
        refs.append(PushRef(*parts))
    return refs


def resolve_new_branch_base(local_sha: str, repo_root: Path) -> str:
    """Resolve the base commit for a brand-new branch being pushed."""
    candidates = ("origin/HEAD", "origin/main", "origin/develop", "main", "develop")
    for candidate in candidates:
        verify = run_git(["rev-parse", "--verify", "--quiet", candidate], cwd=repo_root, check=False)
        if verify.returncode != 0:
            continue
        candidate_sha = verify.stdout.strip()
        if candidate_sha == local_sha:
            continue
        mb = run_git(["merge-base", candidate, local_sha], cwd=repo_root, check=False)
        if mb.returncode == 0 and mb.stdout.strip():
            return mb.stdout.strip()

    rev_list = run_git(["rev-list", local_sha, "--not", "--remotes"], cwd=repo_root, check=False)
    commits = [c.strip() for c in rev_list.stdout.splitlines() if c.strip()]
    if commits:
        oldest = commits[-1]
        parent = run_git(["rev-parse", "--verify", "--quiet", f"{oldest}^"], cwd=repo_root, check=False)
        if parent.returncode == 0 and parent.stdout.strip():
            return parent.stdout.strip()
    return EMPTY_TREE_SHA


def collect_pre_push_diff(refs: list[PushRef], repo_root: Path) -> tuple[str, list[str]]:
    """Collect unified diffs and commit range descriptions for all outgoing push refs."""
    diffs: list[str] = []
    ranges: list[str] = []

    for ref in refs:
        if ref.local_sha == ZERO_SHA:
            # Remote branch deletion — no outgoing code changes to review.
            continue

        if ref.remote_sha == ZERO_SHA:
            base_sha = resolve_new_branch_base(ref.local_sha, repo_root)
        else:
            base_sha = ref.remote_sha

        if base_sha == ref.local_sha:
            continue

        range_spec = f"{base_sha}..{ref.local_sha}"
        ranges.append(f"{ref.local_ref} ({range_spec})")
        diff_res = run_git(
            ["diff", "--unified=3", "--no-color", "--no-ext-diff", range_spec],
            cwd=repo_root,
        )
        if diff_res.stdout.strip():
            diffs.append(diff_res.stdout)

    return "\n".join(diffs), ranges


def collect_pr_diff(
    base_sha: str, head_sha: str, repo_root: Path, require_base_checkout: bool = False
) -> tuple[str, list[str]]:
    """Collect unified diff for a pull request from base_sha to head_sha."""
    if not base_sha or not head_sha:
        raise ReviewExecutionError("Both --base-sha and --head-sha are required in pr mode.")

    if require_base_checkout:
        checked_out = run_git(["rev-parse", "HEAD"], cwd=repo_root).stdout.strip()
        resolved_base = run_git(["rev-parse", f"{base_sha}^{{commit}}"], cwd=repo_root).stdout.strip()
        if checked_out != resolved_base:
            raise ReviewExecutionError(
                f"PR security violation: runner workspace HEAD ({checked_out[:12]}) does not match "
                f"trusted base commit ({resolved_base[:12]}). PR code must never be checked out as the "
                "execution workspace."
            )

    # Prefer three-dot merge-base diff so unrelated commits on base branch are excluded.
    three_dot = run_git(
        ["diff", "--unified=3", "--no-color", "--no-ext-diff", f"{base_sha}...{head_sha}"],
        cwd=repo_root,
        check=False,
    )
    if three_dot.returncode == 0:
        return three_dot.stdout, [f"{base_sha[:12]}...{head_sha[:12]}"]

    two_dot = run_git(
        ["diff", "--unified=3", "--no-color", "--no-ext-diff", f"{base_sha}..{head_sha}"],
        cwd=repo_root,
    )
    return two_dot.stdout, [f"{base_sha[:12]}..{head_sha[:12]}"]


def extract_diff_file_path(section: str) -> str:
    first_line = section.splitlines()[0] if section else ""
    # Format: diff --git a/<path> b/<path>
    if " b/" in first_line:
        return first_line.split(" b/", 1)[1].strip()
    return first_line.strip()


def should_skip_diff_file(file_path: str) -> bool:
    lower = file_path.lower()
    return any(lower.endswith(suffix) for suffix in IGNORED_DIFF_SUFFIXES)


def find_protected_review_files(files: list[str]) -> list[str]:
    return [
        path
        for path in files
        if any(
            path == prefix.rstrip("/") or path.startswith(prefix)
            for prefix in PROTECTED_REVIEW_PREFIXES
        )
    ]


def _split_oversized_section(file_path: str, section: str, max_chars: int) -> list[str]:
    """Split a large file diff (e.g. lockfile) across hunk/line boundaries without dropping lines."""
    if len(section) <= max_chars:
        return [section]

    lines = section.splitlines(keepends=True)
    header_lines: list[str] = []
    body_start = 0
    for idx, line in enumerate(lines):
        if line.startswith("@@ "):
            body_start = idx
            break
        header_lines.append(line)
    else:
        body_start = len(lines)

    header = "".join(header_lines)
    if len(header) >= max_chars:
        header = f"diff --git a/{file_path} b/{file_path}\n"

    hunks: list[str] = []
    current_hunk: list[str] = []
    for line in lines[body_start:]:
        if line.startswith("@@ ") and current_hunk:
            hunks.append("".join(current_hunk))
            current_hunk = [line]
        else:
            current_hunk.append(line)
    if current_hunk:
        hunks.append("".join(current_hunk))

    if not hunks:
        return [section[:max_chars]]

    pieces: list[str] = []
    budget = max(512, max_chars - len(header) - 80)
    current_body: list[str] = []
    current_len = 0

    for hunk in hunks:
        if len(hunk) > budget:
            if current_body:
                pieces.append(header + "".join(current_body))
                current_body = []
                current_len = 0
            # Split single oversized hunk along line boundaries.
            line_buf: list[str] = []
            line_len = 0
            for hunk_line in hunk.splitlines(keepends=True):
                if line_buf and line_len + len(hunk_line) > budget:
                    pieces.append(header + "".join(line_buf))
                    line_buf = [hunk_line]
                    line_len = len(hunk_line)
                else:
                    line_buf.append(hunk_line)
                    line_len += len(hunk_line)
            if line_buf:
                pieces.append(header + "".join(line_buf))
            continue

        if current_body and current_len + len(hunk) > budget:
            pieces.append(header + "".join(current_body))
            current_body = [hunk]
            current_len = len(hunk)
        else:
            current_body.append(hunk)
            current_len += len(hunk)

    if current_body:
        pieces.append(header + "".join(current_body))

    return pieces


def split_diff_into_sections(raw_diff: str) -> list[tuple[str, str]]:
    """Split a unified git diff into (file_path, section_text) tuples."""
    if not raw_diff.strip():
        return []

    sections: list[tuple[str, str]] = []
    current_lines: list[str] = []

    for line in raw_diff.splitlines(keepends=True):
        if line.startswith("diff --git ") and current_lines:
            section = "".join(current_lines)
            sections.append((extract_diff_file_path(section), section))
            current_lines = [line]
        else:
            current_lines.append(line)

    if current_lines:
        section = "".join(current_lines)
        sections.append((extract_diff_file_path(section), section))

    return sections


def filter_and_chunk_diff(
    raw_diff: str, max_chars: int = DEFAULT_MAX_DIFF_CHARS
) -> tuple[list[str], list[str], list[str]]:
    """
    Filter binary/generated build artifacts (preserving lockfiles for supply-chain analysis)
    and split remaining diffs into bounded chunks.

    Returns:
      (chunks, included_files, skipped_files)
    """
    sections = split_diff_into_sections(raw_diff)
    if not sections:
        # Handle non-git unified diffs (e.g., synthetic diff snippets without `diff --git`).
        stripped = raw_diff.strip()
        if not stripped:
            return [], [], []
        return [stripped[:max_chars]], ["<unified-diff>"], []

    included_files: list[str] = []
    skipped_files: list[str] = []
    reviewable_sections: list[str] = []

    for file_path, section in sections:
        if should_skip_diff_file(file_path) or "\nBinary files " in section:
            skipped_files.append(file_path)
            continue
        included_files.append(file_path)
        reviewable_sections.extend(_split_oversized_section(file_path, section, max_chars))

    chunks: list[str] = []
    current_chunk: list[str] = []
    current_len = 0

    for section in reviewable_sections:
        if current_chunk and current_len + len(section) > max_chars:
            chunks.append("".join(current_chunk))
            current_chunk = [section]
            current_len = len(section)
        else:
            current_chunk.append(section)
            current_len += len(section)

    if current_chunk:
        chunks.append("".join(current_chunk))

    return chunks, included_files, skipped_files


def _is_transient_snapshot_path(rel_path: str) -> bool:
    norm = rel_path.replace("\\", "/").strip("/")
    transient_prefixes = (".worktrees/", ".next/", ".pytest_cache/", "__pycache__/", "node_modules/")
    if any(norm == p.rstrip("/") or norm.startswith(p) for p in transient_prefixes):
        return True
    if "/__pycache__/" in f"/{norm}/":
        return True
    return norm.endswith((".pyc", ".pyo", ".DS_Store", ".tsbuildinfo"))


def snapshot_workspace(repo_root: Path) -> str:
    """
    Create a cryptographic fingerprint of the git working tree and index.
    Used before and after invoking `agy` to guarantee the reviewer never mutates code.
    """
    is_git = run_git(["rev-parse", "--is-inside-work-tree"], cwd=repo_root, check=False)
    if is_git.returncode != 0:
        return "non-git"

    hasher = hashlib.sha256()
    status_res = run_git(["status", "--porcelain=v1", "--untracked-files=all"], cwd=repo_root)
    filtered_status_lines: list[str] = []
    untracked_files: list[str] = []
    for line in status_res.stdout.splitlines():
        if len(line) > 3:
            rel = line[3:].strip().strip('"')
            if _is_transient_snapshot_path(rel):
                continue
            if line.startswith("?? "):
                untracked_files.append(rel)
        filtered_status_lines.append(line)

    hasher.update("\n".join(filtered_status_lines).encode("utf-8"))
    hasher.update(b"\0")

    unstaged = run_git(["diff", "--no-color", "--no-ext-diff"], cwd=repo_root)
    hasher.update(unstaged.stdout.encode("utf-8"))
    hasher.update(b"\0")

    staged = run_git(["diff", "--cached", "--no-color", "--no-ext-diff"], cwd=repo_root)
    hasher.update(staged.stdout.encode("utf-8"))
    hasher.update(b"\0")

    # Also hash untracked files' content so rogue edits to untracked files are caught.
    for rel in untracked_files:
        target = repo_root / rel
        if target.is_file():
            hasher.update(rel.encode("utf-8"))
            hasher.update(target.read_bytes())
            hasher.update(b"\0")

    return hasher.hexdigest()


def validate_auth_environment(mode: str, auth_mode: str, env: dict[str, str]) -> None:
    """
    Validate authentication prerequisites fail-closed for subscription-backed `agy` execution.
    """
    valid_modes = {"local", "self-hosted"}
    if auth_mode not in valid_modes:
        raise ReviewExecutionError(
            f"Unsupported AGY_AUTH_MODE={auth_mode!r}. Expected one of: {', '.join(sorted(valid_modes))}."
        )

    if mode == "pr" and auth_mode == "local":
        raise ReviewExecutionError(
            "AGY_AUTH_MODE='local' is forbidden in PR/CI mode. Do not assume cached local "
            "credentials exist on GitHub-hosted runners; use 'self-hosted' on an isolated "
            "`agy` intelligence node runner."
        )

    if auth_mode == "self-hosted" and env.get("RUNNER_ENVIRONMENT") == "github-hosted":
        raise ReviewExecutionError(
            "AGY_AUTH_MODE='self-hosted' cannot run on ephemeral GitHub-hosted runners "
            "(no authenticated agy session). Route this job to your isolated self-hosted "
            "`agy` intelligence node runner."
        )


def build_review_prompt(
    prompt_template: str,
    agents_md: str,
    diff_chunk: str,
    included_files: list[str],
    skipped_files: list[str],
    protected_files: list[str],
    ranges: list[str],
    batch_index: int,
    batch_total: int,
) -> str:
    sections = [
        prompt_template.strip(),
        "\n---\n## Repository `AGENTS.md` (Authoritative Rules)\n",
        agents_md.strip() if agents_md.strip() else "(AGENTS.md not found)",
        "\n---\n## Review Metadata\n",
        f"- Commit/PR Scope: {', '.join(ranges) if ranges else 'manual diff'}",
        f"- Diff Batch: {batch_index} of {batch_total}",
        f"- Reviewable Changed Files ({len(included_files)}): {', '.join(included_files) or 'none'}",
    ]
    if protected_files:
        sections.append(
            "- ALERT — Protected Workflow/Reviewer/Runner Files Touched: "
            + ", ".join(protected_files)
            + " (Audit strictly for any attempt to weaken, bypass, or tamper with review protections.)"
        )
    if skipped_files:
        sections.append(
            f"- Omitted Binary/Generated Files ({len(skipped_files)}): {', '.join(skipped_files)}"
        )
    sections.extend(
        [
            "\n---\n## Unified Git Diff To Review\n",
            "```diff",
            diff_chunk.rstrip(),
            "```",
            "\nReturn strictly the JSON object matching the provided schema. Do not modify any files or run any commands.",
        ]
    )
    return "\n".join(sections)


def validate_review_payload(payload: Any) -> dict[str, Any]:
    """Strictly validate the structured review JSON payload. Fail closed on any violation."""
    if not isinstance(payload, dict):
        raise ReviewExecutionError(f"Review payload must be a JSON object, got {type(payload).__name__}.")

    summary = payload.get("summary")
    if not isinstance(summary, str) or not summary.strip():
        raise ReviewExecutionError("Review payload missing non-empty string field 'summary'.")

    findings = payload.get("findings")
    if not isinstance(findings, list):
        raise ReviewExecutionError("Review payload field 'findings' must be a JSON array.")

    validated_findings: list[dict[str, Any]] = []
    for idx, item in enumerate(findings):
        if not isinstance(item, dict):
            raise ReviewExecutionError(f"Finding #{idx} must be a JSON object.")

        missing = [k for k in REQUIRED_FINDING_FIELDS if k not in item]
        if missing:
            raise ReviewExecutionError(f"Finding #{idx} missing required fields: {', '.join(missing)}.")

        raw_severity = item["severity"]
        severity = raw_severity.strip().upper() if isinstance(raw_severity, str) else raw_severity
        if not isinstance(severity, str) or severity not in ALLOWED_SEVERITIES:
            raise ReviewExecutionError(
                f"Finding #{idx} has invalid severity {raw_severity!r}; allowed: {ALLOWED_SEVERITIES}."
            )

        raw_category = item["category"]
        category = raw_category.strip().lower() if isinstance(raw_category, str) else raw_category
        if not isinstance(category, str) or category not in ALLOWED_CATEGORIES:
            raise ReviewExecutionError(
                f"Finding #{idx} has invalid category {raw_category!r}; allowed: {sorted(ALLOWED_CATEGORIES)}."
            )

        file_path = item["file"]
        if not isinstance(file_path, str) or not file_path.strip():
            raise ReviewExecutionError(f"Finding #{idx} must have a non-empty string 'file'.")

        line = item["line"]
        if isinstance(line, bool) or not isinstance(line, int) or line < 0:
            raise ReviewExecutionError(f"Finding #{idx} must have a non-negative integer 'line', got {line!r}.")

        explanation = item["explanation"]
        if not isinstance(explanation, str) or not explanation.strip():
            raise ReviewExecutionError(f"Finding #{idx} must have a non-empty string 'explanation'.")

        suggested_fix = item["suggested_fix"]
        if not isinstance(suggested_fix, str) or not suggested_fix.strip():
            raise ReviewExecutionError(f"Finding #{idx} must have a non-empty string 'suggested_fix'.")

        validated_findings.append(
            {
                "severity": severity,
                "category": category,
                "file": file_path.strip(),
                "line": line,
                "explanation": explanation.strip(),
                "suggested_fix": suggested_fix.strip(),
            }
        )

    return {"summary": summary.strip(), "findings": validated_findings}


def parse_agy_envelope(raw_stdout: str, raw_stderr: str, returncode: int) -> dict[str, Any]:
    """Parse and validate the `--output-format json` envelope produced by `agy`."""
    if returncode != 0:
        detail = raw_stderr.strip() or raw_stdout.strip() or f"exit code {returncode}"
        raise ReviewExecutionError(f"agy exited with status {returncode}: {detail[:600]}")

    if not raw_stdout.strip():
        raise ReviewExecutionError(
            f"agy produced empty stdout. stderr: {raw_stderr.strip()[:400]}"
        )

    try:
        envelope = json.loads(raw_stdout)
    except json.JSONDecodeError as exc:
        raise ReviewExecutionError(
            f"agy returned malformed JSON envelope: {exc}. Raw output prefix: {raw_stdout[:300]!r}"
        ) from exc

    if not isinstance(envelope, dict):
        raise ReviewExecutionError("agy JSON envelope must be a JSON object.")

    status = envelope.get("status")
    error = envelope.get("error")
    if status != "SUCCESS" or error:
        raise ReviewExecutionError(
            f"agy execution did not succeed (status={status!r}, error={error!r})."
        )

    structured = envelope.get("structured_output")
    if structured is None:
        response_text = envelope.get("response")
        if not isinstance(response_text, str) or not response_text.strip():
            raise ReviewExecutionError("agy envelope missing both 'structured_output' and 'response'.")
        cleaned_response = response_text.strip()
        if cleaned_response.startswith("```"):
            lines = cleaned_response.splitlines()
            if lines and lines[0].startswith("```"):
                lines = lines[1:]
            if lines and lines[-1].strip() == "```":
                lines = lines[:-1]
            cleaned_response = "\n".join(lines).strip()
        try:
            structured = json.loads(cleaned_response)
        except json.JSONDecodeError as exc:
            raise ReviewExecutionError(
                f"agy response is not valid JSON matching schema: {exc}"
            ) from exc

    return validate_review_payload(structured)


def invoke_agy(
    prompt: str,
    schema_path: Path,
    repo_root: Path,
    agy_bin: str,
    agent_name: str,
    model: str | None,
    timeout_seconds: int,
    env: dict[str, str],
) -> dict[str, Any]:
    """Execute `agy` in read-only headless JSON-schema mode and enforce workspace immutability."""
    resolved_bin = shutil.which(agy_bin, path=env.get("PATH")) if os.sep not in agy_bin else agy_bin
    if not resolved_bin or not Path(resolved_bin).exists():
        raise ReviewExecutionError(
            f"Antigravity CLI binary {agy_bin!r} not found in PATH. Install `agy` or set AGY_BIN."
        )

    cmd = [
        resolved_bin,
        "--agent",
        agent_name,
        "--sandbox",
        "--disable-slash-commands",
        "--output-format",
        "json",
        "--json-schema",
        str(schema_path),
        "--print-timeout",
        f"{timeout_seconds}s",
    ]
    if model:
        cmd.extend(["--model", model])
    cmd.extend(["-p", prompt])

    before_snapshot = snapshot_workspace(repo_root)
    try:
        completed = subprocess.run(
            cmd,
            cwd=str(repo_root),
            env=env,
            capture_output=True,
            text=True,
            encoding="utf-8",
            errors="replace",
            timeout=timeout_seconds + 30,
            check=False,
        )
    except subprocess.TimeoutExpired as exc:
        raise ReviewExecutionError(
            f"agy review timed out after {timeout_seconds + 30}s."
        ) from exc
    except OSError as exc:
        raise ReviewExecutionError(f"Failed to launch agy binary {resolved_bin!r}: {exc}") from exc
    finally:
        after_snapshot = snapshot_workspace(repo_root)

    if before_snapshot != after_snapshot:
        raise ReviewExecutionError(
            "SAFETY VIOLATION: Repository working tree or index changed during AI review execution. "
            "Reviewers are strictly read-only; failing closed."
        )

    return parse_agy_envelope(completed.stdout, completed.stderr, completed.returncode)


def evaluate_findings(findings: list[dict[str, Any]]) -> tuple[str, int, dict[str, int]]:
    """Deterministically compute verdict and exit code from validated findings."""
    counts = {sev: 0 for sev in ALLOWED_SEVERITIES}
    for finding in findings:
        counts[finding["severity"]] += 1

    blocking_count = sum(counts[sev] for sev in BLOCKING_SEVERITIES)
    if blocking_count > 0:
        return "BLOCK", 1, counts
    return "PASS", 0, counts


def format_terminal_report(report: dict[str, Any]) -> str:
    verdict = report["verdict"]
    counts = report["counts"]
    lines = [
        "=" * 72,
        f"Antigravity (`agy`) AI Code Review — {verdict}",
        "=" * 72,
        f"Summary : {report['summary']}",
        (
            f"Counts  : CRITICAL={counts['CRITICAL']} | HIGH={counts['HIGH']} | "
            f"MEDIUM={counts['MEDIUM']} | LOW={counts['LOW']}"
        ),
    ]
    if report.get("error"):
        lines.append(f"Error   : {report['error']}")

    findings = report.get("findings", [])
    if findings:
        lines.append("-" * 72)
        severity_rank = {sev: i for i, sev in enumerate(ALLOWED_SEVERITIES)}
        for idx, item in enumerate(
            sorted(findings, key=lambda f: (severity_rank[f["severity"]], f["file"], f["line"])),
            start=1,
        ):
            lines.append(
                f"{idx}. [{item['severity']}] ({item['category']}) {item['file']}:{item['line']}"
            )
            lines.append(f"   Explanation  : {item['explanation']}")
            lines.append(f"   Suggested Fix: {item['suggested_fix']}")
    lines.append("=" * 72)
    return "\n".join(lines)


def _escape_md_cell(value: str) -> str:
    return value.replace("|", "\\|").replace("\n", "<br>")


def format_markdown_report(report: dict[str, Any]) -> str:
    verdict = report["verdict"]
    badge = (
        ":white_check_mark: **PASSED**"
        if verdict == "PASS"
        else (":no_entry: **BLOCKED**" if verdict == "BLOCK" else ":x: **FAILED CLOSED (ERROR)**")
    )
    counts = report["counts"]
    lines = [
        COMMENT_MARKER,
        f"## Antigravity (`agy`) AI Code Review — {badge}",
        "",
        f"**Summary:** {report['summary']}",
        "",
        (
            f"| CRITICAL | HIGH | MEDIUM | LOW |\n"
            f"| :---: | :---: | :---: | :---: |\n"
            f"| {counts['CRITICAL']} | {counts['HIGH']} | {counts['MEDIUM']} | {counts['LOW']} |"
        ),
        "",
    ]

    if report.get("error"):
        lines.extend(
            [
                "> [!CAUTION]",
                f"> Review failed closed due to an execution/validation error: `{report['error']}`",
                "",
            ]
        )

    findings = report.get("findings", [])
    if findings:
        lines.extend(
            [
                "### Findings",
                "",
                "| Severity | Category | Location | Explanation | Suggested Fix |",
                "| :--- | :--- | :--- | :--- | :--- |",
            ]
        )
        severity_rank = {sev: i for i, sev in enumerate(ALLOWED_SEVERITIES)}
        for item in sorted(findings, key=lambda f: (severity_rank[f["severity"]], f["file"], f["line"])):
            location = f"`{item['file']}:{item['line']}`"
            lines.append(
                f"| **{item['severity']}** | `{item['category']}` | {location} | "
                f"{_escape_md_cell(item['explanation'])} | {_escape_md_cell(item['suggested_fix'])} |"
            )
    elif verdict == "PASS":
        lines.append("_No findings reported._")

    lines.append("")
    lines.append("_Policy: `CRITICAL` and `HIGH` findings, as well as review execution errors, block merges._")
    return "\n".join(lines)


def write_optional_outputs(
    report: dict[str, Any], json_out: str | None, markdown_out: str | None
) -> None:
    if json_out:
        out_path = Path(json_out)
        out_path.parent.mkdir(parents=True, exist_ok=True)
        out_path.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    if markdown_out:
        md_path = Path(markdown_out)
        md_path.parent.mkdir(parents=True, exist_ok=True)
        md_path.write_text(format_markdown_report(report) + "\n", encoding="utf-8")


def parse_args(argv: list[str]) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Run centralized read-only AI code review using Antigravity CLI (`agy`)."
    )
    parser.add_argument(
        "--mode",
        choices=("pre-push", "pr", "diff"),
        required=True,
        help="Execution mode: local pre-push hook, GitHub Actions PR, or explicit diff file.",
    )
    parser.add_argument("--base-sha", default=os.environ.get("BASE_SHA", ""), help="PR base commit SHA.")
    parser.add_argument("--head-sha", default=os.environ.get("HEAD_SHA", ""), help="PR head commit SHA.")
    parser.add_argument("--diff-file", help="Path to unified diff file (use '-' for stdin) in diff mode.")
    parser.add_argument("--refs-file", help="Optional file containing git pre-push stdin lines.")
    parser.add_argument(
        "--repo-root",
        default=str(repo_root_from_script()),
        help="Repository root directory.",
    )
    parser.add_argument(
        "--auth-mode",
        default="",
        help="Auth mode: local or self-hosted (defaults by --mode / AGY_AUTH_MODE).",
    )
    parser.add_argument("--agy-bin", default=os.environ.get("AGY_BIN", "agy"), help="Path or name of agy CLI.")
    parser.add_argument(
        "--agent",
        default=os.environ.get("AGY_REVIEW_AGENT", "ai-code-reviewer"),
        help="Read-only Antigravity agent name.",
    )
    parser.add_argument(
        "--model",
        default=os.environ.get("AGY_MODEL", ""),
        help="Optional model override (defaults to agy configured model).",
    )
    parser.add_argument(
        "--timeout",
        type=int,
        default=int(os.environ.get("AGY_REVIEW_TIMEOUT", str(DEFAULT_TIMEOUT_SECONDS))),
        help="Timeout in seconds per agy review invocation.",
    )
    parser.add_argument(
        "--max-diff-chars",
        type=int,
        default=int(os.environ.get("AGY_MAX_DIFF_CHARS", str(DEFAULT_MAX_DIFF_CHARS))),
        help="Maximum diff characters per agy batch.",
    )
    parser.add_argument("--json-out", help="Optional path to write structured JSON report.")
    parser.add_argument("--markdown-out", help="Optional path to write Markdown PR summary.")
    return parser.parse_args(argv)


def main(argv: list[str] | None = None) -> int:
    args = parse_args(argv if argv is not None else sys.argv[1:])
    repo_root = Path(args.repo_root).resolve()
    script_dir = Path(__file__).resolve().parent
    prompt_path = script_dir / "review_prompt.md"
    schema_path = script_dir / "review_schema.json"
    agents_md_path = repo_root / "AGENTS.md"

    env = os.environ.copy()
    default_auth_mode = "self-hosted" if args.mode == "pr" else "local"
    auth_mode = (args.auth_mode or env.get("AGY_AUTH_MODE") or default_auth_mode).strip().lower()

    empty_counts = {sev: 0 for sev in ALLOWED_SEVERITIES}

    try:
        if not prompt_path.is_file():
            raise ReviewExecutionError(f"Centralized review prompt missing: {prompt_path}")
        if not schema_path.is_file():
            raise ReviewExecutionError(f"Review JSON schema missing: {schema_path}")

        validate_auth_environment(args.mode, auth_mode, env)

        # Collect unified diff based on mode.
        if args.mode == "pre-push":
            if args.refs_file:
                raw_refs = Path(args.refs_file).read_text(encoding="utf-8")
            else:
                raw_refs = sys.stdin.read()
            refs = parse_pre_push_stdin(raw_refs)
            raw_diff, ranges = collect_pre_push_diff(refs, repo_root)
        elif args.mode == "pr":
            require_base_checkout = env.get("GITHUB_ACTIONS", "").lower() == "true"
            raw_diff, ranges = collect_pr_diff(
                args.base_sha,
                args.head_sha,
                repo_root,
                require_base_checkout=require_base_checkout,
            )
        else:
            if not args.diff_file:
                raise ReviewExecutionError("--diff-file is required in diff mode.")
            if args.diff_file == "-":
                raw_diff = sys.stdin.read()
            else:
                raw_diff = Path(args.diff_file).read_text(encoding="utf-8")
            ranges = [args.diff_file]

        chunks, included_files, skipped_files = filter_and_chunk_diff(
            raw_diff, max_chars=args.max_diff_chars
        )
        protected_files = find_protected_review_files(included_files)

        if not chunks:
            report = {
                "verdict": "PASS",
                "exit_code": 0,
                "mode": args.mode,
                "auth_mode": auth_mode,
                "summary": "No reviewable code changes detected in outgoing diff.",
                "counts": empty_counts,
                "findings": [],
                "included_files": included_files,
                "skipped_files": skipped_files,
                "protected_files": protected_files,
                "ranges": ranges,
            }
            write_optional_outputs(report, args.json_out, args.markdown_out)
            print(format_terminal_report(report))
            return 0

        prompt_template = prompt_path.read_text(encoding="utf-8")
        agents_md = agents_md_path.read_text(encoding="utf-8") if agents_md_path.is_file() else ""

        all_findings: list[dict[str, Any]] = []
        batch_summaries: list[str] = []

        for idx, chunk in enumerate(chunks, start=1):
            full_prompt = build_review_prompt(
                prompt_template=prompt_template,
                agents_md=agents_md,
                diff_chunk=chunk,
                included_files=included_files,
                skipped_files=skipped_files,
                protected_files=protected_files,
                ranges=ranges,
                batch_index=idx,
                batch_total=len(chunks),
            )
            batch_result = invoke_agy(
                prompt=full_prompt,
                schema_path=schema_path,
                repo_root=repo_root,
                agy_bin=args.agy_bin,
                agent_name=args.agent,
                model=args.model.strip() or None,
                timeout_seconds=args.timeout,
                env=env,
            )
            batch_summaries.append(batch_result["summary"])
            all_findings.extend(batch_result["findings"])

        verdict, exit_code, counts = evaluate_findings(all_findings)
        combined_summary = " ".join(batch_summaries)
        report = {
            "verdict": verdict,
            "exit_code": exit_code,
            "mode": args.mode,
            "auth_mode": auth_mode,
            "summary": combined_summary,
            "counts": counts,
            "findings": all_findings,
            "included_files": included_files,
            "skipped_files": skipped_files,
            "protected_files": protected_files,
            "ranges": ranges,
        }
        write_optional_outputs(report, args.json_out, args.markdown_out)
        print(format_terminal_report(report))
        return exit_code

    except ReviewExecutionError as exc:
        report = {
            "verdict": "ERROR",
            "exit_code": 2,
            "mode": args.mode,
            "auth_mode": auth_mode,
            "summary": "AI code review failed closed due to an execution, authentication, validation, or safety error.",
            "error": str(exc),
            "counts": empty_counts,
            "findings": [],
        }
        write_optional_outputs(report, args.json_out, args.markdown_out)
        print(format_terminal_report(report), file=sys.stderr)
        return 2
    except Exception as exc:  # noqa: BLE001 — fail closed on any unexpected runtime error
        report = {
            "verdict": "ERROR",
            "exit_code": 2,
            "mode": args.mode,
            "auth_mode": auth_mode,
            "summary": "AI code review failed closed due to an unexpected internal error.",
            "error": f"{type(exc).__name__}: {exc}",
            "counts": empty_counts,
            "findings": [],
        }
        write_optional_outputs(report, args.json_out, args.markdown_out)
        print(format_terminal_report(report), file=sys.stderr)
        return 2


if __name__ == "__main__":
    sys.exit(main())
