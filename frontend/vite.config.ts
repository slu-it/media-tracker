/// <reference types="vitest/config" />
import { defineConfig } from "vite";
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
  },
});
