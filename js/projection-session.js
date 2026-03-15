(function initProjektikProjectionSession() {
  const SESSION_PREFIX = "projektik.projection.session.v1.";

  function getSessionKey(projectId) {
    return `${SESSION_PREFIX}${projectId || "unknown"}`;
  }

  function writeSnapshot(projectId, snapshot) {
    if (!projectId) {
      return;
    }
    localStorage.setItem(getSessionKey(projectId), JSON.stringify(snapshot));
  }

  function readSnapshot(projectId) {
    if (!projectId) {
      return null;
    }
    const raw = localStorage.getItem(getSessionKey(projectId));
    if (!raw) {
      return null;
    }
    try {
      return JSON.parse(raw);
    } catch (error) {
      return null;
    }
  }

  window.ProjektikProjectionSession = {
    SESSION_PREFIX,
    getSessionKey,
    writeSnapshot,
    readSnapshot
  };
}());
