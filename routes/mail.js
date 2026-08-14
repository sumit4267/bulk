const express = require('express');
const path = require('path');
const fs = require('fs');
const { body, validationResult } = require('express-validator');
const rateLimit = require('express-rate-limit');

const { upload, UPLOAD_DIR, recipientsUpload } = require('../middleware/upload');
const { parseRecipients, renderTemplate } = require('../utils/recipients');
const { parseRecipientsFile } = require('../utils/recipientsFile');
const { createJob, getJob, cancelJob } = require('../utils/campaignManager');
const { createTransporter, getSenderAddress } = require('../utils/mailer');
const { detectSmtpConfig } = require('../utils/smtpProvider');
const { createSession, updateSession, getSession, deleteSession } = require('../utils/smtpSession');

const router = express.Router();

const MAX_RECIPIENTS = parseInt(process.env.MAX_RECIPIENTS || '1000', 10);
const SMTP_SID_COOKIE = 'smtp_sid';
const SMTP_COOKIE_OPTS = {
  httpOnly: true,
  sameSite: 'strict',
  maxAge: 4 * 60 * 60 * 1000,
};

function isSecureRequest(req) {
  return req.secure || req.headers['x-forwarded-proto'] === 'https';
}

function getSessionFromReq(req) {
  const sid = req.cookies && req.cookies[SMTP_SID_COOKIE];
  return { sid, session: getSession(sid) };
}

// Stricter limiter just for actually sending campaigns
const sendLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5, // 5 campaign starts per hour per IP
  message: { error: 'Too many campaigns started. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Strict limiter on SMTP verification to slow down credential-guessing attempts
const smtpVerifyLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { verified: false, error: 'Too many verification attempts. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// POST /api/smtp/verify — accepts { email, password } from the frontend,
// tests them with Nodemailer, and (only on success) stores them in a
// server-side, in-memory session tied to an httpOnly cookie. The
// credentials are never written to disk, .env, or logs, and never sent
// back to the browser.
router.post(
  '/smtp/verify',
  smtpVerifyLimiter,
  body('email').isEmail().withMessage('Enter a valid email address.').normalizeEmail({ gmail_remove_dots: false }),
  body('password').isString().isLength({ min: 1, max: 512 }).withMessage('Enter your SMTP / app password.'),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ verified: false, error: errors.array()[0].msg });
    }

    const { email, password } = req.body;
    const smtpConfig = detectSmtpConfig(email);

    try {
      const transporter = createTransporter({
        user: email,
        pass: password,
        host: smtpConfig.host,
        port: smtpConfig.port,
        secure: smtpConfig.secure,
      });
      await transporter.verify();

      const creds = { user: email, pass: password, host: smtpConfig.host, port: smtpConfig.port, secure: smtpConfig.secure };
      const { sid: existingSid, session: existingSession } = getSessionFromReq(req);
      const sid = existingSession ? updateSession(existingSid, creds) : createSession(creds);

      res.cookie(SMTP_SID_COOKIE, sid, { ...SMTP_COOKIE_OPTS, secure: isSecureRequest(req) });
      res.json({ verified: true, email });
    } catch (err) {
      // Log only the email and a short error code/reason — never the password,
      // and never the raw error object (which could echo request details).
      console.error(`SMTP verification failed for ${email}: ${err.code || err.message || 'unknown error'}`);
      res.json({
        verified: false,
        error: 'Could not authenticate with that email and password. Double-check the address and use an app password if your provider requires one.',
      });
    }
  }
);

// POST /api/smtp/logout — forgets the current session's stored credentials
router.post('/smtp/logout', (req, res) => {
  const { sid } = getSessionFromReq(req);
  deleteSession(sid);
  res.clearCookie(SMTP_SID_COOKIE);
  res.json({ success: true });
});

// GET /api/smtp-status — reports whether a sender account is ready to use.
// Prefers a verified frontend session; falls back to a .env-configured
// account so existing deployments keep working unchanged.
router.get('/smtp-status', async (req, res) => {
  const sendDelayMs = parseInt(process.env.SEND_DELAY_MS || '3000', 10);
  const { session } = getSessionFromReq(req);

  if (session) {
    try {
      const transporter = createTransporter(session);
      await transporter.verify();
      return res.json({
        verified: true,
        source: 'session',
        sender: session.user,
        sendDelayMs,
      });
    } catch (err) {
      return res.json({
        verified: false,
        source: 'session',
        sender: session.user,
        sendDelayMs,
        error: 'Saved SMTP session is no longer valid — please verify again.',
      });
    }
  }

  const provider = (process.env.SMTP_PROVIDER || 'gmail').toLowerCase();
  try {
    const transporter = createTransporter();
    await transporter.verify();
    res.json({
      verified: true,
      source: 'env',
      provider,
      sender: getSenderAddress() || null,
      sendDelayMs,
    });
  } catch (err) {
    res.json({
      verified: false,
      source: 'env',
      provider,
      sender: getSenderAddress() || null,
      sendDelayMs,
      error: err.message,
    });
  }
});

