(async function () {
  // ─── ATS detection ───────────────────────────────────────────────────────
  function isTeamtailorPage() {
    return !!(
      document.querySelector('link[href*="teamtailor"]') ||
      document.querySelector('script[src*="teamtailor"]')
    );
  }

  function isTeamtailorJobPage() {
    return isTeamtailorPage() && /\/jobs\/\d+/.test(window.location.pathname);
  }

  function isTeamtailorApplicationFormPresent() {
    return !!document.getElementById('job-application-form');
  }

  // Early exit — not Teamtailor
  if (!isTeamtailorPage()) return;

  // Early exit — not a job detail page
  if (!isTeamtailorJobPage()) return;

  const atsType = 'teamtailor';

  // ─── Field map ────────────────────────────────────────────────────────────
  const TEAMTAILOR_FIELDS = [
    { selector: '#candidate_first_name', profileKey: 'first_name' },
    { selector: '#candidate_last_name',  profileKey: 'last_name' },
    { selector: '#candidate_email',      profileKey: 'email' },
    { selector: '#candidate_phone',      profileKey: 'phone' },
    { selector: '#candidate_job_applications_attributes_0_cover_letter', profileKey: 'cover_letter' },
  ];

  function detectFields(userMappings = []) {
    return TEAMTAILOR_FIELDS.flatMap((fm) => {
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

  function fillField(element, value) {
    if (!element || value == null) return false;
    element.focus();
    element.value = value;
    element.dispatchEvent(new Event('input', { bubbles: true }));
    element.dispatchEvent(new Event('change', { bubbles: true }));
    element.blur();
    return true;
  }

  // ─── Job info ─────────────────────────────────────────────────────────────
  function getJobInfo() {
    const title = document.querySelector('h1')?.textContent?.trim() || '';
    const company =
      document.querySelector('meta[property="og:site_name"]')?.content ||
      document.querySelector('.career-site-logo img, header img')?.alt ||
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
  function getSidebarHTML() {
    return `
      <div class="jac-header">
        <span>💼</span>
        <span class="jac-title">Job Copilot</span>
        <span class="jac-ats-badge">${atsType}</span>
        <button class="jac-close" id="jac-close-btn" title="Close">✕</button>
      </div>
      <div class="jac-body">
        <div class="jac-status" id="jac-status">Ready</div>

        <button class="jac-btn jac-btn-primary" id="jac-fill-btn">
          Fill from Profile
        </button>

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
  function injectSidebar() {
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
    container.innerHTML = getSidebarHTML();

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

        // Get user-corrected mappings
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
          statusEl.textContent = 'No fillable fields detected on this page';
          return;
        }

        const rows = [];
        let filledCount = 0;

        for (const field of fields) {
          const value = profile[field.profileKey];

          // Detect file upload fields — can't fill these
          if (field.element.type === 'file') {
            rows.push(
              `<div class="jac-field-row"><span class="jac-field-manual">—</span><span>${field.label} (manual: file upload)</span></div>`
            );
            continue;
          }

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
              `<div class="jac-field-row"><span class="jac-field-skip">—</span><span>${field.label} (no data)</span></div>`
            );
          }
        }

        statusEl.textContent = `Filled ${filledCount} of ${fields.length} fields`;
        resultsEl.innerHTML = rows.join('');
        resultsEl.style.display = 'block';
      });
    });

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
          job: { title, company, url: window.location.href, description, ats_type: atsType },
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

  // ─── MutationObserver — watch for form appearing/disappearing ─────────────
  let sidebarInjected = false;

  const observer = new MutationObserver(() => {
    const formPresent = isTeamtailorApplicationFormPresent();
    if (formPresent && !sidebarInjected) {
      injectSidebar();
      sidebarInjected = true;
    } else if (!formPresent && sidebarInjected) {
      document.getElementById('jac-ext-root')?.remove();
      sidebarInjected = false;
    }
  });

  observer.observe(document.body, { childList: true, subtree: true });

  // Also check immediately in case form is already open on load
  if (isTeamtailorApplicationFormPresent()) {
    injectSidebar();
    sidebarInjected = true;
  }
})();
