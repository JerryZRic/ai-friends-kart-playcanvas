/* Inlined into each cold entry by scripts/sync-brand-intro.mjs, before spa.ts.
 * The clock belongs to this document, never to a lazy module or SPA scene. */
(function () {
  if (window.__timewishIntro) return;
  var overlay = document.getElementById('brand-intro');
  var startedAt = performance.now();
  var reduced = !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  var done = !overlay, readyAt = null, timer = 0, frame = 0;
  var fadeStart = 0, fadeEnd = 0, fadeFrom = 1, slow = false;
  var subscribers = new Set();
  function elapsed() { return Math.max(0, performance.now() - startedAt); }
  function clearWork() { clearTimeout(timer); cancelAnimationFrame(frame); timer = frame = 0; }
  function finish() {
    if (done) return;
    done = true; clearWork();
    document.removeEventListener('visibilitychange', update);
    window.removeEventListener('pageshow', update);
    window.removeEventListener('pagehide', pagehide);
    overlay.remove();
    document.querySelector('[data-brand-intro-style]')?.remove();
    subscribers.forEach(function (callback) { callback(); });
    subscribers.clear();
  }
  function opacityAt(now) { return fadeFrom * Math.max(0, Math.min(1, (fadeEnd - now) / (fadeEnd - fadeStart))); }
  function update() {
    if (done) return;
    clearWork();
    var now = elapsed();
    // Wall-clock deadlines still apply while a tab is hidden or restored.
    if (now >= (reduced ? 800 : 3250)) { finish(); return; }
    if (!reduced) {
      if (!fadeEnd) {
        if (readyAt !== null && readyAt <= 2250 && now >= Math.max(1500, readyAt)) {
          fadeStart = Math.max(1500, readyAt); fadeEnd = fadeStart + 750;
        } else if (now >= 2250) {
          fadeStart = 2250; fadeEnd = 3250; slow = true;
        }
      }
      if (fadeEnd) {
        var opacity = opacityAt(now);
        if (slow && readyAt !== null) {
          // Continue from the sampled opacity. Never restart a fade or extend
          // its original deadline, including readiness in the final 150 ms.
          var remaining = Math.min(fadeEnd - now, Math.max(150, opacity * 750));
          fadeFrom = opacity; fadeStart = now; fadeEnd = now + remaining; slow = false;
        }
        if (now >= fadeEnd) { finish(); return; }
        overlay.style.opacity = String(opacity);
      }
    }
    overlay.dataset.introPhase = reduced ? 'static' : fadeEnd ? 'fade-out' : now < 750 ? 'fade-in' : 'hold';
    var next = reduced ? 800 : fadeEnd || (readyAt !== null ? Math.max(1500, readyAt) : now < 750 ? 750 : 2250);
    timer = setTimeout(update, Math.max(0, next - now));
    if (fadeEnd && !document.hidden) frame = requestAnimationFrame(update);
  }
  function ready() {
    if (done || readyAt !== null) return;
    readyAt = elapsed(); update();
  }
  function pagehide(event) { if (!event.persisted) finish(); else clearWork(); }
  window.__timewishIntro = {
    startedAt: startedAt,
    isPending: function () { return !done; },
    ready: ready,
    finish: finish,
    subscribe: function (callback) {
      if (done) callback(); else subscribers.add(callback);
      return function () { subscribers.delete(callback); };
    }
  };
  if (!done) {
    // CSS is a bounded fallback if inline JavaScript is disabled. The runtime
    // alone owns the overlay opacity once it starts; the logo only fades in.
    overlay.style.animation = 'none';
    document.addEventListener('visibilitychange', update);
    window.addEventListener('pageshow', update);
    window.addEventListener('pagehide', pagehide);
    update();
  }
})();
