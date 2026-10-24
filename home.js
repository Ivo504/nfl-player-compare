/* NFL Player Compare: Home view. A front page built from the site's own data: this week's scores, the latest week's
   biggest stories and top performers, betting lines, standings, season leaders, injuries and a game from this week in
   history. Every headline is generated from final scores, closing lines and box scores; nothing is written by hand.
   Depends on window.NFLGames (gamesui.js), window.Core, window.TCore and window.NFL. */
(function () {
  'use strict';
  var NG = window.NFLGames, C = window.Core, T = window.TCore, D = window.NFL;
  if (!NG || !C || !D) return;

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
    Array.prototype.slice.call(arguments, 2).forEach(function (c) {
      (Array.isArray(c) ? c : [c]).forEach(function (x) { if (x != null && x !== false) e.append(x.nodeType ? x : String(x)); });
    });
    return e;
  }
  function num(v) { return Math.abs(v - Math.round(v)) < 1e-9 ? Math.round(v).toLocaleString('en-US') : v.toLocaleString('en-US', { maximumFractionDigits: 1 }); }
  function plural(n, one, many) { return n + ' ' + (n === 1 ? one : many || one + 's'); }
  function nick(code, season) { var n = NG.teamName(code, season).split(' '); return n[n.length - 1]; }
  function teamRow(code) { var t = T ? T.byAbbr.get(NG.fr(code)) : null; return t != null ? T.teams[t] : null; }
  function teamColor(code) { var t = teamRow(code); return t ? t[4] : '#888'; }
  function helm(code, left, cls) {
    var s = h('span', { class: 'hm-helm' + (cls ? ' ' + cls : ''), 'aria-hidden': 'true' });
    if (window.Art) s.innerHTML = window.Art.helmet(code, { left: left });
    return s;
  }
  function app() { return window.NFLApp || {}; }
  function openGame(g) { if (app().showGame) app().showGame(g.id); }
  function showPlayer(p) { if (p >= 0 && app().show) app().show('players', [p]); }
  function go(view) { if (app().go) app().go(view); }
  function askLuna(q) {
    var fab = document.querySelector('.lfab');
    if (fab) fab.click();
    if (q && window.Luna && window.Luna.ask) window.Luna.ask(q);
  }
  function today() { var d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }

  // ---------------------------------------------------------------- the latest finished week
  // the latest week that's mostly been played (so a lone Thursday game doesn't count as "the week"),
  // plus any games played since, which also make the news
  function latestWeek() {
    for (var i = 0; i < NG.seasons.length; i++) {
      var s = NG.seasons[i];
      var sg = NG.games.filter(function (g) { return g.season === s; });
      var weeks = Array.from(new Set(sg.filter(function (g) { return g.played; }).map(function (g) { return g.week; }))).sort(function (a, b) { return b - a; });
      for (var j = 0; j < weeks.length; j++) {
        var wk = weeks[j], all = sg.filter(function (g) { return g.week === wk; }), done = all.filter(function (g) { return g.played; });
        if (done.length * 2 >= all.length || j === weeks.length - 1) {
          var later = sg.filter(function (g) { return g.played && g.week > wk; });
          return { season: s, week: wk, games: done, news: done.concat(later) };
        }
      }
    }
    return null;
  }
  function weekLabel(g) { return g.type ? NG.roundName(g) : 'Week ' + g.week; }
  function favorite(g) { return g.spread == null || g.spread === 0 ? null : g.spread > 0 ? g.home : g.away; }

  // a headline for one finished game, with a score for how newsworthy it is
  function story(g) {
    var w = NG.winner(g), tie = w === 'TIE';
    var l = tie ? g.home : w === g.home ? g.away : g.home;
    var ws = Math.max(g.hs, g.as), ls = Math.min(g.hs, g.as), margin = ws - ls, total = g.hs + g.as;
    var W = nick(w === 'TIE' ? g.away : w, g.season), L = nick(l, g.season), fav = favorite(g), dog = fav && !tie && fav !== w;
    var s = { g: g, w: tie ? g.away : w, l: l, score: ws + '–' + ls + (g.ot ? ' OT' : ''), rank: 1 };
    if (dog && Math.abs(g.spread) >= 3) {
      s.kick = Math.abs(g.spread) >= 7 ? 'Upset alert' : 'Underdog win'; s.tone = Math.abs(g.spread) >= 7 ? 'red' : 'orange'; s.rank = 10 + Math.abs(g.spread);
      s.title = W + (Math.abs(g.spread) >= 7 ? ' stun the ' : ' upset the ') + L + ' as ' + Math.abs(g.spread) + '-point underdogs';
    } else if (tie) {
      s.kick = 'Stalemate'; s.tone = 'blue'; s.rank = 9;
      s.title = 'The ' + nick(g.away, g.season) + ' and ' + nick(g.home, g.season) + ' tie ' + g.as + '–' + g.hs;
    } else if (g.ot) {
      s.kick = 'Overtime'; s.tone = 'gold'; s.rank = 8 + total / 100;
      s.title = W + ' outlast the ' + L + ' in overtime';
    } else if (total >= 65) {
      s.kick = 'Shootout'; s.tone = 'orange'; s.rank = 7 + total / 100;
      s.title = W + ' win a ' + total + '-point shootout with the ' + L;
    } else if (margin >= 24) {
      s.kick = 'Blowout'; s.tone = 'green'; s.rank = 6 + margin / 100;
      s.title = W + ' rout the ' + L + ' by ' + margin;
    } else if (ls <= 6) {
      s.kick = 'Defense'; s.tone = 'blue'; s.rank = 6 - ls / 100;
      s.title = W + ' hold the ' + L + ' to ' + plural(ls, 'point');
    } else if (margin <= 3) {
      s.kick = 'Down to the wire'; s.tone = 'gold'; s.rank = 5 - margin / 10;
      s.title = W + ' edge the ' + L + ' by ' + plural(margin, 'point');
    } else {
      s.kick = 'Final'; s.tone = 'muted'; s.rank = 1 + margin / 100;
      s.title = W + ' beat the ' + L + ' ' + ws + '–' + ls;
    }
    if (g.type) { s.rank += 20; s.kick = NG.roundName(g) + (s.kick === 'Final' ? '' : ' · ' + s.kick); }
    return s;
  }
  // the standout player line in one game's box score, from the winning side when there is one
  function bestLine(lines, g) {
    var w = NG.winner(g), side = w === g.home ? 1 : w === g.away ? 0 : null;
    var best = null, bs = 0;
    lines.forEach(function (b) {
      if (side != null && b.side !== side) return;
      var sc = Math.max(b.pyd / 25 + b.ptd * 4 - b.int * 2, b.ryd / 10 + b.rtd * 6 + b.cyd / 10 + b.ctd * 6, b.dsk * 4 + b.dint * 5 + b.ff * 3);
      if (sc > bs) { bs = sc; best = b; }
    });
    return best;
  }
  function lineText(b) {
    var out = [];
    if (b.att >= 10) out.push(b.cmp + ' of ' + b.att + ' for ' + num(b.pyd) + ' yards' + (b.ptd ? ', ' + plural(b.ptd, 'TD') : '') + (b.int ? ', ' + plural(b.int, 'INT') : ''));
    if (b.car >= 5 || b.rtd) out.push(plural(b.car, 'carry', 'carries') + ' for ' + num(b.ryd) + ' yards' + (b.rtd ? ', ' + plural(b.rtd, 'TD') : ''));
    if (b.rec >= 3 || b.ctd) out.push(plural(b.rec, 'catch', 'catches') + ' for ' + num(b.cyd) + ' yards' + (b.ctd ? ', ' + plural(b.ctd, 'TD') : ''));
    if (b.dsk >= 1) out.push(num(b.dsk) + (b.dsk === 1 ? ' sack' : ' sacks'));
    if (b.dint >= 1) out.push(plural(b.dint, 'interception'));
    return out.join(' · ');
  }
  function bettingText(g) {
    var fav = favorite(g), bits = [];
    if (fav) bits.push(nick(fav, g.season) + ' closed as ' + Math.abs(g.spread) + '-point favorites');
    var c = NG.coverText(g); if (c && c !== 'Push') bits.push(c.replace(/^(\w+) covered$/, function (m, t) { return nick(t, g.season) + ' covered'; }));
    var t = NG.totalText(g); if (t) bits.push(t.replace(/ \(.*/, '') === 'Push' ? 'total pushed' : (t.indexOf('Over') === 0 ? 'the over hit' : 'the under hit') + ' (' + g.total + ')');
    return bits.length ? bits.join('; ') + '.' : '';
  }

  // ---------------------------------------------------------------- standings and leaders
  function standings(season) {
    var rec = {};
    NG.games.forEach(function (g) {
      if (g.season !== season || g.type || !g.played) return;
      var a = NG.fr(g.away), hm = NG.fr(g.home);
      [a, hm].forEach(function (c) { if (!rec[c]) rec[c] = { w: 0, l: 0, t: 0, pf: 0, pa: 0 }; });
      rec[a].pf += g.as; rec[a].pa += g.hs; rec[hm].pf += g.hs; rec[hm].pa += g.as;
      if (g.hs > g.as) { rec[hm].w++; rec[a].l++; } else if (g.as > g.hs) { rec[a].w++; rec[hm].l++; } else { rec[a].t++; rec[hm].t++; }
    });
    return rec;
  }
  function pct(r) { var n = r.w + r.l + r.t; return n ? (r.w + r.t / 2) / n : 0; }
  var FI = {};
  D.fields.forEach(function (k, i) { FI[k] = i + 5; });
  function leaders(stat, n) {
    var season = C.years[1], rows = [];
    D.rows.forEach(function (r) { if (r[1] === season && r[2] === 0 && r[FI[stat]] > 0) rows.push(r); });
    rows.sort(function (a, b) { return b[FI[stat]] - a[FI[stat]]; });
    return { season: season, list: rows.slice(0, n).map(function (r) { var tm = String(r[3]).split('/'); return { p: r[0], name: C.players[r[0]][1], team: tm[tm.length - 1], v: r[FI[stat]] }; }) };
  }

  // ---------------------------------------------------------------- this week in history
  function mmdd(iso) { return +iso.slice(5, 7) * 100 + +iso.slice(8, 10); }
  function historyGame() {
    var t = today(), cur = NG.seasons[0], base = new Date(t + 'T12:00:00Z'), days = {};
    for (var i = -3; i <= 3; i++) { var d = new Date(base); d.setUTCDate(d.getUTCDate() + i); days[mmdd(d.toISOString())] = true; }
    var pool = NG.games.filter(function (g) { return g.played && g.season < cur && g.date && days[mmdd(g.date)]; });
    if (!pool.length) return null;
    var ups = pool.filter(function (g) { var f = favorite(g), w = NG.winner(g); return f && w !== 'TIE' && w !== f; })
      .sort(function (a, b) { return Math.abs(b.spread) - Math.abs(a.spread); });
    if (ups.length && Math.abs(ups[0].spread) >= 7) return { g: ups[0], kind: 'upset' };
    var big = pool.slice().sort(function (a, b) { return (b.hs + b.as) - (a.hs + a.as); });
    return { g: big[0], kind: 'points' };
  }

  // ---------------------------------------------------------------- pieces
  var host, st = { conf: 'AFC' }, KEY = 'nflcompare.home';
  try { var sv = JSON.parse(localStorage.getItem(KEY) || 'null'); if (sv && (sv.conf === 'AFC' || sv.conf === 'NFC')) st.conf = sv.conf; } catch (e) { /* storage unavailable */ }
  function save() { try { localStorage.setItem(KEY, JSON.stringify({ conf: st.conf })); } catch (e) { /* storage unavailable */ } }
  function sect(title, extra, body, cls) {
    return h('section', { class: 'hm-sec' + (cls ? ' ' + cls : ''), 'aria-label': title },
      h('div', { class: 'hm-sh' }, h('h2', { text: title }), extra || null), body);
  }
  function more(text, fn) { return h('button', { type: 'button', class: 'hm-more', text: text, onclick: fn }); }

  function ticker() {
    var cw = NG.currentWeek();
    var wg = NG.games.filter(function (g) { return g.season === cw.season && g.week === cw.week; })
      .sort(function (a, b) { return (a.date + (a.time || '')).localeCompare(b.date + (b.time || '')); });
    var label = wg.length ? weekLabel(wg[0]) : 'Week ' + cw.week;
    var bar = h('div', { class: 'hm-tick', id: 'hmtick', role: 'region', 'aria-label': cw.season + ' ' + label + ' scores' },
      h('div', { class: 'hm-tlbl' }, h('b', { text: label }), h('span', { text: String(cw.season) })));
    wg.forEach(function (g) {
      var lv = NG.liveFor(g), as = g.as, hs = g.hs, status, live = false;
      if (lv && (lv.state === 'in' || (lv.state === 'post' && !g.played))) { as = lv.away.score; hs = lv.home.score; status = lv.detail; live = lv.state === 'in'; }
      else if (g.played) status = g.ot ? 'Final/OT' : 'Final';
      else status = NG.kickoff(g);
      var done = as != null && hs != null, aw = done && as > hs, hw = done && hs > as;
      function side(code, sc, won, lost) {
        return h('span', { class: 'hm-tt' + (won ? ' won' : '') + (lost ? ' lost' : '') }, h('i', { style: 'background:' + teamColor(code), 'aria-hidden': 'true' }), h('span', { text: code }), h('b', { text: sc != null ? String(sc) : '' }));
      }
      bar.append(h('button', { type: 'button', class: 'hm-tg' + (live ? ' live' : ''), onclick: function () { openGame(g); },
        'aria-label': g.away + ' ' + (as != null ? as : '') + ' at ' + g.home + ' ' + (hs != null ? hs : '') + ', ' + status },
        h('span', { class: 'hm-ts' }, live ? h('i', { class: 'hm-dot', 'aria-hidden': 'true' }) : null, status),
        side(g.away, as, aw, hw), side(g.home, hs, hw, aw)));
    });
    return bar;
  }

  function lead(s) {
    var g = s.g, wHome = s.w === g.home, wScore = wHome ? g.hs : g.as, lScore = wHome ? g.as : g.hs;
    var desc = h('p', { class: 'hm-ldesc', id: 'hmleaddesc', text: bettingText(g) });
    return h('article', { class: 'hm-lead' },
      h('div', { class: 'hm-kick' }, h('span', { class: 'hm-tag ' + s.tone, text: s.kick }), h('span', { text: weekLabel(g) + ' · ' + NG.dateText(g) })),
      h('h2', { class: 'hm-lh', text: s.title }),
      h('div', { class: 'hm-lscore' },
        h('div', { class: 'hm-lteam' }, helm(s.w, false, 'big'), h('div', null, h('span', { text: NG.teamName(s.w, g.season) }), h('b', { text: String(wScore) }))),
        h('span', { class: 'hm-final', text: g.ot ? 'Final/OT' : 'Final' }),
        h('div', { class: 'hm-lteam r' }, h('div', null, h('span', { text: NG.teamName(s.l, g.season) }), h('b', { class: 'lost', text: String(lScore) })), helm(s.l, true, 'big'))),
      desc,
      h('div', { class: 'hm-acts' },
        h('button', { type: 'button', class: 'hm-btn gold', text: 'Box score', onclick: function () { openGame(g); } }),
        h('a', { class: 'hm-btn ghost', href: 'https://www.youtube.com/results?search_query=' + encodeURIComponent(g.season + ' ' + NG.teamName(g.away, g.season) + ' vs ' + NG.teamName(g.home, g.season) + ' highlights'), target: '_blank', rel: 'noopener', text: 'Highlights on YouTube' })));
  }
  function storyCard(s) {
    return h('button', { type: 'button', class: 'hm-story', onclick: function () { openGame(s.g); } },
      h('span', { class: 'hm-kk ' + s.tone, text: (s.g.type ? '' : weekLabel(s.g) + ' · ') + s.kick }),
      h('h3', { text: s.title }),
      h('span', { class: 'hm-sscore' }, helm(s.w), h('b', { text: s.score }), helm(s.l, true)),
      h('p', { class: 'hm-sdesc', 'data-g': s.g.id, text: bettingText(s.g) }));
  }

  function performers(lw, data) {
    var all = [];
    lw.games.forEach(function (g) {
      NG.boxLines(data, g).forEach(function (b) { b.team = b.side === 1 ? g.home : g.away; b.opp = b.side === 1 ? g.away : g.home; b.g = g; all.push(b); });
    });
    function top(k) { return all.reduce(function (m, b) { return !m || b[k] > m[k] ? b : m; }, null); }
    var cards = [];
    var qb = top('pyd'); if (qb && qb.pyd > 0) cards.push({ cat: 'Passing', b: qb, big: num(qb.pyd), unit: 'yds', line: qb.cmp + ' of ' + qb.att + (qb.ptd ? ' · ' + plural(qb.ptd, 'TD') : '') + (qb.int ? ' · ' + plural(qb.int, 'INT') : ''), col: 's1' });
    var rb = top('ryd'); if (rb && rb.ryd > 0) cards.push({ cat: 'Rushing', b: rb, big: num(rb.ryd), unit: 'yds', line: plural(rb.car, 'carry', 'carries') + (rb.rtd ? ' · ' + plural(rb.rtd, 'TD') : ''), col: 's2' });
    var wr = top('cyd'); if (wr && wr.cyd > 0) cards.push({ cat: 'Receiving', b: wr, big: num(wr.cyd), unit: 'yds', line: plural(wr.rec, 'catch', 'catches') + (wr.ctd ? ' · ' + plural(wr.ctd, 'TD') : ''), col: 's3' });
    var de = top('dsk');
    if (de && de.dsk >= 1) cards.push({ cat: 'Pass rush', b: de, big: num(de.dsk), unit: de.dsk === 1 ? 'sack' : 'sacks', line: plural(de.tkl, 'tackle'), col: 's4' });
    else { var tk = top('tkl'); if (tk && tk.tkl > 0) cards.push({ cat: 'Tackles', b: tk, big: num(tk.tkl), unit: 'tackles', line: tk.dsk ? num(tk.dsk) + ' sacks' : '', col: 's4' }); }
    return h('div', { class: 'hm-perf' }, cards.map(function (c) {
      return h('button', { type: 'button', class: 'hm-pc', style: '--pc:var(--' + c.col + ')', disabled: c.b.p < 0, onclick: function () { showPlayer(c.b.p); },
        title: c.b.p >= 0 ? 'Compare ' + c.b.name : null },
        h('span', { class: 'hm-pcat', text: c.cat }),
        h('span', { class: 'hm-pwho' }, helm(c.b.team), h('span', null, h('b', { text: c.b.name }), h('small', { text: (c.b.pos || '') + ' · ' + c.b.team + (c.b.side === 1 ? ' vs ' : ' at ') + c.b.opp }))),
        h('span', { class: 'hm-pbig' }, h('b', { text: c.big }), h('small', { text: c.unit })),
        c.line ? h('span', { class: 'hm-pline', text: c.line }) : null);
    }));
  }

  function lines() {
    var up = NG.upcoming(null, 32);
    if (!up.length) return null;
    var wk = up[0].week, season = up[0].season;
    var list = up.filter(function (g) { return g.week === wk && g.season === season; });
    var tb = h('tbody');
    list.forEach(function (g) {
      var sp = NG.spreadText(g);
      tb.append(h('tr', { onclick: function () { openGame(g); } },
        h('th', { scope: 'row' }, h('button', { type: 'button', class: 'hm-mlink', text: g.away + ' at ' + g.home, onclick: function (e) { e.stopPropagation(); openGame(g); } })),
        h('td', { class: 'hm-k', text: NG.kickoff(g) }),
        h('td', { class: 'num gold', text: sp || '–' }),
        h('td', { class: 'num', text: g.total != null ? String(g.total) : '–' }),
        h('td', { class: 'num dim', text: g.aml != null || g.hml != null ? g.away + ' ' + NG.ml(g.aml) + ' / ' + g.home + ' ' + NG.ml(g.hml) : '–' })));
    });
    var label = weekLabel(list[0]);
    return sect(label + ' lines', more('All games', function () { go('games'); }),
      h('div', { class: 'hm-tbl' }, h('table', null,
        h('caption', { class: 'sr', text: season + ' ' + label + ' betting lines' }),
        h('thead', null, h('tr', null, h('th', { scope: 'col', text: 'Matchup' }), h('th', { scope: 'col', text: 'Kickoff' }), h('th', { scope: 'col', class: 'num', text: 'Spread' }), h('th', { scope: 'col', class: 'num', text: 'Total' }), h('th', { scope: 'col', class: 'num', text: 'Moneyline' }))),
        tb)));
  }

  function standingsBox() {
    var season = NG.seasons[0];
    var rec = standings(season);
    if (!Object.keys(rec).length && NG.seasons[1]) { season = NG.seasons[1]; rec = standings(season); }
    var body = h('div', { class: 'hm-divs' });
    function draw() {
      body.replaceChildren();
      var divs = {};
      T.teams.forEach(function (t) { if (t[2] === st.conf) (divs[t[3]] = divs[t[3]] || []).push(t); });
      Object.keys(divs).sort().forEach(function (dn) {
        var rows = divs[dn].map(function (t) { return { t: t, r: rec[t[0]] || { w: 0, l: 0, t: 0, pf: 0, pa: 0 } }; })
          .sort(function (a, b) { return pct(b.r) - pct(a.r) || (b.r.pf - b.r.pa) - (a.r.pf - a.r.pa); });
        body.append(h('div', { class: 'hm-div' },
          h('div', { class: 'hm-dh' }, h('span', { text: dn }), h('span', { text: 'W-L · Diff' })),
          rows.map(function (x, i) {
            var d = x.r.pf - x.r.pa;
            return h('button', { type: 'button', class: 'hm-dr' + (i === 0 ? ' first' : ''), onclick: function () { if (app().show) app().show('teams', [T.byAbbr.get(x.t[0])]); }, title: 'Compare the ' + x.t[1] },
              h('i', { style: 'background:' + x.t[4], 'aria-hidden': 'true' }),
              h('span', { class: 'hm-dn', text: x.t[1].split(' ').slice(-1)[0] }),
              h('b', { text: x.r.w + '-' + x.r.l + (x.r.t ? '-' + x.r.t : '') }),
              h('span', { class: 'hm-dd ' + (d > 0 ? 'up' : d < 0 ? 'down' : ''), text: (d > 0 ? '+' : d < 0 ? '−' : '') + Math.abs(d) }));
          })));
      });
      Array.prototype.forEach.call(sw.children, function (b) { b.setAttribute('aria-pressed', String(b.textContent === st.conf)); });
    }
    var sw = h('div', { class: 'hm-sw', role: 'group', 'aria-label': 'Conference' },
      ['AFC', 'NFC'].map(function (c) { return h('button', { type: 'button', text: c, onclick: function () { st.conf = c; save(); draw(); } }); }));
    draw();
    return sect(season + ' standings', sw, h('div', null, body, h('p', { class: 'hm-note', text: 'Sorted by win percentage, then point differential. Not the official tiebreakers.' })), 'hm-card');
  }

  function leadersBox() {
    var cats = [['pyd', 'Passing yards'], ['ryd', 'Rushing yards'], ['cyd', 'Receiving yards'], ['dsk', 'Sacks']];
    var season = C.years[1];
    return sect(season + ' leaders', null, h('div', { class: 'hm-leads' }, cats.map(function (c) {
      var L = leaders(c[0], 3);
      if (!L.list.length) return null;
      var a = L.list[0], rest = L.list.slice(1);
      return h('div', { class: 'hm-ld' },
        h('span', { class: 'hm-lc', text: c[1] }),
        h('button', { type: 'button', class: 'hm-lw', onclick: function () { showPlayer(a.p); }, title: 'Compare ' + a.name },
          helm(a.team), h('b', { class: 'hm-ln', text: a.name }), h('b', { class: 'hm-lv', text: num(a.v) })),
        rest.length ? h('span', { class: 'hm-lnext', text: 'Next: ' + rest.map(function (x) { return x.name + ' ' + num(x.v); }).join(' · ') }) : null);
    })), 'hm-card');
  }

  function injuryBox(data, week, games) {
    var out = [];
    games.forEach(function (g) {
      [g.away, g.home].forEach(function (code) {
        NG.injuries(data, code, week).forEach(function (x) {
          if ((x.status === 'Out' || x.status === 'Doubtful') && /^(QB|RB|WR|TE)$/.test(x.pos)) out.push({ x: x, team: code });
        });
      });
    });
    var order = { QB: 0, RB: 1, WR: 2, TE: 3 };
    out.sort(function (a, b) { return order[a.x.pos] - order[b.x.pos] || (a.x.status === 'Out' ? -1 : 1); });
    var body = out.length ? h('ul', { class: 'hm-inj' }, out.slice(0, 10).map(function (o) {
      return h('li', null, h('span', { class: 'hm-is ' + (o.x.status === 'Out' ? 'out' : 'dbt'), text: o.x.status }),
        h('span', null, h('b', { text: o.x.name }), h('small', { text: ' ' + o.x.pos + ' · ' + o.team + ' · ' + (o.x.injury || 'not listed').toLowerCase() })));
    })) : h('p', { class: 'hm-note', text: 'No quarterbacks, running backs, receivers or tight ends are listed Out or Doubtful yet.' });
    return sect('Injury watch · Week ' + week, null, h('div', null, body, out.length > 10 ? h('p', { class: 'hm-note', text: '+' + (out.length - 10) + ' more in Games' }) : null,
      h('p', { class: 'hm-note', text: 'Skill-position players listed Out or Doubtful on each team\'s final report.' })), 'hm-card');
  }

  function historyBox() {
    var hg = historyGame();
    if (!hg) return null;
    var g = hg.g, w = NG.winner(g), l = w === g.home ? g.away : g.home, tie = w === 'TIE';
    var d = new Date(g.date + 'T12:00:00Z');
    var title, desc;
    if (hg.kind === 'upset') {
      title = 'The ' + nick(w, g.season) + ' stun the ' + nick(l, g.season) + ' ' + Math.max(g.hs, g.as) + '–' + Math.min(g.hs, g.as);
      desc = 'The ' + NG.teamName(w, g.season) + ' won ' + (w === g.home ? 'at home' : 'on the road') + ' as ' + Math.abs(g.spread) + '-point underdogs' + (g.type ? ' in the ' + NG.roundName(g) : '') + '.';
    } else {
      title = tie ? 'The ' + nick(g.away, g.season) + ' and ' + nick(g.home, g.season) + ' tie in a ' + (g.hs + g.as) + '-point game'
        : 'The ' + nick(w, g.season) + ' beat the ' + nick(l, g.season) + ' ' + Math.max(g.hs, g.as) + '–' + Math.min(g.hs, g.as);
      desc = (g.hs + g.as) + ' points' + (g.ot ? ' and overtime' : '') + ': the most in any game played this week of the year since 1999' + (g.total != null ? '. The over/under was ' + g.total + '.' : '.');
    }
    return h('article', { class: 'hm-hist' },
      h('div', { class: 'hm-hdate', 'aria-hidden': 'true' }, h('span', { text: d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', timeZone: 'UTC' }) }), h('b', { text: String(d.getUTCFullYear()) })),
      h('div', { class: 'hm-hbody' },
        h('span', { class: 'hm-kk gold', text: 'This week in NFL history · ' + d.toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' }) }),
        h('h2', { text: title }),
        h('p', { text: desc }),
        h('div', { class: 'hm-acts' },
          h('a', { class: 'hm-btn yt', href: 'https://www.youtube.com/results?search_query=' + encodeURIComponent(g.season + ' ' + NG.teamName(g.away, g.season) + ' vs ' + NG.teamName(g.home, g.season) + ' highlights'), target: '_blank', rel: 'noopener' }, h('span', { class: 'mo-play', 'aria-hidden': 'true' }), 'Watch on YouTube'),
          h('button', { type: 'button', class: 'hm-btn ghost', text: 'Box score', onclick: function () { openGame(g); } }),
          window.NFLMoments ? h('button', { type: 'button', class: 'hm-btn ghost', text: 'More moments', onclick: function () { go('moments'); } }) : null)));
  }

  function promos() {
    var qs = ['Who leads the NFL in passing yards this season?', 'Who won Super Bowl MVP in 2009?', 'Mahomes vs Allen career'];
    return h('div', { class: 'hm-promos' },
      window.NFLTrivia ? h('button', { type: 'button', class: 'hm-promo trivia', onclick: function () { go('trivia'); } },
        h('span', { class: 'hm-pi', 'aria-hidden': 'true', text: '?' }),
        h('span', null, h('b', { text: 'Play trivia' }), h('small', { text: '10 questions from every season since 1999' }))) : null,
      h('div', { class: 'hm-promo luna' },
        h('span', { class: 'lav', 'aria-hidden': 'true' }),
        h('span', { class: 'hm-lq' }, h('b', { text: 'Ask Luna' }), h('small', { text: 'Your voice guide to every stat on this site' }),
          h('span', { class: 'hm-chips' }, qs.map(function (q) { return h('button', { type: 'button', class: 'chip', text: q, onclick: function () { askLuna(q); } }); })))),
      installCard());
  }

  // ---------------------------------------------------------------- install as an app
  var deferredPrompt = null;
  window.addEventListener('beforeinstallprompt', function (e) { e.preventDefault(); deferredPrompt = e; var c = document.getElementById('hminstall'); if (c) c.replaceWith(installCard()); });
  function standalone() { return (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) || window.navigator.standalone === true; }
  function installCard() {
    if (standalone()) return null;
    var ios = /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    var how = deferredPrompt ? null : h('small', { text: ios ? 'In Safari, tap Share, then Add to Home Screen.' : 'In your browser menu, choose Install app or Add to Home screen.' });
    return h('div', { class: 'hm-promo install', id: 'hminstall' },
      h('img', { src: 'icons/icon-192.png', alt: '', width: 44, height: 44 }),
      h('span', null, h('b', { text: 'Get the app' }), h('small', { text: 'Put NFL Player Compare on your home screen. It opens full screen and works offline.' }), how),
      deferredPrompt ? h('button', { type: 'button', class: 'hm-btn gold', text: 'Install', onclick: function () {
        var p = deferredPrompt; deferredPrompt = null;
        p.prompt();
        (p.userChoice || Promise.resolve()).then(function () { var c = document.getElementById('hminstall'); if (c) c.replaceWith(installCard() || h('span')); });
      } }) : null);
  }

  // ---------------------------------------------------------------- page
  function render() {
    if (!host) return;
    var lw = latestWeek();
    var stories = lw ? lw.news.map(story).sort(function (a, b) { return b.rank - a.rank; }) : [];
    var main = h('div', { class: 'hm-main' });
    var side = h('aside', { class: 'hm-side', 'aria-label': 'Standings, leaders and injuries' });
    if (stories.length) {
      main.append(lead(stories[0]));
      if (stories.length > 1) main.append(h('div', { class: 'hm-stories' }, stories.slice(1, 4).map(storyCard)));
    }
    var perfSlot = h('div', { id: 'hmperf' });
    if (lw) main.append(sect(weekLabel(lw.games[0]) + ' top performers', more('Compare players', function () { go('players'); }), perfSlot));
    var ln = lines(); if (ln) main.append(ln);
    var hist = historyBox(); if (hist) main.append(hist);
    main.append(promos());
    if (T) side.append(standingsBox());
    side.append(leadersBox());
    var injSlot = h('div', { id: 'hminj' });
    side.append(injSlot);
    host.replaceChildren(ticker(), h('div', { class: 'hm-grid' }, main, side));

    // box scores and injury reports live in the per-season files
    if (lw) NG.loadSeason(lw.season).then(function (data) {
      perfSlot.replaceChildren(performers(lw, data));
      stories.slice(0, 4).forEach(function (s, i) {
        var b = bestLine(NG.boxLines(data, s.g), s.g);
        if (!b) return;
        var txt = b.name + ' (' + b.pos + ', ' + (b.side === 1 ? s.g.home : s.g.away) + '): ' + lineText(b) + '.';
        var el = i === 0 ? document.getElementById('hmleaddesc') : host.querySelector('.hm-sdesc[data-g="' + s.g.id + '"]');
        if (el) el.textContent = txt + ' ' + bettingText(s.g);
      });
    }).catch(function () { perfSlot.replaceChildren(h('p', { class: 'hm-note', text: 'Box scores could not be loaded right now.' })); });
    var cw = NG.currentWeek();
    var cg = NG.games.filter(function (g) { return g.season === cw.season && g.week === cw.week && !g.played; });
    if (cg.length) NG.loadSeason(cw.season).then(function (data) { injSlot.replaceChildren(injuryBox(data, cw.week, cg)); }).catch(function () { /* injuries are optional */ });
  }
  function refreshTicker() {
    var t = document.getElementById('hmtick');
    if (t && host && host.isConnected && !host.hidden) t.replaceWith(ticker());
  }
  function mount(el) {
    host = el;
    if (NG.live.listeners.indexOf(refreshTicker) < 0) NG.live.listeners.push(refreshTicker);
    render();
    if (NG.live.ok === null || Date.now() - NG.live.at > 30000) NG.fetchLive();
  }
  window.NFLHome = { mount: mount, story: story, latestWeek: latestWeek, historyGame: historyGame, standings: standings, leaders: leaders };
})();
