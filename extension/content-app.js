(function () {
  function syncAuth() {
    const bridge = document.getElementById('ext-auth-bridge');
    if (!bridge) return;

    const accessToken = bridge.dataset.accessToken;
    const refreshToken = bridge.dataset.refreshToken;
    const expiresAt = parseInt(bridge.dataset.expiresAt || '0');
    const userId = bridge.dataset.userId;

    if (!accessToken || !refreshToken) return;

    chrome.runtime.sendMessage(
      {
        type: 'AUTH_SYNC',
        accessToken,
        refreshToken,
        expiresAt,
        userId,
      },
      (response) => {
        if (chrome.runtime.lastError) return; // extension not available
        console.log('[Job Copilot] Auth synced:', response);
      }
    );
  }

  // Sync on initial load
  syncAuth();

  // Sync after navigation (SPA — React may re-render the div)
  const observer = new MutationObserver(syncAuth);
  observer.observe(document.body, { childList: true, subtree: true });
})();
