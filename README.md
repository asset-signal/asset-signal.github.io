# Asset Signal — landing page

Landing page for Asset Signal, the decision layer for real estate asset
management. Static HTML, CSS and JavaScript with no build step and no
dependencies; the only network request beyond the page's own files is the
webfont stylesheet.

The background is a WebGL "signal field": a rippling plane drawn in
perspective, with a single green line — the signal — running through it.

## Running it

The site is built by Jekyll, which is what GitHub Pages already runs. You need
Ruby, then:

```sh
bundle install
bundle exec jekyll serve      # http://localhost:4000
```

`python3 -m http.server` no longer works against the repository root, and
opening `index.html` over `file://` shows you the front matter as text — the
pages are templates now, not documents. To serve the built output with any
static server instead:

```sh
bundle exec jekyll build      # writes _site/
python3 -m http.server 8000 --directory _site
```

`_site/` is generated and git-ignored. Pages builds from source on its own
servers, so nothing in `_site/` is ever deployed from here.

### Where the shared markup lives

The masthead, footer and `<head>` used to be copy-pasted into every page. That
duplication shipped a real bug: `privacy.html` and `thanks.html` carried three
nav links to sections that had been deleted from the homepage. Each now exists
once:

| File | What it owns |
| --- | --- |
| `_layouts/default.html` | The page shell — skip link, signal field, `.page`, scripts |
| `_includes/head.html` | Everything in `<head>`, driven by page front matter |
| `_includes/masthead.html` | The nav |
| `_includes/footer.html` | Both footer shapes, full and minimal |

Pages carry front matter rather than markup: `title`, `description`, `robots`,
`canonical`, `og`, `signal_field`, `footer` (`minimal` for the legal pages) and
`styles`, a list of stylesheet basenames loaded after `base` and `nav` **in the
order given** — the cascade depends on it.

### Pages and routes

| URL | Source | Layout |
| --- | --- | --- |
| `/` | `index.html` | `default` |
| `/about.html` | `about.html` | `default` — **contains placeholders** |
| `/blog/` | `blog/index.html` | `default` |
| `/blog/<slug>/` | `_posts/YYYY-MM-DD-<slug>.md` | `post` |
| `/privacy.html` | `privacy.html` | `default` |
| `/thanks.html` | `thanks.html` | `default` |
| `/feed.xml`, `/sitemap.xml` | generated | jekyll-feed, jekyll-sitemap |

The masthead lists **routes only**. It used to carry `#how` and `#demonstration`,
which made it a scroll control on the homepage and a set of cross-page jumps
everywhere else — and it named two of the homepage's five sections, so the
position indicator was dark for 65% of the scroll.

Nothing lists the homepage's own sections any more, in either nav. That is the
same decision applied consistently: `#problem`, `#how` and `#demonstration` are
places in a document, not destinations on a site, and a reader reaches them by
reading. The IDs still exist and still work as deep links.

`Platform` joins `About` and `Writing` when it has content.

### Writing a post

One file. `_posts/2026-09-01-a-title.md`:

```markdown
---
title: "What a review costs when it waits for the quarter"
standfirst: "One sentence under the headline. Optional."
---

Body in Markdown.
```

`layout: post`, the date and the URL all come from `_config.yml` and the
filename. `standfirst` shows on the index and above the body.

**The blog index is not linked as `Blog` — it is `Writing`, and it has no posts
yet.** An empty index states that plainly rather than promising a schedule.

### Two things not to undo

**Filenames stay as filenames.** `privacy.html` builds to `/privacy.html`, not
`/privacy/`. A top-level `permalink:` in `_config.yml` applies to pages as well
as posts and silently moved it, 404ing a URL the demo form's consent line links
to. The post permalink is set under `defaults` for that reason.

**Asset paths go through `relative_url`.** They used to be document-relative
(`css/base.css`), which resolves from `/index.html` and not from `/blog/a-post/`.

## Layout

