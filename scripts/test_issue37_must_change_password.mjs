#!/usr/bin/env node
/**
 * Verification Script: Issue #37 - Must-Change-Password Enforcement & Clearance
 *
 * Verifies that:
 * 1. backend schemas define ChangePasswordRequest with min length >= 6.
 * 2. auth_service.py implements change_password and passes must_change_password in staff sessions.
 * 3. deps.py blocks staff with must_change_password=True from accessing non-auth routes.
 * 4. auth.py route exposes POST /change-password.
 * 5. lib/api.ts exports changePassword helper.
 * 6. MandatoryChangePasswordModal exists with accessible dialog role and secure form controls.
 * 7. app/dashboard/page.tsx renders MandatoryChangePasswordModal when must_change_password is true.
 * 8. test_staff_auth.py covers Issue #37 enforcement and clearance.
 */

import fs from "fs";
import path from "path";
import assert from "assert";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");

console.log("============================================================");
console.log("🧪 SUITE: Issue #37 - Must-Change-Password Enforcement");
console.log("============================================================");

let passed = 0;
let failed = 0;

function it(desc, fn) {
  try {
    fn();
    console.log(`  ✅ [PASS] ${desc}`);
    passed++;
  } catch (err) {
    console.error(`  ❌ [FAIL] ${desc}`);
    console.error(`     Error: ${err.message}`);
    failed++;
  }
}

// ------------------------------------------------------------------
// 1. Schemas & Service Layer
// ------------------------------------------------------------------
const authSchemaPath = path.join(projectRoot, "backend", "app", "schemas", "auth.py");
const authSchemaSource = fs.readFileSync(authSchemaPath, "utf-8");

it("1.1 auth schema defines ChangePasswordRequest with min length validation", () => {
  assert.ok(
    authSchemaSource.includes("class ChangePasswordRequest(BaseModel):"),
    "auth.py must declare ChangePasswordRequest"
  );
  assert.ok(
    authSchemaSource.includes("new_password: str"),
    "ChangePasswordRequest must accept new_password"
  );
  assert.ok(
    authSchemaSource.includes("Password must be at least 8 characters long") ||
      authSchemaSource.includes("Password must be at least 6 characters long"),
    "ChangePasswordRequest must enforce minimum length"
  );
});

it("1.2 DoctorResponse schema includes must_change_password flag", () => {
  assert.ok(
    authSchemaSource.includes("must_change_password: Optional[bool] = False"),
    "DoctorResponse must include must_change_password field"
  );
});

const authServicePath = path.join(projectRoot, "backend", "app", "services", "auth_service.py");
const authServiceSource = fs.readFileSync(authServicePath, "utf-8");

it("2.1 auth_service passes must_change_password in staff session response", () => {
  assert.ok(
    authServiceSource.includes("must_change_password=staff.must_change_password"),
    "Staff session must set must_change_password"
  );
});

it("2.2 auth_service implements change_password with validation and version bump", () => {
  assert.ok(
    authServiceSource.includes("def change_password("),
    "auth_service must declare change_password method"
  );
  assert.ok(
    authServiceSource.includes("Current password is incorrect"),
    "change_password must verify current password"
  );
  assert.ok(
    authServiceSource.includes("staff.must_change_password = False"),
    "change_password must clear must_change_password"
  );
  assert.ok(
    authServiceSource.includes("staff.token_version = (staff.token_version or 1) + 1"),
    "change_password must increment token_version"
  );
});

// ------------------------------------------------------------------
// 2. Route & Dependency Enforcement
// ------------------------------------------------------------------
const depsPath = path.join(projectRoot, "backend", "app", "api", "deps.py");
const depsSource = fs.readFileSync(depsPath, "utf-8");

it("3.1 deps.py enforces must_change_password blocking non-auth endpoints", () => {
  assert.ok(
    depsSource.includes("if staff.must_change_password:"),
    "deps.py must check staff.must_change_password"
  );
  assert.ok(
    depsSource.includes("allowed_paths = {"),
    "deps.py must define allowed auth paths for password change"
  );
  assert.ok(
    depsSource.includes("/api/v1/auth/change-password"),
    "deps.py must allow /api/v1/auth/change-password"
  );
  assert.ok(
    depsSource.includes("Password change required. You must change your password before accessing the clinic portal."),
    "deps.py must raise 403 when password change is required"
  );
});

