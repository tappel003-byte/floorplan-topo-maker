## What broke
The toolbar chips are still in the code, but they are being positioned at the top edge of the field canvas. On the phone screenshot, the OS/top app chrome is covering/clipping that area, so the pills look “gone” or half-hidden. This is the same class of regression as before: floating field controls are tied to `top-*` offsets instead of a safe, reusable canvas overlay offset.

The correction window/canvas issue is likely from the same overlay layering pattern: full-screen sheets and floating chips are competing with the canvas pointer layer and safe-area spacing.

## Fix plan
1. Create one safe overlay positioning pattern for the field canvas controls:
   - notes pill
   - stats/data chips
   - active correction pill/popover
   - any top-right correction controls

2. Move the field pills down below the top bar/safe area instead of pinning them to `top-2` / `top-12`.
   - Keep them floating over the white canvas.
   - Do not add a persistent full-width toolbar row.
   - Preserve the canvas-first layout.

3. Keep the active correction popover interactive without blocking canvas gestures outside the popover.
   - The pill/popover should stop its own pointer events.
   - The canvas should still pan/zoom/tap everywhere else.

4. Fix the Add Transition/correction sheet layering so opening or closing it does not leave the canvas in a broken pointer state.
   - Keep the sheet above the canvas/keypad only while open.
   - Closing the sheet returns to normal canvas input.

5. Verify in the phone-sized viewport shown in your screenshot:
   - toolbar pills are visible, not clipped
   - canvas can still pan/zoom
   - tapping the plan opens the keypad
   - correction window opens/closes without breaking canvas interaction