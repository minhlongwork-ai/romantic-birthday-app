import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

import { loadSiteConfig } from "../../scripts/site-config.mjs";
import { createSiteMetadataPlugin } from "../../scripts/site-metadata.mjs";

const site = await loadSiteConfig();

export default defineConfig({
  root: fileURLToPath(new URL(".", import.meta.url)),
  base: "/september/",
  publicDir: "public",
  plugins: [createSiteMetadataPlugin(site, "september")],
  build: {
    target: "es2022",
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("node_modules/three")) return "september-workshop";
          if (id.endsWith("/src/core/camera-session.mjs")) return "september-camera";
          return undefined;
        },
      },
    },
  },
});
