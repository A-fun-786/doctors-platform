import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");

console.log("============================================================");
console.log("🩺 AUTOMATED VERIFICATION: PR 18 COMMIT 6 BEST PRACTICES FIXES");
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

// 1. Root Directory Cleanup & Canonical Documentation Location
test("Project root does NOT contain duplicate refactoring_progress.md", () => {
  const rootFilePath = path.join(projectRoot, "refactoring_progress.md");
  assert.ok(!fs.existsSync(rootFilePath), "refactoring_progress.md must not exist at project root");
});

test("Canonical docs/refactoring_progress.md exists and contains all phases (1 to 4)", () => {
  const docsFilePath = path.join(projectRoot, "docs/refactoring_progress.md");
  assert.ok(fs.existsSync(docsFilePath), "docs/refactoring_progress.md must exist");
  const content = fs.readFileSync(docsFilePath, "utf-8");
  assert.ok(content.includes("Phase 1: Token & Backend Quick Wins"), "Must document Phase 1");
  assert.ok(content.includes("Phase 2: Monolithic Booking Page De-duplication"), "Must document Phase 2");
  assert.ok(content.includes("Phase 3: Web UI Component System"), "Must document Phase 3");
  assert.ok(content.includes("Phase 4: Android App Template Modernization"), "Must document Phase 4");
});

test("docs/REFACTORING_IMPLEMENTATION_PLAN.md links to docs/refactoring_progress.md", () => {
  const planPath = path.join(projectRoot, "docs/REFACTORING_IMPLEMENTATION_PLAN.md");
  const planContent = fs.readFileSync(planPath, "utf-8");
  assert.ok(!planContent.includes("file:///d:/doctors-platform/refactoring_progress.md"), "Must not link to root file");
  assert.ok(planContent.includes("docs/refactoring_progress.md"), "Must link to docs/refactoring_progress.md");
});

// 2. Backend Query Optimization: Eager Loading with joinedload
test("backend/app/api/deps.py imports joinedload from sqlalchemy.orm", () => {
  const depsPath = path.join(projectRoot, "backend/app/api/deps.py");
  const depsContent = fs.readFileSync(depsPath, "utf-8");
  assert.ok(depsContent.includes("from sqlalchemy.orm import Session, joinedload"), "Must import joinedload");
});

test("get_active_tenant_by_slug uses .options(joinedload(Tenant.doctor)) to eliminate lazy loading", () => {
  const depsPath = path.join(projectRoot, "backend/app/api/deps.py");
  const depsContent = fs.readFileSync(depsPath, "utf-8");
  assert.ok(
    depsContent.includes(".options(joinedload(Tenant.doctor))"),
    "get_active_tenant_by_slug must use eager loading for Tenant.doctor"
  );
});

// 3. Centralized Tenant Dependency Usages
test("public.py and schedule.py consume get_active_tenant_by_slug", () => {
  const publicPath = path.join(projectRoot, "backend/app/api/routes/public.py");
  const publicContent = fs.readFileSync(publicPath, "utf-8");
  assert.ok(publicContent.includes("get_active_tenant_by_slug"), "public.py must consume get_active_tenant_by_slug");

  const schedulePath = path.join(projectRoot, "backend/app/api/routes/schedule.py");
  const scheduleContent = fs.readFileSync(schedulePath, "utf-8");
  assert.ok(scheduleContent.includes("get_active_tenant_by_slug"), "schedule.py must consume get_active_tenant_by_slug");
});

// 4. Dead Code Elimination Verification
test("Dead code GoogleAuthForm.tsx is deleted, EmailAuthForm.tsx is active", () => {
  const googleAuthPath = path.join(projectRoot, "components/auth/GoogleAuthForm.tsx");
  const emailAuthPath = path.join(projectRoot, "components/auth/EmailAuthForm.tsx");
  assert.ok(!fs.existsSync(googleAuthPath), "GoogleAuthForm.tsx must be retired/deleted");
  assert.ok(fs.existsSync(emailAuthPath), "EmailAuthForm.tsx must exist");
});

console.log("------------------------------------------------------------");
console.log(`Results: ${passed} / ${total} tests passed.`);
if (passed === total) {
  console.log("🎉 ALL COMMIT 6 BEST PRACTICE VERIFICATIONS PASSED!");
  process.exit(0);
} else {
  console.error("❌ Some checks failed.");
  process.exit(1);
}
