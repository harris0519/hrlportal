import { createServer } from 'node:http';
import { pathToFileURL } from 'node:url';
import { timingSafeEqual } from 'node:crypto';
import { prepareDocumentEmail, sendDocumentEmail } from './email.js';

export function createEmailServer({
  apiKey = process.env.BREVO_API_KEY,
  senderEmail = process.env.HRL_SENDER_EMAIL,
  accessCode = process.env.HRL_EMAIL_ACCESS_CODE,
  origins = (process.env.ALLOWED_ORIGINS || 'http://localhost:5173').split(',').map((value) => value.trim()),
  send = sendDocumentEmail,
} = {}) {
  const attempts = new Map();
  return createServer(async (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Vary', 'Origin');
    const reply = (status, result) => { res.writeHead(status); res.end(JSON.stringify(result)); };
    if (req.url === '/health' && req.method === 'GET') return reply(200, { status: 'ok' });
    if (req.url !== '/api/send-document') return reply(404, { message: 'Not found.' });
    if (req.headers.origin && !origins.includes(req.headers.origin)) return reply(403, { message: 'Origin is not allowed.' });
    if (req.headers.origin) res.setHeader('Access-Control-Allow-Origin', req.headers.origin);
    if (req.method === 'OPTIONS') {
      res.setHeader('Access-Control-Allow-Methods', 'POST');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-HRL-Email-Code');
      res.writeHead(204); return res.end();
    }
    if (req.method !== 'POST') { res.setHeader('Allow', 'POST, OPTIONS'); return reply(405, { message: 'Method not allowed.' }); }
    if (!req.headers['content-type']?.toLowerCase().startsWith('application/json')) return reply(415, { message: 'Send JSON.' });
    const now = Date.now();
    for (const [address, entry] of attempts) if (entry.expires <= now) attempts.delete(address);
    const address = req.socket.remoteAddress || 'unknown';
    const entry = attempts.get(address) || { count: 0, expires: now + 60_000 };
    attempts.set(address, entry);
    if (++entry.count > 5) { res.setHeader('Retry-After', '60'); return reply(429, { message: 'Too many emails. Please wait a minute.' }); }
    if (!apiKey || !senderEmail || !accessCode) return reply(503, { message: 'Email is not configured on the server.' });
    const suppliedCode = req.headers['x-hrl-email-code'];
    const expected = Buffer.from(accessCode);
    const actual = Buffer.from(typeof suppliedCode === 'string' ? suppliedCode : '');
    if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return reply(401, { message: 'The email authorization code is incorrect.' });
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
    } catch {
      return reply(502, { message: 'The email could not be sent. Please try again.' });
    }
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const port = Number(process.env.PORT || 3001);
  createEmailServer().listen(port, () => console.log(`HRL email API listening on port ${port}`));
}