const authRoutePath = path.join(projectRoot, "backend", "app", "api", "routes", "auth.py");
const authRouteSource = fs.readFileSync(authRoutePath, "utf-8");

it("3.2 auth.py exposes POST /change-password endpoint", () => {
  assert.ok(
    authRouteSource.includes('@router.post(\n    "/change-password"') || authRouteSource.includes('@router.post("/change-password"'),
    "auth.py must declare POST /change-password route"
  );
  assert.ok(
    authRouteSource.includes("def change_password("),
    "auth.py must handle change_password request"
  );
});

// ------------------------------------------------------------------
// 3. Frontend Client & UI Gating
// ------------------------------------------------------------------
const apiPath = path.join(projectRoot, "lib", "api.ts");
const apiSource = fs.readFileSync(apiPath, "utf-8");

it("4.1 lib/api.ts exports changePassword helper with auth token refresh", () => {
  assert.ok(
    apiSource.includes("export async function changePassword("),
    "lib/api.ts must export changePassword"
  );
  assert.ok(
    apiSource.includes('apiFetch<AuthResponse>("/api/v1/auth/change-password"'),
    "changePassword must call /api/v1/auth/change-password"
  );
  assert.ok(
    apiSource.includes("setAuthToken(data.access_token)"),
    "changePassword must update stored token on success"
  );
});

const modalPath = path.join(projectRoot, "components", "auth", "MandatoryChangePasswordModal.tsx");
it("4.2 MandatoryChangePasswordModal exists with accessible dialog semantics", () => {
  assert.ok(fs.existsSync(modalPath), "MandatoryChangePasswordModal.tsx must exist");
  const modalSource = fs.readFileSync(modalPath, "utf-8");
  assert.ok(
    modalSource.includes('role="dialog"') && modalSource.includes('aria-modal="true"'),
    "Modal must have role=dialog and aria-modal=true"
  );
  assert.ok(
    modalSource.includes("Set New Password"),
    "Modal must announce set new password"
  );
  assert.ok(
    modalSource.includes("Cancel") && modalSource.includes("Confirm"),
    "Modal must feature Cancel and Confirm action buttons"
  );
  assert.ok(
    modalSource.includes("changePassword("),
    "Modal must invoke changePassword"
  );
});

const dashboardPagePath = path.join(projectRoot, "app", "dashboard", "page.tsx");
const dashboardPageSource = fs.readFileSync(dashboardPagePath, "utf-8");

it("4.3 app/dashboard/page.tsx gates UI on doctor.must_change_password without mounting dashboard", () => {
  assert.ok(
    dashboardPageSource.includes("if (doctor.must_change_password)"),
    "Dashboard must check doctor.must_change_password"
  );
  assert.ok(
    dashboardPageSource.includes("<MandatoryChangePasswordModal"),
    "Dashboard must render MandatoryChangePasswordModal"
  );
  assert.ok(
    dashboardPageSource.includes("must_change_password: false"),
    "Dashboard must clear must_change_password in state upon success"
  );
});

// ------------------------------------------------------------------
// 4. Test Suite Coverage
// ------------------------------------------------------------------
const testStaffAuthPath = path.join(projectRoot, "backend", "tests", "test_staff_auth.py");
const testStaffAuthSource = fs.readFileSync(testStaffAuthPath, "utf-8");

it("5.1 test_staff_auth.py contains comprehensive regression tests for Issue #37", () => {
  assert.ok(
    testStaffAuthSource.includes("def test_must_change_password_enforcement_and_clearance("),
    "test_staff_auth.py must include dedicated test for Issue #37"
  );
  assert.ok(
    testStaffAuthSource.includes("Password change required"),
    "Test must assert 403 on protected routes before password change"
  );
  assert.ok(
    testStaffAuthSource.includes("/api/v1/auth/change-password"),
    "Test must call change-password endpoint"
  );
});

console.log("============================================================");
console.log(`🏁 SCORECARD: ${passed} / ${passed + failed} Tests Passed (${Math.round((passed / (passed + failed)) * 100)}%)`);
console.log("============================================================");

if (failed > 0) {
  process.exit(1);
}

