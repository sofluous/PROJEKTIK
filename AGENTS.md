# Projektik Development

Read [README](README.md) for setup, commands, and folder ownership.

- Preserve the dashboard/editor/projection workflow and local-first project persistence. Save/load/import/export, media recovery, and projection session state must remain compatible when changing contracts.
- Runtime modules live in `js/`; page entry points are `index.html`, `editor.html`, and `projection.html`. Required smoke harness lives in `_tools/`; Playwright discovers `tests/` through `playwright.config.js`. Keep these inputs repository-owned.
- Run `npm test` from this directory. `npm run smoke` covers syntax/DOM/storage checks; `npm run test:browser` runs Chromium regression tests. No separate build or lint script is configured. Report missing browser/dependency prerequisites rather than claiming unrun checks.
- Follow applicable parent instructions when available. Optional local context lives at `../_docs/README.md`; normal application/test workflows must not require those outer files. Essential setup and check commands remain in this repository for clones.
- Preserve unrelated worktree changes; do not stage or reset them automatically. Validate persistence and error/recovery behavior when affected.
