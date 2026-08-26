/* ─────────────────────────────────────────────────────────────
   lost-signal.js — the 404 easter egg

   Triggers the CSS glitch on the "404" numeral (css/legal.css,
   .is-glitching) for a short burst every few seconds, on a random
   interval so it never settles into a predictable tick. The
   animation itself is pure CSS — this file only owns the timing.

   Under prefers-reduced-motion, the class is never added and the
   number just sits there, calm.
   ───────────────────────────────────────────────────────────── */

(() => {
  "use strict";

  const el = document.querySelector("[data-lost-signal]");
  if (!el) return;

  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  if (reduceMotion.matches) return;

  const BURST_MS = [220, 420];   // how long one glitch burst lasts
  const GAP_MS = [2200, 5200];   // quiet time between bursts

  const rand = ([min, max]) => min + Math.random() * (max - min);

  // A backgrounded tab just skips the burst and reschedules — no separate
  // visibility-change wiring needed since this already checks each tick.
  function scheduleNext() {
    setTimeout(() => {
      if (!document.hidden) {
        el.classList.add("is-glitching");
        setTimeout(() => el.classList.remove("is-glitching"), rand(BURST_MS));
      }
      scheduleNext();
    }, rand(GAP_MS));
  }

  scheduleNext();
})();
