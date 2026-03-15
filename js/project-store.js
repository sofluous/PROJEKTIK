(function initProjektikStore() {
  const STORAGE_INDEX_KEY = "projektik.projects.index.v1";
  const PROJECT_KEY_PREFIX = "projektik.project.v1.";

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
    const project = envelope?.project || {};
    const settings = project.settings || {};
    return {
      id: project.id,
      name: project.name || "Untitled Project",
      createdAt: project.createdAt || nowIso(),
      updatedAt: project.updatedAt || nowIso(),
      thumbnailDataUrl: project.thumbnailDataUrl || "",
      outputWidth: settings.outputWidth || envelope?.output?.width || 1920,
      outputHeight: settings.outputHeight || envelope?.output?.height || 1080,
      projectorModel: settings.projectorModel || "",
      schemaVersion: envelope?.schemaVersion || 1
    };
  }

  function listProjects() {
    return getIndex()
      .slice()
      .sort((a, b) => String(b.updatedAt || "").localeCompare(String(a.updatedAt || "")));
  }

  function saveProject(envelope) {
    if (!envelope?.project?.id) {
      throw new Error("Project envelope requires a project id.");
    }

    const nextEnvelope = clone(envelope);
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
    return clone(envelope);
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

  function normalizeImportedEnvelope(envelope) {
    const nextEnvelope = clone(envelope);
    const timestamp = nowIso();
    nextEnvelope.schemaVersion = Number(nextEnvelope.schemaVersion) || 1;
    nextEnvelope.project = nextEnvelope.project || {};
    nextEnvelope.project.id = createId("project");
    nextEnvelope.project.name = nextEnvelope.project.name || "Imported Project";
    nextEnvelope.project.createdAt = timestamp;
    nextEnvelope.project.updatedAt = timestamp;
    nextEnvelope.project.settings = nextEnvelope.project.settings || {};
    return nextEnvelope;
  }

  function importProjectEnvelope(envelope) {
    if (!envelope || typeof envelope !== "object") {
      throw new Error("Invalid project payload.");
    }
    const normalized = normalizeImportedEnvelope(envelope);
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
    summarizeEnvelope
  };
}());
