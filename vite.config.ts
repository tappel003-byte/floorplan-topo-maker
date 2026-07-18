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
      strategies: "generateSW",
      devOptions: { enabled: false },
      workbox: {
        navigateFallback: "/",
        navigateFallbackDenylist: [/^\/~oauth/, /^\/api\//],
        globPatterns: ["**/*.{js,css,html,ico,png,svg,webmanifest}"],
        cleanupOutdatedCaches: true,
        clientsClaim: true,
        skipWaiting: true,
        runtimeCaching: [
          {
            // HTML navigations: NetworkFirst so users get fresh HTML online,
            // fall back to precached shell offline.
            urlPattern: ({ request }) => request.mode === "navigate",
            handler: "NetworkFirst",
            options: {
              cacheName: "html-navigations",
              networkTimeoutSeconds: 3,
              expiration: { maxEntries: 32 },
            },
          },
          {
            // Same-origin built assets (hashed JS/CSS) — cache-first for
            // instant offline cold-start of the app shell.
            urlPattern: ({ url, request, sameOrigin }) =>
              sameOrigin &&
              (request.destination === "script" ||
                request.destination === "style" ||
                request.destination === "worker") &&
              !url.pathname.startsWith("/~oauth") &&
              !url.pathname.startsWith("/api/"),
            handler: "CacheFirst",
            options: {
              cacheName: "app-shell-assets",
              expiration: { maxEntries: 128 },
            },
          },
        ],
      },
    }),
  ],
});