// POST /api/upload-resume
router.post('/upload-resume', (req, res) => {
  upload.single('resume')(req, res, (err) => {
    if (err) return res.status(400).json({ error: err.message });
    if (!req.file) return res.status(400).json({ error: 'No resume file received.' });
    res.json({
      success: true,
      filePath: req.file.filename,
      originalName: req.file.originalname,
      sizeKb: Math.round(req.file.size / 1024),
    });
  });
});

// POST /api/upload-recipients — parse a CSV/XLS/XLSX of HR emails,
// auto-detecting names/companies, and hand back manifest text the
// client can drop straight into the textarea.
router.post('/upload-recipients', (req, res) => {
  recipientsUpload.single('recipientsFile')(req, res, (err) => {
    if (err) return res.status(400).json({ error: err.message });
    if (!req.file) return res.status(400).json({ error: 'No file received.' });

    let rawText;
    try {
      rawText = parseRecipientsFile(req.file.buffer, req.file.originalname);
    } catch (parseErr) {
      return res.status(400).json({ error: parseErr.message });
    }

    const { valid, invalid } = parseRecipients(rawText, MAX_RECIPIENTS);
    if (valid.length === 0) {
      return res.status(400).json({ error: 'No valid email addresses found in the file.' });
    }

    res.json({
      rawText,
      validCount: valid.length,
      invalidCount: invalid.length,
      sample: valid.slice(0, 5),
    });
  });
});

// POST /api/preview-recipients — validate/parse the pasted list before sending
router.post(
  '/preview-recipients',
  body('recipients').isString().isLength({ min: 3 }).withMessage('Recipient list is required.'),
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { valid, invalid } = parseRecipients(req.body.recipients, MAX_RECIPIENTS);
    res.json({
      validCount: valid.length,
      invalidCount: invalid.length,
      invalidSample: invalid.slice(0, 10),
      sample: valid.slice(0, 5),
      exceedsMax: valid.length >= MAX_RECIPIENTS,
    });
  }
);

// POST /api/preview-email — render the template for one sample recipient
router.post(
  '/preview-email',
  body('subject').isString().trim().isLength({ min: 1, max: 200 }),
  body('body').isString().trim().isLength({ min: 1, max: 20000 }),
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const sample = { email: 'hr@examplecorp.com', name: 'Jane Doe', company: 'Example Corp' };
    res.json({
      subject: renderTemplate(req.body.subject, sample),
      body: renderTemplate(req.body.body, sample),
    });
  }
);

// POST /api/campaign/start
router.post(
  '/campaign/start',
  sendLimiter,
  body('recipients').isString().isLength({ min: 3 }),
  body('subject').isString().trim().isLength({ min: 1, max: 200 }),
  body('body').isString().trim().isLength({ min: 1, max: 20000 }),
  body('resumeFile').optional().isString(),
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { valid, invalid } = parseRecipients(req.body.recipients, MAX_RECIPIENTS);
    if (valid.length === 0) {
      return res.status(400).json({ error: 'No valid recipient email addresses found.' });
    }

    let attachmentPath = null;
    let attachmentName = null;
    if (req.body.resumeFile) {
      // resumeFile is just the generated filename from /upload-resume — resolve safely
      const safeName = path.basename(req.body.resumeFile);
      const candidate = path.join(UPLOAD_DIR, safeName);
      if (fs.existsSync(candidate)) {
        attachmentPath = candidate;
        attachmentName = req.body.resumeOriginalName || safeName;
      }
    }

    // Use the verified frontend-supplied SMTP session if one exists;
    // otherwise campaignManager falls back to the .env-configured account.
    const { session } = getSessionFromReq(req);

    const job = createJob({
      recipients: valid,
      subject: req.body.subject,
      body: req.body.body,
      attachmentPath,
      attachmentName,
      smtpCreds: session || undefined,
    });

    res.json({
      jobId: job.id,
      totalRecipients: valid.length,
      skippedInvalid: invalid.length,
      estimatedMinutes: Math.ceil(
        (valid.length * parseInt(process.env.SEND_DELAY_MS || '3000', 10)) / 60000
      ),
    });
  }
);

// GET /api/campaign/:id/status
router.get('/campaign/:id/status', (req, res) => {
  const job = getJob(req.params.id);
  if (!job) return res.status(404).json({ error: 'Job not found.' });
  res.json({
    id: job.id,
    status: job.status,
    total: job.total,
    sent: job.sent,
    failed: job.failed,
    error: job.error || null,
    recentResults: job.results.slice(-10),
  });
});

// POST /api/campaign/:id/cancel
router.post('/campaign/:id/cancel', (req, res) => {
  const job = cancelJob(req.params.id);
  if (!job) return res.status(404).json({ error: 'Job not found.' });
  res.json({ success: true, status: job.status });
});

module.exports = router;
