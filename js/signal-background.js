/* ─────────────────────────────────────────────────────────────
   signal-background.js — WebGL "signal field" background.

   Self-contained: mounts a canvas into #signal-bg and owns it.
   Source of truth for the composition; css/base.css carries only
   the layer geometry and the no-WebGL fallback gradient.
   ───────────────────────────────────────────────────────────── */

(() => {
  "use strict";

  // ── Field axis ─────────────────────────────────────────────────────
  // Where the strand bundle sits vertically, in shader uv (0 = bottom of
  // the viewport, 1 = top). Every part of the composition that has to
  // agree on "the middle of the field" reads this: the strands, the green
  // glow, the top/bottom falloff — and, through the global below, the
  // hero copy in main.js. One number, so the copy can never drift off
  // the waves again.
  // It is a uniform rather than a baked constant because the page may need
  // to move it: where the viewport is too short for the hero copy to reach
  // the axis, the copy stops at the masthead and the FIELD comes to meet it
  // instead — decoration yields to content, and the two never separate.
  const AXIS = 0.55;
  const AXIS_MIN = 0.32;
  const AXIS_MAX = 0.72;

  let axis = AXIS;

  // Where the page's copy sits, in uv (x0, y0, x1, y1), y from the bottom.
  // The default is a sensible guess for a left-hand headline block, used
  // until the page measures its own text.
  const copyBox = new Float32Array([0.03, 0.20, 0.44, 0.80]);

  window.SignalField = {
    get axis() { return axis; },                 // from the bottom, shader convention
    get axisFromTop() { return 1 - axis; },      // from the top, CSS/DOM convention
    // Rect in CSS px, as getBoundingClientRect gives it.
    setCopyBox(r) {
      const w = window.innerWidth, h = window.innerHeight;
      const next = [r.left / w, 1 - (r.top + r.height) / h, r.right / w, 1 - r.top / h];
      if (next.every((v, i) => Math.abs(v - copyBox[i]) < 0.002)) return;
      copyBox.set(next);
      pushCopy();
    },

    setAxisFromTop(v) {
      const next = Math.min(AXIS_MAX, Math.max(AXIS_MIN, 1 - v));
      if (Math.abs(next - axis) < 0.0005) return; // already there — no redraw churn
      axis = next;
      pushAxis();
    },

    // The page covers the field with an opaque sheet below the fold. Drawing
    // into a covered layer is pure cost, so the page reports whether the
    // canvas is actually on screen and the loop stops when it is not.
    setVisible(v) {
      onscreen = !!v;
      sync();
    },
  };

  // Replaced once the GL program exists; a no-op before then (and forever, if
  // WebGL is unavailable) so the setter is always safe to call.
  let pushAxis = () => {};
  let pushCopy = () => {};

  // Two independent reasons to stop drawing — a hidden tab and a field that
  // has scrolled out of view — resolved through one gate, so neither can
  // restart the loop while the other still wants it stopped.
  let onscreen = true;
  let sync = () => {};

  const mount = document.getElementById("signal-bg");
  if (!mount) return; // page without the background layer — nothing to do

  const canvas = document.createElement("canvas");
  mount.appendChild(canvas);

  const glOpts = {
    alpha: false,
    antialias: false,          // we anti-alias analytically in the shader
    depth: false,
    stencil: false,
    premultipliedAlpha: false,
    powerPreference: "high-performance",
    preserveDrawingBuffer: false,
  };

  let gl = canvas.getContext("webgl2", glOpts) || canvas.getContext("webgl", glOpts);
  if (!gl) return; // CSS fallback gradient stays visible

  // Every strand needs 4 vec4 uniform slots. Scale the count to what the
  // driver actually advertises rather than assuming a desktop budget.
  const MAX_VEC = gl.getParameter(gl.MAX_FRAGMENT_UNIFORM_VECTORS) || 64;
  const LINES   = Math.max(12, Math.min(80, Math.floor((MAX_VEC - 20) / 4)));
  const HERO_I  = Math.round(LINES / 2);

  const TAU = Math.PI * 2;

  // ── The field ──────────────────────────────────────────────────────
  // The strands are not independent sine lines. They are streamlines on ONE
  // rippling plane — a floor, receding away from the viewer toward a
  // vanishing point at (VPX, axis + LIFT). Everything follows from that
  // pinhole:
  //
  //   u = x - VPX            distance from the vanishing point on screen,
  //                          which for a plane is exactly the scale factor
  //   baseline  = horizon + slope*u     straight lines through the VP: the fan
  //   amplitude = AMPK*|slope|*u        the ripple grows as it comes at you
  //   phase     = PK/|slope|/u          world depth is 1/u, so crests crowd
  //                                     toward the VP and open out to the right
  //
  // Every slope has the same sign — the plane is a single surface, all of it
  // below its own horizon, not a mirrored pair hinged on the axis. The
  // horizon sits LIFT above the composition axis so the band of strands
  // straddles the axis rather than hanging off it.
  //
  // Every strand samples the SAME wave in world space, so crests line up
  // across the fan into wavefronts sweeping outward — that is the unity. The
  // scatter is three harmonics beating against each other, a lateral phase
  // term that tilts the wavefronts across the plane, and a little per-strand
  // jitter.
  //
  // A strand's |slope| IS its distance: a nearly flat strand lies far out
  // across the floor, so it is small, faint, hazy and barely parallaxes,
  // while the steep near strands are big and sharp. The green signal is one
  // of these streamlines — same equations, same surface — set apart by
  // treatment alone: full colour, in focus, and a highlight travelling along it.
  const FIELD = {
    VPX:  -0.18,    // vanishing point in screen x — behind the headline
    LIFT: 0.170,    // horizon, relative to the composition axis — puts the
                    // vanishing line high on the left without reaching the top
    UMIN: 0.16,    // floor on the perspective divide; without it the frequency
                   // near the vanishing point runs past the sampling rate
    SLOPE: [0.130, 0.520],   // fan angle at the horizon and at the front
    AMPK:  0.260,            // ripple height per unit slope, per unit u
    HERO_A: 0.56,            // the signal stands taller than the noise around it
    SPREAD: 1.20,            // fan spacing curve: strands bunch toward the horizon
    HERO_T: 0.30,            // where the signal sits in the fan, 0 = horizon, 1 = front
    HERO_SLOPE: 0.530,       // its own fan angle: steeper than its slot would give,
                             // so it enters lower down despite aiming higher
    HERO_RISE:  0.045,       // its vanishing point sits this far above the plane's
    HERO_VPX:   0.150,       // ...and this far in from the plane's, toward centre
    HERO_PK:    2.92,        // its own wave number: the field is a sum of three
                             // harmonics, the signal is a single clean sine
    HERO_SWELL: 1.000,       // amplitude GROWS toward the right at this rate:
                             // 0 = an even height, 1 = the plane's own linear swell
    HERO_FWD:   1.400,       // period SHORTENS toward the right at this rate — the
                             // opposite of what perspective does, so it only shows
                             // once HERO_CHIRP is at or near 0
    HERO_CHIRP: 0.000,       // how much of the plane's perspective the signal keeps
                             // in its WAVE: 1 = fully chirped like the field, its
                             // wavelength compressing toward the vanishing point;
                             // 0 = an even wavelength and an even height, a
                             // textbook sine. Its BASELINE stays in perspective
                             // either way, so it still lies on the plane.
    HERO_RAMP: [0.17, 0.73], // over this span of u the signal takes up the ripple:
                             // before it, it runs dead straight out of the VP

    PK: [2.50, 4.20, 7.00],  // world wave numbers
    A:  [0.55, 0.30, 0.15],  // relative amplitudes, sum = 1
    Q:  [1.70, -1.10, 2.60], // lateral phase — tilts the wavefronts across the plane
    W:  [0.42, 0.31, 0.55],  // angular speeds

    CLEAR_PAD:  -0.088,      // halo inset INTO the copy block, height-normalised
    CLEAR_FADE: 0.248,       // how far it takes the field to come back in — long,
                             // so the clearing reads as a gradient, not an edge
    // 0.66, down from 0.88. This is the white that was drowning the field in
    // the fold: inside the copy halo the background went nearly all the way to
    // paper, and the halo covers the left 44% of the viewport plus a 0.248
    // feather past it — so most of the hero was being washed out to protect
    // copy that has contrast to spare. At 0.66 the strands read through the
    // feather and the headline still measures far above the AA floor.
    CLEAR_WASH: 0.66,        // how far toward paper the background goes inside it

    // Per-strand variance. The surface stays one surface — same harmonics,
    // same travelling phase — but each streamline reads it a little
    // differently, so the field scatters instead of combing.
    VAR: {
      amp:   [0.68, 1.40],   // how tall this strand's ripple runs
      freq:  [0.84, 1.22],   // and how tightly, by scaling its depth scale
      slope: 0.22,           // fan-angle jitter, fraction
      phase: 3.00,           // per-harmonic phase scatter, radians

      // Variance is drawn per CHUNK of neighbouring strands rather than per
      // strand, with only a residual left individual. Adjacent strands then
      // read the surface almost alike and travel as a ribbon, while one
      // ribbon differs from the next — local uniformity, global scatter.
      chunk:    6,           // strands per ribbon
      residual: 0.30,        // how much of the variance stays individual
    },
  };

  const glsl = (n) => n.toFixed(5);
  const glslVec3 = (v) => `vec3(${v.map(glsl).join(", ")})`;

  // ── Shader ─────────────────────────────────────────────────────────
  // Everything constant per strand (frequencies, phases, widths, colours,
  // depth falloff) is computed once on the CPU and uploaded as uniform
  // arrays. The fragment shader used to derive all of it from hash11()
  // per pixel — ~230 hash evaluations per fragment, every frame, all
  // producing identical values. That was the bulk of the fill cost.

  const VERT = `
    attribute vec2 aPos;
    void main() { gl_Position = vec4(aPos, 0.0, 1.0); }
  `;

  const FRAG = `
    #ifdef GL_FRAGMENT_PRECISION_HIGH
    precision highp float;
    #else
    precision mediump float;
    #endif

    uniform vec2  uRes;      // drawing buffer size, device px
    uniform vec2  uPointer;  // -1..1, eased
    uniform float uPx;       // resolution scale (widths are authored in CSS px)
    uniform float uAxis;     // field axis, uv from bottom — see AXIS below
    uniform vec3  uPh;       // travelling phase of the three harmonics
    uniform float uAmp;      // global breathing scalar
    uniform vec4  uCopy;     // copy block in uv (x0, y0, x1, y1), y from bottom
    uniform float uCAAmt;    // radial chromatic aberration, device px
    uniform vec2  uCAVel;    // directional aberration from pointer motion, device px

    // Per strand, precomputed:
    uniform vec4 uP0[${LINES}];  // scale (1/z), offset from axis, z, -
    uniform vec4 uP1[${LINES}];  // phase of each harmonic on this row, -
    uniform vec4 uP2[${LINES}];  // halfWidth, softness, dispersion, parallax
    uniform vec4 uP3[${LINES}];  // colour.rgb, alpha

    const int LINES  = ${LINES};
    const int HERO_I = ${HERO_I};

    // The surface, shared by every row. See FIELD in the JS above.
    const float VPX  = ${glsl(FIELD.VPX)};
    const float UMIN = ${glsl(FIELD.UMIN)};
    const vec3  PK   = ${glslVec3(FIELD.PK)};
    const float SMAX = ${glsl(FIELD.SLOPE[1] * (1 + FIELD.VAR.slope / 2))};
    const float AMPB = ${glsl(FIELD.AMPK * FIELD.VAR.amp[1] * FIELD.VAR.freq[1])};
    const float HRISE = ${glsl(FIELD.HERO_RISE)};
    const float HVPX  = ${glsl(FIELD.HERO_VPX)};
    const float HPK    = ${glsl(FIELD.HERO_PK)};
    const float HCHIRP = ${glsl(FIELD.HERO_CHIRP)};
    // Reference point the straightened wave is matched at — mid of the span
    // where the signal is visible. Phase and slope agree with the perspective
    // form here, so the blend never changes the cycle count.
    const float HU0    = 0.620;
    const float HUREF  = 1.239;
    const float HFWD   = ${glsl(FIELD.HERO_FWD)};
    const float HSWELL = ${glsl(FIELD.HERO_SWELL)};
    const float CLEAR_PAD  = ${glsl(FIELD.CLEAR_PAD)};
    const float CLEAR_FADE = ${glsl(FIELD.CLEAR_FADE)};
    const float CLEAR_WASH = ${glsl(FIELD.CLEAR_WASH)};
    const float HR0  = ${glsl(FIELD.HERO_RAMP[0])};
    const float HR1  = ${glsl(FIELD.HERO_RAMP[1])};
    const float LIFT = ${glsl(FIELD.LIFT)};
    const float AMPK = ${glsl(FIELD.AMPK)};
    const vec3  AW   = ${glslVec3(FIELD.A)};

    // Core colour system, mirrored from css/base.css.
    const vec3 PAPER = vec3(0.969, 0.953, 0.925);  // #F7F3EC Warm Ivory
    const vec3 GREEN = vec3(0.247, 0.459, 0.408);  // #3F7568 Institutional Eucalyptus
    const vec3 MINT  = vec3(0.498, 0.663, 0.608);  // #7FA99B Soft Sage
    const vec3 DEEP  = vec3(0.141, 0.282, 0.247);  // #24483F Deep Forest

    // Five spectral bands, long wavelength first. Each is displaced a
    // different distance — that is what dispersion physically is. The
    // three columns sum to exactly (1,1,1), so with zero displacement the
    // taps recombine to the original colour and nothing shifts.
    const vec3 SP0 = vec3(0.55, 0.02, 0.00);   // red
    const vec3 SP1 = vec3(0.35, 0.18, 0.00);   // amber
    const vec3 SP2 = vec3(0.10, 0.60, 0.10);   // green
    const vec3 SP3 = vec3(0.00, 0.18, 0.35);   // cyan
    const vec3 SP4 = vec3(0.00, 0.02, 0.55);   // blue

    // Coverage of one spectral band at a given signed offset.
    float band(float d, float e0, float e1) {
      return 1.0 - smoothstep(e0, e1, abs(d));
    }

    float sdBox(vec2 p, vec2 b) {
      vec2 d = abs(p) - b;
      return length(max(d, 0.0)) + min(max(d.x, d.y), 0.0);
    }

    float hash21(vec2 p) {
      vec3 p3 = fract(vec3(p.xyx) * 0.1031);
      p3 += dot(p3, p3.yzx + 33.33);
      return fract((p3.x + p3.y) * p3.z);
    }

    void main() {
      vec2  uv     = gl_FragCoord.xy / uRes;
      float aspect = uRes.y / uRes.x;

      vec3 col = PAPER;

      // Warm paper gradient + a very soft green field on the right.
      col = mix(col, PAPER * 0.985, smoothstep(0.0, 1.0, 1.0 - uv.y) * 0.35);
      col = mix(col, mix(PAPER, MINT, 0.085),
                smoothstep(0.85, 0.0, distance(uv, vec2(0.78, uAxis - 0.22)) * 1.35));

      // Terms shared by every strand — hoisted out of the loop. The
      // per-strand parallax shift is at most 0.012 in x, far too small to
      // matter to these envelopes, so evaluating them once at uv.x is
      // visually identical and saves 4 smoothsteps per strand.
      float envX     = 0.18 + 1.42 * smoothstep(0.18, 0.96, uv.x);
      float leftBlur = (1.0 - smoothstep(0.20, 0.74, uv.x)) * 10.0;
      float parBase  = smoothstep(0.22, 1.0, uv.x);
      // Copy clearance. The page publishes where its text actually sits and
      // the field fades to paper inside a padded halo around it, so the copy
      // reads against clean background wherever it happens to land. Measured
      // in height-normalised units so the halo is visually even on both axes.
      float ar    = uRes.x / uRes.y;
      vec2  cCen  = vec2((uCopy.x + uCopy.z) * 0.5 * ar, (uCopy.y + uCopy.w) * 0.5);
      vec2  cHalf = vec2((uCopy.z - uCopy.x) * 0.5 * ar, (uCopy.w - uCopy.y) * 0.5) + CLEAR_PAD;
      float clear = smoothstep(0.0, CLEAR_FADE, sdBox(vec2(uv.x * ar, uv.y) - cCen, cHalf));

      // The field dissolves away across the copy side of the page. A long
      // ramp, so the waves arrive out of the paper rather than starting at an
      // edge — and it doubles as cover for the seam where the perspective
      // divide is clamped, back near the vanishing point.
      float visBG    = clear * smoothstep(0.16, 0.70, uv.x);
      float invH     = 1.0 / uRes.y;

      // Chromatic aberration displacement for this pixel, in normalized
      // units. Radial and growing with r^2 like a real lens, plus a
      // uniform directional term driven by pointer motion.
      vec2 rad  = uv - 0.5;
      vec2 caN  = (rad * dot(rad, rad) * 4.0 * uCAAmt + uCAVel) / uRes;

      // Perspective scale for this column: distance from the vanishing point.
      // Everything the field does horizontally is a function of it.
      float u       = max(uv.x - VPX, UMIN);
      float invU    = 1.0 / u;
      float HORIZON = uAxis + LIFT;

      // Bound on |d(fy)/dx| over every strand, for the aberration reach in the
      // early-out. The wave's contribution works out strand-independent: its
      // amplitude carries a factor |slope| that its frequency divides back out.
      float maxSlope = SMAX * (1.0 + AMPB) + AMPB * dot(AW, PK) * invU;

      for (int k = 0; k < LINES; k++) {
        if (k == HERO_I) continue;

        vec4 A = uP0[k];   // slope, amplitude coefficient, 1/|slope|, -
        vec4 B = uP1[k];   // per-strand phase of each harmonic, -
        vec4 W = uP2[k];   // half width, softness, dispersion, parallax
        vec4 C = uP3[k];   // colour.rgb, alpha

        float par = parBase * W.w;
        float y   = uv.y + uPointer.y * 0.011 * par;

        float amp  = A.y * u * uAmp;          // ripple grows as it comes at you
        float hw   = W.x * uPx;
        float soft = (W.y + leftBlur) * uPx;

        // Reject before any trig: this pixel is outside the strand's band.
        // |h| <= 1 by construction, so amp is the exact bound. The aberration
        // can pull a channel in from further out, so bound its reach too.
        float sepMax = (abs(caN.y) + maxSlope * abs(caN.x)) * W.z;
        if (abs(y - (HORIZON + A.x * u)) > amp + sepMax + (hw + soft + 2.0) * invH) continue;

        // World depth along the strand is 1/u, so the SAME wave reads as fine
        // ripples near the vanishing point and long open swells at the front.
        float x   = uv.x + uPointer.x * 0.008 * par;
        float ux  = max(x - VPX, UMIN);
        vec3  ph  = PK * (A.z / ux) + B.xyz + uPh;

        vec3  sp  = sin(ph);
        vec3  cp  = cos(ph);
        float h   = dot(AW, sp);
        float dh  = -dot(AW * PK, cp) * A.z / (ux * ux);   // d(h)/dx

        float fy     = HORIZON + A.x * ux + amp * h;
        float slopeN = A.x + A.y * uAmp * (h + ux * dh);   // product rule
        float mpx    = slopeN * aspect;
        float base   = y - fy;

        // Displacing the sample point by (caN.x, caN.y) moves it off the
        // curve by caN.y - slope*caN.x, so both components collapse into a
        // single signed offset. Sampling that offset at five points gives
        // true spectral dispersion for five cheap coverage tests — the wave
        // itself is still evaluated only once, no resampling.
        //
        // W.z scales dispersion with the strand's DEPTH: distant strands
        // refract far more than near ones, which is what turns a flat
        // colour fringe into an actual sense of layered depth.
        float invD = uRes.y * inversesqrt(1.0 + mpx * mpx);
        float bd   = base * invD;
        float sd   = (caN.y - slopeN * caN.x) * W.z * invD;

        soft = max(soft, 0.55);
        float e0 = hw - soft;
        float e1 = hw + soft;

        vec3 cov = SP0 * band(bd + sd,        e0, e1)
                 + SP1 * band(bd + sd * 0.5,  e0, e1)
                 + SP2 * band(bd,             e0, e1)
                 + SP3 * band(bd - sd * 0.5,  e0, e1)
                 + SP4 * band(bd - sd,        e0, e1);

        // Energy conservation: a softened line loses peak opacity, it doesn't gain area.
        float energy = hw / (hw + soft * 0.78);

        col = mix(col, C.rgb, clamp(cov * (C.w * energy * visBG), 0.0, 1.0));
      }

      // ── The signal ──────────────────────────────────────────────────
      // One of the plane's own streamlines, evaluated with exactly the same
      // equations as every other — it belongs to the surface, it is not a
      // curve laid over it. What sets it apart is treatment: full colour, in
      // focus, and a slow highlight travelling along it. It is drawn after
      // the loop so it sits on top of the field it came out of.
      {
        vec4 A = uP0[HERO_I];
        vec4 B = uP1[HERO_I];
        vec4 W = uP2[HERO_I];

        float par = parBase * W.w;
        float x   = uv.x + uPointer.x * 0.008 * par;
        float y   = uv.y + uPointer.y * 0.011 * par;
        // The signal converges on its own point — further in from the plane's
        // vanishing point, and higher — so it reads as its own line through
        // the field rather than one more streamline of it.
        float ux  = max(x - HVPX, UMIN);

        // The field is a sum of three harmonics beating against each other,
        // each chirping as the perspective compresses it. The signal is a
        // single sine, and HCHIRP straightens it: blended toward an even
        // wavelength so every crest matches the last.
        // Perspective stretches the period toward the viewer; the quadratic
        // term in the straightened form does the reverse, tightening it as the
        // wave runs right. Both still agree with the perspective form in value
        // at HU0, so the blend never jumps.
        float pPersp = 1.0 / ux;
        float pEven  = (HUREF - ux - HFWD * (ux * ux - HU0 * HU0)) / (HU0 * HU0);
        float ph = HPK * A.z * mix(pEven, pPersp, HCHIRP) + B.x + uPh.x;

        float dPh = HPK * A.z * mix(-(1.0 + 2.0 * HFWD * ux) / (HU0 * HU0),
                                    -1.0 / (ux * ux), HCHIRP);
        float h   = sin(ph);
        float dh  = cos(ph) * dPh;

        // The signal leaves the vanishing point dead straight and only takes
        // up the surface's ripple as it advances, so the eye can follow the
        // line back along its own direction to where the perspective starts.
        float tE = clamp((ux - HR0) / (HR1 - HR0), 0.0, 1.0);
        float E  = tE * tE * (3.0 - 2.0 * tE);
        float dE = 6.0 * tE * (1.0 - tE) / (HR1 - HR0);

        // Height swells as the wave runs right, on its own knob — independent
        // of how much perspective its wavelength keeps.
        float ampU   = mix(HU0, ux, HSWELL);
        float amp    = A.y * ampU * uAmp * E;
        float fy     = HORIZON + HRISE + A.x * ux + amp * h;
        // Product rule across the ramp and the height blend as well, so the
        // stroke keeps an even weight through the stretch where it comes up.
        float slopeN = A.x + A.y * uAmp * ((HSWELL * E + ampU * dE) * h + ampU * E * dh);
        float mpx    = slopeN * aspect;
        float base   = y - fy;

        // The signal resolves out of the haze earlier than the field around
        // it, and clears the left-hand defocus sooner — it is the thing that
        // comes into focus first.
        float vis  = clear * smoothstep(0.16, 0.46, x);

        // Its own depth: 0 back where it converges, 1 at the front. Every
        // treatment below reads off this, so they all say the same thing.
        float hd   = smoothstep(HU0 * 0.30, HU0 * 1.45, ux);

        // Weight follows depth: a hairline where it is far away, a confident
        // stroke by the time it reaches the front. A line of even width is the
        // single thing that most makes a perspective read as flat.
        // cos of the stroke's angle: 1 where it runs flat, small where it
        // climbs. A broad-nib pen lays down less ink on the steep parts, and
        // the same modulation keeps the crests from reading heavier than the
        // long flat runs between them.
        float nib  = inversesqrt(1.0 + mpx * mpx);

        float hw   = W.x * mix(0.50, 1.30, hd) * mix(0.80, 1.06, nib) * uPx;
        // Barely any defocus, and barely any of the left-hand blur: the signal
        // is the one thing on the page that is always in focus.
        float soft = (W.y + leftBlur * 0.14) * uPx;

        float invD = uRes.y * nib;
        float bd   = base * invD;
        float sd   = (caN.y - slopeN * caN.x) * W.z * invD;

        float energy = hw / (hw + soft * 0.78);

        // Knockout: a breath of paper held either side of the stroke, so the
        // line stays legible crossing the mesh instead of tangling into it.
        // Scaled to the stroke, so it tapers away with the line.
        //
        // 0.36, down from 0.58. This is the white on the right-hand side. It
        // is applied per strand, so wherever the mesh is dense — which is the
        // whole right of the fold — dozens of these paper breaths overlap and
        // compound, and the region washes out to near paper no matter how much
        // alpha the strands themselves carry. Enough separation to keep the
        // crossings readable, not enough to bleach the bundle.
        float knock = (1.0 - smoothstep(hw * 1.15, hw * 5.20, abs(bd))) * vis;
        col = mix(col, PAPER, knock * 0.36);

        // Along its own length: Light Signal where it is still distant,
        // resolving hard into the deep green. It reaches full strength early
        // and holds it — the line states something, it does not shimmer.
        vec3 lineCol = mix(MINT, GREEN, smoothstep(0.00, 0.45, hd));
        lineCol = mix(lineCol, DEEP, smoothstep(0.10, 0.75, hd) * 0.88);

        // A whisper of bloom, constant — just enough to seat the stroke on the
        // paper. Anything more would soften the edge it is here to keep.
        vec3 gd   = abs(vec3(bd + sd, bd, bd - sd));
        vec3 glow = exp(-gd / (4.0 * uPx)) * 0.045 * vis;
        col = mix(col, mix(lineCol, MINT, 0.45), clamp(glow, 0.0, 1.0));

        float e0 = hw - soft;
        float e1 = hw + soft;
        vec3 core = SP0 * band(bd + sd,       e0, e1)
                  + SP1 * band(bd + sd * 0.5, e0, e1)
                  + SP2 * band(bd,            e0, e1)
                  + SP3 * band(bd - sd * 0.5, e0, e1)
                  + SP4 * band(bd - sd,       e0, e1);
        vec3 a    = core * (energy * vis);
        col = mix(col, lineCol, clamp(a, 0.0, 1.0));
      }

      // Paper washes back in over the copy, so anything that reaches into the
      // halo — ambient glow, the signal's bloom — settles out with the strands.
      col = mix(col, PAPER, (1.0 - clear) * CLEAR_WASH);

      // Gentle top/bottom falloff so the bundle sits in the page, not on it.
      // 0.36 rather than 0.50 — the same tone-down as CLEAR_WASH, for the same
      // reason: it is a wash toward paper, and it was costing more of the
      // animation than it was buying in seating.
      col = mix(col, PAPER, smoothstep(1.12, 1.50, abs(uv.y - uAxis) * 2.0) * 0.36);

      // Soft vignette.
      vec2 vc = (uv - 0.5) * vec2(1.0, 0.86);
      col *= 1.0 - dot(vc, vc) * 0.10;

      // Static paper grain — also dithers the gradients so they never band.
      col += (hash21(gl_FragCoord.xy) - 0.5) * 0.014;

      gl_FragColor = vec4(col, 1.0);
    }
  `;

  // ── Strand parameters (CPU) ────────────────────────────────────────
  // hash11 is reproduced here bit-exactly, emulating float32 at each step,
  // so the arrangement of strands is identical to the shader-side version.
  const f32 = Math.fround;
  const fract = (x) => f32(x - Math.floor(x));

  function hash11(p) {
    p = fract(f32(f32(p) * f32(0.1031)));
    p = f32(p * f32(p + f32(33.33)));
    p = f32(p * f32(p + p));
    return fract(p);
  }

  const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
  const mix = (a, b, t) => a + (b - a) * t;
  const smoothstep = (a, b, x) => {
    const t = clamp((x - a) / (b - a), 0, 1);
    return t * t * (3 - 2 * t);
  };

  // The field IS the noise in the palette's terms, so its strands are drawn
  // in the warm neutral family — Near-Black lifted toward Warm Architectural
  // Gray — rather than the cold slate they used to be. Accents come from the
  // two signal greens. Must match the shader constants above.
  const INK     = [0.318, 0.361, 0.345];   // #515C58 — the muted slate, darkened
  const GREEN_J = [0.247, 0.459, 0.408];   // #3F7568 Institutional Eucalyptus
  const MINT_J  = [0.498, 0.663, 0.608];   // #7FA99B Soft Sage
  const ACCENT  = [0.498, 0.663, 0.608];   // #7FA99B — accent / charts
  const PAPER_J = [0.969, 0.953, 0.925];   // #F7F3EC, must match PAPER

  // ── Accessibility signals ──────────────────────────────────────────
  // Three independent preferences, each tracked live rather than read
  // once at load — a user toggling the OS setting sees it take effect
  // immediately instead of on the next reload.
  const mqMotion   = matchMedia("(prefers-reduced-motion: reduce)");
  const mqContrast = matchMedia("(prefers-contrast: more)");
  const mqTransp   = matchMedia("(prefers-reduced-transparency: reduce)");

  let reducedMotion = mqMotion.matches;
  let moreContrast  = mqContrast.matches;
  let lessTransp    = mqTransp.matches;

  const P0 = new Float32Array(LINES * 4);
  const P1 = new Float32Array(LINES * 4);
  const P2 = new Float32Array(LINES * 4);
  const P3 = new Float32Array(LINES * 4);

  const LAST = Math.max(1, LINES - 1);

  function buildStrands() {
  for (let j = 0; j < LINES; j++) {
    const o = j * 4;
    const hero = j === HERO_I;

    const r1 = hash11(j * 1.7 + 3.1);
    const r2 = hash11(j * 2.3 + 7.7);
    const r3 = hash11(j * 3.9 + 11.3);
    const r4 = hash11(j * 5.1 + 17.9);

    // One continuous fan, horizon first. Slot order IS depth order, so the
    // loop paints far strands before near ones — painter's algorithm for
    // free. The signal sits at HERO_I, roughly mid-plane, which puts it on
    // the composition axis at the right-hand edge.
    const t = j / LAST;

    const gsel   = hash11(j * 7.31 + 2.71);
    const accent = smoothstep(0.68, 0.93, gsel);

    // Ribbon this strand belongs to. Slots are already ordered along the fan,
    // so a run of consecutive slots is a run of neighbouring streamlines.
    const band  = Math.floor(j / FIELD.VAR.chunk);
    const b1    = hash11(band * 12.99 + 4.13);
    const b2    = hash11(band * 23.71 + 9.31);
    const b3    = hash11(band * 31.17 + 15.77);
    const share = (bv, sv) => mix(bv, sv, FIELD.VAR.residual);

    // Fan angle, spaced as a power so strands bunch toward the horizon and
    // open out toward the front — even spacing would read as a hand-drawn
    // fan rather than a projection.
    const tt    = hero ? FIELD.HERO_T : t;
    const mag   = hero
      ? FIELD.HERO_SLOPE
      : mix(FIELD.SLOPE[0], FIELD.SLOPE[1], Math.pow(tt, FIELD.SPREAD)) * (1 + (r1 - 0.5) * FIELD.VAR.slope);
    const slope = -mag;   // one sign: a single plane, all of it below its horizon

    // |slope| IS depth: flat strands lie far out across the floor. Keyed to
    // the strand's place in the fan, through the same spacing curve that sets
    // its angle — normalising against the raw slope range instead would make
    // the depth cues swing every time the fan opens or closes. 1 = farthest.
    const d = clamp(1 - Math.pow(tt, FIELD.SPREAD), 0, 1);

    // Depth scale along the strand, nudged per strand so neighbours do not
    // resolve the same wavelength — the single strongest de-combing cue.
    const g   = (1 / mag) * (hero ? 1 : mix(FIELD.VAR.freq[0], FIELD.VAR.freq[1], share(b1, r2)));
    const ampVar = hero ? 1 : mix(FIELD.VAR.amp[0], FIELD.VAR.amp[1], share(b2, r3));

    const jit = [share(b1, r2), share(b2, r3), share(b3, r4)];
    const ph  = FIELD.Q.map((q, c) => q * g + (jit[c] - 0.5) * FIELD.VAR.phase);

    // ── Depth of field ──────────────────────────────────────────────
    // Six cues all keyed to the same depth d, so they reinforce rather
    // than fight: focus, size, weight, parallax, dispersion, and haze.
    const hw   = mix(0.92, 0.36, d) * mix(1.0, 1.12, accent);

    // Focus falls off with d^1.5 — the front ranks stay genuinely sharp
    // and the defocus piles up in the back, like a real wide aperture.
    const soft = mix(0.42, 2.60, Math.pow(d, 1.5)) * mix(1.0, 0.80, accent);

    // Dispersion climbs steeply with depth — near strands barely refract,
    // far ones throw a visible spectrum. Colour fringing costs legibility,
    // so high-contrast and reduced-transparency users get much less of it.
    const dispScale = moreContrast ? 0.25 : lessTransp ? 0.45 : 1.0;
    const disp = mix(0.22, 7.00, d * d) * dispScale;

    // Solve alpha from the perceived result rather than setting it raw.
    // Heavy defocus drains opacity through the energy term, so a fixed
    // alpha would make the back ranks vanish instead of going soft. We
    // state the peak opacity we want at this depth and divide it back out.
    const energy = hw / (hw + soft * 0.78);
    // Raised from 0.32/0.150. The field is the one animated thing on the page
    // and it was reading as a texture rather than as movement — measured, the
    // strongest row contributed 136 units but the mean across the fold was
    // only 13. The high-contrast branch is left alone: it is already louder,
    // and users on that setting did not ask for more.
    const peak   = moreContrast ? mix(0.50, 0.24, d) : mix(0.42, 0.205, d);
    const alpha  = clamp(peak * mix(1.0, 1.20, accent) / energy, 0, 2.4);

    // Rows crowding the horizon pick up the hero's mint, so the convergence
    // zone reads as the place the green signal resolves out of.
    const prox = Math.pow(d, 1.6);
    // Aerial perspective: distant strands wash toward the paper, the way
    // haze desaturates a far ridgeline. Cheap, and a very strong depth cue.
    // Suppressed under prefers-contrast, where washing out is the enemy.
    // 0.15 rather than 0.24: the same tone-down, one layer up. The distant
    // strands are the ones crowding the right of the fold, so washing them
    // toward paper is most of what made that side read as empty.
    const haze = (moreContrast ? 0.10 : 0.15) * d * d;
    const lc = [0, 1, 2].map((c) =>
      mix(mix(mix(INK[c], MINT_J[c], prox * 0.55), ACCENT[c], accent), PAPER_J[c], haze)
    );

    P0[o] = slope; P0[o + 1] = FIELD.AMPK * mag * (hero ? FIELD.HERO_A : ampVar); P0[o + 2] = g;
    P1[o] = ph[0]; P1[o + 1] = ph[1]; P1[o + 2] = ph[2];
    // Wider parallax separation — near strands swing far more than far
    // ones, which is the cue that resolves depth the instant you move.
    P2[o] = hw; P2[o + 1] = soft; P2[o + 2] = disp; P2[o + 3] = mix(2.70, 0.16, d);
    P3[o] = lc[0]; P3[o + 1] = lc[1]; P3[o + 2] = lc[2]; P3[o + 3] = alpha;

    // The signal keeps the plane's geometry — slope, phase and amplitude are
    // whatever its place in the fan gives it — and overrides only how it is
    // drawn: a confident stroke, in focus, in full colour, barely refracting.
    if (hero) {
      P2[o] = 1.70; P2[o + 1] = 0.50; P2[o + 2] = 0.55 * dispScale; P2[o + 3] = 1.70;
      P3[o] = GREEN_J[0]; P3[o + 1] = GREEN_J[1]; P3[o + 2] = GREEN_J[2]; P3[o + 3] = 1.0;
    }
  }
  }

  buildStrands();

  // ── GL setup ───────────────────────────────────────────────────────
  let program, buffer;
  let uRes, uPointer, uPx, uCAAmt, uCAVel, uPh, uAmp;

  function compile(type, src) {
    const sh = gl.createShader(type);
    gl.shaderSource(sh, src);
    gl.compileShader(sh);
    if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
      console.error(gl.getShaderInfoLog(sh));
      gl.deleteShader(sh);
      return null;
    }
    return sh;
  }

  function initGL() {
    const vs = compile(gl.VERTEX_SHADER, VERT);
    const fs = compile(gl.FRAGMENT_SHADER, FRAG);
    if (!vs || !fs) return false;

    program = gl.createProgram();
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);
    gl.deleteShader(vs);
    gl.deleteShader(fs);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      console.error(gl.getProgramInfoLog(program));
      return false;
    }

    gl.useProgram(program);

    const loc = (n) => gl.getUniformLocation(program, n);
    uRes     = loc("uRes");
    uPointer = loc("uPointer");
    uPx      = loc("uPx");
    uCAAmt   = loc("uCAAmt");
    uCAVel   = loc("uCAVel");
    uPh      = loc("uPh");
    uAmp     = loc("uAmp");

    // Every row is now fully static — the sheet animates through three
    // global phases, so none of these arrays is ever re-uploaded per frame.
    gl.uniform4fv(loc("uP0[0]"), P0);
    gl.uniform4fv(loc("uP1[0]"), P1);
    gl.uniform4fv(loc("uP2[0]"), P2);
    gl.uniform4fv(loc("uP3[0]"), P3);

    // The axis changes rarely (resize, font swap), so it is pushed on demand
    // rather than every frame. Re-sent here, which also covers context loss.
    const uAxis = loc("uAxis");
    pushAxis = () => {
      gl.useProgram(program);
      gl.uniform1f(uAxis, axis);
    };
    pushAxis();

    const uCopy = loc("uCopy");
    pushCopy = () => {
      gl.useProgram(program);
      gl.uniform4fv(uCopy, copyBox);
    };
    pushCopy();

    // Single full-screen triangle — no index buffer, no overdraw at the seam.
    const aPos = gl.getAttribLocation(program, "aPos");
    buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

    return true;
  }

  if (!initGL()) return;

  // ── Sizing + adaptive resolution ───────────────────────────────────
  // Resize is a viewport change only: no reallocation of intermediate
  // buffers, no CPU redraw, so dragging the window edge never stalls.
  const MAX_PIXELS = 2.6e6;   // fill-rate ceiling on large displays

  let cssW = 0, cssH = 0, needsResize = true;
  let quality = 1.0;          // adaptive multiplier on device pixel ratio

  function applySize() {
    const w = mount.clientWidth  || innerWidth;
    const h = mount.clientHeight || innerHeight;
    if (w === cssW && h === cssH && !needsResize) return;

    cssW = w;
    cssH = h;
    needsResize = false;

    let ratio = Math.min(devicePixelRatio || 1, 2) * quality;
    const px = w * h * ratio * ratio;
    if (px > MAX_PIXELS) ratio *= Math.sqrt(MAX_PIXELS / px);
    ratio = Math.max(ratio, 0.5);

    const bw = Math.max(1, Math.round(w * ratio));
    const bh = Math.max(1, Math.round(h * ratio));

    if (canvas.width !== bw || canvas.height !== bh) {
      canvas.width  = bw;
      canvas.height = bh;
    }
    gl.viewport(0, 0, bw, bh);
    gl.uniform2f(uRes, bw, bh);
    gl.uniform1f(uPx, ratio);
  }

  if (typeof ResizeObserver !== "undefined") {
    new ResizeObserver(() => { needsResize = true; }).observe(mount);
  }
  addEventListener("resize", () => { needsResize = true; }, { passive: true });
  addEventListener("orientationchange", () => { needsResize = true; }, { passive: true });

  // ── Pointer ────────────────────────────────────────────────────────
  let px = 0, py = 0, tx = 0, ty = 0;

  // Parallax runs on a real spring rather than an exponential lag, in
  // Apple's damping/response parameterisation. A lag has no velocity
  // state: it cannot carry momentum, and reversing direction hard-cuts
  // its speed to zero — the "brick wall". A spring is velocity-aware and
  // inherently interruptible, so a change of direction blends through.
  // 1.0 / 0.40 is Apple's move-and-reposition pairing (critically damped).
  const SPRING_DAMPING  = 1.0;
  const SPRING_RESPONSE = 0.40;
  const OMEGA = (2 * Math.PI) / SPRING_RESPONSE;

  // X and Y are separate springs. A single spring on 2D distance desyncs
  // as soon as the two axes carry different velocities.
  let vx = 0, vy = 0;

  // Fixed-step integration so behaviour is identical at 60 and 120Hz and
  // stays stable if a frame runs long.
  const STEP = 1 / 120;

  function springStep(h) {
    const ax = -OMEGA * OMEGA * (px - tx) - 2 * SPRING_DAMPING * OMEGA * vx;
    const ay = -OMEGA * OMEGA * (py - ty) - 2 * SPRING_DAMPING * OMEGA * vy;
    vx += ax * h; vy += ay * h;
    px += vx * h; py += vy * h;
  }

  // Apple's momentum projection: where the pointer is HEADED, not where it
  // is. Exponential decay, not the v^2/2a textbook form.
  const project = (v, decel = 0.998) => (v / 1000) * decel / (1 - decel);

  addEventListener("pointermove", (e) => {
    if (reducedMotion) return;
    tx = (e.clientX / innerWidth) * 2 - 1;
    ty = (e.clientY / innerHeight) * 2 - 1;
  }, { passive: true });

  const recentre = () => { tx = 0; ty = 0; };
  addEventListener("pointerleave", recentre, { passive: true });
  addEventListener("blur", recentre, { passive: true });

  // ── Preference changes, applied live ───────────────────────────────
  // Reduced motion means a gentler equivalent, not a dead page: the
  // composition, depth and dispersion all stay: what stops is the
  // vestibular motion — the travelling waves and the pointer parallax.
  mqMotion.addEventListener("change", (e) => {
    reducedMotion = e.matches;
    if (reducedMotion) { tx = ty = 0; px = py = 0; vx = vy = 0; }
    last = performance.now();
  });

  const rebuild = () => {
    moreContrast = mqContrast.matches;
    lessTransp   = mqTransp.matches;
    buildStrands();
    gl.useProgram(program);
    gl.uniform4fv(gl.getUniformLocation(program, "uP2[0]"), P2);
    gl.uniform4fv(gl.getUniformLocation(program, "uP3[0]"), P3);
  };
  mqContrast.addEventListener("change", rebuild);
  mqTransp.addEventListener("change", rebuild);

  // ── Loop ───────────────────────────────────────────────────────────
  let time = 6.0;   // start mid-phase so the first frame is already composed
  let last = performance.now();
  let raf  = 0;

  let ema = 16.7;   // rolling frame time, ms
  let cooldown = 1.5;

  // Retirement. Adaptive resolution has a floor — below ~0.55 the field stops
  // looking like itself — and on a machine with no usable GPU that floor is
  // not enough: measured under software rasterisation it walks 1440px down to
  // 792px over nine seconds and still lands at ~159ms a frame. A decorative
  // layer running at six frames a second is worse than no layer at all. It
  // costs battery, it makes the whole page feel broken rather than just
  // itself, and it delayed the hero headline's LCP from 1.7s to 4.7s because
  // the main thread never got quiet.
  //
  // So when the field is at its floor and still missing badly, it stops. On
  // any machine that can draw it this never fires.
  let stalled = false;
  let slowAtFloor = 0;

  function frame(now) {
    raf = requestAnimationFrame(frame);

    const raw = now - last;
    last = now;

    // Clamped delta: tab-switches and long resize stalls can't jump the phase.
    const dt = Math.min(raw / 1000, 0.05);

    // Adaptive resolution. Frame time is vsync-quantised, so >20.5ms means
    // we are actually missing frames, not merely idling at 60Hz.
    if (raw > 0 && raw < 500) ema += (raw - ema) * 0.05;

    // Wall-clock, not dt. dt is clamped to 50ms so a stalled frame cannot jump
    // the animation phase, which is right for the phase and wrong for every
    // timer built on it: at 3fps a 1.5s cooldown accrues 0.15s per real
    // second and takes ten seconds to expire. Measured, that left the canvas
    // at full resolution sixteen seconds into a load it could not sustain —
    // the adaptation starved exactly when it was needed most.
    const wall = Math.min(raw, 1000) / 1000;

    if (cooldown > 0) {
      cooldown -= wall;
    } else if (ema > 20.5 && quality > 0.55) {
      quality = Math.max(0.55, quality * 0.85);
      needsResize = true;
      cooldown = 0.8;
    } else if (ema < 12.5 && quality < 1.0) {
      quality = Math.min(1.0, quality * 1.08);
      needsResize = true;
      cooldown = 1.5;
    }

    // 45ms is ~3x the budget: not a dropped frame here and there, a machine
    // that cannot do this. Two and a half seconds of it at the floor, and the
    // field retires rather than limping.
    if (quality <= 0.5501 && ema > 45) {
      slowAtFloor += wall;
      if (slowAtFloor > 2.5) {
        stalled = true;
        // preserveDrawingBuffer is false, so a stopped loop cannot be trusted
        // to keep its last frame. Fade out deliberately and let the hero sit
        // on its own paper — which is exactly what it does with no WebGL at
        // all, and is measurably the faster page.
        canvas.classList.add("is-retired");
        sync();
        return;
      }
    } else {
      slowAtFloor = 0;
    }

    applySize();

    if (!reducedMotion) time += dt;

    // The whole sheet advances as one body: three travelling phases and a
    // single breathing scalar, instead of per-row state. Phases are wrapped
    // in double precision here so they never lose resolution, however long
    // the page stays open.
    gl.uniform3f(uPh,
      (-FIELD.W[0] * time) % TAU,
      (-FIELD.W[1] * time) % TAU,
      (-FIELD.W[2] * time) % TAU);
    gl.uniform1f(uAmp, 1 + 0.06 * Math.sin(time * 0.21));


    // Integrate the parallax springs at a fixed step.
    for (let rem = dt; rem > 0; rem -= STEP) springStep(Math.min(STEP, rem));
    gl.uniform2f(uPointer, px, py);

    // ── Chromatic aberration ─────────────────────────────────────────
    // Driven by the SPRING'S OWN velocity — one physical system, one
    // source of truth. The previous version finite-differenced an already
    // smoothed position and re-smoothed the result with hand-tuned attack
    // and release constants: velocity of a lag, lagging twice. The spring
    // carries real momentum, decays on its own, and passes cleanly through
    // zero on a reversal, so the bloom and settle come out of the physics
    // instead of being dialled in.
    const vpx = vx * innerWidth  * 0.5;   // spring velocity in px/s
    const vpy = vy * innerHeight * 0.5;

    // Aberration leads toward where the gesture is going, not where it is.
    const leadX = project(vpx) * 0.0042;
    const leadY = project(vpy) * 0.0042;

    // Resting dispersion is meaningful rather than near-zero, so the depth
    // reads even when the pointer is still; motion adds on top.
    const boost = Math.min(Math.hypot(vpx, vpy) / 900, 3.0);
    gl.uniform1f(uCAAmt, 1.15 + boost * 1.05);
    gl.uniform2f(uCAVel,
      clamp(leadX, -3.2, 3.2) + px * 0.45,
      clamp(leadY, -3.2, 3.2) + py * 0.30);

    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  // Don't burn GPU on a hidden tab or a field nobody can see; resume without
  // a phase jump, because `last` is re-stamped on the way back in.
  let lost = false;

  // The loop does not start with the script. Two reasons, and the second is
  // the one that matters:
  //
  // The canvas is opacity 0 until main.js adds .is-ready, which waits on the
  // display face — so every frame drawn before that is invisible by
  // construction. And on a machine without a usable GPU those invisible
  // frames are not free: measured under software rasterisation they held the
  // main thread through the whole paint window and pushed the hero
  // headline's LCP from 1.7s to 4.9s. The page was paying its worst
  // performance cost for pixels nobody could see.
  //
  // requestIdleCallback fires once the thread has room, which is after the
  // text has painted; the timeout caps the wait on a thread that never goes
  // quiet. Neither the API nor the uniforms are deferred — only the drawing —
  // so setAxisFromTop and setCopyBox keep working from the first frame.
  let booted = false;

  sync = () => {
    const want = booted && onscreen && !document.hidden && !lost && !stalled;
    if (want && !raf) {
      last = performance.now();
      raf = requestAnimationFrame(frame);
    } else if (!want && raf) {
      cancelAnimationFrame(raf);
      raf = 0;
    }
  };

  const boot = () => {
    if (booted) return;
    booted = true;
    last = performance.now();   // no phase jump for the time spent waiting
    sync();
  };

  if (typeof requestIdleCallback === "function") {
    requestIdleCallback(boot, { timeout: 1200 });
  } else {
    // Safari before 16.4. Two frames puts us past first paint, and the
    // timeout covers the case where frames are not being served at all.
    requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(boot, 200)));
    setTimeout(boot, 1200);
  }

  document.addEventListener("visibilitychange", sync);

  // ── Context loss ───────────────────────────────────────────────────
  canvas.addEventListener("webglcontextlost", (e) => {
    e.preventDefault();
    lost = true;
    sync();
  }, false);

  canvas.addEventListener("webglcontextrestored", () => {
    gl = canvas.getContext("webgl2", glOpts) || canvas.getContext("webgl", glOpts);
    if (!gl || !initGL()) return;
    needsResize = true;
    lost = false;
    sync();
  }, false);
})();
