/* NFL Player Compare: motion. Pages slide in with a short stagger and headline numbers count up when they come into
   view. Everything starts from its finished state in the markup, so with motion turned off (or no JavaScript) the
   page is simply complete. Respects the "reduce motion" setting. */
(function () {
  'use strict';
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)');
  function still() { return reduce && reduce.matches; }

  // cards and sections that rise in, in reading order, when a page opens
  var ENTER = '.tv-hero, .mo-head, .hm-tick, .hm-lead, .hm-story, .hm-sec, .hm-pc, .hm-hist, .hm-promo, .gsec, .gcard, .tv-card, .mo-card, .pcard, .sc, .tabs, .filters';
  function enter(root) {
    if (!root || still()) return;
    var items = root.querySelectorAll(ENTER), n = 0;
    Array.prototype.forEach.call(items, function (el) {
      var r = el.getBoundingClientRect();
      if (r.top > window.innerHeight * 1.2) return; // only what's on screen; the rest is already in place
      el.classList.remove('rise');
      void el.offsetWidth; // restart the animation
      el.style.setProperty('--d', Math.min(n++, 12) * 45 + 'ms');
      el.classList.add('rise');
    });
  }

  // numbers count up from zero to the value already written in the element
  function parse(txt) {
    var m = /^([^\d−-]*)([−-]?)([\d,]*\.?\d+)(.*)$/.exec(String(txt).trim());
    if (!m) return null;
    var raw = m[3].replace(/,/g, ''), dec = (raw.split('.')[1] || '').length;
    return { pre: m[1], neg: m[2], v: parseFloat(raw), dec: dec, comma: m[3].indexOf(',') >= 0, post: m[4] };
  }
  function fmt(p, v) {
    var s = v.toFixed(p.dec);
    if (p.comma) s = Number(s).toLocaleString('en-US', { minimumFractionDigits: p.dec, maximumFractionDigits: p.dec });
    return p.pre + p.neg + s + p.post;
  }
  function run(el) {
    var p = parse(el.textContent);
    if (!p || !(p.v > 0)) return;
    var final = el.textContent, t0 = null, dur = 650 + Math.min(500, p.v / 50);
    function step(ts) {
      if (t0 === null) t0 = ts;
      var k = Math.min(1, (ts - t0) / dur), e = 1 - Math.pow(1 - k, 3);
      el.textContent = k < 1 ? fmt(p, p.v * e) : final;
      if (k < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }
  var io = 'IntersectionObserver' in window ? new IntersectionObserver(function (es) {
    es.forEach(function (e) { if (e.isIntersecting) { io.unobserve(e.target); run(e.target); } });
  }, { threshold: 0.4 }) : null;
  var COUNT = '.hm-lteam b, .hm-pbig b, .hm-lv, .kstats dd, .gts, .gdteam b, .sc .big';
  function count(root) {
    if (!root || still() || !io) return;
    Array.prototype.forEach.call(root.querySelectorAll(COUNT), function (el) {
      if (el.dataset.counted) return;
      el.dataset.counted = '1';
      io.observe(el);
    });
  }
  function play(root) { enter(root); count(root); }
  window.NFLMotion = { play: play, enter: enter, count: count, still: still };
})();
