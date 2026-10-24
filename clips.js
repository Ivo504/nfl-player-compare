/* NFL Player Compare: shareable stat clips. Motion graphics drawn frame by frame on a canvas from the site's data
   (a week's top performers, a player head-to-head, a game final), previewed in a dialog and recorded to a video
   file with the browser's MediaRecorder so fans can post them. Depends on window.Art for the helmets. */
(function () {
  'use strict';
  var FORMATS = [['4:5', 1080, 1350, 'Feed 4:5'], ['9:16', 1080, 1920, 'Story 9:16'], ['1:1', 1080, 1080, 'Square']];
  var DUR = 10;
  var C = { bg: '#0a0e18', bg2: '#13224d', turf: '#0e3b24', gold: '#f7d774', goldInk: '#1c1400', ink: '#eef1f7', ink2: '#a9b3c9', card: '#121829', line: 'rgba(255,255,255,0.10)', hot: '#ff5a5f' };
  var SLOT = ['#5aa2ff', '#ff8a5c', '#2fd39a', '#ffc23d'];
  var HEAD = '"Barlow Condensed", "Arial Narrow", sans-serif', BODY = 'Barlow, system-ui, sans-serif';

  // ---------------------------------------------------------------- drawing helpers
  function clamp(x) { return x < 0 ? 0 : x > 1 ? 1 : x; }
  function seg(t, a, b) { return clamp((t - a) / (b - a)); }
  function out3(k) { return 1 - Math.pow(1 - k, 3); }
  function back(k) { var c = 1.6; return k <= 0 ? 0 : 1 + (c + 1) * Math.pow(k - 1, 3) + c * Math.pow(k - 1, 2); }
  function rr(x, ctx, l, t, w, h, r) { r = Math.max(0, Math.min(r, w / 2, h / 2)); ctx.beginPath(); ctx.moveTo(l + r, t); ctx.arcTo(l + w, t, l + w, t + h, r); ctx.arcTo(l + w, t + h, l, t + h, r); ctx.arcTo(l, t + h, l, t, r); ctx.arcTo(l, t, l + w, t, r); ctx.closePath(); if (x) ctx.fill(); }
  function font(ctx, weight, size, fam) { ctx.font = weight + ' ' + Math.round(size) + 'px ' + fam; }
  // shrink the font until the text fits
  function fitText(ctx, txt, weight, size, fam, maxW) {
    for (; size > 12; size -= 2) { font(ctx, weight, size, fam); if (ctx.measureText(txt).width <= maxW) break; }
    return size;
  }
  function wrap(ctx, txt, maxW) {
    var words = String(txt).split(' '), lines = [], cur = '';
    words.forEach(function (w) { var t = cur ? cur + ' ' + w : w; if (ctx.measureText(t).width > maxW && cur) { lines.push(cur); cur = w; } else cur = t; });
    if (cur) lines.push(cur);
    return lines;
  }
  // count a formatted number ("1,794", "7.5", "24") up from zero
  function countTo(txt, k) {
    var m = /^([^\d]*)([\d,]*\.?\d+)(.*)$/.exec(String(txt));
    if (!m || k >= 1) return String(txt);
    var raw = m[2].replace(/,/g, ''), dec = (raw.split('.')[1] || '').length, v = parseFloat(raw) * out3(k);
    var s = m[2].indexOf(',') >= 0 ? v.toLocaleString('en-US', { minimumFractionDigits: dec, maximumFractionDigits: dec }) : v.toFixed(dec);
    return m[1] + s + m[3];
  }
  var helmets = {};
  function helmet(code, left) {
    var key = code + (left ? 'L' : 'R');
    if (helmets[key]) return helmets[key];
    var svg = window.Art ? window.Art.helmet(code, { left: left }) : '';
    svg = svg.replace('<svg ', '<svg xmlns="http://www.w3.org/2000/svg" width="416" height="320" ');
    var img = new Image();
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
    helmets[key] = img;
    return img;
  }
  function drawHelmet(ctx, code, x, y, w, left, alpha) {
    var img = helmet(code, left);
    if (!img.complete || !img.naturalWidth) return;
    ctx.save(); ctx.globalAlpha *= alpha == null ? 1 : alpha;
    ctx.drawImage(img, x, y, w, w * 80 / 104);
    ctx.restore();
  }

  // ---------------------------------------------------------------- scenes shared by every clip
  function background(ctx, W, H, t) {
    var g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#060912'); g.addColorStop(0.55, C.bg2); g.addColorStop(1, C.turf);
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    // stadium lights sweep slowly
    [[0.12, 0], [0.88, 1.7]].forEach(function (l) {
      var x = W * l[0] + Math.sin(t * 0.6 + l[1]) * W * 0.04, on = 0.75 + 0.25 * Math.sin(t * 1.3 + l[1]);
      var rg = ctx.createRadialGradient(x, -40, 10, x, -40, H * 0.75);
      rg.addColorStop(0, 'rgba(255,243,176,' + (0.30 * on) + ')'); rg.addColorStop(1, 'rgba(255,243,176,0)');
      ctx.fillStyle = rg; ctx.fillRect(0, 0, W, H);
    });
    // yard lines in perspective at the bottom
    ctx.save(); ctx.strokeStyle = 'rgba(255,255,255,0.10)'; ctx.lineWidth = 3;
    var top = H * 0.86;
    for (var i = -6; i <= 6; i++) { ctx.beginPath(); ctx.moveTo(W / 2 + i * W * 0.09, top); ctx.lineTo(W / 2 + i * W * 0.22, H); ctx.stroke(); }
    ctx.beginPath(); ctx.moveTo(0, top); ctx.lineTo(W, top); ctx.stroke();
    ctx.restore();
    // drifting sparks
    ctx.save();
    for (var p = 0; p < 26; p++) {
      var sx = (p * 389 % W), sy = (p * 613 % (H * 0.8)), dy = (t * (12 + p % 7 * 5)) % (H * 0.8);
      ctx.globalAlpha = 0.15 + (p % 5) * 0.06;
      ctx.fillStyle = p % 3 ? '#ffffff' : C.gold;
      ctx.beginPath(); ctx.arc(sx, (sy - dy + H * 0.8) % (H * 0.8), 2 + p % 3, 0, 7); ctx.fill();
    }
    ctx.restore();
  }
  function header(ctx, W, H, t, kicker, title, accent) {
    var pad = W * 0.07, k = out3(seg(t, 0.15, 0.6));
    ctx.save(); ctx.globalAlpha = k;
    font(ctx, 800, W * 0.03, BODY);
    var kw = ctx.measureText(kicker.toUpperCase()).width + W * 0.04, ky = H * 0.06;
    ctx.fillStyle = accent || C.gold; rr(1, ctx, pad - (1 - k) * 60, ky, kw, W * 0.06, W * 0.012);
    ctx.fillStyle = accent && accent !== C.gold ? '#1a0506' : C.goldInk; ctx.textBaseline = 'middle';
    ctx.fillText(kicker.toUpperCase(), pad + W * 0.02 - (1 - k) * 60, ky + W * 0.031);
    ctx.restore();
    // title slams in
    var s = seg(t, 0.45, 0.95), sc = 1 + (1 - back(s)) * 0.35;
    if (s <= 0) return ky + W * 0.09;
    ctx.save(); ctx.globalAlpha = clamp(s * 2.5); ctx.fillStyle = '#ffffff'; ctx.textBaseline = 'top';
    var size = W * 0.105;
    font(ctx, 700, size, HEAD);
    var lines = wrap(ctx, title.toUpperCase(), W - pad * 2);
    while (lines.length > 3 && size > W * 0.06) { size -= 4; font(ctx, 700, size, HEAD); lines = wrap(ctx, title.toUpperCase(), W - pad * 2); }
    var y = ky + W * 0.1;
    ctx.translate(pad, y); ctx.scale(sc, sc);
    lines.forEach(function (ln, i) { ctx.fillText(ln, 0, i * size * 0.95); });
    ctx.restore();
    return y + lines.length * size * 0.95 + W * 0.03;
  }
  function brand() {
    var u = /^https?:/.test(location.protocol) ? location.host + location.pathname.replace(/index\.html$/, '') : 'ivo504.github.io/nfl-player-compare/';
    return u.replace(/\/$/, '');
  }
  function outro(ctx, W, H, t) {
    var k = seg(t, DUR - 1.8, DUR - 1.2);
    if (k <= 0) return 1;
    ctx.save();
    ctx.globalAlpha = out3(k) * 0.92; ctx.fillStyle = C.bg; ctx.fillRect(0, 0, W, H);
    ctx.globalAlpha = out3(k);
    var cy = H / 2, b = W * 0.11;
    // the app icon's football
    ctx.save(); ctx.translate(W / 2, cy - b * 0.9); ctx.rotate(-0.55 + (1 - out3(k)) * -2);
    var bg = ctx.createLinearGradient(-b, -b * 0.6, b, b * 0.6); bg.addColorStop(0, '#b8662a'); bg.addColorStop(1, '#6e3210');
    ctx.fillStyle = bg; ctx.beginPath(); ctx.ellipse(0, 0, b, b * 0.6, 0, 0, 7); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.fillRect(-b * 0.4, -b * 0.05, b * 0.8, b * 0.1);
    for (var i = 0; i < 4; i++) ctx.fillRect(-b * 0.3 + i * b * 0.18, -b * 0.16, b * 0.07, b * 0.32);
    ctx.fillStyle = C.gold; ctx.fillRect(-b * 0.82, -b * 0.36, b * 0.09, b * 0.72); ctx.fillRect(b * 0.73, -b * 0.36, b * 0.09, b * 0.72);
    ctx.restore();
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#ffffff';
    fitText(ctx, 'NFL PLAYER COMPARE', 700, W * 0.1, HEAD, W * 0.86);
    ctx.fillText('NFL PLAYER COMPARE', W / 2, cy + W * 0.06);
    font(ctx, 600, W * 0.036, BODY); ctx.fillStyle = C.gold;
    ctx.fillText(brand(), W / 2, cy + W * 0.15);
    font(ctx, 500, W * 0.03, BODY); ctx.fillStyle = C.ink2;
    ctx.fillText('Stats from nflverse · every season since 1999', W / 2, cy + W * 0.21);
    ctx.restore();
    return 1 - out3(k);
  }

  // ---------------------------------------------------------------- clip: a week's top performers
  function performers(ctx, W, H, t, spec) {
    var top = header(ctx, W, H, t, spec.kicker, spec.title), pad = W * 0.07;
    var items = spec.items.slice(0, 4), cols = H / W > 1.15 && H / W < 1.5 ? 2 : 1, rows = Math.ceil(items.length / cols);
    var gap = W * 0.025, areaH = H * 0.92 - top, cw = (W - pad * 2 - gap * (cols - 1)) / cols;
    var ch = Math.min((areaH - gap * (rows - 1)) / rows, cols === 1 ? W * 0.3 : W * 0.5);
    items.forEach(function (it, i) {
      var t0 = 1.3 + i * 0.5, k = seg(t, t0, t0 + 0.6);
      if (k <= 0) return;
      var col = i % cols, rw = Math.floor(i / cols), x = pad + col * (cw + gap), y = top + rw * (ch + gap);
      ctx.save(); ctx.globalAlpha = clamp(k * 2); ctx.translate((1 - back(k)) * W * 0.5, 0);
      ctx.fillStyle = 'rgba(18,24,41,0.94)'; rr(1, ctx, x, y, cw, ch, W * 0.025);
      ctx.fillStyle = it.color; rr(1, ctx, x, y, cw, W * 0.012, W * 0.006);
      var nk = seg(t, t0 + 0.3, t0 + 1.3), num = countTo(it.big, nk);
      if (cols === 1) {
        // one row per player: helmet, name and line on the left, the big number on the right
        var f = Math.min(1, ch / (W * 0.17)), ip = W * 0.035 * f, hw = W * 0.13 * f, big = W * 0.14 * f;
        font(ctx, 700, big, HEAD); var nwid = ctx.measureText(it.big).width;
        font(ctx, 600, W * 0.032 * f, BODY); var uw = ctx.measureText(' ' + it.unit).width;
        var rightW = nwid + uw + ip, textX = x + ip * 1.5 + hw, textW = cw - (textX - x) - rightW - ip;
        ctx.textBaseline = 'top'; ctx.fillStyle = C.ink2; font(ctx, 800, W * 0.024 * f, BODY);
        ctx.fillText(it.cat.toUpperCase(), x + ip, y + ip * 0.9);
        drawHelmet(ctx, it.team, x + ip, Math.max(y + ip * 0.9 + W * 0.03 * f, y + ch / 2 - hw * 0.3), hw);
        ctx.fillStyle = '#ffffff'; fitText(ctx, it.name, 700, W * 0.042 * f, BODY, textW);
        ctx.fillText(it.name, textX, y + ch * 0.3);
        font(ctx, 500, W * 0.028 * f, BODY); ctx.fillStyle = C.ink2;
        ctx.fillText(it.sub, textX, y + ch * 0.3 + W * 0.052 * f);
        if (it.line && ch > W * 0.2) { ctx.fillStyle = '#c9d1e3'; ctx.fillText(it.line, textX, y + ch * 0.3 + W * 0.095 * f); }
        ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
        font(ctx, 600, W * 0.032 * f, BODY); ctx.fillStyle = C.ink2; ctx.fillText(' ' + it.unit, x + cw - ip, y + ch / 2 + big * 0.18);
        font(ctx, 700, big, HEAD); ctx.fillStyle = it.color; ctx.fillText(num, x + cw - ip - uw, y + ch / 2 + big * 0.05);
      } else {
        // two by two: name on top, the big number below
        var ip2 = W * 0.035, hw2 = W * 0.12, big2 = W * 0.15;
        ctx.textBaseline = 'top'; ctx.fillStyle = C.ink2; font(ctx, 800, W * 0.026, BODY);
        ctx.fillText(it.cat.toUpperCase(), x + ip2, y + ip2);
        drawHelmet(ctx, it.team, x + ip2, y + ip2 + W * 0.045, hw2);
        ctx.fillStyle = '#ffffff'; fitText(ctx, it.name, 700, W * 0.042, BODY, cw - hw2 - ip2 * 3);
        ctx.fillText(it.name, x + ip2 * 1.5 + hw2, y + ip2 + W * 0.05);
        font(ctx, 500, W * 0.03, BODY); ctx.fillStyle = C.ink2;
        ctx.fillText(it.sub, x + ip2 * 1.5 + hw2, y + ip2 + W * 0.105);
        var by = y + ch - ip2 - W * 0.16;
        ctx.textBaseline = 'alphabetic'; font(ctx, 700, big2, HEAD); ctx.fillStyle = it.color;
        ctx.fillText(num, x + ip2, by + big2 * 0.85);
        var nw = ctx.measureText(num).width; font(ctx, 600, W * 0.032, BODY); ctx.fillStyle = C.ink2;
        ctx.fillText(' ' + it.unit, x + ip2 + nw, by + big2 * 0.85);
        if (it.line) { font(ctx, 500, W * 0.03, BODY); ctx.fillStyle = '#c9d1e3'; ctx.fillText(it.line, x + ip2, y + ch - ip2 * 0.7); }
      }
      ctx.restore();
    });
  }

  // ---------------------------------------------------------------- clip: head to head
  function h2h(ctx, W, H, t, spec) {
    var top = header(ctx, W, H, t, spec.kicker, spec.title), pad = W * 0.07, n = spec.players.length;
    // players across the top
    var pw = (W - pad * 2) / n, hk = seg(t, 1.0, 1.6), HW = Math.min(W * (H / W > 1.5 ? 0.15 : 0.11), pw * 0.5);
    spec.players.forEach(function (p, i) {
      var k = out3(seg(t, 1.0 + i * 0.15, 1.6 + i * 0.15)), cx = pad + pw * i + pw / 2;
      ctx.save(); ctx.globalAlpha = k; ctx.translate(0, (1 - k) * 40);
      var hw = HW;
      drawHelmet(ctx, p.team, cx - hw / 2, top, hw, i > 0 && n === 2);
      ctx.textAlign = 'center'; ctx.textBaseline = 'top'; ctx.fillStyle = p.color;
      fitText(ctx, p.short.toUpperCase(), 700, W * 0.05, HEAD, pw - W * 0.02);
      ctx.fillText(p.short.toUpperCase(), cx, top + hw * 0.8 + W * 0.008);
      font(ctx, 500, W * 0.024, BODY); ctx.fillStyle = C.ink2;
      ctx.fillText(p.meta, cx, top + hw * 0.8 + W * 0.062);
      ctx.restore();
    });
    if (hk <= 0) return;
    var y0 = top + HW * 0.8 + W * 0.11, avail = H * 0.93 - y0;
    // as many stat rows as fit at a readable size
    var need = W * (0.05 + 0.026 * n), rows = spec.rows.slice(0, Math.max(2, Math.floor(avail / need)));
    var rh = Math.min(avail / rows.length, W * (0.06 + 0.035 * n));
    rows.forEach(function (r, ri) {
      var t0 = 1.8 + ri * 0.45, k = seg(t, t0, t0 + 0.9), y = y0 + ri * rh;
      if (k <= 0) return;
      ctx.save(); ctx.globalAlpha = clamp(k * 3);
      ctx.textBaseline = 'top'; ctx.fillStyle = '#ffffff'; font(ctx, 700, W * 0.03, BODY);
      ctx.fillText(r.label.toUpperCase(), pad, y);
      var max = Math.max.apply(null, r.vals.map(function (v) { return v == null ? 0 : Math.abs(v); })) || 1;
      var bh = Math.max(W * 0.014, Math.min(W * 0.03, (rh - W * 0.06) / n - W * 0.008)), by = y + W * 0.045, maxW = W - pad * 2 - W * 0.17;
      r.vals.forEach(function (v, i) {
        var yy = by + i * (bh + W * 0.008), w = v == null ? 0 : maxW * Math.abs(v) / max * out3(k), lead = r.lead === i;
        ctx.fillStyle = 'rgba(255,255,255,0.06)'; rr(1, ctx, pad, yy, maxW, bh, bh / 2);
        ctx.fillStyle = spec.players[i].color; ctx.globalAlpha = clamp(k * 3) * (lead || r.lead == null ? 1 : 0.55);
        if (w > 1) rr(1, ctx, pad, yy, Math.max(w, bh), bh, bh / 2);
        ctx.globalAlpha = clamp(k * 3);
        ctx.fillStyle = lead ? spec.players[i].color : C.ink; font(ctx, 700, bh * 1.15, HEAD); ctx.textBaseline = 'middle';
        ctx.fillText((lead ? '★ ' : '') + countTo(r.txt[i], k), pad + maxW + W * 0.02, yy + bh / 2 + 1);
      });
      ctx.restore();
    });
  }

  // ---------------------------------------------------------------- clip: a game final
  function game(ctx, W, H, t, spec) {
    var top = header(ctx, W, H, t, spec.kicker, spec.title, spec.hot ? C.hot : C.gold), pad = W * 0.07;
    var tall = H / W > 1.5, mid = top + (tall ? W * 0.12 : W * 0.01), hw = W * (tall ? 0.28 : 0.2), big = W * (tall ? 0.2 : 0.15);
    [['w', 0], ['l', 1]].forEach(function (s, i) {
      var k = back(seg(t, 1.0 + i * 0.12, 1.7 + i * 0.12)), side = spec[s[0]];
      if (k <= 0) return;
      var x = i === 0 ? pad - (1 - k) * W * 0.6 : W - pad - hw + (1 - k) * W * 0.6;
      drawHelmet(ctx, side.code, x, mid, hw, i === 1);
      ctx.save(); ctx.textAlign = i === 0 ? 'left' : 'right'; ctx.textBaseline = 'top';
      var tx = i === 0 ? pad : W - pad;
      font(ctx, 600, W * 0.034, BODY); ctx.fillStyle = C.ink2;
      ctx.fillText(side.name, tx, mid + hw * 0.82);
      var sk = seg(t, 1.8, 2.9);
      font(ctx, 700, big, HEAD); ctx.fillStyle = i === 0 ? '#ffffff' : C.ink2;
      ctx.fillText(countTo(String(side.score), sk), tx, mid + hw * 0.82 + W * 0.05);
      ctx.restore();
    });
    var fk = seg(t, 2.6, 3.0);
    if (fk > 0) {
      ctx.save(); ctx.globalAlpha = fk; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = C.gold;
      font(ctx, 700, W * 0.05, HEAD); ctx.fillText(spec.final, W / 2, mid + hw * 0.45);
      ctx.restore();
    }
    var y = mid + hw * 0.82 + W * 0.07 + big, noteLines = H / W >= 1.2 ? (tall ? 4 : 3) : 0;
    // standout player and the betting result
    var dk = seg(t, 3.4, 4.0);
    if (dk > 0 && spec.note && noteLines) {
      ctx.save(); ctx.globalAlpha = out3(dk); ctx.translate(0, (1 - out3(dk)) * 30);
      font(ctx, 500, W * 0.036, BODY);
      var all = wrap(ctx, spec.note, W - pad * 2 - W * 0.06), lines = all.slice(0, noteLines);
      if (all.length > noteLines) lines[noteLines - 1] = lines[noteLines - 1].replace(/[\s,;.]*\S*$/, '') + '…';
      var bh = lines.length * W * 0.05 + W * 0.06;
      ctx.fillStyle = 'rgba(18,24,41,0.92)'; rr(1, ctx, pad, y, W - pad * 2, bh, W * 0.025);
      ctx.fillStyle = C.gold; rr(1, ctx, pad, y, W * 0.012, bh, W * 0.006);
      ctx.fillStyle = '#dde3f0'; ctx.textBaseline = 'top';
      lines.forEach(function (ln, i) { ctx.fillText(ln, pad + W * 0.04, y + W * 0.03 + i * W * 0.05); });
      ctx.restore();
      y += bh + W * 0.035;
    }
    (spec.chips || []).forEach(function (c, i) {
      var ck = seg(t, 4.3 + i * 0.3, 4.8 + i * 0.3);
      if (ck <= 0) return;
      ctx.save(); ctx.globalAlpha = ck; font(ctx, 700, W * 0.032, BODY);
      var cw = ctx.measureText(c).width + W * 0.05, cx = pad;
      for (var j = 0; j < i; j++) { cx += ctx.measureText(spec.chips[j]).width + W * 0.07; }
      ctx.fillStyle = i === 0 ? C.gold : 'rgba(255,255,255,0.12)'; rr(1, ctx, cx, y + (1 - back(ck)) * 20, cw, W * 0.065, W * 0.033);
      ctx.fillStyle = i === 0 ? C.goldInk : '#ffffff'; ctx.textBaseline = 'middle';
      ctx.fillText(c, cx + W * 0.025, y + W * 0.034 + (1 - back(ck)) * 20);
      ctx.restore();
    });
  }

  var KINDS = { performers: performers, h2h: h2h, game: game };
  function frame(ctx, W, H, t, spec) {
    ctx.save();
    background(ctx, W, H, t);
    var fade = 1 - seg(t, DUR - 1.8, DUR - 1.3);
    ctx.globalAlpha = fade;
    if (fade > 0) KINDS[spec.kind](ctx, W, H, t, spec);
    ctx.globalAlpha = 1;
    outro(ctx, W, H, t);
    ctx.restore();
  }

  // ---------------------------------------------------------------- the dialog
  function h(tag, attrs) {
    var e = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (k) {
      var v = attrs[k];
      if (v == null || v === false) return;
      if (k === 'class') e.className = v;
      else if (k === 'text') e.textContent = v;
      else if (k.indexOf('on') === 0) e.addEventListener(k.slice(2), v);
      else e.setAttribute(k, v === true ? '' : v);
    });
    Array.prototype.slice.call(arguments, 2).forEach(function (c) { (Array.isArray(c) ? c : [c]).forEach(function (x) { if (x != null && x !== false) e.append(x.nodeType ? x : String(x)); }); });
    return e;
  }
  function mime() {
    if (!window.MediaRecorder || !HTMLCanvasElement.prototype.captureStream) return null;
    var list = ['video/mp4;codecs=avc1.42E01E', 'video/mp4', 'video/webm;codecs=vp9', 'video/webm'];
    for (var i = 0; i < list.length; i++) if (MediaRecorder.isTypeSupported(list[i])) return list[i];
    return null;
  }
  var KEY = 'nflcompare.clips', dlg, canvas, ctx, spec, fmt = '4:5', raf = 0, t0 = 0, recording = null;
  try { var sv = localStorage.getItem(KEY); if (sv && FORMATS.some(function (f) { return f[0] === sv; })) fmt = sv; } catch (e) { /* storage unavailable */ }
  function size() { return FORMATS.filter(function (f) { return f[0] === fmt; })[0]; }
  function still() { return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches; }
  function loop(ts) {
    if (!dlg || !dlg.open) return;
    if (!t0) t0 = ts;
    var t = (ts - t0) / 1000;
    if (still() && !recording) t = DUR - 2.2; // a still of the finished graphic
    if (t >= DUR) { if (recording) { stopRec(); return; } t0 = ts; t = 0; }
    frame(ctx, canvas.width, canvas.height, t, spec);
    if (recording) recording.bar.style.width = Math.round(t / DUR * 100) + '%';
    raf = requestAnimationFrame(loop);
  }
  function restart() {
    var s = size();
    canvas.width = s[1]; canvas.height = s[2];
    canvas.style.aspectRatio = s[1] + ' / ' + s[2];
    cancelAnimationFrame(raf); t0 = 0; raf = requestAnimationFrame(loop);
  }
  function fileName(ext) { return 'nfl-compare-' + spec.file + '-' + fmt.replace(':', 'x') + '.' + ext; }
  function startRec() {
    var type = mime();
    if (!type) return;
    var stream = canvas.captureStream(30), chunks = [];
    var rec = new MediaRecorder(stream, { mimeType: type, videoBitsPerSecond: 8000000 });
    rec.ondataavailable = function (e) { if (e.data && e.data.size) chunks.push(e.data); };
    rec.onstop = function () {
      var blob = new Blob(chunks, { type: type.split(';')[0] }), ext = type.indexOf('mp4') >= 0 ? 'mp4' : 'webm';
      finished(blob, fileName(ext));
    };
    recording = { rec: rec, bar: dlg.querySelector('.cl-bar i') };
    dlg.classList.add('rec');
    status('Recording your clip… keep this screen open (' + DUR + ' seconds).');
    cancelAnimationFrame(raf); t0 = 0;
    rec.start();
    raf = requestAnimationFrame(loop);
  }
  function stopRec() {
    var r = recording; recording = null;
    dlg.classList.remove('rec');
    if (r && r.rec.state !== 'inactive') r.rec.stop();
    t0 = 0; raf = requestAnimationFrame(loop);
  }
  function finished(blob, name) {
    var url = URL.createObjectURL(blob), file = null;
    try { file = new File([blob], name, { type: blob.type }); } catch (e) { /* older browsers */ }
    var acts = dlg.querySelector('.cl-out');
    acts.replaceChildren(
      h('a', { class: 'hm-btn gold', href: url, download: name, text: 'Download video' }),
      file && navigator.canShare && navigator.canShare({ files: [file] }) ? h('button', { type: 'button', class: 'hm-btn ghost', text: 'Share', onclick: function () { navigator.share({ files: [file], title: spec.title }).catch(function () { /* cancelled */ }); } }) : null);
    status('Your clip is ready: ' + name + ' (' + (blob.size / 1048576).toFixed(1) + ' MB).' + (name.slice(-4) === 'webm' ? ' Some apps want MP4; Safari and the newest Chrome record MP4.' : ''));
  }
  function status(txt) { var s = dlg.querySelector('.cl-status'); if (s) s.textContent = txt; }
  function saveImage() {
    var c = document.createElement('canvas'), s = size();
    c.width = s[1]; c.height = s[2];
    frame(c.getContext('2d'), c.width, c.height, DUR - 2.2, spec);
    c.toBlob(function (b) { if (b) finished(b, fileName('png')); }, 'image/png');
  }
  function close() { if (recording) stopRec(); cancelAnimationFrame(raf); if (dlg && dlg.open) dlg.close(); }
  function build() {
    canvas = h('canvas', { class: 'cl-canvas', role: 'img', 'aria-label': 'Animated clip preview' });
    ctx = canvas.getContext('2d');
    var segs = h('div', { class: 'seg cl-fmt', role: 'group', 'aria-label': 'Clip size' }, FORMATS.map(function (f) {
      return h('button', { type: 'button', 'data-v': f[0], 'aria-pressed': String(f[0] === fmt), text: f[3], onclick: function () {
        if (recording) return;
        fmt = f[0]; try { localStorage.setItem(KEY, fmt); } catch (e) { /* storage unavailable */ }
        Array.prototype.forEach.call(segs.children, function (b) { b.setAttribute('aria-pressed', String(b.getAttribute('data-v') === fmt)); });
        dlg.querySelector('.cl-out').replaceChildren(); status(''); restart();
      } });
    }));
    var can = !!mime();
    dlg = h('dialog', { class: 'cl-dlg', 'aria-labelledby': 'cltitle' },
      h('div', { class: 'cl-head' }, h('h2', { id: 'cltitle', text: 'Make a clip' }), h('button', { type: 'button', class: 'x', 'aria-label': 'Close', text: '×', onclick: close })),
      h('div', { class: 'cl-body' },
        h('div', { class: 'cl-stage' }, canvas, h('div', { class: 'cl-bar', 'aria-hidden': 'true' }, h('i'))),
        h('div', { class: 'cl-side' },
          h('p', { class: 'cl-what' }),
          h('span', { class: 'lbl', text: 'Size' }), segs,
          h('div', { class: 'cl-acts' },
            can ? h('button', { type: 'button', class: 'hm-btn gold cl-rec', text: 'Record video', onclick: function () { if (!recording) { dlg.querySelector('.cl-out').replaceChildren(); startRec(); } } }) : null,
            h('button', { type: 'button', class: 'hm-btn ghost', text: 'Replay', onclick: function () { if (!recording) { t0 = 0; } } }),
            h('button', { type: 'button', class: 'hm-btn ghost', text: 'Save still image', onclick: saveImage })),
          h('div', { class: 'cl-out' }),
          h('p', { class: 'cl-status', role: 'status' }),
          h('p', { class: 'cl-note', text: can ? 'The video records in real time, so it takes ' + DUR + ' seconds. Post it anywhere; the numbers come from this site\'s data.' : 'This browser can\'t record video. Save a still image instead, or open the site in Chrome or Safari.' }))));
    dlg.addEventListener('close', function () { if (recording) stopRec(); cancelAnimationFrame(raf); });
    dlg.addEventListener('click', function (e) { if (e.target === dlg) close(); });
    document.body.append(dlg);
  }
  function open(s) {
    if (!s || !KINDS[s.kind]) return;
    spec = s;
    if (!dlg) build();
    dlg.querySelector('.cl-what').textContent = s.about || '';
    dlg.querySelector('.cl-out').replaceChildren(); status('');
    // helmets load as images; fonts must be ready before the first frame
    (s.teams || []).forEach(function (c) { helmet(c, false); helmet(c, true); });
    var ready = document.fonts && document.fonts.load ? Promise.all([document.fonts.load('700 40px "Barlow Condensed"'), document.fonts.load('500 20px Barlow'), document.fonts.load('800 20px Barlow')]).catch(function () {}) : Promise.resolve();
    if (dlg.showModal) dlg.showModal(); else dlg.setAttribute('open', '');
    ready.then(restart);
  }
  function button(label, fn) {
    return h('button', { type: 'button', class: 'hm-btn clip', onclick: fn },
      h('span', { class: 'cl-ico', 'aria-hidden': 'true' }), label || 'Make a clip');
  }
  window.NFLClips = { open: open, button: button, frame: frame, formats: FORMATS, duration: DUR, slot: SLOT };
})();
