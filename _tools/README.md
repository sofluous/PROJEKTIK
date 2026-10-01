# PROJEKTIK Tools

Small local development utilities for restart stabilization.

## Smoke Checks

Run from the project root:

```powershell
node _tools\projektik-smoke.js
```

The smoke harness checks:

- external JavaScript and editor inline script syntax
- inline `getElementById` references against page markup
- dashboard and projection view script references against their pages
- project-store save, load, duplicate, import, export, and delete behavior

It does not replace browser testing. Use it before running the manual browser checklist in `_docs/data/SMOKE_CHECKLIST_2026-09-30.md`.

## Browser Smoke Tests

After installing dev dependencies, run from the project root:

```powershell
npm run test:browser
```

To run the full local test gate:

```powershell
npm test
```

The browser tests live in `tests/browser-smoke.spec.js` and cover dashboard boot, new project/editor boot, browser project-store metadata rendering, and projection snapshot rendering.
