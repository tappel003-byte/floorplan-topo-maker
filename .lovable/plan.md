Stop collapsing different surface pairs into one group in the Transitions panel. Each unique `surfaceA → surfaceB` pair is its own group.

## What changes
- In `src/components/TransitionsSheet.tsx`, group doorways by the exact `surfaceA → surfaceB` string (e.g. `Hardwood → Laminate`), not by structural base.
- Result for the screenshot: `Hardwood → Laminate` becomes its own group (Doorway 1 + 2, avg of −0.20 / −0.30). `Laminate → Vinyl sheet` becomes its own group (Doorway 3, +0.80, "nothing to average").
- Group header shows that single pair. No more combined "Hardwood → Laminate, Laminate → Vinyl sheet" headers.

## Not changing
- Transition math, chaining, apply-average behavior, or anything outside the Transitions panel grouping.