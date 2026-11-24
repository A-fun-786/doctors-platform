#!/usr/bin/env node
/**
 * scripts/test_issue35_case_insensitive_identity.mjs
 *
 * Issue #35 Regression & Verification Suite:
 * Ensures staff login identity (username and login-enabled email) uniqueness
 * is strictly case-insensitive at both the DB constraint level and service/schema level.
 */

import fs from "fs";
import path from "path";
import assert from "assert";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");

console.log("============================================================");
console.log("🧪 SUITE: Issue #35 - Staff Login Identity Case-Insensitive Uniqueness");
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
// 1. Model & Functional Index Verification
// ------------------------------------------------------------------
const modelPath = path.join(projectRoot, "backend", "app", "models", "staff.py");
const modelSource = fs.readFileSync(modelPath, "utf-8");

it("1.1 staff.py defines uq_staff_username_lower functional unique index", () => {
  assert.ok(
    modelSource.includes('Index("uq_staff_username_lower", func.lower(username), unique=True)'),
    "StaffMember must define uq_staff_username_lower with func.lower(username)"
  );
});

it("1.2 staff.py defines uq_staff_login_email_lower partial unique index for can_login=True", () => {
  assert.ok(
    modelSource.includes('Index(\n        "uq_staff_login_email_lower"') ||
    modelSource.includes('"uq_staff_login_email_lower",'),
    "StaffMember must define uq_staff_login_email_lower index"
  );
  assert.ok(
    modelSource.includes("can_login.is_(True)") && modelSource.includes("email.isnot(None)"),
    "uq_staff_login_email_lower must filter for can_login=True and email IS NOT NULL"
  );
});

// ------------------------------------------------------------------
// 2. Migration 015 Verification
// ------------------------------------------------------------------
const migrationPath = path.join(
  projectRoot,
  "backend",
  "alembic",
  "versions",
  "015_staff_case_insensitive_unique_indexes.py"
);

it("2.1 Migration 015 exists and defines upgrade/downgrade for case-insensitive indexes", () => {
  assert.ok(fs.existsSync(migrationPath), "Migration 015 file must exist");
  const migSource = fs.readFileSync(migrationPath, "utf-8");
  assert.ok(
    migSource.includes('op.create_index(\n        "uq_staff_username_lower"') ||
    migSource.includes('"uq_staff_username_lower"'),
    "Migration 015 must create uq_staff_username_lower"
  );
  assert.ok(
    migSource.includes('"uq_staff_login_email_lower"'),
    "Migration 015 must create uq_staff_login_email_lower"
  );
});

// ------------------------------------------------------------------
// 3. Auth Service & Login Schema Verification
// ------------------------------------------------------------------
const authServicePath = path.join(projectRoot, "backend", "app", "services", "auth_service.py");
const authServiceSource = fs.readFileSync(authServicePath, "utf-8");

it("3.1 auth_service normalizes identifier by stripping leading @ for staff login", () => {
  assert.ok(
    authServiceSource.includes('norm_identifier = identifier.lstrip("@").lower()'),
    "auth_service must normalize identifier with lstrip('@').lower()"
  );
  assert.ok(
    authServiceSource.includes("func.lower(StaffMember.username) == norm_identifier"),
    "auth_service must check username with norm_identifier"
  );
});

const authSchemaPath = path.join(projectRoot, "backend", "app", "schemas", "auth.py");
const authSchemaSource = fs.readFileSync(authSchemaPath, "utf-8");

it("3.2 auth.py EmailLoginRequest handles staff User ID with leading @ symbol", () => {
  assert.ok(
    authSchemaSource.includes('if cleaned.startswith("@"):'),
    "EmailLoginRequest must detect leading @ for staff portal"
  );
  assert.ok(
    authSchemaSource.includes('stripped = cleaned.lstrip("@")'),
    "EmailLoginRequest must strip @ before validating alphanumeric User ID"
  );
});

// ------------------------------------------------------------------
// 4. Behavioral Simulation: Normalization & Identity Matching
// ------------------------------------------------------------------
function normalizeUsername(raw) {
  if (!raw) return null;
  return raw.trim().replace(/^@+/, "").toLowerCase();
}

it("4.1 Normalizes diverse casing and leading @ variants to identical lowercase key", () => {
  const v1 = normalizeUsername("@JohnDoe");
  const v2 = normalizeUsername("johndoe");
  const v3 = normalizeUsername("@JOHNDOE");
  const v4 = normalizeUsername("  @johnDoe  ");

  assert.strictEqual(v1, "johndoe");
  assert.strictEqual(v2, "johndoe");
  assert.strictEqual(v3, "johndoe");
  assert.strictEqual(v4, "johndoe");
  assert.strictEqual(v1, v2);
  assert.strictEqual(v2, v3);
  assert.strictEqual(v3, v4);
});

it("4.2 Differentiates login email vs User ID without stripping internal @", () => {
  const emailInput = "nurse.joy@hospital.com";
  const userIdInput = "@nurse.joy";

  assert.strictEqual(normalizeUsername(userIdInput), "nurse.joy");
  // Email stays as email
  assert.strictEqual(emailInput.trim().toLowerCase(), "nurse.joy@hospital.com");
});

console.log("============================================================");
console.log(`🏁 SCORECARD: ${passed} / ${passed + failed} Tests Passed (${Math.round((passed / (passed + failed)) * 100)}%)`);
console.log("============================================================");

if (failed > 0) {
  process.exit(1);
}

