# Too Many Watts

**Turn a browser tab into an indoor cycling cockpit.** Too Many Watts runs structured
workouts, drives a smart trainer, records every ride and plans the weeks ahead — with no
account, no cloud and no server sitting between you and your trainer.

![The ride screen during a Chili Pepper session: 127 W against a 126 W target, cadence target 80 rpm, heart rate 163 bpm, and the live position marker on the workout profile](doc/images/screenshots/ride.webp)

<p>
  <img alt="License: AGPL-3.0" src="https://img.shields.io/badge/license-AGPL--3.0-blue">
  <img alt="No account required" src="https://img.shields.io/badge/account-not%20required-2ea44f">
  <img alt="Training data stays on this device" src="https://img.shields.io/badge/data-on%20this%20device-123653">
</p>

## First ride in three steps

1. **Set your reference.** In *Settings*, enter body mass and cycling FTP — the watts that
   scale every workout target.
2. **Connect your gear.** Open *Devices* and pick your trainer or sensor. The browser asks
   for permission; no website can connect to your sensors silently.
3. **Pick a session and ride.** Choose something in the *Workout library* and press
   **Start workout**. Finish and save before starting another ride, then download a backup
   from *Settings → Local backup*.

A few words you will see on screen:

| Word | Meaning |
|---|---|
| FTP | Functional threshold power: the reference, in watts, that workout targets are a fraction of. |
| Target | The effort the workout asks for. `--` in an actual reading means unavailable, not zero. |
| ERG | Trainer mode that holds a requested power by adjusting resistance. |
| ZWO / FIT | A text workout file / a compact activity recording you can download or upload. |
| RPE | Your own effort rating on a 0–10 scale, used as session feedback. |

## Why riders use it

**The effort is the whole interface.** Target power, actual power and the gap between them
are the biggest things on screen, next to the interval countdown and the cadence the workout
asks for. A marker walks along the session profile so you always know what is left and what
is next.

**Structured sessions, not just a stopwatch.** 46 built-in workouts cover recovery, tempo,
sweet spot, threshold, VO2 max, sprints and race prep, each with power and cadence targets.
Import `.zwo` files, load `.FIT` courses, or build your own session in the workout editor.

**A Coach that works around your week.** Give it a goal, a date and the days you can train.
It lays out the phases, picks the sessions and explains why — then adapts when life, illness
or a missed ride gets in the way. It is deterministic, rule-based guidance: not a chatbot,
and not medical advice.

**Every ride is kept.** Finished sessions become FIT files on your device, alongside weekly
and monthly totals, fitness/fatigue/form and observed power profiles. Upload to
Intervals.icu when you want a second opinion.

**Built to be used mid-effort.** Phone and desktop layouts switch automatically, controls
stay reachable, an interrupted ride is recovered, and the app installs to your home screen
and reopens from its cache when you are offline.

## A look inside

### Overview — what to do today

![Overview page showing today's Coach proposal, the current cycling goal with 84 days remaining, and this week's momentum](doc/images/screenshots/overview.webp)

### Workout library — pick the shape of the effort

![Workout library with 46 sessions, category and duration filters, and a power profile on every card](doc/images/screenshots/library.webp)

Each card carries the category, duration, interval count, cadence prescription and a power
profile drawn from the session's own targets.

### Training plan — the whole block at a glance

