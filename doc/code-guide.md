# A beginner's guide to the Too Many Watts code

This guide is for someone who can use the app but has little or no programming
experience. You do not need to understand every line to follow what happens.
Start with one action, such as saving a ride, and follow the few files involved.

For using the app, start with the [README](../README.md). For protecting your
data, read [storage and backups](backend.md). Coding agents should start with
[AGENTS.md](../AGENTS.md), then follow only the route, test and instructions
links relevant to the task.

## The big picture

Too Many Watts has three main jobs:

1. **Show information and controls.** Pages, buttons, charts and forms.
2. **Run training logic.** Communicate with equipment, play workout steps,
   record activities and calculate Coach plans.
3. **Keep data.** Save in the browser, export files and optionally exchange data
   with Intervals.icu.

There is no separate Too Many Watts account server. The web host delivers the app's
files; your browser runs them. Node, Jest and Parcel are development/build
tools, not services each rider must run.

## Code vocabulary, without assuming a programming course

| Word or notation | What it means |
|---|---|
| Source code / module | Human-readable instructions / a file containing a related group of them. |
| Function | A named recipe: give it inputs, let it do a task, and often receive an output. `formatPace(300)` calls a function with the input 300. |
| Parameter / argument / return | The input's name inside a function / the value passed in / the result sent back. |
| Variable / constant | A name for a value. `let` can be assigned again; `const` cannot be reassigned, although an object it refers to can still change. |
| Object / property | A group of named values / one of those values. In `{duration: 60}`, `duration` is the property name. |
| Array | An ordered list, such as the steps of a workout. |
| Class / instance | A reusable blueprint / one working object made from it. A device class can describe several separate device connections. |
| Method / constructor | A function belonging to an object/class / the setup method used when creating an instance. |
| Event / listener | An announcement that something happened / code waiting for that announcement. |
| State | What the app currently knows: selected workout, elapsed time, readings, and so on. |
| `async` / Promise / `await` | A task that may finish later / its pending result / wait for that result before continuing this operation. Browser storage can require waiting too; this does not necessarily mean an internet request. |
| `null` / `undefined` | Common representations of a missing or unset value. Neither is automatically a measured zero. |
| Validation / error | Checking that input is usable / an explicit failure that must be handled or shown. |
| Encode / decode | Translate information into a file/device representation / translate it back into useful values. |
| Comment | Explanation for readers, usually after `//` or inside `/* ... */`. Most comments are not run, but tools can recognize special annotations. |

`import` brings in code from another module; `export` makes code available to
other modules. `=>` introduces a compact function. You will also see functions
that return objects instead of using `class`: they are another way to bundle
related methods with private working values.

Many explanations above functions use `/** ... */`, called JSDoc. Existing
`@param` entries describe inputs and `@returns` describes output. A class or
file introduction can explain a repeated pattern once; a simple getter that
returns a property does not need the same paragraph repeated above it.

## Where to look

