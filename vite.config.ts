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
      // Point at the .ts source; vite-plugin-pwa will build it via Vite.
      // The output filename is controlled by `filename` above.
      // eslint-disable-next-line
      // @ts-ignore
      // Note: injectManifest reads this entry.
      // @ts-expect-error - srcDir + filename combine to locate the source
      // (documented in vite-plugin-pwa).
      // (ignored)
      // We keep TS source at src/sw.ts.
      // devOptions disabled below.
      // The plugin uses filename as both the input file lookup and output.
      // Since filename ends in .js, we override with `injectManifest.swSrc`
      // below to point at the .ts file explicitly.
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
      devOptions: { enabled: false },
    }),
  ],
});
