import { defineConfig } from "vitest/config";

export default defineConfig({
  server: { open: true, port: 5180 },
  build: { target: "es2022", assetsInlineLimit: 0 },
  test: { environment: "node", include: ["src/**/*.test.ts"] },
});
