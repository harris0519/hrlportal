# HRL Invoice Builder

A React/Vite invoice editor based on the supplied HRL IT Services billing layout, translated to English.

## Run locally

```bash
npm install
npm run dev
```

Open the local URL shown by Vite. Local development keeps the temporary browser-side sign-in, so signing in does not require the API server. Edit invoice details in the left panel and click **Export PDF**. The hosted portal uses server-side sign-in with separate credentials.

## Production build

```bash
npm run build
npm run preview
```

The document preview is rendered as an A4 page and exported to PDF using `html2canvas` + `jsPDF`.

## Email documents

Billing, quotations, and transmittals each have a **Send email** button. The dialog lets you review the recipient, optional comma-separated CC addresses, subject, message, and branded email preview. The current A4 document is attached as a PDF. Email is sent through Brevo's transactional API by the Node server in the repository root. The Brevo key is never placed in the browser bundle.

Use Node.js 22 or later. From the repository root, copy `.env.example` to `.env.local` and set:

- `BREVO_API_KEY`: the new Brevo transactional API key.
- `HRL_SENDER_EMAIL`: an HRL sender address verified in Brevo.
- `ALLOWED_ORIGINS`: comma-separated exact portal origins, such as `http://localhost:5173` for local development.

Run `npm run dev:api` and `npm run dev` in separate terminals. Vite proxies `/api/send-document` to the local server. The email endpoint accepts requests only from this computer and needs no separate send code. Run `npm test` to check validation, escaping, provider requests, and origin handling.

## Hosted portal and email

GitHub Pages serves the frontend. Its deployment workflow builds with `VITE_EMAIL_API_URL=https://hrlportal.onrender.com/api/send-document`, so hosted sign-in and email both use the HRL Render web service. The browser sends a session token after sign-in; the Brevo key and admin password stay on the server.

For the `hrlportal.onrender.com` service, use the repository root, Node.js 22 or later, Build Command `npm ci`, and Start Command `npm run start:api`. Set these values in that service's **Environment** page:

- `BREVO_API_KEY`: the Brevo transactional API key.
- `HRL_SENDER_EMAIL`: the verified sender address.
- `HRL_ADMIN_USERNAME`: the hosted portal username (defaults to `hrl.admin`).
- `HRL_ADMIN_PASSWORD`: a private password different from the temporary local password. Hosted sign-in stays unavailable until this is set.
- `ALLOWED_ORIGINS`: `https://harris0519.github.io` for the GitHub Pages portal.
- `NODE_ENV`: `production` if Render has not set it automatically.

The same server also exposes `POST /api/contact` for the Oliva & Partners website. This public route accepts inquiries from `https://dof.law` and `https://www.dof.law` without a portal sign-in, validates the fields, limits requests, and sends a branded email to `olivaandpartners@dof.law`. Set `OLP_SENDER_EMAIL` and `OLP_CONTACT_EMAIL` in Render's Environment page to override the defaults in `.env.example`; the default sender is `hlazaro@socexconsulting.com`. The site should use `https://hrlportal.onrender.com/api/contact` as its `VITE_CONTACT_API_URL` repository variable.

Set `/health` as the Render health check path if available. The hosted server listens on Render's `PORT` and requires a sign-in session for `/api/send-document`; sessions expire after eight hours or when the service restarts. The email endpoint limits requests per IP. After updating the service and Pages deployment, check `https://hrlportal.onrender.com/health`, sign in on GitHub Pages with the hosted credentials, and send a document to an address you control for the final delivery check.