```
index.html                 markup only — no inline styles or scripts
privacy.html               privacy notice — what the form collects and why
thanks.html                where a no-JS submit lands (Formspree `_next`)
css/
  base.css                 colour system, reset, page shell, shared primitives
  legal.css                the privacy notice's reading column
  nav.css                  sticky masthead
  hero.css                 the fold
  sections.css             the narrative bands below the fold
  demo.css                 the illustrative product surface
  form.css                 the demo-request form
  footer.css               closing band
js/
  signal-background.js     the WebGL field — self-contained, owns its canvas
  main.js                  entrance reveal, wave-axis alignment, sticky
                           masthead, scroll reveals, section spy, form
img/
  asset_signal_h_logo.png  horizontal lockup
  symbol.svg               standalone symbol, used as the favicon
```

## Page structure

| Band | `id` | What it does |
| --- | --- | --- |
| Hero | `#top` | The category, then what the product does |
| The problem | `#problem` | Not a data problem — a noise problem; the noise-to-signal figure |
| How Asset Signal works | `#how` | Review is a cycle, not an event — the six-stage ring |
| Demonstration | `#demonstration` | One signal, opened — **illustrative, see below** |
| Call to action | `#demo` | The demo request form |

`#value`, `#use-cases`, `#trust` and `#who` were cut; the page is five bands.

### The fold's three elements

Brand line at display size, the category directly under it, then the actions.
The category used to be the `#how` title, 5.3 screens down.

There is deliberately **no third text block**. One was there and it measured
65px, which is room the scroll cue needs: the cue is white with no disc, so it
is legible only where the ramp has gone green — about a quarter of `--ramp`
below the join. With a lede in the fold, 1280x800 left 77px of room where the
cue needed 133, and the chevron sat on near-ivory at 1.10:1.

The headline is bounded on **both axes**: `min(clamp(...vw...), 10vh)`. The
clamp scales with viewport width, but the space the fold fits into is bounded
by height, so a 1920x900 laptop was getting 104px of headline in 900px of page.

`.hero__scroll[data-no-ground]` hides the cue where it still cannot reach the
green. `main.js` sets it from the measured depth; the `max-height: 720px` media
query was a guess standing in for the same condition and was set too low. Swept
across 35 viewports: every cue that renders clears 3:1, and 11 are hidden — all
at viewport heights of 850px or less.

### Category-in-the-fold, not promise-only

The brand's homepage rule is promise first, category second, and this keeps
it — but it does not leave the category five screens down. Measured, the old
order put "The decision layer for real estate asset management" **5.3 screens
down** on desktop and 4.8 on mobile: the one sentence naming the category sat
in the third section, behind four screens of the problem band, for a cold
reader who had never heard of the company.

Both arrangements were built and measured. Category-as-H1 works and reads
clearly; this one keeps the headline the page was designed around and still
lands the category in the fold at 23px, which is read rather than skimmed.

Note what this is NOT: an eyebrow above the headline. That was considered and
rejected — it would have put the most important sentence on the page in the
smallest type in the fold, which is the same objection the section below
raises against kickers generally.

### Why the sections have no labels above their headings

Section eyebrows were removed along with their numbers. A kicker above a
heading is a label doing work the heading should do itself, and the masthead
already names every section for anyone navigating. If a heading needs a label
to be understood, the heading is the thing to fix.

### Why the sections are not numbered

They were, 01 through 06, and the numbers were removed. Problem / How it works /
Demonstration / Value / Use cases / Trust is a set of topics, not a sequence —
nothing is true of Trust because it is sixth. Numbering it implied an order the
content does not have, and inside `#how` it collided with two other numbering
systems at once.

The six loop stages **are** numbered, because they are the one thing on the page
that genuinely is a sequence: Signal runs before Diagnosis, and Outcome feeds the
next Signal. Numbering there carries information. That is the test any structural
device on this page has to pass.

Customer testimonials are deliberately absent — there is nothing real to put
in them yet, and invented quotes are not an option. When quotes exist, they
belong between `#trust` and `#demo`.

## Placeholders that must be replaced before launch

One block is stubbed, and it is a factual claim about the company, so nothing
here was invented:

