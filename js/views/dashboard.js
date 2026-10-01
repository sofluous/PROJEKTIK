(function (global) {
  async function initDashboard() {
    const bootstrap = global.ProjektikBootstrap;
    const { root, store } = await bootstrap.load({ store: true });

    const gallery = document.getElementById("projectGallery");
    const projectCountLabel = document.getElementById("projectCountLabel");
    const dashboardStatus = document.getElementById("dashboardStatus");
    const createProjectBtn = document.getElementById("createProjectBtn");
    const importProjectBtn = document.getElementById("importProjectBtn");
    const importProjectInput = document.getElementById("importProjectInput");
    let selectedProjectId = "";
    const PROJECT_STORAGE_KEY_PREFIXES = [
      "projektik.projects.",
      "projektik.project."
    ];

    function isProjectStorageKey(key) {
      return !key || PROJECT_STORAGE_KEY_PREFIXES.some((prefix) => key.startsWith(prefix));
    }

    function escapeHtml(value) {
      return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
    }

    function escapeCssUrl(value) {
      return String(value ?? "")
        .replace(/\\/g, "\\\\")
        .replace(/"/g, '\\"')
        .replace(/[\n\r\f]/g, "");
    }

    function isSafeThumbnailDataUrl(value) {
      return typeof value === "string" && /^data:image\//i.test(value);
    }

    function formatDate(value) {
      if (!value) {
        return "Unknown";
      }
      try {
        return new Intl.DateTimeFormat(undefined, {
          year: "numeric",
          month: "short",
          day: "numeric",
          hour: "numeric",
          minute: "2-digit"
        }).format(new Date(value));
      } catch (error) {
        return value;
      }
    }

    function openProject(projectId) {
      global.location.href = `./editor.html?project=${encodeURIComponent(projectId)}`;
    }

    function createProject() {
      global.location.href = "./editor.html?new=1";
    }

    function getProjectImportErrorMessage(error) {
      if (error instanceof SyntaxError) {
        return "Project import failed: the selected file is not valid JSON.";
      }
      if (String(error?.message || "").includes("Invalid project payload")) {
        return "Project import failed: the selected JSON is not a recognized PROJEKTIK project.";
      }
      return "Project import failed. Please check the JSON file and try again.";
    }

    function setDashboardStatus(message = "", tone = "") {
      if (!dashboardStatus) {
        return;
      }
      dashboardStatus.textContent = message;
      dashboardStatus.classList.toggle("is-error", tone === "error");
      dashboardStatus.classList.toggle("is-success", tone === "success");
      dashboardStatus.hidden = !message;
    }

    function renderEmptyState() {
      gallery.innerHTML = `
        <article class="pk-empty-card">
          <div class="pk-eyebrow">No saved projects yet</div>
          <h3 class="pk-card-title">Create your first mapping project</h3>
          <div class="pk-meta">Start a new project or import an existing JSON file to populate the dashboard.</div>
          <div class="pk-empty-actions">
            <button class="ds-btn ds-btn-primary" type="button" data-empty-action="new">New Project</button>
            <button class="ds-btn" type="button" data-empty-action="import">Import Project</button>
          </div>
        </article>
      `;
    }

    function renderProjects() {
      const projects = store.listProjects();
      projectCountLabel.textContent = `${projects.length} ${projects.length === 1 ? "project" : "projects"}`;

      if (!projects.length) {
        renderEmptyState();
        return;
      }

      gallery.innerHTML = projects
        .map((project) => {
          const hasThumbnail = isSafeThumbnailDataUrl(project.thumbnailDataUrl);
          const thumbnailStyle = hasThumbnail
            ? ` style="background-image:url(&quot;${escapeCssUrl(project.thumbnailDataUrl)}&quot;);"`
            : "";
          const projectName = escapeHtml(project.name);
          const outputWidth = escapeHtml(project.outputWidth);
          const outputHeight = escapeHtml(project.outputHeight);
          const projectorModel = escapeHtml(project.projectorModel);
          return `
            <article class="pk-card${selectedProjectId === project.id ? " is-selected" : ""}" data-project-id="${project.id}" tabindex="0" role="button" aria-pressed="${selectedProjectId === project.id ? "true" : "false"}">
              <details class="pk-card-menu ds-popover-wrap">
                <summary class="ds-btn ds-btn-icon ds-icon-action" aria-label="Project options">...</summary>
                <div class="pk-card-menu-list ds-popover ds-popover-static">
                  <button class="ds-btn" type="button" data-card-action="duplicate">Duplicate</button>
                  <button class="ds-btn" type="button" data-card-action="export">Export</button>
                  <button class="ds-btn" type="button" data-card-action="delete">Delete</button>
                </div>
              </details>
              <div class="pk-card-open">
                <button class="ds-btn ds-btn-primary" type="button" data-card-action="open">Open Project</button>
              </div>
              <div class="pk-card-thumb${hasThumbnail ? " has-image" : ""}"${thumbnailStyle}></div>
              <div class="pk-card-body">
                <div class="pk-card-kicker">Updated ${escapeHtml(formatDate(project.updatedAt))}</div>
                <h3 class="pk-card-title">${projectName}</h3>
                <div class="pk-card-meta">
                  <span class="pk-tag ds-chip">${outputWidth}x${outputHeight}</span>
                  ${project.projectorModel ? `<span class="pk-tag ds-chip">${projectorModel}</span>` : ""}
                </div>
              </div>
            </article>
          `;
        })
        .join("");
    }

    global.addEventListener("storage", (event) => {
      if (isProjectStorageKey(event.key)) {
        renderProjects();
      }
    });

    createProjectBtn.addEventListener("click", createProject);
    importProjectBtn.addEventListener("click", () => {
      setDashboardStatus("");
      importProjectInput.click();
    });

    importProjectInput.addEventListener("change", async (event) => {
      const [file] = Array.from(event.target.files || []);
      event.target.value = "";
      if (!file) {
        return;
      }
      try {
        const projectId = await store.importProjectFile(file);
        setDashboardStatus("Project imported. Opening editor...", "success");
        renderProjects();
        openProject(projectId);
      } catch (error) {
        setDashboardStatus(getProjectImportErrorMessage(error), "error");
      }
    });

    gallery.addEventListener("click", (event) => {
      const emptyAction = event.target.closest("[data-empty-action]");
      if (emptyAction) {
        if (emptyAction.dataset.emptyAction === "new") {
          createProject();
        } else {
          setDashboardStatus("");
          importProjectInput.click();
        }
        return;
      }

      const card = event.target.closest("[data-project-id]");
      const action = event.target.closest("[data-card-action]");
      if (!card) {
        return;
      }
      if (event.target.closest(".pk-card-menu summary")) {
        return;
      }

      const projectId = card.dataset.projectId;
      if (!action) {
        selectedProjectId = projectId;
        renderProjects();
        return;
      }

      const menu = action.closest("details");
      if (menu) {
        menu.removeAttribute("open");
      }

      selectedProjectId = projectId;
      if (action.dataset.cardAction === "open") {
        openProject(projectId);
        return;
      }
      if (action.dataset.cardAction === "duplicate") {
        store.duplicateProject(projectId);
        renderProjects();
        return;
      }
      if (action.dataset.cardAction === "export") {
        store.downloadProject(projectId, `${projectId}.json`);
        return;
      }
      if (action.dataset.cardAction === "delete") {
        if (!global.confirm("Delete this project from the local dashboard?")) {
          return;
        }
        store.deleteProject(projectId);
        renderProjects();
      }
    });

    gallery.addEventListener("keydown", (event) => {
      const card = event.target.closest("[data-project-id]");
      if (!card) {
        return;
      }
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        const projectId = card.dataset.projectId;
        if (selectedProjectId === projectId) {
          openProject(projectId);
          return;
        }
        selectedProjectId = projectId;
        renderProjects();
      }
    });

    document.addEventListener("click", (event) => {
      if (!event.target.closest(".pk-card-menu")) {
        document.querySelectorAll(".pk-card-menu[open]").forEach((menu) => {
          menu.removeAttribute("open");
        });
      }
      if (event.target.closest("[data-project-id]") || event.target.closest("[data-empty-action]")) {
        return;
      }
      if (selectedProjectId) {
        selectedProjectId = "";
        renderProjects();
      }
    });

    document.addEventListener("keydown", (event) => {
      if (event.key !== "Escape") {
        return;
      }
      const openMenus = Array.from(document.querySelectorAll(".pk-card-menu[open]"));
      if (!openMenus.length) {
        return;
      }
      openMenus.forEach((menu) => menu.removeAttribute("open"));
    });

    renderProjects();
  }

  global.ProjektikDashboardView = { init: initDashboard };
})(window);

