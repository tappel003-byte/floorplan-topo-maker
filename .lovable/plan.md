I understand why you’re discouraged. The app needs to feel reliable before we touch transitions or any new features again.

## Goal
Make the canvas dependable again:
- Pinch zoom stays zoomed.
- Touching a point does not reset the view.
- Tapping a point opens edit only when it is a real tap.
- Dragging a point only starts after deliberate movement.
- Drag-to-delete does not appear from normal touches.
- Panning/zooming empty canvas does not get blocked by point editing.

## Plan
1. **Freeze feature work on the canvas**
   - Do not change transitions, review screen, legend, or layout during this pass.
   - Only touch the input/gesture behavior causing the current instability.

2. **Separate the finger actions clearly**
   - One finger on empty canvas = pan or tap-to-add.
   - Two fingers anywhere = pinch zoom, always.
   - One finger on an existing point = select first, then wait.
   - If the finger moves past a safe threshold = move the point.
   - If the finger lifts without moving = edit the point.
   - Delete only becomes possible after a real point move has started.

3. **Stop state changes from resetting zoom**
   - Keep the current zoom/pan transform stable while selecting, editing, dragging, deleting, or opening the keypad.
   - Fit-to-screen should only happen when the plan image changes, the canvas is first loaded, or the user taps Fit.

4. **Make point dragging less fragile**
   - Avoid relying on React state updates mid-drag for the critical drag decision.
   - Store the active gesture in refs so fast touch movement does not use stale state.
   - Save the final point position only after the drag finishes.

5. **Verify the actual field actions**
   - Use browser testing against the running app for the exact flow: zoom in, touch an existing point, edit/delete/move it, and confirm the zoom does not jump back out.
   - Also verify empty-canvas pinch zoom and pan still work.

## What I will not do in this pass
- No redesign.
- No transition workflow changes.
- No new buttons.
- No extra features.

This is a reliability pass so the app can earn trust again before we continue.