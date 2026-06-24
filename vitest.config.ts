import { defineConfig } from "vitest/config";
import { resolve } from "node:path";

// Dedicated test config so tests are discovered from the PROJECT root,
// independent of the renderer's Vite `root`. Aliases mirror tsconfig paths.
export default defineConfig({
  resolve: {
    alias: {
      "@core": resolve(__dirname, "src/core"),
      "@access": resolve(__dirname, "src/access"),
      "@shared": resolve(__dirname, "src/shared"),
      "@data": resolve(__dirname, "src/data"),
    },
  },
  test: {
    root: __dirname,
    environment: "node",
    include: ["src/**/*.{test,spec}.ts"],
    globals: true,
  },
});
