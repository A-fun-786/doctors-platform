import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");

console.log("============================================================");
console.log("🩺 AUTOMATED VERIFICATION: PR 18 COMMIT 11 BEST PRACTICES FIXES");
console.log("============================================================");

let passed = 0;
let total = 0;

function test(name, fn) {
  total++;
  try {
    fn();
    passed++;
    console.log(`  ✅ [PASS] ${name}`);
  } catch (err) {
    console.error(`  ❌ [FAIL] ${name}: ${err.message}`);
  }
}

const brandConfigPath = path.join(projectRoot, "config/brand.config.ts");
const howItWorksPath = path.join(projectRoot, "components/landing/HowItWorks.tsx");
const heroPath = path.join(projectRoot, "components/landing/Hero.tsx");
const previewSectionPath = path.join(projectRoot, "components/landing/PreviewSection.tsx");
const testimonialsPath = path.join(projectRoot, "components/landing/Testimonials.tsx");
const featuresPath = path.join(projectRoot, "components/landing/Features.tsx");
const faqPath = path.join(projectRoot, "components/landing/FAQ.tsx");
const navbarPath = path.join(projectRoot, "components/landing/Navbar.tsx");
const footerPath = path.join(projectRoot, "components/landing/Footer.tsx");
const homePagePath = path.join(projectRoot, "app/page.tsx");
const rootPlanPath = path.join(projectRoot, "LANDING_PAGE_PLAN.md");
const docsPlanPath = path.join(projectRoot, "docs/LANDING_PAGE_PLAN.md");

// -----------------------------------------------------------------------------
// Finding 1: Brand Centralization & White-Label Support
// -----------------------------------------------------------------------------
test("1.1 brand.config.ts drives PRIMARY_BRAND_NAME via process.env with DocSpace default", () => {
  const content = fs.readFileSync(brandConfigPath, "utf8");
  assert.ok(
    content.includes("process.env.NEXT_PUBLIC_BRAND_NAME || \"DocSpace\""),
    "PRIMARY_BRAND_NAME should be driven by process.env.NEXT_PUBLIC_BRAND_NAME with 'DocSpace' default"
  );
  assert.ok(
    !content.includes('export const PRIMARY_BRAND_NAME = "GoSmartClinic";'),
    "brand.config.ts should not hardcode PRIMARY_BRAND_NAME = 'GoSmartClinic'"
  );
});

test("1.2 HowItWorks.tsx uses dynamic BRAND_CONFIG.name and does not hardcode GoSmartClinic", () => {
  const content = fs.readFileSync(howItWorksPath, "utf8");
  assert.ok(
    content.includes("How {BRAND_CONFIG.name} Works"),
    "HowItWorks heading must use dynamic {BRAND_CONFIG.name}"
  );
  assert.ok(
    !content.includes("GoSmartClinic"),
    "HowItWorks.tsx must not contain any hardcoded 'GoSmartClinic'"
  );
});

test("1.3 Hero.tsx mockup URL uses dynamic BRAND_CONFIG.slug", () => {
  const content = fs.readFileSync(heroPath, "utf8");
  assert.ok(
    content.includes("carewellpolyclinic.{BRAND_CONFIG.slug}.com"),
    "Hero browser mockup URL must use {BRAND_CONFIG.slug}"
  );
  assert.ok(
    !content.includes("gosmartclinic.com"),
    "Hero.tsx must not contain hardcoded 'gosmartclinic.com'"
  );
});

test("1.4 PreviewSection.tsx mockup URL uses dynamic BRAND_CONFIG.slug", () => {
  const content = fs.readFileSync(previewSectionPath, "utf8");
  assert.ok(
    content.includes("carewellpolyclinic.{BRAND_CONFIG.slug}.com"),
    "PreviewSection browser mockup URL must use {BRAND_CONFIG.slug}"
  );
  assert.ok(
    !content.includes("gosmartclinic.com"),
    "PreviewSection.tsx must not contain hardcoded 'gosmartclinic.com'"
  );
});

test("1.5 Testimonials.tsx quotes dynamically bind BRAND_CONFIG.name", () => {
  const content = fs.readFileSync(testimonialsPath, "utf8");
  assert.ok(
    content.includes("${BRAND_CONFIG.name} gave our clinic its own branded website"),
    "Dr. Rajesh Sharma quote must reference dynamic ${BRAND_CONFIG.name}"
  );
  assert.ok(
    content.includes("${BRAND_CONFIG.name} gave us our own direct clinic website"),
    "Dr. Anita Deshmukh quote must reference dynamic ${BRAND_CONFIG.name}"
  );
  assert.ok(
    !content.includes("GoSmartClinic"),
    "Testimonials.tsx must not contain hardcoded 'GoSmartClinic'"
  );
});

