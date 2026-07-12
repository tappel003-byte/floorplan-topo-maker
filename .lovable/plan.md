## The bug

In `AddTransitionSheet`, when chaining onto an existing correction, the **From surface** dropdown is locked (`disabled={chained}`) to the parent's surface B, and the **To surface** still defaults to a hardcoded `"Carpet"`. When the parent chain ends on Carpet, both sides read "Carpet → Carpet" with no way to change From — the box you circled.

Nothing in the code caps chain depth; this locked dropdown plus the same-surface default is what made a third link feel impossible.

## Fix (single file)

`src/components/AddTransitionSheet.tsx`:

1. **Unlock From surface when chained.** Remove `disabled={chained}`. Still default it to the parent's surface B (physically correct starting side almost always), but allow override.
2. **Smarter To default.** On open, if To equals From, pick the first entry in `COMMON_SURFACES` that differs and isn't "Other".
3. **Guard Save against identical surfaces.** Extend the `valid` check to require `surfaceA !== surfaceB`, so you can't accidentally save a zero-delta "transition".

No changes to data model, chain math, or FieldTab wiring. Chain depth stays unlimited.
