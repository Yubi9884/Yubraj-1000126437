import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { readFileSync, writeFileSync, readdirSync } from "node:fs";

// Send /api requests to the backend on port 4000.
const proxy = { "/api": "http://127.0.0.1:4000" };

export default defineConfig({
  plugins: [
    react(),
    {
      name: "offline-precache",
      closeBundle() {
        // List the built app files so the browser can save them for offline use.
        const assets = readdirSync("dist/assets").map(
          (name) => `/assets/${name}`,
        );
        const precache = [
          "/",
          "/index.html",
          "/manifest.webmanifest",
          "/icon.svg",
          ...assets,
        ];
        // Replace the build marker with the finished file list and give each build its own cache name.
        const source = readFileSync("public/sw.js", "utf8");
        writeFileSync(
          "dist/sw.js",
          source
            .replace(
              /\/\* BUILD_PRECACHE \*\/ \[[^;]+\]/,
              JSON.stringify(precache),
            )
            .replace("studypass-shell-v1", `studypass-shell-${Date.now()}`),
        );
      },
    },
  ],
  // Use the same port and API proxy for development and production preview.
  server: { port: 5173, strictPort: true, proxy },
  preview: { port: 5173, strictPort: true, proxy },
  test: { environment: "node", include: ["tests/**/*.test.{js,jsx}"] },
});
