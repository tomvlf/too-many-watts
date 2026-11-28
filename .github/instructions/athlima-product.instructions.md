---
applyTo: "**/{src/**/*.js,test/**/*.js,doc/**/*.md,README.md,brand-guidelines.md}"
description: Athlima product, domain, accessibility, and brand standards
---

# Athlima Product Standards

## Product Boundaries

- The application is browser-only. No account server or server-side Coach is introduced.
- A workout is a recipe. An activity is a record. A session is in-progress ride state.
- A saved recording, Coach handoff, and provider upload are separate outcomes.
- Missing evidence remains unavailable; it is not zero, rest, readiness clearance, or proof of completion.

## Training Semantics

- Preserve cycling/running unit distinctions and Coach provenance/confidence.
- Do not present heuristic readiness or load results as medical clearance.
- Keep built-in workout IDs stable and append recipes.
- Preserve zone, pace, duration, distance, FTP, threshold and RPE conversions.

## Browser and UX

- The desktop/mobile boundary is 700 px.
- Ride controls and metrics must remain usable while resizing or navigating.
- Use visible focus, keyboard-operable controls, and status announcements.
- Preserve existing brand, the light ride cockpit, and mobile ride-first layout.
- Brand guidelines override generic color guidance.

## Data and Privacy

- Intervals.icu keys are browser credentials and are excluded from backup exports.
- Backups include private training data and require an explicit restore confirmation.
- Storage failures are surfaced; no operation falsely reports success.
- Deleting local data is confirmed and destructive.
