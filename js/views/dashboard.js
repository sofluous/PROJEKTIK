(function (global) {
  async function initDashboard() {
    const bootstrap = global.ProjektikBootstrap;
    const { root, store } = await bootstrap.load({ store: true });

    const gallery = document.getElementById("projectGallery");
    const projectCountLabel = document.getElementById("projectCountLabel");
    const createProjectBtn = document.getElementById("createProjectBtn");
    const importProjectBtn = document.getElementById("importProjectBtn");
    const importProjectInput = document.getElementById("importProjectInput");
    let selectedProjectId = "";

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
          const thumbnailStyle = project.thumbnailDataUrl
            ? ` style="background-image:url('${project.thumbnailDataUrl.replace(/'/g, "%27")}');"`
            : "";
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
              <div class="pk-card-thumb${project.thumbnailDataUrl ? " has-image" : ""}"${thumbnailStyle}></div>
              <div class="pk-card-body">
                <div class="pk-card-kicker">Updated ${formatDate(project.updatedAt)}</div>
                <h3 class="pk-card-title">${project.name}</h3>
                <div class="pk-card-meta">
                  <span class="pk-tag ds-chip">${project.outputWidth}x${project.outputHeight}</span>
                  ${project.projectorModel ? `<span class="pk-tag ds-chip">${project.projectorModel}</span>` : ""}
                </div>
              </div>
            </article>
          `;
        })
        .join("");
    }

    global.addEventListener("storage", (event) => {
      if (!event.key || event.key.startsWith("projektik:")) {
        renderProjects();
      }
    });

    createProjectBtn.addEventListener("click", createProject);
    importProjectBtn.addEventListener("click", () => {
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
        renderProjects();
        openProject(projectId);
      } catch (error) {
        global.alert("Project import failed. Please check the JSON file and try again.");
      }
    });

    gallery.addEventListener("click", (event) => {
      const emptyAction = event.target.closest("[data-empty-action]");
      if (emptyAction) {
        if (emptyAction.dataset.emptyAction === "new") {
          createProject();
        } else {
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

