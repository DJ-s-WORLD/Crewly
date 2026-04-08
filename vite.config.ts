import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import os from "node:os";

// https://vitejs.dev/config/
// Env files must live next to this file (project root). Only VITE_* vars are exposed to the client.
//
// cacheDir outside the repo avoids EPERM when the project lives under OneDrive/OneDrive — sync locks
// node_modules/.vite and Vite cannot rmdir deps during pre-bundle.
const viteCacheDir = path.join(os.homedir(), ".cache", "lifepilot-vite");

export default defineConfig({
  envDir: path.resolve(__dirname),
  cacheDir: viteCacheDir,
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
    dedupe: ["react", "react-dom", "react/jsx-runtime", "react/jsx-dev-runtime", "@tanstack/react-query", "@tanstack/query-core"],
  },
});
