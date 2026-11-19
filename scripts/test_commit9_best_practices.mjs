import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");

console.log("============================================================");
console.log("🩺 AUTOMATED VERIFICATION: PR 18 COMMIT 9 BEST PRACTICES FIXES");
console.log("============================================================");

let passed = 0;
let total = 0;

function test(name, fn) {
  total++;
  try {
    fn();
    passed++;
    console.log(`  ✅ [PASS] ${name}`);
  } catch (err) {
    console.error(`  ❌ [FAIL] ${name}: ${err.message}`);
  }
}

const androidAppTabPath = path.join(projectRoot, "components/dashboard/AndroidAppTab.tsx");
const weekViewPath = path.join(projectRoot, "components/dashboard/calendar/views/WeekView.tsx");
const overviewTabPath = path.join(projectRoot, "components/dashboard/OverviewTab.tsx");
const cardPath = path.join(projectRoot, "components/ui/Card.tsx");
const statusBadgePath = path.join(projectRoot, "components/ui/StatusBadge.tsx");
const progressPath = path.join(projectRoot, "docs/refactoring_progress.md");
const rootProgressPath = path.join(projectRoot, "refactoring_progress.md");

const androidAppTabCode = fs.readFileSync(androidAppTabPath, "utf-8");
const progressContent = fs.readFileSync(progressPath, "utf-8");

// -------------------------------------------------------------
// SECTION 1: Error Swallowing Elimination in AndroidAppTab
// -------------------------------------------------------------

test("1.1 AndroidAppTab imports structured logger from @/lib/logger", () => {
  assert.ok(
    androidAppTabCode.includes('import { logger } from "@/lib/logger";'),
    "AndroidAppTab must import logger from @/lib/logger"
  );
});

test("1.2 AndroidAppTab eliminates all empty .catch(() => { }) blocks", () => {
  const emptyCatchRegex = /\.catch\(\s*\(\)\s*=>\s*\{\s*\}\s*\)/g;
  const matches = androidAppTabCode.match(emptyCatchRegex);
  assert.equal(
    matches,
    null,
    `Found empty .catch(() => { }) blocks in AndroidAppTab: ${JSON.stringify(matches)}`
  );
});

test("1.3 AndroidAppTab eliminates empty try-catch blocks with ignored errors", () => {
  const emptyTryCatchRegex = /catch\s*\{\s*\/\/\s*ignore\s*\}/g;
  const matches = androidAppTabCode.match(emptyTryCatchRegex);
  assert.equal(
    matches,
    null,
    `Found empty catch { // ignore } in AndroidAppTab: ${JSON.stringify(matches)}`
  );
});

test("1.4 AndroidAppTab defines centralized fetchLogs helper with structured warning logging", () => {
  assert.ok(
    androidAppTabCode.includes("const fetchLogs = async (taskId: string)"),
    "Must define reusable fetchLogs helper"
  );
  assert.ok(
    androidAppTabCode.includes('logger.warn("AndroidAppTab"'),
    "fetchLogs must log a structured warning on failure using logger.warn"
  );
  assert.ok(
    androidAppTabCode.includes("setBuildLogs(l.logs)"),
    "fetchLogs must update state on success"
  );
});

test("1.5 Initial getAppPreview promise failure is captured with logger.error", () => {
  assert.ok(
    androidAppTabCode.includes('logger.error("AndroidAppTab", "Failed to load initial Android app preview"'),
    "Initial getAppPreview failure must be logged with logger.error"
  );
});

test("1.6 Polling interval uses fetchLogs and logs poll failures with logger.error", () => {
  assert.ok(
    androidAppTabCode.includes("fetchLogs(buildTaskId)"),
    "Polling interval must use fetchLogs(buildTaskId)"
  );
  assert.ok(
    androidAppTabCode.includes('logger.error("AndroidAppTab", msg, err, { buildTaskId })'),
    "Polling catch block must log error with taskId context"
  );
});

test("1.7 Icon upload and build initiation log structured actions and errors", () => {
  assert.ok(
    androidAppTabCode.includes('logger.action("AndroidAppTab", "Uploaded custom app icon"'),
    "Must log icon upload action"
  );
  assert.ok(
    androidAppTabCode.includes('logger.action("AndroidAppTab", "Initiated Android app compilation"'),
    "Must log build initiation action"
  );
  assert.ok(
    androidAppTabCode.includes('logger.warn("AndroidAppTab", "Failed to refresh app preview after icon upload"'),
    "Icon upload preview refresh catch must log warning"
  );
});

test("1.8 Clipboard copy provides user feedback and structured action/warning logging", () => {
  assert.ok(
    androidAppTabCode.includes("const handleCopyApkUrl = async (taskId: string)"),
    "Must define handleCopyApkUrl handler"
  );
  assert.ok(
    androidAppTabCode.includes('logger.action("AndroidAppTab", "Copied APK download link to clipboard"'),
    "Successful copy must log logger.action"
  );
  assert.ok(
    androidAppTabCode.includes('logger.warn("AndroidAppTab", "Failed to copy APK download link to clipboard"'),
    "Failed copy must log logger.warn"
  );
});

// -------------------------------------------------------------
// SECTION 2: UI Files & Progress Documentation Integrity
// -------------------------------------------------------------

test("2.1 All Commit 9 Phase-3 UI files exist and are present on disk", () => {
  assert.ok(fs.existsSync(androidAppTabPath), "AndroidAppTab.tsx must exist");
  assert.ok(fs.existsSync(weekViewPath), "WeekView.tsx must exist");
  assert.ok(fs.existsSync(overviewTabPath), "OverviewTab.tsx must exist");
  assert.ok(fs.existsSync(cardPath), "Card.tsx must exist");
  assert.ok(fs.existsSync(statusBadgePath), "StatusBadge.tsx must exist");
});

test("2.2 No duplicate refactoring_progress.md exists in repository root", () => {
  assert.ok(
    !fs.existsSync(rootProgressPath),
    "Duplicate refactoring_progress.md must not exist in repository root"
  );
  assert.ok(
    fs.existsSync(progressPath),
    "docs/refactoring_progress.md must exist as canonical progress log"
  );
});

test("2.3 docs/refactoring_progress.md documents Commit 9 Review Resolution", () => {
  assert.ok(
    progressContent.includes("Commit 9"),
    "refactoring_progress.md must reference Commit 9 review resolution"
  );
  assert.ok(
    progressContent.includes("test_commit9_best_practices.mjs"),
    "refactoring_progress.md must link to test_commit9_best_practices.mjs"
  );
});

console.log("============================================================");
console.log(`🏁 SCORECARD: ${passed} / ${total} Tests Passed (${Math.round((passed / total) * 100)}%)`);
console.log("============================================================");

if (passed !== total) {
  process.exit(1);
}
