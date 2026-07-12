Plan:

1. Treat your screenshot as the requirement: no more asking you to describe it.

2. In the keypad, when a flooring correction/chain is active, remove the shortcut row above the number pad. That row is the source of the control appearing in the wrong place.

3. Make the bottom action area the only place for correction choices:

```text
[ number grid ]
[ backspace ] [ Tile 0.0 ] [ Carpet +0.4 ] [ Wood -0.3 ]
```

4. Make the corrected-mode fallback stricter: if a correction is active but the chain options are not being generated, do not fall back to the old full-width Enter button with the correction chip/label. That is how the screen can look like your screenshot instead of what I claimed.

5. Verify in the live preview after the change: with the same active chained correction screen, confirm the old top correction control is gone and the surface buttons are at the bottom.