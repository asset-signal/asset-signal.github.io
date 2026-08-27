/* ─────────────────────────────────────────────────────────────
   main.js — page chrome: entrance reveal, wave-axis alignment,
   sticky masthead, scroll reveals, section spy, demo form.
   The background canvas is owned by signal-background.js;
   nothing here touches it beyond its published API.
   ───────────────────────────────────────────────────────────── */

(() => {
  "use strict";

  const hero = document.querySelector(".hero");
  const copy = document.querySelector(".hero__copy");
  const nav = document.querySelector("[data-nav]");
  const masthead = document.querySelector("[data-masthead]");
  const toggle = document.querySelector("[data-nav-toggle]");

  const field = window.SignalField;
  const io = "IntersectionObserver" in window;

  // ── Entrance reveal ───────────────────────────────────────
  // Staggered by source order so the eye lands on the headline first, then
  // the supporting copy, then the actions — the reading order.
  document.querySelectorAll("[data-reveal]").forEach((el, i) => {
    el.style.setProperty("--reveal-delay", `${i * 110}ms`);
  });

  // Wait for fonts before revealing: a headline that swaps typeface
  // mid-fade reads as a glitch, not a transition. Never block on it.
  const start = () => requestAnimationFrame(() => {
    alignToAxis();                          // measure with final metrics
    document.body.classList.add("is-ready");
  });

  if (document.fonts && document.fonts.ready) {
    const timeout = new Promise((res) => setTimeout(res, 900));
    Promise.race([document.fonts.ready, timeout]).then(start);
  } else {
    start();
  }

  // ── The fold ──────────────────────────────────────────────
  // Two jobs, in order.
  //
  // 1. Tell CSS how tall the masthead really is. --nav-h in base.css is
  //    computed from the masthead's own padding and logo tokens, which is
  //    right until something taller than the logo sits in the bar — the demo
  //    pill does, by about 20px. The token stays as the no-JS answer; the
  //    measurement corrects it, so the fold is exactly the viewport less the
  //    masthead instead of overflowing it.
  //
  // 2. Point the signal field at the copy. The field is a fixed viewport
  //    layer that carries its own axis, and the copy is centred in the fold
  //    by CSS. Rather than drag the copy up onto the field's nominal axis —
  //    which leaves it hard against the masthead with the whole lower half of
  //    the fold empty — the copy stays where the layout puts it and the FIELD
  //    comes to it. Decoration yields to content; the fold stays balanced at
  //    every viewport height.

  function alignToAxis() {
    if (!hero || !copy) return;

    if (masthead) {
      const h = Math.round(masthead.getBoundingClientRect().height);
      if (h) document.documentElement.style.setProperty("--nav-h", `${h}px`);
    }

    if (!field) return;

    const box = copy.getBoundingClientRect();

    // Measured as though the page were scrolled to the top, because that is
    // the only position where the alignment means anything: the field is a
    // fixed viewport layer, and the fold is what it is aligned to. Adding the
    // scroll offset back makes the result identical at any scroll position.
    const fold = box.top + window.scrollY;
    const view = window.innerHeight;

    // Lifted a little above the copy's centre rather than level with it. The
    // axis had been pinned exactly to the copy block, which meant lowering the
    // headline dragged the whole field down with it — the two are not actually
    // required to sit at the same height, and the fold reads better with the
    // bundle a touch above the text it sits beside.
    const AXIS_LIFT = 0.055;   // fraction of the viewport
    field.setAxisFromTop((fold + box.height / 2) / view - AXIS_LIFT);

    // Tell the field where the text sits, so it can clear a halo around it.
    field.setCopyBox({
      left: box.left,
      right: box.right,
      top: fold,
      height: box.height,
    });
  }

  let pending = 0;
  const scheduleAlign = () => {
    cancelAnimationFrame(pending);
    pending = requestAnimationFrame(alignToAxis);
  };

  addEventListener("resize", scheduleAlign, { passive: true });
  addEventListener("orientationchange", scheduleAlign, { passive: true });
  if (typeof ResizeObserver !== "undefined" && copy) {
    // Font swap, wrapping changes, menu open — anything that resizes the
    // block invalidates the measurement.
    new ResizeObserver(scheduleAlign).observe(copy);
  }

  // ── Scroll reveals ────────────────────────────────────────
  // Below the fold, elements settle in as they are reached rather than all
  // arriving at load. Scoped to .has-enter so the initial hidden state only
  // exists when there is something here to undo it.
  const entering = document.querySelectorAll("[data-enter]");

  if (entering.length && io) {
    document.documentElement.classList.add("has-enter");

    // Siblings that arrive together are staggered, but only for the first
    // few — a six-item row should not take a second and a half to finish.
    const seen = new Map();
    entering.forEach((el) => {
      const n = seen.get(el.parentNode) || 0;
      seen.set(el.parentNode, n + 1);
      if (n) el.style.setProperty("--enter-delay", `${Math.min(n, 5) * 85}ms`);
    });

    const reveal = new IntersectionObserver((entries, obs) => {
      entries.forEach((e) => {
        if (!e.isIntersecting) return;
        e.target.classList.add("is-in");
        obs.unobserve(e.target);            // it settles once, then it is content
      });
    }, { rootMargin: "0px 0px -10% 0px", threshold: 0 });

    entering.forEach((el) => reveal.observe(el));
  }

  // ── Demonstration section view tracking ──────────────────
  // Fires once when the product panel first enters the viewport.
  // Top of the conversion funnel — the moment a visitor sees the
  // core product illustration.
  const demoSection = document.getElementById('demonstration');
  if (demoSection && io) {
    let demoViewed = false;
    new IntersectionObserver(([e]) => {
      if (e.isIntersecting && !demoViewed) {
        demoViewed = true;
        if (window.posthog) window.posthog.capture('demonstration_section_viewed');
      }
    }, { threshold: 0.25 }).observe(demoSection);
  }

  // ── Demo CTA click tracking ───────────────────────────────
  // Catches every "Request a demo" link: hero, nav pill, footer.
  document.addEventListener('click', (e) => {
    const a = e.target.closest('a[href*="#demo"]');
    if (!a) return;
    const loc =
      a.closest('.hero') ? 'hero' :
      a.closest('[data-nav]') ? 'nav' :
      a.closest('.footer') ? 'footer' : 'page';
    if (window.posthog) window.posthog.capture('demo_cta_clicked', { location: loc });
  });


  // ── Scroll cue ────────────────────────────────────────────
  // Nudges rather than jumps: a short, deliberate move that shows the page
  // continues, instead of teleporting past the transition the fold sets up.
  const cue = document.querySelector("[data-scroll-cue]");

  if (cue) {
    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    cue.addEventListener("click", () => {
      scrollTo({ top: Math.round(window.innerHeight * 0.82), behavior: still ? "auto" : "smooth" });
      if (window.posthog) window.posthog.capture('scroll_cue_clicked');
    });

    // It is a prompt to start, so it retires as soon as the reader has.
    const retire = () => {
      if (window.scrollY > 40) cue.setAttribute("data-spent", "");
      else cue.removeAttribute("data-spent");
    };
    retire();
    addEventListener("scroll", retire, { passive: true });
  }

  // ── The problem sequence ──────────────────────────────────
  // One number does all of it. Scroll progress through the tall scroller is
  // written to --p on the stage, and CSS derives the field's resolution, the
  // node, the caption and the active step from it — so nothing can drift out
  // of step with anything else, and there is no per-property animation state
  // to keep in sync.
  const problem = document.querySelector("[data-problem]");

  if (problem) {
    const stage = problem.querySelector(".problem__stage");
    const steps = [...problem.querySelectorAll("[data-step]")];
    const canvas = problem.querySelector("[data-problem-canvas]");
    const section = problem.closest("section");
    const artifact = window.ProblemField && canvas
      ? window.ProblemField.create(canvas, { fadeTop: 0.30 })
      : null;

    // The pin is an enhancement. Anything missing, and the section renders as
    // an ordinary stack with the field already resolved.
    const canPin = stage && steps.length &&
      CSS.supports("position", "sticky") &&
      !window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (!canPin) {
      if (section) section.classList.add("problem--static");
      // Still frame: the resolved signal, not the thicket. Someone who never
      // scrolls the sequence should see what it resolves TO.
      if (artifact) artifact.setProgress(1);
    } else {
      let active = -1;
      let ticking = false;

      // Clamped here rather than in CSS: clamp() nested in calc() does not
      // resolve, which is how the old signal ended up fully drawn on frame one.
      const span = (v, a, b) => Math.min(1, Math.max(0, (v - a) / (b - a)));

      const sync = () => {
        ticking = false;
        const box = problem.getBoundingClientRect();
        // Against the stage's own height, not the viewport's. The stage is
        // pinned below the masthead and is that much shorter, so measuring the
        // travel against innerHeight overshoots by --nav-h and --p would stop
        // short of 1 — the closing step would never fully arrive.
        const travel = box.height - stage.getBoundingClientRect().height;
        if (travel <= 0) return;

        const p = Math.min(1, Math.max(0, -box.top / travel));
        stage.style.setProperty("--p", p.toFixed(4));

        // The artifact owns its own easings — --draw and --node existed to
        // drive a dash offset and a marker on the old static SVG, and there
        // is nothing left in CSS that reads them.
        if (artifact) {
          artifact.setProgress(p);

          // Hold the field off the closing statement, in step with the
          // statement arriving. Measured from the DOM rather than assumed:
          // the text is centred and balanced, so its box is whatever the
          // wrapping made it, and it differs at every viewport.
          const last = steps[steps.length - 1];
          const strength = span(p, 0.62, 0.84);
          if (last && canvas && strength > 0) {
            const c = canvas.getBoundingClientRect();
            const b = last.getBoundingClientRect();
            artifact.setClear(
              { x: b.left - c.left, y: b.top - c.top, w: b.width, h: b.height },
              strength
            );
          } else if (last) {
            artifact.setClear(null, 0);
          }
        }

        // Steps hand over in equal windows, with the last one held to the end
        // so the conclusion is still on screen when the reader leaves.
        const i = Math.min(steps.length - 1, Math.floor(p * steps.length));
        if (i !== active) {
          if (steps[active]) steps[active].classList.remove("is-active");
          steps[i].classList.add("is-active");
          active = i;
        }
      };

      const onScroll = () => {
        if (ticking) return;
        ticking = true;
        requestAnimationFrame(sync);
      };

      // Only while the sequence is on screen; a pinned section that keeps
      // measuring after the reader has left is pure cost.
      let live = false;
      new IntersectionObserver(([e]) => {
        if (e.isIntersecting === live) return;
        live = e.isIntersecting;
        if (live) { addEventListener("scroll", onScroll, { passive: true }); sync(); }
        else removeEventListener("scroll", onScroll);
      }, { threshold: 0 }).observe(problem);

      addEventListener("resize", onScroll, { passive: true });
      sync();
    }
  }

  // ── Masthead ──────────────────────────────────────────────
  // Transparent over the fold so the field runs to the top of the page;
  // a surface from the moment content starts passing underneath it.
  if (masthead) {
    let stuck = null;
    const syncMasthead = () => {
      const next = window.scrollY > 8;
      if (next === stuck) return;
      stuck = next;
      masthead.classList.toggle("is-stuck", next);
    };
    syncMasthead();
    addEventListener("scroll", syncMasthead, { passive: true });
  }

  // ── The field follows the dissolve ────────────────────────
  // The canvas is fixed, so its texture would otherwise stand still while the
  // colour ramp scrolls past it. Measured, the gradient stack alone kinks by
  // 2-3 luminance units; the unaligned field on top of it kinks by 25, and
  // that texture edge is what reads as a hard divide. Writing the ramp's
  // position into --field-fade makes the strands attenuate exactly where the
  // colour arrives, so the two move as one surface.
  const bg = document.getElementById("signal-bg");
  // The sheet rather than the band inside it: the sheet is the thing that
  // actually goes opaque over the canvas, and it is the boundary the fade has
  // to finish at. (They currently share a top edge, but the sheet is the one
  // that stays correct if the band ever gains a margin.)
  const noise = document.querySelector(".sheet");

  if (bg && noise) {
    let queued = false;

    const syncField = () => {
      queued = false;
      const top = noise.getBoundingClientRect().top;
      // Where the dark ground meets the viewport, as a percentage of it.
      const pct = Math.max(-10, Math.min(108, (top / window.innerHeight) * 100));

      bg.style.setProperty("--field-fade", `${pct.toFixed(1)}%`);
    };

    const onFieldScroll = () => {
      if (queued) return;
      queued = true;
      requestAnimationFrame(syncField);
    };

    addEventListener("scroll", onFieldScroll, { passive: true });
    addEventListener("resize", onFieldScroll, { passive: true });
    syncField();

    // Re-sync after anything that moves the boundary. Scroll and resize alone
    // are not enough: the display face loads after this runs and reflows the
    // hero by ~20px, which left the fade finishing 20px below the sheet — far
    // enough that the strands were still at 4% alpha where the sheet covered
    // them, and the field cut off in a single row until the first scroll.
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(syncField);
    }
    if (typeof ResizeObserver === "function") {
      new ResizeObserver(onFieldScroll).observe(noise);
    }
  }

  // ── How deep the scroll cue can sit in the ramp ───────────
  // The cue is white and has no disc, so it is only legible over the green
  // part of the gradient — which means as deep as possible. But "as deep as
  // possible" is bounded by the fold's bottom edge, and where that falls
  // depends on how tall the copy renders, not on the viewport alone. Both
  // numbers have to be measured; a vh guess is wrong in one direction or the
  // other at every size.
  const cueEl = document.querySelector("[data-scroll-cue]");

  if (!cueEl) {
    document.documentElement.style.setProperty("--cue-below-join", "0px");
  }

  if (cueEl && noise) {
    const GAP = 26;   // breathing room between the cue and the fold's edge

    const syncCue = () => {
      const ramp = parseFloat(
        getComputedStyle(document.documentElement).getPropertyValue("--ramp")
      ) || 0;
      // Measured from the cue's offset parent, not from the fold. `bottom` is
      // resolved against .wrap, which ends one hero padding above the fold's
      // own edge — reserving room against the fold instead left the cue that
      // much shallower than the space actually allowed.
      const base = (cueEl.offsetParent || noise).getBoundingClientRect().bottom;
      const room = window.innerHeight - base - GAP;
      // As deep as the fold allows. The cue belongs inside the gradient, not
      // perched at its lip, so it takes whatever room is left below the fold
      // rather than a fixed offset. 0.62 is a guard against a freakishly tall
      // viewport, not a tuning knob.
      const drop = Math.max(72, Math.min(ramp * 0.62, room));
      cueEl.style.setProperty("--cue-drop", `${Math.round(drop)}px`);

      // Legible, or not shown. The chevron is white with no disc and no
      // shadow — deliberately, it is the only mark on this part of the page
      // and a ring or a shadow would be the hard edge the dissolve exists to
      // avoid — so it can only be read where the ramp has actually gone
      // green. Measured, that is about a quarter of --ramp below the join:
      // at 0.27 the mark holds 3.9:1, at 0.21 it drops to 2.5, and at 0.09
      // it is 1.1 — white on near-ivory, an affordance that is technically
      // present and visually absent.
      //
      // The stylesheet already hid the cue under 720px of viewport for
      // exactly this reason. That was a guess at where the room runs out and
      // it was too low: at 768 there is still not enough. This measures the
      // condition the guess was standing in for, so it holds at any viewport
      // and against any headline length rather than at the sizes that were
      // checked by hand.
      const cueBox = cueEl.getBoundingClientRect();
      const centreDepth =
        cueBox.top + cueBox.height / 2 - noise.getBoundingClientRect().top;
      cueEl.toggleAttribute("data-no-ground", ramp > 0 && centreDepth < ramp * 0.25);

      // Publish how far the cue's bottom edge falls past the join, so the
      // problem band can hold a guaranteed clearance under it. Without this
      // the gap is not controlled by anything: the cue is placed by whatever
      // room the fold leaves, the band's top padding is a fraction of --ramp,
      // and the two drift apart independently — measured, the gap came out at
      // 99px, 104px, 79px and 39px across four viewports.
      const hidden = getComputedStyle(cueEl).display === "none";
      const below = hidden
        ? 0
        : Math.max(0, cueEl.getBoundingClientRect().bottom - noise.getBoundingClientRect().top);
      document.documentElement.style.setProperty(
        "--cue-below-join", `${Math.round(below)}px`
      );
    };

    syncCue();
    addEventListener("resize", syncCue, { passive: true });
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(syncCue);
    if (typeof ResizeObserver === "function") {
      new ResizeObserver(syncCue).observe(noise);
    }
  }

  // ── Cycle: heading + ring inside one viewport ──────────────
  // The section makes one claim — "review is a cycle" — in two parts: the
  // heading states it, the ring shows it. Split across a scroll they read
  // as two separate moments; the point is that they're the same one, which
  // only holds if both are on screen together. --ring in sections.css
  // sizes the diagram from viewport WIDTH alone (21vw), with no regard for
  // HEIGHT, so on a viewport that's short for its width (a laptop at
  // 800-900px tall, a tablet in landscape, an unmaximized window) the
  // heading-plus-ring column runs taller than the viewport and the two
  // can't both be on screen at once.
  //
  // The ring stays a large, confidently-drawn circle rather than the part
  // that gives way first: room is reclaimed from the band's own top/bottom
  // padding and the heading-to-ring gap down to a floor before the ring
  // itself is allowed to shrink past ITS floor (MIN_RING). Below 940px the
  // ring doesn't render at all (sections.css falls back to the stacked
  // list), so there's nothing to fit.
  const howSection = document.getElementById("how");
  const cycleEl = howSection && howSection.querySelector(".cycle");
  const cycleHead = howSection && howSection.querySelector(".section-head");

  if (howSection && cycleEl && cycleHead) {
    const desktopCycle = matchMedia("(min-width: 940px)");

    // Matches sections.css: .cycle's own height is `--ring * 2 + 320px` —
    // 320 is the top/bottom stage label's own reach beyond the ring's edge.
    const FIXED_REACH = 320;
    const MARGIN = 24; // breathing room so nothing sits edge-to-edge
    // MIN/MAX bound how far --ring can move. 190 gives up some of the
    // width-based clamp's own 210px floor so the heading and the full ring
    // can still share a typical laptop viewport (see the note above
    // syncCycleRing) — below ~190 the circle itself starts reading as an
    // afterthought rather than the diagram.
    const MIN_RING = 190;
    const MAX_RING = 300;
    // Floors for the three things given up before the ring is, in the
    // order they're taken: the heading-to-ring gap, the band's OWN bottom
    // padding, then its top padding. Top has the highest floor of the
    // three and is taken last — the space right under the sticky masthead
    // reads as cramped fastest, so it's the one held onto longest.
    const GAP_MIN = 28;
    const PAD_BOTTOM_MIN = 28;
    const PAD_TOP_MIN = 64;

    const syncCycleRing = () => {
      // Clear first so every measurement below reads the CSS-defined
      // responsive default for the CURRENT viewport, never a value this
      // function shrank on a previous run at a different size — without
      // this a resize sequence ratchets padding down and never recovers it.
      howSection.style.removeProperty("padding-top");
      howSection.style.removeProperty("padding-bottom");
      cycleEl.style.removeProperty("margin-top");
      cycleEl.style.removeProperty("--ring");

      if (!desktopCycle.matches) return;

      // The sticky masthead overlays the top of every scroll position, so
      // its height comes off the room available regardless of where the
      // section lands once scrolled to. alignToAxis (above) keeps --nav-h
      // current for exactly this kind of read.
      const navH = parseFloat(
        getComputedStyle(document.documentElement).getPropertyValue("--nav-h")
      ) || 0;
      const bandStyle = getComputedStyle(howSection);
      const padTop0 = parseFloat(bandStyle.paddingTop) || 0;
      const padBottom0 = parseFloat(bandStyle.paddingBottom) || 0;
      // Read off .cycle's own resolved margin-top, not the --gap-block
      // custom property — getPropertyValue on a custom property returns
      // its literal specified text ("clamp(44px, 5.4vw, 72px)"), not the
      // resolved px the cascade computed for THIS element, so parseFloat
      // on it silently becomes 0 (and every reclaim calculation with it).
      const gap0 = parseFloat(getComputedStyle(cycleEl).marginTop) || 0;
      const headH = cycleHead.getBoundingClientRect().height;

      const fixedAbove = navH + padTop0 + headH + gap0 + padBottom0 + MARGIN;
      let ring = (window.innerHeight - fixedAbove - FIXED_REACH) / 2;

      if (ring < MIN_RING) {
        // Reclaim room from the gap first (it reads as the least load-
        // bearing of the three), then the bottom padding, then the top.
        const neededPx = (MIN_RING - ring) * 2;
        const reclaimableGap = Math.max(0, gap0 - GAP_MIN);
        const reclaimablePadBottom = Math.max(0, padBottom0 - PAD_BOTTOM_MIN);
        const reclaimablePadTop = Math.max(0, padTop0 - PAD_TOP_MIN);

        let remaining = neededPx;
        const takeGap = Math.min(remaining, reclaimableGap);
        remaining -= takeGap;
        const takePadBottom = Math.min(remaining, reclaimablePadBottom);
        remaining -= takePadBottom;
        const takePadTop = Math.min(remaining, reclaimablePadTop);
        remaining -= takePadTop;

        const reclaimed = neededPx - remaining;
        if (reclaimed > 0) {
          cycleEl.style.marginTop = `${Math.round(gap0 - takeGap)}px`;
          howSection.style.paddingBottom = `${Math.round(padBottom0 - takePadBottom)}px`;
          howSection.style.paddingTop = `${Math.round(padTop0 - takePadTop)}px`;
          ring += reclaimed / 2;
        }
      }

      ring = Math.round(Math.max(MIN_RING, Math.min(MAX_RING, ring)));
      cycleEl.style.setProperty("--ring", `${ring}px`);
    };

    syncCycleRing();
    addEventListener("resize", syncCycleRing, { passive: true });
    addEventListener("orientationchange", syncCycleRing, { passive: true });
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(syncCycleRing);
    if (typeof ResizeObserver === "function") {
      new ResizeObserver(syncCycleRing).observe(cycleHead);
    }
    if (typeof desktopCycle.addEventListener === "function") {
      desktopCycle.addEventListener("change", syncCycleRing);
    } else if (typeof desktopCycle.addListener === "function") {
      // Safari < 14.
      desktopCycle.addListener(syncCycleRing);
    }
  }

  // ── Screenshot carousel ─────────────────────────────────────
  // Three real product screens, crossfaded on an interval. Autoplay pauses
  // on hover/focus (a reader examining a screenshot shouldn't have it swap
  // out from under them) and on prefers-reduced-motion it never starts at
  // all — the dots and arrows still work, so the carousel is just a
  // manually-paged set of three images at that point.
  const carousel = document.querySelector("[data-carousel]");

  if (carousel) {
    const slides = Array.from(carousel.querySelectorAll(".demo-carousel__slide"));
    const dots = Array.from(carousel.querySelectorAll("[data-carousel-dot]"));
    const prevBtn = carousel.querySelector("[data-carousel-prev]");
    const nextBtn = carousel.querySelector("[data-carousel-next]");
    const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");

    let index = Math.max(0, slides.findIndex((s) => s.classList.contains("is-active")));
    let timer = 0;

    const show = (i) => {
      index = (i + slides.length) % slides.length;
      slides.forEach((s, n) => s.classList.toggle("is-active", n === index));
      dots.forEach((d, n) => {
        d.classList.toggle("is-active", n === index);
        d.setAttribute("aria-selected", String(n === index));
      });
    };

    const stopAutoplay = () => {
      clearInterval(timer);
      timer = 0;
    };

    const startAutoplay = () => {
      stopAutoplay();
      if (reducedMotion.matches || document.hidden) return;
      timer = setInterval(() => show(index + 1), 6000);
    };

    dots.forEach((d, n) => d.addEventListener("click", () => { show(n); startAutoplay(); }));
    if (prevBtn) prevBtn.addEventListener("click", () => { show(index - 1); startAutoplay(); });
    if (nextBtn) nextBtn.addEventListener("click", () => { show(index + 1); startAutoplay(); });

    carousel.addEventListener("mouseenter", stopAutoplay);
    carousel.addEventListener("mouseleave", startAutoplay);
    carousel.addEventListener("focusin", stopAutoplay);
    carousel.addEventListener("focusout", (e) => {
      if (!carousel.contains(e.relatedTarget)) startAutoplay();
    });
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) stopAutoplay(); else startAutoplay();
    });

    // Swipe, via pointer events rather than touch-only handlers — the same
    // code path picks up a mouse drag for free. touch-action: pan-y in
    // demo.css leaves vertical page scroll to the browser and hands this
    // only the horizontal gesture, so a swipe here never fights a scroll.
    const viewport = carousel.querySelector(".demo-carousel__viewport");

    if (viewport && typeof PointerEvent !== "undefined") {
      const SWIPE_THRESHOLD = 40;
      let dragId = null;
      let startX = 0;
      let startY = 0;
      let horizontal = false;

      viewport.addEventListener("pointerdown", (e) => {
        if (e.pointerType === "mouse" && e.button !== 0) return;
        dragId = e.pointerId;
        startX = e.clientX;
        startY = e.clientY;
        horizontal = false;
        stopAutoplay();
      });

      viewport.addEventListener("pointermove", (e) => {
        if (e.pointerId !== dragId) return;
        const dx = e.clientX - startX;
        const dy = e.clientY - startY;
        // Commits to "this is a swipe, not a scroll" once the gesture is
        // clearly more horizontal than vertical, and only then claims the
        // pointer — claiming it immediately on pointerdown would also
        // swallow a vertical scroll that starts on top of the carousel.
        if (!horizontal && Math.abs(dx) > 8 && Math.abs(dx) > Math.abs(dy)) {
          horizontal = true;
          viewport.setPointerCapture(dragId);
        }
        if (horizontal) e.preventDefault();
      });

      const endDrag = (e) => {
        if (e.pointerId !== dragId) return;
        const dx = e.clientX - startX;
        dragId = null;
        if (horizontal && Math.abs(dx) > SWIPE_THRESHOLD) {
          show(dx < 0 ? index + 1 : index - 1);
        }
        startAutoplay();
      };

      viewport.addEventListener("pointerup", endDrag);
      viewport.addEventListener("pointercancel", endDrag);
    }

    startAutoplay();
  }

  // ── Demonstration: heading + screenshot inside one viewport ─
  // Same reasoning and the same technique as the cycle block above: the
  // heading states the claim ("what a review looks like prioritized") and
  // the screenshot shows it, so the two only read as one thing when both
  // are on screen together. The image's aspect ratio is fixed (all three
  // screenshots share it), so fitting it to the viewport just means
  // setting one height — see demo.css's .demo-carousel__viewport for why
  // that alone is enough to resize the whole box.
  // demoSection is already declared above (the scroll-reveal observer).
  const demoFigure = demoSection && demoSection.querySelector(".demo");
  const demoHead = demoSection && demoSection.querySelector(".section-head");
  const demoViewport = demoSection && demoSection.querySelector(".demo-carousel__viewport");
  const demoControls = demoSection && demoSection.querySelector(".demo-carousel__controls");
  // Optional: the figure has no caption right now, but the height math
  // still accounts for one (as 0px) so a caption added back later doesn't
  // require touching this function.
  const demoCaption = demoSection && demoSection.querySelector(".demo__caption");
  const demoPanel = demoSection && demoSection.querySelector(".demo__panel");

  if (demoSection && demoFigure && demoHead && demoViewport && demoControls && demoPanel) {
    const desktopDemo = matchMedia("(min-width: 940px)");

    const MIN_H = 270; // floor below which the screenshot stops being legible
    const MAX_H = 640; // ceiling — a larger, still-framed screenshot rather
                        // than one blown up to fill the available height
    const MARGIN = 16;
    // Same priority order and floors as the cycle block, for the same
    // reason: gap, then bottom padding, then top padding, with top given
    // the highest floor of the three and taken last.
    const GAP_MIN = 28;
    const PAD_BOTTOM_MIN = 28;
    const PAD_TOP_MIN = 64;

    const syncDemoHeight = () => {
      demoSection.style.removeProperty("padding-top");
      demoSection.style.removeProperty("padding-bottom");
      demoFigure.style.removeProperty("margin-top");
      demoViewport.style.removeProperty("height");

      if (!desktopDemo.matches) return;

      const navH = parseFloat(
        getComputedStyle(document.documentElement).getPropertyValue("--nav-h")
      ) || 0;
      const bandStyle = getComputedStyle(demoSection);
      const padTop0 = parseFloat(bandStyle.paddingTop) || 0;
      const padBottom0 = parseFloat(bandStyle.paddingBottom) || 0;
      const gap0 = parseFloat(getComputedStyle(demoFigure).marginTop) || 0;
      const headH = demoHead.getBoundingClientRect().height;
      const controlsMarginTop = parseFloat(getComputedStyle(demoControls).marginTop) || 0;
      const controlsH = demoControls.getBoundingClientRect().height + controlsMarginTop;
      const captionMarginTop = demoCaption
        ? parseFloat(getComputedStyle(demoCaption).marginTop) || 0
        : 0;
      const captionH = demoCaption ? demoCaption.getBoundingClientRect().height : 0;
      // The panel's own border, read back rather than hardcoded — robust to
      // demo.css changing border-width without this drifting out of sync.
      const panelBorders = demoPanel.offsetHeight - demoPanel.clientHeight;

      const fixedAbove = navH + padTop0 + headH + gap0 + padBottom0 + MARGIN;
      const fixedBelowImage = controlsH + panelBorders + captionMarginTop + captionH;

      let h = window.innerHeight - fixedAbove - fixedBelowImage;

      if (h < MIN_H) {
        const neededPx = MIN_H - h;
        const reclaimableGap = Math.max(0, gap0 - GAP_MIN);
        const reclaimablePadBottom = Math.max(0, padBottom0 - PAD_BOTTOM_MIN);
        const reclaimablePadTop = Math.max(0, padTop0 - PAD_TOP_MIN);

        let remaining = neededPx;
        const takeGap = Math.min(remaining, reclaimableGap);
        remaining -= takeGap;
        const takePadBottom = Math.min(remaining, reclaimablePadBottom);
        remaining -= takePadBottom;
        const takePadTop = Math.min(remaining, reclaimablePadTop);
        remaining -= takePadTop;

        const reclaimed = neededPx - remaining;
        if (reclaimed > 0) {
          demoFigure.style.marginTop = `${Math.round(gap0 - takeGap)}px`;
          demoSection.style.paddingBottom = `${Math.round(padBottom0 - takePadBottom)}px`;
          demoSection.style.paddingTop = `${Math.round(padTop0 - takePadTop)}px`;
          h += reclaimed;
        }
      }

      h = Math.round(Math.max(MIN_H, Math.min(MAX_H, h)));
      demoViewport.style.height = `${h}px`;
    };

    syncDemoHeight();
    addEventListener("resize", syncDemoHeight, { passive: true });
    addEventListener("orientationchange", syncDemoHeight, { passive: true });
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(syncDemoHeight);
    if (typeof ResizeObserver === "function") {
      new ResizeObserver(syncDemoHeight).observe(demoHead);
    }
    if (typeof desktopDemo.addEventListener === "function") {
      desktopDemo.addEventListener("change", syncDemoHeight);
    } else if (typeof desktopDemo.addListener === "function") {
      // Safari < 14.
      desktopDemo.addListener(syncDemoHeight);
    }
  }

  // ── The field is only worth drawing while it is visible ───
  // Everything below the fold sits on an opaque sheet, so once the hero has
  // scrolled away the canvas is painting into a covered layer. Stop it.
  if (hero && io && field && field.setVisible) {
    new IntersectionObserver(
      ([e]) => field.setVisible(e.isIntersecting),
      { threshold: 0 }
    ).observe(hero);
  }

  // ── Section spy ───────────────────────────────────────────
  // Reports where the reader is. Resolved from scroll position rather than
  // intersection ratios: sections here differ in height by a factor of three,
  // and ratio-based spies hand the answer to whichever one is tallest.
  const links = Array.from(document.querySelectorAll(".nav__links a[href^='#']"));
  const targets = links
    .map((a) => ({ link: a, el: document.querySelector(a.getAttribute("href")) }))
    .filter((t) => t.el);

  if (targets.length) {
    let current = null;
    const syncSpy = () => {
      const line = window.innerHeight * 0.32;
      let found = null;
      targets.forEach((t) => {
        const r = t.el.getBoundingClientRect();
        if (r.top <= line && r.bottom > line) found = t.link;
      });
      if (found === current) return;
      if (current) current.removeAttribute("aria-current");
      if (found) found.setAttribute("aria-current", "true");
      current = found;
    };

    let spyPending = 0;
    const scheduleSpy = () => {
      if (spyPending) return;
      spyPending = requestAnimationFrame(() => { spyPending = 0; syncSpy(); });
    };
    syncSpy();
    addEventListener("scroll", scheduleSpy, { passive: true });
    addEventListener("resize", scheduleSpy, { passive: true });
  }

  // ── Mobile nav ────────────────────────────────────────────
  if (nav && toggle) {
    const setOpen = (open) => {
      nav.classList.toggle("is-open", open);
      if (masthead) masthead.classList.toggle("is-open", open);
      toggle.setAttribute("aria-expanded", String(open));
      // The name says what the press will do, not what the thing is. A control
      // called "Toggle menu" in both states makes a screen reader announce the
      // same words whether it is about to open or close.
      toggle.setAttribute("aria-label", open ? "Close menu" : "Open menu");
    };

    toggle.addEventListener("click", () => {
      const open = !nav.classList.contains("is-open");
      setOpen(open);
      // Move focus into the panel it just revealed. The links sit BEFORE the
      // toggle in source order — the grid places them below it visually, but
      // tab order follows the DOM — so tabbing on from the toggle walked past
      // the menu into the hero. Opening a menu you then cannot reach by
      // keyboard is worse than not opening it.
      if (open) {
        const firstLink = nav.querySelector(".nav__links a");
        if (firstLink) firstLink.focus();
      }
    });

    // Following a link should close the panel, including same-page anchors
    // where no navigation event fires.
    nav.querySelectorAll("a").forEach((a) => {
      a.addEventListener("click", () => setOpen(false));
    });

    document.addEventListener("keydown", (e) => {
      // Escape returns focus to the control that opened the panel, otherwise
      // focus is left inside a menu that is no longer on screen.
      if (e.key === "Escape" && nav.classList.contains("is-open")) {
        setOpen(false);
        toggle.focus();
      }
    });
  }

  // ── Demo form ─────────────────────────────────────────────
  // The action attribute is the source of truth. Empty means no endpoint has
  // been wired yet, and the form says so plainly rather than pretending. Once
  // a URL is in action="", this posts with fetch so failures can be reported
  // in place, with the visitor's input still on screen, instead of navigating
  // to whatever the endpoint happens to render.
  const form = document.querySelector("[data-demo-form]");
  const status = document.querySelector("[data-form-status]");

  if (form) {
    const button = form.querySelector("[data-submit]");
    const label = form.querySelector("[data-submit-label]");
    const labelText = label ? label.textContent : "";
    const trap = form.querySelector('[name="_gotcha"]');
    const subject = form.querySelector("[data-subject]");
    const sent = document.querySelector("[data-sent]");
    const sentTitle = document.querySelector("[data-sent-title]");
    const sendAgain = document.querySelector("[data-send-again]");
    let sending = false;

    // Native validation is the no-JS fallback. Now that JS is running we take
    // over, so the browser's bubbles don't fire before our own messages land.
    form.setAttribute("novalidate", "");

    // Track the first time a visitor engages with the form.
    let formStarted = false;
    form.addEventListener('focusin', () => {
      if (formStarted) return;
      formStarted = true;
      if (window.posthog) window.posthog.capture('demo_form_started');
    });

    const say = (text, state) => {
      if (!status) return;
      status.textContent = text;
      if (state) status.setAttribute("data-state", state);
      else status.removeAttribute("data-state");
    };

    const fieldError = (input, message) => {
      const el = document.getElementById(`${input.id}-error`);
      if (!el) return;
      el.textContent = message || "";
      el.hidden = !message;
      input.setAttribute("aria-invalid", message ? "true" : "false");
    };

    // Name the field and the fix, not "the highlighted fields".
    const problem = (input) => {
      const name = (form.querySelector(`label[for="${input.id}"]`) || {}).firstChild;
      const what = name ? name.textContent.trim().toLowerCase() : "this field";
      if (input.validity.valueMissing) return `Add your ${what} to continue.`;
      if (input.validity.typeMismatch && input.type === "email")
        return "That does not look like an email address — check for a typo.";
      if (input.validity.tooLong) return `That ${what} is too long.`;
      return `Check the ${what} field.`;
    };

    const validate = () => {
      const fields = [...form.querySelectorAll("input, select, textarea")]
        .filter((el) => !el.name.startsWith("_"));
      let first = null;
      fields.forEach((el) => {
        const ok = el.checkValidity();
        fieldError(el, ok ? "" : problem(el));
        if (!ok && !first) first = el;
      });
      return first;
    };

    const setSending = (on) => {
      sending = on;
      if (button) button.disabled = on;
      if (label) label.textContent = on ? "Sending…" : labelText;
    };

    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      if (sending) return;                       // no double submits

      const first = validate();
      if (first) {
        first.focus();
        say("Some details are missing — see the notes below the fields.", "error");
        if (window.posthog) window.posthog.capture('demo_form_error', { error_type: 'validation' });
        return;
      }

      // A filled trap is a bot. Behave exactly like success so it learns nothing.
      if (trap && trap.value) { say("Thank you — we will be in touch."); form.reset(); return; }

      // The placeholder id is not an endpoint. Treating it as one would turn
      // "nobody has wired this up" into "your message failed to send", which is
      // a different and much worse thing to tell someone.
      const endpoint = form.getAttribute("action");
      if (!endpoint || endpoint.includes("YOUR_FORM_ID")) {
        say("This form is not connected yet, so nothing was sent. Please email us " +
            "directly and we will reply within one business day.", "error");
        return;
      }

      // A subject line that names the company makes the inbox scannable.
      if (subject) {
        const co = (form.querySelector("#f-company") || {}).value;
        subject.value = co ? `Asset Signal — demo request from ${co.trim()}` : "Asset Signal — demo request";
      }

      setSending(true);
      say("Sending…");

      // Ten seconds, then give up and say so — a request that hangs forever
      // looks identical to one that was never sent.
      const abort = new AbortController();
      const timer = setTimeout(() => abort.abort(), 10000);

      try {
        // Accept: application/json is what makes Formspree answer with JSON
        // instead of redirecting to its own thank-you page.
        const res = await fetch(endpoint, {
          method: "post",
          body: new FormData(form),
          headers: { Accept: "application/json" },
          signal: abort.signal,
        });

        // Parsed defensively: Formspree returns {errors:[{field,message}]} for
        // validation, {error:"..."} for some failures, and occasionally no JSON
        // at all. Any of those must still produce a sentence a person can act on.
        let payload = null;
        try { payload = await res.json(); } catch { /* not JSON; fall through */ }

        if (!res.ok) {
          const list = payload && Array.isArray(payload.errors) ? payload.errors : [];

          // Put Formspree's field-level complaints on the fields themselves.
          let placed = null;
          list.forEach((item) => {
            const el = item && item.field && form.elements[item.field];
            if (el && el.id) {
              fieldError(el, item.message || "That value was not accepted.");
              if (!placed) placed = el;
            }
          });

          if (placed) {
            placed.focus();
            say("Some details were not accepted — see the notes below the fields.", "error");
          } else {
            const detail = (payload && (payload.error || (list[0] && list[0].message))) || "";
            say(res.status === 429
              ? "Too many requests just now. Wait a moment and press Request a demo again."
              : `That did not send${detail ? ` — ${detail.replace(/\.$/, "")}` : ""}. Your details are still here — press Request a demo to try again.`,
              "error");
          }
          if (window.posthog) window.posthog.capture('demo_form_error', { error_type: res.status === 429 ? 'rate_limited' : 'http_error', http_status: res.status });
          return;
        }

        const submittedRole = (form.querySelector('#f-role') || {}).value || '';
        if (window.posthog) window.posthog.capture('demo_form_submitted', { role: submittedRole });
        form.reset();
        [...form.querySelectorAll("input, select, textarea")].forEach((el) => fieldError(el, ""));
        say("");

        // A cleared form and a sentence underneath reads as "nothing happened".
        // Swap the form out for the confirmation, and move focus to it so the
        // outcome is announced instead of leaving focus on a vanished control.
        if (sent && sentTitle) {
          form.hidden = true;
          sent.hidden = false;
          sentTitle.focus();
        } else {
          say("Thank you — we have your details and will be in touch within one business day.");
        }
      } catch (err) {
        // The input is still on screen, so the recovery is to press it again.
        say(err.name === "AbortError"
          ? "That took too long. Your details are still here — press Request a demo to try again."
          : "Something went wrong sending that. Your details are still here — press Request a demo to try again.",
          "error");
        if (window.posthog) window.posthog.capture('demo_form_error', { error_type: err.name === 'AbortError' ? 'timeout' : 'network_error' });
      } finally {
        clearTimeout(timer);
        setSending(false);
      }
    });

    if (sendAgain && sent) {
      sendAgain.addEventListener("click", () => {
        sent.hidden = true;
        form.hidden = false;
        const first = form.querySelector("#f-name");
        if (first) first.focus();
      });
    }

    // Clear a field's error the moment it becomes valid, not on the next submit.
    form.addEventListener("input", (e) => {
      const el = e.target;
      if (el.getAttribute("aria-invalid") === "true" && el.checkValidity()) fieldError(el, "");
    });
  }
})();
