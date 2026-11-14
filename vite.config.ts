/// <reference types="vitest" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// base "./" keeps asset paths relative, so the build works on any static host.
export default defineConfig({
  base: "./",
  plugins: [react()],
  build: {
    // Hard rule 7: no network calls after the first page load, so the seed data ships in the main
    // bundle instead of a lazy chunk. The bundle is large on purpose.
    chunkSizeWarningLimit: 10_000,
  },
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: ["./tests/setup.ts"],
    include: ["tests/**/*.test.{ts,tsx}"],
  },
});
