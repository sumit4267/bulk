const { deriveNameFromEmail, deriveCompanyFromEmail } = require('./enrichment');

const EMAIL_RE = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

/**
 * Strips characters that could be used for SMTP header injection
 * (CRLF injection into To/Subject/From headers).
 */
function stripHeaderInjection(str = '') {
  return String(str).replace(/[\r\n]+/g, ' ').trim();
}

/**
 * Accepts raw textarea input where each line is either:
 *   hr@company.com
 *   hr@company.com, Jane Doe
 *   hr@company.com, Jane Doe, Acme Corp
 * Returns { valid: [{email,name,company}], invalid: [rawLine] }
 */
function parseRecipients(rawText, maxRecipients = 1000) {
  const lines = String(rawText || '')
    .split(/\r?\n|,(?=\s*[\w.+-]+@)/g) // split on newline, or comma-before-next-email (fallback)
    .map((l) => l.trim())
    .filter(Boolean);

  // Better: re-split properly by newline primarily, since commas are used for name/company too
  const rows = String(rawText || '')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  const seen = new Set();
  const valid = [];
  const invalid = [];

  for (const row of rows) {
    const parts = row.split(',').map((p) => stripHeaderInjection(p));
    const email = (parts[0] || '').toLowerCase();
    let name = parts[1] || '';
    let company = parts[2] || '';

    if (!EMAIL_RE.test(email)) {
      invalid.push(row);
      continue;
    }
    if (seen.has(email)) continue; // silently dedupe
    seen.add(email);

    // Auto-detect name/company from the email address whenever the
    // manifest row didn't explicitly supply them (e.g. plain email-only
    // lists, or CSV/Excel uploads with just an email column).
    if (!name.trim()) {
      name = deriveNameFromEmail(email) || '';
    }
    if (!company.trim()) {
      company = deriveCompanyFromEmail(email) || '';
    }

    valid.push({ email, name, company });

    if (valid.length >= maxRecipients) break;
  }

  return { valid, invalid, totalUnique: valid.length };
}

/**
 * Replaces {{name}}, {{company}}, {{email}} placeholders in a template
 * with per-recipient values. Falls back to sensible defaults so every
 * email still reads naturally even when name/company weren't supplied.
 */
function renderTemplate(template, recipient) {
  const name = recipient.name && recipient.name.trim() ? recipient.name.trim() : 'Hiring Manager';
  const company = recipient.company && recipient.company.trim() ? recipient.company.trim() : 'your organization';
  return String(template || '')
    .replace(/\{\{\s*(hr_?name|name)\s*\}\}/gi, name)
    .replace(/\{\{\s*(company_?name|company)\s*\}\}/gi, company)
    .replace(/\{\{\s*email\s*\}\}/gi, recipient.email);
}

module.exports = { parseRecipients, renderTemplate, stripHeaderInjection, EMAIL_RE };