**`[FOUNDER NAME]` / `[ROLE]` / `[BACKGROUND]`** in `about.html`, under "Who is
building it". Real names, roles, and one or two sentences of verifiable
background — where they worked, what they built or ran. Delete the second
`<li>` if there is only one founder.

This is the one block on the site that cannot be written from the product, and
it is the block the About page exists for: a buyer reading it is checking
whether the people are credible. **A founders section with no founders in it is
worse than no About page**, so either fill it or take About out of the nav.

The email is live at `service@assetsignal.ai` throughout.

`privacy.html` is an honest description of what the form actually collects (five
fields, no cookies, no analytics, Google Fonts as the only third party). It is a
working draft, not reviewed advice — have someone check it before launch.

There is deliberately **no pilot, customer or traction claim** anywhere. The
company is pre-launch and the page says so.

## Two things to settle before this goes public

**1. The demonstration panel is invented.** Every property name, figure, date
and percentage in `#demonstration` is an example chosen to show the shape of
the output. The page says so, in the caption directly under the panel — keep
that caption. Replace the whole `<figure class="demo">` with a real screenshot
when one exists.

**2. The trust section makes no compliance claims.** Everything in `#trust` is
a statement about how the product is designed, not about certification,
encryption or hosting. Do not add SOC 2, encryption or data-residency language
there until it is verified and signed off.

One further placeholder: the demo form has no endpoint, so it reports that
plainly as an error. The masthead's dead **Sign in** link has been removed.

## Wiring up the demo form

The form posts to **Formspree** at `https://formspree.io/f/maewalwz`. It is live.

**Field names are a contract** with the Formspree form definition:

| Input | `name` | Required |
| --- | --- | --- |
| Name | `name` | yes |
| Work email | `email` | yes |
| Company | `company` | yes |
| Role | `role` | no |
| How does your team review assets today? | `memo` | no |

Renaming an input **silently drops that value** from the notification — Formspree
does not error on an unrecognised field, it just ignores it. The textarea was
called `context` during the build and was renamed to `memo` to match.

**`action` is the source of truth**, so with a real id the form works with or
without JavaScript. With JavaScript, `main.js` enhances it into a `fetch` that
sends `Accept: application/json` — which is what makes Formspree answer with
JSON instead of redirecting to its own thank-you page — and puts Formspree's
field-level errors onto the fields themselves. `novalidate` is applied by JS, so
visitors without it keep native browser validation.

`main.js` still guards the literal `YOUR_FORM_ID`, so if the endpoint is ever
re-templated the form reports "not connected yet" rather than POSTing into a 404
and telling the visitor their message failed to send — a different and much worse
claim than "nobody has connected this yet".

Two Formspree conventions are used: `_gotcha` is its built-in honeypot name, so
the trap is dropped server-side as well as by our JS; and `_subject` sets the
notification subject line, which `main.js` rewrites per submission to
`Asset Signal — demo request from <company>` so the inbox is scannable.

### The two success paths

**With JavaScript** the form is replaced in place by a confirmation block
(`.sent`), and focus moves to its heading — a cleared form with a sentence under
it reads as "nothing happened", and leaves keyboard focus on a control that has
gone. A "Send another request" control restores the form.

**Without JavaScript** the browser posts natively and Formspree redirects to
`_next`, which points at `thanks.html` — a page in this design system rather than
Formspree's generic one. **`_next` must be an absolute URL**, so it currently
reads `https://assetsignal.github.io/thanks.html`; change the host if the site
deploys anywhere else, or that path 404s for exactly the visitors who have no
JavaScript to fall back on.

Formspree's response shapes are parsed defensively — `{errors:[{field,message}]}`,
`{error:"…"}`, and no JSON at all all produce a sentence a person can act on.
Every one of those paths is exercised in testing, along with 429 and network
failure.

While `action` is empty the form validates, then states plainly that nothing was
sent — **as an error, in `--danger-ink`, and it does not begin with "Thank you."**
That detail is the whole point: the previous version reported the failure in the
brand accent green opening with "Thank you", so a skimmer read success and left
believing they had made contact.

### What the form handles

