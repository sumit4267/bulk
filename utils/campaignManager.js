const crypto = require('crypto');
const path = require('path');
const fs = require('fs');
const { createTransporter, getSenderAddress } = require('./mailer');
const { renderTemplate, stripHeaderInjection } = require('./recipients');

// jobId -> job state (in-memory; fine for a single-instance personal-use tool)
const jobs = new Map();

const SEND_DELAY_MS = parseInt(process.env.SEND_DELAY_MS || '3000', 10);

function createJob({ recipients, subject, body, attachmentPath, attachmentName, smtpCreds }) {
  const id = crypto.randomUUID();
  const job = {
    id,
    status: 'queued', // queued | running | completed | cancelled | failed
    total: recipients.length,
    sent: 0,
    failed: 0,
    results: [], // {email, status, error?}
    createdAt: Date.now(),
    cancelRequested: false,
  };
  jobs.set(id, job);

  // fire and forget — client polls /api/campaign/:id/status
  // smtpCreds (if present) is the verified session credential set captured
  // at request time — never re-read from the client, never logged.
  runJob(job, { recipients, subject, body, attachmentPath, attachmentName, smtpCreds }).catch((err) => {
    job.status = 'failed';
    job.error = err.message;
  });

  return job;
}

async function runJob(job, { recipients, subject, body, attachmentPath, attachmentName, smtpCreds }) {
  job.status = 'running';

  let transporter;
  try {
    transporter = createTransporter(smtpCreds);
    await transporter.verify();
  } catch (err) {
    job.status = 'failed';
    job.error = `SMTP setup failed: ${err.message}`;
    return;
  }

  const from = getSenderAddress(smtpCreds);

  for (const recipient of recipients) {
    if (job.cancelRequested) {
      job.status = 'cancelled';
      break;
    }

    const personalizedSubject = stripHeaderInjection(renderTemplate(subject, recipient));
    const personalizedBody = renderTemplate(body, recipient);
    const normalizedBody = personalizedBody.replace(/\r\n/g, '\n');
    const htmlBody = normalizedBody
      .split(/\n{2,}/)
      .map((para) => `<p>${escapeHtml(para).replace(/\n/g, '<br/>')}</p>`)
      .join('\n');

    const mailOptions = {
      from,
      to: recipient.email, // ONE recipient per email — never CC/BCC — recipient never sees the others
      subject: personalizedSubject,
      text: personalizedBody,
      html: htmlBody,
    };

    if (attachmentPath && fs.existsSync(attachmentPath)) {
      mailOptions.attachments = [
        { filename: attachmentName || path.basename(attachmentPath), path: attachmentPath },
      ];
    }

    try {
      await transporter.sendMail(mailOptions);
      job.sent += 1;
      job.results.push({ email: recipient.email, status: 'sent' });
    } catch (err) {
      job.failed += 1;
      job.results.push({ email: recipient.email, status: 'failed', error: err.message });
    }

    // Human-paced delay between sends — respects provider limits and
    // avoids the sends being flagged as automated/bulk.
    if (SEND_DELAY_MS > 0) {
      await sleep(SEND_DELAY_MS);
    }
  }

  if (job.status !== 'cancelled') job.status = 'completed';
}

function escapeHtml(str = '') {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getJob(id) {
  return jobs.get(id);
}

function cancelJob(id) {
  const job = jobs.get(id);
  if (job && job.status === 'running') job.cancelRequested = true;
  return job;
}

// Periodically clean up old finished jobs (>2h) to avoid unbounded memory growth
setInterval(() => {
  const cutoff = Date.now() - 2 * 60 * 60 * 1000;
  for (const [id, job] of jobs) {
    if (job.createdAt < cutoff && job.status !== 'running') jobs.delete(id);
  }
}, 30 * 60 * 1000).unref();

module.exports = { createJob, getJob, cancelJob };
