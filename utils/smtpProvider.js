// Auto-detects host/port/secure settings for common providers from the
// email domain, so the frontend only has to ask for email + password.

const PRESETS = {
  'gmail.com': { host: 'smtp.gmail.com', port: 465, secure: true },
  'googlemail.com': { host: 'smtp.gmail.com', port: 465, secure: true },
  'outlook.com': { host: 'smtp.office365.com', port: 587, secure: false },
  'hotmail.com': { host: 'smtp.office365.com', port: 587, secure: false },
  'live.com': { host: 'smtp.office365.com', port: 587, secure: false },
  'office365.com': { host: 'smtp.office365.com', port: 587, secure: false },
  'yahoo.com': { host: 'smtp.mail.yahoo.com', port: 465, secure: true },
  'yahoo.co.uk': { host: 'smtp.mail.yahoo.com', port: 465, secure: true },
  'zoho.com': { host: 'smtp.zoho.com', port: 465, secure: true },
  'icloud.com': { host: 'smtp.mail.me.com', port: 587, secure: false },
  'me.com': { host: 'smtp.mail.me.com', port: 587, secure: false },
};

/**
 * @param {string} email
 * @returns {{host: string, port: number, secure: boolean}}
 */
function detectSmtpConfig(email) {
  const domain = String(email).split('@')[1]?.toLowerCase().trim() || '';
  if (PRESETS[domain]) return { ...PRESETS[domain] };

  // Best-effort guess for a company/custom domain — many providers
  // (Zoho, Google Workspace aliases, self-hosted mail, etc.) follow this
  // smtp.<domain> convention. If verification fails, the user just sees
  // "Verification Failed" and can try again with a different account.
  return { host: `smtp.${domain}`, port: 587, secure: false };
}

module.exports = { detectSmtpConfig };
