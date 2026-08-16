# Asset Signal — landing page

Hero landing page for Asset Signal. Static HTML, CSS and JavaScript with no
build step and no dependencies; the only network request beyond the page's own
files is the webfont stylesheet.

The background is a WebGL "signal field": a rippling plane drawn in
perspective, with a single green line — the signal — running through it.

## Running it

Any static server will do. From the repository root:

```sh
python3 -m http.server 8000
# then open http://localhost:8000
```

Opening `index.html` directly over `file://` also works, though the webfonts
still need a network connection.

## Layout

```
index.html                 markup only — no inline styles or scripts
css/
  base.css                 colour system, reset, page shell, shared primitives
  nav.css                  masthead
  hero.css                 hero section
js/
  signal-background.js     the WebGL field — self-contained, owns its canvas
  main.js                  entrance reveal, wave-axis alignment, mobile nav
img/
  asset_signal_h_logo.png  horizontal lockup
color_palette.png          colour system reference
screenshot.png             original design reference
```

## Colour system

Declared once in `css/base.css` under its own names, then mapped to roles, so
the system can be re-tuned in one place.

| Name | Hex | Role |
| --- | --- | --- |
| Warm Ivory | `#F7F3EC` | background |
| Pale Sage | `#E8EFEB` | secondary background |
| Institutional Eucalyptus | `#3F7568` | primary logo green |
| Deep Forest | `#24483F` | dark green — anchors, depth |
| Soft Sage | `#7FA99B` | accent / charts |
| Near-black green | `#172522` | main text |
| Slate | `#68736F` | muted text |

Two values are derived rather than taken from the system: body copy uses a
darker step of the slate (`#3E4B47`), because slate itself lands just under AA
on the ivory at that size; and the field's strands are drawn from a darkened
slate, because they are neutral noise rather than an accent.

`js/signal-background.js` keeps its own copy of these colours — a shader cannot
read CSS variables — so **the two files must be changed together.** Both name
the hex codes and point at each other.

## Typography

Newsreader for display (variable, with a real optical-size axis, so
`font-optical-sizing: auto` genuinely applies) and Inter for everything else,
both from Google Fonts. Headline tracking is size-specific rather than a fixed
`em` value, tightening as the type scales.

## The signal field

`js/signal-background.js` is self-contained: it mounts its own canvas into
`#signal-bg` and owns everything inside it. `css/base.css` carries only the
layer's geometry and a gradient fallback for when WebGL is unavailable.

Every strand is a streamline on one rippling plane, projected through a pinhole
at a vanishing point off the left edge. Baseline, amplitude, wavelength, line
weight, focus, dispersion, haze and parallax all follow from a strand's place
in that projection, which is why the field reads as a single surface rather
than a stack of lines. The signal is the same construction with its own
vanishing point, its own single-harmonic wave, and full colour.

All of it is tuned from the `FIELD` block at the top of the file. The ones
worth knowing:

| Key | Effect |
| --- | --- |
| `VPX`, `LIFT` | where the plane's vanishing point sits |
| `SLOPE` | how wide the fan opens, horizon end to front end |
| `AMPK`, `PK` | wave height against wavelength — their product is crest steepness |
| `SPREAD` | how strands bunch toward the horizon |
| `VAR` | per-strand variance, and the ribbon grouping that keeps it from combing |
| `HERO_*` | the signal's own geometry, wave and treatment |
| `CLEAR_*` | the paper halo held around the page's copy |

### Coupling worth knowing about

`main.js` measures where the hero copy lands and publishes it to the field,
which uses it for two things: aligning the field's axis to the copy, and
clearing a halo around the text. The field also comes to meet the copy on
viewports too short for the copy to reach the axis. If the copy's geometry
changes, the field follows automatically — no constants to keep in sync.

## Accessibility

Three preferences are tracked live, not read once at load, so toggling the OS
setting takes effect immediately:

- `prefers-reduced-motion` — the field stops travelling and the parallax
  stops; the composition, depth and colour all remain. Entrance transitions
  become short cross-fades.
- `prefers-contrast` — dispersion and haze are cut back, opacity raised.
- `prefers-reduced-transparency` — colour fringing is reduced.

The field also adapts its resolution to the frame time it is actually
achieving, and stops drawing entirely on a hidden tab.

## Browser support

WebGL2 where available, WebGL1 otherwise, and a CSS gradient that reads as the
same composition where neither is. Context loss is handled and recovered from.
