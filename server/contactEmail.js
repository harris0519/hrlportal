const escapeHtml = (value) => value.replace(/[&<>"']/g, (character) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
})[character]);

const emailPattern = /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/;

export function validateInquiry(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new Error('Please complete the form.');
  const read = (key, max, required = false) => {
    if (typeof body[key] !== 'string') throw new Error(`Please enter a valid ${key}.`);
    const value = body[key].trim();
    if ((required && !value) || value.length > max || /[\x00-\x08\x0b\x0c\x0e-\x1f]/.test(value)) throw new Error(`Please enter a valid ${key}.`);
    return value;
  };
  const name = read('name', 120, true);
  const email = read('email', 254, true);
  const phone = read('phone', 40);
  const area = read('area', 120, true);
  const message = read('message', 5000, true);
  if (!emailPattern.test(email) || /[\r\n]/.test(email)) throw new Error('Please enter a valid email address.');
  return { name, email, phone, area, message };
}

export function buildContactEmail(inquiry, senderEmail, recipientEmail) {
  const { name, email, phone, area, message } = inquiry;
  const rows = [
    ['Full name', name], ['Email address', email], ['Contact number', phone || 'Not provided'], ['Area of concern', area],
  ].map(([label, value]) => `<tr><td style="padding:11px 0;border-bottom:1px solid #e3dfd2;color:#697083;font-size:12px;width:150px;vertical-align:top">${label}</td><td style="padding:11px 0;border-bottom:1px solid #e3dfd2;color:#20263a;font-size:14px;vertical-align:top;word-break:break-word">${escapeHtml(value)}</td></tr>`).join('');
  const safeMessage = escapeHtml(message).replace(/\r\n|\r|\n/g, '<br>');
  const htmlContent = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>New website inquiry</title></head><body style="margin:0;padding:0;background:#f7f3e8;font-family:Arial,Helvetica,sans-serif;color:#20263a"><table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr><td align="center" style="padding:32px 12px"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:620px;background:#ffffff"><tr><td style="background:#111a38;border-top:5px solid #d9ad3c;padding:30px 34px"><p style="margin:0;color:#f2d37a;font-size:11px;font-weight:bold;letter-spacing:2px">OLIVA &amp; PARTNERS LAW FIRM</p><h1 style="margin:13px 0 0;color:#ffffff;font-size:27px;line-height:1.25;font-weight:normal">New website inquiry</h1></td></tr><tr><td style="padding:30px 34px"><p style="margin:0 0 20px;color:#697083;font-size:14px;line-height:1.6">A visitor submitted the contact form on your website.</p><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-top:2px solid #d9ad3c">${rows}</table><h2 style="margin:28px 0 12px;color:#111a38;font-size:16px">Message</h2><div style="background:#f7f3e8;border-left:3px solid #d9ad3c;padding:18px;color:#20263a;font-size:14px;line-height:1.7;word-break:break-word">${safeMessage}</div><p style="margin:24px 0 0;color:#697083;font-size:12px;line-height:1.6">Reply to this email to respond directly to ${escapeHtml(name)}. Please handle submitted details confidentially.</p></td></tr><tr><td style="background:#111a38;padding:21px 34px;color:#d9dce5;font-size:12px;line-height:1.6">OLIVA &amp; PARTNERS LAW FIRM<br>548 Shaw Blvd., Mandaluyong City, Philippines</td></tr></table></td></tr></table></body></html>`;
  const textContent = `New website inquiry\n\nFull name: ${name}\nEmail address: ${email}\nContact number: ${phone || 'Not provided'}\nArea of concern: ${area}\n\nMessage:\n${message}\n`;
  return {
    sender: { name: 'Oliva & Partners Law Firm', email: senderEmail },
    to: [{ email: recipientEmail }],
    replyTo: { name, email },
    subject: `Website inquiry: ${area}`,
    htmlContent,
    textContent,
  };
}
