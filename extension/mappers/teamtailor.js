export function isApplicationPage(url) {
  // Teamtailor job pages have /jobs/{numeric_id} in path
  return /\/jobs\/\d+/.test(new URL(url).pathname);
}

export function getJobInfo() {
  const title = document.querySelector('h1')?.textContent?.trim() || '';
  const company =
    document.querySelector('meta[property="og:site_name"]')?.content ||
    document.querySelector('header img, .career-site-logo img')?.alt ||
    document.title.split(' - ').pop()?.trim() || '';
  const candidates = [
    document.querySelector('[data-controller="job-ad"]'),
    document.querySelector('.job-ad-body'),
    document.querySelector('main article'),
    document.querySelector('main .content'),
  ].filter(Boolean);
  const description =
    candidates
      .map((el) => el.innerText?.trim() || '')
      .sort((a, b) => b.length - a.length)[0] || '';
  return { title, company, description, url: window.location.href };
}

const TEAMTAILOR_FIELD_MAP = [
  { selector: '#candidate_first_name', profileKey: 'first_name' },
  { selector: '#candidate_last_name',  profileKey: 'last_name' },
  { selector: '#candidate_email',      profileKey: 'email' },
  { selector: '#candidate_phone',      profileKey: 'phone' },
  { selector: '#candidate_job_applications_attributes_0_cover_letter', profileKey: 'cover_letter' },
];

export function detectFields(userMappings = []) {
  return TEAMTAILOR_FIELD_MAP.flatMap((fm) => {
    const el = document.querySelector(fm.selector);
    if (!el) return [];
    const override = userMappings.find((m) => m.field_identifier === fm.selector);
    const profileKey = override ? override.profile_key : fm.profileKey;
    const label =
      el.closest('[class*="field"], .form-group, div')
        ?.querySelector('label')?.textContent?.trim() || fm.selector;
    return [{ element: el, selector: fm.selector, label, profileKey }];
  });
}

export function fillField(element, value) {
  if (!element || value == null) return false;
  element.focus();
  element.value = value;
  element.dispatchEvent(new Event('input', { bubbles: true }));
  element.dispatchEvent(new Event('change', { bubbles: true }));
  element.blur();
  return true;
}
