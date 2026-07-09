## Two things in this build

### 1. Save a permanent rule to memory (do this first)

New memory file `mem://preferences/no-rehashing`:

```
---
name: Do not re-ask or re-litigate settled points
description: Prevent wasting the user's credits by re-asking answered questions or re-opening decided design points
type: preference
---
The user pays per message. Re-asking something they already answered, or re-opening
a decision they already made, wastes their money. This has happened and they called it out.

Never:
- Ask a clarifying question about something the user has already stated in this
  conversation or in memory. Re-read the thread before asking.
- Re-open a decision the user already made. If they decided, it's decided.
- Play back the concept twice for confirmation. Once is enough.
- Batch 3–4 clarifying questions at once. One at a time, only when genuinely ambiguous.
- Ask about implementation details after the user has described the workflow that answers them.

Do:
- Before asking anything, scan the thread and memory for the answer. If it's there, use it.
- When genuinely ambiguous, ask ONE specific question with concrete options.
- When corrected, apply the correction silently and move on.
- Trust the user's stated experience. Act as a builder, not a gatekeeper.

How to apply: Before every question or playback, ask "did they already tell me this?"
If yes, don't send it.
```

Add to `mem://index.md` Core section:
> Never re-ask what the user already answered or re-open decided points. Wastes their credits. See [no-rehashing](mem://preferences/no-rehashing).

### 2. Transition normalization feature

Capture surface-to-surface offsets on the data entry side so the topo renders the true slab.

**Concept**
- A **transition point** is an anchor on the reference surface (e.g. tile at 9.0). Keeps its true reading. Shown as a **diamond** on data entry.
- The adjacent reading on the other surface (e.g. carpet at 8.6) establishes the **offset** for that transition (+0.4).
- Following readings on that surface/zone get the offset applied. The corrected value drives the topo.
- Buildings have many transitions; each has its own local offset governing its own points.

**Data entry flow**
1. In the point entry box, user taps **Add transition**.
2. User places the anchor point on the reference surface → stored as anchor, shown as diamond.
3. User records the adjacent point on the other surface → app computes offset = anchor − adjacent.
4. Following points on that surface/zone are tagged to that transition and normalized automatically.
5. Normalized points show a **box around the dot** on data entry.

**Data model**
Each point stores: `raw`, `transitionId` (nullable), `offset`, `value` (raw + offset), `role` (`normal` | `transition-anchor` | `normalized` | `base-point`).
Transitions are their own list: id, anchor point id, offset, optional label.

**Two views, one dataset**
- **Data entry view** — diamonds, boxes, plain dots, base points. Full complexity. Legend in corner.
- **Topo view** — contours and color only, driven by corrected `value`. No markers, no diamonds, no boxes, no toggles. Doorways render continuous.

**Editing**
- Editing a normalized point edits its `raw`; offset stays, value recomputes.
- Editing a transition's offset recomputes every point tagged to it.
- Deleting a transition unlinks its points; they revert to raw.

**Export**
CSV columns: raw, corrected, offset, transitionId, normalized flag, role.

**Out of scope**
- Auto-detecting which points belong to which transition — manual assignment for now.
- Desktop cleanup / bulk reassignment.
- Any topo-side toggle to show markers.