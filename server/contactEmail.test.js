import test from 'node:test';
import assert from 'node:assert/strict';
import { buildContactEmail, validateInquiry } from './contactEmail.js';
import { createEmailServer } from './index.js';

const inquiry = {
  name: 'A & B', email: 'visitor@example.com', phone: '',
  area: 'Corporate Law', message: 'Hello <script>\nPlease call me.', website: '',
};

test('contact email uses Oliva branding and escapes visitor input', () => {
  const payload = buildContactEmail(validateInquiry(inquiry), 'sender@example.com', 'firm@example.com');
  assert.equal(payload.to[0].email, 'firm@example.com');
  assert.equal(payload.replyTo.email, 'visitor@example.com');
  assert.match(payload.htmlContent, /OLIVA &amp; PARTNERS LAW FIRM/);
  assert.match(payload.htmlContent, /A &amp; B/);
  assert.match(payload.htmlContent, /&lt;script&gt;<br>/);
  assert.doesNotMatch(payload.htmlContent, /<script>/);
});

test('public contact route sends to the fixed recipient without opening document email', async () => {
  const sent = [];
  const server = createEmailServer({
    hosted: true, apiKey: 'private-key', senderEmail: 'hrl@example.com',
    contactSenderEmail: 'sender@example.com', contactRecipientEmail: 'firm@example.com',
    adminUsername: 'hrl.admin', adminPassword: 'hosted-secret',
    send: async (payload) => { sent.push(payload); },
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  try {
    const base = `http://127.0.0.1:${server.address().port}`;
    const post = (path, body, origin = 'https://dof.law') => fetch(`${base}${path}`, {
      method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    });
    assert.equal((await post('/api/contact', inquiry, 'https://untrusted.example')).status, 403);
    assert.equal((await post('/api/contact', { ...inquiry, email: 'invalid' })).status, 400);
    assert.equal((await post('/api/contact', { ...inquiry, website: 'spam.example' })).status, 200);
    assert.equal((await post('/api/contact', inquiry)).status, 200);
    assert.equal(sent.length, 1);
    assert.equal(sent[0].to[0].email, 'firm@example.com');
    assert.equal((await post('/api/send-document', {})).status, 403);
  } finally { server.close(); }
});
