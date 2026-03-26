(function (global) {
  async function init() {
    const bootstrap = global.ProjektikBootstrap;
    const { root, themeSelectorApi, projectionSession } = await bootstrap.load({
      projectionSession: true
    });
    const params = new URLSearchParams(global.location.search);
    const projectId = params.get("project") || "";
    const app = document.getElementById("projectionApp");
    const wrap = document.getElementById("projectionWrap");
    const stage = document.getElementById("projectionStage");
    const emptyState = document.getElementById("projectionEmpty");
    const projectName = document.getElementById("projectionProjectName");
    const presetChip = document.getElementById("projectionPresetChip");
    const pinChip = document.getElementById("projectionPinChip");
    const outputChip = document.getElementById("projectionOutputChip");
    const statusText = document.getElementById("projectionStatusText");
    const flagsChip = document.getElementById("projectionFlagsChip");
    const fullscreenBtn = document.getElementById("projectionPageFullscreenBtn");
    const hudToggleBtn = document.getElementById("projectionHudToggleBtn");
    const calibration = document.getElementById("projectionCalibration");
    const calibrationGrid = document.getElementById("projectionCalibrationGrid");
    const outputLayer = document.getElementById("projectionOutputLayer");
    const reference = document.getElementById("projectionReference");
    const referenceMedia = document.getElementById("projectionReferenceMedia");
    const surfaceLayer = document.getElementById("projectionSurfaceLayer");

    bootstrap.applyStoredTheme({
      root,
      storageKey: "projektik-theme",
      defaultTheme: "tech-grid"
    });

    let lastSnapshotSignature = "";

    function getStageRect(snapshot) {
      const bounds = wrap.getBoundingClientRect();
      const aspect = snapshot.output.width / Math.max(1, snapshot.output.height);
      let width = bounds.width;
      let height = width / aspect;
      if (height > bounds.height) {
        height = bounds.height;
        width = height * aspect;
      }
      return { width, height };
    }

    function applyStageSize(snapshot) {
      const rect = getStageRect(snapshot);
      stage.style.width = `${rect.width}px`;
      stage.style.height = `${rect.height}px`;
    }

    function syncSurfaceNodes(surfaceSnapshots) {
      const existing = new Map(
        Array.from(surfaceLayer.querySelectorAll(".pk-projection-surface[data-surface-key]"))
          .map((node) => [node.dataset.surfaceKey, node])
      );

      surfaceSnapshots.forEach((surface) => {
        const node = existing.get(surface.key) || document.createElement("div");
        if (!existing.has(surface.key)) {
          node.className = "pk-projection-surface";
          node.dataset.surfaceKey = surface.key;
          node.innerHTML = `
            <div class="pk-projection-surface-content" data-surface-content>
              <div class="pk-projection-stage-media" data-stage-media></div>
              <div class="pk-projection-surface-grid" data-surface-grid></div>
            </div>
            <svg class="pk-projection-surface-outline" preserveAspectRatio="none" data-surface-outline>
              <polygon data-surface-polygon></polygon>
            </svg>
          `;
        }
        surfaceLayer.append(node);
        existing.delete(surface.key);
      });

      existing.forEach((node) => node.remove());
      return Array.from(surfaceLayer.querySelectorAll(".pk-projection-surface[data-surface-key]"));
    }

    function renderCalibration(snapshot) {
      calibration.hidden = !snapshot.calibration.visible;
      if (!snapshot.calibration.visible) {
        return;
      }
      calibration.style.left = `${(snapshot.calibration.x / snapshot.output.width) * 100}%`;
      calibration.style.top = `${(snapshot.calibration.y / snapshot.output.height) * 100}%`;
      calibration.style.width = `${(snapshot.calibration.w / snapshot.output.width) * 100}%`;
      calibration.style.height = `${(snapshot.calibration.h / snapshot.output.height) * 100}%`;
      calibration.classList.toggle("is-dot-grid", snapshot.calibration.gridType === "dot");
      calibration.style.borderStyle = snapshot.calibration.showFrame ? "solid" : "dashed";
      calibrationGrid.style.backgroundSize = `${Math.max(8, snapshot.calibration.gridSize)}px ${Math.max(8, snapshot.calibration.gridSize)}px`;
    }

    function renderWorkingArea(snapshot) {
      const workingArea = snapshot.workingArea || snapshot.calibration || {
        x: 0,
        y: 0,
        w: snapshot.output.width,
        h: snapshot.output.height,
        outsideFill: "#000000"
      };
      const insetTop = (workingArea.y / Math.max(1, snapshot.output.height)) * 100;
      const insetLeft = (workingArea.x / Math.max(1, snapshot.output.width)) * 100;
      const insetRight = ((snapshot.output.width - (workingArea.x + workingArea.w)) / Math.max(1, snapshot.output.width)) * 100;
      const insetBottom = ((snapshot.output.height - (workingArea.y + workingArea.h)) / Math.max(1, snapshot.output.height)) * 100;
      stage.style.background = workingArea.outsideFill || "#000000";
      outputLayer.style.clipPath = `inset(${Math.max(0, insetTop)}% ${Math.max(0, insetRight)}% ${Math.max(0, insetBottom)}% ${Math.max(0, insetLeft)}%)`;
    }

    function renderReference(snapshot) {
      reference.hidden = !snapshot.reference.visible;
      if (!snapshot.reference.visible) {
        return;
      }
      reference.style.left = `${(snapshot.reference.x / snapshot.output.width) * 100}%`;
      reference.style.top = `${(snapshot.reference.y / snapshot.output.height) * 100}%`;
      reference.style.width = `${(snapshot.reference.w / snapshot.output.width) * 100}%`;
      reference.style.height = `${(snapshot.reference.h / snapshot.output.height) * 100}%`;
      reference.style.clipPath = snapshot.reference.clipPath;
      referenceMedia.style.opacity = String(snapshot.reference.opacity);
      if (snapshot.reference.sourceUrl) {
        referenceMedia.style.backgroundImage = `url("${snapshot.reference.sourceUrl}")`;
      } else {
        referenceMedia.style.backgroundImage = "";
      }
      if (snapshot.reference.fitMode === "anchored" && snapshot.reference.transform) {
        referenceMedia.style.width = `${100 * snapshot.reference.transform.scaleX}%`;
        referenceMedia.style.height = `${100 * snapshot.reference.transform.scaleY}%`;
        referenceMedia.style.left = `${snapshot.reference.transform.offsetX}px`;
        referenceMedia.style.top = `${snapshot.reference.transform.offsetY}px`;
        referenceMedia.style.transform = `rotate(${snapshot.reference.transform.rotation}deg)`;
      } else {
        referenceMedia.style.width = "100%";
        referenceMedia.style.height = "100%";
        referenceMedia.style.left = "0";
        referenceMedia.style.top = "0";
        referenceMedia.style.transform = "";
      }
    }

    function normalizeAssetFitMode(fitMode) {
      if (["crop", "fit", "fill-width", "fill-height", "warp"].includes(fitMode)) {
        return fitMode;
      }
      if (fitMode === "anchored") {
        return "crop";
      }
      return "warp";
    }

    function getAssetSourceSize(asset, surface) {
      const width = Math.max(1, Number(asset?.width) || Number(surface?.w) || 1);
      const height = Math.max(1, Number(asset?.height) || Number(surface?.h) || 1);
      return { width, height, aspect: width / Math.max(1, height) };
    }

    function getSurfaceAssetBaseBox(surface, asset, fitMode) {
      const width = Math.max(1, Number(surface?.w) || 1);
      const height = Math.max(1, Number(surface?.h) || 1);
      const source = getAssetSourceSize(asset, surface);
      let boxWidth = width;
      let boxHeight = height;
      let left = 0;
      let top = 0;

      if (fitMode === "fit") {
        if (source.aspect >= width / height) {
          boxWidth = width;
          boxHeight = width / source.aspect;
        } else {
          boxHeight = height;
          boxWidth = height * source.aspect;
        }
        left = (width - boxWidth) / 2;
        top = (height - boxHeight) / 2;
      } else if (fitMode === "fill-width") {
        boxWidth = width;
        boxHeight = width / source.aspect;
        top = (height - boxHeight) / 2;
      } else if (fitMode === "fill-height") {
        boxHeight = height;
        boxWidth = height * source.aspect;
        left = (width - boxWidth) / 2;
      } else if (fitMode === "crop") {
        if (source.aspect >= width / height) {
          boxHeight = height;
          boxWidth = height * source.aspect;
        } else {
          boxWidth = width;
          boxHeight = width / source.aspect;
        }
        left = (width - boxWidth) / 2;
        top = (height - boxHeight) / 2;
      }

      return { x: left, y: top, w: boxWidth, h: boxHeight };
    }

    function getSurfaceAssetDisplayBox(surface, asset, transform) {
      const fitMode = normalizeAssetFitMode(transform?.fitMode);
      if (fitMode === "warp") {
        return { x: 0, y: 0, w: surface.w, h: surface.h };
      }
      const baseBox = getSurfaceAssetBaseBox(surface, asset, fitMode);
      return {
        x: baseBox.x + (transform?.offsetX || 0),
        y: baseBox.y + (transform?.offsetY || 0),
        w: Math.max(24, baseBox.w * Math.max(0.05, transform?.scaleX ?? 1)),
        h: Math.max(24, baseBox.h * Math.max(0.05, transform?.scaleY ?? 1))
      };
    }

    function renderSurfaceNode(node, surface, output, projectionView = null) {
      node.hidden = !surface.visible;
      node.style.left = `${(surface.x / output.width) * 100}%`;
      node.style.top = `${(surface.y / output.height) * 100}%`;
      node.style.width = `${(surface.w / output.width) * 100}%`;
      node.style.height = `${(surface.h / output.height) * 100}%`;
      node.style.zIndex = String(surface.zIndex);

      const content = node.querySelector("[data-surface-content]");
      const media = node.querySelector("[data-stage-media]");
      const grid = node.querySelector("[data-surface-grid]");
      const outline = node.querySelector("[data-surface-outline]");
      const polygon = node.querySelector("[data-surface-polygon]");

      content.style.clipPath = surface.clipPath;
      polygon.setAttribute("points", surface.polygonPoints);
      grid.style.opacity = surface.gridVisible ? "1" : "0";
      grid.style.backgroundSize = `${Math.max(16, surface.gridDensity)}px ${Math.max(16, surface.gridDensity)}px`;
      outline.style.opacity = projectionView?.showGuides && surface.gridVisible ? "1" : "0";

      const outputMode = surface.outputMode || (surface.asset?.sourceUrl ? "asset" : "transparent");
      const fillColor = surface.fillColor || "#ffffff";
      const patternColor = surface.patternColor || "#ffffff";
      const patternScale = Math.max(8, Math.min(320, Number(surface.patternScale) || 48));

      if (outputMode === "asset" && surface.asset?.sourceUrl) {
        if (surface.asset.kind === "Video") {
          let video = media.querySelector("video");
          if (!video) {
            media.innerHTML = "<video muted playsinline loop></video>";
            video = media.querySelector("video");
          }
          media.style.backgroundImage = "";
          media.style.backgroundColor = "transparent";
          media.style.backgroundSize = "";
          media.style.backgroundPosition = "center";
          media.style.backgroundRepeat = "no-repeat";
          if (video.dataset.sourceUrl !== surface.asset.sourceUrl) {
            video.src = surface.asset.sourceUrl;
            video.dataset.sourceUrl = surface.asset.sourceUrl;
          }
          video.play().catch(() => {});
        } else {
          media.innerHTML = "";
          media.style.backgroundImage = `url("${surface.asset.sourceUrl}")`;
          media.style.backgroundColor = "transparent";
          media.style.backgroundSize = "cover";
          media.style.backgroundPosition = "center";
          media.style.backgroundRepeat = "no-repeat";
        }
      } else {
        media.innerHTML = "";
        if (outputMode === "fill" || outputMode === "mask") {
          media.style.backgroundImage = "";
          media.style.backgroundColor = fillColor;
          media.style.backgroundSize = "";
          media.style.backgroundPosition = "center";
          media.style.backgroundRepeat = "no-repeat";
        } else if (outputMode === "pattern-grid") {
          media.style.backgroundImage = `
            linear-gradient(to right, ${patternColor} 1px, transparent 1px),
            linear-gradient(to bottom, ${patternColor} 1px, transparent 1px)
          `;
          media.style.backgroundColor = fillColor;
          media.style.backgroundSize = `${patternScale}px ${patternScale}px`;
          media.style.backgroundPosition = "center";
          media.style.backgroundRepeat = "repeat";
        } else if (outputMode === "pattern-hatch") {
          media.style.backgroundImage = `repeating-linear-gradient(135deg, ${patternColor} 0 2px, transparent 2px ${Math.max(8, Math.round(patternScale / 2))}px)`;
          media.style.backgroundColor = fillColor;
          media.style.backgroundSize = `${patternScale}px ${patternScale}px`;
          media.style.backgroundPosition = "center";
          media.style.backgroundRepeat = "repeat";
        } else {
          media.style.backgroundImage = "";
          media.style.backgroundColor = "transparent";
          media.style.backgroundSize = "";
          media.style.backgroundPosition = "center";
          media.style.backgroundRepeat = "no-repeat";
        }
      }

      media.style.opacity = String(surface.opacity);
      const fitMode = normalizeAssetFitMode(surface.assetTransform?.fitMode);
      const assetBox = surface.asset ? getSurfaceAssetDisplayBox(surface, surface.asset, surface.assetTransform) : null;
      media.style.transformOrigin = fitMode === "warp" ? "top left" : "center";
      if (fitMode !== "warp" && assetBox) {
        media.style.width = `${assetBox.w}px`;
        media.style.height = `${assetBox.h}px`;
        media.style.left = `${assetBox.x}px`;
        media.style.top = `${assetBox.y}px`;
        media.style.transform = `rotate(${surface.assetTransform.rotation}deg)`;
      } else {
        media.style.width = "100%";
        media.style.height = "100%";
        media.style.left = "0";
        media.style.top = "0";
        media.style.transform = "";
      }
    }

    function renderSnapshot(snapshot) {
      if (!snapshot) {
        app.classList.add("is-disconnected");
        emptyState.hidden = false;
        statusText.textContent = "No console connected";
        flagsChip.textContent = "Clean";
        return;
      }

      if (themeSelectorApi) {
        themeSelectorApi.applyTheme(snapshot.theme || root.getAttribute("data-theme") || "tech-grid", {
          root
        });
      } else {
        root.setAttribute("data-theme", snapshot.theme || "tech-grid");
      }
      applyStageSize(snapshot);
      app.classList.remove("is-disconnected");
      emptyState.hidden = true;
      projectName.textContent = snapshot.projectName || "PROJEKTIK Projection";
      presetChip.textContent = snapshot.projectionView?.presetLabel || "Live Output";
      pinChip.textContent = snapshot.projectionView?.pinnedLabel || "Full Project";
      outputChip.textContent = `${snapshot.output.width} x ${snapshot.output.height}`;
      statusText.textContent = snapshot.updatedAt ? `Linked ${new Date(snapshot.updatedAt).toLocaleTimeString()}` : "Linked";
      flagsChip.textContent = [
        snapshot.projectionView?.showGuides ? "Guides" : "",
        snapshot.projectionView?.showReference ? "Reference" : "",
        snapshot.projectionView?.showCalibration ? "Calibration" : ""
      ].filter(Boolean).join(" + ") || "Clean";

      renderWorkingArea(snapshot);
      renderCalibration(snapshot);
      renderReference(snapshot);
      syncSurfaceNodes(snapshot.surfaces).forEach((node) => {
        const surface = snapshot.surfaces.find((item) => item.key === node.dataset.surfaceKey);
        if (surface) {
          renderSurfaceNode(node, surface, snapshot.output, snapshot.projectionView);
        }
      });
    }

    function loadSnapshot(force = false) {
      if (!projectId) {
        renderSnapshot(null);
        return;
      }
      const snapshot = projectionSession?.readSnapshot(projectId);
      const signature = snapshot ? JSON.stringify(snapshot) : "";
      if (!force && signature === lastSnapshotSignature) {
        return;
      }
      lastSnapshotSignature = signature;
      renderSnapshot(snapshot);
    }

    fullscreenBtn.addEventListener("click", async () => {
      try {
        if (document.fullscreenElement) {
          await document.exitFullscreen();
        } else if (document.documentElement.requestFullscreen) {
          await document.documentElement.requestFullscreen();
        }
      } catch (error) {
        console.error("Projection fullscreen failed", error);
      }
    });

    hudToggleBtn.addEventListener("click", () => {
      app.classList.toggle("is-hud-hidden");
      hudToggleBtn.textContent = app.classList.contains("is-hud-hidden") ? "Show HUD" : "Hide HUD";
    });

    document.addEventListener("keydown", async (event) => {
      const key = event.key.toLowerCase();
      if (key === "f") {
        event.preventDefault();
        fullscreenBtn.click();
      }
      if (key === "h") {
        event.preventDefault();
        hudToggleBtn.click();
      }
      if (key === "escape" && app.classList.contains("is-hud-hidden")) {
        event.preventDefault();
        app.classList.remove("is-hud-hidden");
        hudToggleBtn.textContent = "Hide HUD";
      }
    });

    global.addEventListener("storage", (event) => {
      if (event.key !== projectionSession?.getSessionKey(projectId)) {
        return;
      }
      loadSnapshot(true);
    });

    global.addEventListener("resize", () => loadSnapshot(true));
    global.addEventListener("focus", () => loadSnapshot(true));
    global.setInterval(() => loadSnapshot(), 750);

    loadSnapshot(true);
  }

  global.ProjektikProjectionView = { init };
})(window);
