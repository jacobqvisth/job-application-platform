(function () {
  const url = window.location.href;

  // Only on LinkedIn job listing pages (not the Easy Apply modal)
  if (
    !url.includes('linkedin.com/jobs/view/') &&
    !url.includes('linkedin.com/jobs/search/')
  ) {
    return;
  }

  function getLinkedInJobInfo() {
    const title =
      document.querySelector(
        '.job-details-jobs-unified-top-card__job-title, h1.topcard__title'
      )?.textContent?.trim() || '';
    const company =
      document.querySelector(
        '.job-details-jobs-unified-top-card__company-name, .topcard__org-name-link'
      )?.textContent?.trim() || '';
    // Description may be truncated until "Show more" is clicked
    const description =
      document.querySelector('.jobs-description__content, .description__text')?.textContent?.trim() ||
      '';
    return { title, company, description };
  }

  // Small floating badge — not a full sidebar (less intrusive on LinkedIn)
  const badge = document.createElement('div');
  badge.id = 'jac-linkedin-badge';
  badge.style.cssText = [
    'position:fixed',
    'bottom:24px',
    'right:24px',
    'z-index:2147483647',
    'background:#1e40af',
    'color:white',
    'border-radius:8px',
    'padding:10px 14px',
    'font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif',
    'font-size:13px',
    'box-shadow:0 4px 16px rgba(0,0,0,0.2)',
    'display:flex',
    'flex-direction:column',
    'gap:6px',
    'min-width:200px',
  ].join(';');

  badge.innerHTML = `
    <div style="font-weight:600;display:flex;align-items:center;gap:6px;">
      💼 Job Copilot
      <button id="jac-li-close" style="margin-left:auto;background:none;border:none;color:white;cursor:pointer;opacity:0.7;font-size:14px;">✕</button>
    </div>
    <button id="jac-li-draft" style="background:rgba(255,255,255,0.15);border:none;color:white;padding:6px 10px;border-radius:5px;cursor:pointer;font-size:12px;text-align:left;">
      📋 Open Draft Wizard
    </button>
    <button id="jac-li-save" style="background:rgba(255,255,255,0.15);border:none;color:white;padding:6px 10px;border-radius:5px;cursor:pointer;font-size:12px;text-align:left;">
      💾 Save to Tracker
    </button>
  `;

  document.body.appendChild(badge);

  document.getElementById('jac-li-close').onclick = () => badge.remove();

  document.getElementById('jac-li-draft').onclick = () => {
    const { title, company, description } = getLinkedInJobInfo();
    const params = new URLSearchParams({
      company: company || '',
      role: title || '',
      jobDescription: description.slice(0, 6000),
    });
    chrome.runtime.sendMessage({
      type: 'OPEN_TAB',
      url: `https://job-application-platform-lake.vercel.app/dashboard/draft?${params}`,
    });
  };

  document.getElementById('jac-li-save').onclick = () => {
    const { title, company, description } = getLinkedInJobInfo();
    const btn = document.getElementById('jac-li-save');
    btn.textContent = '⏳ Saving...';
    chrome.runtime.sendMessage(
      {
        type: 'SAVE_JOB',
        job: {
          title,
          company,
          url: window.location.href,
          description,
          ats_type: 'linkedin',
        },
      },
      (response) => {
        if (response?.success) {
          btn.textContent = response.alreadySaved ? '✓ Already saved' : '✓ Saved';
        } else {
          btn.textContent = '✗ Error — not connected?';
        }
      }
    );
  };
})();
