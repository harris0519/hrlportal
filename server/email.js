import { buildDocumentEmail, validateDocumentEmail } from '../hrl-invoice-react/src/documentEmail.js';

export function prepareDocumentEmail(body, senderEmail) {
  const data = validateDocumentEmail(body);
  if (typeof body.pdfBase64 !== 'string' || body.pdfBase64.length > 9_000_000 || !/^[A-Za-z0-9+/]+={0,2}$/.test(body.pdfBase64)) throw new Error('Please attach a valid PDF.');
  const pdf = Buffer.from(body.pdfBase64, 'base64');
  if (pdf.length < 100 || pdf.length > 6_750_000 || pdf.subarray(0, 5).toString('ascii') !== '%PDF-') throw new Error('Please attach a valid PDF.');
  const content = buildDocumentEmail(data);
  const filename = `${data.type}-${data.number.replace(/[^a-zA-Z0-9._-]/g, '-')}.pdf`;
  return {
    sender: { name: 'HRL IT Services', email: senderEmail },
    to: [{ email: data.to, name: data.clientName }],
    ...(data.cc.length ? { cc: data.cc.map((email) => ({ email })) } : {}),
    replyTo: { email: senderEmail, name: 'HRL IT Services' },
    subject: data.subject,
    ...content,
    attachment: [{ name: filename, content: body.pdfBase64 }],
  };
}

export async function sendDocumentEmail(payload, apiKey, fetcher = fetch) {
  const response = await fetcher('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: { accept: 'application/json', 'content-type': 'application/json', 'api-key': apiKey },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(20000),
  });
  if (!response.ok) throw new Error(`Email provider rejected the message (HTTP ${response.status}).`);
  const result = await response.json();
  if (!result.messageId) throw new Error('Email provider did not acknowledge the message.');
  return result.messageId;
}
