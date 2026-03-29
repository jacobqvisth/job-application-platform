(async function () {
  // ─── ATS detection ───────────────────────────────────────────────────────
  function isVarbiPage() {
    return !!(
      window.location.hostname.endsWith('.varbi.com') ||
      document.querySelector('footer')?.textContent?.includes('Varbi Recruit') ||
      document.querySelector('footer')?.textContent?.includes('Grade Varbi')
    );
  }

  // Early exit — not a Varbi page
  if (!isVarbiPage()) return;

  const atsType = 'varbi';
  const path = window.location.pathname;
  const href = window.location.href;

  // ─── Page type detection ─────────────────────────────────────────────────
  function isJobDetailPage() {
    return /\/what:job\/jobID:\d+/.test(path);
  }

  function isQuickApplyPage() {
    return /\/apply\/positionquick\/\d+/.test(path);
  }

  function isLoginRequiredPage() {
    return /\/what:login\/jobID:\d+/.test(path);
  }

  function isRelevantPage() {
    return isJobDetailPage() || isQuickApplyPage() || isLoginRequiredPage();
  }

  // Only inject sidebar on relevant job pages
  if (!isRelevantPage()) return;

  // ─── Field map (mirrors mappers/varbi.js — inlined for content script) ──
  const VARBI_FIELD_MAP = [
    { selector: 'input[name="email"]',        profileKey: 'email' },
    { selector: 'input[name="email_repeat"]', profileKey: 'email' },
    { selector: 'input[name="first_name"]',   profileKey: 'first_name' },
    { selector: 'input[name="last_name"]',    profileKey: 'last_name' },
    { selector: 'input[name="address"]',      profileKey: 'address_line1' },
    { selector: 'input[name="postal_code"]',  profileKey: 'postal_code' },
    { selector: 'input[name="city"]',         profileKey: 'city' },
    { selector: 'input[name="phone"]',        profileKey: 'phone' },
    { selector: 'select[name="country"]',     profileKey: 'country' },
  ];

  const CONSENT_FIELDS = new Set([
    'application[terms]',
    'application[gdpr]',
    'save_cv',
    'terms',
    'gdpr',
  ]);

  function detectFields(userMappings = []) {
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
        profileKey: null,
      });
    });

    return [...mapped, ...screening];
  }

  function fillField(element, value) {
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

  function isApplicationFormPresent() {
    return !!(
      document.querySelector('input[name="first_name"]') ||
      document.querySelector('input[name="email"]')
    );
  }

  // ─── Job info ─────────────────────────────────────────────────────────────
  function getJobInfo() {
    const title = document.querySelector('h1')?.textContent?.trim() || '';
    const subdomain = window.location.hostname.split('.varbi.com')[0] || '';
    const company =
      subdomain ||
      document.querySelector('header img')?.alt?.trim() ||
      document.title.split(' - ').pop()?.trim() ||
      '';
    const descEl =
      document.querySelector('main') ||
      document.querySelector('.job-description') ||
      document.querySelector('article') ||
      document.querySelector('[class*="content"]');
    const description = descEl?.innerText?.trim() || '';
    return { title, company, description, url: href };
  }

  // ─── CSS ──────────────────────────────────────────────────────────────────
  function getSidebarCSS() {
    return `
      .jac-sidebar {
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        font-size: 13px;
        background: #ffffff;
        border: 1px solid #e2e8f0;
        border-right: none;
        border-radius: 8px 0 0 8px;
        box-shadow: -2px 4px 16px rgba(0,0,0,0.12);
        width: 300px;
        overflow: hidden;
      }
      .jac-header {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 10px 12px;
        background: #1e40af;
        color: white;
      }
      .jac-title { font-weight: 600; flex: 1; font-size: 13px; }
      .jac-ats-badge {
        font-size: 10px;
        background: rgba(255,255,255,0.2);
        padding: 2px 6px;
        border-radius: 10px;
        text-transform: uppercase;
      }
      .jac-close {
        background: none;
        border: none;
        color: white;
        cursor: pointer;
        padding: 2px;
        opacity: 0.7;
        font-size: 14px;
        line-height: 1;
      }
      .jac-close:hover { opacity: 1; }
      .jac-body {
        padding: 12px;
        display: flex;
        flex-direction: column;
        gap: 8px;
      }
      .jac-status { font-size: 12px; color: #64748b; }
      .jac-info {
        font-size: 12px;
        color: #92400e;
        background: #fef3c7;
        border: 1px solid #fde68a;
        border-radius: 6px;
        padding: 8px 10px;
        line-height: 1.4;
      }
      .jac-btn {
        width: 100%;
        padding: 8px 12px;
        border-radius: 6px;
        border: none;
        cursor: pointer;
        font-size: 13px;
        font-weight: 500;
        text-align: left;
      }
      .jac-btn-primary { background: #1e40af; color: white; }
      .jac-btn-primary:hover { background: #1e3a8a; }
      .jac-btn-primary:disabled { background: #94a3b8; cursor: not-allowed; }
      .jac-btn-secondary {
        background: #f1f5f9;
        color: #334155;
        border: 1px solid #e2e8f0;
      }
      .jac-btn-secondary:hover { background: #e2e8f0; }
      .jac-divider { border: none; border-top: 1px solid #e2e8f0; margin: 4px 0; }
      .jac-results { font-size: 12px; }
      .jac-field-row { display: flex; gap: 6px; align-items: center; padding: 2px 0; }
      .jac-field-ok { color: #16a34a; }
      .jac-field-skip { color: #94a3b8; }
      .jac-field-manual { color: #d97706; }
      .jac-link {
        display: block;
        margin-top: 4px;
        font-size: 11px;
        color: #1e40af;
        text-decoration: underline;
        cursor: pointer;
      }
    `;
  }

  // ─── Sidebar HTML ─────────────────────────────────────────────────────────
  function getSidebarHTML(showFillBtn, loginRequired) {
    const loginNotice = loginRequired
      ? `<div class="jac-info">Log in to your Varbi account first, then the form will appear and we'll help fill it in.</div>`
      : '';
    const fillBtn = showFillBtn
      ? `<button class="jac-btn jac-btn-primary" id="jac-fill-btn">Fill from Profile</button>`
      : '';
    return `
      <div class="jac-header">
        <span>💼</span>
        <span class="jac-title">Job Copilot</span>
        <span class="jac-ats-badge">${atsType}</span>
        <button class="jac-close" id="jac-close-btn" title="Close">✕</button>
      </div>
      <div class="jac-body">
        <div class="jac-status" id="jac-status">Ready</div>
        ${loginNotice}
        ${fillBtn}
        <div class="jac-results" id="jac-results" style="display:none"></div>
        <hr class="jac-divider">
        <button class="jac-btn jac-btn-secondary" id="jac-capture-btn">
          📋 Open Draft Wizard
        </button>
        <button class="jac-btn jac-btn-secondary" id="jac-save-btn">
          💾 Save to Tracker
        </button>
      </div>
    `;
  }

  // ─── Inject sidebar ───────────────────────────────────────────────────────
  function injectSidebar(showFillBtn, loginRequired) {
    if (document.getElementById('jac-ext-root')) return;

    const host = document.createElement('div');
    host.id = 'jac-ext-root';
    host.style.cssText = 'position:fixed;top:80px;right:0;z-index:2147483647;width:320px;';
    document.body.appendChild(host);

    const shadow = host.attachShadow({ mode: 'open' });

    const style = document.createElement('style');
    style.textContent = getSidebarCSS();

    const container = document.createElement('div');
    container.className = 'jac-sidebar';
    container.innerHTML = getSidebarHTML(showFillBtn, loginRequired);

    shadow.appendChild(style);
    shadow.appendChild(container);

    setupButtonHandlers(shadow);
  }

  // ─── Button handlers ──────────────────────────────────────────────────────
  function setupButtonHandlers(shadow) {
    const statusEl = shadow.getElementById('jac-status');
    const resultsEl = shadow.getElementById('jac-results');
    const fillBtn = shadow.getElementById('jac-fill-btn');
    const captureBtn = shadow.getElementById('jac-capture-btn');
    const saveBtn = shadow.getElementById('jac-save-btn');
    const closeBtn = shadow.getElementById('jac-close-btn');

    closeBtn.addEventListener('click', () => {
      document.getElementById('jac-ext-root').style.display = 'none';
    });

    if (fillBtn) {
      fillBtn.addEventListener('click', async () => {
        statusEl.textContent = 'Loading profile...';
        fillBtn.disabled = true;

        chrome.runtime.sendMessage({ type: 'GET_PROFILE' }, async (response) => {
          fillBtn.disabled = false;

          if (!response?.success) {
            const msg =
              response?.error === 'NOT_AUTHENTICATED'
                ? 'Not connected — visit the app to sync'
                : response?.error || 'Failed to load profile';
            statusEl.textContent = msg;
            return;
          }

          const profile = response.profile;

          let userMappings = [];
          try {
            const mappingsResp = await new Promise((resolve) => {
              chrome.runtime.sendMessage({ type: 'GET_FIELD_MAPPINGS', atsType }, resolve);
            });
            userMappings = mappingsResp?.mappings || [];
          } catch {
            // Non-critical
          }

          const fields = detectFields(userMappings);
          if (fields.length === 0) {
            statusEl.textContent = 'No fillable fields detected';
            return;
          }

          const rows = [];
          let filledCount = 0;

          for (const field of fields) {
            // Screening questions — cannot map to profile
            if (field.profileKey === null) {
              rows.push(
                `<div class="jac-field-row"><span class="jac-field-manual">—</span><span>${field.label}</span></div>`
              );
              continue;
            }

            // File upload fields — cannot fill automatically
            if (field.element.type === 'file') {
              rows.push(
                `<div class="jac-field-row"><span class="jac-field-manual">—</span><span>${field.label} (manual: file upload)</span></div>`
              );
              continue;
            }

            const value = profile[field.profileKey];

            if (value != null && value !== '') {
              const filled = fillField(field.element, String(value));
              if (filled) {
                filledCount++;
                rows.push(
                  `<div class="jac-field-row"><span class="jac-field-ok">✓</span><span>${field.label}</span></div>`
                );
              } else {
                rows.push(
                  `<div class="jac-field-row"><span class="jac-field-skip">—</span><span>${field.label} (could not fill)</span></div>`
                );
              }
            } else {
              rows.push(
                `<div class="jac-field-row"><span class="jac-field-skip">—</span><span>${field.label} (no data in profile)</span></div>`
              );
            }
          }

          statusEl.textContent = `Filled ${filledCount} of ${fields.length} fields`;
          resultsEl.innerHTML = rows.join('');
          resultsEl.style.display = 'block';
        });
      });
    }

    captureBtn.addEventListener('click', () => {
      const { title, company, description } = getJobInfo();
      const params = new URLSearchParams({
        company: company || '',
        role: title || '',
        jobDescription: description.slice(0, 6000),
      });
      chrome.runtime.sendMessage({
        type: 'OPEN_TAB',
        url: `https://job-application-platform-lake.vercel.app/dashboard/draft?${params}`,
      });
    });

    saveBtn.addEventListener('click', () => {
      const { title, company, description } = getJobInfo();
      saveBtn.disabled = true;
      saveBtn.textContent = '⏳ Saving...';

      chrome.runtime.sendMessage(
        {
          type: 'SAVE_JOB',
          job: { title, company, url: href, description, ats_type: atsType },
        },
        (response) => {
          saveBtn.disabled = false;
          if (response?.success) {
            saveBtn.textContent = response.alreadySaved ? '✓ Already saved' : '✓ Saved to Tracker';
            if (!response.alreadySaved) {
              resultsEl.innerHTML +=
                `<a class="jac-link" href="https://job-application-platform-lake.vercel.app/dashboard/applications" target="_blank">View in Tracker →</a>`;
              resultsEl.style.display = 'block';
            }
          } else {
            saveBtn.textContent = '✗ Error — not connected?';
          }
        }
      );
    });
  }

  // ─── Main init ────────────────────────────────────────────────────────────
  // For job detail and login pages: show sidebar immediately (no form yet).
  // For quick-apply pages: use MutationObserver to wait for form to appear.

  let sidebarInjected = false;

  if (isLoginRequiredPage()) {
    // Login flow — show guidance, no fill button
    injectSidebar(false, true);
    sidebarInjected = true;

    // Watch for form to appear after login (SPA redirect or inline render)
    const loginObserver = new MutationObserver(() => {
      if (isApplicationFormPresent() && !document.getElementById('jac-ext-root')) {
        sidebarInjected = false; // allow re-injection with fill button
        injectSidebar(true, false);
        sidebarInjected = true;
        loginObserver.disconnect();
      }
    });
    loginObserver.observe(document.body, { childList: true, subtree: true });

  } else if (isJobDetailPage()) {
    // Job detail — show sidebar with save/draft, no fill button (form is on separate page)
    injectSidebar(false, false);
    sidebarInjected = true;

  } else if (isQuickApplyPage()) {
    // Quick Apply — show sidebar when form is present
    if (isApplicationFormPresent()) {
      injectSidebar(true, false);
      sidebarInjected = true;
    }

    const observer = new MutationObserver(() => {
      const formPresent = isApplicationFormPresent();
      if (formPresent && !sidebarInjected) {
        injectSidebar(true, false);
        sidebarInjected = true;
      } else if (!formPresent && sidebarInjected) {
        document.getElementById('jac-ext-root')?.remove();
        sidebarInjected = false;
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }
})();
