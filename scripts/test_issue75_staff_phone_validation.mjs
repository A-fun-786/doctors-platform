import fs from "node:fs";
import path from "node:path";
import assert from "node:assert";

const root = process.cwd();
const phoneLib = fs.readFileSync(path.join(root, "lib/phone.ts"), "utf8");
const phoneInput = fs.readFileSync(path.join(root, "components/ui/CountryPhoneInput.tsx"), "utf8");
const countryFlag = fs.readFileSync(path.join(root, "components/ui/CountryFlag.tsx"), "utf8");
const staffTab = fs.readFileSync(path.join(root, "components/dashboard/StaffTab.tsx"), "utf8");
const staffSchema = fs.readFileSync(path.join(root, "backend/app/schemas/staff.py"), "utf8");

let passed = 0;
function check(name, fn) {
  try {
    fn();
    console.log(`  [PASS] ${name}`);
    passed++;
  } catch (err) {
    console.error(`  [FAIL] ${name}: ${err.message}`);
    process.exitCode = 1;
  }
}

console.log("Issue #75: Staff 10-Digit Mobile & Country Code Verification");

check("lib/phone.ts defaults to India (+91) and enforces /^[6-9]\\d{9}$/", () => {
  assert(phoneLib.includes('DEFAULT_COUNTRY_ISO = "IN"'));
  assert(phoneLib.includes('dialCode: "+91"'));
  assert(phoneLib.includes("mobilePattern: /^[6-9]\\d{9}$/"));
});

check("lib/phone.ts COUNTRY_DIAL_CODES has all countries sorted alphabetically A-Z", () => {
  const names = [...phoneLib.matchAll(/name:\s*"([^"]+)"/g)].map((m) => m[1]);
  assert(names.length >= 190, `Expected at least 190 countries, got ${names.length}`);
  const sorted = [...names].sort((a, b) => a.localeCompare(b));
  assert.deepStrictEqual(names, sorted, "Country list must be sorted A-Z");
});

check("CountryPhoneInput provides SVG flag (flag-icons) + dial code listbox and numeric clamping", () => {
  assert(phoneInput.includes('aria-haspopup="listbox"'));
  assert(phoneInput.includes("<CountryFlag"));
  assert(phoneInput.includes("maxLength={selectedCountry.maxDigits}"));
  assert(phoneInput.includes("Search country A-Z or code..."));
  assert(countryFlag.includes("flag-icons/css/flag-icons.min.css"));
  assert(countryFlag.includes("fi fi-${code}"));
  const isos = [...phoneLib.matchAll(/iso:\s*"([A-Z]{2})"/g)].map((m) => m[1]);
  for (const iso of isos) {
    const svgPath = path.join(root, "node_modules/flag-icons/flags/4x3", `${iso.toLowerCase()}.svg`);
    assert(fs.existsSync(svgPath), `Missing flag-icons SVG for ${iso}`);
  }
});

check("StaffTab.tsx uses CountryPhoneInput and validateStaffPhoneValue", () => {
  assert(staffTab.includes('from "@/components/ui/CountryPhoneInput"'));
  assert(staffTab.includes('from "@/lib/phone"'));
  const occurrences = (staffTab.match(/<CountryPhoneInput/g) || []).length;
  assert.strictEqual(occurrences, 2, "Expected CountryPhoneInput in both Add and Edit staff forms");
});

check("backend/app/schemas/staff.py enforces strict 10-digit Indian mobile regex", () => {
  assert(staffSchema.includes('INDIAN_MOBILE_REGEX = re.compile(r"^[6-9]\\d{9}$")'));
  assert(staffSchema.includes("len(local_digits) != 10"));
  assert(staffSchema.includes("len(set(local_digits)) == 1"));
});

console.log(`Scorecard: ${passed}/5 checks passed`);
