import { getStoredAuth, setStoredAuth, clearStoredAuth, getValidAccessToken } from './lib/storage.js';
import { fetchProfile, saveJob, fetchFieldMappings, saveFieldMapping } from './lib/api.js';

// Message handler — all extension communication goes through here
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  handleMessage(message, sender)
    .then(sendResponse)
    .catch((err) => sendResponse({ success: false, error: err.message }));
  return true; // keep channel open for async response
});

async function handleMessage(message) {
  switch (message.type) {
    case 'AUTH_SYNC':
      // Called by content-app.js when it detects the auth bridge div
      await setStoredAuth({
        accessToken: message.accessToken,
        refreshToken: message.refreshToken,
        expiresAt: message.expiresAt,
        userId: message.userId,
      });
      return { success: true };

    case 'GET_AUTH_STATUS': {
      const auth = await getStoredAuth();
      if (!auth) return { authenticated: false };
      const token = await getValidAccessToken();
      return { authenticated: !!token, userId: auth.userId };
    }

    case 'GET_PROFILE': {
      const profile = await fetchProfile();
      return { success: true, profile };
    }

    case 'SAVE_JOB':
      return await saveJob(message.job);

    case 'GET_FIELD_MAPPINGS': {
      const mappings = await fetchFieldMappings(message.atsType);
      return { success: true, mappings };
    }

    case 'SAVE_FIELD_MAPPING':
      return await saveFieldMapping(message.mapping);

    case 'OPEN_TAB':
      chrome.tabs.create({ url: message.url });
      return { success: true };

    case 'SIGN_OUT':
      await clearStoredAuth();
      return { success: true };

    default:
      return { success: false, error: `Unknown message type: ${message.type}` };
  }
}
