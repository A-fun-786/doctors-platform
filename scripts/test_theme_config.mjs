import fs from "fs";
import path from "path";
import assert from "assert";

console.log("============================================================");
console.log("🏥 AUTOMATED THEME CONFIGURATION & CONTRAST VERIFICATION");
console.log("============================================================");

const themeFilePath = path.resolve("config/theme.config.ts");

// 1. File existence check
assert.ok(fs.existsSync(themeFilePath), "config/theme.config.ts must exist");
console.log("  ✅ [PASS] config/theme.config.ts exists on disk");

const fileContent = fs.readFileSync(themeFilePath, "utf-8");

// Helper to validate hex color
function isValidHex(hex) {
  return /^#[0-9A-Fa-f]{6}$/.test(hex);
}

// 2. Validate Brand Scale (50 - 950)
const requiredBrandKeys = ["50", "100", "200", "300", "400", "500", "600", "700", "800", "900", "950"];
const brandTokens = {};
for (const key of requiredBrandKeys) {
  const match = fileContent.match(new RegExp(`${key}:\\s*"([^"]+)"`));
  assert.ok(match, `Brand token ${key} must be defined`);
  assert.ok(isValidHex(match[1]), `Brand token ${key} (${match[1]}) must be a valid 6-char hex`);
  brandTokens[key] = match[1];
}
console.log("  ✅ [PASS] Brand scale (50 - 950) complete with valid hex codes");

// 3. Validate Hospital Core Tokens
const requiredHospitalKeys = ["navy", "navyDark", "cyan", "surfaceBg", "cardBg", "border", "borderDark", "textMain", "textMuted", "textSubtle"];
const hospitalTokens = {};
for (const key of requiredHospitalKeys) {
  const match = fileContent.match(new RegExp(`${key}:\\s*"([^"]+)"`));
  assert.ok(match, `Hospital token ${key} must be defined`);
  assert.ok(isValidHex(match[1]), `Hospital token ${key} (${match[1]}) must be a valid 6-char hex`);
  hospitalTokens[key] = match[1];
}
console.log("  ✅ [PASS] Hospital structural tokens (navy, surfaces, borders, text) validated");

// 4. Validate Clinical Status Triage Indicators
const requiredStatuses = ["confirmed", "reschedule", "emergency", "teleconsult"];
for (const status of requiredStatuses) {
  assert.ok(fileContent.includes(`${status}:`), `Status indicator ${status} must be defined`);
}
console.log("  ✅ [PASS] Clinical triage indicators (confirmed, reschedule, emergency, teleconsult) defined");

// 5. WCAG Relative Luminance & Contrast Ratio calculation
function hexToRgb(hex) {
  const num = parseInt(hex.replace("#", ""), 16);
  return {
    r: (num >> 16) & 255,
    g: (num >> 8) & 255,
    b: num & 255,
  };
}

function getLuminance({ r, g, b }) {
  const a = [r, g, b].map((v) => {
    v /= 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * a[0] + 0.7152 * a[1] + 0.0722 * a[2];
}

function getContrastRatio(hex1, hex2) {
  const lum1 = getLuminance(hexToRgb(hex1));
  const lum2 = getLuminance(hexToRgb(hex2));
  const brightest = Math.max(lum1, lum2);
  const darkest = Math.min(lum1, lum2);
  return (brightest + 0.05) / (darkest + 0.05);
}

// Brand-700 on white / light surface must pass WCAG AA (>= 4.5:1)
const contrastBrand700 = getContrastRatio(brandTokens["700"], "#ffffff");
assert.ok(contrastBrand700 >= 4.5, `Brand-700 contrast ratio (${contrastBrand700.toFixed(2)}) must be >= 4.5`);
console.log(`  ✅ [PASS] Accessible brand text contrast (${brandTokens["700"]} on #ffffff) = ${contrastBrand700.toFixed(2)}:1 (WCAG AA passed)`);

// TextMain on white must pass WCAG AAA (>= 7.0:1)
const contrastTextMain = getContrastRatio(hospitalTokens["textMain"], "#ffffff");
assert.ok(contrastTextMain >= 7.0, `TextMain contrast ratio (${contrastTextMain.toFixed(2)}) must be >= 7.0`);
console.log(`  ✅ [PASS] Primary text contrast (${hospitalTokens["textMain"]} on #ffffff) = ${contrastTextMain.toFixed(2)}:1 (WCAG AAA passed)`);

// Hospital Navy on white must pass WCAG AA
const contrastNavy = getContrastRatio(hospitalTokens["navy"], "#ffffff");
assert.ok(contrastNavy >= 4.5, `Hospital Navy contrast ratio (${contrastNavy.toFixed(2)}) must be >= 4.5`);
console.log(`  ✅ [PASS] Hospital Navy contrast (${hospitalTokens["navy"]} on #ffffff) = ${contrastNavy.toFixed(2)}:1 (WCAG AA passed)`);

console.log("============================================================");
console.log("🎉 ALL AUTOMATED THEME & CONTRAST TESTS PASSED (100%)");
console.log("============================================================");
