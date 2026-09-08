import { defineConfig } from "vitest/config";

export default defineConfig({
  // Relative asset paths, so the same build works at a domain root and under a GitHub Pages
  // project subpath (`/<repo>/`) without knowing the repo name.
  base: "./",
  server: { open: true, port: 5180 },
  build: { target: "es2022", assetsInlineLimit: 0 },
  test: { environment: "node", include: ["src/**/*.test.ts"] },
});
