(function () {
  'use strict';

  // ─── Constants ────────────────────────────────────────────────────────────
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const SELECTOR_VERSION = '2026-03-28'; // tracks last selector update date
  const APP_URL = 'https://job-application-platform-lake.vercel.app';
  const SIDEBAR_ROOT_ID = 'jac-li-sidebar-root';
  const TOAST_ID = 'jac-li-toast';

  // ─── Multi-selector querySelector helper ──────────────────────────────────
  // Takes an array of selectors, returns the first match
  function qs(selectors) {
    const list = Array.isArray(selectors) ? selectors : [selectors];
    for (const sel of list) {
      try {
        const el = document.querySelector(sel);
        if (el) return el;
      } catch { /* invalid selector, skip */ }
    }
    return null;
  }

  function qsText(selectors) {
    return qs(selectors)?.textContent?.trim() || '';
  }

  // ─── URL utilities ─────────────────────────────────────────────────────────
  const TRACKING_PARAMS = ['trk', 'trkInfo', 'refId', 'trackingId', 'lipi', 'licu', 'position', 'pageNum', 'originalSubdomain'];

  function cleanUrl(url) {
    try {
      const u = new URL(url);
      TRACKING_PARAMS.forEach(p => u.searchParams.delete(p));
      return u.toString();
    } catch {
      return url;
    }
  }

  function getPageType(url) {
    if (/\/jobs\/view\/\d+/.test(url)) return 'view';
    if (/\/jobs\/(search|collections)/.test(url)) return 'search';
    return null;
  }

  function getSelectedJobId(url) {
    try { return new URL(url).searchParams.get('currentJobId'); } catch { return null; }
  }

  // ─── Job data extraction from individual listing pages ────────────────────
  function extractJobData() {
    const title = qsText([
      'h1.job-details-jobs-unified-top-card__job-title',
      '.job-details-jobs-unified-top-card__job-title h1',
      '.job-details-jobs-unified-top-card__job-title',
      'h1[class*="job-title"]',
      '.topcard__title',
      'h1',
    ]);

    const company = qsText([
      '.job-details-jobs-unified-top-card__company-name a',
      '.job-details-jobs-unified-top-card__company-name',
      '.topcard__org-name-link',
      'a[data-tracking-control-name*="org-name"]',
    ]);

    const location = qsText([
      '.job-details-jobs-unified-top-card__bullet',
      '.topcard__flavor--bullet',
      '.jobs-unified-top-card__bullet',
    ]);

    // Salary — check dedicated salary elements, then scan insight bullets for currency patterns
    let salary = '';
    const salaryEl = qs(['.compensation__salary', '[class*="salary-range"]', '[class*="salary"]']);
    if (salaryEl) salary = salaryEl.textContent?.trim() || '';
    if (!salary) {
      for (const el of document.querySelectorAll(
        '.job-details-jobs-unified-top-card__job-insight span, .job-details-preferences-and-skills__pill'
      )) {
        const t = el.textContent?.trim() || '';
        if (/[\$€£¥]|\d+k|SEK|USD|EUR|GBP|salary|lön/i.test(t) && t.length < 80) {
          salary = t;
          break;
        }
      }
    }

    // Remote type — look for "Remote", "Hybrid", "On-site" text
    let remoteType = '';
    const workplaceEl = qs(['.job-details-jobs-unified-top-card__workplace-type', '[class*="workplace-type"]']);
    if (workplaceEl) remoteType = workplaceEl.textContent?.trim() || '';
    if (!remoteType) {
      for (const el of document.querySelectorAll(
        '.job-details-preferences-and-skills__pill, .job-details-jobs-unified-top-card__job-insight span'
      )) {
        const t = el.textContent?.trim() || '';
        if (/^(remote|hybrid|on.?site)$/i.test(t)) { remoteType = t; break; }
      }
    }

    // Description (may be truncated until "Show more" is clicked)
    const description = qsText([
      '.jobs-description__content .jobs-box__html-content',
      '.jobs-description__content',
      '#job-details',
      '.description__text',
    ]);

    // Skills — LinkedIn shows matched/unmatched skill pills
    const skills = [];
    document.querySelectorAll([
      '.job-details-how-you-match__skills-item-subtitle',
      '.job-details-skill-match-status-list__unqualified-skill',
      '.job-details-skill-match-status-list__qualified-skill',
      '[class*="skills-section"] li',
    ].join(', ')).forEach(el => {
      const t = el.textContent?.trim();
      if (t && !skills.includes(t)) skills.push(t);
    });

    // Posted date
    const postedDate = qsText([
      '.jobs-unified-top-card__posted-date',
      'time[datetime]',
      '[class*="posted-date"]',
    ]);

    // Applicant count
    let applicantCount = '';
    for (const el of document.querySelectorAll(
      '.jobs-unified-top-card__applicant-count, [class*="applicant-count"]'
    )) {
      const t = el.textContent?.trim() || '';
      if (/applicant/i.test(t)) { applicantCount = t; break; }
    }

    // Easy Apply — check if the apply button references "Easy Apply"
    const hasEasyApply = [...document.querySelectorAll(
      'button[aria-label*="Easy Apply"], .jobs-apply-button--top-card'
    )].some(el =>
      /easy apply/i.test(el.textContent || el.getAttribute('aria-label') || '')
    );

    return {
      title,
      company,
      location,
      salary,
      remoteType,
      description,
      skills,
      postedDate,
      applicantCount,
      hasEasyApply,
      url: cleanUrl(window.location.href),
      ats_type: 'linkedin',
    };
  }

  // ─── HTML escaping ─────────────────────────────────────────────────────────
  function esc(str) {
    return String(str || '')
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  // ─── Sidebar CSS (injected into ShadowDOM) ────────────────────────────────
  function getSidebarCSS() {
    return `
      * { box-sizing: border-box; margin: 0; padding: 0; }
      .jac-sidebar {
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        font-size: 13px; color: #0f172a; background: #ffffff;
        border: 1px solid #e2e8f0; border-right: none;
        border-radius: 8px 0 0 8px;
        box-shadow: -2px 4px 20px rgba(0,0,0,0.14);
        width: 280px; max-height: calc(100vh - 100px);
        display: flex; flex-direction: column;
        transition: width 0.2s ease;
      }
      .jac-sidebar.collapsed { width: 40px; overflow: hidden; }
      .jac-header {
        display: flex; align-items: center; gap: 8px;
        padding: 10px 12px; background: #1e40af; color: white;
        flex-shrink: 0; min-height: 40px;
      }
      .jac-sidebar.collapsed .jac-header {
        cursor: pointer; justify-content: center;
        padding: 12px 0; flex-direction: column; gap: 4px; min-height: 80px;
      }
      .jac-title { font-weight: 600; flex: 1; font-size: 13px; }
      .jac-ats-badge {
        font-size: 10px; background: rgba(255,255,255,0.2);
        padding: 2px 6px; border-radius: 10px; text-transform: uppercase; letter-spacing: 0.05em;
      }
      .jac-sidebar.collapsed .jac-title,
      .jac-sidebar.collapsed .jac-ats-badge,
      .jac-sidebar.collapsed #jac-close-btn,
      .jac-sidebar.collapsed #jac-collapse-btn { display: none; }
      .jac-close, .jac-collapse {
        background: none; border: none; color: white;
        cursor: pointer; padding: 4px; opacity: 0.7; font-size: 13px; line-height: 1; flex-shrink: 0;
      }
      .jac-close:hover, .jac-collapse:hover { opacity: 1; }
      .jac-body { padding: 12px; display: flex; flex-direction: column; gap: 10px; overflow-y: auto; }
      .jac-sidebar.collapsed .jac-body { display: none; }
      .jac-job-info { padding-bottom: 10px; border-bottom: 1px solid #e2e8f0; }
      .jac-job-title { font-weight: 600; font-size: 13px; line-height: 1.35; color: #0f172a; margin-bottom: 3px; }
      .jac-job-company { color: #1e40af; font-weight: 500; font-size: 12px; }
      .jac-job-meta { color: #64748b; font-size: 11px; margin-top: 2px; }
      .jac-badges { display: flex; gap: 4px; flex-wrap: wrap; margin-top: 6px; }
      .jac-badge {
        font-size: 10px; padding: 2px 6px; border-radius: 10px;
        border: 1px solid #e2e8f0; color: #475569; background: #f8fafc; white-space: nowrap;
      }
      .jac-badge-green { background: #f0fdf4; border-color: #bbf7d0; color: #166534; }
      .jac-status { font-size: 11px; padding: 4px 8px; border-radius: 4px; text-align: center; }
      .jac-status-ok { background: #f0fdf4; color: #16a34a; }
      .jac-status-warn { background: #fefce8; color: #854d0e; }
      .jac-match {
        font-size: 12px; padding: 6px 8px; border-radius: 6px;
        background: #f0f9ff; color: #0369a1; border: 1px solid #bae6fd;
      }
      .jac-btn {
        width: 100%; padding: 8px 12px; border-radius: 6px; border: none;
        cursor: pointer; font-size: 13px; font-weight: 500; text-align: left; line-height: 1.4;
      }
      .jac-btn:disabled { opacity: 0.5; cursor: default; }
      .jac-btn-primary { background: #1e40af; color: white; }
      .jac-btn-primary:hover:not(:disabled) { background: #1e3a8a; }
      .jac-btn-secondary { background: #f1f5f9; color: #334155; border: 1px solid #e2e8f0; }
      .jac-btn-secondary:hover:not(:disabled) { background: #e2e8f0; }
      .jac-btn-studio { background: #5347CE; color: white; font-size: 14px; padding: 10px 12px; }
      .jac-btn-studio:hover:not(:disabled) { background: #4338a8; }
      .jac-divider { border: none; border-top: 1px solid #e2e8f0; }
      .jac-label { font-size: 11px; font-weight: 600; color: #64748b; text-transform: uppercase; letter-spacing: 0.05em; }
      .jac-textarea {
        width: 100%; height: 64px; padding: 6px 8px;
        border: 1px solid #e2e8f0; border-radius: 6px;
        font-size: 12px; font-family: inherit; color: #334155; resize: none; outline: none;
      }
      .jac-textarea:focus { border-color: #1e40af; }
    `;
  }

  // ─── Sidebar HTML ──────────────────────────────────────────────────────────
  function getSidebarHTML(jobData) {
    const { title, company, location, salary, remoteType, hasEasyApply } = jobData;
    const meta = [location, salary].filter(Boolean).join(' · ');
    let badges = '';
    if (remoteType) badges += `<span class="jac-badge">${esc(remoteType)}</span>`;
    if (hasEasyApply) badges += `<span class="jac-badge jac-badge-green">⚡ Easy Apply</span>`;

    return `
      <div class="jac-header">
        <span>💼</span>
        <span class="jac-title">Job Copilot</span>
        <span class="jac-ats-badge">LinkedIn</span>
        <button class="jac-collapse" id="jac-collapse-btn" title="Minimize">−</button>
        <button class="jac-close" id="jac-close-btn" title="Close">✕</button>
      </div>
      <div class="jac-body">
        <div class="jac-job-info">
          <div class="jac-job-title">${esc(title || 'Job Listing')}</div>
          ${company ? `<div class="jac-job-company">${esc(company)}</div>` : ''}
          ${meta ? `<div class="jac-job-meta">${esc(meta)}</div>` : ''}
          ${badges ? `<div class="jac-badges">${badges}</div>` : ''}
        </div>
        <div class="jac-status jac-status-warn" id="jac-auth-status">Checking…</div>
        <div id="jac-match-area"></div>
        <button class="jac-btn jac-btn-studio" id="jac-studio-btn">✨ Generate Application Package</button>
        <button class="jac-btn jac-btn-primary" id="jac-draft-btn">📋 Open Draft Wizard</button>
        <button class="jac-btn jac-btn-secondary" id="jac-save-btn">💾 Save to Tracker</button>
        <hr class="jac-divider">
        <div class="jac-label">Quick Notes</div>
        <textarea class="jac-textarea" id="jac-notes" placeholder="Add notes about this role…"></textarea>
      </div>
    `;
  }

  // ─── Inject sidebar (ShadowDOM, job view pages only) ──────────────────────
  function injectSidebar(jobData) {
    removeSidebar();

    const host = document.createElement('div');
    host.id = SIDEBAR_ROOT_ID;
    host.style.cssText = 'position:fixed;top:80px;right:0;z-index:2147483647;';
    document.body.appendChild(host);

    const shadow = host.attachShadow({ mode: 'open' });

    const style = document.createElement('style');
    style.textContent = getSidebarCSS();

    const container = document.createElement('div');
    container.className = 'jac-sidebar';
    container.innerHTML = getSidebarHTML(jobData);

    shadow.appendChild(style);
    shadow.appendChild(container);

    bindSidebarEvents(shadow, container, jobData);
    checkAuthAndScore(shadow, jobData);
  }

  function removeSidebar() {
    document.getElementById(SIDEBAR_ROOT_ID)?.remove();
  }

  // ─── Sidebar event bindings ────────────────────────────────────────────────
  function bindSidebarEvents(shadow, container, jobData) {
    shadow.getElementById('jac-close-btn').addEventListener('click', (e) => {
      e.stopPropagation();
      document.getElementById(SIDEBAR_ROOT_ID)?.remove();
    });

    shadow.getElementById('jac-collapse-btn').addEventListener('click', (e) => {
      e.stopPropagation();
      container.classList.add('collapsed');
    });

    // Expand on click when collapsed
    container.addEventListener('click', () => {
      if (container.classList.contains('collapsed')) {
        container.classList.remove('collapsed');
      }
    });

    shadow.getElementById('jac-studio-btn').addEventListener('click', () => {
      const studioBtn = shadow.getElementById('jac-studio-btn');
      studioBtn.disabled = true;
      studioBtn.textContent = '⏳ Saving…';

      const job = {
        title: jobData.title,
        company: jobData.company,
        url: jobData.url,
        location: jobData.location,
        description: jobData.description,
        ats_type: 'linkedin',
      };

      chrome.runtime.sendMessage({ type: 'SAVE_JOB', job }, (response) => {
        if (response?.success && response?.jobListingId) {
          studioBtn.textContent = '✨ Opening Application Studio…';
          chrome.runtime.sendMessage({
            type: 'OPEN_TAB',
            url: `${APP_URL}/dashboard/application-studio?job=${response.jobListingId}`,
          });
        } else if (response?.success) {
          // Saved but no jobListingId — fall back to studio without prefill
          studioBtn.textContent = '✨ Opening Application Studio…';
          chrome.runtime.sendMessage({ type: 'OPEN_TAB', url: `${APP_URL}/dashboard/application-studio` });
        } else {
          studioBtn.disabled = false;
          studioBtn.textContent = '✗ Error — not connected?';
        }
      });
    });

    shadow.getElementById('jac-draft-btn').addEventListener('click', () => {
      const params = new URLSearchParams({
        company: jobData.company || '',
        role: jobData.title || '',
        jobDescription: (jobData.description || '').slice(0, 6000),
      });
      chrome.runtime.sendMessage({ type: 'OPEN_TAB', url: `${APP_URL}/dashboard/draft?${params}` });
    });

    shadow.getElementById('jac-save-btn').addEventListener('click', () => {
      const notes = shadow.getElementById('jac-notes').value.trim();
      const saveBtn = shadow.getElementById('jac-save-btn');
      saveBtn.disabled = true;
      saveBtn.textContent = '⏳ Saving…';

      const job = {
        title: jobData.title,
        company: jobData.company,
        url: jobData.url,
        location: jobData.location,
        description: jobData.description,
        ats_type: 'linkedin',
      };
      if (notes) job.notes = notes;

      chrome.runtime.sendMessage({ type: 'SAVE_JOB', job }, (response) => {
        saveBtn.disabled = false;
        if (response?.success) {
          saveBtn.textContent = response.alreadySaved ? '✓ Already saved' : '✓ Saved to Tracker';
        } else {
          saveBtn.textContent = '✗ Error — not connected?';
        }
      });
    });
  }

  // ─── Auth check + match score ──────────────────────────────────────────────
  function checkAuthAndScore(shadow, jobData) {
    const authEl = shadow.getElementById('jac-auth-status');
    const matchArea = shadow.getElementById('jac-match-area');

    chrome.runtime.sendMessage({ type: 'GET_AUTH_STATUS' }, (authResp) => {
      if (authResp?.authenticated) {
        authEl.textContent = 'Connected ✓';
        authEl.className = 'jac-status jac-status-ok';

        chrome.runtime.sendMessage({ type: 'GET_PROFILE' }, (profileResp) => {
          if (!profileResp?.success) return;
          const score = computeMatchScore(profileResp.profile, jobData);
          if (score > 0) {
            matchArea.innerHTML = `<div class="jac-match">Match score: <strong>${score}%</strong> — skills overlap</div>`;
          }
        });
      } else {
        authEl.textContent = 'Not connected — visit app to sync';
        authEl.className = 'jac-status jac-status-warn';
      }
    });
  }

  function computeMatchScore(profile, jobData) {
    if (!profile) return 0;
    const profileSkills = [
      ...(Array.isArray(profile.skills) ? profile.skills : []),
      ...(Array.isArray(profile.tech_skills) ? profile.tech_skills : []),
    ].map(s => String(s).toLowerCase());

    if (profileSkills.length === 0) return 0;

    const jobText = [jobData.description || '', ...(jobData.skills || [])].join(' ').toLowerCase();
    const matches = profileSkills.filter(s => jobText.includes(s));
    return Math.min(100, Math.round((matches.length / Math.min(profileSkills.length, 20)) * 100));
  }

  // ─── Toast notification (bottom-left, avoids LinkedIn's own toasts) ────────
  function showToast(message) {
    document.getElementById(TOAST_ID)?.remove();
    const toast = document.createElement('div');
    toast.id = TOAST_ID;
    toast.style.cssText = [
      'position:fixed', 'bottom:24px', 'left:24px', 'z-index:2147483647',
      'background:#166534', 'color:white', 'padding:10px 16px', 'border-radius:8px',
      'font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif',
      'font-size:13px', 'font-weight:500', 'box-shadow:0 4px 16px rgba(0,0,0,0.2)', 'max-width:320px',
    ].join(';');
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 4000);
  }

  // ─── Easy Apply completion detection ──────────────────────────────────────
  // Watches for the Easy Apply success screen and auto-saves with status 'applied'
  let easyApplyApplied = false;

  new MutationObserver(() => {
    if (easyApplyApplied) return;

    const modal = document.querySelector([
      '[data-test-modal-id="easy-apply-modal"]',
      '.jobs-easy-apply-modal',
      'div[role="dialog"][aria-label*="apply" i]',
      '[class*="easy-apply-modal"]',
    ].join(', '));
    if (!modal) return;

    const text = modal.textContent || '';
    if (/your application was sent|application submitted|you applied|successfully applied/i.test(text)) {
      easyApplyApplied = true;
      const jobData = extractJobData();

      chrome.runtime.sendMessage(
        {
          type: 'SAVE_JOB',
          job: {
            title: jobData.title,
            company: jobData.company,
            url: jobData.url,
            location: jobData.location,
            description: jobData.description,
            ats_type: 'linkedin',
            status: 'applied',
          },
        },
        (response) => {
          if (response?.success && !response.alreadySaved) {
            showToast(`✓ Saved to your tracker — Applied at ${jobData.company || 'company'}`);
          }
        }
      );

      // Reset after delay so user can apply to another job on same page
      setTimeout(() => { easyApplyApplied = false; }, 15000);
    }
  }).observe(document.body, { childList: true, subtree: true });

  // ─── Search results: per-card save buttons ─────────────────────────────────
  const CARD_SELECTORS = '.job-card-container, .jobs-job-board-list__item, li[data-occludable-job-id]';

  function extractCardData(card) {
    const title = (
      card.querySelector('.job-card-list__title strong, .job-card-list__title') ||
      card.querySelector('.job-card-container__link strong, strong, h3')
    )?.textContent?.trim() || '';

    const company = card.querySelector(
      '.job-card-container__company-name, .artdeco-entity-lockup__subtitle span, [class*="company-name"]'
    )?.textContent?.trim() || '';

    const jobLink = card.querySelector('a[href*="/jobs/view/"]');
    const url = jobLink ? cleanUrl(jobLink.href) : '';

    const location = card.querySelector(
      '.job-card-container__metadata-wrapper li, .artdeco-entity-lockup__caption li'
    )?.textContent?.trim() || '';

    return { title, company, url, location, ats_type: 'linkedin' };
  }

  function injectCardSaveButton(card) {
    if (card.dataset.jacInjected) return;
    card.dataset.jacInjected = '1';

    const pos = getComputedStyle(card).position;
    if (pos === 'static') card.style.position = 'relative';

    const btn = document.createElement('button');
    btn.innerHTML = '💾';
    btn.title = 'Save to Job Copilot';
    btn.style.cssText = [
      'position:absolute', 'top:8px', 'right:8px', 'z-index:10',
      'width:28px', 'height:28px', 'border-radius:50%',
      'border:1px solid #e2e8f0', 'background:rgba(255,255,255,0.95)',
      'cursor:pointer', 'font-size:14px', 'line-height:1',
      'display:flex', 'align-items:center', 'justify-content:center',
      'opacity:0', 'transition:opacity 0.15s',
      'box-shadow:0 1px 4px rgba(0,0,0,0.1)', 'padding:0',
    ].join(';');

    card.addEventListener('mouseenter', () => { btn.style.opacity = '1'; });
    card.addEventListener('mouseleave', () => { btn.style.opacity = '0'; });

    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const data = extractCardData(card);
      if (!data.url) return;

      btn.innerHTML = '⏳';
      chrome.runtime.sendMessage({ type: 'SAVE_JOB', job: data }, (response) => {
        if (response?.success) {
          btn.innerHTML = '✓';
          btn.style.background = '#f0fdf4';
          btn.style.borderColor = '#86efac';
        } else {
          btn.innerHTML = '✗';
        }
        setTimeout(() => {
          btn.innerHTML = '💾';
          btn.style.background = 'rgba(255,255,255,0.95)';
          btn.style.borderColor = '#e2e8f0';
        }, 2000);
      });
    });

    card.appendChild(btn);
  }

  let searchCardObserver = null;

  function setupSearchCards() {
    // Inject on existing cards
    document.querySelectorAll(CARD_SELECTORS).forEach(injectCardSaveButton);

    searchCardObserver?.disconnect();
    const listEl = document.querySelector(
      '.jobs-search-results-list, .jobs-search__results-list, [class*="jobs-search-results"]'
    ) || document.body;

    // Watch for new cards (infinite scroll)
    searchCardObserver = new MutationObserver((mutations) => {
      for (const m of mutations) {
        for (const node of m.addedNodes) {
          if (node.nodeType !== 1) continue;
          if (node.matches && node.matches(CARD_SELECTORS)) {
            injectCardSaveButton(node);
          } else if (node.querySelectorAll) {
            node.querySelectorAll(CARD_SELECTORS).forEach(card => {
              if (!card.dataset.jacInjected) injectCardSaveButton(card);
            });
          }
        }
      }
    });
    searchCardObserver.observe(listEl, { childList: true, subtree: true });
  }

  function teardownSearchCards() {
    searchCardObserver?.disconnect();
    searchCardObserver = null;
    document.querySelectorAll('[data-jac-injected]').forEach(el => {
      delete el.dataset.jacInjected;
      el.querySelector('button[title="Save to Job Copilot"]')?.remove();
    });
  }

  // ─── SPA navigation handling ───────────────────────────────────────────────
  let currentUrl = location.href;
  let navTimer = null;

  function handleNavigation() {
    const url = location.href;
    const type = getPageType(url);

    if (type === 'view') {
      teardownSearchCards();
      // Delay extraction to let LinkedIn render the job details panel
      setTimeout(() => {
        const data = extractJobData();
        if (data.title || data.company) {
          injectSidebar(data);
        } else {
          // Retry once after a longer delay for slow page loads
          setTimeout(() => {
            const retry = extractJobData();
            if (retry.title || retry.company) injectSidebar(retry);
          }, 1500);
        }
      }, 600);
    } else if (type === 'search') {
      removeSidebar();
      setTimeout(() => {
        setupSearchCards();
        // If a job is selected (right panel open), also show the sidebar
        const jobId = getSelectedJobId(url);
        if (jobId) {
          setTimeout(() => {
            const data = extractJobData();
            if (data.title || data.company) injectSidebar(data);
          }, 800);
        }
      }, 600);
    } else {
      removeSidebar();
      teardownSearchCards();
    }

    easyApplyApplied = false;
  }

  function onUrlMaybeChanged() {
    if (location.href === currentUrl) return;
    currentUrl = location.href;
    clearTimeout(navTimer);
    navTimer = setTimeout(handleNavigation, 300);
  }

  // MutationObserver on document for SPA URL changes (LinkedIn rewrites history without reloading)
  new MutationObserver(onUrlMaybeChanged).observe(document, { childList: true, subtree: true });
  window.addEventListener('popstate', onUrlMaybeChanged);
  // Navigation API (Chrome 102+)
  if (typeof navigation !== 'undefined' && navigation.addEventListener) {
    navigation.addEventListener('navigate', onUrlMaybeChanged);
  }

  // ─── Initial render ────────────────────────────────────────────────────────
  handleNavigation();
})();