| Case | Behaviour |
| --- | --- |
| Missing/invalid field | Named inline under the field (`Add your work email to continue`), `aria-invalid` set, focus moved to the first offender, error cleared as soon as it becomes valid |
| No endpoint | Error state, says nothing was sent, points at the email address |
| Non-2xx response | Error state, input preserved, "press Request a demo to try again" |
| Network failure | Same recovery path |
| Request hangs | `AbortController` gives up after 10s — a request that hangs forever is indistinguishable from one never sent |
| Double submit | Button disabled and relabelled "Sending…" for the duration |
| Formspree field error (422) | Message placed on the named field, focus moved there |
| Rate limited (429) | "Too many requests just now. Wait a moment and press Request a demo again." |
| Bots | Off-screen honeypot named `_gotcha`, so Formspree drops it server-side too. `tabindex="-1"`, inside `aria-hidden`. A filled trap gets the success message so the bot learns nothing |

Input is bounded with `maxlength` (120 name/company, 254 email, 2000 textarea)
and the textarea breaks long words, so a pasted URL cannot widen the column.

Not done, and out of scope for a single-language marketing page: translation
infrastructure, RTL support, and locale-aware date/number formatting. The page
is `lang="en"` and states no dates or currency outside the illustrative panel.

## Colour system

Declared once in `css/base.css` under its own names, then mapped to roles, so
the system can be re-tuned in one place.

| Name | Hex | Role |
| --- | --- | --- |
| Warm Ivory | `#F7F3EC` | background |
| Pale Sage | `#E8EFEB` | secondary background |
| Institutional Eucalyptus | `#3F7568` | primary logo green |
| Deep Forest | `#24483F` | dark green — anchors, depth, the dark band |
| Soft Sage | `#7FA99B` | accent / charts |
| Near-black green | `#172522` | main text |
| Slate | `#68736F` | the brand's muted value |

State colour lives in the same system: `--danger` `#9A3B32` and `--danger-ink`
`#8E362D`, the only non-brand hue on the page.

`--field-line` `#848981` is the form-input underline. It exists because WCAG
1.4.11 asks 3:1 of a *UI component boundary*, not the 4.5:1 text threshold —
and `--rule-strong` composites to **1.79:1** on the ivory, which meant the
"highlighted field" on a validation error was a change to a line nobody could
see. It measures 3.23:1 on ivory and 3.06:1 on pale sage.

The small end of the type scale is four tokens — `--t-label` 11px, `--t-meta`
12px, `--t-sm` 14px, `--t-body` and `--t-lede` fluid — replacing twelve values
that had drifted into the 10.5-16px band, where 15px, 15.1px and 15.8px were
three tokens doing one job.

Four values are derived rather than taken from the system, all for contrast:

- `--ink-soft` `#3E4B47` — body copy. Slate itself is 4.45:1 on the ivory,
  under AA at any size.
- `--ink-muted` `#616C68` — small muted labels. The smallest step of the slate
  that clears AA on every surface the page uses: ivory, pale sage, and the
  tinted row inside the demonstration panel (4.67:1 at worst).
- `--signal-on-dark` `#94B7AB` — the accent where it has to carry small text on
  the Deep Forest. Soft Sage is 3.88:1 there.
- The field's strands are drawn from a darkened slate, because they are neutral
  noise rather than an accent.

`js/signal-background.js` keeps its own copy of these colours — a shader cannot
read CSS variables — so **the two files must be changed together.** Both name
the hex codes and point at each other.

## Typography

Newsreader for display (variable, with a real optical-size axis, so
`font-optical-sizing: auto` genuinely applies) and Inter for everything else,
both from Google Fonts. Headline tracking is size-specific rather than a fixed
`em` value, tightening as the type scales.

Newsreader is rationed on purpose: the hero, the section titles, the three
beats, the value and trust statements, the role lines, and the vision. Every
label, body paragraph, table and control is Inter.

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

The field follows the copy, never the other way round. `main.js` measures
where the hero copy lands and publishes it to the field, which uses it for two
things: moving its axis onto the copy, and clearing a halo around the text. If
the copy's geometry changes, the field follows automatically — no constants to
keep in sync.

