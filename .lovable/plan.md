Remove the outline stroke from exclusion zones on the Topo tab so the white mask blends cleanly with the plan, avoiding a visible offset line.

Changes:
- `src/lib/exclusions.ts`: add an `outlined` option (default true) to `drawExclusionShape`. When `false`, skip the final outline stroke — only the white fill is drawn.
- Topo tab call site: pass `outlined: false` so excluded areas render as pure white with no border.
- Setup tab (hatched) and Field/Data (if applicable) keep their current outline behavior unchanged.
