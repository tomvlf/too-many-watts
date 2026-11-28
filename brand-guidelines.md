# Too Many Watts brand guidelines

## Brand idea

Too Many Watts expresses focused effort through a sharp, forward-moving TMW
monogram. The compact geometry is technical rather than illustrative: deep navy
gives structure, electric blue creates energy, and cyan identifies motion and
progress.

The exact SVG set in `src/images/logo/` is the source of truth for the
application. The monogram contours, lockups, text outlines and app icon use the
same supplied geometry.

## Logo system

| Asset | Use |
| --- | --- |
| `tmw-logo-horizontal-exact.svg` | Primary light-surface lockup |
| `tmw-logo-primary-exact.svg` | Stacked light-surface lockup |
| `tmw-monogram-exact.svg` | Gradient mark on light surfaces |
| `tmw-monogram-white.svg` | White mark on navy or blue surfaces |
| `tmw-monogram-black.svg` | Single-color mark when only one ink is available |
| `tmw-app-icon-exact.svg` | Source artwork for app and PWA exports |

Do not retype the wordmark. All lettering in the supplied lockups is outlined.
Use the monogram where the full name is already present or the available width is
less than 180 px.

## Clear space and minimum size

- Keep clear space equal to at least one quarter of the monogram's height on
  every visible side.
- Use the horizontal lockup at 180 px wide or larger.
- Use the standalone monogram at 32 px wide or larger.
- Use the dedicated PNG favicon exports at 16, 32 and 64 px.
- Preserve the SVG proportions. Do not stretch, skew, rotate or crop the mark.

The app icon already contains its rounded-square background. Do not add another
mask, shadow or rounded corner when exporting it for stores or PWA manifests.

## Color

| Role | Hex | Usage |
| --- | --- | --- |
| Deep navy | `#071827` | Navigation, icon surface and primary controls |
| Structure navy | `#0B1F33` | Primary text and dark controls |
| Steel blue | `#53687A` | Supporting text and metadata |
| Electric blue | `#1265FF` | Primary action, selected state and gradient anchor |
| Cyan | `#00C8F8` | Progress, motion and gradient endpoint |
| Application background | `#F4F7FA` | Light workspace |
| Surface | `#FFFFFF` | Cards, forms and tables |
| Border | `#D7E1E9` | Quiet separation |

```css
:root {
  --tmw-navy: #071827;
  --tmw-navy-soft: #0b1f33;
  --tmw-blue: #1265ff;
  --tmw-cyan: #00c8f8;
  --tmw-slate: #53687a;
  --tmw-paper: #f4f7fa;
}
```

The blue-to-cyan treatment is the only brand gradient. Use it sparingly for
selection, progress and brand accents. Training-zone colors are domain data and
must not be changed to match the logo.

Navy on the light application background exceeds WCAG AA for normal text. Avoid
cyan text on white; use navy for labels and reserve cyan for large graphics,
selected borders or dark-surface accents.

## Typography

- **UI and data:** Inter when available, then the native system sans stack.
- **Headlines:** the same system stack at 780-850 weight with tight negative
  tracking.
- **Metrics:** tabular numerals and the existing unit formatting helpers.
- **Wordmark:** only the outlined lettering inside the supplied SVG lockups.

Keep body copy at 14-16 px in the application, use 16 px inputs on mobile, and
avoid decorative display fonts that compete with the monogram.

## Interface

The application uses light surfaces throughout. Deep navy is reserved for
navigation and primary controls; cyan and the training-zone colours accent
live, current-state elements only.

1. **Workspace:** light surfaces, dark text, restrained shadows and blue
   selected states for dashboard, Coach, calendar, library, activity and
   settings routes.
2. **Ride cockpit:** the same light workspace — a flat cockpit with the
   workout profile across the width and unboxed live numbers separated by
   hairlines. Zone colours mark the current interval and progress.

Panels use 16-18 px radii and quiet one-pixel borders. Primary actions use navy;
hover and selected states use electric blue. Motion is limited to transform and
opacity, disabled for reduced-motion users, and must not animate dimensions or
layout properties.

## Asset use

Browser-facing PNGs and favicons use the existing filenames in
`src/images/logo/` so Parcel, the manifest and legacy pages remain compatible.
The exact SVGs are retained beside those exports as editable masters.

After replacing icon source art, regenerate these tracked exports:

- `too-many-watts-icon-192.png`
- `too-many-watts-icon-512.png`
- `too-many-watts-icon-1024.png`
- `too-many-watts-maskable-512.png`
- `too-many-watts-touch-180.png`
- `too-many-watts-favicon-16.png`
- `too-many-watts-favicon-32.png`
- `too-many-watts-favicon-64.png`

Review each export at actual display size before release. The app icon must keep
the live mark inside the platform mask-safe area.
