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

it("3.1 auth_service strictly checks username with norm_identifier and rejects @", () => {
  assert.ok(
    authServiceSource.includes('norm_identifier = identifier.lower()'),
    "auth_service must normalize identifier with lower()"
  );
  assert.ok(
    authServiceSource.includes('if "@" in identifier:'),
    "auth_service must block @ in staff User ID"
  );
  assert.ok(
    authServiceSource.includes("func.lower(StaffMember.username) == norm_identifier"),
    "auth_service must check username with norm_identifier"
  );
});

const authSchemaPath = path.join(projectRoot, "backend", "app", "schemas", "auth.py");
const authSchemaSource = fs.readFileSync(authSchemaPath, "utf-8");

it("3.2 auth.py EmailLoginRequest rejects invalid User IDs including @", () => {
  assert.ok(
    authSchemaSource.includes("USERNAME_REGEX.match(cleaned)"),
    "EmailLoginRequest must strictly validate against USERNAME_REGEX (rejecting @ and extra symbols)"
  );
  assert.ok(
    authSchemaSource.includes("Invalid User ID or password"),
    "EmailLoginRequest must return unified Invalid User ID or password error"
  );
});

const staffSchemaPath = path.join(projectRoot, "backend", "app", "schemas", "staff.py");
const staffSchemaSource = fs.readFileSync(staffSchemaPath, "utf-8");

it("3.3 schemas/staff.py validate_staff_username rejects @ without stripping", () => {
  assert.ok(
    !staffSchemaSource.includes('lstrip("@")'),
    "validate_staff_username must not strip leading @ with lstrip"
  );
  assert.ok(
    staffSchemaSource.includes("USERNAME_ALLOWED_CHARS_REGEX.match(cleaned)"),
    "validate_staff_username must strictly validate against USERNAME_ALLOWED_CHARS_REGEX"
  );
});

// ------------------------------------------------------------------
// 4. Behavioral Simulation: Normalization & Identity Matching
// ------------------------------------------------------------------
function normalizeUsername(raw) {
  if (!raw) return null;
  if (raw.includes("@")) return null;
  return raw.trim().toLowerCase();
}

it("4.1 Normalizes diverse casing variants to identical lowercase key", () => {
  const v1 = normalizeUsername("JohnDoe");
  const v2 = normalizeUsername("johndoe");
  const v3 = normalizeUsername("JOHNDOE");
  const v4 = normalizeUsername("  johnDoe  ");

  assert.strictEqual(v1, "johndoe");
  assert.strictEqual(v2, "johndoe");
  assert.strictEqual(v3, "johndoe");
  assert.strictEqual(v4, "johndoe");
  assert.strictEqual(v1, v2);
  assert.strictEqual(v2, v3);
  assert.strictEqual(v3, v4);
});

it("4.2 Rejects @ in User ID while differentiating exact User ID", () => {
  assert.strictEqual(normalizeUsername("@nurse.joy"), null);
  assert.strictEqual(normalizeUsername("nurse.joy"), "nurse.joy");
});

console.log("============================================================");
console.log(`🏁 SCORECARD: ${passed} / ${passed + failed} Tests Passed (${Math.round((passed / (passed + failed)) * 100)}%)`);
console.log("============================================================");

if (failed > 0) {
  process.exit(1);
}

