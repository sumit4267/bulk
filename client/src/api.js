// Thin wrappers around the existing Express API — endpoints and payloads
// are unchanged from the original server; only the calling code moved.

async function asJson(res) {
  const data = await res.json().catch(() => ({}));
  if (!res.ok && !('verified' in data)) {
    // Most endpoints throw on non-2xx; smtp/verify intentionally returns
    // 200 with { verified: false, ... } so it's excluded here.
    throw new Error(data.error || (data.errors && data.errors[0]?.msg) || 'Request failed.');
  }
  return data;
}

export const api = {
  health: () => fetch('/health').then(asJson),

  smtpStatus: () => fetch('/api/smtp-status').then(asJson),

  smtpVerify: (email, password) =>
    fetch('/api/smtp/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    }).then((r) => r.json()),

  smtpLogout: () => fetch('/api/smtp/logout', { method: 'POST' }).then(asJson),

  uploadResume: (file) => {
    const fd = new FormData();
    fd.append('resume', file);
    return fetch('/api/upload-resume', { method: 'POST', body: fd }).then(asJson);
  },

  uploadRecipientsFile: (file) => {
    const fd = new FormData();
    fd.append('recipientsFile', file);
    return fetch('/api/upload-recipients', { method: 'POST', body: fd }).then(asJson);
  },

  previewRecipients: (recipients) =>
    fetch('/api/preview-recipients', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ recipients }),
    }).then(asJson),

  previewEmail: (subject, body) =>
    fetch('/api/preview-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ subject, body }),
    }).then(asJson),

  startCampaign: (payload) =>
    fetch('/api/campaign/start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }).then(asJson),

  campaignStatus: (jobId) => fetch(`/api/campaign/${jobId}/status`).then(asJson),

  cancelCampaign: (jobId) => fetch(`/api/campaign/${jobId}/cancel`, { method: 'POST' }).then(asJson),
};
