export function isApplicationPage(url) {
  return (
    url.includes('greenhouse.io') &&
    (url.includes('/app') || url.includes('/apply'))
  );
}

export function getJobInfo() {
  const title =
    document.querySelector('.app-title, h1.job-title, [data-qa="job-title"]')?.textContent?.trim() || '';
  const company =
    document.querySelector('.company-name, .employer, [data-qa="company-name"]')?.textContent?.trim() || '';
  const description =
    document.querySelector('#content .job-description, .description')?.textContent?.trim() || '';
  return { title, company, description, url: window.location.href };
}

// Default field mappings for Greenhouse forms
const GREENHOUSE_FIELD_MAP = [
  { selector: '#first_name',    profileKey: 'first_name' },
  { selector: '#last_name',     profileKey: 'last_name' },
  { selector: '#email',         profileKey: 'email' },
  { selector: '#phone',         profileKey: 'phone' },
  { selector: '#resume_text',   profileKey: 'summary' },
  { selector: 'input[name="job_application[linkedin_url]"]', profileKey: 'linkedin_url' },
  { selector: 'input[name="job_application[website]"]',      profileKey: 'website_url' },
  { selector: 'input[name="job_application[github]"]',       profileKey: 'github_url' },
];

export function detectFields(userMappings = []) {
  const fields = [];

  for (const defaultMapping of GREENHOUSE_FIELD_MAP) {
    const userOverride = userMappings.find((m) => m.field_identifier === defaultMapping.selector);
    const profileKey = userOverride ? userOverride.profile_key : defaultMapping.profileKey;

    const el = document.querySelector(defaultMapping.selector);
    if (el) {
      const label =
        el.closest('div')?.querySelector('label')?.textContent?.trim() || defaultMapping.selector;
      fields.push({ element: el, selector: defaultMapping.selector, label, profileKey });
    }
  }

  return fields;
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
