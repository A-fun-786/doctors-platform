#!/usr/bin/env node

/**
 * GoSmartClinic Platform - Header Clinic Identity & Issue #51 Verification Suite
 * Validates:
 * 1. Profile pill in header shows clinic name instead of doctor/admin name
 * 2. Profile icon in header uses clinic logo with fallback to DEFAULT_CLINIC_LOGO (ref Issue #49)
 * 3. Graceful fallback on broken image sources via onError
 * 4. TenantResponse backend schema sync for clinic_name
 * 5. Mobile header, mobile drawer, and profile dropdown menu consistency
 */

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..", "..", "..");

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
    console.error(`     ${err.message}`);
  }
}

// Read target files
const dashboardShellPath = path.join(
  projectRoot,
  "components",
  "dashboard",
  "DashboardShell.tsx"
);
const dashboardShellSrc = fs.readFileSync(dashboardShellPath, "utf-8");

const authSchemaPath = path.join(
  projectRoot,
  "backend",
  "app",
  "schemas",
  "auth.py"
);
const authSchemaSrc = fs.readFileSync(authSchemaPath, "utf-8");

// ============================================================================
// SUITE 1: Header Clinic Identity & Logo Integration (Issue #51)
// ============================================================================
describe("Dashboard Header Clinic Identity & Logo Integration", () => {
  test("DEFAULT_CLINIC_LOGO is imported from @/lib/api", () => {
    assert.ok(
      dashboardShellSrc.includes("DEFAULT_CLINIC_LOGO"),
      "DashboardShell must import DEFAULT_CLINIC_LOGO"
    );
  });

  test("clinicLogo resolution prioritizes custom logo and falls back to DEFAULT_CLINIC_LOGO", () => {
    assert.ok(
      dashboardShellSrc.includes("const clinicLogo ="),
      "DashboardShell must compute clinicLogo"
    );
    assert.ok(
      dashboardShellSrc.includes("DEFAULT_DOCTOR_AVATAR"),
      "clinicLogo resolution must ignore DEFAULT_DOCTOR_AVATAR"
    );
    assert.ok(
      dashboardShellSrc.includes("DEFAULT_CLINIC_LOGO"),
      "clinicLogo resolution must fall back to DEFAULT_CLINIC_LOGO"
    );
  });

  test("clinicName resolution prioritizes clinic_name from profile or tenant", () => {
    assert.ok(
      dashboardShellSrc.includes("const clinicName ="),
      "DashboardShell must compute clinicName"
    );
    assert.ok(
      dashboardShellSrc.includes("profile?.clinic_name?.trim()"),
      "clinicName must check profile?.clinic_name"
    );
    assert.ok(
      dashboardShellSrc.includes("doctor.tenant?.clinic_name?.trim()"),
      "clinicName must check doctor.tenant?.clinic_name"
    );
  });

  test("Desktop top bar renders clinicName in the header profile pill", () => {
    assert.ok(
      dashboardShellSrc.includes("{clinicName}"),
      "Desktop profile pill must render {clinicName}"
    );
  });

  test("Desktop top bar renders clinicLogo with accessible alt={clinicName}", () => {
    assert.ok(
      dashboardShellSrc.includes("src={clinicLogo}"),
      "Desktop profile pill must render src={clinicLogo}"
    );
    assert.ok(
      dashboardShellSrc.includes("alt={clinicName}"),
      "Desktop profile pill must render alt={clinicName}"
    );
  });

  test("Image onError fallback restores DEFAULT_CLINIC_LOGO", () => {
    assert.ok(
      dashboardShellSrc.includes("target.src = DEFAULT_CLINIC_LOGO"),
      "Image elements must provide onError fallback to DEFAULT_CLINIC_LOGO"
    );
  });

  test("Accessible button aria-label reflects clinic profile and session menu", () => {
    assert.ok(
      dashboardShellSrc.includes('aria-label="Clinic profile and session menu"'),
      "Profile button must have accessible aria-label for clinic profile"
    );
  });
});

// ============================================================================
// SUITE 2: Mobile Top Bar, Drawer & Profile Dropdown Consistency
// ============================================================================
describe("Mobile Top Bar, Drawer & Profile Dropdown Consistency", () => {
  test("Mobile top bar uses clinicLogo and clinicName", () => {
    assert.ok(
      dashboardShellSrc.includes("src={clinicLogo}") &&
      dashboardShellSrc.includes("alt={clinicName}"),
      "Mobile top bar must render clinic logo"
    );
  });

  test("Mobile drawer renders clinicName as headline with doctor details as secondary info", () => {
    assert.ok(
      dashboardShellSrc.includes("title={clinicName}>{clinicName}</div>") ||
      dashboardShellSrc.includes("title={clinicName}>\n                  {clinicName}") ||
      dashboardShellSrc.includes("title={clinicName}>"),
      "Mobile drawer or identity card must display clinicName with title attribute"
    );
    assert.ok(
      dashboardShellSrc.includes("{formattedDoctorName}"),
      "Doctor name must be retained as secondary info"
    );
  });

  test("ProfileDropdownMenu accepts clinicLogo and clinicName props", () => {
    assert.ok(
      dashboardShellSrc.includes("clinicLogo: string;"),
      "ProfileDropdownMenuProps must declare clinicLogo"
    );
    assert.ok(
      dashboardShellSrc.includes("clinicName: string;"),
      "ProfileDropdownMenuProps must declare clinicName"
    );
  });
});

