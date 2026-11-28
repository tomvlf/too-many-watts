# Agent Instructions

Read this file first, then load only the shared or agent-specific instructions needed for the task.

## Repository Reality

Too Many Watts / Athlima is a browser-only indoor training application. It is Parcel-bundled ES-module JavaScript, with no TypeScript or application backend. Training logic, Coach plans, rides, IndexedDB data, and settings execute in the browser. Intervals.icu is an optional direct browser integration.

## Required Reading

- For project conventions: `.github/instructions/athlima-standards.instructions.md`
- For security-sensitive work: `.github/instructions/athlima-security.instructions.md`
- For testing: `.github/instructions/athlima-testing.instructions.md`
- For Docker, CI/CD, and releases: `.github/instructions/athlima-devops.instructions.md`
- For product/domain and brand behavior: `.github/instructions/athlima-product.instructions.md`
- For the task's architecture or domain: `README.md`, `doc/code-guide.md`, `doc/coaching.md`, `doc/backend.md`, or `doc/intervals-guide.md`
- For the selected role: `.github/agents/<agent>.agent.md`

## Fast Repository Routing

Start with the smallest relevant source and test. Do not read large unrelated modules.
`src/platform/ui.js` is the route renderer and action coordinator, not the owner of every
domain rule. Use these route and behavior boundaries before searching broadly.

| Change area | Implementation owners | Nearest tests / evidence |
|---|---|---|
| App startup, navigation or hash routes | `src/platform/start.js`, `src/platform/router.js`, `src/platform/ui.js` | `test/platform/router.test.js`, `test/platform/ui.test.js`, `test/platform/guest.test.js` |
| Overview / Today dashboard | `src/platform/ui.js` dashboard and recovery cards | `test/platform/ui.test.js`, `test/platform/train-now-ui.test.js` |
| Workout library or workout details | `src/platform/library.js`, `src/platform/ui.js`, `src/workouts/workouts.js`, `src/workouts/zwo.js` | `test/platform/library.test.js`, `test/workouts/library.test.js`, `test/workouts/zwo.test.js` |
| Workout editor | `src/views/editor.js`, `src/workouts/workouts.js`, `src/workouts/zwo.js` | `test/views/imported-workout-xss.test.js`, `test/workouts/workouts.test.js` |
| Training calendar | `src/views/training-calendar.js`, `src/coaching/storage.js`, `src/platform/ui.js` | `test/views/training-calendar.test.js`, `test/platform/ui.test.js` |
| Training plan or plan rendering | `src/platform/plan-view.js`, `src/platform/ui.js`, `src/coaching/planner.js`, `src/coaching/adaptation.js` | `test/platform/plan-view.test.js`, `test/coaching/planning.test.js`, `test/coaching/microcycle.test.js` |
| Coach profile, sessions or feedback | `src/views/coaching-panel.js`, `src/coaching/service.js`, `src/coaching/domain.js`, `src/coaching/planner.js` | `test/coaching/service.test.js`, `test/coaching/ui.test.js`, `test/coaching/planning.test.js`, `test/views/activity-details.test.js` |
| Ride cockpit or live readings | `src/platform/ui.js`, `src/platform/ride.js`, `src/watch.js`, `src/timer.js`, `src/views/watch.js`, `src/views/data-views.js` | `test/platform/ride.test.js`, `test/platform/ride-cockpit.test.js`, `test/watch/watch.test.js`, `test/watch/timer.test.js` |
| Activity save, discard or recovery | `src/activity/`, `src/watch.js`, `src/storage/ride-outbox.js`, `src/storage/ride-sync.js` | `test/watch/discard.test.js`, `test/watch/stop.test.js`, `test/watch/pedal.test.js`, `test/server/ride-sync.test.js` |
| Activities and FIT recordings | `src/platform/activities.js`, `src/activity/`, `src/fit/`, `src/models/models.js` | `test/platform/activities.test.js`, `test/fit/`, `test/models/activity.test.js` |
| Settings, profile, backup or restore | `src/platform/ui.js`, `src/storage/`, `src/db.js`, `src/models/models.js` | `test/storage/`, `test/server/backup.test.js`, `test/platform/profile-sync.test.js` |
| Intervals.icu integration | `src/models/intervals.js`, `src/models/intervals-data.js`, `src/models/api.js`, `src/platform/ui.js` | `test/models/api.test.js`, `test/models/intervals.test.js`, `test/platform/profile-sync.test.js` |
| Bluetooth or FTMS/WCPS equipment | `src/ble/`, `src/views/connection-switch.js`, `src/platform/ui.js` | `test/ble/` |
| ANT+ equipment | `src/ant/`, `src/views/ant-device-scan.js` | `test/ant/` |
| Styles, themes or mobile layout | `src/css/base.css`, `src/css/platform.css`, `src/css/cyberpunk.css`, `src/platform/ui.js` | `test/platform/mobile.test.js`, `test/platform/branding.test.js` |
| PWA, offline caching or service worker | `src/platform/pwa.js`, `src/sw.js`, `src/platform/start.js`, `src/manifest.webmanifest` | `test/platform/sw.test.js`, `test/platform/security-headers.test.js` |
| Docker, Nginx, Caddy or image release | `Dockerfile`, `nginx.conf`, `Caddyfile`, `compose*.yaml`, `scripts/`, `.github/workflows/` | `test/platform/security-headers.test.js`, `test/platform/version-build.test.js` |
| Browser E2E behavior | `test/e2e/app.spec.js` and existing `test/platform/` coverage | `npm run test:e2e` |

