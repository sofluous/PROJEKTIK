#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const vm = require("vm");

const ROOT = path.resolve(__dirname, "..");

function readProjectFile(relativePath) {
  return fs.readFileSync(path.join(ROOT, relativePath), "utf8");
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function logPass(message) {
  console.log(`PASS ${message}`);
}

function getInlineScripts(html) {
  return Array.from(html.matchAll(/<script>([\s\S]*?)<\/script>/g), (match) => match[1]);
}

function getIds(markup) {
  return new Set(Array.from(markup.matchAll(/id="([^"]+)"/g), (match) => match[1]));
}

function getGetElementByIdRefs(source) {
  return new Set(Array.from(source.matchAll(/getElementById\("([^"]+)"\)/g), (match) => match[1]));
}

function checkSyntax() {
  [
    "js/app-bootstrap.js",
    "js/project-store.js",
    "js/projection-session.js",
    "js/views/dashboard.js",
    "js/views/editor.js",
    "js/views/projection.js"
  ].forEach((file) => {
    new Function(readProjectFile(file));
  });

  getInlineScripts(readProjectFile("editor.html")).forEach((script) => {
    new Function(script);
  });

  logPass("script syntax parses");
}

function checkLocalDomReferences() {
  ["index.html", "editor.html", "projection.html"].forEach((file) => {
    const markup = readProjectFile(file);
    const ids = getIds(markup);
    const missing = Array.from(getGetElementByIdRefs(markup))
      .filter((id) => !ids.has(id))
      .sort();

    assert(!missing.length, `${file} has missing inline DOM ids: ${missing.join(", ")}`);
  });

  logPass("inline DOM id references exist");
}

function checkExternalViewDomReferences() {
  [
    ["index.html", "js/views/dashboard.js"],
    ["projection.html", "js/views/projection.js"]
  ].forEach(([htmlFile, jsFile]) => {
    const ids = getIds(readProjectFile(htmlFile));
    const missing = Array.from(getGetElementByIdRefs(readProjectFile(jsFile)))
      .filter((id) => !ids.has(id))
      .sort();

    assert(!missing.length, `${jsFile} references ids missing from ${htmlFile}: ${missing.join(", ")}`);
  });

  logPass("external view DOM id references exist");
}

function checkStorageKeyWiring() {
  const dashboardSource = readProjectFile("js/views/dashboard.js");
  const storeSource = readProjectFile("js/project-store.js");

  assert(storeSource.includes('"projektik.projects.index.v1"'), "project-store index key changed; update dashboard storage smoke check");
  assert(storeSource.includes('"projektik.project.v1."'), "project-store project key prefix changed; update dashboard storage smoke check");
  assert(dashboardSource.includes('"projektik.projects."'), "dashboard does not listen for project index storage changes");
  assert(dashboardSource.includes('"projektik.project."'), "dashboard does not listen for project record storage changes");
  assert(!dashboardSource.includes("projektik:"), "dashboard still checks the obsolete projektik: storage prefix");

  logPass("dashboard storage-key wiring matches project-store prefixes");
}

function checkDashboardRenderHardening() {
  const dashboardSource = readProjectFile("js/views/dashboard.js");

  assert(dashboardSource.includes("function escapeHtml"), "dashboard is missing HTML escaping helper");
  assert(dashboardSource.includes("function escapeCssUrl"), "dashboard is missing CSS URL escaping helper");
  assert(dashboardSource.includes("function isSafeThumbnailDataUrl"), "dashboard is missing thumbnail data URL guard");
  assert(!dashboardSource.includes("<h3 class=\"pk-card-title\">${project.name}</h3>"), "dashboard renders project names without escaping");
  assert(!dashboardSource.includes("${project.projectorModel}"), "dashboard renders projector model without escaping");
  assert(!dashboardSource.includes("project.thumbnailDataUrl.replace"), "dashboard still uses ad hoc thumbnail escaping");

  logPass("dashboard project-card rendering is escaped");
}

function checkDashboardImportFeedback() {
  const dashboardSource = readProjectFile("js/views/dashboard.js");
  const dashboardMarkup = readProjectFile("index.html");

  assert(dashboardSource.includes("function getProjectImportErrorMessage"), "dashboard is missing import error message helper");
  assert(dashboardSource.includes("function setDashboardStatus"), "dashboard is missing inline status helper");
  assert(dashboardMarkup.includes('id="dashboardStatus"'), "dashboard is missing inline status region");
  assert(dashboardSource.includes("not valid JSON"), "dashboard import feedback does not identify malformed JSON");
  assert(dashboardSource.includes("not a recognized PROJEKTIK project"), "dashboard import feedback does not identify invalid project payloads");
  assert(!dashboardSource.includes("global.alert"), "dashboard import feedback still uses blocking alerts");

  logPass("dashboard import errors are specific");
}

function checkEditorOverlayThemeUsage() {
  const editorMarkup = readProjectFile("editor.html");

  assert(editorMarkup.includes("--pk-overlay-panel-bg: color-mix(in oklab, var(--ds-bg-overlay)"), "editor overlay panel background is not theme-derived");
  assert(editorMarkup.includes("--pk-overlay-panel-bg-soft: color-mix(in oklab, var(--ds-control-surface-bg"), "editor overlay control background is not control-surface derived");
  assert(editorMarkup.includes("--pk-overlay-panel-border: color-mix(in oklab, var(--ds-control-surface-border"), "editor overlay border is not control-surface derived");
  assert(editorMarkup.includes("--pk-overlay-shadow-md: var(--ds-card-shadow)"), "editor overlay shadow is not design-system derived");
  assert(editorMarkup.includes("gap: var(--ds-control-surface-gap);"), "editor overlay controls do not use design-system spacing");
  assert(editorMarkup.includes("border-radius: var(--ds-control-surface-radius);"), "editor overlay controls do not use design-system radius");
  assert(!editorMarkup.includes("rgba(7, 11, 17"), "editor overlay controls still use the old fixed dark panel color");

  logPass("editor overlay controls use theme tokens");
}

function checkEditorInspectorCopy() {
  const editorMarkup = readProjectFile("editor.html");

  assert(editorMarkup.includes('<div class="pk-eyebrow">Settings</div>'), "project inspector still uses a redundant Project Settings heading");
  assert(editorMarkup.includes('<div class="pk-prop-section-head">Geometry</div>'), "surface inspector geometry section label is missing");
  assert(editorMarkup.includes('<label for="assetFitMode">Mode</label>'), "asset placement map mode label is still redundant");
  assert(editorMarkup.includes('<span class="pk-hidden-label">Surface controls</span>'), "surface control label is not preserved for assistive tech");
  assert(!editorMarkup.includes('<div class="pk-eyebrow">Surface</div>'), "surface inspector repeats the selected object type visibly");
  assert(!editorMarkup.includes('<div class="pk-eyebrow">Layer</div>'), "layer inspector repeats the selected object type visibly");
  assert(!editorMarkup.includes('<div class="pk-eyebrow">Reference</div>'), "reference inspector repeats the selected object type visibly");
  assert(!editorMarkup.includes('<div class="pk-eyebrow">Asset Placement</div>'), "asset inspector repeats placement heading visibly");

  logPass("editor inspector copy avoids redundant visible headings");
}

function checkEditorControlPolish() {
  const editorMarkup = readProjectFile("editor.html");

  assert(editorMarkup.includes("width: var(--ds-icon-action-size);"), "icon controls are missing shared width sizing");
  assert(editorMarkup.includes("height: var(--ds-icon-action-size);"), "icon controls are missing shared height sizing");
  assert(editorMarkup.includes("grid-template-columns: 48px minmax"), "editor shell is missing the left navigation rail column");
  assert(editorMarkup.includes("gap: 0;"), "editor shell should use edge-anchored panels without gutters");
  assert(editorMarkup.includes('class="pk-nav-rail"'), "editor is missing the primary navigation rail");
  assert(editorMarkup.includes('id="homeDashboardBtn"'), "editor rail is missing the gallery/home action");
  assert(editorMarkup.includes(".pk-stage-header {") && editorMarkup.includes("display: none;"), "canvas header should not be visible when the floating toolbar owns canvas actions");
  assert(editorMarkup.includes("bottom: 14px;"), "canvas toolbar should be anchored near the bottom like a design-tool toolbar");
  assert(editorMarkup.includes(".pk-overlay-controls .pk-icon-btn"), "overlay toolbar icons are missing explicit readable sizing");
  assert(editorMarkup.includes(".pk-panel-right .ds-select"), "panel selects are missing shared truncation/readability rules");
  assert(editorMarkup.includes("grid-template-columns: repeat(2, minmax(0, 1fr));"), "inspector fields are not using compact side-by-side property grids");
  assert(editorMarkup.includes('<span class="pk-unit">deg</span>'), "rotation inspector field does not expose degree units");
  assert(editorMarkup.includes('class="pk-scrub-control is-percent"'), "opacity scrub controls do not expose percent units");
  assert(!editorMarkup.includes('<span class="pk-unit">px</span>'), "inferred pixel inspector fields still show noisy px units");
  assert(!editorMarkup.includes('class="pk-inline-metric is-wide-label"'), "inspector still uses the old wide-label unit workaround");
  assert(!editorMarkup.includes("<span>Deg</span>"), "rotation unit is still used as the field label");

  logPass("editor controls use consistent units and sizing");
}

function createLocalStorage() {
  const data = new Map();
  return {
    getItem(key) {
      return data.has(key) ? data.get(key) : null;
    },
    setItem(key, value) {
      data.set(String(key), String(value));
    },
    removeItem(key) {
      data.delete(key);
    },
    clear() {
      data.clear();
    },
    key(index) {
      return Array.from(data.keys())[index] || null;
    },
    get length() {
      return data.size;
    }
  };
}

function loadStoreContext() {
  const context = {
    Blob,
    URL: {
      createObjectURL() {
        return "blob:projektik-smoke";
      },
      revokeObjectURL() {}
    },
    document: {
      body: {
        append() {}
      },
      createElement() {
        return {
          click() {},
          remove() {}
        };
      }
    },
    localStorage: createLocalStorage(),
    window: {}
  };
  context.window = context;
  vm.createContext(context);
  vm.runInContext(readProjectFile("js/project-store.js"), context, {
    filename: "js/project-store.js"
  });
  return context;
}

function checkProjectStore() {
  const context = loadStoreContext();
  const store = context.ProjektikStore;

  assert(store, "ProjektikStore did not initialize");

  const summary = store.saveProject({
    project: {
      id: "project-smoke",
      name: "Smoke Project",
      settings: {
        projectorModel: "Test Projector"
      }
    },
    output: {
      width: 1280,
      height: 720
    },
    assets: [{ id: "asset-1", name: "Image" }],
    layers: [{ id: "layer-1", name: "Layer" }],
    surfaces: [{ key: "surface-1", name: "Surface" }]
  });

  assert(summary.id === "project-smoke", "saveProject returned the wrong summary id");
  assert(summary.outputWidth === 1280, "saveProject summary did not preserve output width");
  assert(summary.outputHeight === 720, "saveProject summary did not preserve output height");
  assert(summary.projectorModel === "Test Projector", "saveProject summary did not preserve projector model");

  const loaded = store.loadProject("project-smoke");
  assert(loaded.project.name === "Smoke Project", "loadProject did not preserve project name");
  assert(loaded.output.width === 1280, "loadProject did not preserve output width");
  assert(loaded.ui.focus.type === "calibration", "loadProject did not apply default focus");

  const duplicateId = store.duplicateProject("project-smoke");
  assert(duplicateId && duplicateId !== "project-smoke", "duplicateProject did not create a new id");
  assert(store.listProjects().length === 2, "duplicateProject did not update the project index");

  const importedId = store.importProjectEnvelope({
    project: {
      id: "external-id",
      name: "Imported Source"
    },
    output: {
      width: 800,
      height: 600
    }
  });
  assert(importedId !== "external-id", "importProjectEnvelope should create a local project id");
  assert(store.loadProject(importedId).project.name === "Imported Source", "importProjectEnvelope did not preserve project name");

  const exported = JSON.parse(store.exportProject("project-smoke"));
  assert(exported.project.id === "project-smoke", "exportProject returned the wrong project");

  store.deleteProject("project-smoke");
  assert(store.loadProject("project-smoke") === null, "deleteProject did not remove the project");

  logPass("project-store save/load/duplicate/import/export/delete works");
}

function main() {
  checkSyntax();
  checkLocalDomReferences();
  checkExternalViewDomReferences();
  checkStorageKeyWiring();
  checkDashboardRenderHardening();
  checkDashboardImportFeedback();
  checkEditorOverlayThemeUsage();
  checkEditorInspectorCopy();
  checkEditorControlPolish();
  checkProjectStore();
  console.log("PASS projektik smoke checks complete");
}

main();
