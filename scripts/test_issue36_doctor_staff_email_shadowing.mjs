#!/usr/bin/env node
/**
 * Verification Script: Issue #36 - Cross-Account Email Shadowing Prevention
 *
 * Verifies that:
 * 1. register_email checks for existing login-enabled staff before creating a Doctor.
 * 2. authenticate_google checks for existing login-enabled staff before auto-provisioning a Doctor.
 * 3. create_staff checks for existing Doctor emails before creating a login-enabled StaffMember.
 * 4. update_staff checks for existing Doctor emails before updating a StaffMember's email.
 * 5. All cross-account email checks enforce case-insensitivity.
 */

import fs from "fs";
import path from "path";
import assert from "assert";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");

console.log("============================================================");
console.log("🧪 SUITE: Issue #36 - Cross-Account Email Shadowing Prevention");
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
// 1. AuthService Registration Checks
// ------------------------------------------------------------------
const authServicePath = path.join(projectRoot, "backend", "app", "services", "auth_service.py");
const authServiceSource = fs.readFileSync(authServicePath, "utf-8");

it("1.1 register_email checks existing login-enabled staff email before creating doctor", () => {
  assert.ok(
    authServiceSource.includes("conflicting_staff = db.query(StaffMember).filter("),
    "register_email must query StaffMember for existing email"
  );
  assert.ok(
    authServiceSource.includes("StaffMember.can_login.is_(True)"),
    "register_email must filter for can_login.is_(True)"
  );
  assert.ok(
    authServiceSource.includes("An account with this email address already exists as a clinic staff member"),
    "register_email must return clear staff conflict message"
  );
});

it("1.2 register_email enforces case-insensitivity on both doctor and staff lookups", () => {
  assert.ok(
    authServiceSource.includes("func.lower(Doctor.email) == email.lower()"),
    "Doctor lookup in register_email must be case-insensitive"
  );
  assert.ok(
    authServiceSource.includes("func.lower(StaffMember.email) == email.lower()"),
    "Staff lookup in register_email must be case-insensitive"
  );
});

it("1.3 authenticate_google guards against provisioning doctor with staff email", () => {
  assert.ok(
    authServiceSource.includes("This Google account is registered as a clinic staff member"),
    "authenticate_google must reject Google sign-in when email belongs to clinic staff"
  );
  assert.ok(
    authServiceSource.includes("status.HTTP_409_CONFLICT"),
    "authenticate_google must return 409 Conflict for staff email conflict"
  );
});

// ------------------------------------------------------------------
// 2. StaffService Creation and Update Checks
// ------------------------------------------------------------------
const staffServicePath = path.join(projectRoot, "backend", "app", "services", "staff_service.py");
const staffServiceSource = fs.readFileSync(staffServicePath, "utf-8");

it("2.1 create_staff rejects emails belonging to registered doctors", () => {
  assert.ok(
    staffServiceSource.includes("select(Doctor).where(func.lower(Doctor.email) == email)"),
    "create_staff must check Doctor table for email conflict"
  );
  assert.ok(
    staffServiceSource.includes("An account with this email already exists as a clinic administrator"),
    "create_staff must return informative error for doctor email collision"
  );
});

it("2.2 update_staff rejects emails belonging to registered doctors", () => {
  assert.ok(
    staffServiceSource.includes("select(Doctor).where(func.lower(Doctor.email) == norm_email)"),
    "update_staff must check Doctor table for email conflict"
  );
});

// ------------------------------------------------------------------
// 3. Regression Test Verification
// ------------------------------------------------------------------
const testAuthPath = path.join(projectRoot, "backend", "tests", "test_auth.py");
const testAuthSource = fs.readFileSync(testAuthPath, "utf-8");

it("3.1 test_auth.py includes test_doctor_registration_rejects_existing_staff_email", () => {
  assert.ok(
    testAuthSource.includes("def test_doctor_registration_rejects_existing_staff_email"),
    "test_auth.py must have dedicated registration collision test"
  );
});

it("3.2 test_auth.py includes test_doctor_google_auth_rejects_existing_staff_email", () => {
  assert.ok(
    testAuthSource.includes("def test_doctor_google_auth_rejects_existing_staff_email"),
    "test_auth.py must have dedicated Google auth collision test"
  );
});

const testStaffPath = path.join(projectRoot, "backend", "tests", "test_staff.py");
const testStaffSource = fs.readFileSync(testStaffPath, "utf-8");

it("3.3 test_staff.py includes test_create_and_update_staff_rejects_existing_doctor_email", () => {
  assert.ok(
    testStaffSource.includes("def test_create_and_update_staff_rejects_existing_doctor_email"),
    "test_staff.py must have dedicated staff creation/update doctor email collision test"
  );
});

// ------------------------------------------------------------------
// 4. Staff User ID Only Decoupling Checks
// ------------------------------------------------------------------
it("4.1 auth_service login_email rejects email addresses in staff portal", () => {
  assert.ok(
    authServiceSource.includes('if "@" in identifier and not identifier.startswith("@"):'),
    "Staff portal must reject email addresses with @"
  );
  assert.ok(
    authServiceSource.includes("Email login is not supported for staff"),
    "Must explain that email login is not supported for staff"
  );
});

it("4.2 auth_service login_email queries staff strictly by username", () => {
  assert.ok(
    authServiceSource.includes("func.lower(StaffMember.username) == norm_identifier"),
    "Staff lookup must use norm_identifier"
  );
  // Ensure staff query branch does not use or_(... StaffMember.email ...)
  assert.ok(
    !authServiceSource.includes("func.lower(StaffMember.email) == identifier.lower()"),
    "Staff lookup must NOT fall back to StaffMember.email"
  );
});

const formPath = path.join(projectRoot, "components", "auth", "EmailAuthForm.tsx");
const formSource = fs.readFileSync(formPath, "utf-8");

it("4.3 EmailAuthForm rejects email on staff tab with actionable message", () => {
  assert.ok(
    formSource.includes('cleanEmail.includes("@") && !cleanEmail.startsWith("@")'),
    "Form must detect email address on staff tab"
  );
  assert.ok(
    formSource.includes("Email sign-in is reserved for clinic administrators"),
    "Form must guide staff to use User ID"
  );
});

console.log("============================================================");
console.log(`🏁 SCORECARD: ${passed} / ${passed + failed} Tests Passed (${Math.round((passed / (passed + failed)) * 100)}%)`);
console.log("============================================================");

if (failed > 0) {
  process.exit(1);
}


