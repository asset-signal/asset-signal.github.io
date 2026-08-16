/* ─────────────────────────────────────────────────────────────
   main.js — page chrome: entrance reveal, wave-axis alignment,
   mobile nav. The background canvas is owned by
   signal-background.js; nothing here touches it.
   ───────────────────────────────────────────────────────────── */

(() => {
  "use strict";

  const hero = document.querySelector(".hero");
  const copy = document.querySelector(".hero__copy");
  const nav = document.querySelector("[data-nav]");
  const toggle = document.querySelector("[data-nav-toggle]");

  // ── Entrance reveal ───────────────────────────────────────
  // Staggered by source order so the eye lands on the headline first, then
  // the supporting copy, then the actions — the reading order.
  const revealed = document.querySelectorAll("[data-reveal]");
  revealed.forEach((el, i) => {
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

  // ── Wave-axis alignment ───────────────────────────────────
  // The signal field is a fixed viewport layer that publishes its reference
  // line as a fraction of the viewport. The hero copy is centred inside its
  // own box, which sits below the masthead, so the two references drift apart
  // as the viewport height changes. Measure the gap, hand it to CSS.
  //
  // Read the axis ONCE, as the design target: the field can be nudged later
  // to meet a clamped copy, and re-reading it then would make each pass chase
  // the last one down the page. The fallback covers a missing background.
  const AXIS = (window.SignalField && window.SignalField.axisFromTop) || 0.45;
  const EDGE = 14;        // px of clearance kept from the masthead and the page edge

  function alignToAxis() {
    if (!hero || !copy) return;

    // Measure unshifted, otherwise each pass compounds the last one.
    copy.style.setProperty("--hero-axis-shift", "0px");

    const box = copy.getBoundingClientRect();
    const wanted = window.innerHeight * AXIS - (box.top + box.height / 2);

    // Never let the alignment push the copy into the masthead above, or off
    // the bottom of the page below.
    const top = nav ? nav.getBoundingClientRect().bottom : 0;
    const bottom = window.innerHeight;
    const room = {
      up: Math.min(0, top + EDGE - box.top),
      down: Math.max(0, bottom - EDGE - (box.top + box.height)),
    };

    const shift = Math.max(room.up, Math.min(room.down, wanted));
    copy.style.setProperty("--hero-axis-shift", `${Math.round(shift)}px`);

    if (window.SignalField) {
      // Short viewports: the copy runs out of room before it reaches the axis.
      // Rather than leave the two visibly apart, bring the field to the copy —
      // a no-op whenever the copy made it all the way.
      const landed = box.top + Math.round(shift) + box.height / 2;
      window.SignalField.setAxisFromTop(landed / window.innerHeight);

      // Tell the field where the text actually ended up, so it can clear a
      // halo around it. Reported at the shifted position, not the measured one.
      window.SignalField.setCopyBox({
        left: box.left,
        right: box.right,
        top: box.top + Math.round(shift),
        height: box.height,
      });
    }
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

  // ── Mobile nav ────────────────────────────────────────────
  if (nav && toggle) {
    const setOpen = (open) => {
      nav.classList.toggle("is-open", open);
      toggle.setAttribute("aria-expanded", String(open));
    };

    toggle.addEventListener("click", () => {
      setOpen(!nav.classList.contains("is-open"));
    });

    // Following a link should close the panel, including same-page anchors
    // where no navigation event fires.
    nav.querySelectorAll("a").forEach((a) => {
      a.addEventListener("click", () => setOpen(false));
    });

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") setOpen(false);
    });
  }
})();
