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


  // ── Scroll cue ────────────────────────────────────────────
  // Nudges rather than jumps: a short, deliberate move that shows the page
  // continues, instead of teleporting past the transition the fold sets up.
  const cue = document.querySelector("[data-scroll-cue]");

  if (cue) {
    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    cue.addEventListener("click", () => {
      scrollTo({ top: Math.round(window.innerHeight * 0.82), behavior: still ? "auto" : "smooth" });
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
    const wave = problem.querySelector(".figure__signal");
    const section = problem.closest("section");

    // The pin is an enhancement. Anything missing, and the section renders as
    // an ordinary stack with the field already resolved.
    const canPin = stage && steps.length &&
      CSS.supports("position", "sticky") &&
      !window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (!canPin) {
      if (section) section.classList.add("problem--static");
    } else {
      if (wave && typeof wave.getTotalLength === "function") {
        const len = wave.getTotalLength();
        // Units matter: calc(<number> * …) is rejected where a <length> is
        // expected, which silently left the stroke fully drawn.
        if (len) wave.style.setProperty("--dash", `${Math.ceil(len)}px`);
      }

      let active = -1;
      let ticking = false;

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

        // Clamped here, not in CSS: clamp() nested in calc() did not resolve
        // and left the signal fully drawn from the first frame.
        const span = (v, a, b) => Math.min(1, Math.max(0, (v - a) / (b - a)));
        stage.style.setProperty("--draw", span(p, 0.06, 0.70).toFixed(4));
        stage.style.setProperty("--node", span(p, 0.72, 0.88).toFixed(4));

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
      // Room-bound, not ramp-bound. Capping at a FRACTION of the ramp was
      // self-defeating: shortening the ramp brings the green up the page, but
      // it pulled the cue up by the same proportion, so the ground under the
      // cue never changed. Swept across five ramp lengths, white never cleared
      // 2.4:1. The cue simply goes as deep as the fold allows; 0.62 is a guard
      // against a freakishly tall viewport, not a tuning knob.
      const drop = Math.max(72, Math.min(ramp * 0.62, room));
      cueEl.style.setProperty("--cue-drop", `${Math.round(drop)}px`);

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
          return;
        }

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
