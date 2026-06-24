import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "node:path";

// Renderer (desktop UI) build config.
// `base: "./"` keeps asset paths relative so the bundle loads from the
// Electron file:// protocol as well as from a future web/cloud host.
export default defineConfig({
  root: "src/renderer",
  base: "./",
  plugins: [react()],
  resolve: {
    alias: {
      "@core": resolve(__dirname, "src/core"),
      "@access": resolve(__dirname, "src/access"),
      "@shared": resolve(__dirname, "src/shared"),
      "@data": resolve(__dirname, "src/data"),
    },
  },
  build: {
    outDir: resolve(__dirname, "dist/renderer"),
    emptyOutDir: true,
  },
});