| Location | Responsibility | Start here when... |
|---|---|---|
| [src/index.html](../src/index.html) | The initial page structure and reusable custom elements. | You need to understand where controls are mounted. |
| [src/platform/](../src/platform/) | The current page layout, navigation, activity displays and ride screen. | A page, menu, filter or live display behaves unexpectedly. |
| [src/views/](../src/views/) | Reusable screen components, including the calendar, Coach form, device controls and editor. | You see a custom tag such as `<training-calendar>`. |
| [src/css/](../src/css/) | Styles: layout, sizes, colours and theme. | Appearance changes but the underlying data is correct. |
| [src/db.js](../src/db.js) | Live shared state and startup/event coordination. | You need to trace a setting change or initial data restore. |
| [src/models/](../src/models/) | Rules for readings, workout selection, recording and integration data. | You need to know how a value or recording is updated. |
| [src/watch.js](../src/watch.js), [src/timer.js](../src/timer.js) | Ride/workout clocks and their ticks. | Start, pause, intervals or elapsed time are involved. "Watch" here is not a wristwatch connection. |
| [src/activity/](../src/activity/) | Recording labels and the stop/save/discard decision. | A short ride is being finished or discarded. |
| [src/workouts/](../src/workouts/) | Built-in recipes and ZWO parsing. | A workout file needs to become timed player steps. |
| [src/coaching/](../src/coaching/) | Local cycling/running history, estimates, plans, matching and adaptation. | You need to understand a Coach decision. |
| [src/ble/](../src/ble/) | Bluetooth device connections and message translation. | A supported sensor or trainer communicates over Bluetooth. |
| [src/ant/](../src/ant/) | ANT+ adapter communication and messages. | A compatible ANT+ adapter is involved. |
| [src/fit/](../src/fit/) | Translation between activity/course objects and FIT bytes. | A downloaded recording or imported course needs interpreting. |
| [src/storage/](../src/storage/) | Browser databases, settings, backup/restore and pending Coach hand-offs. | Data must survive closing/reopening the app. |
| [src/functions.js](../src/functions.js), [src/utils.js](../src/utils.js) | Shared event, collection, date and formatting helpers. | Several parts of the app perform the same small operation. |
| [src/physics.js](../src/physics.js), [src/course.js](../src/course.js) | Simulated movement and progress along a course. | Power, slope, speed and course position interact. |
| [src/file.js](../src/file.js) | Browser file reading and downloading. | The user imports or saves a file. |
| [src/lock.js](../src/lock.js), [src/sound.js](../src/sound.js) | Screen wake-lock and audio feedback. | The screen should stay awake or an interval sound plays. |
| [test/](../test/) | Automated examples and their sample data/helpers. | You want to see expected behavior or check a change. |
| [scripts/](../scripts/) | Build-label and security-header generation. | You are preparing a release, not riding. |

Historical names can be misleading. [test/server/](../test/server/) now tests
local behavior and compatibility; it does not imply a running backend.
[src/models/api.js](../src/models/api.js) and
[src/storage/account.js](../src/storage/account.js) retain compatibility
interfaces. They do not restore a login system.

## Follow one example: opening the app

1. The browser receives [index.html](../src/index.html), which loads
   [platform/start.js](../src/platform/start.js).
2. Startup selects the standalone storage scope, redirects the old account
   route to Settings, and calls the platform.
3. [platform/ui.js](../src/platform/ui.js) mounts the current interface and
   imports [index.js](../src/index.js), the ride-engine entry point.
4. Engine startup announces `app:start`. The state/storage layer restores
   settings, workouts, recordings, Coach data and recoverable ride state.
   `app:ready` announces that this initialization has finished.
5. If Intervals.icu is connected, provider-owned FTP/body mass are refreshed
   before the interface is enabled. A failure is shown and cached values are
   retained. History import continues separately afterward.
6. [platform/pwa.js](../src/platform/pwa.js) registers supported offline
   behavior through [sw.js](../src/sw.js). A service worker is a browser-managed
   helper for caching website files, not a training-data server.

Some older helper names remain in the root entry point. The active offline
registration path is the platform path above, not the unused
`startServiceWorker()` helper.

## Follow another example: riding, stopping and saving

1. Selecting a cycling workout gives the player intervals and steps. A step
   might mean "60 seconds at 80% of FTP."
2. Start/resume actions announce events to the ride engine. Ride timing and
   workout timing are separate: free riding before a workout must not move
   its interval marker.
3. Device messages are decoded into readings. State/model code updates values;
   the ride display updates existing elements instead of rebuilding the
   entire page every second.
4. The timer drives recording and interval progress. Power targets and actual
   power remain different values, even when they happen to match.
5. When stopping, final event/lap information is prepared before recording
   save begins. A short ride can be discarded; its recovery checkpoint must
   be cleared successfully before that discard completes.
6. The activity model creates a FIT recording with one stable identifier.
   It writes the recording and clears its recovery checkpoint together in a
   database transaction: both succeed, or neither does.
7. If that local write fails, the recording remains in page memory for retry
   or download. Closing the page would lose that in-memory safety net.
8. After the recording is saved, it is handed to the local Coach. This has its
   own pending/retry flag. A Coach failure does not undo the saved recording.
   An optional provider upload is separate again.

