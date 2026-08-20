/* ─────────────────────────────────────────────────────────────
   problem-field.js — the noise-to-signal artifact

   The section's whole argument is this one figure, so its geometry
   is computed rather than drawn. A static SVG cannot morph: the
   previous version had twenty pre-baked paths that could only fade
   and translate, which meant "chaos resolving into signal" was
   asserted by the copy and never actually shown.

   Everything here is a function of one number, p, the scroll
   progress through the pinned sequence:

     p = 0   many lines, wide as the page, each with its own
             frequency, phase and drift — a thicket
     p ~ .6  frequencies and phases converging; the thicket starts
             beating as one wave
     p = 1   a single straight line resolving to a point

   Canvas rather than SVG because at ~90 lines x ~130 samples this
   is 12k segments a frame, and re-writing that many path strings
   into the DOM every frame is what makes scroll-linked SVG stutter.
   ───────────────────────────────────────────────────────────── */
(function () {
  "use strict";

  var LINES = 90;        // strands in the bundle
  var SAMPLES = 132;     // vertical resolution of each strand
  var DPR_CAP = 2;

  // How ordered the bundle already is at p = 0. The lateral spread still
  // starts at full page width; this governs only how wild each strand's
  // own wave is, which is the part that was overcooked.
  var ORDER_FLOOR = 0.38;

  // Brand colours, as [r,g,b]. The walk runs from the near-black the
  // band sits on, through Soft Sage, to Light Signal at full order.
  var DIM = [124, 142, 136];
  var MID = [127, 169, 155];
  var LIT = [183, 214, 201];

  function mix(a, b, t) { return a + (b - a) * t; }
  function mixRGB(a, b, t) {
    return [mix(a[0], b[0], t), mix(a[1], b[1], t), mix(a[2], b[2], t)];
  }
  function rgba(c, a) {
    return "rgba(" + (c[0] | 0) + "," + (c[1] | 0) + "," + (c[2] | 0) + "," + a.toFixed(3) + ")";
  }
  function clamp01(v) { return v < 0 ? 0 : v > 1 ? 1 : v; }
  function smoothstep(t) { t = clamp01(t); return t * t * (3 - 2 * t); }
  function span(v, a, b) { return clamp01((v - a) / (b - a)); }

  // Deterministic hash. The brief asks for complex, not random — a
  // seeded generator means the thicket is the same thicket on every
  // load and every reload, so it reads as a designed object rather
  // than as noise that happens to be regenerated.
  function hash(n) {
    var x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
    return x - Math.floor(x);
  }

  // Per-strand constants, built once.
  var strand = [];
  for (var i = 0; i < LINES; i++) {
    var u = LINES === 1 ? 0.5 : i / (LINES - 1);          // 0..1 across the bundle
    var c = u * 2 - 1;                                     // -1..1, signed
    strand.push({
      u: u,
      c: c,
      // Depth drives parallax, weight and opacity together, so the
      // bundle reads as having front and back rather than being a
      // flat comb. Strands near the centre sit forward.
      depth: Math.pow(Math.abs(c), 0.85) * 0.85 + hash(i * 3.7) * 0.15,
      // Wild state: three harmonics, each with its own phase and a
      // frequency well away from its neighbours'.
      f1: 1.10 + hash(i * 1.3) * 2.60,
      f2: 2.30 + hash(i * 2.1) * 4.40,
      f3: 4.10 + hash(i * 5.9) * 7.20,
      p1: hash(i * 7.3) * Math.PI * 2,
      p2: hash(i * 11.1) * Math.PI * 2,
      p3: hash(i * 13.7) * Math.PI * 2,
      a1: 0.55 + hash(i * 17.3) * 0.75,
      a2: 0.22 + hash(i * 19.7) * 0.42,
      a3: 0.10 + hash(i * 23.1) * 0.24,
      // Lateral home across the page, eased so strands crowd slightly
      // toward the centre instead of being evenly combed.
      home: Math.sign(c) * Math.pow(Math.abs(c), 0.86),
      drift: (hash(i * 29.3) - 0.5) * 0.30,
      seed: hash(i * 31.1)
    });
  }

  // Two surfaces render this field: the pinned stage, and a slice of it
  // behind the section's opening statement. They share the strand table, so
  // the thicket over the intro is literally the top of the same object the
  // sequence below resolves — not a second, similar-looking texture.
  function Field(el, opts) {
    this.canvas = el;
    this.ctx = el.getContext("2d");
    this.W = 0; this.H = 0;
    this.progress = opts.progress || 0;
    this.queued = false;
    this.o = {
      // Which vertical span of the field this surface shows. The intro takes
      // the wide top only: include the bottom and it draws a second funnel
      // above the real one.
      t0: opts.t0 == null ? 0 : opts.t0,
      t1: opts.t1 == null ? 1 : opts.t1,
      alpha: opts.alpha == null ? 1 : opts.alpha,
      fadeTop: opts.fadeTop == null ? 0.30 : opts.fadeTop,
      fadeBottom: opts.fadeBottom || 0,
      resolved: opts.resolved !== false
    };
    // Where the closing statement sits, in canvas coordinates, and how
    // strongly to hold the field off it. Published by main.js because only
    // the DOM knows where the text actually landed.
    this.clear = null;
  }

  // The resolved line runs down the centre and the closing statement is
  // centred on it, so without this the signal draws straight through the
  // words and reads as a strikethrough. Erasing a soft box lets the line pass
  // behind the text instead — the same move the hero's field makes around its
  // own copy, so the two sections behave consistently.
  Field.prototype.setClear = function (box, strength) {
    if (!box || !(strength > 0)) {
      if (this.clear) { this.clear = null; this.schedule(); }
      return;
    }
    var c = this.clear;
    if (c && Math.abs(c.s - strength) < 0.01 &&
        Math.abs(c.x - box.x) < 1 && Math.abs(c.y - box.y) < 1 &&
        Math.abs(c.w - box.w) < 1 && Math.abs(c.h - box.h) < 1) return;
    this.clear = { x: box.x, y: box.y, w: box.w, h: box.h, s: strength };
    this.schedule();
  };

  Field.prototype.resize = function () {
    var r = this.canvas.getBoundingClientRect();
    if (!r.width || !r.height) return;
    var dpr = Math.min(DPR_CAP, window.devicePixelRatio || 1);
    this.W = r.width; this.H = r.height;
    this.canvas.width = Math.round(this.W * dpr);
    this.canvas.height = Math.round(this.H * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.draw();
  };

  Field.prototype.draw = function () {
    var ctx = this.ctx, W = this.W, H = this.H, O = this.o;
    if (!ctx || !W || !H) return;
    var p = this.progress;

    // Three separate easings off the same p. Order arrives before the
    // bundle finishes closing, so there is a stretch in the middle
    // where the strands are already beating in unison but still
    // spread — which is the "one wave" reading the brief asks for.
    // Floored, not started from zero. At order = 0 the three harmonics run at
    // full scatter and the opening reads as scribble rather than as a thicket
    // of distinguishable strands — the state that actually works is the one
    // the sequence used to reach about a third of the way in. Starting there
    // keeps the whole run inside the register that reads as complex, and
    // spends the travel on resolving rather than on calming down first.
    var order = mix(ORDER_FLOOR, 1, smoothstep(span(p, 0.04, 0.82)));
    var close = smoothstep(span(p, 0.30, 0.97));   // lateral collapse
    var flat = smoothstep(span(p, 0.72, 1.00));    // amplitude to zero
    var chaos = 1 - order;

    ctx.clearRect(0, 0, W, H);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    // Where the funnel converges. For most of the sequence that is the floor
    // of the stage, but as the closing statement arrives the point lifts to
    // sit just under it — the line resolves TO the sentence rather than
    // running past it to the section boundary. Keyed to the same measured box
    // and the same ramp as the clearance, so the two cannot disagree.
    var endY = H;
    if (this.clear) {
      endY = mix(H, Math.min(H, this.clear.y + this.clear.h + 52), this.clear.s);
    }

    var cx = W * 0.5;
    // Full page width at rest, closing to nothing. 0.46 rather than 0.5
    // keeps the outermost strands off the very edge, where a stroke
    // clipped by the canvas box reads as a cut rather than as depth.
    var half = W * 0.46 * (1 - close);
    var ampBase = H * 0.052;

    for (var i = 0; i < LINES; i++) {
      var s = strand[i];

      // Parallax: depth shifts each strand along its own wave as the
      // sequence advances, so the bundle slides through itself instead
      // of morphing in lockstep. This is the whole dynamic effect —
      // without it the resolve looks like a single object scaling.
      var par = p * (0.55 + s.depth * 1.85);

      // Frequencies converge on 1, phases on 0.
      var f1 = mix(s.f1, 1.0, order);
      var f2 = mix(s.f2, 2.0, order);
      var f3 = mix(s.f3, 3.0, order);
      var q1 = s.p1 * chaos;
      var q2 = s.p2 * chaos;
      var q3 = s.p3 * chaos;

      // Harmonics 2 and 3 die well before harmonic 1, so the thicket
      // simplifies into a sine before that sine flattens.
      var h2 = (1 - order) * (1 - order);
      var h3 = h2 * (1 - order);
      var amp = ampBase * (0.55 + s.depth * 0.85) * (1 - flat);

      ctx.beginPath();
      for (var k = 0; k < SAMPLES; k++) {
        var g = k / (SAMPLES - 1);
        var t = O.t0 + (O.t1 - O.t0) * g;     // position in the FIELD
        var y = g * endY;                     // position on this SURFACE

        // Everything converges to a point at the bottom regardless of
        // p — the bundle is a funnel, and the sequence only decides
        // how wide its mouth is. cubic so the taper is slow at the top
        // and decisive near the point.
        var taper = 1 - t * t * t;

        var phase = (t * 6.0 + par) * Math.PI;
        var w = s.a1 * h1val(f1, phase, q1) +
                s.a2 * h2 * Math.sin(f2 * phase + q2) +
                s.a3 * h3 * Math.sin(f3 * phase + q3);

        // Lateral home fans the strands across the page; drift bends
        // each one so the thicket is not a set of parallel copies.
        var home = s.home * half * taper;
        var bend = s.drift * half * 0.55 * taper * chaos * Math.sin(t * Math.PI);

        var x = cx + home + bend + w * amp * taper;
        if (k === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }

      // Near strands are heavier and brighter than far ones; the whole
      // bundle brightens and greens as it resolves.
      var lit = order * 0.55 + close * 0.45;
      var col = mixRGB(mixRGB(DIM, MID, lit), LIT, lit * lit * 0.9);
      var alpha = (0.22 + (1 - s.depth) * 0.26) * (0.55 + lit * 0.75);

      // As the bundle closes, 90 overlapping strokes would stack into a
      // slab. Fading the off-centre ones lets the middle read as one
      // line at the end rather than as a bright bar.
      alpha *= 1 - close * (0.35 + Math.abs(s.c) * 0.62);

      ctx.strokeStyle = rgba(col, alpha * O.alpha);
      ctx.lineWidth = mix(0.85, 1.5, 1 - s.depth) * (1 + close * 0.35);
      ctx.stroke();
    }

    if (O.resolved) this.drawResolved(p, order, close, flat, cx, ampBase, endY);

    // Feather the top edge. Every strand runs to y=0, so without this the
    // bundle is sliced flat by the canvas box directly under the sticky
    // masthead — a hard horizontal cut across the widest part of the figure,
    // and at the end of the sequence the resolved line reads as a bare rule
    // pinned to the bar. Erasing with a gradient costs one fill a frame,
    // where fading 90 strands individually would mean 90 gradient objects.
    ctx.globalCompositeOperation = "destination-out";

    var cl = this.clear;
    if (cl) {
      var pad = 26;
      var x = cl.x - pad, y = cl.y - pad;
      var w = cl.w + pad * 2, h = cl.h + pad * 2;
      var r = Math.min(h * 0.5, 90);
      // A blurred rounded rect where the platform has canvas filters, which is
      // every current engine; the unblurred path is a legible fallback rather
      // than a match, so it is inset to keep its harder edge off the glyphs.
      var blur = typeof ctx.filter === "string";
      if (blur) ctx.filter = "blur(22px)";
      ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(x, y, w, h, r);
      else ctx.rect(x, y, w, h);
      ctx.fillStyle = "rgba(0,0,0," + cl.s.toFixed(3) + ")";
      ctx.fill();
      if (blur) ctx.filter = "none";
    }

    if (O.fadeTop > 0) {
      var ft = ctx.createLinearGradient(0, 0, 0, H * O.fadeTop);
      ft.addColorStop(0, "rgba(0,0,0,1)");
      ft.addColorStop(0.55, "rgba(0,0,0,0.34)");
      ft.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = ft;
      ctx.fillRect(0, 0, W, H * O.fadeTop);
    }
    if (O.fadeBottom > 0) {
      var hb = H * O.fadeBottom;
      var fb = ctx.createLinearGradient(0, H - hb, 0, H);
      fb.addColorStop(0, "rgba(0,0,0,0)");
      fb.addColorStop(0.45, "rgba(0,0,0,0.34)");
      fb.addColorStop(1, "rgba(0,0,0,1)");
      ctx.fillStyle = fb;
      ctx.fillRect(0, H - hb, W, hb);
    }
    ctx.globalCompositeOperation = "source-over";
  };

  function h1val(f, phase, q) { return Math.sin(f * phase + q); }

  // The resolved line. It is not one of the 90 — it fades up out of
  // them, so the signal reads as something the noise resolves into
  // rather than as a strand that was always there.
  Field.prototype.drawResolved = function (p, order, close, flat, cx, ampBase, endY) {
    var ctx = this.ctx, H = endY;
    var vis = smoothstep(span(p, 0.34, 0.78));
    if (vis <= 0) return;

    var amp = ampBase * 1.15 * (1 - flat);
    var par = p * 1.2;

    var grad = ctx.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, rgba(MID, 0.10 + vis * 0.25));
    grad.addColorStop(0.55, rgba(mixRGB(MID, LIT, 0.5), 0.35 + vis * 0.45));
    grad.addColorStop(1, rgba(LIT, 0.55 + vis * 0.45));

    ctx.beginPath();
    for (var k = 0; k < SAMPLES; k++) {
      var t = k / (SAMPLES - 1);
      var y = t * H;
      var taper = 1 - t * t * t;
      var phase = (t * 6.0 + par) * Math.PI;
      var x = cx + Math.sin(phase) * amp * taper;
      if (k === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.strokeStyle = grad;
    ctx.lineWidth = 1.6 + vis * 1.1;
    ctx.stroke();

    // The point everything arrives at, on the last of the scroll.
    var node = smoothstep(span(p, 0.86, 1.0));
    if (node > 0) {
      var ny = H - 1;
      ctx.beginPath();
      ctx.arc(cx, ny, 9 * node, 0, Math.PI * 2);
      ctx.fillStyle = rgba(LIT, 0.16 * node);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(cx, ny, 3.4 * node, 0, Math.PI * 2);
      ctx.fillStyle = rgba(LIT, node);
      ctx.fill();
    }
  };

  Field.prototype.schedule = function () {
    var self = this;
    if (this.queued) return;
    this.queued = true;
    requestAnimationFrame(function () { self.queued = false; self.draw(); });
  };

  Field.prototype.setProgress = function (v) {
    v = clamp01(v);
    if (Math.abs(v - this.progress) < 0.0005) return;
    this.progress = v;
    this.schedule();
  };

  function create(el, opts) {
    if (!el || !el.getContext) return null;
    var f = new Field(el, opts || {});
    if (!f.ctx) return null;
    f.resize();
    addEventListener("resize", function () { f.resize(); }, { passive: true });
    if (typeof ResizeObserver === "function") {
      new ResizeObserver(function () { f.resize(); }).observe(el);
    }
    return f;
  }

  window.ProblemField = { create: create };
})();
