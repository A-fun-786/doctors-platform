#!/usr/bin/env node

/**
 * GoSmartClinic Platform - Onboarding Hardening & PR #39 Review Resolution Test Suite
 * Validates:
 * 1. Dead code elimination (isCompleted, share links, copy buttons)
 * 2. Logo upload, reset & removal persistence (DEFAULT_DOCTOR_AVATAR on remove)
 * 3. Event bubbling isolation (stopPropagation on Enter/search)
 * 4. WCAG 2.1 AA accessibility (combobox, no nested buttons in option, accessible file button, useId)
 * 5. Architectural alignment (BrandLogo, reusable PhoneInput in components/ui, dialCodes in lib)
 * 6. Phone validation & trunk zero stripping
 */

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");

const stats = {
  total: 0,
  passed: 0,
  failed: 0,
  suites: 0,
};

function describe(suiteName, fn) {
  stats.suites++;
  console.log(`\n============================================================`);
  console.log(`🧪 SUITE [${stats.suites}]: ${suiteName}`);
  console.log(`============================================================`);
  fn();
}

function test(name, fn) {
  stats.total++;
  try {
    fn();
    stats.passed++;
    console.log(`  ✅ [PASS] ${name}`);
  } catch (err) {
    stats.failed++;
    console.error(`  ❌ [FAIL] ${name}`);
    console.error(`     Error: ${err.message}`);
  }
}

// Transpile and dynamically import lib/dialCodes.ts
const dialCodesRaw = fs.readFileSync(path.join(projectRoot, "lib", "dialCodes.ts"), "utf-8");
const jsCode = ts.transpileModule(dialCodesRaw, {
  compilerOptions: { module: ts.ModuleKind.ESNext },
}).outputText;
const encodedUri = "data:text/javascript;base64," + Buffer.from(jsCode).toString("base64");
const dialCodesModule = await import(encodedUri);

const {
  COUNTRY_DIAL_CODES,
  stripLeadingZero,
  validatePhoneNumber,
  parseStoredPhone,
  detectDefaultCountry,
} = dialCodesModule;

// Read relevant files
const onboardingPage = fs.readFileSync(
  path.join(projectRoot, "app", "onboarding", "page.tsx"),
  "utf-8"
);
const onboardingLayout = fs.readFileSync(
  path.join(projectRoot, "components", "onboarding", "OnboardingLayout.tsx"),
  "utf-8"
);
const stepContent = fs.readFileSync(
  path.join(projectRoot, "components", "onboarding", "OnboardingStepContent.tsx"),
  "utf-8"
);
const phoneInput = fs.readFileSync(
  path.join(projectRoot, "components", "ui", "PhoneInput.tsx"),
  "utf-8"
);
const nextConfig = fs.readFileSync(
  path.join(projectRoot, "next.config.mjs"),
  "utf-8"
);
const apiTs = fs.readFileSync(
  path.join(projectRoot, "lib", "api.ts"),
  "utf-8"
);

// ============================================================================
// SUITE 1: Dead Code Elimination (Review Item 1)
// ============================================================================
describe("Dead Code Elimination & Navigation Flow", () => {
  test("isCompleted state and setter are removed from page.tsx", () => {
    assert.strictEqual(onboardingPage.includes("isCompleted"), false);
    assert.strictEqual(onboardingPage.includes("setIsCompleted"), false);
  });

  test("Dead completion screen UI is completely removed", () => {
    assert.strictEqual(onboardingPage.includes("Practice Setup Complete!"), false);
    assert.strictEqual(onboardingPage.includes("Patient Portal URL"), false);
    assert.strictEqual(onboardingPage.includes("Share WhatsApp"), false);
  });

  test("Unused clipboard & link helpers are eliminated", () => {
    assert.strictEqual(onboardingPage.includes("copyLocalLink"), false);
    assert.strictEqual(onboardingPage.includes("localPatientUrl"), false);
    assert.strictEqual(onboardingPage.includes("localOrigin"), false);
  });

  test("Redirects straight to /dashboard on completion", () => {
    assert.ok(onboardingPage.includes('router.push("/dashboard")'));
  });
});