## Event and Storage Tracing

- Hash routes: `src/platform/router.js` defines route names and aliases; `src/platform/ui.js`
  dispatches the matching renderer.
- A button or custom element: search `xf.dispatch(...)`, `xf.sub(...)`, `xf.reg(...)`, or
  the matching `data-action` name. Existing event names are API-like boundaries.
- Live page state: `src/db.js` owns `db`; nested mutations do not emit top-level `db:<field>`
  updates.
- Saved browser data: `src/storage/` and `src/coaching/storage.js`; `src/db.js` is not
  IndexedDB even though it is named `db`.
- Reusable UI widgets: `src/views/` custom elements; `src/platform/` routes compose the widgets.
- Shared calculation or format rules: `src/models/`, `src/coaching/`, `src/functions.js`,
  `src/utils.js`, or `src/platform/format.js`, depending on ownership.

## Minimal Investigation Loop

1. Read `AGENTS.md`, the standards, and only the role/shared instructions matching the task.
2. Locate the route, event, custom element or storage key using the table above.
3. Read the smallest source function/component and its nearest test.
4. Read the relevant guide only when domain or data-format rules are involved.
5. Add or update the focused test, then run the smallest command before a broader suite.

## Agent Ecosystem

- `architect`: requirements, architecture, planning, and task decomposition
- `app-engineer`: application implementation across UI, Coach, storage, devices, FIT, workouts, and ride logic
- `security`: SAST/SCA, secrets, browser security, supply chain, and security review
- `devops`: Docker, Compose, Nginx/Caddy, GitHub Actions, releases, and observability
- `reviewer`: correctness, test quality, accessibility, performance, documentation, and merge readiness

## Shared Commands

- Install: `npm ci --ignore-scripts --no-audit --no-fund`
- Development: `npm start`
- HTTPS development: `npm run starttls`
- Focused test: `npm test -- --runInBand test/platform/ride.test.js`
- Test by name: `npm test -- --runInBand test/platform/ride.test.js -t "test name"`
- Full tests: `npm test -- --runInBand`
- Production build: `npm run build`
- Container build: `podman build -t athlima:local .` or `docker build -t athlima:local .`

## Execution Rules

- Preserve browser-only and local-data behavior. Do not introduce an account server or server-side Coach.
- Follow the smallest relevant test first, then the build or runtime check that covers changed behavior.
- Do not silently convert unavailable sensor/provider/history data into zero or an empty success.
- Preserve unit, ID, storage, Trusted Types, mobile-layout, and backup invariants in `.github/instructions/athlima-standards.instructions.md`.
- Do not commit, push, open a PR, alter GitHub Settings, or publish an image unless the user explicitly requests that operation.
- Stop and escalate when requirements are ambiguous, data formats or storage schemas may change incompatibly, security boundaries are unclear, or repository settings are required.

