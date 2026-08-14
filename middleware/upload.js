const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const UPLOAD_DIR = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const ALLOWED_MIME = new Set([
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
]);

const ALLOWED_EXT = new Set(['.pdf', '.doc', '.docx']);

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const safeExt = path.extname(file.originalname).toLowerCase();
    const uniqueName = `${Date.now()}-${crypto.randomBytes(8).toString('hex')}${safeExt}`;
    cb(null, uniqueName);
  },
});

function fileFilter(req, file, cb) {
  const ext = path.extname(file.originalname).toLowerCase();
  if (!ALLOWED_MIME.has(file.mimetype) || !ALLOWED_EXT.has(ext)) {
    return cb(new Error('Only PDF, DOC, or DOCX resumes are allowed.'));
  }
  cb(null, true);
}

const maxSizeMb = parseInt(process.env.MAX_FILE_SIZE_MB || '5', 10);

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: maxSizeMb * 1024 * 1024, files: 1 },
});

// ── Recipient list upload (CSV / Excel) ─────────────────────
// Small, memory-only — the file is parsed in-request and never
// written to disk.
const RECIPIENTS_ALLOWED_MIME = new Set([
  'text/csv',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/csv',
  'text/plain', // some browsers/OSes report CSV as text/plain
  'application/octet-stream', // fallback some browsers send for .xlsx/.csv
]);
const RECIPIENTS_ALLOWED_EXT = new Set(['.csv', '.xlsx', '.xls']);

function recipientsFileFilter(req, file, cb) {
  const ext = path.extname(file.originalname).toLowerCase();
  if (!RECIPIENTS_ALLOWED_EXT.has(ext) || !RECIPIENTS_ALLOWED_MIME.has(file.mimetype)) {
    return cb(new Error('Only CSV, XLS, or XLSX files are allowed.'));
  }
  cb(null, true);
}

const recipientsMaxSizeMb = parseInt(process.env.MAX_RECIPIENTS_FILE_SIZE_MB || '5', 10);

const recipientsUpload = multer({
  storage: multer.memoryStorage(),
  fileFilter: recipientsFileFilter,
  limits: { fileSize: recipientsMaxSizeMb * 1024 * 1024, files: 1 },
});

module.exports = { upload, UPLOAD_DIR, recipientsUpload };