It is worth saying why that direction, because the obvious one is wrong. The
field carries a nominal axis at 45% of the viewport, and pulling the copy onto
it looks reasonable until you measure the result: the fold starts below a
~120px masthead, so a copy centred at 45% ends up hard against the masthead
with the entire lower half of the fold empty — 76px of space above the
headline against 285px below it at 1440 × 900, and 18px against 213px at
1440 × 760. Letting the copy sit where the fold centres it and moving the
field to meet it balances the fold at every viewport height and still lands
the signal line through the copy. Decoration yields to content.

The field is a fixed viewport layer, but everything below the fold sits on an
opaque sheet (`.sheet`), which fades up out of the field and holds paper from
there down. So once the hero scrolls away the canvas is painting into a covered
layer: `main.js` watches the hero and calls `SignalField.setVisible(false)`,
which stops the loop until it comes back. A hidden tab, an off-screen field and
a lost GL context all resolve through one gate, so none of them can restart the
loop while another still wants it stopped.

### The masthead's height

`--nav-h` in `css/base.css` is computed from the same `--nav-pad` and
`--nav-logo` values `nav.css` lays the masthead out with, so the fold is whole
and anchored sections clear the sticky masthead before any script runs.

That token is a floor rather than the truth: the masthead is as tall as
whatever is tallest in it, and the demo pill beats the logo by about 20px. Left
alone, the fold overflowed the viewport by 17–26px. `main.js` measures the
masthead and overwrites `--nav-h` with the real height, so the token is the
no-JS answer and the measurement is the accurate one.

## The fold's vertical balance

The copy sits in the **upper** part of the fold, not centred. Centred, it left
181px of empty ivory between the masthead and the headline at 1440x900 and
243px at 1920 — the page read as not having started. `.hero > .wrap` is
`justify-content: flex-start` with `margin-top: clamp(12px, 7vh, 84px)` on the
copy, which roughly halves that gap and lets the space collect at the bottom
instead, where the field and the scroll cue are doing something with it.

`main.js` publishes the copy's centre to the signal field, so the field follows
the copy upward automatically; the resulting axis stays inside the shader's
`AXIS_MIN`/`AXIS_MAX` clamp at every viewport tested (0.41–0.53 from the top).

## The scroll cue

A real `<button>`, centred on the page and pinned to the bottom of the fold —
72px on desktop, 56px on mobile, with an `aria-label`. Outlined rather than
filled so it reads below the primary CTA in the hierarchy, on a translucent
paper backing so it stays legible where the signal field runs behind it.

It nudges by 0.82 of a viewport rather than jumping to the next section, so the
reader sees the page continue instead of being teleported past the transition
the fold sets up. It retires (`data-spent`) once `scrollY > 40` — it is a prompt
to start, so it goes as soon as the reader has — and its loop stops with it.

Pinning it to the fold's bottom is why `.hero` is `align-items: stretch` with a
full-height flex wrap. Centred (`align-items: center`) the wrap shrink-wraps to
the copy, and an absolutely positioned child then measures against the copy's
height rather than the fold's — the mistake the old category line made. The
fold's balance was re-measured after that change and holds to within 1px.

It hides below `660px` of viewport height. At 640 the cue's box begins to
overlap the copy's; nothing visibly collides today because the copy's children
shrink-wrap, but a longer headline would.

Its slow drift is the one looping animation on the page. It is scoped to
`prefers-reduced-motion: no-preference`, so under reduced motion the computed
`animation-name` is `none` and the click scrolls instantly rather than smoothly.

## Motion: one moment, not one per section

Every element below the fold used to share a single fade-in on scroll. That is
an identical entrance repeated on every section, which reads as a template
rather than as a decision, so it came off everything. The only motion below the
fold is now the signal being drawn through the noise in `#problem` — the one
moment the brand's own guide asks for. `[data-enter]` appears exactly once in
the markup.

## Spacing: three intervals, not one

The page had a single 116px gap doing all the work inside sections and 207px
between them — a **1.45:1 ratio**, measured as continuous ink-free horizontal
runs. That is not enough contrast for a reader to feel where one argument ends
and the next begins, which is what made seven distinct bands read as one band
repeated.

