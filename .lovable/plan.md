Add home-screen icon support for the app.

1. Generate a 512×512 app icon: a simple, clean floor-plan outline with "FLS" centered, using a white/light neutral background and a dark/minimal line style that reads at small sizes.
2. Create a 192×192 variant for smaller launcher tiles.
3. Add `public/manifest.webmanifest` with app name, short name, theme/background colors, `display: "standalone"`, and the icon entries.
4. Wire the manifest and icon tags into `src/routes/__root.tsx` (`manifest`, `theme-color`, `apple-touch-icon`, `icon` favicon).
5. Keep it manifest-only — no service worker or offline behavior unless asked for later.