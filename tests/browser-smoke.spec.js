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
    await expect(page.locator("#projectionTabBtn")).toBeVisible();
    await expect(page.locator("#settingsTabBtn")).toBeVisible();
    await expect(page.locator("#stageCanvas")).toBeVisible();
    await expect(page.getByLabel("Output controls")).toBeVisible();
    await expect(page.getByLabel("Panel controls")).toBeHidden();
    await expect(page.locator(".pk-stage-header")).toBeHidden();
    await expect(page.locator(".pk-projection-strip-label")).toBeHidden();
    await expect(page.locator(".pk-overlay-control-label").first()).toBeHidden();
    await expect(page.locator("#openProjectionBtn")).toHaveCount(0);
    await expect(page.locator("#addLayerBtn")).toBeVisible();
    await expect(page.locator("#addLayerBtn")).toHaveAttribute("aria-label", "New layer");
    await expect(page.locator("#addSurfaceBtn")).toBeVisible();
    await expect(page.locator("#addSurfaceBtn")).toHaveAttribute("aria-label", "Draw surface");
    await expect(page.locator("#outputToggle")).toHaveText(/Preview/);
    await expect(page.locator("#playbackToggle")).toHaveText(/Play/);

    await page.locator("#projectionTabBtn").click();
    await expect(page.locator("#projectionPanel")).toBeVisible();
    await expect(page.locator("#projectionStatusChip")).toHaveCount(0);
    await expect(page.locator("#projectionMiniPreview")).toBeVisible();
    await expect(page.locator("#projectionGuidesToggle")).toBeVisible();
    await expect(page.locator("#projectionReferenceToggle")).toBeVisible();
    await expect(page.locator("#projectionCalibrationToggle")).toBeVisible();
    await expect(page.locator("#projectionConsoleNote")).toBeVisible();
    await expect(page.locator("#projectionMiniPreset")).toHaveCount(0);
    await expect(page.locator("#projectionMiniOutput")).toHaveCount(0);
    await expect(page.locator("#projectionPlayOverlayBtn")).toBeVisible();
    await expect(page.locator("#projectionWindowChrome")).toHaveAttribute("data-window-state", "closed");
    await expect(page.locator("#projectionWindowState")).toHaveText("Closed");
    await expect(page.locator("#projectionHudToggleBtn")).toBeDisabled();
    await expect(page.locator("#projectionFullscreenBtn")).toBeDisabled();
    await expect(page.locator("#projectionWindowCloseBtn")).toBeDisabled();
    await expect(page.locator("#projectionHudToggleBtn")).toHaveAttribute("aria-label", "Hide projection HUD");
    await page.evaluate(() => {
      window.open = () => ({
        closed: false,
        focus() {},
        close() {
          this.closed = true;
        },
        document: {
          documentElement: {
            async requestFullscreen() {}
          },
          async exitFullscreen() {}
        }
      });
    });
    const previewBeforeOpen = await page.locator(".pk-projection-window-chrome").boundingBox();
    await page.locator("#projectionPlayOverlayBtn").click();
    await expect(page.locator("#projectionPlayOverlayBtn")).toBeHidden();
    await expect(page.locator("#projectionHudToggleBtn")).toBeEnabled();
    await expect(page.locator("#projectionFullscreenBtn")).toBeEnabled();
    await expect(page.locator("#projectionWindowCloseBtn")).toBeEnabled();
    await expect(page.locator("#projectionFullscreenBtn")).toHaveAttribute("aria-label", "Exit projection fullscreen");
    await expect(page.locator("#projectionWindowChrome")).toHaveAttribute("data-window-state", "fullscreen");
    await expect(page.locator("#projectionWindowState")).toHaveText("Fullscreen");
    const previewAfterOpen = await page.locator(".pk-projection-window-chrome").boundingBox();
    expect(Math.abs(previewAfterOpen.width - previewBeforeOpen.width)).toBeLessThanOrEqual(1);
    expect(Math.abs(previewAfterOpen.height - previewBeforeOpen.height)).toBeLessThanOrEqual(1);
    await page.locator("#projectionHudToggleBtn").click();
    await expect(page.locator("#projectionHudToggleBtn")).toHaveAttribute("aria-label", "Show projection HUD");
    await expect(page.locator("#projectionHudToggleBtn")).toHaveAttribute("aria-pressed", "true");
    const hudSnapshot = await page.evaluate(() => {
      const projectId = new URLSearchParams(window.location.search).get("project");
      const raw = localStorage.getItem(`projektik.projection.session.v1.${projectId}`);
      return raw ? JSON.parse(raw).projectionView?.hudHidden : null;
    });
    expect(hudSnapshot).toBe(true);
    await page.locator("#projectionWindowCloseBtn").click();
    await expect(page.locator("#projectionPlayOverlayBtn")).toBeVisible();
    await expect(page.locator("#projectionWindowChrome")).toHaveAttribute("data-window-state", "closed");
    await expect(page.locator("#projectionWindowState")).toHaveText("Closed");
    await expect(page.locator("#projectionHudToggleBtn")).toBeDisabled();
    const projectionPanelLayout = await page.evaluate(() => {
      const panel = document.querySelector("#projectionPanel")?.getBoundingClientRect();
      const chrome = document.querySelector("#projectionWindowChrome")?.getBoundingClientRect();
      return {
        chromeFitsPanel: Boolean(panel && chrome && chrome.width <= panel.width + 1)
      };
    });
    expect(projectionPanelLayout).toEqual({ chromeFitsPanel: true });
    await page.locator("#workspaceTabBtn").click();

    await page.locator("#settingsTabBtn").click();
    await expect(page.locator("#inspectorTitle")).toHaveText("Project Settings");
    await expect(page.locator("#inspectorTags")).toBeHidden();
    await expect(page.locator("label[for='outputPresetSelect']")).toHaveText("Dimensions");
    await expect(page.locator("#projectSettingsCard .pk-field-note").first()).toContainText("Native describes the projector panel");
    await expect(page.locator("#projectSettingsCard .pk-dimension-row-label")).toContainText([
      "Projector Native",
      "Canvas Output",
      "Projected Size"
    ]);

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
    await expect(page.locator("#openProjectionBtn")).toHaveCount(0);
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
    await expect(page.locator("#projectionTabBtn")).toBeVisible();
    await expect(page.locator("#settingsTabBtn")).toBeVisible();
    await expect(page.locator("#addLayerBtn")).toBeVisible();
    await expect(page.locator("#addSurfaceBtn")).toBeVisible();
    await expect(page.locator("#openProjectionBtn")).toHaveCount(0);
    await expect(page.locator(".pk-panel-footer")).toHaveCount(0);
    await expect(page.locator("#overlayToolsDrawer")).toBeVisible();
    await expect(page.locator("#overlayToolsToggle")).toHaveAttribute("aria-pressed", "true");
    await expect(page.locator("#overlayToolsToggle")).toHaveAttribute("aria-label", "Hide inspector panel");
    await expect(page.locator(".pk-app")).toHaveClass(/is-overlay-ui/);
    await expect(page.locator(".pk-app")).not.toHaveClass(/is-ui-hidden/);
    const fullscreenLayout = await page.evaluate(() => {
      const stage = document.querySelector(".pk-stage")?.getBoundingClientRect();
      const leftPanel = document.querySelector(".pk-panel-left")?.getBoundingClientRect();
      const rail = document.querySelector(".pk-nav-rail")?.getBoundingClientRect();
      const railTab = document.querySelector("#workspaceTabBtn")?.getBoundingClientRect();
      const rightPanel = document.querySelector("#overlayToolsDrawer")?.getBoundingClientRect();
      const rightPanelBody = document.querySelector("#overlayToolsContent");
      const toolbar = document.querySelector("#overlayControls")?.getBoundingClientRect();
      const toolbarButtons = Array.from(document.querySelectorAll("#overlayControls button"))
        .map((button) => button.getBoundingClientRect())
        .filter((rect) => rect.width > 0 && rect.height > 0);
      const toolbarRowAligned = toolbarButtons.every((rect, _index, all) => Math.abs(rect.top - all[0].top) <= 2);
      const railIconCentered = Boolean(
        rail
        && railTab
        && Math.abs((rail.left + rail.width / 2) - (railTab.left + railTab.width / 2)) <= 1.5
      );
      const rightPanelBodyPadding = rightPanelBody
        ? parseFloat(getComputedStyle(rightPanelBody).paddingLeft)
        : 0;
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
        railIconCentered,
        rightPanelHasInset: rightPanelBodyPadding >= 10,
        sidePanelsAlign: Boolean(
          leftPanel
          && rightPanel
          && Math.abs(leftPanel.top - rightPanel.top) <= 2
          && Math.abs(leftPanel.bottom - rightPanel.bottom) <= 2
        ),
        toolbarSingleRow: Boolean(toolbar && toolbar.height <= 58 && toolbarRowAligned)
      };
    });
    expect(fullscreenLayout).toEqual({
      stageFillsViewport: true,
      leftPanelFloatsOverStage: true,
      railAttachesToLeftPanel: true,
      railIconCentered: true,
      rightPanelHasInset: true,
      sidePanelsAlign: true,
      toolbarSingleRow: true
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

    await page.locator("#overlayToolsToggle").click();
    await expect(page.locator(".pk-app")).toHaveClass(/is-right-panel-collapsed/);
    await expect(page.locator("#overlayToolsDrawer")).toBeHidden();
    await expect(page.locator("#overlayToolsToggle")).toHaveAttribute("aria-pressed", "false");
    await expect(page.locator("#overlayToolsToggle")).toHaveAttribute("aria-label", "Show inspector panel");

    await page.locator("#overlayToolsToggle").click();
    await expect(page.locator(".pk-app")).not.toHaveClass(/is-right-panel-collapsed/);
    await expect(page.locator("#overlayToolsDrawer")).toBeVisible();
    await expect(page.locator("#overlayToolsToggle")).toHaveAttribute("aria-pressed", "true");
    await expect(page.locator("#overlayToolsToggle")).toHaveAttribute("aria-label", "Hide inspector panel");

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
    await expect(page.locator("#openProjectionBtn")).toHaveCount(0);

    await previewToggle.click();

    await expect(previewToggle).toHaveAttribute("aria-pressed", "false");
    await expect(previewToggle).toHaveAttribute("aria-label", "Enable preview");
    await expect(stage).not.toHaveClass(/is-presentation-preview/);
    await expect(page.locator("#workspaceTabBtn")).toBeVisible();
    expect(errors).toEqual([]);
  });

  test("locked selections and run states consistently block editing", async ({ page }) => {
    const errors = collectConsoleErrors(page);

    await page.goto(appUrl("editor.html", "?new=1"));
    await page.locator("#addLayerBtn").click();

    await page.locator("#addSurfaceBtn").click();
    const stageBox = await page.locator("#stageCanvas").boundingBox();
    expect(stageBox).toBeTruthy();
    await page.mouse.move(stageBox.x + 160, stageBox.y + 140);
    await page.mouse.down();
    await page.mouse.move(stageBox.x + 420, stageBox.y + 320);
    await page.mouse.up();

    const layerRow = page.locator("#workspaceTree article[data-layer-id]").first();
    await layerRow.locator(".pk-tree-row-main").click();
    await expect(page.locator("#layerOpacity")).toBeEnabled();

    await page.locator("#layerLockedBtn").click();
    await expect(page.locator("#layerOpacity")).toBeDisabled();
    await expect(page.locator("#layerVisibleBtn")).toBeEnabled();
    await expect(page.locator("#layerLockedBtn")).toBeEnabled();

    await page.locator("#layerLockedBtn").click();
    const surfaceRow = page.locator("#workspaceTree article[data-surface-key]").first();
    await surfaceRow.locator(".pk-tree-row-main").click();
    await expect(page.locator("#surfaceX")).toBeEnabled();

    await page.locator("#surfaceLockedBtn").click();
    await expect(page.locator("#surfaceX")).toBeDisabled();
    await expect(page.locator("#surfaceOpacity")).toBeDisabled();
    await expect(page.locator("#surfaceAddFillBtn")).toBeDisabled();
    await expect(page.locator("#surfaceVisibleBtn")).toBeEnabled();
    await expect(page.locator("#surfaceLockedBtn")).toBeEnabled();

    await page.locator("#surfaceLockedBtn").click();
    await page.locator("#outputToggle").click();
    await expect(page.locator("#addLayerBtn")).toBeDisabled();
    await expect(page.locator("#addSurfaceBtn")).toBeDisabled();
    await expect(page.locator("#workspaceTree [data-layer-action='visible']").first()).toBeDisabled();
    await expect(page.locator("#workspaceTree [data-surface-action='locked']").first()).toBeDisabled();
    await expect(page.locator("#surfaceX")).toBeDisabled();

    await page.locator("#outputToggle").click();
    await expect(page.locator("#addLayerBtn")).toBeEnabled();
    await expect(page.locator("#addSurfaceBtn")).toBeEnabled();
    await expect(page.locator("#surfaceX")).toBeEnabled();
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

  test("missing project media can be relinked without breaking assignments", async ({ page }) => {
    const errors = collectConsoleErrors(page);
    const projectId = "project-missing-media-smoke";
    const assetId = "asset-missing-smoke";

    await page.goto(appUrl("index.html"));
    await page.evaluate(({ projectId: id, assetId: missingId }) => {
      localStorage.clear();
      window.ProjektikStore.saveProject({
        schemaVersion: 1,
        project: { id, name: "Missing Media Smoke" },
        ui: {
          leftPanelTab: "assets",
          focus: { type: "asset-library", id: missingId },
          assetLibraryId: missingId
        },
        output: { width: 1920, height: 1080 },
        assets: [],
        layers: [{
          id: "layer-missing-smoke",
          name: "Mapped Layer",
          kind: "media",
          visible: true,
          locked: false,
          opacity: 100,
          surfaceKeys: ["surface-missing-smoke"]
        }],
        surfaces: [{
          key: "surface-missing-smoke",
          name: "Missing Surface",
          listTitle: "Missing Surface",
          x: 100,
          y: 100,
          w: 640,
          h: 360,
          opacity: 100,
          visible: true,
          locked: false,
          assetId: missingId,
          outputMode: "asset",
          appearanceLayers: [{
            id: "surface-missing-smoke-asset",
            kind: "asset",
            assetId: missingId,
            visible: true,
            opacity: 1
          }],
          quad: {
            nw: { x: 100, y: 100 },
            ne: { x: 740, y: 100 },
            se: { x: 740, y: 460 },
            sw: { x: 100, y: 460 }
          }
        }]
      });
    }, { projectId, assetId });

    await page.goto(appUrl("editor.html", `?project=${projectId}`));
    await page.locator("#assetsTabBtn").click();
    await expect(page.locator("#assetRecoveryNotice")).toContainText("1 missing media file");
    await expect(page.locator("#selectedAssetPreview [data-relink-asset-id]")).toBeVisible();
    await expect(page.locator("#assetsList .pk-item-tag").filter({ hasText: "Missing" })).toBeVisible();

    const fileChooserPromise = page.waitForEvent("filechooser");
    await page.locator("#selectedAssetPreview [data-relink-asset-id]").click();
    const fileChooser = await fileChooserPromise;
    await fileChooser.setFiles({
      name: "replacement.svg",
      mimeType: "image/svg+xml",
      buffer: Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="32" height="18"><rect width="32" height="18" fill="#ffcc66"/></svg>')
    });

    await expect(page.locator("#assetRecoveryNotice")).toBeHidden();
    await expect(page.locator("#selectedAssetPreview img")).toBeVisible();
    await page.locator("#projectTitle").click();
    await page.locator("#saveProjectBtn").click();

    const savedRecovery = await page.evaluate(({ projectId: id, assetId: expectedAssetId }) => {
      const project = window.ProjektikStore.loadProject(id);
      const asset = project.assets.find((item) => item.id === expectedAssetId);
      const surface = project.surfaces.find((item) => item.key === "surface-missing-smoke");
      return {
        assetId: asset?.id || null,
        hasEmbeddedMedia: Boolean(asset?.embeddedDataUrl),
        surfaceAssetId: surface?.assetId || null,
        appearanceAssetId: surface?.appearanceLayers?.[0]?.assetId || null
      };
    }, { projectId, assetId });
    expect(savedRecovery).toEqual({
      assetId,
      hasEmbeddedMedia: true,
      surfaceAssetId: assetId,
      appearanceAssetId: assetId
    });
    expect(errors).toEqual([]);
  });

  test("bulk media recovery matches exact filenames and reports unmatched files", async ({ page }) => {
    const errors = collectConsoleErrors(page);
    const projectId = "project-bulk-recovery-smoke";

    await page.goto(appUrl("index.html"));
    await page.evaluate((id) => {
      localStorage.clear();
      window.ProjektikStore.saveProject({
        schemaVersion: 1,
        project: { id, name: "Bulk Recovery Smoke" },
        assets: [
          { id: "asset-one", name: "One", kind: "Image", fileName: "one.svg", mimeType: "image/svg+xml", sourceUrl: "blob:expired-one" },
          { id: "asset-two", name: "Two", kind: "Image", fileName: "two.svg", mimeType: "image/svg+xml", sourceUrl: "blob:expired-two" }
        ],
        layers: [],
        surfaces: []
      });
    }, projectId);

    await page.goto(appUrl("editor.html", `?project=${projectId}`));
    await page.locator("#assetsTabBtn").click();
    await expect(page.locator("#assetRecoveryNotice")).toContainText("2 missing media files");

    let fileChooserPromise = page.waitForEvent("filechooser");
    await page.locator("[data-relink-missing-files]").click();
    let fileChooser = await fileChooserPromise;
    await fileChooser.setFiles([
      {
        name: "one.svg",
        mimeType: "image/svg+xml",
        buffer: Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="20" height="10"><rect width="20" height="10" fill="#55ccaa"/></svg>')
      },
      {
        name: "unmatched.svg",
        mimeType: "image/svg+xml",
        buffer: Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="20" height="10"><rect width="20" height="10" fill="#cc5577"/></svg>')
      }
    ]);

    await expect(page.locator("#assetRecoveryNotice")).toContainText("Recovered 1 file. 1 still needs relinking. 1 selected file did not match.");
    await expect(page.locator("#assetsList .pk-item-tag").filter({ hasText: "Missing" })).toHaveCount(1);

    fileChooserPromise = page.waitForEvent("filechooser");
    await page.locator("[data-relink-missing-files]").click();
    fileChooser = await fileChooserPromise;
    await fileChooser.setFiles({
      name: "two.svg",
      mimeType: "image/svg+xml",
      buffer: Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="20" height="10"><rect width="20" height="10" fill="#5577cc"/></svg>')
    });

    await expect(page.locator("#assetRecoveryNotice")).toBeHidden();
    await expect(page.locator("#assetsList .pk-item-tag").filter({ hasText: "Missing" })).toHaveCount(0);
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
          showCalibration: false,
          hudHidden: true
        },
        surfaces: []
      }));
    }, projectId);

    await page.goto(appUrl("projection.html", `?project=${projectId}`));

    await expect(page.locator("#projectionProjectName")).toHaveText("Projection Smoke");
    await expect(page.locator("#projectionPresetChip")).toHaveText("Final");
    await expect(page.locator("#projectionOutputChip")).toHaveText("1280 x 720");
    await expect(page.locator("#projectionApp")).toHaveClass(/is-hud-hidden/);
    await expect(page.locator("#projectionHudToggleBtn")).toHaveText("Show HUD");
    await expect(page.locator("#projectionEmpty")).toBeHidden();
    expect(errors).toEqual([]);
  });
});
