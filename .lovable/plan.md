## Reset plan

### 1. Stop building for a moment
No more code changes until we explicitly agree on the next small change. Screenshots count as ground truth. If I cannot verify the preview, I will say that plainly and not ask you to restate what the screenshot already shows.

### 2. Establish the current state
We treat the app as it exists right now as the baseline. The immediate unresolved issue is the keypad/flooring correction layout, but we do not keep patching it blindly.

### 3. Decide whether to keep or roll back the recent work
You have two clean reset options:

- Use chat/history revert to go back to the last version that felt stable.
- Keep the current code and do a focused repair pass from here.

If the goal is truly “unplug it from the wall,” I recommend reverting to the last trusted point before the rushed flooring-correction bottom-row work, then rebuilding that one piece slowly.

### 4. New working rule for every change
For anything bigger than a typo:

```text
Discuss → agree on one sentence → build only that → verify honestly → stop
```

No extra cleanup. No adjacent fixes. No “while I’m in there.”

### 5. Proof standard
After each build step, I should report one of these only:

```text
Built and visually verified.
Built, but not visually verified.
Not built.
```

No more claiming the UI is right based only on source code.

### 6. Immediate next move
Before touching code again, we should choose the reset point: either revert through History/chat to the last stable version, or keep current code and make a single focused plan for the keypad correction layout.

<presentation-actions>
  <presentation-open-history>View History</presentation-open-history>
</presentation-actions>