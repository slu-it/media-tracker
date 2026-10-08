import { defineConfig, coverageConfigDefaults } from "vitest/config";
import react from "@vitejs/plugin-react";

// The backend (Ktor, :8080) owns /login, /logout, /health and /api/**.
// During `pnpm dev` the Vite dev server proxies those paths so the session cookie
// is same-origin and the login gate works exactly as in production.
const backend = "http://localhost:8080";

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: "build/dist",
    emptyOutDir: true,
    sourcemap: false,
  },
  server: {
    host: "0.0.0.0",
    port: 5173,
    proxy: {
      "/api": backend,
      "/login": backend,
      "/logout": backend,
      "/health": backend,
    },
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test-setup.ts"],
    // These are integration-style tests: MUI dialogs rendered in jsdom, ~1 s each locally. The generous timeout
    // is headroom for the slower CI runner, where the default 5 s was hit while nothing had failed.
    testTimeout: 10_000,
    // Reuse workers (and their jsdom) across test files instead of spawning one per file (~1.8 s startup each).
    // Safe only because src/test-setup.ts runs per file and does the cleanup itself (see there).
    isolate: false,
    // Machine-readable totals for .claude/scripts/test-summary.py, the test-runner's counting source, like
    // Gradle's backend JUnit XML.
    reporters: ["default", "junit"],
    outputFile: { junit: "build/test-results/vitest-junit.xml" },
    // Coverage is informational, like the backend's Kover report: it has no threshold and never fails the build.
    // src/types/ is excluded because it holds type-only DTO mirrors by contract; a runtime helper does not belong there.
    coverage: {
      provider: "v8",
      reportsDirectory: "build/coverage",
      reporter: ["text-summary", "html"],
      include: ["src/**"],
      exclude: [
        ...coverageConfigDefaults.exclude,
        "src/**/*.test.{ts,tsx}",
        "src/test/**",
        "src/test-setup.ts",
        "src/types/**",
        "src/main.tsx",
        "src/**/*.d.ts",
      ],
    },
  },
});
