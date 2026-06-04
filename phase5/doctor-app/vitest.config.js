/**
 * vitest.config.js
 * Phase 5 Fix: Vitest testing configuration for doctor-app
 *
 * APPLY TO: doctor-app/vitest.config.js
 *
 * Install dependencies first:
 *   npm install -D vitest @testing-library/react @testing-library/user-event @testing-library/jest-dom jsdom
 *
 * Add to doctor-app/package.json scripts section:
 *   "test": "vitest",
 *   "test:run": "vitest run",
 *   "test:coverage": "vitest run --coverage",
 *   "test:ui": "vitest --ui"
 */
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: "./src/tests/setup.js",
    coverage: {
      provider: "v8",
      reporter: ["text", "lcov", "html"],
      exclude: [
        "node_modules/",
        "src/tests/",
        "**/*.config.*",
        "**/index.jsx",
        "**/main.jsx",
      ],
    },
    include: ["src/**/*.{test,spec}.{js,jsx,ts,tsx}"],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