test("1.6 Footer.tsx eliminates hardcoded GoSmartClinic strings", () => {
  const content = fs.readFileSync(footerPath, "utf8");
  assert.ok(
    !content.includes("GoSmartClinic"),
    "Footer.tsx must not contain hardcoded 'GoSmartClinic'"
  );
});

// -----------------------------------------------------------------------------
// Finding 2: Orphaned Component & Repository Root Plan Drift
// -----------------------------------------------------------------------------
test("2.1 app/page.tsx renders PreviewSection between Features and HowItWorks", () => {
  const content = fs.readFileSync(homePagePath, "utf8");
  assert.ok(
    content.includes("import PreviewSection from \"@/components/landing/PreviewSection\";"),
    "app/page.tsx must import PreviewSection"
  );
  const featuresIdx = content.indexOf("<Features />");
  const previewIdx = content.indexOf("<PreviewSection />");
  const howItWorksIdx = content.indexOf("<HowItWorks />");

  assert.ok(featuresIdx !== -1, "Features component must be present in app/page.tsx");
  assert.ok(previewIdx !== -1, "PreviewSection component must be present in app/page.tsx");
  assert.ok(howItWorksIdx !== -1, "HowItWorks component must be present in app/page.tsx");
  assert.ok(
    featuresIdx < previewIdx && previewIdx < howItWorksIdx,
    "PreviewSection must be ordered between Features and HowItWorks"
  );
});

test("2.2 PreviewSection.tsx has id='preview' anchor tag", () => {
  const content = fs.readFileSync(previewSectionPath, "utf8");
  assert.ok(
    content.includes('id="preview"'),
    "PreviewSection section must have id='preview' for anchor navigation"
  );
});

test("2.3 LANDING_PAGE_PLAN.md moved from root to docs/ without contradictory links", () => {
  assert.ok(
    !fs.existsSync(rootPlanPath),
    "LANDING_PAGE_PLAN.md must NOT exist in repository root"
  );
  assert.ok(
    fs.existsSync(docsPlanPath),
    "docs/LANDING_PAGE_PLAN.md must exist in docs/ directory"
  );

  const planContent = fs.readFileSync(docsPlanPath, "utf8");
  assert.ok(
    !planContent.includes("#templates"),
    "docs/LANDING_PAGE_PLAN.md must not reference non-existent #templates"
  );
  assert.ok(
    !planContent.includes("Templates.tsx"),
    "docs/LANDING_PAGE_PLAN.md must not reference non-existent Templates.tsx"
  );
  assert.ok(
    planContent.includes("Signup / Login"),
    "docs/LANDING_PAGE_PLAN.md must specify unified 'Signup / Login'"
  );
});

// -----------------------------------------------------------------------------
// Finding 3: Unused Imports & Deterministic Key Anti-Patterns
// -----------------------------------------------------------------------------
test("3.1 Testimonials.tsx removes unused Sparkles import", () => {
  const content = fs.readFileSync(testimonialsPath, "utf8");
  assert.ok(
    !content.includes("Sparkles"),
    "Testimonials.tsx must not import unused Sparkles icon"
  );
});

test("3.2 Testimonials.tsx uses deterministic key={item.name} instead of index key", () => {
  const content = fs.readFileSync(testimonialsPath, "utf8");
  assert.ok(
    content.includes("key={item.name}"),
    "Testimonials.tsx must use key={item.name} instead of array index key"
  );
  assert.ok(
    !content.includes("testimonials.map((item, idx) =>"),
    "Testimonials.tsx must not map with index parameter"
  );
});

test("3.3 Features.tsx uses deterministic key={feature.title} instead of index key", () => {
  const content = fs.readFileSync(featuresPath, "utf8");
  assert.ok(
    content.includes("key={feature.title}"),
    "Features.tsx must use key={feature.title} instead of array index key"
  );
  assert.ok(
    !content.includes("features.map((feature, idx) =>"),
    "Features.tsx must not map with index parameter"
  );
});

