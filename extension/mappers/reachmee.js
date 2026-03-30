export function isApplicationPage(url) {
  const { hostname, pathname, href } = new URL(url);
  if (!hostname.endsWith('.reachmee.com')) return false;
  // Legacy: URL contains /apply
  if (/\/apply(\?|$)/.test(href)) return true;
  // Attract subdomain: path ends with /apply
  if (pathname.endsWith('/apply')) return true;
  return false;
}

export function getJobInfo() {
  const title = document.querySelector('h1')?.textContent?.trim() || '';

  const company =
    document.querySelector('meta[property="og:site_name"]')?.content?.trim() ||
    document.title.split(' - ').pop()?.trim() ||
    document.title.split(' | ').pop()?.trim() ||
    '';

  const descEl =
    document.querySelector('.job-description') ||
    document.querySelector('main') ||
    document.querySelector('[class*="content"]');
  const description = descEl?.innerText?.trim() || '';

  return { title, company, description, url: window.location.href };
}

// ReachMee application form field map
// Field names sourced from *.reachmee.com live DOM analysis
const REACHMEE_FIELD_MAP = [
  { selector: 'input[name="prof_email"]',         profileKey: 'email' },
  { selector: 'input[name="prof_emailrepeat"]',    profileKey: 'email' },   // same value as email
  { selector: 'input[name="prof_firstname"]',      profileKey: 'first_name' },
  { selector: 'input[name="prof_surname"]',        profileKey: 'last_name' },
  { selector: 'input[name="prof_telephone"]',      profileKey: 'phone' },
  { selector: 'input[name="prof_address"]',        profileKey: 'address_line1' },
  { selector: 'input[name="prof_postalcode"]',     profileKey: 'postal_code' },
  { selector: 'input[name="prof_postalcity"]',     profileKey: 'city' },
  // Cover letter textarea — can be filled with user's personligt brev
  { selector: 'textarea[name="prof_personalmotivation"]', profileKey: 'cover_letter' },
];

// System/consent field names that should never be auto-filled
const CONSENT_FIELDS = new Set([
  'acceptterms',
  'policyid',
  'login',
  'password',
]);

// Employer-preference selects that use internal numeric IDs — skip auto-fill
const SKIP_SELECTS = new Set([
  'prefcareer',
  'prefcareerorient',
  'prefposition',
  'np_prefcountry',
  'np_prefcounty',
  'np_preftown',
  'prof_countrycode',
]);

export function detectFields(userMappings = []) {
  // Mapped personal-info fields
  const mapped = REACHMEE_FIELD_MAP.flatMap((fm) => {
    const el = document.querySelector(fm.selector);
    if (!el) return [];
    const override = userMappings.find((m) => m.field_identifier === fm.selector);
    const profileKey = override ? override.profile_key : fm.profileKey;
    const label =
      el.closest('[class*="field"], .form-group, div')
        ?.querySelector('label')
        ?.textContent?.trim() || fm.selector;
    return [{ element: el, selector: fm.selector, label, profileKey }];
  });

  // Screening questions — detected but marked as manual
  const mappedSelectors = new Set(REACHMEE_FIELD_MAP.map((fm) => fm.selector));
  const seenNames = new Set();
  const screening = [];

  document.querySelectorAll('input[type="radio"], input[type="checkbox"], select').forEach((el) => {
    const name = el.getAttribute('name') || '';
    if (!name || seenNames.has(name)) return;
    if (CONSENT_FIELDS.has(name)) return;
    if (SKIP_SELECTS.has(name)) return;
    if (mappedSelectors.has(`input[name="${name}"]`) || mappedSelectors.has(`select[name="${name}"]`)) return;
    seenNames.add(name);
    const label =
      el.closest('fieldset, [class*="field"], div')
        ?.querySelector('legend, label')
        ?.textContent?.trim() || name;
    screening.push({
      element: el,
      selector: `[name="${name}"]`,
      label: `${label} (screening — fill manually)`,
      profileKey: null,
    });
  });

  return [...mapped, ...screening];
}

// Standard DOM event fill — ReachMee uses server-rendered forms (no React/Vue workarounds needed)
export function fillField(element, value) {
  if (!element || value == null) return false;
  element.focus();
  if (element.tagName === 'SELECT') {
    element.value = value;
    element.dispatchEvent(new Event('change', { bubbles: true }));
  } else {
    element.value = value;
    element.dispatchEvent(new Event('input', { bubbles: true }));
    element.dispatchEvent(new Event('change', { bubbles: true }));
  }
  element.blur();
  return true;
}
