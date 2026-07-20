// @lovable.dev/vite-tanstack-config already includes tanstackStart, viteReact,
// tailwindcss, tsConfigPaths, nitro, componentTagger, env injection, aliases, etc.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  tanstackStart: {
    server: { entry: "server" },
  },
  plugins: [
    VitePWA({
      registerType: "autoUpdate",
      injectRegister: null,
      filename: "sw.js",
      strategies: "injectManifest",
      srcDir: "src",
      devOptions: { enabled: false },
      injectManifest: {
        swSrc: "src/sw.ts",
        swDest: "sw.js",
        globPatterns: ["**/*.{js,css,html,ico,png,svg,webmanifest}"],
        globIgnores: ["**/node_modules/**", "**/*.map", "sw.js", "workbox-*.js"],
        manifestTransforms: [
          async (entries) => {
            const manifest = entries
              .filter((entry) => !entry.url.startsWith("server/"))
              .map((entry) =>
                entry.url.startsWith("client/")
                  ? { ...entry, url: entry.url.slice("client/".length) }
                  : entry,
              );
            return { manifest, warnings: [] };
          },
        ],
        additionalManifestEntries: [{ url: "/", revision: null }],
      },
    }),
  ],
});
