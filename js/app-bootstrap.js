(function (global) {
  const DEFAULTS = {
    storeSrc: "./js/project-store.js",
    projectionSessionSrc: "./js/projection-session.js",
    storageKey: "projektik-theme",
    defaultTheme: "tech-grid"
  };

  const scriptLoads = new Map();

  function toAbsoluteUrl(path) {
    return new URL(path, global.location.href).href;
  }

  function ensureScript(src) {
    const absoluteSrc = toAbsoluteUrl(src);
    if (scriptLoads.has(absoluteSrc)) {
      return scriptLoads.get(absoluteSrc);
    }
    const existing = Array.from(document.scripts).find((node) => node.src === absoluteSrc);
    if (existing) {
      const loaded = Promise.resolve();
      scriptLoads.set(absoluteSrc, loaded);
      return loaded;
    }
    const request = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = src;
      script.async = false;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error(`Failed to load script: ${src}`));
      document.head.appendChild(script);
    });
    scriptLoads.set(absoluteSrc, request);
    return request;
  }

  async function load(options = {}) {
    const config = { ...DEFAULTS, ...options };
    if (config.store) {
      await ensureScript(config.storeSrc);
    }
    if (config.projectionSession) {
      await ensureScript(config.projectionSessionSrc);
    }
    return {
      root: document.documentElement,
      themeSelectorApi: global.DesignSystemThemeSelector || null,
      store: global.ProjektikStore || null,
      projectionSession: global.ProjektikProjectionSession || null
    };
  }

  function initThemeSelector(themeSelect, options = {}) {
    const api = global.DesignSystemThemeSelector;
    if (!api || !themeSelect) {
      return null;
    }
    const root = options.root || document.documentElement;
    return api.initThemeSelector(themeSelect, {
      root,
      storageKey: options.storageKey || DEFAULTS.storageKey,
      defaultTheme: options.defaultTheme || root.getAttribute("data-theme") || DEFAULTS.defaultTheme
    });
  }

  function applyStoredTheme(options = {}) {
    const api = global.DesignSystemThemeSelector;
    const root = options.root || document.documentElement;
    const themeName = root.getAttribute("data-theme") || options.defaultTheme || DEFAULTS.defaultTheme;
    if (!api) {
      root.setAttribute("data-theme", themeName);
      return themeName;
    }
    return api.applyTheme(themeName, {
      root,
      storageKey: options.storageKey || DEFAULTS.storageKey,
      defaultTheme: options.defaultTheme || DEFAULTS.defaultTheme
    });
  }

  global.ProjektikBootstrap = {
    load,
    initThemeSelector,
    applyStoredTheme
  };
})(window);
