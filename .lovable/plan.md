## Problem

Right now the New project flow is: tap **New project** → fill dialog → tap **Create** → dialog closes and you're dumped back on the project list → you have to find and tap the new project → *then* the 1-2-3 Setup appears.

That middle hop (back to the list) is pointless. The user just made the project; they want to start setting it up.

## Fix

One change, in `src/components/ProjectList.tsx`:

- After `saveProject` + `saveFloor` succeed in `handleCreate`, navigate straight to `/projects/$id` for the new project instead of just closing the dialog and refreshing the list.
- Use TanStack Router's `useNavigate()` — same pattern already used elsewhere in the app.
- Since the new project has no plan yet, `projects.$id.tsx` already lands on Setup (Details → Plan → Boundary). So the user sees: New project dialog → Create → Setup step 1.

If they realize they don't have what they need (no plan file, etc.), the back arrow in the top bar returns them to the job list — the project stays saved and shows up in the list to resume later. That matches what you described ("exit and get what you need").

## Files touched

- `src/components/ProjectList.tsx` — add `useNavigate`, call it at the end of `handleCreate` with the newly-created project's id.

## Not changing

New project dialog contents, Setup 1-2-3 flow, top bar back behavior, project list itself.
