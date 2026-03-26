import { getValidAccessToken, APP_URL } from './storage.js';

async function authFetch(path, options = {}) {
  const token = await getValidAccessToken();
  if (!token) throw new Error('NOT_AUTHENTICATED');

  const response = await fetch(`${APP_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
      ...(options.headers || {}),
    },
  });

  if (response.status === 401) {
    throw new Error('NOT_AUTHENTICATED');
  }

  return response;
}

export async function fetchProfile() {
  const res = await authFetch('/api/extension/profile');
  const data = await res.json();
  if (!data.success) throw new Error(data.error || 'Failed to fetch profile');
  return data.profile;
}

export async function saveJob(jobData) {
  const res = await authFetch('/api/extension/save-job', {
    method: 'POST',
    body: JSON.stringify(jobData),
  });
  return res.json();
}

export async function fetchFieldMappings(atsType) {
  const res = await authFetch(`/api/extension/field-mappings?ats_type=${atsType}`);
  const data = await res.json();
  return data.mappings || [];
}

export async function saveFieldMapping(mapping) {
  const res = await authFetch('/api/extension/field-mappings', {
    method: 'POST',
    body: JSON.stringify(mapping),
  });
  return res.json();
}
