# PROJEKTIK

Browser-first projection mapping application with a project dashboard, editor, and separate projection output. Projects are stored locally in the browser with explicit import/export.

Open `index.html` to use the dashboard. Keep `editor.html`, `projection.html`, `js/`, and `design-system/` in the same directory layout. A static HTTP server can also serve this directory; browser storage belongs to its origin, so changing origins does not transfer saved projects automatically.

Run these commands from this repository directory using Node.js and npm (validated with Node 24.14.1):

```text
npm ci
npx playwright install chromium
npm test
```

Install the browser explicitly when it is not already present. `npm run smoke` uses Node built-ins and does not need dependency installation; `npm run test:browser` requires project dependencies and Chromium. Browser tests open local page files without a dev server. No separate build/lint command is configured.

| Path | Purpose |
| --- | --- |
| HTML pages, `js/`, `design-system/` | Application inputs |
| `_tools/` | Required smoke harness and its guide |
| `tests/`, `playwright.config.js` | Required browser regression checks |
| `package.json`, `package-lock.json` | Reproducible development dependency setup |
| `test-results/`, `playwright-report/` | Ignored generated test output |

See [AGENTS.md](AGENTS.md) for product engineering constraints. Optional workspace plans and history are at `../_docs/README.md`, which may be absent in clones and is not a runtime/test dependency.

No hosting provider configuration is supplied here. Publish intended static inputs; development tools/tests need not ship. Git ignore rules alone do not control deployment.
