import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "node:path";

export default defineConfig({
  root: resolve(process.cwd(), "apps/web"),
  plugins: [react()],
  server: {
    port: 5173,
    fs: {
      allow: [resolve(process.cwd())]
    }
  }
});