test("3.4 HowItWorks.tsx uses deterministic key={item.step} instead of index key", () => {
  const content = fs.readFileSync(howItWorksPath, "utf8");
  assert.ok(
    content.includes("key={item.step}"),
    "HowItWorks.tsx must use key={item.step} instead of array index key"
  );
  assert.ok(
    !content.includes("steps.map((item, idx) =>"),
    "HowItWorks.tsx must not map with index parameter"
  );
});

// -----------------------------------------------------------------------------
// Finding 4: Accessibility & Navigation Interaction Bugs
// -----------------------------------------------------------------------------
test("4.1 FAQ.tsx uses semantic button with aria-expanded and aria-controls", () => {
  const content = fs.readFileSync(faqPath, "utf8");
  assert.ok(
    content.includes("<button"),
    "FAQ item header must be rendered as a semantic button"
  );
  assert.ok(
    content.includes("aria-expanded={isOpen}"),
    "FAQ trigger button must have dynamic aria-expanded attribute"
  );
  assert.ok(
    content.includes("aria-controls={`faq-answer-${faq.id}`}"),
    "FAQ trigger button must have aria-controls matching answer id"
  );
  assert.ok(
    content.includes("id={`faq-answer-${faq.id}`}"),
    "FAQ answer container must have matching id"
  );
  assert.ok(
    content.includes('role="region"'),
    "FAQ answer container must have role='region'"
  );
  assert.ok(
    !content.includes("e.stopPropagation()"),
    "FAQ.tsx must eliminate nested buttons and e.stopPropagation()"
  );
});

test("4.2 Navbar.tsx handleLinkClick invokes e.preventDefault() for smooth scrolling", () => {
  const content = fs.readFileSync(navbarPath, "utf8");
  assert.ok(
    content.includes("handleLinkClick = (e: React.MouseEvent<HTMLAnchorElement>, href: string)"),
    "handleLinkClick must receive MouseEvent"
  );
  assert.ok(
    content.includes("e.preventDefault()"),
    "handleLinkClick must invoke e.preventDefault() to eliminate competing route navigation"
  );
  assert.ok(
    content.includes("elem.scrollIntoView({ behavior: \"smooth\" })"),
    "handleLinkClick must scroll smoothly into view"
  );
});

test("4.3 Navbar.tsx standardizes Signup / Login CTA text across desktop and mobile", () => {
  const content = fs.readFileSync(navbarPath, "utf8");
  assert.ok(
    !content.includes("SignUp / LogIn"),
    "Navbar.tsx must not contain mismatched 'SignUp / LogIn' casing"
  );
  assert.ok(
    content.includes("Signup / Login"),
    "Navbar.tsx must use 'Signup / Login'"
  );
  // Ensure both button anchors render Signup / Login
  const buttonMatches = content.match(/>\s*Signup \/ Login\s*<\/Link>/g) || [];
  assert.equal(
    buttonMatches.length,
    2,
    "Navbar.tsx must have 2 button links rendering 'Signup / Login' (desktop and mobile drawer)"
  );
});

test("4.4 Footer.tsx eliminates dead anchors and links to valid sections/routes", () => {
  const content = fs.readFileSync(footerPath, "utf8");
  assert.ok(!content.includes('href="#about"'), "Footer must not contain dead href='#about'");
  assert.ok(!content.includes('href="#contact"'), "Footer must not contain dead href='#contact'");
  assert.ok(!content.includes('href="#privacy"'), "Footer must not contain dead href='#privacy'");
  assert.ok(!content.includes('href="#terms"'), "Footer must not contain dead href='#terms'");
  assert.ok(content.includes('href="/#features"'), "Footer must link to /#features");
  assert.ok(content.includes('href="/#preview"'), "Footer must link to /#preview");
  assert.ok(content.includes('href="/#how-it-works"'), "Footer must link to /#how-it-works");
  assert.ok(content.includes('href="/#testimonials"'), "Footer must link to /#testimonials");
  assert.ok(content.includes('href="/#faq"'), "Footer must link to /#faq");
  assert.ok(content.includes('href="/register"'), "Footer must link to /register");
  assert.ok(content.includes('href="/login"'), "Footer must link to /login");
});

// -----------------------------------------------------------------------------
// Scorecard Summary
// -----------------------------------------------------------------------------
console.log("============================================================");
console.log(`🏁 SCORECARD: ${passed} / ${total} Tests Passed (${Math.round((passed / total) * 100)}%)`);
console.log("============================================================");

if (passed !== total) {
  process.exit(1);
}
