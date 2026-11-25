#!/usr/bin/env python3
"""
Automated unit & end-to-end integration tests for the `agy` AI code-review system.

Run with:
  python3 -m unittest discover -s scripts/ai_review -p "test_*.py" -v
"""

from __future__ import annotations

import json
import os
import shutil
import stat
import subprocess
import sys
import tempfile
import textwrap
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import run_review
import show_pr_review

REPO_ROOT = Path(__file__).resolve().parents[2]


def write_executable(path: Path, content: str) -> None:
    path.write_text(content, encoding="utf-8")
    path.chmod(path.stat().st_mode | stat.S_IXUSR | stat.S_IXGRP | stat.S_IXOTH)


class TestValidationAndParsing(unittest.TestCase):
    def test_pass_empty_findings(self) -> None:
        envelope = json.dumps(
            {
                "status": "SUCCESS",
                "structured_output": {"summary": "Clean change.", "findings": []},
            }
        )
        parsed = run_review.parse_agy_envelope(envelope, "", 0)
        verdict, code, counts = run_review.evaluate_findings(parsed["findings"])
        self.assertEqual(verdict, "PASS")
        self.assertEqual(code, 0)
        self.assertEqual(counts["CRITICAL"], 0)
        self.assertEqual(counts["HIGH"], 0)

    def test_pass_medium_and_low_only(self) -> None:
        payload = {
            "summary": "Minor non-blocking notes.",
            "findings": [
                {
                    "severity": "MEDIUM",
                    "category": "naming",
                    "file": "lib/utils.ts",
                    "line": 12,
                    "explanation": "Inconsistent helper naming.",
                    "suggested_fix": "Rename helper to camelCase.",
                },
                {
                    "severity": "LOW",
                    "category": "agents_md",
                    "file": "components/Foo.tsx",
                    "line": 5,
                    "explanation": "Prefer logger over console.log.",
                    "suggested_fix": "Import logger from '@/lib/logger'.",
                },
            ],
        }
        validated = run_review.validate_review_payload(payload)
        verdict, code, counts = run_review.evaluate_findings(validated["findings"])
        self.assertEqual(verdict, "PASS")
        self.assertEqual(code, 0)
        self.assertEqual(counts["MEDIUM"], 1)
        self.assertEqual(counts["LOW"], 1)

    def test_block_high_and_critical_findings(self) -> None:
        for sev in ("HIGH", "CRITICAL"):
            with self.subTest(severity=sev):
                payload = {
                    "summary": "Blocking issue found.",
                    "findings": [
                        {
                            "severity": sev,
                            "category": "auth_rbac",
                            "file": "backend/app/api/routes/schedule.py",
                            "line": 42,
                            "explanation": "Missing require_doctor_owner dependency.",
                            "suggested_fix": "Add Depends(require_doctor_owner).",
                        }
                    ],
                }
                validated = run_review.validate_review_payload(payload)
                verdict, code, counts = run_review.evaluate_findings(validated["findings"])
                self.assertEqual(verdict, "BLOCK")
                self.assertEqual(code, 1)
                self.assertEqual(counts[sev], 1)

    def test_fallback_response_json_parsing(self) -> None:
        inner = {"summary": "Parsed from response text.", "findings": []}
        envelope = json.dumps({"status": "SUCCESS", "response": json.dumps(inner)})
        parsed = run_review.parse_agy_envelope(envelope, "", 0)
        self.assertEqual(parsed["summary"], "Parsed from response text.")
        self.assertEqual(parsed["findings"], [])

        fenced_envelope = json.dumps(
            {"status": "SUCCESS", "response": f"```json\n{json.dumps(inner)}\n```"}
        )
        parsed_fenced = run_review.parse_agy_envelope(fenced_envelope, "", 0)
        self.assertEqual(parsed_fenced["summary"], "Parsed from response text.")

    def test_schema_and_runner_categories_match_including_testing(self) -> None:
        schema_path = REPO_ROOT / "scripts" / "ai_review" / "review_schema.json"
        schema = json.loads(schema_path.read_text(encoding="utf-8"))
        item_props = schema["properties"]["findings"]["items"]["properties"]
        schema_severities = tuple(item_props["severity"]["enum"])
        schema_categories = frozenset(item_props["category"]["enum"])
        self.assertEqual(schema_severities, run_review.ALLOWED_SEVERITIES)
        self.assertEqual(schema_categories, run_review.ALLOWED_CATEGORIES)
        self.assertIn("testing", run_review.ALLOWED_CATEGORIES)

        payload = {
            "summary": "Missing test finding validates cleanly.",
            "findings": [
                {
                    "severity": "medium",
                    "category": "TESTING",
                    "file": "backend/tests/test_schedule.py",
                    "line": 10,
                    "explanation": "Missing negative RBAC test for staff member.",
                    "suggested_fix": "Add test asserting 403 Forbidden for staff role.",
                }
            ],
        }
        validated = run_review.validate_review_payload(payload)
        self.assertEqual(validated["findings"][0]["severity"], "MEDIUM")
        self.assertEqual(validated["findings"][0]["category"], "testing")

    def test_fail_closed_on_execution_and_malformed_outputs(self) -> None:
        # Non-zero exit code
        with self.assertRaises(run_review.ReviewExecutionError):
            run_review.parse_agy_envelope("", "auth failed", 3)

        # Empty stdout
        with self.assertRaises(run_review.ReviewExecutionError):
            run_review.parse_agy_envelope("", "", 0)

        # Non-JSON stdout
        with self.assertRaises(run_review.ReviewExecutionError):
            run_review.parse_agy_envelope("not json at all", "", 0)

        # Envelope status ERROR
        with self.assertRaises(run_review.ReviewExecutionError):
            run_review.parse_agy_envelope(
                json.dumps({"status": "ERROR", "error": "rate limit"}), "", 0
            )

        # Missing required fields
        with self.assertRaises(run_review.ReviewExecutionError):
            run_review.validate_review_payload(
                {
                    "summary": "Missing suggested_fix",
                    "findings": [
                        {
                            "severity": "HIGH",
                            "category": "security",
                            "file": "a.py",
                            "line": 1,
                            "explanation": "SQLi",
                        }
                    ],
                }
            )

        # Invalid severity
        with self.assertRaises(run_review.ReviewExecutionError):
            run_review.validate_review_payload(
                {
                    "summary": "Bad severity",
                    "findings": [
                        {
                            "severity": "BLOCKER",
                            "category": "security",
                            "file": "a.py",
                            "line": 1,
                            "explanation": "SQLi",
                            "suggested_fix": "Parameterize query",
                        }
                    ],
                }
            )

        # Boolean line (bool is subclass of int in Python)
        with self.assertRaises(run_review.ReviewExecutionError):
            run_review.validate_review_payload(
                {
                    "summary": "Bool line",
                    "findings": [
                        {
                            "severity": "LOW",
                            "category": "naming",
                            "file": "a.py",
                            "line": True,
                            "explanation": "Bad line type",
                            "suggested_fix": "Use int",
                        }
                    ],
                }
            )


