import { createServer } from 'node:http';
import { randomBytes, timingSafeEqual } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { prepareDocumentEmail, sendDocumentEmail } from './email.js';
import { buildContactEmail, validateInquiry } from './contactEmail.js';

const SESSION_LIFETIME_MS = 8 * 60 * 60 * 1000;
const isLoopback = (address) => ['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(address);
const normalizeOrigin = (value) => {
  try { return new URL(value).origin; } catch { return value.replace(/\/$/, ''); }
};
const sameSecret = (received, expected) => {
  const left = Buffer.from(typeof received === 'string' ? received : '');
  const right = Buffer.from(typeof expected === 'string' ? expected : '');
  return left.length === right.length && timingSafeEqual(left, right);
};

export function createEmailServer({
  apiKey = process.env.BREVO_API_KEY,
  senderEmail = process.env.HRL_SENDER_EMAIL,
  contactSenderEmail = process.env.OLP_SENDER_EMAIL || 'hlazaro@socexconsulting.com',
  contactRecipientEmail = process.env.OLP_CONTACT_EMAIL || 'olivaandpartners@dof.law',
  hosted = process.env.NODE_ENV === 'production',
  adminUsername = process.env.HRL_ADMIN_USERNAME || 'hrl.admin',
  adminPassword = process.env.HRL_ADMIN_PASSWORD,
  origins = (process.env.ALLOWED_ORIGINS || 'http://localhost:5173,https://harris0519.github.io').split(',').map((value) => value.trim()),
  send = sendDocumentEmail,
} = {}) {
  const allowedOrigins = new Set(['http://localhost:5173', 'https://harris0519.github.io', ...origins.map(normalizeOrigin)]);
  const contactOrigins = new Set([...allowedOrigins, 'http://localhost:5174', 'https://dof.law', 'https://www.dof.law']);
  const attempts = new Map();
  const sessions = new Map();
  return createServer(async (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Vary', 'Origin');
    const reply = (status, result) => { res.writeHead(status); res.end(JSON.stringify(result)); };
    if (req.url === '/health' && req.method === 'GET') return reply(200, { status: 'ok' });
    if (!['/api/login', '/api/logout', '/api/send-document', '/api/contact'].includes(req.url)) return reply(404, { message: 'Not found.' });
    if (!hosted && !isLoopback(req.socket.remoteAddress)) return reply(403, { message: 'Email sending is available only from this computer.' });
    if (req.url === '/api/contact' && !req.headers.origin) return reply(403, { message: 'Origin is not allowed.' });
    if (req.headers.origin && !(req.url === '/api/contact' ? contactOrigins : allowedOrigins).has(req.headers.origin)) return reply(403, { message: 'Origin is not allowed.' });
    if (req.headers.origin) res.setHeader('Access-Control-Allow-Origin', req.headers.origin);
    if (req.method === 'OPTIONS') {
      res.setHeader('Access-Control-Allow-Methods', 'POST');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
      res.writeHead(204); return res.end();
    }
    if (req.method !== 'POST') { res.setHeader('Allow', 'POST, OPTIONS'); return reply(405, { message: 'Method not allowed.' }); }
    const now = Date.now();
    for (const [key, entry] of attempts) if (entry.expires <= now) attempts.delete(key);
    for (const [token, expires] of sessions) if (expires <= now) sessions.delete(token);
    const key = `${req.socket.remoteAddress || 'unknown'}:${req.url}`;
    const entry = attempts.get(key) || { count: 0, expires: now + 60_000 };
    attempts.set(key, entry);
    if (++entry.count > (req.url === '/api/login' ? 8 : 5)) { res.setHeader('Retry-After', '60'); return reply(429, { message: 'Too many attempts. Please wait a minute.' }); }
    if (req.url === '/api/contact') {
      if (!req.headers['content-type']?.toLowerCase().startsWith('application/json')) return reply(415, { message: 'Send JSON.' });
      if (!apiKey || !contactSenderEmail || !contactRecipientEmail) return reply(503, { message: 'The contact form is not configured yet. Please email the firm directly.' });
      let body;
      try {
        const chunks = []; let size = 0;
        for await (const chunk of req) {
          size += chunk.length;
          if (size > 12_000) return reply(413, { message: 'Your message is too long.' });
          chunks.push(chunk);
        }
        body = JSON.parse(Buffer.concat(chunks).toString('utf8'));
      } catch { return reply(400, { message: 'Invalid request.' }); }
      if (body?.website) return reply(200, { success: true });
      let inquiry;
      try { inquiry = validateInquiry(body); }
      catch (error) { return reply(400, { message: error.message }); }
      try {
        await send(buildContactEmail(inquiry, contactSenderEmail, contactRecipientEmail), apiKey);
        return reply(200, { success: true });
      } catch (error) {
        console.error('Contact email delivery failed:', error);
        return reply(502, { message: 'Your inquiry could not be sent. Please try again or email the firm directly.' });
      }
    }
    if (req.url === '/api/login') {
      if (!hosted) return reply(404, { message: 'Sign-in API is used only for the hosted portal.' });
      if (!adminUsername || !adminPassword) return reply(503, { message: 'Portal sign-in is not configured on the server.' });
      if (!req.headers['content-type']?.toLowerCase().startsWith('application/json')) return reply(415, { message: 'Send JSON.' });
      let body;
      try {
        const chunks = []; let size = 0;
        for await (const chunk of req) {
          size += chunk.length;
          if (size > 4096) return reply(413, { message: 'Request is too large.' });
          chunks.push(chunk);
        }
        body = JSON.parse(Buffer.concat(chunks).toString('utf8'));
      } catch { return reply(400, { message: 'Invalid request.' }); }
      if (!sameSecret(body?.username, adminUsername) || !sameSecret(body?.password, adminPassword)) return reply(401, { message: 'The username or password is incorrect.' });
      const token = randomBytes(32).toString('base64url');
      sessions.set(token, now + SESSION_LIFETIME_MS);
      return reply(200, { token });
    }
    if (hosted) {
      if (!adminUsername || !adminPassword) return reply(503, { message: 'Portal sign-in is not configured on the server.' });
      const token = req.headers.authorization?.match(/^Bearer ([A-Za-z0-9_-]+)$/)?.[1];
      if (!token || !sessions.has(token)) return reply(401, { message: 'Your session has expired. Please sign in again.' });
      if (req.url === '/api/logout') { sessions.delete(token); return reply(200, { success: true }); }
    } else if (req.url === '/api/logout') return reply(404, { message: 'Sign-out API is used only for the hosted portal.' });
    if (!req.headers['content-type']?.toLowerCase().startsWith('application/json')) return reply(415, { message: 'Send JSON.' });
    if (!apiKey || !senderEmail) return reply(503, { message: 'Email is not configured on the server.' });
    let body;
    try {
      const chunks = []; let size = 0;
      for await (const chunk of req) {
        size += chunk.length;
        if (size > 9_500_000) return reply(413, { message: 'The PDF is too large to email.' });
        chunks.push(chunk);
      }
      body = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    } catch { return reply(400, { message: 'Invalid request.' }); }
    let payload;
    try { payload = prepareDocumentEmail(body, senderEmail); }
    catch (error) { return reply(400, { message: error.message }); }
    try {
      await send(payload, apiKey);
      return reply(200, { success: true });
    } catch (error) {
      console.error('Document email delivery failed:', error);
      return reply(502, { message: 'The email could not be sent. Please try again.' });
    }
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const port = Number(process.env.PORT || 3001);
  const host = process.env.NODE_ENV === 'production' ? '0.0.0.0' : '127.0.0.1';
  createEmailServer().listen(port, host, () => console.log(`HRL email API listening on port ${port}`));
}
