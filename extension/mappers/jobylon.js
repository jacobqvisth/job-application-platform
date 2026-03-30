export function isApplicationPage(url) {
  const { hostname, pathname } = new URL(url);
  return (
    hostname === 'emp.jobylon.com' &&
    /\/applications\/jobs\/\d+\/create\/?$/.test(pathname)
  );
}

export function getJobInfo() {
  const title = document.querySelector('h1')?.textContent?.trim() || '';

  // Company: prefer og:site_name, then parse from page title
  const company =
    document.querySelector('meta[property="og:site_name"]')?.content?.trim() ||
    document.title.split(' at ').pop()?.split(' | ')[0]?.trim() ||
    '';

  // Description: .job-description or main article
  const descEl =
    document.querySelector('.job-description') ||
    document.querySelector('main article') ||
    document.querySelector('main') ||
    document.querySelector('[class*="content"]');
  const description = descEl?.innerText?.trim() || '';

  return { title, company, description, url: window.location.href };
}

// Jobylon Quick Apply form field map
// Field names sourced from emp.jobylon.com live DOM analysis
const JOBYLON_FIELD_MAP = [
  { selector: '#id_first_name',    profileKey: 'first_name' },
  { selector: '#id_last_name',     profileKey: 'last_name' },
  { selector: '#id_email',         profileKey: 'email' },
  { selector: '#id_ln_url',        profileKey: 'linkedin_url' },
  // Phone: visible tel input — intl-tel-input library handles hidden field
  { selector: '#id_phone_number',  profileKey: 'phone' },
];

// System/consent field names that should never be auto-filled
const CONSENT_FIELDS = new Set([
  'terms',
  'csrfmiddlewaretoken',
  'social_title',
  'session_id',
  'ab_test',
  'original_referrer',
  'tracking_tags',
  'ln_json_sign',
  'ln_json_awli',
]);

export function detectFields(userMappings = []) {
  // Mapped personal-info fields
  const mapped = JOBYLON_FIELD_MAP.flatMap((fm) => {
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

  // Screening questions: input[name^="job_question_"] — detected but marked manual
  const mappedSelectors = new Set(JOBYLON_FIELD_MAP.map((fm) => fm.selector));
  const seenNames = new Set();
  const screening = [];

  document.querySelectorAll('input[name^="job_question_"]').forEach((el) => {
    const name = el.getAttribute('name') || '';
    if (!name || seenNames.has(name)) return;
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

  // Also detect other radio/checkbox/select inputs not already mapped or consented
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
      profileKey: null,
    });
  });

  return [...mapped, ...screening];
}

// Standard DOM event fill — Jobylon uses Django + intl-tel-input (no React workarounds needed)
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
