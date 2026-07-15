Add a third point-label option in the Topo tab: plain elevation numbers drawn directly on the colored fill — no white pill, no outlined box, just the text (matching the reference screenshot). Today's two options stay: white pill or fully off.

**Where it lives**

The Labels & layers popover in Topo currently has a "Label bg" switch (white pill on/off). We'll replace that switch with a 3-way selector.

**Changes**

1. `src/lib/types.ts`
   - Widen `pointLabelBackground` from `"white" | "transparent"` to `"white" | "transparent" | "plain"`.
   - `"plain"` = draw the number text only, no pill fill and no border stroke.

2. `src/components/tabs/TopoTab.tsx`
   - In the point-label draw block inside `renderTopoTop` (currently draws either a white pill + border + text, or a border + text), add the `"plain"` branch: skip both the fill rect and the border stroke, draw only the text.
   - Replace the "Label bg" `SwitchRow` in the Labels & layers popover with a 3-segment picker: **Box** (white), **Border** (transparent — current "off"), **Plain** (no box, no border).

**Naming check before build**
The current "transparent" mode still draws a border outline around the number. Confirm the label:
- Box = white pill + border
- Border = no fill, just border (today's "off")
- Plain = text only

If you'd rather collapse Border into Plain (i.e. today's "off" becomes text-only, no border, no pill) and skip adding a third state, say so and I'll do that instead — it's simpler.

**Verification**
Open Topo → Labels & layers, switch between the three, and confirm Plain matches the reference: bare numbers directly over the colored fill.