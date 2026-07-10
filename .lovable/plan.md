## Goal
Bring back the ability to drag a point by its **elevation number label** instead of the dot itself, so your finger never covers the point you're trying to place.

## The problem
Right now, when you touch the 5.50 point to move it, the dot snaps under your fingertip and hides. You lose the reference of where the point actually is while you're placing it.

## The fix
Two changes to how dragging works in `FieldTab.tsx`:

1. **Label as a drag handle**
   - Touching the elevation number (e.g. "5.50") starts a drag of its point — same as before.
   - The dot stays offset from your finger (up and to the left of the label), so it remains visible the whole time you're dragging.

2. **Preserve the finger-to-point offset**
   - Whether you grab the dot or the label, the point moves by the *delta* of your finger, not by snapping under it.
   - So if you touch the label 30px below the dot, the dot stays 30px above your finger for the entire drag.
   - You can see exactly where the dot is landing before you lift.

## What stays the same
- Tap the dot (or label) → keypad opens with trash button. No change.
- Pinch zoom, pan, drag-to-add — all untouched.
- Delete lives only in the keypad. No drag-to-trash.

## What I will not touch
- Transitions, topo, review, legend, layout, keypad UI.
- Only the drag start + drag math in `FieldTab.tsx`.