| Token | Value | Role |
| --- | --- | --- |
| `--space-5` | 34px | binds a subhead to the block it introduces |
| `--gap-block` | clamp(44px, 5.4vw, 72px) | a section head to its content |
| `--gap-movement` | clamp(72px, 9vw, 116px) | a new movement inside a section |
| `--section-y` | clamp(88px, 11.5vh, 172px) | doubled at every band boundary |

## Two layout rules worth not undoing

**`.pillars` is capped to its own tracks.** The rows are `minmax(0,27ch)
minmax(0,62ch)` inside a 1320px measure, so the `border-top` used to span
1320px while the text stopped at ~1000 — **373px of bare hairline on eleven
consecutive rows**, growing to 478px at 1920. On a page whose entire hierarchy
is hairlines rather than boxes, a hairline pointing at nothing reads as content
that failed to load. `max-width: calc(27ch + 62ch + <gap>)` restates the track
definition so rule and text always end together.

**The loop is 3x2, not 6x1.** At six columns the text track measured 197px —
21–25 characters a line, and *narrower at 1440 than at 1024*, because the
breakpoint promoted 3→6 exactly when the copy stopped fitting. At three it is
~430px and 60 characters, and the row break lands between Recommendation and
Decision, which is where the copy says the turn is.

## The hero-to-problem dissolve

The two sections are one continuous ramp, built in two halves that hand over at
an exact colour match.

**Hero half** (`.hero::after`) — 66vh tall, reaching well up behind the copy so
the shift has already begun while the reader is still in the hero. Twelve stops
on an eased curve; the first 45% stays under 10% alpha, so it tints without
touching legibility.

**The pools live on `.dissolve`, a single element that straddles the boundary.**
That is structural, not cosmetic. Split between the two sections, every overlay
had to reach zero alpha exactly at the join or it drew a line there — and it did,
three separate times: first the problem band's ellipses darkening its first
pixel, then their alpha surviving the `background-size` clip at the ramp's end,
then the hero's darker pool leaving its last pixel 4 units below the problem's
first. One element spanning the join has no such constraint, so the green
feathers across freely. It sits at `z-index: 1`, over both backgrounds; the
problem band's own children are lifted to `z-index: 2` so no text is covered.

The constraint still applies to anything that *is* confined to one side:
`cy > 0.85r` and `(100 - cy) > 0.85r`.

**Problem half** (`.band--noise`) — starts on the exact Pale Sage the hero ends
on, then walks the palette down: Soft Sage, Eucalyptus, Deep Forest, ink. Its
length is `--ramp`, and the stops and the padding that clears them are both
expressed against it so they stay in step.

Three things make it read as diffusion rather than as a ramp:

- **`in oklab` interpolation.** Two stops in sRGB band visibly over this
  distance and pass through a grey midpoint none of these colours contain.
  A plain sRGB gradient is declared first as the fallback.
- **Twelve eased stops** rather than an even distribution.
- **Two very wide, soft ellipses** over the vertical ramp, 150–165% wide and
  under 62% tall, so the transition front is a slow curve rather than a ruler
  line. Measured, the front varies 9–24px across the viewport width — present,
  but nowhere near reading as a circle.

Two positioning constraints, both found by measurement:

- The ellipse centres sit at 58% and 74% of the ramp. Higher, and they darken
  the ramp's first pixel and put a **visible seam** exactly where the hero hands
  over. Lower, and they only touch ground that is already dark, and the front
  measures **dead flat**. At the current centres the join's largest single-step
  colour delta is **1** — invisible — and the front still curves.
- The section title starts at `calc(var(--ramp) * 0.78)`, inside the ramp rather
  than after it. The gap before it was reading as dead space. Measured against
  the actual rendered pixels, the title sits on ground giving **13:1** and the
  italic line on Soft Sage gives **6.08:1**.

Note that a computed-style contrast check reports false failures here: the band's
ground is a `background-image` with a transparent `background-color`, so walking
the ancestor chain finds the sheet's paper instead. Sample rendered pixels.

## The problem section

