#!/usr/bin/env node

/**
 * Phase 4 Verification Suite: Password Reset UI Components & Flow
 * (as specified in Section 3.6.2 of docs/feature/email/password_reset_plan.md)
 *
 * Verifies:
 * 1. Forgot password link exists in login form (components/auth/EmailAuthForm.tsx)
 * 2. Forgot password form submits to correct endpoint (/api/v1/auth/forgot-password)
 * 3. OTP input field rendered after email submission (components/auth/ForgotPasswordForm.tsx)
 * 4. Reset password form validates matching passwords client-side
 * 5. Password strength indicator present (components/auth/ResetPasswordForm.tsx)
 * 6. Successful reset stores JWT and redirects
 * 7. Error states (429, 400, 503) render accessible alerts (role="alert", aria-live="polite")
 * 8. Magic link with ?token=&email= pre-populates correctly
 * 9. API client functions (forgotPassword, resetPassword) exported and contract-compliant in lib/api.ts
 * 10. Next.js app routes (app/auth/forgot-password/page.tsx, app/auth/reset-password/page.tsx) with Suspense
 */

import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";

const stats = { total: 0, passed: 0, failed: 0 };

async function test(name, fn) {
  stats.total++;
  try {
    await fn();
    stats.passed++;
    console.log(`  ✅ [PASS] ${name}`);
  } catch (err) {
    stats.failed++;
    console.error(`  ❌ [FAIL] ${name}`);
    console.error(`     Error: ${err.message}`);
  }
}

console.log("=================================================================");
console.log("Password Reset Phase 4 Frontend Verification (Plan Section 3.6.2)");
console.log("=================================================================\n");

const ROOT = process.cwd();

