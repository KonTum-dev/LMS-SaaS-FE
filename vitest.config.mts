import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL(".", import.meta.url)) },
  },
  test: {
    // Ant Design/jsdom suites are CPU-heavy; bounding workers keeps the
    // default five-second assertion timeout meaningful instead of flaky.
    maxWorkers: 2,
  },
});
