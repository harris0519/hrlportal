import React, { useMemo, useRef, useState } from 'react';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

const peso = new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP', minimumFractionDigits: 2 });

// Temporary client-side access only. Replace this with server-side authentication
// before using the application for sensitive or production data.
const TEMPORARY_CREDENTIALS = {
  username: 'hrl.admin',
  password: 'HRL2026!',
};
const AUTH_SESSION_KEY = 'hrl-document-builder-authenticated';
const logoUrl = `${import.meta.env.BASE_URL}hrl-logo-crop.png`;

const documentTypes = {
  billing: {
    navLabel: 'Billing', title: 'Invoice', heading: 'INVOICE', numberLabel: 'Invoice number',
    previewNumberLabel: 'Invoice No.', dateLabel: 'Due date', previewDateLabel: 'Due Date',
    recipientLabel: 'Bill to', previewRecipientLabel: 'Billed to', totalLabel: 'Grand total',
    defaultNumber: 'INV-000042', defaultMessage: 'Thank you for your business!', fileFallback: 'invoice',
  },
  quotation: {
    navLabel: 'Quotations', title: 'Quotation', heading: 'QUOTATION', numberLabel: 'Quotation number',
    previewNumberLabel: 'Quotation No.', dateLabel: 'Valid until', previewDateLabel: 'Valid Until',
    recipientLabel: 'Quote for', previewRecipientLabel: 'Prepared for', totalLabel: 'Quotation total',
    defaultNumber: 'QUO-000001', defaultMessage: 'We look forward to working with you!', fileFallback: 'quotation',
  },
  transmittal: {
    navLabel: 'Transmittal', title: 'Transmittal Form', heading: 'TRANSMITTAL', numberLabel: 'Transmittal number',
    previewNumberLabel: 'Transmittal No.', recipientLabel: 'Transmit to', previewRecipientLabel: 'Transmitted to',
    defaultNumber: 'TRN-000001', defaultMessage: 'Please acknowledge receipt of the items listed above.',
    fileFallback: 'transmittal', hasEndDate: false, isTransmittal: true,
  },
};

const navigationItems = {
  ...documentTypes,
  reports: { navLabel: 'Reports', title: 'Reports' },
};

function formatDate(value) {
  if (!value) return '';
  return new Date(`${value}T00:00:00`).toLocaleDateString('en-PH', { day: 'numeric', month: 'long', year: 'numeric' });
}