// ============================================================================
// SUITE 2: Logo Upload, Reset & Removal Logic (Review Item 2)
// ============================================================================
describe("Logo Upload, Reset & Removal Persistence", () => {
  test("Step2ClinicLogo accepts onFileSelect callback pattern", () => {
    assert.ok(stepContent.includes("onFileSelect: (file: File) => void"));
    assert.ok(onboardingPage.includes("onFileSelect={handleLogoSelect}"));
  });

  test("Step2ClinicLogo clears input value on change for repeat selection", () => {
    assert.ok(stepContent.includes('fileInputRef.current.value = ""'));
  });

  test("Drag & drop does not mutate fileInputRef or dispatch synthetic events", () => {
    assert.strictEqual(stepContent.includes('new Event("change"'), false);
    assert.strictEqual(stepContent.includes("fileInputRef.current.files ="), false);
    assert.ok(stepContent.includes("onFileSelect(file)"));
  });

  test("Reset persistence: empty clinicLogoUrl persists DEFAULT_DOCTOR_AVATAR", () => {
    assert.ok(
      onboardingPage.includes(
        "clinicLogoUrl ? clinicLogoUrl : DEFAULT_DOCTOR_AVATAR"
      ) ||
      onboardingPage.includes(
        "finalAvatar = clinicLogoUrl ? clinicLogoUrl : DEFAULT_DOCTOR_AVATAR"
      )
    );
    // Ensure it does not fallback to profileData?.avatar_url
    assert.strictEqual(
      onboardingPage.includes("clinicLogoUrl || profileData?.avatar_url || DEFAULT_DOCTOR_AVATAR"),
      false
    );
  });

  test("DEFAULT_CLINIC_LOGO is exported and defaults to brand emblem", () => {
    assert.ok(apiTs.includes("export const DEFAULT_CLINIC_LOGO = BRAND_CONFIG.assets.emblem"));
  });

  test("Step2ClinicLogo auto-applies DEFAULT_CLINIC_LOGO preview when logoUrl is empty", () => {
    assert.ok(stepContent.includes("DEFAULT_CLINIC_LOGO"));
    assert.ok(stepContent.includes("src={DEFAULT_CLINIC_LOGO}"));
    assert.ok(stepContent.includes("Default Logo"));
  });

  test("Finalize setup auto-applies DEFAULT_CLINIC_LOGO to app_icon_url when not uploaded", () => {
    assert.ok(onboardingPage.includes("finalAppIcon = clinicLogoUrl ? clinicLogoUrl : DEFAULT_CLINIC_LOGO"));
    assert.ok(onboardingPage.includes("app_icon_url: finalAppIcon"));
  });
});

// ============================================================================
// SUITE 3: Keyboard Navigation & Event Bubbling (Review Item 3)
// ============================================================================
describe("Keyboard Navigation & Event Bubbling", () => {
  test("Search keydown handler calls stopPropagation on Enter", () => {
    assert.ok(phoneInput.includes('case "Enter":'));
    assert.ok(phoneInput.includes("e.stopPropagation()"));
  });

  test("Search keydown handler isolates Escape and Arrow navigation", () => {
    assert.ok(phoneInput.includes('case "Escape":'));
    assert.ok(phoneInput.includes('case "ArrowDown":'));
    assert.ok(phoneInput.includes('case "ArrowUp":'));
  });
});

// ============================================================================
// SUITE 4: Accessibility (WCAG 2.1 AA) & Form Structure (Review Item 4)
// ============================================================================
describe("Accessibility (WCAG 2.1 AA) & Combobox Pattern", () => {
  test("Step2 renders accessible button instead of styled label for file upload", () => {
    assert.ok(stepContent.includes("<button"));
    assert.ok(stepContent.includes("fileInputRef.current?.click()"));
    assert.strictEqual(stepContent.includes('htmlFor="clinic-logo-upload"'), false);
  });

  test("PhoneInput uses combobox pattern with aria-activedescendant", () => {
    assert.ok(phoneInput.includes('role="combobox"'));
    assert.ok(phoneInput.includes('aria-autocomplete="list"'));
    assert.ok(phoneInput.includes("aria-activedescendant"));
  });

  test("PhoneInput options do NOT nest interactive buttons inside role='option'", () => {
    assert.ok(phoneInput.includes('role="option"'));
    // Ensure <button is not inside the option li
    const optionBlock = phoneInput.substring(
      phoneInput.indexOf('role="option"'),
      phoneInput.indexOf("</li>", phoneInput.indexOf('role="option"'))
    );
    assert.strictEqual(optionBlock.includes("<button"), false);
  });

  test("PhoneInput uses React useId() to prevent ID collisions", () => {
    assert.ok(phoneInput.includes("useId()"));
    assert.strictEqual(phoneInput.includes('id="phone-country-dropdown"'), false);
  });
});

