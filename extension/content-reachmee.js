(async function () {
  // ─── ATS detection ───────────────────────────────────────────────────────
  function isReachMeePage() {
    return window.location.hostname.endsWith('.reachmee.com');
  }

  // Early exit — not a ReachMee page
  if (!isReachMeePage()) return;

  const atsType = 'reachmee';
  const path = window.location.pathname;
  const href = window.location.href;

  // ─── Page type detection ─────────────────────────────────────────────────
  function isApplicationPage() {
    // Legacy: URL contains /apply
    if (/\/apply(\?|$)/.test(href)) return true;
    // Attract subdomain: path ends with /apply
    if (path.endsWith('/apply')) return true;
    return false;
  }

  function isJobDetailPage() {
    // Legacy: /main with positive job_id param
    if (path.endsWith('/main')) {
      const jobId = new URLSearchParams(window.location.search).get('job_id');
      if (jobId && Number(jobId) > 0) return true;
    }
    // Attract: /jobs/{id}-{slug} but not ending in /apply
    if (/\/jobs\/\d+/.test(path) && !path.endsWith('/apply')) return true;
    return false;
  }

  function isRelevantPage() {
    return isApplicationPage() || isJobDetailPage();
  }

  // Only inject sidebar on relevant pages
  if (!isRelevantPage()) return;

  // ─── Field map (mirrors mappers/reachmee.js — inlined for content script) ─
  const REACHMEE_FIELD_MAP = [
    { selector: 'input[name="prof_email"]',         profileKey: 'email' },
    { selector: 'input[name="prof_emailrepeat"]',    profileKey: 'email' },
    { selector: 'input[name="prof_firstname"]',      profileKey: 'first_name' },
    { selector: 'input[name="prof_surname"]',        profileKey: 'last_name' },
    { selector: 'input[name="prof_telephone"]',      profileKey: 'phone' },
    { selector: 'input[name="prof_address"]',        profileKey: 'address_line1' },
    { selector: 'input[name="prof_postalcode"]',     profileKey: 'postal_code' },
    { selector: 'input[name="prof_postalcity"]',     profileKey: 'city' },
    { selector: 'textarea[name="prof_personalmotivation"]', profileKey: 'cover_letter' },
  ];

  const CONSENT_FIELDS = new Set([
    'acceptterms',
    'policyid',
    'login',
    'password',
  ]);

  const SKIP_SELECTS = new Set([
    'prefcareer',
    'prefcareerorient',
    'prefposition',
    'np_prefcountry',
    'np_prefcounty',
    'np_preftown',
    'prof_countrycode',
  ]);

  function detectFields(userMappings = []) {
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
      document.querySelector('input[name="prof_email"]') ||
      document.querySelector('input[name="prof_firstname"]')
    );
  }

  // ─── Job info ─────────────────────────────────────────────────────────────
  function getJobInfo() {
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
      .jac-pipeline { margin-bottom: 4px; }
      .jac-pipeline-title {
        font-size: 11px;
        font-weight: 600;
        color: #475569;
        text-transform: uppercase;
        letter-spacing: 0.05em;
        margin-bottom: 6px;
      }
      .jac-app-row {
        display: flex;
        align-items: center;
        gap: 6px;
        padding: 4px 0;
        border-bottom: 1px solid #f1f5f9;
      }
      .jac-app-row:last-child { border-bottom: none; }
      .jac-app-role {
        flex: 1;
        font-size: 12px;
        color: #1e293b;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .jac-status-badge {
        font-size: 10px;
        font-weight: 600;
        padding: 2px 6px;
        border-radius: 10px;
        white-space: nowrap;
        cursor: pointer;
        border: none;
        background: none;
      }
      .jac-status-saved     { background: #f1f5f9; color: #475569; }
      .jac-status-applied   { background: #dbeafe; color: #1d4ed8; }
      .jac-status-interviewing { background: #fef3c7; color: #b45309; }
      .jac-status-offered   { background: #dcfce7; color: #15803d; }
      .jac-status-rejected  { background: #fee2e2; color: #dc2626; }
      .jac-status-select {
        font-size: 11px;
        border: 1px solid #cbd5e1;
        border-radius: 4px;
        padding: 1px 4px;
        color: #334155;
        background: white;
        cursor: pointer;
      }
      .jac-app-link {
        font-size: 11px;
        color: #1e40af;
        text-decoration: none;
        flex-shrink: 0;
      }
      .jac-app-link:hover { text-decoration: underline; }
    `;
  }

  // ─── Sidebar HTML ─────────────────────────────────────────────────────────
  function getSidebarHTML(showFillBtn, jobDetailOnly) {
    const detailNotice = jobDetailOnly
      ? `<div class="jac-info">Browse to the application form to autofill your details.</div>`
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
        ${detailNotice}
        ${fillBtn}
        <div class="jac-results" id="jac-results" style="display:none"></div>
        <div class="jac-pipeline" id="jac-pipeline" style="display:none">
          <div class="jac-pipeline-title">Applications at this company</div>
          <div id="jac-pipeline-list"></div>
        </div>
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
  function injectSidebar(showFillBtn, jobDetailOnly) {
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
    container.innerHTML = getSidebarHTML(showFillBtn, jobDetailOnly);

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

    // ─── Pipeline: load applications at this company ────────────────────────
    const pipelineEl = shadow.getElementById('jac-pipeline');
    const pipelineListEl = shadow.getElementById('jac-pipeline-list');

    const STATUS_LABELS = {
      saved: 'Saved',
      applied: 'Applied',
      interviewing: 'Interviewing',
      offered: 'Offered',
      rejected: 'Rejected',
    };

    const ALL_STATUSES = ['saved', 'applied', 'interviewing', 'offered', 'rejected'];

    function renderPipeline(applications) {
      if (!applications || applications.length === 0) return;

      pipelineListEl.innerHTML = applications.map((app) => {
        const opts = ALL_STATUSES.map(
          (s) => `<option value="${s}"${s === app.status ? ' selected' : ''}>${STATUS_LABELS[s]}</option>`
        ).join('');
        return `
          <div class="jac-app-row" data-app-id="${app.id}">
            <span class="jac-app-role" title="${app.role}">${app.role}</span>
            <select class="jac-status-select" data-app-id="${app.id}">${opts}</select>
            <a class="jac-app-link" href="https://job-application-platform-lake.vercel.app/dashboard/applications" target="_blank">View →</a>
          </div>
        `;
      }).join('');

      pipelineListEl.querySelectorAll('.jac-status-select').forEach((sel) => {
        sel.addEventListener('change', (e) => {
          const appId = e.target.dataset.appId;
          const newStatus = e.target.value;
          chrome.runtime.sendMessage(
            { type: 'UPDATE_APPLICATION_STATUS', id: appId, status: newStatus },
            (resp) => {
              if (!resp?.success) {
                e.target.value = applications.find((a) => a.id === appId)?.status || newStatus;
              }
            }
          );
        });
      });

      pipelineEl.style.display = 'block';
    }

    (function loadPipeline() {
      const { company } = getJobInfo();
      if (!company) return;
      chrome.runtime.sendMessage({ type: 'GET_APPLICATIONS', company }, (resp) => {
        if (resp?.success && resp.applications?.length > 0) {
          renderPipeline(resp.applications);
        }
      });
    })();

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
            if (field.profileKey === null) {
              rows.push(
                `<div class="jac-field-row"><span class="jac-field-manual">—</span><span>${field.label}</span></div>`
              );
              continue;
            }

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
  // Application page: inject sidebar + wait for form via MutationObserver.
  // Job detail page: inject a save/draft widget only (no form present yet).

  let sidebarInjected = false;

  if (isJobDetailPage()) {
    // Job detail — save/draft only, no fill button
    injectSidebar(false, true);
    sidebarInjected = true;

  } else if (isApplicationPage()) {
    // Application form — show fill button when form is present
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
