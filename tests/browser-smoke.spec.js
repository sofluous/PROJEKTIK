const { test, expect } = require("@playwright/test");
const { pathToFileURL } = require("url");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");

function appUrl(file, search = "") {
  const url = pathToFileURL(path.join(ROOT, file));
  url.search = search;
  return url.href;
}

function collectConsoleErrors(page) {
  const errors = [];
  page.on("console", (message) => {
    if (message.type() === "error") {
      errors.push(message.text());
    }
  });
  page.on("pageerror", (error) => {
    errors.push(error.message);
  });
  return errors;
}

test.describe("PROJEKTIK browser smoke", () => {
  test("dashboard loads and exposes project actions", async ({ page }) => {
    const errors = collectConsoleErrors(page);

    await page.goto(appUrl("index.html"));

    await expect(page.getByRole("heading", { name: "PROJEKTIK" })).toBeVisible();
    await expect(page.locator("#createProjectBtn")).toBeVisible();
    await expect(page.locator("#importProjectBtn")).toBeVisible();
    await expect(page.locator("#projectGallery")).toBeVisible();
    expect(errors).toEqual([]);
  });

  test("dashboard reports malformed project imports clearly", async ({ page }) => {
    const errors = collectConsoleErrors(page);

    await page.goto(appUrl("index.html"));
    await page.locator("#importProjectInput").setInputFiles({
      name: "broken-project.json",
      mimeType: "application/json",
      buffer: Buffer.from("{ not valid json")
    });

    await expect(page.locator("#dashboardStatus")).toBeVisible();
    await expect(page.locator("#dashboardStatus")).toHaveText("Project import failed: the selected file is not valid JSON.");
    await expect(page.locator("#dashboardStatus")).toHaveClass(/is-error/);
    expect(errors).toEqual([]);
  });

  test("new project opens editor and creates a local project", async ({ page }) => {
    const errors = collectConsoleErrors(page);

    await page.goto(appUrl("index.html"));
    await page.evaluate(() => localStorage.clear());
    await page.locator("#createProjectBtn").click();
    await page.waitForURL(/editor\.html\?project=/);

    await expect(page.locator("#workspaceTabBtn")).toBeVisible();
    await expect(page.locator("#assetsTabBtn")).toBeVisible();
    await expect(page.locator("#settingsTabBtn")).toBeVisible();
    await expect(page.locator("#stageCanvas")).toBeVisible();
    await expect(page.getByLabel("Output controls")).toBeVisible();
    await expect(page.getByLabel("Panel controls")).toBeHidden();
    await expect(page.locator(".pk-stage-header")).toBeHidden();
    await expect(page.locator(".pk-projection-strip-label")).toBeHidden();
    await expect(page.locator(".pk-overlay-control-label").first()).toBeHidden();
    await expect(page.locator("#openProjectionBtn")).toBeVisible();
    await expect(page.locator("#addLayerBtn")).toBeVisible();
    await expect(page.locator("#addLayerBtn")).toHaveAttribute("aria-label", "New layer");
    await expect(page.locator("#addSurfaceBtn")).toBeVisible();
    await expect(page.locator("#addSurfaceBtn")).toHaveAttribute("aria-label", "Draw surface");
    await expect(page.locator("#outputToggle")).toHaveText(/Preview/);
    await expect(page.locator("#playbackToggle")).toHaveText(/Play/);

    await page.locator("#projectTitle").click();
    await expect(page.locator("#saveProjectBtn")).toBeVisible();
    await expect(page.locator("#renameProjectBtn")).toBeVisible();
    const projectMenuLayout = await page.evaluate(() => {
      const panel = document.querySelector(".pk-panel-left")?.getBoundingClientRect();
      const menu = document.querySelector(".pk-project-menu .pk-more-menu-list")?.getBoundingClientRect();
      const rename = document.querySelector("#renameProjectBtn")?.getBoundingClientRect();
      const elementAtRename = rename
        ? document.elementFromPoint(rename.left + rename.width / 2, rename.top + rename.height / 2)
        : null;
      return {
        menuExtendsPastHeader: Boolean(panel && menu && menu.bottom > panel.top + 96),
        renameIsTopmost: Boolean(elementAtRename && elementAtRename.closest("#renameProjectBtn"))
      };
    });
    expect(projectMenuLayout).toEqual({
      menuExtendsPastHeader: true,
      renameIsTopmost: true
    });
    await page.keyboard.press("Escape");

    const projectIndex = await page.evaluate(() => {
      const raw = localStorage.getItem("projektik.projects.index.v1");
      return raw ? JSON.parse(raw) : [];
    });
    expect(projectIndex).toHaveLength(1);
    expect(projectIndex[0].id).toBeTruthy();
    expect(errors).toEqual([]);
  });

  test("editor shell keeps core controls reachable on mobile width", async ({ page }) => {
    const errors = collectConsoleErrors(page);

    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(appUrl("editor.html", "?new=1"));

    await expect(page.locator("#stageCanvas")).toBeVisible();
    await expect(page.locator("#openProjectionBtn")).toBeVisible();
    await expect(page.locator("#addSurfaceBtn")).toBeVisible();
    await expect(page.locator("#outputToggle")).toBeVisible();
    await expect(page.locator("#playbackToggle")).toBeVisible();
    await expect(page.locator(".pk-projection-strip-label")).toBeHidden();
    await expect(page.locator(".pk-overlay-control-label").first()).toBeHidden();
    expect(errors).toEqual([]);
  });

  test("fullscreen detaches editing chrome over full-screen stage", async ({ page }) => {
    const errors = collectConsoleErrors(page);

    await page.goto(appUrl("editor.html", "?new=1"));

    await page.locator("#overlayFullscreenToggle").click();
    await page.waitForFunction(() => Boolean(document.fullscreenElement));

    await expect(page.locator("#workspaceTabBtn")).toBeVisible();
    await expect(page.locator("#assetsTabBtn")).toBeVisible();
    await expect(page.locator("#settingsTabBtn")).toBeVisible();
    await expect(page.locator("#addLayerBtn")).toBeVisible();
    await expect(page.locator("#addSurfaceBtn")).toBeVisible();
    await expect(page.locator("#openProjectionBtn")).toBeVisible();
    await expect(page.locator(".pk-panel-footer")).toHaveCount(0);
    await expect(page.locator("#overlayToolsDrawer")).toBeVisible();
    await expect(page.locator(".pk-app")).toHaveClass(/is-overlay-ui/);
    await expect(page.locator(".pk-app")).not.toHaveClass(/is-ui-hidden/);
    const fullscreenLayout = await page.evaluate(() => {
      const stage = document.querySelector(".pk-stage")?.getBoundingClientRect();
      const leftPanel = document.querySelector(".pk-panel-left")?.getBoundingClientRect();
      const rail = document.querySelector(".pk-nav-rail")?.getBoundingClientRect();
      const rightPanel = document.querySelector("#overlayToolsDrawer")?.getBoundingClientRect();
      return {
        stageFillsViewport: Boolean(stage && stage.width >= window.innerWidth - 2 && stage.height >= window.innerHeight - 2),
        leftPanelFloatsOverStage: Boolean(
          leftPanel
          && leftPanel.left >= -2
          && leftPanel.top >= -2
          && leftPanel.right <= window.innerWidth + 2
          && leftPanel.bottom <= window.innerHeight + 2
        ),
        railAttachesToLeftPanel: Boolean(rail && leftPanel && Math.abs(rail.right - leftPanel.left) <= 2),
        sidePanelsAlign: Boolean(
          leftPanel
          && rightPanel
          && Math.abs(leftPanel.top - rightPanel.top) <= 2
          && Math.abs(leftPanel.bottom - rightPanel.bottom) <= 2
        )
      };
    });
    expect(fullscreenLayout).toEqual({
      stageFillsViewport: true,
      leftPanelFloatsOverStage: true,
      railAttachesToLeftPanel: true,
      sidePanelsAlign: true
    });

    await page.locator("#overlayLayersToggle").click();
    await expect(page.locator(".pk-app")).toHaveClass(/is-left-panel-collapsed/);
    await expect(page.locator("#workspaceTabBtn")).toBeVisible();
    await expect(page.locator("#addLayerBtn")).toBeHidden();
    await expect(page.locator("#overlayLayersToggle")).toHaveAttribute("aria-pressed", "false");

    await page.locator("#workspaceTabBtn").click();
    await expect(page.locator(".pk-app")).not.toHaveClass(/is-left-panel-collapsed/);
    await expect(page.locator("#addLayerBtn")).toBeVisible();
    await expect(page.locator("#overlayLayersToggle")).toHaveAttribute("aria-pressed", "true");

    await page.keyboard.press("Escape");
    expect(errors).toEqual([]);
  });

  test("preview mode toggles active state and recovers editing chrome", async ({ page }) => {
    const errors = collectConsoleErrors(page);

    await page.goto(appUrl("editor.html", "?new=1"));
    const previewToggle = page.locator("#outputToggle");
    const stage = page.locator("#stageCanvas");

    await expect(previewToggle).toHaveAttribute("aria-pressed", "false");
    await expect(stage).not.toHaveClass(/is-presentation-preview/);

    await previewToggle.click();

    await expect(previewToggle).toHaveAttribute("aria-pressed", "true");
    await expect(previewToggle).toHaveAttribute("aria-label", "Disable preview");
    await expect(stage).toHaveClass(/is-presentation-preview/);
    await expect(page.locator("#workspaceTabBtn")).toBeVisible();
    await expect(page.locator("#openProjectionBtn")).toBeVisible();

    await previewToggle.click();

    await expect(previewToggle).toHaveAttribute("aria-pressed", "false");
    await expect(previewToggle).toHaveAttribute("aria-label", "Enable preview");
    await expect(stage).not.toHaveClass(/is-presentation-preview/);
    await expect(page.locator("#workspaceTabBtn")).toBeVisible();
    expect(errors).toEqual([]);
  });

  test("project store persists dashboard-visible metadata in browser storage", async ({ page }) => {
    const errors = collectConsoleErrors(page);

    await page.goto(appUrl("index.html"));
    await page.evaluate(() => {
      localStorage.clear();
      window.ProjektikStore.saveProject({
        project: {
          id: "project-browser-smoke",
          name: "Browser Smoke <Project>",
          settings: {
            projectorModel: "Smoke Projector"
          }
        },
        output: {
          width: 1024,
          height: 768
        }
      });
    });

    await page.reload();

    await expect(page.getByText("Browser Smoke <Project>")).toBeVisible();
    await expect(page.getByText("1024x768")).toBeVisible();
    await expect(page.getByText("Smoke Projector")).toBeVisible();
    expect(errors).toEqual([]);
  });

  test("projection page renders a stored session snapshot", async ({ page }) => {
    const errors = collectConsoleErrors(page);
    const projectId = "project-projection-smoke";

    await page.goto(appUrl("index.html"));
    await page.evaluate((id) => {
      localStorage.clear();
      localStorage.setItem(`projektik.projection.session.v1.${id}`, JSON.stringify({
        projectName: "Projection Smoke",
        updatedAt: new Date().toISOString(),
        theme: "tech-grid",
        output: { width: 1280, height: 720 },
        workingArea: { x: 0, y: 0, w: 1280, h: 720, outsideFill: "#000000" },
        calibration: {
          visible: false,
          x: 0,
          y: 0,
          w: 1280,
          h: 720,
          gridType: "line",
          gridSize: 48,
          showFrame: true
        },
        reference: {
          visible: false,
          x: 0,
          y: 0,
          w: 1280,
          h: 720,
          opacity: 1,
          sourceUrl: "",
          clipPath: "",
          fitMode: "surface"
        },
        projectionView: {
          presetLabel: "Final",
          pinnedLabel: "Full Project",
          showGuides: false,
          showReference: false,
          showCalibration: false
        },
        surfaces: []
      }));
    }, projectId);

    await page.goto(appUrl("projection.html", `?project=${projectId}`));

    await expect(page.locator("#projectionProjectName")).toHaveText("Projection Smoke");
    await expect(page.locator("#projectionPresetChip")).toHaveText("Final");
    await expect(page.locator("#projectionOutputChip")).toHaveText("1280 x 720");
    await expect(page.locator("#projectionEmpty")).toBeHidden();
    expect(errors).toEqual([]);
  });
});
