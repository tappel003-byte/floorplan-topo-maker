Rename the "Cleanup" screen to "Finishing"

We agreed on "Finishing" as the new screen name. This is a label-only rename with no behavior or data changes. The existing `#cleanup` and `#align` URL hashes will be kept as aliases so existing links and ProjectList's "Replace plan image…" action still work.

Files to change

1. `src/components/AlignPlanMode.tsx`
   - Update the component doc comment: "Cleanup screen" → "Finishing screen".
   - Update the header comment: "Cleanup header" → "Finishing header".
   - Update the `title` prop comment: "Defaults to 'Cleanup'" → "Defaults to 'Finishing'".
   - Change the default `title = "Cleanup"` to `title = "Finishing"`.

2. `src/components/chrome/AppTopBar.tsx`
   - Rename the prop `onOpenCleanup` to `onOpenFinishing`.
   - Rename the handler variable inside the component.
   - Change the menu label from "Cleanup" to "Finishing".

3. `src/routes/projects.$id.tsx`
   - Rename state variables `cleanupOpen` / `setCleanupOpen` to `finishingOpen` / `setFinishingOpen`.
   - Update the inline comments to refer to "Finishing mode" and "Finishing screen".
   - Extend the hash check so it accepts `#finishing`, `#cleanup`, and `#align`.
   - Update the `AppTopBar` prop from `onOpenCleanup` to `onOpenFinishing`.
   - Update the `AlignPlanMode` usage to pass the renamed handler and set `title="Finishing"` explicitly (or rely on the new default).

4. `src/components/ProjectList.tsx`
   - No change required. The "Replace plan image…" action uses the `#align` hash; it remains a specific entry point into Finishing mode. The hash alias stays active.

5. `mem://index.md`
   - Update the Core bullet that says "Desktop mode is a separate future tool for cleanup / bulk ops" to "finishing / bulk ops" so the project memory matches the new name.

6. `.lovable/plan.md` (historical)
   - Leave as-is. It documents the original feature name. If the user prefers terminology consistency across docs, we can update it as a follow-up.

Validation

- Run a TypeScript/build check to confirm no broken imports or prop references.
- Open the preview, navigate to a project, and confirm the ⋯ menu shows "Finishing" instead of "Cleanup".
- Open the screen and confirm the header title reads "Finishing".
- Manually add `#cleanup` to the URL and confirm the screen still opens (backward compatibility).
