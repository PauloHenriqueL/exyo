/// <reference types="vitest/config" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  root: "client",
  plugins: [react()],
  build: { outDir: "../dist", emptyOutDir: true },
  server: { port: 5173 },
  test: { root: ".", include: ["shared/**/*.test.ts", "server/**/*.test.ts"] },
});
