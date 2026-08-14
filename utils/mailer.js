const nodemailer = require('nodemailer');

/**
 * Builds a nodemailer transporter.
 *
 * If `overrideCreds` is supplied (a verified credential set from a
 * frontend-submitted SMTP session — see utils/smtpSession.js) it takes
 * priority and the .env-based config below is never consulted. This is
 * what lets the sender account be changed entirely from the UI, with no
 * .env or code edits required.
 *
 * Falls back to SMTP_PROVIDER in .env when no override is present, for
 * backward compatibility with a server-configured default account.
 * Supports: gmail | outlook | custom
 */
function createTransporter(overrideCreds) {
  if (overrideCreds && overrideCreds.user && overrideCreds.pass) {
    return nodemailer.createTransport({
      host: overrideCreds.host,
      port: overrideCreds.port,
      secure: overrideCreds.secure,
      auth: {
        user: overrideCreds.user,
        pass: overrideCreds.pass,
      },
    });
  }

  const provider = (process.env.SMTP_PROVIDER || 'gmail').toLowerCase();

  if (provider === 'gmail') {
    if (!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD) {
      throw new Error('GMAIL_USER / GMAIL_APP_PASSWORD missing in .env');
    }
    return nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_APP_PASSWORD,
      },
    });
  }

  if (provider === 'outlook') {
    if (!process.env.OUTLOOK_USER || !process.env.OUTLOOK_APP_PASSWORD) {
      throw new Error('OUTLOOK_USER / OUTLOOK_APP_PASSWORD missing in .env');
    }
    return nodemailer.createTransport({
      service: 'hotmail',
      auth: {
        user: process.env.OUTLOOK_USER,
        pass: process.env.OUTLOOK_APP_PASSWORD,
      },
    });
  }

  // custom SMTP
  if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASSWORD) {
    throw new Error('SMTP_HOST / SMTP_USER / SMTP_PASSWORD missing in .env');
  }
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || '587', 10),
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASSWORD,
    },
  });
}

function getSenderAddress(overrideCreds) {
  if (overrideCreds && overrideCreds.user) return overrideCreds.user;

  const provider = (process.env.SMTP_PROVIDER || 'gmail').toLowerCase();
  if (provider === 'gmail') return process.env.GMAIL_USER;
  if (provider === 'outlook') return process.env.OUTLOOK_USER;
  return process.env.SMTP_USER;
}

module.exports = { createTransporter, getSenderAddress };
