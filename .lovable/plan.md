I understand the correction: the trash can should not be hidden. It should look and behave like the Distress Survey home-screen trash can.

Plan:

1. Keep the existing two-step delete logic
   - Project row delete still moves a project to trash.
   - Trash screen still allows Restore and Delete forever.
   - Permanent delete remains protected by confirmation.

2. Change the home-screen trash button to match Distress Survey
   - Always render the trash can on the home screen, even when empty.
   - Bottom-right fixed circular button.
   - 56px by 56px.
   - Warm paper background, border, shadow.
   - Empty state is visible but faded/disabled-looking.
   - When trash has projects, show the count badge in the top-right.

3. Change empty-trash behavior to match Distress Survey
   - Tapping the empty trash can does not open the dialog.
   - It gives a small “Trash is empty” message.
   - Tapping it when non-empty opens the trash screen/dialog.

4. Make the trash contents match the Distress Survey pattern
   - Project row with title/address info.
   - Restore button.
   - Delete forever button.
   - Remove the separate “Empty trash” bulk-delete footer, because the Distress Survey model deletes forever per project rather than encouraging accidental bulk emptying.

Technical notes:

- Update `src/components/ProjectList.tsx` only.
- Replace the conditional floating trash button with an always-rendered button.
- Use the existing `trashed.length` state for empty styling, badge display, and click behavior.
- Keep the already-added `deletedAt`, `trashProject`, `restoreProject`, and `deleteProject` functions as-is.