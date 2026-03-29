export function isApplicationPage(url) {
  // Flow A: Quick Apply — /apply/positionquick/{id}/
  // Flow B: Login-gated — /what:login/jobID:{id}/type:job/apply:1/
  const isQuickApply = /\/apply\/positionquick\/\d+/.test(url);
  const isLoginApply = /\/what:login\/jobID:\d+/.test(url);
  return isQuickApply || isLoginApply;
}

export function getJobInfo() {
  const title = document.querySelector('h1')?.textContent?.trim() || '';

  // Company: prefer subdomain (e.g. "migrationsverket" from migrationsverket.varbi.com)
  const subdomain = window.location.hostname.split('.varbi.com')[0] || '';
  const company =
    subdomain ||
    document.querySelector('header img')?.alt?.trim() ||
    document.title.split(' - ').pop()?.trim() ||
    '';

  // Description: main content area
  const descEl =
    document.querySelector('main') ||
    document.querySelector('.job-description') ||
    document.querySelector('article') ||
    document.querySelector('[class*="content"]');
  const description = descEl?.innerText?.trim() || '';

  return { title, company, description, url: window.location.href };
}

// Varbi Quick Apply form field map
// Field names sourced from migrationsverket.varbi.com quick-apply DOM analysis
const VARBI_FIELD_MAP = [
  { selector: 'input[name="email"]',        profileKey: 'email' },
  { selector: 'input[name="email_repeat"]', profileKey: 'email' },
  { selector: 'input[name="first_name"]',   profileKey: 'first_name' },
  { selector: 'input[name="last_name"]',    profileKey: 'last_name' },
  { selector: 'input[name="address"]',      profileKey: 'address_line1' },
  { selector: 'input[name="postal_code"]',  profileKey: 'postal_code' },
  { selector: 'input[name="city"]',         profileKey: 'city' },
  { selector: 'input[name="phone"]',        profileKey: 'phone' },
  // country is a <select> — included so it appears in field list
  { selector: 'select[name="country"]',     profileKey: 'country' },
];

// System/consent field names that should never be auto-filled
const CONSENT_FIELDS = new Set([
  'application[terms]',
  'application[gdpr]',
  'save_cv',
  'terms',
  'gdpr',
]);

export function detectFields(userMappings = []) {
  // Mapped personal-info fields
  const mapped = VARBI_FIELD_MAP.flatMap((fm) => {
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

  // Employer-specific screening questions — detected but marked as manual
  // Avoid duplicates and skip consent/GDPR checkboxes and already-mapped fields
  const mappedSelectors = new Set(VARBI_FIELD_MAP.map((fm) => fm.selector));
  const seenNames = new Set();

  const screening = [];
  document.querySelectorAll('input[type="radio"], input[type="checkbox"], select').forEach((el) => {
    const name = el.getAttribute('name') || '';
    if (!name || seenNames.has(name)) return;
    if (CONSENT_FIELDS.has(name)) return;
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
      profileKey: null, // cannot map to profile
    });
  });

  return [...mapped, ...screening];
}

// Vue.js-compatible field filling
// Varbi uses Vue + jQuery — standard value assignment + event dispatch works fine.
// No React nativeInputValueSetter workaround needed.
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
