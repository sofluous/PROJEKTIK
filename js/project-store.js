(function initProjektikStore() {
  const CURRENT_SCHEMA_VERSION = 1;
  const STORAGE_INDEX_KEY = "projektik.projects.index.v1";
  const PROJECT_KEY_PREFIX = "projektik.project.v1.";
  const DEFAULT_PROJECT_SETTINGS = {
    projectorModel: "",
    outputPreset: "1920x1080",
    projectorNativeWidth: 1920,
    projectorNativeHeight: 1080,
    projectorDistance: "",
    projectionWidth: "",
    projectionHeight: "",
    notes: "",
    theme: "tech-grid"
  };
  const DEFAULT_UI_STATE = {
    leftPanelTab: "workspace",
    expandedLayerIds: [],
    calibrationEditActive: false,
    presentationEnabled: false,
    calibrationLinkEnabled: true,
    guidesEnabled: true,
    playbackRunning: false,
    showReferenceLayer: false,
    focus: {
      type: "calibration",
      id: "calibration-parent"
    },
    assetLibraryId: ""
  };
  const DEFAULT_PROJECTION_VIEW = {
    windowOpen: false,
    preset: "live-output",
    pinnedLayerId: null,
    pinnedSurfaceKey: null,
    showGuides: false,
    showReference: false,
    showCalibration: false
  };
  const DEFAULT_CALIBRATION = {
    x: 0,
    y: 0,
    scaleX: 1,
    scaleY: 1,
    rotation: 0
  };
  const DEFAULT_CALIBRATION_TEMPLATE = {
    gridType: "line",
    gridSize: 48,
    rows: 12,
    columns: 16,
    showFrame: true,
    showMatrixLabels: false,
    referenceAssetId: null,
    referenceOpacity: 100
  };
  const DEFAULT_CALIBRATION_REFERENCE = {
    assetId: null,
    surfaceKey: null,
    visible: false,
    visibilityMode: "both",
    fitMode: "surface",
    opacity: 100,
    locked: false
  };
  const DEFAULT_OUTPUT = {
    width: 1920,
    height: 1080
  };

  function nowIso() {
    return new Date().toISOString();
  }

  function createId(prefix = "project") {
    const randomPart = Math.random().toString(36).slice(2, 8);
    return `${prefix}-${Date.now().toString(36)}-${randomPart}`;
  }

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function normalizeArray(value) {
    return Array.isArray(value) ? clone(value) : [];
  }

  function normalizeFocus(value) {
    if (!value || typeof value !== "object" || !value.type) {
      return clone(DEFAULT_UI_STATE.focus);
    }
    return {
      type: String(value.type),
      id: value.id || ""
    };
  }

  function normalizeProjectEnvelope(envelope, options = {}) {
    const nextEnvelope = clone(envelope || {});
    const timestamp = nowIso();
    const project = nextEnvelope.project || {};
    const imported = options.imported === true;

    nextEnvelope.schemaVersion = Number(nextEnvelope.schemaVersion) || CURRENT_SCHEMA_VERSION;
    nextEnvelope.project = {
      id: imported ? createId("project") : project.id || createId("project"),
      name: project.name || (imported ? "Imported Project" : "Untitled Project"),
      createdAt: imported ? timestamp : project.createdAt || timestamp,
      updatedAt: imported ? timestamp : project.updatedAt || timestamp,
      thumbnailDataUrl: project.thumbnailDataUrl || "",
      schemaVersion: nextEnvelope.schemaVersion,
      settings: {
        ...DEFAULT_PROJECT_SETTINGS,
        ...(project.settings || {})
      }
    };

    nextEnvelope.ui = {
      ...DEFAULT_UI_STATE,
      ...(nextEnvelope.ui || {}),
      expandedLayerIds: Array.isArray(nextEnvelope.ui?.expandedLayerIds) ? nextEnvelope.ui.expandedLayerIds.slice() : [],
      focus: normalizeFocus(nextEnvelope.ui?.focus),
      assetLibraryId: nextEnvelope.ui?.assetLibraryId || ""
    };

    nextEnvelope.projectionView = {
      ...DEFAULT_PROJECTION_VIEW,
      ...(nextEnvelope.projectionView || {})
    };
    nextEnvelope.calibration = {
      ...DEFAULT_CALIBRATION,
      ...(nextEnvelope.calibration || {})
    };
    nextEnvelope.calibrationTemplate = {
      ...DEFAULT_CALIBRATION_TEMPLATE,
      ...(nextEnvelope.calibrationTemplate || {})
    };
    nextEnvelope.calibrationReference = {
      ...DEFAULT_CALIBRATION_REFERENCE,
      ...(nextEnvelope.calibrationReference || {})
    };
    nextEnvelope.output = {
      ...DEFAULT_OUTPUT,
      ...(nextEnvelope.output || {})
    };
    nextEnvelope.assets = normalizeArray(nextEnvelope.assets);
    nextEnvelope.layers = normalizeArray(nextEnvelope.layers);
    nextEnvelope.surfaces = normalizeArray(nextEnvelope.surfaces);
    return nextEnvelope;
  }

  function getProjectKey(projectId) {
    return `${PROJECT_KEY_PREFIX}${projectId}`;
  }

  function safeParse(raw, fallback) {
    if (!raw) {
      return fallback;
    }
    try {
      return JSON.parse(raw);
    } catch (error) {
      return fallback;
    }
  }

  function getIndex() {
    return safeParse(localStorage.getItem(STORAGE_INDEX_KEY), []);
  }

  function setIndex(index) {
    localStorage.setItem(STORAGE_INDEX_KEY, JSON.stringify(index));
  }

  function summarizeEnvelope(envelope) {
    const normalized = normalizeProjectEnvelope(envelope);
    const project = normalized.project || {};
    const settings = project.settings || {};
    return {
      id: project.id,
      name: project.name || "Untitled Project",
      createdAt: project.createdAt || nowIso(),
      updatedAt: project.updatedAt || nowIso(),
      thumbnailDataUrl: project.thumbnailDataUrl || "",
      outputWidth: settings.outputWidth || normalized?.output?.width || 1920,
      outputHeight: settings.outputHeight || normalized?.output?.height || 1080,
      projectorModel: settings.projectorModel || "",
      schemaVersion: normalized?.schemaVersion || CURRENT_SCHEMA_VERSION
    };
  }

  function listProjects() {
    return getIndex()
      .slice()
      .sort((a, b) => String(b.updatedAt || "").localeCompare(String(a.updatedAt || "")));
  }

  function saveProject(envelope) {
    const nextEnvelope = normalizeProjectEnvelope(envelope);
    if (!nextEnvelope?.project?.id) {
      throw new Error("Project envelope requires a project id.");
    }
    const summary = summarizeEnvelope(nextEnvelope);
    localStorage.setItem(getProjectKey(summary.id), JSON.stringify(nextEnvelope));

    const index = getIndex().filter((item) => item.id !== summary.id);
    index.push(summary);
    setIndex(index);
    return summary;
  }

  function loadProject(projectId) {
    const envelope = safeParse(localStorage.getItem(getProjectKey(projectId)), null);
    if (!envelope) {
      return null;
    }
    return normalizeProjectEnvelope(envelope);
  }

  function deleteProject(projectId) {
    localStorage.removeItem(getProjectKey(projectId));
    setIndex(getIndex().filter((item) => item.id !== projectId));
  }

  function duplicateProject(projectId, overrides = {}) {
    const envelope = loadProject(projectId);
    if (!envelope) {
      return null;
    }

    const nextEnvelope = clone(envelope);
    const name = overrides.name || `${nextEnvelope.project.name || "Untitled Project"} Copy`;
    const timestamp = nowIso();
    nextEnvelope.project.id = createId("project");
    nextEnvelope.project.name = name;
    nextEnvelope.project.createdAt = timestamp;
    nextEnvelope.project.updatedAt = timestamp;
    saveProject(nextEnvelope);
    return nextEnvelope.project.id;
  }

  function importProjectEnvelope(envelope) {
    if (!envelope || typeof envelope !== "object") {
      throw new Error("Invalid project payload.");
    }
    const normalized = normalizeProjectEnvelope(envelope, { imported: true });
    saveProject(normalized);
    return normalized.project.id;
  }

  async function importProjectFile(file) {
    const raw = await file.text();
    const envelope = JSON.parse(raw);
    return importProjectEnvelope(envelope);
  }

  function exportProject(projectId) {
    const envelope = loadProject(projectId);
    if (!envelope) {
      throw new Error("Project not found.");
    }
    return JSON.stringify(envelope, null, 2);
  }

  function downloadProject(projectId, fileName) {
    const json = exportProject(projectId);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = fileName || `${projectId}.json`;
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  }

  window.ProjektikStore = {
    CURRENT_SCHEMA_VERSION,
    STORAGE_INDEX_KEY,
    PROJECT_KEY_PREFIX,
    createId,
    listProjects,
    saveProject,
    loadProject,
    deleteProject,
    duplicateProject,
    exportProject,
    downloadProject,
    importProjectEnvelope,
    importProjectFile,
    summarizeEnvelope,
    normalizeProjectEnvelope
  };
}());
