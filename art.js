/* Original artwork for NFL Player Compare, drawn in code: team-colored helmets, a stadium scene and confetti.
   No team logos or photos; helmets use only team colors and abbreviations. */
(function () {
  'use strict';
  var T = window.TCore;
  var FRANCHISE = { OAK: 'LV', SD: 'LAC', STL: 'LA' };

  function hex(c) { c = String(c || '#777').replace('#', ''); if (c.length === 3) c = c.replace(/./g, '$&$&'); return [0, 2, 4].map(function (i) { return parseInt(c.substr(i, 2), 16) || 0; }); }
  function lum(c) { var v = hex(c).map(function (x) { x /= 255; return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4); }); return 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2]; }
  function contrast(a, b) { var x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function colorsFor(code) {
    var t = T && T.byAbbr.get(FRANCHISE[code] || code);
    return t != null ? [T.teams[t][4], T.teams[t][5]] : ['#5b6470', '#c9cdd2'];
  }

  var uid = 0;
  // Side view of a football helmet facing right, in the team's colors with its abbreviation on the shell.
  function helmet(code, opts) {
    opts = opts || {};
    var c = opts.colors || colorsFor(code), shell = c[0], trim = c[1];
    if (contrast(shell, trim) < 1.6) trim = lum(shell) > 0.4 ? '#1d1d1d' : '#ffffff';
    var text = contrast(shell, trim) >= 2.5 ? trim : (lum(shell) > 0.4 ? '#111' : '#fff');
    var label = opts.label != null ? opts.label : code;
    var id = 'hg' + (++uid);
    var size = label.length > 3 ? 12 : label.length === 3 ? 15 : 18;
    return '<svg class="helmet" viewBox="0 0 104 80" role="img" aria-label="' + esc((opts.title || code) + ' helmet') + '">' +
      '<defs><radialGradient id="' + id + '" cx="38%" cy="28%" r="75%"><stop offset="0" stop-color="#fff" stop-opacity=".55"/><stop offset=".35" stop-color="#fff" stop-opacity=".08"/><stop offset="1" stop-color="#000" stop-opacity=".28"/></radialGradient></defs>' +
      // opts.left mirrors the helmet (not its lettering) so a home team can face the visitors
      (opts.left ? '<g transform="translate(104 0) scale(-1 1)">' : '<g>') +
      // facemask (behind the shell edge)
      '<g fill="none" stroke="#b9bec4" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"><path d="M80 44 H99 V66 H76"/><path d="M78 55 H99"/><path d="M90 44 V66"/></g>' +
      // shell
      '<path d="M14 50 C10 27 28 8 54 8 C79 8 94 24 94 43 V47 C94 51 91 53 87 53 H72 L69 64 C62 69 52 71 42 70 C26 69 16 62 14 50 Z" fill="' + shell + '"/>' +
      // center stripe over the crown
      '<path d="M22 26 C33 12 52 7 70 10 C79 12 86 17 90 24" fill="none" stroke="' + trim + '" stroke-width="5" stroke-linecap="round"/>' +
      // jaw pad and ear hole
      '<path d="M44 63 C52 64 60 62 66 58 L68 52" fill="none" stroke="' + trim + '" stroke-width="2.4" stroke-linecap="round" opacity=".85"/>' +
      '<circle cx="40" cy="47" r="4" fill="#000" opacity=".35"/>' +
      // gloss
      '<path d="M14 50 C10 27 28 8 54 8 C79 8 94 24 94 43 V47 C94 51 91 53 87 53 H72 L69 64 C62 69 52 71 42 70 C26 69 16 62 14 50 Z" fill="url(#' + id + ')"/>' +
      '</g>' +
      '<text x="' + (opts.left ? 46 : 58) + '" y="' + (40 + size / 3) + '" text-anchor="middle" font-family="Barlow Condensed, Barlow, Arial Narrow, sans-serif" font-weight="800" font-size="' + size + '" letter-spacing=".5" fill="' + text + '">' + esc(label) + '</text>' +
      '</svg>';
  }

  // Confetti burst in the given colors (for Super Bowl winners). Skipped when the visitor prefers reduced motion.
  function confetti(host, colors) {
    if (!host || (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches)) return;
    var layer = document.createElement('div');
    layer.className = 'confetti';
    layer.setAttribute('aria-hidden', 'true');
    colors = (colors && colors.length ? colors : ['#f7d774', '#e63e8b', '#3987e5', '#1baf7a']).concat(['#ffd34d', '#ffffff']);
    for (var i = 0; i < 70; i++) {
      var p = document.createElement('i');
      p.style.left = (Math.random() * 100) + '%';
      p.style.background = colors[i % colors.length];
      p.style.setProperty('--dx', ((Math.random() - 0.5) * 160) + 'px');
      p.style.setProperty('--rot', (Math.random() * 720 - 360) + 'deg');
      p.style.animationDelay = (Math.random() * 0.35) + 's';
      p.style.animationDuration = (1.4 + Math.random() * 1.2) + 's';
      if (i % 3 === 0) p.style.borderRadius = '50%';
      layer.appendChild(p);
    }
    host.appendChild(layer);
    setTimeout(function () { layer.remove(); }, 3200);
  }

  window.Art = { helmet: helmet, confetti: confetti, colorsFor: colorsFor };
})();
