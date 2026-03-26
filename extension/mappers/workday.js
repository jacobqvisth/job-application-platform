export function isApplicationPage(url) {
  return (
    url.includes('myworkday.com') &&
    (url.includes('/apply') || url.includes('/job/') || url.includes('/wd/'))
  );
}

export function getJobInfo() {
  const title =
    document.querySelector('[data-automation-id="jobPostingHeader"]')?.textContent?.trim() ||
    document.querySelector('h1')?.textContent?.trim() ||
    '';
  const company =
    document.querySelector('[data-automation-id="company-header-logo"]')?.getAttribute('alt') ||
    document.title.split(' - ').pop()?.trim() ||
    '';
  const description =
    document.querySelector('[data-automation-id="job-posting-details"]')?.textContent?.trim() || '';
  return { title, company, description, url: window.location.href };
}

const WORKDAY_FIELD_MAP = [
  { automationId: 'legalNameSection_firstName',  profileKey: 'first_name' },
  { automationId: 'legalNameSection_lastName',   profileKey: 'last_name' },
  { automationId: 'email',                       profileKey: 'email' },
  { automationId: 'phone-number',                profileKey: 'phone' },
  { automationId: 'addressSection_addressLine1', profileKey: 'address_line1' },
  { automationId: 'addressSection_city',         profileKey: 'city' },
];

// React requires a synthetic event to update controlled inputs
function fillReactInput(element, value) {
  const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
    window.HTMLInputElement.prototype,
    'value'
  )?.set;
  if (nativeInputValueSetter) {
    nativeInputValueSetter.call(element, value);
  } else {
    element.value = value;
  }
  element.dispatchEvent(new Event('input', { bubbles: true }));
  element.dispatchEvent(new Event('change', { bubbles: true }));
}

export function detectFields(userMappings = []) {
  const fields = [];

  for (const defaultMapping of WORKDAY_FIELD_MAP) {
    const selectorId = `[data-automation-id="${defaultMapping.automationId}"]`;
    const userOverride = userMappings.find((m) => m.field_identifier === selectorId);
    const profileKey = userOverride ? userOverride.profile_key : defaultMapping.profileKey;

    const selector = `${selectorId} input, ${selectorId}`;
    const el = document.querySelector(selector);
    if (el && el.tagName === 'INPUT') {
      const label =
        document.querySelector(`${selectorId} label`)?.textContent?.trim() ||
        defaultMapping.automationId;
      fields.push({
        element: el,
        selector: selectorId,
        label,
        profileKey,
      });
    }
  }

  return fields;
}

export function fillField(element, value) {
  if (!element || value == null) return false;
  element.focus();
  fillReactInput(element, value);
  element.blur();
  return true;
}