A scroll-pinned sequence, and the only place on the page where the reader does
work. The stage sticks for four screens; scroll progress is written to `--p`
and everything derives from it — the context strands recede, the signal is
drawn down through them, the node appears, the axis label resolves, and the
copy advances left / right / left / right around the field. It ends holding on
the conclusion.

**Ground is `--ink` #172522, not `--forest`.** Soft Sage measures **6.08:1** on
#172522 and only **3.88:1** on #24483F, so the brand's own accent can carry
text here without being lightened — and the section stays distinct from both
the ivory hero and the Deep Forest trust band.

**The field is generated, deterministic, and symmetric.** Eighteen strands in
nine mirrored pairs, each a sum of three rationally-related harmonics
(`sin(k+φ) + 0.45·sin(2k+2φ) + 0.22·sin(3k+3φ)`) with evenly-spaced offsets and
phases. Complexity comes from interference, not from a random number generator,
so it reads as a system rather than as scribble. Mirroring negates the whole
excursion for the −1 side: adding π to the phase is *not* a mirror, because it
flips the fundamental and leaves every even harmonic where it was — which is
what made an earlier version lean visibly left. Verified: strand mean x =
280.00 against a 280.0 axis.

Regenerate with `scripts` in the scratchpad if the geometry ever needs retuning;
the shape is fully described by `SPREAD`, `L`, `HALF`, and the `conv`/`env`
falloffs.

**Three things that must not be undone:**

- `--dash` carries a `px` unit. `calc(<number> * …)` is rejected where a
  `<length>` is expected, which silently left the signal fully drawn from the
  first frame.
- `--draw` and `--node` are clamped in JavaScript, not CSS. A `clamp()` nested
  inside `calc()` did not resolve and produced the same symptom.
- The stage carries the page measure itself (`max-width` + `padding-inline`).
  `.problem__scroll` sits outside `.wrap` so the field can run full height,
  which otherwise pushes the axis labels off the left edge.

Without JavaScript, or under `prefers-reduced-motion`, `problem--static` drops
the pin: the stage stops sticking, all four steps are visible in order, and the
field is shown resolved. The argument survives; only the pin goes.

## A CSS bug worth remembering

`color-mix(in srgb, <colour> 86%, transparent)` computes to `oklab(0 0 0 / 0)`
in Chromium — fully transparent, not the intended tint. The sticky masthead had
**no surface at all**, which was invisible while every section behind it was
ivory and became a 1.32:1 contrast failure the moment one went dark. Every
`color-mix` that mixed *with transparent* is now a literal `rgba()`. Mixing two
opaque colours (the open row in `demo.css`) is fine and still in use.

## The noise-to-clarity transition

The Brand Guide names a signature motion: begin with softer, overlapping,
lower-contrast signals and progressively sharpen into a clearer primary line.
The figure at the end of `#problem` is exactly that picture, so it performs it
rather than arriving finished — context strands fade up, the signal is drawn
along its length through them, then the node marking the observation appears.
One orchestrated moment on the whole page, not scattered effects.

Two implementation notes, both of which cost time to find:

- The dash length is the path's **measured** length, written to `--dash` by
  `main.js`. `pathLength="1"` is the tidier answer on paper, but combined with
  `vector-effect="non-scaling-stroke"` browsers compute the dash in device space
  against a length normalised in user space, and the stroke stops visibly short
  of the end of the curve.
- The `prefers-reduced-motion` override lives in `sections.css` directly beneath
  the rule it overrides, not in `base.css` with the other motion preferences. It
  has to match `[style*="--dash"]` to reach the same specificity, and at equal
  specificity only source order decides — `base.css` is linked first, so an
  override there loses and the line animates anyway.

## The static graphics

The waveform figures in `#problem` and the closing band, and `img/symbol.svg`,
are generated geometry rather than drawn by hand: mathematically smooth curves,
varied wavelength and phase, no repeated element — which is what the brand's
graphic system asks for. Each path is sampled and then smoothed with quadratic
segments through the midpoints, which is about a third the payload of cubics
and indistinguishable at these wavelengths. Strokes carry
`vector-effect="non-scaling-stroke"` so hairlines stay hairlines at every
viewport width.

