export function isApplicationPage(url) {
  return url.includes('jobs.lever.co') && url.includes('/apply');
}

export function getJobInfo() {
  const title =
    document.querySelector('.posting-headline h2, .section-title')?.textContent?.trim() || '';
  const company =
    document.querySelector('.main-header-logo img')?.alt ||
    document.title.split(' at ').pop()?.trim() ||
    '';
  const description =
    document.querySelector('.section.page-centered .content')?.textContent?.trim() || '';
  return { title, company, description, url: window.location.href };
}

const LEVER_FIELD_MAP = [
  { selector: 'input[name="name"]',             profileKey: 'full_name' },
  { selector: 'input[name="email"]',            profileKey: 'email' },
  { selector: 'input[name="phone"]',            profileKey: 'phone' },
  { selector: 'input[name="org"]',              profileKey: 'current_company' },
  { selector: 'input[name="urls[LinkedIn]"]',   profileKey: 'linkedin_url' },
  { selector: 'input[name="urls[GitHub]"]',     profileKey: 'github_url' },
  { selector: 'input[name="urls[Portfolio]"]',  profileKey: 'website_url' },
];

export function detectFields(userMappings = []) {
  const fields = [];

  for (const defaultMapping of LEVER_FIELD_MAP) {
    const userOverride = userMappings.find((m) => m.field_identifier === defaultMapping.selector);
    const profileKey = userOverride ? userOverride.profile_key : defaultMapping.profileKey;

    const el = document.querySelector(defaultMapping.selector);
    if (el) {
      const label =
        el.closest('.application-field')?.querySelector('label')?.textContent?.trim() ||
        defaultMapping.selector;
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