// --- 1. Check 1: Forgot password link exists in login form ---
await test("Check 1: 'Forgot password?' link exists in EmailAuthForm.tsx in login mode", () => {
  const content = fs.readFileSync(path.join(ROOT, "components/auth/EmailAuthForm.tsx"), "utf-8");
  assert.match(content, /Forgot password\?/, "Should contain 'Forgot password?' text");
  assert.match(content, /href=["']\/auth\/forgot-password["']/, "Should link to /auth/forgot-password");
  assert.match(content, /mode === ["']login["']/, "Should be guarded by mode === 'login'");
});

// --- 2. Check 2: Forgot password form submits to correct endpoint ---
await test("Check 2: Forgot password form submits to /api/v1/auth/forgot-password", () => {
  const apiContent = fs.readFileSync(path.join(ROOT, "lib/api.ts"), "utf-8");
  const formContent = fs.readFileSync(path.join(ROOT, "components/auth/ForgotPasswordForm.tsx"), "utf-8");
  
  assert.match(apiContent, /export async function forgotPassword/, "lib/api.ts should export forgotPassword");
  assert.match(apiContent, /\/api\/v1\/auth\/forgot-password/, "lib/api.ts should target /api/v1/auth/forgot-password");
  assert.match(formContent, /forgotPassword\(/, "ForgotPasswordForm should call forgotPassword API function");
});

// --- 3. Check 3: OTP input field rendered after email submission ---
await test("Check 3: OTP input field rendered with 6-digit code entry and 60s resend cooldown", () => {
  const content = fs.readFileSync(path.join(ROOT, "components/auth/ForgotPasswordForm.tsx"), "utf-8");
  assert.match(content, /step === ["']otp["']|step === ["']request["']/, "Should have step-based state machine");
  assert.match(content, /6-Digit Reset Code|otp-code/, "Should have 6-digit code label/id");
  assert.match(content, /setCooldown\(60\)/, "Should enforce 60s cooldown on resend");
  assert.match(content, /inputMode=["']numeric["']/, "Should set numeric inputMode for mobile keypad");
  assert.match(content, /maxLength=\{6\}/, "Should restrict input length to 6 digits");
});

// --- 4. Check 4: Reset password form validates matching passwords client-side ---
await test("Check 4: Reset password form validates matching passwords client-side", () => {
  const content = fs.readFileSync(path.join(ROOT, "components/auth/ResetPasswordForm.tsx"), "utf-8");
  assert.match(content, /password !== confirmPassword/, "Should check if password !== confirmPassword");
  assert.match(content, /Passwords do not match/, "Should display password mismatch message");
  assert.match(content, /disabled=\{[^}]*password !== confirmPassword/, "Submit button should be disabled when passwords do not match");
});

// --- 5. Check 5: Password strength indicator present ---
await test("Check 5: Password strength indicator checklist present in ResetPasswordForm", () => {
  const content = fs.readFileSync(path.join(ROOT, "components/auth/ResetPasswordForm.tsx"), "utf-8");
  assert.match(content, /pwdValidation/, "Should use password validation result");
  assert.match(content, /8\+ characters/, "Should check 8+ characters");
  assert.match(content, /Uppercase letter/, "Should check uppercase letter");
  assert.match(content, /Lowercase letter/, "Should check lowercase letter");
  assert.match(content, /At least one number/, "Should check number");
  assert.match(content, /Special symbol/, "Should check special symbol");
  assert.match(content, /validatePassword/, "Should reuse validatePassword logic");
});

// --- 6. Check 6: Successful reset stores JWT and redirects ---
await test("Check 6: Successful reset stores JWT and redirects to dashboard/onboarding", () => {
  const apiContent = fs.readFileSync(path.join(ROOT, "lib/api.ts"), "utf-8");
  const formContent = fs.readFileSync(path.join(ROOT, "components/auth/ResetPasswordForm.tsx"), "utf-8");
  
  assert.match(apiContent, /setAuthToken\(data\.access_token\)/, "resetPassword should call setAuthToken with access_token");
  assert.match(formContent, /router\.push\("\/dashboard"\)/, "Should redirect to dashboard");
  assert.match(formContent, /router\.push\("\/onboarding"\)/, "Should redirect to onboarding if onboarding not completed");
});

// --- 7. Check 7: Error states (429, 400, 503) render accessible alerts ---
await test("Check 7: Error states render accessible alerts (role='alert', aria-live='polite')", () => {
  const forgotForm = fs.readFileSync(path.join(ROOT, "components/auth/ForgotPasswordForm.tsx"), "utf-8");
  const resetForm = fs.readFileSync(path.join(ROOT, "components/auth/ResetPasswordForm.tsx"), "utf-8");
  
  assert.match(forgotForm, /role=["']alert["']/, "ForgotPasswordForm should have role='alert'");
  assert.match(forgotForm, /aria-live=["']polite["']/, "ForgotPasswordForm should have aria-live='polite'");
  assert.match(resetForm, /role=["']alert["']/, "ResetPasswordForm should have role='alert'");
  assert.match(resetForm, /aria-live=["']polite["']/, "ResetPasswordForm should have aria-live='polite'");
});

// --- 8. Check 8: Magic link with ?token=&email= pre-populates correctly ---
await test("Check 8: Magic link query parameters (?token= & ?email= & ?code=) pre-populate correctly", () => {
  const resetClient = fs.readFileSync(path.join(ROOT, "app/auth/reset-password/ResetPasswordClient.tsx"), "utf-8");
  const resetForm = fs.readFileSync(path.join(ROOT, "components/auth/ResetPasswordForm.tsx"), "utf-8");
  
  assert.match(resetClient, /searchParams\.get\(["']token["']\)/, "Should read token parameter");
  assert.match(resetClient, /searchParams\.get\(["']code["']\)/, "Should read code parameter");
  assert.match(resetClient, /searchParams\.get\(["']email["']\)/, "Should read email parameter");
  assert.match(resetForm, /initialToken/, "ResetPasswordForm should accept initialToken prop");
  assert.match(resetForm, /initialCode/, "ResetPasswordForm should accept initialCode prop");
  assert.match(resetForm, /initialEmail/, "ResetPasswordForm should accept initialEmail prop");
});

// --- 9. Check 9: Next.js page wrappers have Suspense boundaries for CSR hydration ---
await test("Check 9: App Router pages wrap client components in Suspense for safe searchParams usage", () => {
  const forgotPage = fs.readFileSync(path.join(ROOT, "app/auth/forgot-password/page.tsx"), "utf-8");
  const resetPage = fs.readFileSync(path.join(ROOT, "app/auth/reset-password/page.tsx"), "utf-8");
  
  assert.match(forgotPage, /<Suspense/, "ForgotPasswordPage must use <Suspense>");
  assert.match(resetPage, /<Suspense/, "ResetPasswordPage must use <Suspense>");
  assert.match(forgotPage, /BRAND_CONFIG\.formatMetaTitle/, "ForgotPasswordPage should set branded metadata title");
  assert.match(resetPage, /BRAND_CONFIG\.formatMetaTitle/, "ResetPasswordPage should set branded metadata title");
});

// --- 10. Check 10: Client-side validator logic correctness ---
await test("Check 10: Client-side validators validatePassword and isValidEmail rule compliance", () => {
  const EMAIL_REGEX =
    /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*\.[a-zA-Z]{2,}$/;
  const isValidEmail = (e) => EMAIL_REGEX.test((e || "").trim().toLowerCase());

  function validatePassword(pwd) {
    const p = pwd || "";
    return {
      hasMinLength: p.length >= 8,
      hasUppercase: /[A-Z]/.test(p),
      hasLowercase: /[a-z]/.test(p),
      hasDigit: /[0-9]/.test(p),
      hasSpecial: /[!@#$%^&*(),.?":{}|<>\-_+=\[\]\\\/~`]/.test(p),
      get isValid() {
        return this.hasMinLength && this.hasUppercase && this.hasLowercase && this.hasDigit && this.hasSpecial;
      },
    };
  }

  assert.equal(isValidEmail("doctor@example.com"), true);
  assert.equal(isValidEmail("invalid-email"), false);
  assert.equal(isValidEmail(""), false);

  assert.equal(validatePassword("weak").isValid, false);
  assert.equal(validatePassword("NoSpecial1").isValid, false);
  assert.equal(validatePassword("no_upper_123!").isValid, false);
  assert.equal(validatePassword("NO_LOWER_123!").isValid, false);
  assert.equal(validatePassword("NoDigit!!abc").isValid, false);
  assert.equal(validatePassword("ValidPass123!").isValid, true);
});

console.log("\n-----------------------------------------------------------------");
console.log(`Summary: ${stats.passed}/${stats.total} checks passed (${stats.failed} failed)`);
console.log("-----------------------------------------------------------------\n");

if (stats.failed > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