This is why "saved locally," "included in Coach history," "uploaded" and
"backed up" are four different things.

## Events and storage: two distinctions worth remembering

### An event is an announcement, not automatically a network message

The shared event system is named `xf` in [functions.js](../src/functions.js).
`dispatch` announces something, `reg` registers a handler with access to live
state, and `sub` subscribes a listener to announcements. Names such as
`ui:watchStart` group events by purpose; the colon is just part of the name.

A top-level assignment to the shared `db` state announces a `db:<field>`
change. Changing a nested value alone does not make that same announcement;
callers must follow the existing notification pattern. When tracing a button,
search for its event name to find the code that responds.

### Live state is not the same as saved data

Despite its name, the `db` object is the page's working state. IndexedDB is
the persistent browser database. A backup is a separate downloaded copy.

An `await` on a checked storage write matters: continuing before it finishes
can falsely report a saved ride. Likewise, an empty activity list means "no
activities," while unavailable history means "we could not load the answer."
Do not turn a storage error into an empty successful result.

## Numbers need units and context

| Value | Meaning |
|---|---|
| Player/Coach step `duration` | Seconds; a value of 60 is one minute. |
| Availability and planned minutes | Minutes. Do not pass them directly where seconds are expected. |
| Cycling step `power: 0.8` | Normally 80% of FTP, not 0.8 watts. At FTP 250 W the target is 200 W. The legacy player also accepts some absolute-watt targets. |
| Running step `power` | A shared field name representing a fraction of threshold **speed**, not cycling watts or a fraction of pace. |
| Running `thresholdPace` | Seconds per kilometre internally. At 300 s/km, 80% threshold speed corresponds to 375 s/km, or 6:15/km. Running ZWO export separately converts to that format's pace reference. |
| Activity distance / goal distance | Activity inputs use metres; goal distances use kilometres. |
| Heart rate / cadence / RR | Beats per minute / pedal revolutions per minute / time between heartbeats. Device/file modules document their encoded units. |
| Load | A labelled estimate. Power-based load, effort-based load and heart-rate load have different scales; do not sum them as if interchangeable. |
| Date / timestamp | A calendar day such as `2026-01-01` / an instant with time and zone, such as `2026-01-01T10:00:00Z`. Midnight depends on the athlete's time zone. |

Missing data is important. A disconnected sensor is not proof of zero power,
and average power is not a substitute for normalized power. The latter is a
different estimate that accounts for changes in effort. Coach estimates retain
the source, confidence and reasons when evidence is insufficient.

The [Coach guide](coaching.md) explains the calculations and their limits.

## Reading and running tests

A test is an automated example: set up a situation, perform an action, and
check what should happen. It is not a guarantee that every possible situation
works.

| Test code | Meaning |
|---|---|
| `describe(...)` | Group related examples. |
| `test(...)` | Name and run one expected behavior. `test.each(...)` repeats it for several input rows. |
| `expect(...).toEqual(...)` | Check an actual result against the expected result. Other matchers check errors, counts or approximate numbers. |
| `beforeEach` / `afterEach` | Prepare / clean up around each example so it does not depend on another test's leftovers. |
| Fixture | Sample data, such as a fictional athlete or a short sensor message. |
| Mock / spy | A controlled replacement for a dependency / a way to record calls to a function. These make failures and ordering testable. |
| Fake timers | A controllable test clock, so tests can advance time without waiting for a real ride. |
| jsdom / fake-indexeddb | Test implementations of a browser page / browser database. They do not use your normal browser profile. |
| `@jest-environment node` | A functional instruction in a comment: run that file in Node rather than the default simulated browser. Preserve it when editing documentation. |