class TestAuthAndDiffHelpers(unittest.TestCase):
    def test_pr_mode_rejects_local_auth(self) -> None:
        with self.assertRaises(run_review.ReviewExecutionError):
            run_review.validate_auth_environment("pr", "local", {})

    def test_self_hosted_rejects_github_hosted_runner(self) -> None:
        with self.assertRaises(run_review.ReviewExecutionError):
            run_review.validate_auth_environment(
                "pr", "self-hosted", {"RUNNER_ENVIRONMENT": "github-hosted"}
            )

    def test_self_hosted_accepts_self_hosted_runner(self) -> None:
        run_review.validate_auth_environment(
            "pr", "self-hosted", {"RUNNER_ENVIRONMENT": "self-hosted"}
        )

    def test_unsupported_auth_modes_fail_closed(self) -> None:
        for mode in ("adc", "gemini-api-key", "oauth-cache", ""):
            with (
                self.subTest(auth_mode=mode),
                self.assertRaises(run_review.ReviewExecutionError),
            ):
                run_review.validate_auth_environment("pr", mode, {})

    def test_diff_filtering_includes_lockfiles_and_skips_binary_artifacts(self) -> None:
        raw_diff = (
            "diff --git a/tsconfig.tsbuildinfo b/tsconfig.tsbuildinfo\n"
            "--- a/tsconfig.tsbuildinfo\n+++ b/tsconfig.tsbuildinfo\n@@ -1 +1 @@\n-a\n+b\n"
            "diff --git a/package-lock.json b/package-lock.json\n"
            "--- a/package-lock.json\n+++ b/package-lock.json\n"
            "@@ -1,2 +1,2 @@\n+  \"resolved\": \"https://evil.example/pkg.tgz\"\n"
            "diff --git a/backend/app/a.py b/backend/app/a.py\n"
            "--- a/backend/app/a.py\n+++ b/backend/app/a.py\n@@ -1 +1 @@\n+" + ("x" * 160) + "\n"
            "diff --git a/backend/app/b.py b/backend/app/b.py\n"
            "--- a/backend/app/b.py\n+++ b/backend/app/b.py\n@@ -1 +1 @@\n+" + ("y" * 160) + "\n"
        )
        chunks, included, skipped = run_review.filter_and_chunk_diff(raw_diff, max_chars=280)
        self.assertEqual(skipped, ["tsconfig.tsbuildinfo"])
        self.assertEqual(included, ["package-lock.json", "backend/app/a.py", "backend/app/b.py"])
        self.assertGreaterEqual(len(chunks), 2)
        self.assertIn("evil.example", "".join(chunks))

    def test_oversized_lockfile_diff_splits_across_hunks_without_dropping_tail(self) -> None:
        hunk1 = "@@ -10,2 +10,2 @@\n+  \"pkg-a\": \"1.0.0\"\n" + ("+  \"pad\": 1\n" * 40)
        hunk2 = "@@ -900,2 +900,2 @@\n+  \"resolved\": \"http://untrusted.example/backdoor.tgz\"\n"
        raw_diff = (
            "diff --git a/package-lock.json b/package-lock.json\n"
            "--- a/package-lock.json\n+++ b/package-lock.json\n" + hunk1 + hunk2
        )
        chunks, included, _ = run_review.filter_and_chunk_diff(raw_diff, max_chars=500)
        self.assertEqual(included, ["package-lock.json"])
        self.assertGreaterEqual(len(chunks), 2)
        joined = "\n".join(chunks)
        self.assertIn("pkg-a", joined)
        self.assertIn("http://untrusted.example/backdoor.tgz", joined)

    def test_protected_review_files_detection(self) -> None:
        files = [
            "app/page.tsx",
            ".github/workflows/ai-code-review.yml",
            "scripts/ai_review/run_review.py",
            ".agents/agents/ai-code-reviewer.md",
            ".githooks/pre-push",
        ]
        protected = run_review.find_protected_review_files(files)
        self.assertEqual(
            protected,
            [
                ".github/workflows/ai-code-review.yml",
                "scripts/ai_review/run_review.py",
                ".agents/agents/ai-code-reviewer.md",
                ".githooks/pre-push",
            ],
        )

    def test_show_pr_review_helpers_extract_comment_and_check(self) -> None:
        comments = [
            {"id": 1, "body": "LGTM!"},
            {
                "id": 2,
                "body": f"{show_pr_review.COMMENT_MARKER}\n## AI Code Review\nOld run",
                "updated_at": "2026-11-25T07:00:00Z",
            },
            {
                "id": 3,
                "body": f"{show_pr_review.COMMENT_MARKER}\n## AI Code Review\nLatest run",
                "updated_at": "2026-11-25T08:00:00Z",
            },
        ]
        latest = show_pr_review.extract_ai_review_comment(comments)
        self.assertIsNotNone(latest)
        assert latest is not None
        self.assertEqual(latest["id"], 3)

        check = show_pr_review.extract_ai_check_status(
            [
                {"name": "Backend Lint & Tests", "status": "COMPLETED", "conclusion": "SUCCESS"},
                {"name": "AI Code Review", "status": "COMPLETED", "conclusion": "FAILURE"},
            ]
        )
        self.assertIsNotNone(check)
        assert check is not None
        self.assertEqual(check["conclusion"], "FAILURE")

        rendered = show_pr_review.format_pr_review_output(
            "A-fun-786/doctors-platform",
            99,
            "https://github.com/A-fun-786/doctors-platform/pull/99",
            check,
            latest,
        )
        self.assertIn("conclusion=FAILURE", rendered)
        self.assertIn("Latest run", rendered)
        self.assertNotIn(show_pr_review.COMMENT_MARKER, rendered)


