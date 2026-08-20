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
  return type === 'billing' ? (
    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 3h12v18l-3-2-3 2-3-2-3 2V3Zm3 5h6M9 12h6" /></svg>
  ) : (
    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 3h9l3 3v15H6V3Zm9 0v4h4M9 11h6M9 15h4" /></svg>
  );
}

function estimateItemHeight(item) {
  const nameLines = Math.max(1, Math.ceil(String(item.name || '').length / 30));
  const description = String(item.description || '');
  const descriptionLines = description
    ? description.split('\n').reduce((lines, part) => lines + Math.max(1, Math.ceil(part.length / 42)), 0) : 0;
  return Math.max(83, 49 + nameLines * 18 + descriptionLines * 19);
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
  const [drafts, setDrafts] = useState(() => ({ billing: createDraft('billing'), quotation: createDraft('quotation') }));
  const [exporting, setExporting] = useState(false);
  const config = documentTypes[activeType];
  const { client, meta, items } = drafts[activeType];
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
    items: [...items, { id: crypto.randomUUID(), name: 'New Item', description: '', price: 0, qty: 1, tax: '' }],
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
          {Object.entries(documentTypes).map(([type, item]) => (
            <button key={type} className={activeType === type ? 'active' : ''} onClick={() => setActiveType(type)}
              aria-current={activeType === type ? 'page' : undefined}>
              <DocumentIcon type={type} /><span>{item.navLabel}</span>
            </button>
          ))}
        </nav>
        <div className="nav-account">
          <div className="nav-context"><span>Creating</span><strong>{config.title}</strong></div>
          <button className="logout-button" onClick={logout} title="Sign out" aria-label="Sign out">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M10 5H5v14h5M14 8l4 4-4 4M8 12h10" /></svg>
          </button>
        </div>
      </header>

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
              <Field label={config.dateLabel}><input type="date" value={meta.endDate} onChange={(e) => updateMeta({ endDate: e.target.value })} /></Field>
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
              <div className="empty-items"><strong>No items yet</strong><span>Add products or services to this {config.title.toLowerCase()}.</span></div>
            ) : (
              <div className="item-edit-list">
                {items.map((item, index) => (
                  <div className="item-card" key={item.id}>
                    <div className="item-card-head"><strong>Item {index + 1}</strong><button className="danger-link" onClick={() => removeItem(item.id)}>Remove</button></div>
                    <div className="form-grid two">
                      <Field label="Name"><input value={item.name} onChange={(e) => updateItem(item.id, 'name', e.target.value)} /></Field>
                      <Field label="Price"><input type="number" min="0" step="0.01" value={item.price} onChange={(e) => updateItem(item.id, 'price', Number(e.target.value))} /></Field>
                      <Field label="Quantity"><input type="number" min="0" step="1" value={item.qty} onChange={(e) => updateItem(item.id, 'qty', Number(e.target.value))} /></Field>
                      <Field label="Tax"><input placeholder="-" value={item.tax} onChange={(e) => updateItem(item.id, 'tax', e.target.value)} /></Field>
                    </div>
                    <Field label="Description"><textarea rows="2" value={item.description} onChange={(e) => updateItem(item.id, 'description', e.target.value)} /></Field>
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
                    <div className="meta-block"><strong>Issue Date</strong><span>{formatDate(meta.issueDate)}</span><strong className="due-label">{config.previewDateLabel}</strong><span>{formatDate(meta.endDate)}</span></div>
                  </section>
                  <section className="invoice-table">
                    <div className="table-head"><span>ITEM NAME</span><span>PRICE</span><span>QTY.</span><span>TAX</span><span>SUBTOTAL</span></div>
                    <div className="accent-line" />
                    {pageItems.length === 0 ? <div className="preview-empty">Items added in the editor will appear here.</div> : pageItems.map((item) => (
                      <div className="invoice-item" key={item.id}>
                        <div className="item-main"><strong>{item.name || '—'}</strong>{item.description && <p>{item.description}</p>}</div>
                        <span className="numeric strong">{peso.format(Number(item.price || 0))}</span>
                        <span className="numeric">{item.qty}</span><span className="numeric muted">{item.tax || '-'}</span>
                        <span className="numeric strong">{peso.format(Number(item.price || 0) * Number(item.qty || 0))}</span>
                      </div>
                    ))}
                  </section>
                  {isLastPage && <section className="totals-wrap"><div className="totals-row grand-total"><span>{config.totalLabel}</span><strong>{peso.format(subtotal)}</strong></div></section>}
                  {isLastPage && meta.footerMessage && <section className="invoice-message"><strong>{meta.footerMessage}</strong><span>{activeType === 'quotation' ? 'This quotation is valid until the date shown above.' : 'We appreciate the opportunity to serve you.'}</span></section>}
                  <footer className="invoice-footer"><span>Generated on {meta.generatedAt}</span><span>Page {pageIndex + 1} of {itemPages.length}</span></footer>
                </div>
              );
            })}
          </div>
        </section>
      </div>
    </main>
  );
}
