## Transitions — per-room datum correction

### Concept (in your words)

- Drop a **tile anchor** at 9.0 → plotted as a diamond, stays 9.0.
- Step onto the wood, take a reading of 9.2 → plotted as a normal point, **displays 9.0**. Offset −0.2 is locked in for this transition.
- Every subsequent wood reading in that room gets −0.2 applied and displays the corrected value (8.8 → 8.6).
- The plan and topo only ever show corrected values. Raw is remembered for editing/export.
- Many transitions per floor. Each has its own anchor location so you can see where it starts.

### Data entry flow

1. Tap **Transition** on the keypad → prompt: "Tap the plan to place the tile anchor."
2. Tap the plan → keypad opens with **9.0** pre-filled (or type your own anchor value). Confirm → anchor is plotted as a diamond. This transition is now **active**.
3. Next tap on the plan opens the keypad with two extra buttons: **+Trans** and **−Trans** (alongside the normal ✓).
   - Type the raw reading (9.2), tap **−Trans** → point plotted, displayed as 9.0. Offset for this transition is now locked at −0.2.
   - Once the offset is locked, subsequent points in this transition apply it automatically on ✓ — the +/− buttons stay available for manual override.
4. Switch transitions by tapping another anchor diamond, or by picking from a small **active transition** chip near the status area. Tap the chip's × to clear (new points become plain again).

### Visuals

- **Data entry view:** diamond = anchor, plain dot = normalized wood point. Point label always shows the corrected value. A subtle color tint per active transition helps you see which room's points belong to which transition.
- **Topo view:** unchanged. Contours read the corrected value. No diamonds, no markers, no toggles.

### Data model (already in place)

`SurveyPoint`, `Transition` types and IDB store already exist from earlier work:
- `SurveyPoint.raw` (as-measured), `.value` (corrected = raw + offset), `.offset`, `.transitionId`, `.isTransitionAnchor`
- `Transition.anchorId`, `.offset`, `.label`

Signed offset (−0.2 for wood-higher, +0.2 for wood-lower) locks on the first normalized point after the anchor. No separate setup dialog — the offset is discovered from the first real reading, which matches how you work.

### Editing

- Edit a normalized point's value → edits its `raw`, offset stays, displayed value recomputes.
- Edit the anchor → all points in that transition shift with it.
- Delete the anchor → prompt: "Unlink 4 points from this transition?" → points revert to their raw as their displayed value.

### Files to change

- `src/components/NumericKeypad.tsx` — add +Trans / −Trans buttons; handle Transition mode entry.
- `src/components/tabs/FieldTab.tsx` — active-transition state, anchor placement flow, diamond rendering, active-transition chip, tap-anchor-to-activate.
- `src/routes/projects.$id.tsx` — hold active transitionId in project-level state so it survives keypad open/close.
- `src/lib/db.ts` — already has `saveTransition` / `listTransitions`; wire them into FieldTab.
- `src/components/tabs/ReviewTab.tsx` — show raw, corrected, offset, transition label per row.
- `src/components/tabs/ExportTab.tsx` — CSV gets raw, corrected, offset, transitionId, role columns.

### Out of scope for this pass

- Auto-detecting which surface a point is on (you assign by picking the active transition).
- Renaming / labeling transitions beyond an auto-name like "T1, T2" — can add later.
- Topo-side visualization of transitions.
