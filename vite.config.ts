import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import process from "node:process";

const host = process.env.TAURI_DEV_HOST;

export default defineConfig(async () => ({
  plugins: [react()],
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    host: host || false,
    hmr: host
      ? {
          protocol: "ws",
          host,
          port: 1421,
        }
      : undefined,
    watch: {
      ignored: ["**/src-tauri/**"],
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("node_modules/openpgp")) return "openpgp";
          if (id.includes("node_modules/qrcode")) return "qrcode";
          if (
            id.includes("node_modules/react") ||
            id.includes("node_modules/@tanstack") ||
            id.includes("node_modules/zustand")
          )
            return "ui-vendor";
        },
      },
    },
  },
}));
