import test from 'node:test';
import assert from 'node:assert/strict';
import { prepareDocumentEmail, sendDocumentEmail } from './email.js';
import { createEmailServer } from './index.js';

const data = {
  type: 'quotation', to: 'client@example.com', subject: 'Quotation QUO-1',
  message: 'Hello <script>\nPlease review.', number: 'QUO-1', clientName: 'Example & Co',
  issueDate: '2026-09-25', endDate: '2026-10-25', footerMessage: 'Thank you',
  items: [{ name: 'Service <A>', description: 'Details', remarks: '', qty: 2, price: 100 }],
  pdfBase64: Buffer.from('%PDF-' + 'a'.repeat(120)).toString('base64'),
};

test('prepares branded email and PDF while escaping document content', () => {
  const email = prepareDocumentEmail(data, 'billing@hrl.example');
  assert.equal(email.sender.email, 'billing@hrl.example');
  assert.equal(email.to[0].email, data.to);
  assert.equal(email.cc, undefined);
  assert.equal(email.attachment[0].name, 'quotation-QUO-1.pdf');
  assert.match(email.htmlContent, /&lt;script&gt;/);
  assert.match(email.htmlContent, /Example &amp; Co/);
  assert.doesNotMatch(email.htmlContent, /<script>/);
  assert.match(email.htmlContent, /₱200\.00/);
});

test('adds optional CC recipients and rejects invalid addresses or attachments', () => {
  const email = prepareDocumentEmail({ ...data, cc: 'first@example.com, second@example.com' }, 'billing@hrl.example');
  assert.deepEqual(email.cc, [{ email: 'first@example.com' }, { email: 'second@example.com' }]);
  assert.throws(() => prepareDocumentEmail({ ...data, to: 'wrong' }, 'billing@hrl.example'));
  assert.throws(() => prepareDocumentEmail({ ...data, cc: 'bad-address' }, 'billing@hrl.example'));
  assert.throws(() => prepareDocumentEmail({ ...data, cc: 'first@example.com,' }, 'billing@hrl.example'));
  assert.throws(() => prepareDocumentEmail({ ...data, pdfBase64: 'abc' }, 'billing@hrl.example'));
});

test('sends via Brevo with the server key', async () => {
  let options;
  await sendDocumentEmail({ subject: 'Test' }, 'private-key', async (url, request) => {
    assert.equal(url, 'https://api.brevo.com/v3/smtp/email');
    options = request;
    return { ok: true, json: async () => ({ messageId: 'sent-1' }) };
  });
  assert.equal(options.headers['api-key'], 'private-key');
});

test('sends a valid document without a send code', async () => {
  let sends = 0;
  const server = createEmailServer({ apiKey: 'private-key', senderEmail: 'billing@hrl.example', origins: ['http://localhost:5173'], send: async () => { sends += 1; } });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  try {
    const url = `http://127.0.0.1:${server.address().port}/api/send-document`;
    const health = await fetch(`http://127.0.0.1:${server.address().port}/health`);
    assert.equal(health.status, 200);
    const request = (body = data, origin = 'http://localhost:5173') => fetch(url, { method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    assert.equal((await request({ ...data, to: 'bad' })).status, 400);
    assert.equal((await request(data, 'https://untrusted.example')).status, 403);
    assert.equal((await request({ ...data, cc: 'copy@example.com' })).status, 200);
    assert.equal(sends, 1);
  } finally { server.close(); }
});

test('hosted email requires a sign-in session and includes CC recipients', async () => {
  let sent;
  const server = createEmailServer({
    hosted: true, apiKey: 'private-key', senderEmail: 'billing@hrl.example',
    adminUsername: 'hrl.admin', adminPassword: 'hosted-secret',
    origins: ['https://harris0519.github.io'], send: async (payload) => { sent = payload; },
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  try {
    const base = `http://127.0.0.1:${server.address().port}`;
    const headers = { Origin: 'https://harris0519.github.io', 'Content-Type': 'application/json' };
    const send = (token) => fetch(`${base}/api/send-document`, {
      method: 'POST', headers: { ...headers, ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify({ ...data, cc: 'copy@example.com' }),
    });
    assert.equal((await send()).status, 401);
    const wrong = await fetch(`${base}/api/login`, { method: 'POST', headers, body: JSON.stringify({ username: 'hrl.admin', password: 'wrong' }) });
    assert.equal(wrong.status, 401);
    const login = await fetch(`${base}/api/login`, { method: 'POST', headers, body: JSON.stringify({ username: 'hrl.admin', password: 'hosted-secret' }) });
    assert.equal(login.status, 200);
    const { token } = await login.json();
    assert.match(token, /^[A-Za-z0-9_-]+$/);
    assert.equal((await send(token)).status, 200);
    assert.deepEqual(sent.cc, [{ email: 'copy@example.com' }]);
    assert.equal((await fetch(`${base}/api/logout`, { method: 'POST', headers: { Origin: headers.Origin, Authorization: `Bearer ${token}` } })).status, 200);
    assert.equal((await send(token)).status, 401);
  } finally { server.close(); }
});

test('hosted sign-in refuses to run without a private password', async () => {
  const server = createEmailServer({ hosted: true, adminUsername: 'hrl.admin', adminPassword: '' });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  try {
    const response = await fetch(`http://127.0.0.1:${server.address().port}/api/login`, {
      method: 'POST', headers: { Origin: 'https://harris0519.github.io', 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'hrl.admin', password: 'anything' }),
    });
    assert.equal(response.status, 503);
  } finally { server.close(); }
});