![Training plan page with the goal, week count, days to go, today's session and a phase timeline from Baseline to Taper](doc/images/screenshots/plan.webp)

### Calendar — the next session is always visible

![Training calendar for January with planned Coach sessions on each training day](doc/images/screenshots/calendar.webp)

### Activities — the work you actually did

![Activities page with weekly and monthly totals, fitness/fatigue/form, and recorded rides with power profiles](doc/images/screenshots/activities.webp)

### Coach — goals, feedback and adjustments

![Coach page with today's session review, the training goal card and the coming sessions](doc/images/screenshots/coach.webp)

### Settings — profile, integrations and backups

![Settings page with the rider profile, Intervals.icu connection, local backup and storage status](doc/images/screenshots/settings.webp)

## Ride from your phone

The same app switches to a touch layout below 700 px: a five-item bottom bar, compact cards
and ride metrics that stay on screen. Open the HTTPS address in Chrome on Android and choose
**Install app** (or **Add to Home screen**) to run it like a native app.

<table>
  <tr>
    <td width="50%"><img src="doc/images/screenshots/m-overview.webp" alt="Mobile overview with today's session and goal" width="320"></td>
    <td width="50%"><img src="doc/images/screenshots/m-library.webp" alt="Mobile workout library with session cards" width="320"></td>
  </tr>
</table>

## Coach, without the black box

The Coach is a local rules engine, so you can always ask what it is thinking:

- **Plan from your real week.** Availability in minutes per day, a long-ride day, typical
  and maximum weekly hours, experience, and a dated goal.
- **Phases to race day.** Baseline, base, build, event-specific and taper, with recovery
  weeks built in. The plan page shows where you are and what comes next.
- **Sessions chosen for the moment.** Recovery is preferred when readiness signals or recent
  load call for it; quality work only when history supports it. **Train Now** picks an
  ad-hoc session without changing the plan.
- **Explanations you can check.** "Why this workout?" is shown on the ride screen and stored
  with the activity, together with the plan's current phase and objectives.
- **Honest adaptation.** Missed sessions are reviewed rather than silently stacked onto
  later days, and upcoming training can be made easier without being made up elsewhere.
- **Stated limits.** It needs your FTP and, ideally, some history. With little evidence it
  stays conservative and says so. Running plans provide guidance and exports; structured
  execution needs a trainer that accepts commands.

## Your data stays in your browser

There is no Too Many Watts login, no account server and no analytics pipeline. Workouts,
recordings, plans and settings live in this browser's storage on this device.

- **Backups are yours to keep.** *Settings → Local backup* downloads one JSON file with your
  coaching history, plans, workouts, recent FIT recordings, settings and calendar. It does
  not include integration API keys.
- **Clearing site data deletes training data.** Browser eviction can do the same. Download a
  backup before switching devices or clearing storage.
- **Intervals.icu is optional.** Your personal API key is stored in this browser and sent
  only to `https://intervals.icu`; anyone with access to this browser profile can use it.
  Disconnecting keeps imported history. See the [Intervals.icu guide](doc/intervals-guide.md).
- **Nothing is silently invented.** Missing sensor or provider readings show as `--`, never
  as zero, and incomplete totals are labelled as known values.

## Connect your equipment

Too Many Watts speaks the protocols indoor bikes and sensors already use:

- **FTMS** over Bluetooth — trainers, indoor bikes and controllable resistance
- **FE-C** over Bluetooth — FE-C trainers
- **Wahoo WCPS** — vendor-specific control for Wahoo trainers
- **ANT+ FE-C** over a compatible USB ANT+ adapter
- Heart-rate, speed/cadence and Moxy muscle-oxygen sensors

You choose every device from the browser's own pairing prompt; a website cannot connect to
your sensors without permission. Trainer modes are ERG, resistance and slope simulation.

**Supported browsers:** Chrome, Edge, Opera, Brave and Samsung Internet over HTTPS (or
localhost during development). Firefox and Safari do not provide the Web Bluetooth path a
trainer needs, and the web version is not supported on iOS. On Linux you may need to enable
`chrome://flags/#enable-experimental-web-platform-features` (or the Edge/Opera equivalent).

## Run your own copy

Host it once and riders only need the address: there is no backend, database or
authentication to operate. Node.js 22.18.0 or newer with npm is enough to develop locally.

```sh
npm install
npm start        # development server with live reload
npm run build    # browser-ready files in dist/
npm test         # automated checks
```

Serve `dist/` over HTTPS (or localhost) — Web Bluetooth requires a secure context. For an
encrypted development server, `npm run starttls` expects local certificates at
`dev_cert/cert.pem` and `dev_cert/key.pem`. Storage, hosting and migration details are in
[browser-only deployment](doc/backend.md); focused test commands are in the
[code guide](doc/code-guide.md#reading-and-running-tests).

The desktop app shows the frontend build label at the bottom of the sidebar; published
images display the GitHub Actions build number and attempt, with the full revision on hover.

### Docker Compose

```sh
docker compose up -d            # published frontend on http://localhost:8080
docker compose down
```

Build from your checkout instead of the published image:

```sh
docker compose -f compose.yaml -f compose.server.yaml up --build -d
```

Public HTTPS hosting with automatic certificates — replace `app.example.com` in the
[Caddyfile](Caddyfile) with a hostname you control:

```sh
docker compose -f compose.https.yaml up -d
```

The frontend container runs unprivileged on port 8080 with a read-only filesystem, no Linux
capabilities and a health check; Caddy handles TLS and HSTS. For the existing Dockhand
`bike_trainer` stack, use [compose.dockhand.yaml](compose.dockhand.yaml), which keeps host
port 1111 for your existing proxy. Images are published to
`ghcr.io/tomvlf/too-many-watts` with build provenance and a software bill of materials.

To deploy exactly one reviewed build, pin its digest:

```sh
docker buildx imagetools inspect ghcr.io/tomvlf/too-many-watts:latest
# image: ghcr.io/tomvlf/too-many-watts@sha256:<digest>
```

With [cosign](https://docs.sigstore.dev/cosign/overview/) installed, verify the signature
before pulling:

```sh
cosign verify ghcr.io/tomvlf/too-many-watts:latest \
  --certificate-identity-regexp 'https://github.com/tomvlf/Too Many Watts/.github/workflows/publish-image.yml@refs/(heads/master|tags/v.*)' \
  --certificate-oidc-issuer https://token.actions.githubusercontent.com
```

The build derives a Content Security Policy from the exact HTML it ships, so scripts are
limited to hashed inline blocks and this origin plus Intervals.icu. Rebuild the policy with
the app; do not loosen it to silence a browser warning. Other static hosts must configure
equivalent headers themselves, and offline loading is best-effort rather than a backup.

## Documentation

| I want to... | Read |
|---|---|
| Understand the code without a programming background | [Beginner's code guide](doc/code-guide.md) |
| Know where data lives, back it up, or host it | [Deployment, storage and migration](doc/backend.md) |
| Connect Intervals.icu | [Intervals.icu guide](doc/intervals-guide.md) |
| Understand planning, feedback and its limits | [Coach guide](doc/coaching.md) |
| Work in this repository with an AI coding agent | [Agent repository guide](AGENTS.md) |

## Credits and license

Too Many Watts grew out of [Auuki](https://github.com/dvmarinoff/Auuki) by Dimitar Marinov,
and continues here with a rebuilt interface and an adaptive Coach.

Licensed under the [GNU AGPL v3](LICENSE.txt).
