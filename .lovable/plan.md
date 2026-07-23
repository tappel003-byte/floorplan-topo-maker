## Add GPS address auto-fill to V1 Setup (Nominatim)

Copy the Distress Survey pattern into Floor Survey V1's Setup > Details screen. Free, no API key, no connector.

### What gets added

Two small buttons next to the existing address text input:
- **Auto-fill address** — calls `navigator.geolocation.getCurrentPosition`, then reverse-geocodes via OpenStreetMap Nominatim (`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=...&lon=...`) and writes the resulting street address into the field.
- **Use GPS coords only** — fills the field with `lat, lon` (plus accuracy) as a fallback when reverse geocoding fails or the user prefers raw coords.

Handles: no GPS support, permission denied, timeout, network/reverse-geocode failure (falls back to coords).

### What stays untouched

- Address stays a single plain string on the project — no new lat/lng fields, no schema change, no migration.
- No new dependencies, no connector, no secrets.
- Everything else in Setup (name, other fields, flow) unchanged.

### Files touched

- The Setup > Details component (the one rendering the address input today) — add the two buttons and the geolocation handler.
- One tiny helper (inline or in `src/lib/`) for the Nominatim fetch + error handling.

### Nominatim usage note

Nominatim's public endpoint requires a descriptive `User-Agent` per their usage policy. Browser `fetch` can't set `User-Agent`, but Nominatim accepts browser requests in practice — Distress Survey already runs this way. Low request volume (one tap per project), so no rate-limit concerns.

### Estimated cost

~6–10 credits.

### Approval

V1 is your live app — wait for your explicit "go" before touching code.
