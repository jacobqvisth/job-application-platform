const APP_URL = 'https://job-application-platform-lake.vercel.app';

document.addEventListener('DOMContentLoaded', async () => {
  // Check auth status
  const response = await chrome.runtime.sendMessage({ type: 'GET_AUTH_STATUS' });
  const authenticated = response?.authenticated ?? false;

  const dot = document.getElementById('auth-dot');
  const label = document.getElementById('auth-label');

  if (authenticated) {
    dot.className = 'dot dot-green';
    label.textContent = 'Connected';
    document.getElementById('not-connected').style.display = 'none';
    document.getElementById('connected-actions').style.display = 'block';
  } else {
    dot.className = 'dot dot-red';
    label.textContent = 'Not connected';
    document.getElementById('not-connected').style.display = 'block';
    document.getElementById('connected-actions').style.display = 'none';
  }

  // Detect current tab ATS
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab?.url) {
      const tabUrl = tab.url;
      let atsLabel = 'No ATS detected on this page';
      if (tabUrl.includes('greenhouse.io')) atsLabel = '✅ Greenhouse detected';
      else if (tabUrl.includes('lever.co')) atsLabel = '✅ Lever detected';
      else if (tabUrl.includes('myworkday.com')) atsLabel = '✅ Workday detected';
      else if (tabUrl.includes('linkedin.com/jobs')) atsLabel = 'LinkedIn job page (read-only)';
      document.getElementById('current-page-info').textContent = atsLabel;
    }
  } catch {
    // activeTab may not be available for some pages
  }

  document.getElementById('open-extension-page')?.addEventListener('click', () => {
    chrome.tabs.create({ url: `${APP_URL}/dashboard/extension` });
  });

  document.getElementById('open-app')?.addEventListener('click', () => {
    chrome.tabs.create({ url: `${APP_URL}/dashboard` });
  });

  document.getElementById('sign-out')?.addEventListener('click', async () => {
    await chrome.runtime.sendMessage({ type: 'SIGN_OUT' });
    window.location.reload();
  });
});
