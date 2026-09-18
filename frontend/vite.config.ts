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
