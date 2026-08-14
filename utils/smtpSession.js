const crypto = require('crypto');

/**
 * In-memory store mapping a random session id (delivered to the browser
 * only as an httpOnly cookie) to a verified SMTP credential set.
 *
 * Nothing here ever touches disk, .env, or application logs — it lives
 * only in this process's memory and is cleared on server restart or
 * expiry, whichever comes first.
 */

const SESSION_TTL_MS = 4 * 60 * 60 * 1000; // 4 hours of inactivity

// sid -> { user, pass, host, port, secure, createdAt }
const sessions = new Map();

function createSession(creds) {
  const sid = crypto.randomBytes(32).toString('hex');
  sessions.set(sid, { ...creds, createdAt: Date.now() });
  return sid;
}

function updateSession(sid, creds) {
  if (!sid) return null;
  sessions.set(sid, { ...creds, createdAt: Date.now() });
  return sid;
}

function getSession(sid) {
  if (!sid) return null;
  const session = sessions.get(sid);
  if (!session) return null;
  if (Date.now() - session.createdAt > SESSION_TTL_MS) {
    sessions.delete(sid);
    return null;
  }
  return session;
}

function deleteSession(sid) {
  if (sid) sessions.delete(sid);
}

// Sweep expired sessions periodically so credentials never linger in
// memory longer than the TTL, even if a browser never calls logout.
setInterval(() => {
  const cutoff = Date.now() - SESSION_TTL_MS;
  for (const [sid, session] of sessions) {
    if (session.createdAt < cutoff) sessions.delete(sid);
  }
}, 15 * 60 * 1000).unref();

module.exports = { createSession, updateSession, getSession, deleteSession, SESSION_TTL_MS };