function toDateInputValue(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function addDays(value, days) {
  const date = value ? new Date(`${value}T00:00:00`) : new Date();
  date.setDate(date.getDate() + days);
  return toDateInputValue(date);
}

function createDraft(type) {
  const issueDate = toDateInputValue(new Date());
  const config = documentTypes[type];
  return {
    client: {
      name: 'Cardrian Builders Corporation', email: 'christine.cardrian@ymail.com',
      address1: '40 Chestnut St. West Fairview', address2: 'Quezon City, Metro Manila 1121', country: 'Philippines',
    },
    meta: {
      number: config.defaultNumber, issueDate, endDate: addDays(issueDate, type === 'quotation' ? 30 : 10),
      footerMessage: config.defaultMessage,
      receivedBy: '', receivedDate: '',
      generatedAt: new Date().toLocaleString('en-PH', { dateStyle: 'long', timeStyle: 'short' }),
    },
    items: [],
  };
}

function Field({ label, children }) {
  return <label className="field"><span>{label}</span>{children}</label>;
}

function LoginScreen({ onLogin }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');

  const submit = (event) => {
    event.preventDefault();
    if (username === TEMPORARY_CREDENTIALS.username && password === TEMPORARY_CREDENTIALS.password) {
      setError('');
      onLogin();
      return;
    }
    setError('The username or password is incorrect.');
  };

  return (
    <main className="login-page">
      <section className="login-brand-panel">
        <div className="login-brand-content">
          <p className="login-kicker">HRL IT Services</p>
          <h1>Business documents,<br />made simple.</h1>
          <p>Create polished invoices and quotations from one convenient workspace.</p>
        </div>
        <span className="login-copyright">HRL Document Workspace</span>
      </section>
      <section className="login-form-panel">
        <form className="login-card" onSubmit={submit}>
          <img className="login-logo" src={logoUrl} alt="HRL IT Services" />
          <p className="eyebrow">Secure workspace</p>
          <h2>Welcome back</h2>
          <p className="login-intro">Sign in to manage your billing and quotations.</p>
          <div className="login-fields">
            <Field label="Username">
              <input autoFocus autoComplete="username" value={username} onChange={(event) => {
                setUsername(event.target.value);
                setError('');
              }} placeholder="Enter your username" />
            </Field>
            <Field label="Password">
              <div className="password-field">
                <input type={showPassword ? 'text' : 'password'} autoComplete="current-password" value={password}
                  onChange={(event) => { setPassword(event.target.value); setError(''); }} placeholder="Enter your password" />
                <button type="button" onClick={() => setShowPassword((current) => !current)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}>{showPassword ? 'Hide' : 'Show'}</button>
              </div>
            </Field>
          </div>
          {error && <div className="login-error" role="alert">{error}</div>}
          <button className="login-submit" type="submit">Sign in</button>
          <p className="login-note">Temporary local access · No account recovery is available yet.</p>
        </form>
      </section>
    </main>
  );
}

function DocumentIcon({ type }) {
  if (type === 'billing') return (
    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 3h12v18l-3-2-3 2-3-2-3 2V3Zm3 5h6M9 12h6" /></svg>
  );
  if (type === 'transmittal') return (
    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h11M4 12h8M4 17h6M14 14l4-4 3 3M18 10v9" /></svg>
  );
  if (type === 'reports') return (
    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 20V10h4v10M10 20V4h4v16M15 20v-7h4v7M3 20h18" /></svg>
  );
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 3h9l3 3v15H6V3Zm9 0v4h4M9 11h6M9 15h4" /></svg>
  );
}

function estimateItemHeight(item) {
  const nameLines = Math.max(1, Math.ceil(String(item.name || '').length / 30));
  const description = String(item.description || '');
  const descriptionLines = description
    ? description.split('\n').reduce((lines, part) => lines + Math.max(1, Math.ceil(part.length / 42)), 0) : 0;
  const remarksLines = String(item.remarks || '')
    .split('\n').reduce((lines, part) => lines + Math.max(1, Math.ceil(part.length / 28)), 0);
  return Math.max(83, 49 + nameLines * 18 + Math.max(descriptionLines, item.remarks ? remarksLines : 0) * 19);
}

function takePageItems(items, heightBudget) {
  let usedHeight = 0;
  let count = 0;
  while (count < items.length - 1) {
    const itemHeight = estimateItemHeight(items[count]);
    if (count > 0 && usedHeight + itemHeight > heightBudget) break;
    usedHeight += itemHeight;
    count += 1;
  }
  return Math.max(1, count);
}

function paginateItems(items) {
  if (!items.length) return [[]];
  if (items.reduce((sum, item) => sum + estimateItemHeight(item), 0) <= 430) return [items];
  const pages = [];
  let remaining = items;
  const firstPageCount = takePageItems(remaining, 610);
  pages.push(remaining.slice(0, firstPageCount));
  remaining = remaining.slice(firstPageCount);
  while (remaining.length) {
    if (remaining.reduce((sum, item) => sum + estimateItemHeight(item), 0) <= 430) {
      pages.push(remaining);
      break;
    }
    const pageCount = takePageItems(remaining, 610);
    pages.push(remaining.slice(0, pageCount));
    remaining = remaining.slice(pageCount);
  }
  return pages;
}

function calculateDraftTotal(draft) {
  return draft.items.reduce(
    (sum, item) => sum + Number(item.price || 0) * Number(item.qty || 0), 0
  );
}