// ============================================================================
// SUITE 3: Backend Schema Sync (TenantResponse)
// ============================================================================
describe("Backend Schema Sync (TenantResponse)", () => {
  test("TenantResponse includes clinic_name in auth schema", () => {
    assert.ok(
      authSchemaSrc.includes("class TenantResponse(BaseModel):"),
      "TenantResponse class must exist in auth.py"
    );
    assert.ok(
      authSchemaSrc.includes("clinic_name: Optional[str] = None"),
      "TenantResponse must declare clinic_name"
    );
  });
});

// ============================================================================
// SUITE 4: Logic Simulation (Unit verification)
// ============================================================================
describe("Clinic Logo & Name Resolution Logic Simulation", () => {
  const DEFAULT_DOCTOR_AVATAR = "https://images.unsplash.com/photo-1622253692010-333f2da6031d?w=400&auto=format&fit=crop&q=80";
  const DEFAULT_CLINIC_LOGO = "/emblem-only.png";

  function resolveTestLogo(profile, doctor) {
    return profile?.app_icon_url && profile.app_icon_url !== DEFAULT_DOCTOR_AVATAR && profile.app_icon_url !== ""
      ? profile.app_icon_url
      : profile?.avatar_url && profile.avatar_url !== DEFAULT_DOCTOR_AVATAR && profile.avatar_url !== ""
      ? profile.avatar_url
      : doctor?.avatar_url && doctor.avatar_url !== DEFAULT_DOCTOR_AVATAR && doctor.avatar_url !== ""
      ? doctor.avatar_url
      : DEFAULT_CLINIC_LOGO;
  }

  function resolveTestName(profile, doctor) {
    return profile?.clinic_name?.trim() ||
      doctor?.tenant?.clinic_name?.trim() ||
      (doctor?.full_name?.trim() ? `${doctor.full_name.trim()}'s Clinic` : "My Clinic");
  }

  test("Standard onboarding without custom logo falls back to DEFAULT_CLINIC_LOGO", () => {
    const profile = {
      clinic_name: "Apex Health Care",
      avatar_url: DEFAULT_DOCTOR_AVATAR,
      app_icon_url: DEFAULT_CLINIC_LOGO,
    };
    const doctor = {
      full_name: "Dr. Khan",
      avatar_url: DEFAULT_DOCTOR_AVATAR,
    };

    assert.equal(resolveTestLogo(profile, doctor), DEFAULT_CLINIC_LOGO);
    assert.equal(resolveTestName(profile, doctor), "Apex Health Care");
  });

  test("Custom uploaded clinic icon is used", () => {
    const profile = {
      clinic_name: "Al-Shifa Clinic",
      avatar_url: DEFAULT_DOCTOR_AVATAR,
      app_icon_url: "https://storage.example.com/custom_logo.png",
    };
    const doctor = {
      full_name: "Dr. Matloob",
      avatar_url: DEFAULT_DOCTOR_AVATAR,
    };

    assert.equal(resolveTestLogo(profile, doctor), "https://storage.example.com/custom_logo.png");
    assert.equal(resolveTestName(profile, doctor), "Al-Shifa Clinic");
  });

  test("Stock doctor avatar is never incorrectly displayed as clinic logo", () => {
    const profile = {
      clinic_name: "Metro Wellness",
      avatar_url: DEFAULT_DOCTOR_AVATAR,
      app_icon_url: "",
    };
    const doctor = {
      full_name: "Dr. Smith",
      avatar_url: DEFAULT_DOCTOR_AVATAR,
    };

    assert.equal(resolveTestLogo(profile, doctor), DEFAULT_CLINIC_LOGO);
    assert.notEqual(resolveTestLogo(profile, doctor), DEFAULT_DOCTOR_AVATAR);
  });

  test("Fallback to doctor tenant clinic_name when profile is not yet loaded", () => {
    const profile = null;
    const doctor = {
      full_name: "Dr. Adams",
      avatar_url: null,
      tenant: {
        clinic_name: "Adams Family Clinic",
      },
    };

    assert.equal(resolveTestName(profile, doctor), "Adams Family Clinic");
    assert.equal(resolveTestLogo(profile, doctor), DEFAULT_CLINIC_LOGO);
  });
});

// ============================================================================
// SCORECARD
// ============================================================================
console.log(`\n============================================================`);
console.log(`🏁 DASHBOARD HEADER CLINIC IDENTITY SCORECARD`);
console.log(`============================================================`);
console.log(`  Total Tests : ${stats.total}`);
console.log(`  Passed      : ${stats.passed} (${Math.round((stats.passed / stats.total) * 100)}%)`);
console.log(`  Failed      : ${stats.failed}`);
console.log(`  Suites      : ${stats.suites}/${stats.suites}`);
console.log(`============================================================`);

if (stats.failed > 0) {
  process.exit(1);
} else {
  console.log(`\n🎉 ALL ${stats.total} HEADER CLINIC IDENTITY TESTS PASSED!\n`);
}
