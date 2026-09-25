const labels = { billing: 'Invoice', quotation: 'Quotation', transmittal: 'Transmittal' };
const money = new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' });
const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
const lineBreaks = (value) => escapeHtml(value).replace(/\r?\n/g, '<br>');

export function defaultEmailMessage(type, clientName) {
  const greeting = clientName?.trim() ? `Hello ${clientName.trim()},` : 'Hello,';
  const detail = type === 'quotation'
    ? 'Please find our quotation attached for your review. We would be happy to discuss any questions.'
    : type === 'transmittal'
      ? 'Please find the transmittal attached. Kindly review the listed items and acknowledge receipt.'
      : 'Please find your invoice attached. Let us know if you need any additional information.';
  return `${greeting}\n\n${detail}\n\nThank you,\nHRL IT Services`;
}

export function validateDocumentEmail(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input) || !labels[input.type]) throw new Error('Choose a valid document.');
  const fields = {
    to: [254, 'recipient email'], subject: [180, 'subject'], message: [5000, 'message'],
    number: [80, 'document number'], clientName: [180, 'client name'], issueDate: [30, 'issue date'],
    endDate: [30, 'end date'], footerMessage: [500, 'document message'],
  };
  const data = { type: input.type };
  for (const [key, [limit, label]] of Object.entries(fields)) {
    if (typeof input[key] !== 'string' || input[key].length > limit) throw new Error(`Please enter a valid ${label}.`);
    data[key] = input[key].trim();
  }
  if (!/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(data.to)) throw new Error('Enter a valid recipient email.');
  if (!data.subject || !data.message || !data.number || !data.clientName) throw new Error('Complete the recipient, subject, message, client name, and document number.');
  if (/[\r\n]/.test(data.subject) || /[\r\n]/.test(data.number)) throw new Error('Subject and document number must be one line.');
  if (!Array.isArray(input.items) || input.items.length > 100) throw new Error('Document items are invalid.');
  data.items = input.items.map((item) => {
    if (!item || typeof item !== 'object') throw new Error('Document items are invalid.');
    const result = {};
    for (const key of ['name', 'description', 'remarks']) {
      if (typeof item[key] !== 'string' || item[key].length > 1000) throw new Error('Document items are invalid.');
      result[key] = item[key].trim();
    }
    for (const key of ['qty', 'price']) {
      if (typeof item[key] !== 'number' || !Number.isFinite(item[key]) || item[key] < 0 || item[key] > 1e9) throw new Error('Document amounts are invalid.');
      result[key] = item[key];
    }
    return result;
  });
  return data;
}

export function buildDocumentEmail(data) {
  const title = labels[data.type];
  const total = data.items.reduce((sum, item) => sum + item.qty * item.price, 0);
  const date = data.issueDate ? new Date(`${data.issueDate}T00:00:00`).toLocaleDateString('en-PH', { day: 'numeric', month: 'long', year: 'numeric' }) : '—';
  const rows = data.items.map((item) => {
    const name = data.type === 'transmittal' ? item.description : item.name;
    const secondary = data.type === 'transmittal' ? item.remarks : item.description;
    return `<tr><td style="padding:13px 16px;border-bottom:1px solid #e6eeee;color:#243841;font-size:13px"><strong>${escapeHtml(name || 'Item')}</strong>${secondary ? `<div style="color:#71838a;font-size:12px;line-height:1.5;margin-top:4px">${lineBreaks(secondary)}</div>` : ''}</td><td align="right" style="padding:13px 16px;border-bottom:1px solid #e6eeee;color:#536b73;font-size:13px;white-space:nowrap">${escapeHtml(item.qty)}${data.type === 'transmittal' ? '' : ` × ${escapeHtml(money.format(item.price))}`}</td></tr>`;
  }).join('');
  const detail = data.type === 'transmittal' ? `${data.items.reduce((sum, item) => sum + item.qty, 0)} units listed` : money.format(total);
  const textContent = `HRL IT SERVICES\n${title} ${data.number}\nPrepared for ${data.clientName}\nIssued ${date}\n\n${data.message}\n\n${data.items.map((item) => `${item.qty} × ${data.type === 'transmittal' ? item.description : item.name}${data.type === 'transmittal' ? '' : ` — ${money.format(item.price)}`}`).join('\n')}\n\n${data.type === 'transmittal' ? 'Units' : 'Total'}: ${detail}\n\n${data.footerMessage}\n\nThe full ${title.toLowerCase()} is attached as a PDF.`;
  const htmlContent = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(data.subject)}</title></head><body style="margin:0;padding:0;background:#eef3f4;font-family:Arial,Helvetica,sans-serif;color:#243841"><table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr><td align="center" style="padding:32px 12px"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:640px;background:#ffffff;border-radius:14px;overflow:hidden"><tr><td style="padding:30px 34px;background:#0b2e3d;border-top:5px solid #3ba8ae"><div style="color:#8bd3d5;font-size:11px;font-weight:bold;letter-spacing:2px">HRL IT SERVICES</div><h1 style="margin:14px 0 6px;color:#ffffff;font-size:29px;font-weight:normal">${title}</h1><div style="color:#b6cdd2;font-size:14px">${escapeHtml(data.number)}</div></td></tr><tr><td style="padding:30px 34px"><div style="color:#3b8e95;font-size:11px;font-weight:bold;letter-spacing:1.5px;text-transform:uppercase">Prepared for ${escapeHtml(data.clientName)}</div><p style="white-space:normal;margin:22px 0 26px;color:#344e57;font-size:14px;line-height:1.8">${lineBreaks(data.message)}</p><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#e9f5f5;border-radius:10px"><tr><td style="padding:16px 18px"><div style="color:#5b777e;font-size:11px;text-transform:uppercase;letter-spacing:1px">Issued</div><div style="margin-top:5px;color:#123947;font-size:14px;font-weight:bold">${escapeHtml(date)}</div></td><td align="right" style="padding:16px 18px"><div style="color:#5b777e;font-size:11px;text-transform:uppercase;letter-spacing:1px">${data.type === 'transmittal' ? 'Items' : 'Total'}</div><div style="margin-top:5px;color:#123947;font-size:18px;font-weight:bold">${escapeHtml(detail)}</div></td></tr></table><h2 style="margin:30px 0 11px;color:#123947;font-size:16px">${data.type === 'transmittal' ? 'Items transmitted' : 'Summary'}</h2><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-top:2px solid #3ba8ae">${rows || '<tr><td style="padding:18px;color:#71838a;font-size:13px">No items listed</td></tr>'}</table>${data.footerMessage ? `<p style="margin:25px 0 0;padding:15px 18px;background:#f4f8f8;border-left:3px solid #3ba8ae;color:#48616a;font-size:13px;line-height:1.6">${lineBreaks(data.footerMessage)}</p>` : ''}<p style="margin:27px 0 0;color:#6d8087;font-size:12px;line-height:1.6">The full ${title.toLowerCase()} is attached as a PDF.</p></td></tr><tr><td style="padding:22px 34px;background:#0b2e3d;color:#b6cdd2;font-size:12px;line-height:1.6">HRL IT Services<br>162 D1 Gen. Julian Cruz, Barangka, Marikina City, NCR 1803</td></tr></table></td></tr></table></body></html>`;
  return { htmlContent, textContent };
}
