# Readable labels on desktop

Yes, it makes sense — and it's not a font-size problem, it's a density problem.

Right now every value label is drawn into the floor-plan image at a fixed size, with a white box around it. On your phone or iPad you're always zoomed into one area, so the labels have room. On the desktop you're looking at the entire building fit into one window, so ~150 boxed labels are competing for the same space: at 11px they collide into a wall of white boxes, at 6–8px they stop colliding but become too small to read. There is no font size that fixes both at that zoom level.

Three changes fix it.

## 1. Labels keep a constant size on screen

Today the label size is tied to the plan image, so zooming out shrinks the text. Instead, the chosen size (say 11px) means 11px on your screen at any zoom. You pick a size that's readable once and it stays readable whether you're fit-to-screen or zoomed into a corridor.

## 2. Declutter — hide labels that would overlap

When two labels would collide at the current zoom, only one is drawn; the other point still shows its dot, so no data disappears from the plan. Zoom in and the hidden labels reappear automatically as space opens up.

Priority order for who wins a collision: High/Low points and the currently selected point always keep their label, then the rest in reading order.

Result: fit-to-screen gives a clean plan with readable numbers spread across it, and zooming reveals full detail — which is exactly how you'd walk a client through it.

## 3. Tighter label pill

The white box padding is generous (6px each side). Trimming it and lightening the border makes each label take noticeably less area, which also lets more of them survive the declutter pass.

## Controls

- A "Declutter labels" toggle in the Labels & layers panel, on by default. Turning it off gives today's show-everything behavior for when you want the full dump.
- The existing point label size stepper stays; it now means on-screen size.

## Technical notes

- `renderTopoTop` in `src/components/tabs/TopoTab.tsx` and the point-label block in `src/components/tabs/FieldTab.tsx` both draw labels inside the canvas world transform. Divide font size, padding and corner radius by the current canvas scale so they resolve to fixed device pixels; the anchor point stays in world space so labels stay pinned to their dots.
- Declutter: single greedy pass per frame over the label rects (already computed via `measureText`) with an axis-aligned overlap test against accepted rects; skipped labels draw the dot only. Sort by priority before the pass so High/Low/selected are accepted first.
- Hit-testing for label dragging must use the same scale-corrected rects so dragging still lines up, and must skip suppressed labels.
- Scope is the on-screen Data and Topo views only. The Export screen is out of scope for this change and is left exactly as it is.
