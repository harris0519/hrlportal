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

The invoice preview is rendered as an A4 page and exported to PDF using `html2canvas` + `jsPDF`.
