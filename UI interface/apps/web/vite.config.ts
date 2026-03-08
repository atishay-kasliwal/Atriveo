import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

function normalizeBasePath(raw?: string): string {
  const value = (raw || "/").trim();
  if (!value || value === "/") return "/";
  const withLeading = value.startsWith("/") ? value : `/${value}`;
  return withLeading.endsWith("/") ? withLeading : `${withLeading}/`;
}

const appBase = normalizeBasePath(process.env.VITE_APP_BASE);

export default defineConfig({
  base: appBase,
  build: {
    outDir: "dist",
  },
  plugins: [react()],
  server: {
    port: 5173,
    hmr: false,
  },
});
