## Icon concept

A simplified topographic contour map — organic, irregular concentric rings (like a real hill cross-section, not perfect circles) in the app's earth-tone palette. No letters, no floor plan outline. Just contours.

## Design

- **Shape**: 3–5 nested irregular contour lines forming a soft blob/hill shape, centered on the icon
- **Palette**: pulled from the current Earth Tone contour: cream/tan center → warm tan → brown edges. Solid, filled bands (like the "color cells" mode), not just outlines — reads at small sizes
- **Background**: solid cream (`#f5efe4`-ish) so it stands out on both light and dark home screens
- **No text, no border, no floor plan** — pure topo shape, corners rounded by iOS automatically
- **Square, 1024×1024**, exported as PNG, then downsampled to 512 and 192

## Files

1. Generate `public/icon-1024.png` via `imagegen` (premium tier for crispness at small sizes)
2. Downsample to `public/icon-512.png` and `public/icon-192.png` (overwrite the existing FLS icons)
3. Leave `public/manifest.webmanifest` and `__root.tsx` head links untouched — same filenames, so no code change needed
4. Delete `public/icon-1024.png` after downsampling (kept only as source)

## Verification

- View the generated 512 and 192 PNGs to confirm the topo shape reads clearly at small size
- Confirm no white/grey fallback box — full-bleed cream background
- User will re-add to home screen after next publish to see it
