(function (global) {
  async function start(initRuntime) {
    const bootstrap = global.ProjektikBootstrap;
    const dependencies = await bootstrap.load({
      store: true,
      projectionSession: true
    });
    return initRuntime({
      ...dependencies,
      bootstrap
    });
  }

  global.ProjektikEditorView = { start };
})(window);
