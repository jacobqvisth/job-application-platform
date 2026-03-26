const STORAGE_KEY = 'ext_auth';
const APP_URL = 'https://job-application-platform-lake.vercel.app';
const SUPABASE_URL = 'https://gvfixrxpwmdslsiftmtv.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd2Zml4cnhwd21kc2xzaWZ0bXR2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ0NDg2OTAsImV4cCI6MjA5MDAyNDY5MH0.Rkx2NqAO1ZiiHPLKzRaT0LfxaCANWnZKmH2b0Q2490o';

export async function getStoredAuth() {
  return new Promise((resolve) => {
    chrome.storage.local.get(STORAGE_KEY, (result) => {
      resolve(result[STORAGE_KEY] || null);
    });
  });
}

export async function setStoredAuth(auth) {
  return new Promise((resolve) => {
    chrome.storage.local.set({ [STORAGE_KEY]: auth }, resolve);
  });
}

export async function clearStoredAuth() {
  return new Promise((resolve) => {
    chrome.storage.local.remove(STORAGE_KEY, resolve);
  });
}

// Returns a valid access token, refreshing if expired
export async function getValidAccessToken() {
  const auth = await getStoredAuth();
  if (!auth) return null;

  const now = Math.floor(Date.now() / 1000);

  // Refresh if token expires within 5 minutes
  if (auth.expiresAt && auth.expiresAt - now < 300) {
    return await refreshToken(auth.refreshToken);
  }

  return auth.accessToken;
}

async function refreshToken(refreshToken) {
  try {
    const response = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_ANON_KEY,
      },
      body: JSON.stringify({ refresh_token: refreshToken }),
    });

    if (!response.ok) {
      await clearStoredAuth();
      return null;
    }

    const data = await response.json();
    const auth = {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt: Math.floor(Date.now() / 1000) + data.expires_in,
      userId: data.user?.id,
    };
    await setStoredAuth(auth);
    return auth.accessToken;
  } catch {
    return null;
  }
}

export { APP_URL };
