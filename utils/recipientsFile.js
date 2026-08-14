const XLSX = require('xlsx');

/**
 * Parses an uploaded CSV/XLS/XLSX buffer into the same
 * "email, name, company" line format the manifest textarea already
 * accepts, so it can be fed straight into parseRecipients().
 *
 * Handles:
 *  - Files with a header row containing an "email" column (and
 *    optional "name"/"company" columns) — any column order.
 *  - Headerless files where the first column (or first column that
 *    contains an "@") is treated as the email column.
 */
function parseRecipientsFile(buffer, originalName = '') {
  let workbook;
  try {
    workbook = XLSX.read(buffer, { type: 'buffer' });
  } catch (err) {
    throw new Error('Could not read file — make sure it is a valid CSV or Excel file.');
  }

  const sheetName = workbook.SheetNames[0];
  if (!sheetName) throw new Error('The file has no sheets/rows.');
  const sheet = workbook.Sheets[sheetName];

  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '', blankrows: false });
  if (!rows.length) throw new Error('The file appears to be empty.');

  const normalizedHeader = rows[0].map((c) => String(c).trim().toLowerCase());
  const emailIdxFromHeader = normalizedHeader.findIndex((h) => h.includes('email'));
  const hasHeader = emailIdxFromHeader !== -1;

  let emailIdx = emailIdxFromHeader;
  let nameIdx = -1;
  let companyIdx = -1;
  let dataRows = rows;

  if (hasHeader) {
    nameIdx = normalizedHeader.findIndex((h) => h.includes('name'));
    companyIdx = normalizedHeader.findIndex((h) => h.includes('company') || h.includes('organisation') || h.includes('organization'));
    dataRows = rows.slice(1);
  } else {
    // No recognizable header — guess the email column by scanning the
    // first row for something that looks like an address.
    emailIdx = rows[0].findIndex((c) => String(c).includes('@'));
    if (emailIdx === -1) emailIdx = 0;
  }

  const lines = [];
  for (const row of dataRows) {
    const email = String(row[emailIdx] ?? '').trim();
    if (!email) continue;
    const name = nameIdx !== -1 ? String(row[nameIdx] ?? '').trim() : '';
    const company = companyIdx !== -1 ? String(row[companyIdx] ?? '').trim() : '';
    lines.push(`${email},${name},${company}`);
  }

  if (!lines.length) {
    throw new Error('No email addresses found in the file. Make sure it has an "email" column (or emails in the first column).');
  }

  return lines.join('\n');
}

module.exports = { parseRecipientsFile };