// ============================================================================
// SUITE 5: Phone Validation & Trunk Zero Stripping
// ============================================================================
describe("Phone Validation & Trunk Zero Stripping", () => {
  test("stripLeadingZero removes trunk zeros from various phone formats", () => {
    assert.strictEqual(stripLeadingZero("0300 123 4567"), "300 123 4567");
    assert.strictEqual(stripLeadingZero("03001234567"), "3001234567");
    assert.strictEqual(stripLeadingZero("00923001234567"), "923001234567");
    assert.strictEqual(stripLeadingZero("3001234567"), "3001234567");
    assert.strictEqual(stripLeadingZero(""), "");
  });

  test("validatePhoneNumber enforces E.164 length (7 to 15 digits)", () => {
    assert.strictEqual(validatePhoneNumber("123456"), false); // 6 digits - too short
    assert.strictEqual(validatePhoneNumber("1234567"), true); // 7 digits - valid
    assert.strictEqual(validatePhoneNumber("300 123 4567"), true); // 10 digits - valid
    assert.strictEqual(validatePhoneNumber("+92 300 1234567"), true); // 12 digits - valid
    assert.strictEqual(validatePhoneNumber("123456789012345"), true); // 15 digits - valid
    assert.strictEqual(validatePhoneNumber("1234567890123456"), false); // 16 digits - too long
  });

  test("parseStoredPhone handles international prefix and strips leading zero", () => {
    const res = parseStoredPhone("+92 0300 1234567");
    assert.strictEqual(res.country.code, "PK");
    assert.strictEqual(res.localNumber, "300 1234567");

    const usRes = parseStoredPhone("+1 555 019 2834");
    assert.strictEqual(usRes.country.code, "US");
    assert.strictEqual(usRes.localNumber, "555 019 2834");
  });
});

// ============================================================================
// SUITE 6: Architectural Alignment & Config Cleanliness (Review Item 5)
// ============================================================================
describe("Architectural Alignment & Config Cleanliness", () => {
  test("OnboardingLayout uses BrandLogo instead of raw icons and text", () => {
    assert.ok(onboardingLayout.includes('import { BrandLogo } from "@/components/brand/BrandLogo"'));
    assert.ok(
      onboardingLayout.includes('<BrandLogo size="sm" href={null} />') ||
      onboardingLayout.includes('<BrandLogo size="sm" href={null} priority />')
    );
    assert.strictEqual(onboardingLayout.includes("StethoscopeHeartPulseIcon"), false);
  });

  test("Reusable primitives exist under components/ui/ and lib/", () => {
    assert.ok(fs.existsSync(path.join(projectRoot, "components", "ui", "PhoneInput.tsx")));
    assert.ok(fs.existsSync(path.join(projectRoot, "lib", "dialCodes.ts")));
  });

  test("Onboarding components live under components/onboarding", () => {
    assert.ok(fs.existsSync(path.join(projectRoot, "components", "onboarding", "OnboardingLayout.tsx")));
    assert.ok(fs.existsSync(path.join(projectRoot, "components", "onboarding", "OnboardingStepContent.tsx")));
    assert.ok(fs.existsSync(path.join(projectRoot, "components", "onboarding", "steps.ts")));
  });

  test("next.config.mjs remotePatterns cleans up flagcdn.com while retaining CSP", () => {
    assert.strictEqual(nextConfig.includes('hostname: "flagcdn.com"'), false);
    assert.ok(nextConfig.includes("https://flagcdn.com"));
  });
});

// ============================================================================
// SUMMARY SCORECARD
// ============================================================================
console.log(`\n============================================================`);
console.log(`🏁 ONBOARDING HARDENING TEST SCORECARD`);
console.log(`============================================================`);
console.log(`  Total Tests : ${stats.total}`);
console.log(`  Passed      : ${stats.passed} (${Math.round((stats.passed / stats.total) * 100)}%)`);
console.log(`  Failed      : ${stats.failed}`);
console.log(`  Suites      : ${stats.suites}/${stats.suites}`);
console.log(`============================================================`);

if (stats.failed > 0) {
  process.exit(1);
} else {
  console.log(`\n🎉 ALL ${stats.total} ONBOARDING HARDENING & COMPLIANCE TESTS PASSED!\n`);
}