After installing the development dependencies as shown in the
[README](../README.md#run-your-own-copy), run commands in the project folder:

```sh
# Check one focused area.
npm test -- --runInBand test/platform/ride.test.js

# Check the related Coach and calendar behavior together.
npm test -- --runInBand test/coaching test/views/training-calendar.test.js

# Run the complete existing suite, one test file at a time.
npm test -- --runInBand

# Separately prepare the browser-ready production files.
npm run build
```

`npm test` calls Jest. The `--` passes the remaining options to Jest;
`--runInBand` runs files sequentially instead of spawning parallel test workers.
Read the final passed/failed/skipped summary and the named failure, not just
the first console message: some tests deliberately provoke and check errors.

[version-build.test.js](../test/platform/version-build.test.js) also performs a
real Parcel build in a temporary directory and checks its embedded version
label. It cleans up that directory and does not publish the app.

Some older files are explicit placeholders or skipped scenarios, including
[timer.test.js](../test/watch/timer.test.js),
[watch.test.js](../test/watch/watch.test.js) and
[workouts.test.js](../test/workouts/workouts.test.js). A placeholder assertion
or a skipped test is not coverage of the named feature.
[simulation-scripts.js](../test/simulation-scripts.js) is a historical manual
sketch, not an automatically executed test or a ready-to-run hardware simulator.

Automated tests use simulated pages, storage and device/provider responses.
They do not prove live Bluetooth support, real-device compatibility, every
screen size or physiological validity. A relevant browser/device check is still
needed when changing those behaviors.

## Styles, configuration and release files

The styles load in order:
[base.css](../src/css/base.css) for original components,
[platform.css](../src/css/platform.css) for current layout and
[cyberpunk.css](../src/css/cyberpunk.css) for the visual theme.
Later rules can override earlier ones, but more-specific selectors can also
win. The platform adds `body.mobile-app` at widths of 700 pixels or less.
Mobile shared-button overrides need selectors such as
`.mobile-app #platform .button`; a weaker rule can lose even when written later.

Some configuration formats do not accept comments. Their purpose belongs here:

| File | What it controls |
|---|---|
| [package.json](../package.json) | Project entry point, required Node version, commands and dependencies. |
| [package-lock.json](../package-lock.json) | Exact resolved dependency versions for reproducible installation. Use the package manager rather than editing it by hand. |
| [.babelrc](../.babelrc) | Import transformations used by Jest; not a server configuration. |
| [.htmlnanorc](../.htmlnanorc) | Tells HTML optimization not to minify SVG content. SVG describes vector drawings such as charts. |
| [jest.config.js](../jest.config.js) | Default test environment, shared setup and code transformation. |
| [manifest.webmanifest](../src/manifest.webmanifest) | Installed-app name, icons, starting address and display hints. It does not implement offline caching itself. |
| [build-info.json](../src/platform/build-info.json) | Bundled version/revision label, generated for releases. |
| [publish-image.yml](../.github/workflows/publish-image.yml) | GitHub's image-build/publish workflow. |

The [hosting guide](backend.md#which-deployment-file-does-what) explains Docker,
Compose, Nginx, Caddy and build-specific security headers.

## How to read or change one part safely

1. Start with a user action and the relevant file introduction, not every file
   in alphabetical order.
2. Read a method's inputs, result, units and side effects. Does it just calculate,
   or does it save data, notify listeners or send a device command?
3. Follow imports/event names to the next responsible module. In VS Code,
   use **Go to Definition** and **Find All References** instead of guessing.
4. Read the nearest meaningful test. Look for missing input and failure cases
   as well as the successful example.
5. Keep comments about reasons, boundaries and non-obvious behavior. Do not
   change workout strings, sample bytes or target numbers merely to add an
   explanation; those are program data, not comments.
6. Keep built-in recipe order stable: IDs use `builtin-<index>`, so append
   new recipes rather than reordering old ones. Follow the
   [template checklist](coaching.md#adding-a-workout-template).
7. Preserve third-party credits, supplied protocol dictionaries, captured
   fixtures and generated files. Edit project-owned explanations around them,
   not copied vendor algorithms or binary assets.
8. Run the smallest relevant checks and update the directly related guide
   whenever behavior changes.

If the code and a comment disagree, inspect the implementation and tests rather
than treating the comment as proof. Historical compatibility code and skipped
tests are deliberately labelled to make that distinction easier.