`img/symbol.svg` was rebuilt from the supplied lockup by measuring it — three
nested bell curves, stroke 10 in a 186 × 144 box — so the favicon is the real
mark rather than a cropped raster.

## Two verification traps worth knowing about

**`innerWidth` cannot detect horizontal overflow on mobile.** Under mobile
emulation the layout viewport *grows* to contain overflowing content, so
`window.innerWidth` becomes the overflowed width and
`scrollWidth - innerWidth` computes 0 for a page that is visibly broken. A
216px email address in a 163px footer track was giving 33px of horizontal
scroll at 390px while this check reported clean. Measure against
`document.documentElement.clientWidth` instead.

## A validation trap worth knowing about

Two rules were silently lost during editing and neither the CSS parser nor the
class-coverage check caught them, because both produce *valid* CSS:

```css
.field > label {              /* dangling: opens a block          */
/* comment */
.field > label { ... }        /* CSS nesting makes this legal     */
```

Under CSS nesting that parses cleanly and resolves to `.field > label .field >
label`, which matches nothing — so every rule after it silently stopped
applying. The second case was subtler: a text edit that matched `.eyebrow {`
inside `.section-head > .eyebrow {` left the `.section-head > ` prefix welded
onto the following rule, scoping `.section-title` to section heads only. Six of
the seven titles were inside one, so the page looked correct.

Neither is detectable by parsing. The check that catches both is comparing
**computed styles in a browser** against what an unstyled element of the same
tag would compute: any class whose element matches the bare default is a rule
that is not being applied. `scripts` for this are not committed, but the
technique is a two-minute `page.evaluate` and it is the only thing here that
would have caught either bug.

## Accessibility

- A skip link, one `h1`, and a heading per band.
- Every text colour clears WCAG AA on the surface it sits on; the derived
  colour steps above exist for that reason.
- Priority in the demonstration panel is carried by the word first and the
  colour second — the label reads at full contrast and the hue lives on the
  dot, so nothing is encoded in colour alone.
- The panel's Approve / Assign / Dismiss are `<span>`s, not buttons: it is a
  picture of the product, and a control that does nothing is worse than none.
- The demo form validates on submit rather than on keystroke, moves focus to
  the first invalid field, and reports through an `aria-live` region.
- The demo CTA stays in the masthead at every width. It used to be hidden behind
  the hamburger below 900px, which left the mobile fold of a Persuade page with no
  route to its one conversion.
- Every pointer target clears 24x24 CSS px (WCAG 2.2 AA 2.5.8), except the 1x1
  honeypot, which is `aria-hidden`, `tabindex="-1"` and unpainted. Nav, footer and
  quiet links buy that with padding rather than larger type, so the type scale
  is unaffected; the mobile menu button is 44x44.
- No functional text below 11px. The demonstration panel's micro-labels sat at
  10.5px, which is a legibility failure regardless of how deliberate the
  letterspacing looks.
- Form labels are sentence case. A 39-character question in letterspaced
  uppercase is a passage, not a label.
- Structural devices carry information rather than decorate: see the note on
  numbering above.

Three preferences are tracked live, not read once at load, so toggling the OS
setting takes effect immediately:

- `prefers-reduced-motion` — the field stops travelling and the parallax
  stops; the composition, depth and colour all remain. Entrance transitions
  become short cross-fades, and the scroll reveals become opacity-only.
- `prefers-contrast` — dispersion and haze are cut back, opacity raised.
- `prefers-reduced-transparency` — colour fringing is reduced.

The field also adapts its resolution to the frame time it is actually
achieving, and stops drawing entirely on a hidden tab.

Without JavaScript the page is fully readable: the scroll-reveal initial state
is scoped to a class `main.js` adds, so nothing is hidden that nothing will
reveal.

## Browser support

WebGL2 where available, WebGL1 otherwise, and a CSS gradient that reads as the
same composition where neither is. Context loss is handled and recovered from.
`color-mix()` is used for two surfaces, each with a flat fallback declared
immediately before it.