function ReportsDashboard({ drafts, onOpenDocument }) {
  const invoiceTotal = calculateDraftTotal(drafts.billing);
  const quotationTotal = calculateDraftTotal(drafts.quotation);
  const transmittedUnits = drafts.transmittal.items.reduce((sum, item) => sum + Number(item.qty || 0), 0);
  const totalLineItems = Object.values(drafts).reduce((sum, draft) => sum + draft.items.length, 0);
  const maxFinancialValue = Math.max(invoiceTotal, quotationTotal, 1);
  const rows = [
    { type: 'billing', label: 'Invoice', draft: drafts.billing, value: peso.format(invoiceTotal) },
    { type: 'quotation', label: 'Quotation', draft: drafts.quotation, value: peso.format(quotationTotal) },
    { type: 'transmittal', label: 'Transmittal', draft: drafts.transmittal, value: `${transmittedUnits} unit${transmittedUnits === 1 ? '' : 's'}` },
  ];

  return (
    <section className="reports-page">
      <header className="reports-header">
        <div><p className="eyebrow">Workspace overview</p><h1>Reports</h1><p>Summary of the documents currently prepared in this browser session.</p></div>
        <div className="report-date"><span>Report date</span><strong>{formatDate(toDateInputValue(new Date()))}</strong></div>
      </header>

      <div className="report-summary-grid">
        <article className="report-stat"><span>Invoice value</span><strong>{peso.format(invoiceTotal)}</strong><small>{drafts.billing.items.length} line items</small></article>
        <article className="report-stat"><span>Quotation value</span><strong>{peso.format(quotationTotal)}</strong><small>{drafts.quotation.items.length} line items</small></article>
        <article className="report-stat"><span>Units transmitted</span><strong>{transmittedUnits}</strong><small>{drafts.transmittal.items.length} line items</small></article>
        <article className="report-stat accent"><span>Total entries</span><strong>{totalLineItems}</strong><small>Across all documents</small></article>
      </div>

      <div className="report-content-grid">
        <article className="report-panel document-overview">
          <div className="report-panel-title"><div><h2>Document overview</h2><p>Current draft status and recipient details</p></div></div>
          <div className="report-table-wrap">
            <table className="report-table">
              <thead><tr><th>Document</th><th>Number</th><th>Recipient</th><th>Issued</th><th>Items</th><th>Value / Qty</th><th /></tr></thead>
              <tbody>
                {rows.map(({ type, label, draft, value }) => (
                  <tr key={type}>
                    <td><span className={`report-type-dot ${type}`} />{label}</td>
                    <td>{draft.meta.number}</td><td>{draft.client.name || 'Not specified'}</td>
                    <td>{formatDate(draft.meta.issueDate)}</td><td>{draft.items.length}</td><td><strong>{value}</strong></td>
                    <td><button onClick={() => onOpenDocument(type)}>Open</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </article>

        <article className="report-panel value-comparison">
          <div className="report-panel-title"><div><h2>Financial comparison</h2><p>Invoice and quotation draft values</p></div></div>
          <div className="report-bars">
            <div><div className="report-bar-label"><span>Invoice</span><strong>{peso.format(invoiceTotal)}</strong></div><span className="report-bar-track"><i className="billing" style={{ width: `${(invoiceTotal / maxFinancialValue) * 100}%` }} /></span></div>
            <div><div className="report-bar-label"><span>Quotation</span><strong>{peso.format(quotationTotal)}</strong></div><span className="report-bar-track"><i className="quotation" style={{ width: `${(quotationTotal / maxFinancialValue) * 100}%` }} /></span></div>
          </div>
          <div className="report-session-note"><strong>Current-session report</strong><span>Historical reports will become available once database storage is connected.</span></div>
        </article>
      </div>
    </section>
  );
}

export default function App() {
  const previewRef = useRef(null);
  const [isAuthenticated, setIsAuthenticated] = useState(
    () => sessionStorage.getItem(AUTH_SESSION_KEY) === 'true'
  );
  const [activeType, setActiveType] = useState('billing');
  const company = {
    name: 'HRL IT Services', taxId: '639218182994', address1: '162 D1 Gen. Julian Cruz, Barangka,',
    address2: 'Marikina City, NCR, 1803', country: 'PH',
  };
  const [drafts, setDrafts] = useState(() => ({
    billing: createDraft('billing'),
    quotation: createDraft('quotation'),
    transmittal: createDraft('transmittal'),
  }));
  const [exporting, setExporting] = useState(false);
  const isReports = activeType === 'reports';
  const config = navigationItems[activeType];
  const { client, meta, items } = isReports ? drafts.billing : drafts[activeType];
  const subtotal = useMemo(() => items.reduce(
    (sum, item) => sum + Number(item.price || 0) * Number(item.qty || 0), 0
  ), [items]);
  const itemPages = useMemo(() => paginateItems(items), [items]);

  const updateDraft = (patch) => setDrafts((current) => ({
    ...current, [activeType]: { ...current[activeType], ...patch },
  }));
  const updateMeta = (patch) => updateDraft({ meta: { ...meta, ...patch } });
  const updateClient = (key, value) => updateDraft({ client: { ...client, [key]: value } });
  const updateItem = (id, key, value) => updateDraft({
    items: items.map((item) => (item.id === id ? { ...item, [key]: value } : item)),
  });
  const addItem = () => updateDraft({
    items: [...items, config.isTransmittal
      ? { id: crypto.randomUUID(), qty: 1, description: '', remarks: '' }
      : { id: crypto.randomUUID(), name: 'New Item', description: '', price: 0, qty: 1, tax: '' }],
  });
  const removeItem = (id) => updateDraft({ items: items.filter((item) => item.id !== id) });

  const exportPdf = async () => {
    if (!previewRef.current) return;
    setExporting(true);
    try {
      const pageElements = previewRef.current.querySelectorAll('.invoice-page');
      const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      for (let index = 0; index < pageElements.length; index += 1) {
        const canvas = await html2canvas(pageElements[index], {
          scale: 2.5, useCORS: true, backgroundColor: '#ffffff', logging: false,
        });
        const image = canvas.toDataURL('image/png', 1.0);
        if (index > 0) pdf.addPage('a4', 'portrait');
        pdf.addImage(image, 'PNG', 0, 0, 210, 297, undefined, 'FAST');
      }
      pdf.save(`${meta.number || config.fileFallback}.pdf`);
    } finally {
      setExporting(false);
    }
  };

  const login = () => {
    sessionStorage.setItem(AUTH_SESSION_KEY, 'true');
    setIsAuthenticated(true);
  };

  const logout = () => {
    sessionStorage.removeItem(AUTH_SESSION_KEY);
    setIsAuthenticated(false);
  };

  if (!isAuthenticated) return <LoginScreen onLogin={login} />;

  return (
    <main className="app-shell">
      <header className="app-navigation">
        <div className="app-brand">
          <div><strong>HRL Workspace</strong><span>Documents</span></div>
        </div>
        <nav className="document-nav" aria-label="Document types">
          {Object.entries(navigationItems).map(([type, item]) => (
            <button key={type} className={activeType === type ? 'active' : ''} onClick={() => setActiveType(type)}
              aria-current={activeType === type ? 'page' : undefined}>
              <DocumentIcon type={type} /><span>{item.navLabel}</span>
            </button>
          ))}
        </nav>
        <div className="nav-account">
          <div className="nav-context"><span>{isReports ? 'Viewing' : 'Creating'}</span><strong>{config.title}</strong></div>
          <button className="logout-button" onClick={logout} title="Sign out" aria-label="Sign out">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M10 5H5v14h5M14 8l4 4-4 4M8 12h10" /></svg>
          </button>
        </div>
      </header>

      {isReports ? (
        <ReportsDashboard drafts={drafts} onOpenDocument={setActiveType} />
      ) : (
      <div className="workspace">
        <aside className="editor-panel">
          <div className="editor-header">
            <div>
              <p className="eyebrow">Document builder</p><h1>{config.title}</h1>
              <p className="header-description">Create, preview, and export your {config.title.toLowerCase()}.</p>
            </div>
            <button className="primary" onClick={exportPdf} disabled={exporting}>{exporting ? 'Exporting…' : 'Export PDF'}</button>
          </div>

          <section className="editor-section">
            <h2>{config.title} details</h2>
            <div className="form-grid two">
              <Field label={config.numberLabel}><input value={meta.number} onChange={(e) => updateMeta({ number: e.target.value })} /></Field>
              <Field label="Issue date"><input type="date" value={meta.issueDate} onChange={(e) => {
                const issueDate = e.target.value;
                updateMeta({ issueDate, endDate: addDays(issueDate, activeType === 'quotation' ? 30 : 10) });
              }} /></Field>
              {config.hasEndDate !== false && (
                <Field label={config.dateLabel}><input type="date" value={meta.endDate} onChange={(e) => updateMeta({ endDate: e.target.value })} /></Field>
              )}
            </div>
          </section>

          <section className="editor-section">
            <h2>{config.recipientLabel}</h2>
            <div className="form-grid">
              {Object.entries(client).map(([key, value]) => (
                <Field key={key} label={key.replace(/([A-Z])/g, ' $1').replace(/^./, (s) => s.toUpperCase())}>
                  <input value={value} onChange={(e) => updateClient(key, e.target.value)} />
                </Field>
              ))}
            </div>
          </section>

          <section className="editor-section">
            <div className="section-title-row"><h2>Items</h2><span>{items.length} {items.length === 1 ? 'item' : 'items'}</span></div>
            {items.length === 0 ? (
              <div className="empty-items"><strong>No items yet</strong><span>Add {config.isTransmittal ? 'items to transmit' : `products or services to this ${config.title.toLowerCase()}`}.</span></div>
            ) : (
              <div className="item-edit-list">
                {items.map((item, index) => (
                  <div className="item-card" key={item.id}>
                    <div className="item-card-head"><strong>Item {index + 1}</strong><button className="danger-link" onClick={() => removeItem(item.id)}>Remove</button></div>
                    {config.isTransmittal ? (
                      <div className="form-grid transmittal-fields">
                        <Field label="Qty"><input type="number" min="0" step="1" value={item.qty} onChange={(e) => updateItem(item.id, 'qty', Number(e.target.value))} /></Field>
                        <Field label="Description"><textarea rows="3" value={item.description} onChange={(e) => updateItem(item.id, 'description', e.target.value)} /></Field>
                        <Field label="Remarks"><textarea rows="3" value={item.remarks} onChange={(e) => updateItem(item.id, 'remarks', e.target.value)} /></Field>
                      </div>
                    ) : (
                      <>
                        <div className="form-grid two">
                          <Field label="Name"><input value={item.name} onChange={(e) => updateItem(item.id, 'name', e.target.value)} /></Field>
                          <Field label="Price"><input type="number" min="0" step="0.01" value={item.price} onChange={(e) => updateItem(item.id, 'price', Number(e.target.value))} /></Field>
                          <Field label="Quantity"><input type="number" min="0" step="1" value={item.qty} onChange={(e) => updateItem(item.id, 'qty', Number(e.target.value))} /></Field>
                          <Field label="Tax"><input placeholder="-" value={item.tax} onChange={(e) => updateItem(item.id, 'tax', e.target.value)} /></Field>
                        </div>
                        <Field label="Description"><textarea rows="2" value={item.description} onChange={(e) => updateItem(item.id, 'description', e.target.value)} /></Field>
                      </>
                    )}
                  </div>
                ))}
              </div>
            )}
            <button className="secondary add-item-bottom" onClick={addItem}>+ Add item</button>
          </section>

          <section className="editor-section">
            <h2>Document footer</h2>
            <div className="form-grid">
              <Field label={`${config.title} message`}><input value={meta.footerMessage} onChange={(e) => updateMeta({ footerMessage: e.target.value })} /></Field>
              {config.isTransmittal && (
                <div className="form-grid two">
                  <Field label="Received by"><input value={meta.receivedBy} onChange={(e) => updateMeta({ receivedBy: e.target.value })} placeholder="Recipient's name" /></Field>
                  <Field label="Date received"><input type="date" value={meta.receivedDate} onChange={(e) => updateMeta({ receivedDate: e.target.value })} /></Field>
                </div>
              )}
              <Field label="Generated on"><input value={meta.generatedAt} onChange={(e) => updateMeta({ generatedAt: e.target.value })} /></Field>
            </div>
          </section>
        </aside>

        <section className="preview-area">
          <div className="preview-toolbar"><span className="live-dot" /> Live A4 preview <span>PDF export matches this page</span></div>
          <div className="invoice-pages" ref={previewRef}>
            {itemPages.map((pageItems, pageIndex) => {
              const isLastPage = pageIndex === itemPages.length - 1;
              return (
                <div className={`invoice-page ${activeType}`} key={pageItems[0]?.id || pageIndex}>
                  <header className="invoice-top"><h2>{config.heading}</h2></header>
                  <div className="top-divider" />
                  <section className="brand-row">
                    <img src={logoUrl} alt="HRL IT Services" className="brand-logo" />
                    <div className="company-details"><strong>{company.name}</strong><span>{company.taxId}</span><span>{company.address1}</span><span>{company.address2}</span><span>{company.country}</span></div>
                  </section>
                  <div className="soft-divider" />
                  <section className="invoice-meta-grid">
                    <div className="bill-to"><strong>{config.previewRecipientLabel}</strong><span>{client.name}</span><span>{client.email}</span><span>{client.address1}</span><span>{client.address2}</span><span>{client.country}</span></div>
                    <div className="meta-block"><strong>{config.previewNumberLabel}</strong><span>{meta.number}</span></div>
                    <div className="meta-block"><strong>Issue Date</strong><span>{formatDate(meta.issueDate)}</span>{config.hasEndDate !== false && <><strong className="due-label">{config.previewDateLabel}</strong><span>{formatDate(meta.endDate)}</span></>}</div>
                  </section>
                  <section className={`invoice-table ${config.isTransmittal ? 'transmittal-table' : ''}`}>
                    {config.isTransmittal ? (
                      <div className="table-head"><span>QTY</span><span>DESCRIPTION</span><span>REMARKS</span></div>
                    ) : (
                      <div className="table-head"><span>ITEM NAME</span><span>PRICE</span><span>QTY.</span><span>TAX</span><span>SUBTOTAL</span></div>
                    )}
                    <div className="accent-line" />
                    {pageItems.length === 0 ? <div className="preview-empty">Items added in the editor will appear here.</div> : pageItems.map((item) => config.isTransmittal ? (
                      <div className="invoice-item" key={item.id}>
                        <span className="transmittal-qty">{item.qty}</span>
                        <span className="transmittal-description">{item.description || '—'}</span>
                        <span className="transmittal-remarks">{item.remarks || '-'}</span>
                      </div>
                    ) : (
                      <div className="invoice-item" key={item.id}>
                        <div className="item-main"><strong>{item.name || '—'}</strong>{item.description && <p>{item.description}</p>}</div>
                        <span className="numeric strong">{peso.format(Number(item.price || 0))}</span>
                        <span className="numeric">{item.qty}</span><span className="numeric muted">{item.tax || '-'}</span>
                        <span className="numeric strong">{peso.format(Number(item.price || 0) * Number(item.qty || 0))}</span>
                      </div>
                    ))}
                  </section>
                  {isLastPage && !config.isTransmittal && <section className="totals-wrap"><div className="totals-row grand-total"><span>{config.totalLabel}</span><strong>{peso.format(subtotal)}</strong></div></section>}
                  {isLastPage && meta.footerMessage && <section className="invoice-message"><strong>{meta.footerMessage}</strong><span>{activeType === 'quotation' ? 'This quotation is valid until the date shown above.' : activeType === 'transmittal' ? 'Received in good order and condition.' : 'We appreciate the opportunity to serve you.'}</span></section>}
                  {isLastPage && config.isTransmittal && (
                    <section className="receipt-acknowledgment">
                      <div><span>{meta.receivedBy || '\u00a0'}</span><strong>Received By</strong></div>
                      <div><span>{meta.receivedDate ? formatDate(meta.receivedDate) : '\u00a0'}</span><strong>Date</strong></div>
                    </section>
                  )}
                  <footer className="invoice-footer"><span>Generated on {meta.generatedAt}</span><span>Page {pageIndex + 1} of {itemPages.length}</span></footer>
                </div>
              );
            })}
          </div>
        </section>
      </div>
      )}
    </main>
  );
}
