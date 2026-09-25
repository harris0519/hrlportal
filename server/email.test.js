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
  assert.equal(email.attachment[0].name, 'quotation-QUO-1.pdf');
  assert.match(email.htmlContent, /&lt;script&gt;/);
  assert.match(email.htmlContent, /Example &amp; Co/);
  assert.doesNotMatch(email.htmlContent, /<script>/);
  assert.match(email.htmlContent, /₱200\.00/);
});

test('rejects invalid recipient and attachment', () => {
  assert.throws(() => prepareDocumentEmail({ ...data, to: 'wrong' }, 'billing@hrl.example'));
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

test('requires access code and sends only a valid document', async () => {
  let sends = 0;
  const server = createEmailServer({ apiKey: 'private-key', senderEmail: 'billing@hrl.example', accessCode: 'staff-only', origins: ['http://localhost:5173'], send: async () => { sends += 1; } });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  try {
    const url = `http://127.0.0.1:${server.address().port}/api/send-document`;
    const health = await fetch(`http://127.0.0.1:${server.address().port}/health`);
    assert.equal(health.status, 200);
    const request = (code, body = data) => fetch(url, { method: 'POST', headers: { Origin: 'http://localhost:5173', 'Content-Type': 'application/json', 'X-HRL-Email-Code': code }, body: JSON.stringify(body) });
    assert.equal((await request('wrong')).status, 401);
    assert.equal((await request('staff-only', { ...data, to: 'bad' })).status, 400);
    assert.equal((await request('staff-only')).status, 200);
    assert.equal(sends, 1);
  } finally { server.close(); }
});
