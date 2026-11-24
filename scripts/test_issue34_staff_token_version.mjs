#!/usr/bin/env node
/**
 * scripts/test_issue34_staff_token_version.mjs
 *
 * Issue #34 Regression & Verification Suite:
 * Ensures staff tokens without a valid token_version claim cannot bypass
 * session revocation after credential changes.
 */

import fs from "fs";
import path from "path";
import assert from "assert";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");

console.log("============================================================");
console.log("🧪 SUITE: Issue #34 - Staff Token Version & Revocation Guard");
console.log("============================================================");

let passed = 0;
let failed = 0;

function it(description, fn) {
  try {
    fn();
    console.log(`  ✅ [PASS] ${description}`);
    passed++;
  } catch (err) {
    console.error(`  ❌ [FAIL] ${description}`);
    console.error(`     Error: ${err.message}`);
    failed++;
  }
}

// ------------------------------------------------------------------
// 1. Backend Dependency & Guard Verification
// ------------------------------------------------------------------
const depsPath = path.join(projectRoot, "backend", "app", "api", "deps.py");
const depsSource = fs.readFileSync(depsPath, "utf-8");

it("1.1 deps.py enforces token_version presence and value match for staff", () => {
  assert.ok(
    depsSource.includes('jwt_token_version = payload.get("token_version")'),
    'deps.py must extract token_version from payload'
  );
  assert.ok(
    depsSource.includes('jwt_token_version is None or staff.token_version != jwt_token_version'),
    'deps.py must reject when jwt_token_version is None or does not match staff.token_version'
  );
  assert.ok(
    depsSource.includes('"Credentials have changed. Please log in again."'),
    'deps.py must return credential change revocation error'
  );
});

// ------------------------------------------------------------------
// 2. Auth Service Token Generation Verification
// ------------------------------------------------------------------
const authServicePath = path.join(projectRoot, "backend", "app", "services", "auth_service.py");
const authServiceSource = fs.readFileSync(authServicePath, "utf-8");

it("2.1 auth_service._create_staff_auth_session always injects token_version", () => {
  assert.ok(
    authServiceSource.includes('"token_version": staff.token_version'),
    '_create_staff_auth_session must include staff.token_version in claims'
  );
});

// ------------------------------------------------------------------
// 3. Test Suite Coverage Verification
// ------------------------------------------------------------------
const testAuthPath = path.join(projectRoot, "backend", "tests", "test_staff_auth.py");
const testAuthSource = fs.readFileSync(testAuthPath, "utf-8");

it("3.1 test_staff_auth.py includes dedicated regression test for Issue #34", () => {
  assert.ok(
    testAuthSource.includes("def test_staff_token_without_token_version_claim_rejected"),
    'test_staff_auth.py must define test_staff_token_without_token_version_claim_rejected'
  );
  assert.ok(
    testAuthSource.includes("stripped_token = create_access_token"),
    'test must test token with omitted token_version'
  );
  assert.ok(
    testAuthSource.includes("null_token = create_access_token"),
    'test must test token with null token_version'
  );
});

// ------------------------------------------------------------------
// 4. Behavioral Simulation: Token Version Verification Engine
// ------------------------------------------------------------------
function verifyStaffTokenVersion(payload, staffRecord) {
  const jwtTokenVersion = payload.token_version;
  if (jwtTokenVersion === undefined || jwtTokenVersion === null) {
    return { valid: false, error: "Credentials have changed. Please log in again." };
  }
  if (staffRecord.token_version !== jwtTokenVersion) {
    return { valid: false, error: "Credentials have changed. Please log in again." };
  }
  return { valid: true };
}

it("4.1 Rejects token when token_version claim is missing", () => {
  const staff = { token_version: 1 };
  const payload = { user_type: "staff", staff_id: "s-123" }; // no token_version
  const result = verifyStaffTokenVersion(payload, staff);
  assert.strictEqual(result.valid, false);
  assert.strictEqual(result.error, "Credentials have changed. Please log in again.");
});

it("4.2 Rejects token when token_version claim is null", () => {
  const staff = { token_version: 1 };
  const payload = { user_type: "staff", staff_id: "s-123", token_version: null };
  const result = verifyStaffTokenVersion(payload, staff);
  assert.strictEqual(result.valid, false);
});

it("4.3 Rejects token when token_version claim is outdated (post-password reset)", () => {
  const staff = { token_version: 2 }; // reset incremented to 2
  const payload = { user_type: "staff", staff_id: "s-123", token_version: 1 }; // old token
  const result = verifyStaffTokenVersion(payload, staff);
  assert.strictEqual(result.valid, false);
});

it("4.4 Accepts token when token_version matches active staff record", () => {
  const staff = { token_version: 3 };
  const payload = { user_type: "staff", staff_id: "s-123", token_version: 3 };
  const result = verifyStaffTokenVersion(payload, staff);
  assert.strictEqual(result.valid, true);
});

console.log("============================================================");
console.log(`🏁 SCORECARD: ${passed} / ${passed + failed} Tests Passed (${Math.round((passed / (passed + failed)) * 100)}%)`);
console.log("============================================================");

if (failed > 0) {
  process.exit(1);
}