class TestEndToEndGitHookAndSafety(unittest.TestCase):
    def setUp(self) -> None:
        self.temp_dir = Path(tempfile.mkdtemp(prefix="agy_review_test_"))
        self.remote_dir = self.temp_dir / "remote.git"
        self.work_dir = self.temp_dir / "work"
        self.stub_bin = self.temp_dir / "stub_agy.py"

        subprocess.run(["git", "init", "--bare", str(self.remote_dir)], check=True, capture_output=True)
        subprocess.run(["git", "init", "-b", "main", str(self.work_dir)], check=True, capture_output=True)
        subprocess.run(["git", "config", "user.email", "test@example.com"], cwd=self.work_dir, check=True)
        subprocess.run(["git", "config", "user.name", "Test User"], cwd=self.work_dir, check=True)
        subprocess.run(["git", "remote", "add", "origin", str(self.remote_dir)], cwd=self.work_dir, check=True)

        # Copy review engine + pre-push hook (+ AGENTS.md if present) into temp repo.
        shutil.copytree(
            REPO_ROOT / "scripts" / "ai_review",
            self.work_dir / "scripts" / "ai_review",
            ignore=shutil.ignore_patterns("__pycache__", "*.pyc"),
        )
        shutil.copytree(REPO_ROOT / ".githooks", self.work_dir / ".githooks")
        agents_src = REPO_ROOT / "AGENTS.md"
        if agents_src.is_file():
            shutil.copy2(agents_src, self.work_dir / "AGENTS.md")
        else:
            (self.work_dir / "AGENTS.md").write_text("# Test Repo Rules\n", encoding="utf-8")
        (self.work_dir / "app.py").write_text("def hello():\n    return 'hi'\n", encoding="utf-8")

        subprocess.run(["git", "add", "."], cwd=self.work_dir, check=True)
        subprocess.run(["git", "commit", "-m", "initial commit"], cwd=self.work_dir, check=True, capture_output=True)
        subprocess.run(["git", "push", "-u", "origin", "main"], cwd=self.work_dir, check=True, capture_output=True)

        # Enable pre-push hook in temp repo.
        subprocess.run(["git", "config", "core.hooksPath", ".githooks"], cwd=self.work_dir, check=True)

    def tearDown(self) -> None:
        shutil.rmtree(self.temp_dir, ignore_errors=True)

    def _make_commit(self, filename: str, content: str, message: str) -> str:
        (self.work_dir / filename).write_text(content, encoding="utf-8")
        subprocess.run(["git", "add", filename], cwd=self.work_dir, check=True)
        subprocess.run(["git", "commit", "-m", message], cwd=self.work_dir, check=True, capture_output=True)
        return subprocess.check_output(["git", "rev-parse", "HEAD"], cwd=self.work_dir, text=True).strip()

    def _remote_head(self) -> str:
        return subprocess.check_output(
            ["git", "--git-dir", str(self.remote_dir), "rev-parse", "refs/heads/main"],
            text=True,
        ).strip()

    def _push_with_stub(self, stub_script: str) -> subprocess.CompletedProcess[str]:
        write_executable(self.stub_bin, stub_script)
        env = os.environ.copy()
        env["AGY_BIN"] = str(self.stub_bin)
        return subprocess.run(
            ["git", "push", "origin", "main"],
            cwd=self.work_dir,
            env=env,
            capture_output=True,
            text=True,
            check=False,
        )

    def test_pre_push_blocks_high_finding_and_preserves_remote(self) -> None:
        before_remote = self._remote_head()
        self._make_commit("app.py", "def get_user(uid):\n    return f'SELECT * FROM u WHERE id={uid}'\n", "unsafe sql")

        stub = textwrap.dedent(
            f"""\
            #!{sys.executable}
            import json
            print(json.dumps({{
                "status": "SUCCESS",
                "structured_output": {{
                    "summary": "Detected SQL injection vulnerability.",
                    "findings": [{{
                        "severity": "HIGH",
                        "category": "security",
                        "file": "app.py",
                        "line": 2,
                        "explanation": "Unsanitized interpolation into SQL string.",
                        "suggested_fix": "Use parameterized SQL queries."
                    }}]
                }}
            }}))
            """
        )
        res = self._push_with_stub(stub)
        self.assertNotEqual(res.returncode, 0, msg=res.stdout + res.stderr)
        self.assertEqual(self._remote_head(), before_remote)

    def test_pre_push_fails_closed_on_malformed_ai_output(self) -> None:
        before_remote = self._remote_head()
        self._make_commit("app.py", "def ok():\n    return 1\n", "change")

        stub = f"#!{sys.executable}\nprint('<<<CORRUPT_NON_JSON>>>')\n"
        res = self._push_with_stub(stub)
        self.assertNotEqual(res.returncode, 0)
        self.assertEqual(self._remote_head(), before_remote)

    def test_pre_push_fails_closed_when_reviewer_mutates_workspace(self) -> None:
        before_remote = self._remote_head()
        self._make_commit("app.py", "def ok():\n    return 2\n", "change")

        stub = textwrap.dedent(
            f"""\
            #!{sys.executable}
            import json
            from pathlib import Path
            Path("rogue_edit.txt").write_text("mutated by reviewer")
            print(json.dumps({{
                "status": "SUCCESS",
                "structured_output": {{"summary": "Looks good.", "findings": []}}
            }}))
            """
        )
        res = self._push_with_stub(stub)
        self.assertNotEqual(res.returncode, 0)
        self.assertIn("SAFETY VIOLATION", res.stderr)
        self.assertEqual(self._remote_head(), before_remote)

    def test_pre_push_allows_clean_commit(self) -> None:
        new_sha = self._make_commit("app.py", "def greet(name: str) -> str:\n    return f'Hello, {{name}}'\n", "clean greet")

        stub = textwrap.dedent(
            f"""\
            #!{sys.executable}
            import json
            print(json.dumps({{
                "status": "SUCCESS",
                "structured_output": {{"summary": "No issues found.", "findings": []}}
            }}))
            """
        )
        res = self._push_with_stub(stub)
        self.assertEqual(res.returncode, 0, msg=res.stdout + res.stderr)
        self.assertEqual(self._remote_head(), new_sha)

    def test_pr_mode_writes_json_and_markdown_reports(self) -> None:
        base_sha = self._remote_head()
        head_sha = self._make_commit("app.py", "def bad():\n    eval('1+1')\n", "use eval")

        stub = textwrap.dedent(
            f"""\
            #!{sys.executable}
            import json
            print(json.dumps({{
                "status": "SUCCESS",
                "structured_output": {{
                    "summary": "Critical eval usage detected.",
                    "findings": [{{
                        "severity": "CRITICAL",
                        "category": "security",
                        "file": "app.py",
                        "line": 2,
                        "explanation": "eval() enables arbitrary code execution.",
                        "suggested_fix": "Remove eval() and use safe parsing."
                    }}]
                }}
            }}))
            """
        )
        write_executable(self.stub_bin, stub)
        json_out = self.temp_dir / "report.json"
        md_out = self.temp_dir / "comment.md"

        env = os.environ.copy()
        env["RUNNER_ENVIRONMENT"] = "self-hosted"
        res = subprocess.run(
            [
                sys.executable,
                str(self.work_dir / "scripts" / "ai_review" / "run_review.py"),
                "--mode",
                "pr",
                "--repo-root",
                str(self.work_dir),
                "--base-sha",
                base_sha,
                "--head-sha",
                head_sha,
                "--auth-mode",
                "self-hosted",
                "--agy-bin",
                str(self.stub_bin),
                "--json-out",
                str(json_out),
                "--markdown-out",
                str(md_out),
            ],
            env=env,
            capture_output=True,
            text=True,
            check=False,
        )
        self.assertEqual(res.returncode, 1, msg=res.stdout + res.stderr)
        report = json.loads(json_out.read_text(encoding="utf-8"))
        self.assertEqual(report["verdict"], "BLOCK")
        self.assertEqual(report["counts"]["CRITICAL"], 1)
        md_text = md_out.read_text(encoding="utf-8")
        self.assertIn(run_review.COMMENT_MARKER, md_text)
        self.assertIn("CRITICAL", md_text)
        self.assertIn("app.py:2", md_text)

    def test_pr_mode_in_ci_fails_closed_when_pr_head_is_checked_out(self) -> None:
        base_sha = self._remote_head()
        head_sha = self._make_commit("app.py", "def ok():\n    return 1\n", "pr commit")

        # Workspace currently has head_sha checked out instead of base_sha.
        env = os.environ.copy()
        env["RUNNER_ENVIRONMENT"] = "self-hosted"
        env["GITHUB_ACTIONS"] = "true"
        res = subprocess.run(
            [
                sys.executable,
                str(self.work_dir / "scripts" / "ai_review" / "run_review.py"),
                "--mode",
                "pr",
                "--repo-root",
                str(self.work_dir),
                "--base-sha",
                base_sha,
                "--head-sha",
                head_sha,
                "--auth-mode",
                "self-hosted",
                "--agy-bin",
                str(self.stub_bin),
            ],
            env=env,
            capture_output=True,
            text=True,
            check=False,
        )
        self.assertEqual(res.returncode, 2, msg=res.stdout + res.stderr)
        self.assertIn("PR security violation", res.stderr)

    def test_pr_mode_in_ci_succeeds_when_trusted_base_is_checked_out(self) -> None:
        base_sha = self._remote_head()
        head_sha = self._make_commit("app.py", "def ok():\n    return 1\n", "pr commit")
        # Reset workspace to trusted base_sha (simulating pull_request_target base checkout).
        subprocess.run(["git", "checkout", "--quiet", base_sha], cwd=self.work_dir, check=True)

        stub = textwrap.dedent(
            f"""\
            #!{sys.executable}
            import json
            print(json.dumps({{
                "status": "SUCCESS",
                "structured_output": {{"summary": "Clean PR.", "findings": []}}
            }}))
            """
        )
        write_executable(self.stub_bin, stub)
        env = os.environ.copy()
        env["RUNNER_ENVIRONMENT"] = "self-hosted"
        env["GITHUB_ACTIONS"] = "true"
        res = subprocess.run(
            [
                sys.executable,
                str(self.work_dir / "scripts" / "ai_review" / "run_review.py"),
                "--mode",
                "pr",
                "--repo-root",
                str(self.work_dir),
                "--base-sha",
                base_sha,
                "--head-sha",
                head_sha,
                "--auth-mode",
                "self-hosted",
                "--agy-bin",
                str(self.stub_bin),
            ],
            env=env,
            capture_output=True,
            text=True,
            check=False,
        )
        self.assertEqual(res.returncode, 0, msg=res.stdout + res.stderr)


if __name__ == "__main__":
    unittest.main()
