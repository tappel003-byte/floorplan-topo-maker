Replace the current home-screen icon with a new design inspired by the screenshot: flowing organic contour lines running across earth-tone bands (tan, green, brown), like a small crop of a real topographic survey map — no text, no border.

## What changes

- Regenerate `public/icon-512.png` and `public/icon-192.png` using the new design brief below.
- No code changes — filenames stay the same, so the manifest and `<link>` tags in `src/routes/__root.tsx` don't need edits.

## Design brief for the icon

- Square, filled edge-to-edge (no rounded corners — iOS/Android add their own mask).
- Soft earth-tone regions flowing diagonally: warm tan/sand on one side, muted sage green on the other, with a hint of deeper brown at one corner.
- Thin dark contour lines (like the screenshot) curving organically across the whole square, ignoring the color boundaries.
- No text, no letters, no floor-plan walls — just contours + earth bands, so it reads clearly at 48px on a home screen.
- Palette pulled from the screenshot: cream `#f5ebd6`, tan `#d9b881`, sage `#b8c49a`, brown `#8a6a3e`, contour lines dark brown `#4a3a24`.

## After it's built

You'll need to remove the old home-screen shortcut and re-add it after the next Publish → Update to see the new icon (iOS caches the old one).
