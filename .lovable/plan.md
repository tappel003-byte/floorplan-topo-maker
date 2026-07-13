## Problem

In Color cells mode, thin white lines appear between the grid cells. They aren't real gridlines — they're seams from how the cells are painted.

## Cause

`renderTopoBase` in `src/components/tabs/TopoTab.tsx` (around line 959) paints each cell with `ctx.fillRect(...)` using `ctx.globalAlpha = resolved.contourOpacity`. Because opacity is <1, every cell blends against the white canvas *individually*. Any sub-pixel gap between adjacent rectangles (from fractional `g.step` values at the current zoom) shows the white background through — producing the vertical/horizontal streaks visible in your screenshot.

## Fix

Paint the cells fully opaque onto an offscreen canvas first, then blit that composite onto the main canvas once with the opacity applied. That way seams (if any) are between fully opaque neighbors of near-identical color and become invisible, and the fade-to-plan effect is preserved.

Change in `src/components/tabs/TopoTab.tsx` inside `renderTopoBase`:

1. Create an offscreen canvas sized to the boundary bbox at devicePixelRatio.
2. Loop the grid and `fillRect` cells onto it at `globalAlpha = 1`, with a slightly larger overlap (`g.step + 1`) to defeat sub-pixel gaps.
3. On the main context, set `globalAlpha = resolved.contourOpacity` once and `drawImage` the offscreen canvas inside the existing clip.
4. Restore `globalAlpha = 1`.

No other modes (contour lines, points-only, isobands) are touched. No changes to palette, opacity slider, legend, or data.

## Verification

- Load a plan, switch mode to Color cells, confirm the white streaks are gone at multiple zoom levels.
- Toggle opacity slider — fade still works.
- Switch to Contour lines and Isobands — unchanged.
