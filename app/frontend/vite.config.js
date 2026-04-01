const { defineConfig } = require('vite');

module.exports = defineConfig(({ command }) => ({
  // Use relative paths when building for Electron's file:// protocol.
  // Keep Vite dev server behavior unchanged.
  base: command === 'build' ? './' : '/'
}));
