# HRL Invoice Builder

A React/Vite invoice editor based on the supplied HRL IT Services billing layout, translated to English.

## Run locally

```bash
npm install
npm run dev
```

Open the local URL shown by Vite. Edit invoice details in the left panel and click **Export PDF**.

## Production build

```bash
npm run build
npm run preview
```

The document preview is rendered as an A4 page and exported to PDF using `html2canvas` + `jsPDF`.

## Email documents

Billing, quotations, and transmittals each have a **Send email** button. The dialog lets you review the recipient, subject, message, and branded email preview. The current A4 document is attached as a PDF. Email is sent through Brevo's transactional API by the Node server in the repository root. The Brevo key is never placed in the browser bundle.

Use Node.js 22 or later. From the repository root, copy `.env.example` to `.env.local` and set:

- `BREVO_API_KEY`: the new Brevo transactional API key.
- `HRL_SENDER_EMAIL`: an HRL sender address verified in Brevo.
- `HRL_EMAIL_ACCESS_CODE`: a separate private code for staff to enter in the send dialog. Do not use the Brevo key here.
- `ALLOWED_ORIGINS`: comma-separated exact portal origins, such as `http://localhost:5173` for local development.

Run `npm run dev:api` and `npm run dev` in separate terminals. Vite proxies `/api/send-document` to the local server. Run `npm test` to check validation, escaping, provider requests, and access control.

The GitHub Pages deployment serves only static files. Deploy `server/`, `hrl-invoice-react/src/documentEmail.js`, and the root `package.json` to a Node host with `npm run start:api`; set the three server secrets and `ALLOWED_ORIGINS` there. Set the GitHub Actions repository variable `VITE_EMAIL_API_URL` to that host's HTTPS `/api/send-document` URL, then rebuild the portal. If the portal and API share one origin through a reverse proxy, leave that variable empty.

### Render setup

After pushing these changes to GitHub, create a **Web Service** connected to `harris0519/hrlportal`. Use the repository root (leave Root Directory empty), Node runtime, Build Command `npm ci`, and Start Command `npm run start:api`. Render supplies `PORT`; do not copy the local `PORT=3001` setting. Set the health check path to `/health` if offered.

In the service's **Environment** page set `BREVO_API_KEY`, `HRL_SENDER_EMAIL`, `HRL_EMAIL_ACCESS_CODE`, and `ALLOWED_ORIGINS`. The origin is only the scheme and host of the portal, with no `/hrlportal/` path; for the default GitHub Pages URL of this repository it is `https://harris0519.github.io`. You may also set `NODE_VERSION=22` to pin the runtime. Keep the API key and staff code in Render's environment settings, not GitHub Actions variables.

When Render reports the service live, open `https://YOUR-SERVICE.onrender.com/health` and expect `{"status":"ok"}`. Then set the GitHub repository Actions variable `VITE_EMAIL_API_URL` to `https://YOUR-SERVICE.onrender.com/api/send-document` and rerun the Pages deployment. The email button sends to the API after the site has been rebuilt with that variable.

The existing portal sign-in is temporary browser-side access. The email endpoint separately checks the staff send code and limits requests per IP. Replace the browser-side sign-in with server authentication before using the portal for sensitive customer records.
