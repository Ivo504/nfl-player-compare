/* NFL Player Compare: Games view. Scores, betting lines, box scores and injury reports for every game since 1999,
   plus a live tracker for this week's games. Depends on window.NFL_GAMES (games.js), window.Core, window.TCore.
   Box scores and injury reports load per season from games/<season>.js. Live scores come from ESPN's public scoreboard. */
(function () {
  'use strict';
  var GD = window.NFL_GAMES, C = window.Core, T = window.TCore;
  if (!GD || !C) return;
  var F = {};
  GD.fields.forEach(function (k, i) { F[k] = i; });
  var NAMES = GD.names;
  var TYPES = ['Regular season', 'Wild Card', 'Divisional', 'Conference Championship', 'Super Bowl'];
  var FRANCHISE = { OAK: 'LV', SD: 'LAC', STL: 'LA' };
  var OLDNAME = { OAK: 'Oakland Raiders', SD: 'San Diego Chargers', STL: 'St. Louis Rams' };
  var ESPN = 'https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard';
  var ESPNCODE = { WSH: 'WAS', LAR: 'LA' };

  // ---------------------------------------------------------------- data
  var games = GD.games.map(function (r, i) {
    var g = {};
    GD.fields.forEach(function (k, j) { g[k] = r[j]; });
    g.i = i;
    g.played = g.hs != null && g.as != null;
    return g;
  });
  var byId = new Map(games.map(function (g) { return [g.id, g]; }));
  var SEASONS = Array.from(new Set(games.map(function (g) { return g.season; }))).sort(function (a, b) { return b - a; });
  function fr(code) { return FRANCHISE[code] || code; }
  function teamIdx(code) { return T ? T.byAbbr.get(fr(code)) : null; }
  function teamName(code, season) {
    if (OLDNAME[code]) return OLDNAME[code];
    if (code === 'LA' && season && season < 2016) return 'Los Angeles Rams';
    var t = teamIdx(code);
    return t != null ? T.teams[t][1] : code;
  }
  function shortName(code, season) { var n = teamName(code, season); return n.split(' ').slice(-1)[0]; }
  function teamColor(code) { var t = teamIdx(code); return t != null ? T.teams[t][4] : '#888'; }
  function person(i) { return i >= 0 ? NAMES[i] : null; }
  function isTeam(g, code) { return fr(g.home) === fr(code) || fr(g.away) === fr(code); }
  function winner(g) { return !g.played ? null : g.hs > g.as ? g.home : g.as > g.hs ? g.away : 'TIE'; }
  function roundName(g) { return g.type ? TYPES[g.type] : 'Week ' + g.week; }

  // betting: nflverse spread_line is the home team's margin as favorite (positive = home favored)
  function spreadText(g) {
    if (g.spread == null) return null;
    if (g.spread === 0) return 'Pick\'em';
    var fav = g.spread > 0 ? g.home : g.away;
    return fav + ' −' + Math.abs(g.spread);
  }
  function coverText(g) {
    if (!g.played || g.spread == null) return null;
    var res = g.hs - g.as;
    if (res === g.spread) return 'Push';
    return (res > g.spread ? g.home : g.away) + ' covered';
  }
  function totalText(g) {
    if (!g.played || g.total == null) return null;
    var pts = g.hs + g.as;
    return pts === g.total ? 'Push (' + pts + ')' : (pts > g.total ? 'Over' : 'Under') + ' (' + pts + ' points)';
  }
  function ml(v) { return v == null ? '–' : v > 0 ? '+' + v : '−' + Math.abs(v); }

  // ---------------------------------------------------------------- season files (box scores, injuries)
  var loading = {};
  function loadSeason(season) {
    window.NFL_G = window.NFL_G || {};
    if (window.NFL_G[season]) return Promise.resolve(window.NFL_G[season]);
    if (loading[season]) return loading[season];
    loading[season] = new Promise(function (res, rej) {
      var s = document.createElement('script');
      s.src = 'games/' + season + '.js';
      s.onload = function () { window.NFL_G[season] ? res(window.NFL_G[season]) : rej(new Error('empty')); };
      s.onerror = function () { delete loading[season]; rej(new Error('Could not load ' + season)); };
      document.head.append(s);
    });
    return loading[season];
  }
  function boxLines(data, g) {
    var f = data.boxf;
    return (data.box[g.id] || []).map(function (r) {
      var o = { p: r[0], side: r[1], name: C.players[r[0]][1], pos: C.players[r[0]][2] };
      f.forEach(function (k, i) { o[k] = r[i + 2] || 0; });
      return o;
    });
  }
  function injuries(data, code, week) {
    var list = data.inj[code + '|' + week] || data.inj[fr(code) + '|' + week] || [];
    return list.map(function (x) { return { name: x[0], p: x[1], pos: x[2], injury: x[3], status: x[4], injury2: x[5] }; });
  }

  // ---------------------------------------------------------------- search (shared with Luna)
  // q: { teams:[codes], season, week, type, played }
  function find(q) {
    return games.filter(function (g) {
      if (q.season != null && g.season !== q.season) return false;
      if (q.from != null && g.season < q.from) return false;
      if (q.to != null && g.season > q.to) return false;
      if (q.week != null && g.week !== q.week) return false;
      if (q.type != null && (q.type === 'post' ? g.type === 0 : g.type !== q.type)) return false;
      if (q.teams) for (var i = 0; i < q.teams.length; i++) if (!isTeam(g, q.teams[i])) return false;
      if (q.played != null && g.played !== q.played) return false;
      return true;
    });
  }

  // ---------------------------------------------------------------- live (ESPN public scoreboard)
  var live = { at: 0, events: {}, ok: null, timer: null, listeners: [] };
  function liveKey(season, away, home) { return season + '|' + fr(away) + '|' + fr(home); }
  function fetchLive() {
    if (!window.fetch) return Promise.resolve(live);
    return fetch(ESPN, { cache: 'no-store' }).then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); }).then(function (j) {
      var ev = {}, season = j.season && j.season.year;
      (j.events || []).forEach(function (e) {
        var c = e.competitions && e.competitions[0];
        if (!c) return;
        var side = {};
        c.competitors.forEach(function (t) { var ab = t.team && t.team.abbreviation; side[t.homeAway] = { code: ESPNCODE[ab] || ab, score: t.score != null ? +t.score : null, rec: t.records && t.records[0] && t.records[0].summary }; });
        if (!side.home || !side.away) return;
        var st = e.status && e.status.type || {};
        var odds = c.odds && c.odds[0];
        ev[liveKey(season, side.away.code, side.home.code)] = {
          state: st.state, detail: st.shortDetail || st.detail || '', away: side.away, home: side.home,
          odds: odds ? { details: odds.details, ou: odds.overUnder } : null,
          broadcast: (c.broadcasts && c.broadcasts[0] && c.broadcasts[0].names || []).join(', ')
        };
      });
      live.events = ev; live.ok = true; live.at = Date.now();
      return live;
    }).catch(function () { live.ok = false; return live; }).then(function (l) {
      live.listeners.forEach(function (fn) { fn(l); });
      schedule();
      return l;
    });
  }
  function anyInProgress() { return Object.keys(live.events).some(function (k) { return live.events[k].state === 'in'; }); }
  function schedule() {
    clearTimeout(live.timer);
    if (document.hidden) return;
    live.timer = setTimeout(fetchLive, anyInProgress() ? 30000 : 300000);
  }
  document.addEventListener('visibilitychange', function () { if (!document.hidden && live.listeners.length) fetchLive(); });
  function liveFor(g) { return live.events[liveKey(g.season, g.away, g.home)] || null; }

  // the week to track: the earliest week of the latest season that still has unplayed games, else the last week played
  function currentWeek() {
    var s = SEASONS[0], sg = games.filter(function (g) { return g.season === s; });
    var open = sg.filter(function (g) { return !g.played; });
    var today = new Date().toISOString().slice(0, 10);
    // a week counts as current while its games are within a day of today
    var weeks = Array.from(new Set(sg.map(function (g) { return g.week; }))).sort(function (a, b) { return a - b; });
    for (var i = 0; i < weeks.length; i++) {
      var wg = sg.filter(function (g) { return g.week === weeks[i]; });
      var last = wg.reduce(function (m, g) { return g.date > m ? g.date : m; }, '');
      if (last >= addDays(today, -1)) return { season: s, week: weeks[i] };
    }
    if (open.length) return { season: s, week: open[0].week };
    return { season: s, week: weeks[weeks.length - 1] };
  }
  function addDays(iso, n) { var d = new Date(iso + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); }
  function upcoming(code, n) {
    var today = new Date().toISOString().slice(0, 10);
    return games.filter(function (g) { return !g.played && g.date >= addDays(today, -1) && (!code || isTeam(g, code)); })
      .sort(function (a, b) { return (a.date + a.time).localeCompare(b.date + b.time); }).slice(0, n || 16);
  }
  // kickoff times in nflverse are US Eastern
  function kickoff(g) {
    if (!g.date) return '';
    var d = new Date(g.date + 'T' + (g.time || '13:00') + ':00-05:00');
    // Eastern daylight time runs from the second Sunday of March to the first Sunday of November
    var y = +g.date.slice(0, 4), m = +g.date.slice(5, 7), day = +g.date.slice(8, 10);
    var dst = m > 3 && m < 11 || (m === 3 && day >= 8) || (m === 11 && day < 7);
    if (dst) d = new Date(g.date + 'T' + (g.time || '13:00') + ':00-04:00');
    if (isNaN(d)) return g.date;
    return d.toLocaleString(undefined, { weekday: 'short', month: 'short', day: 'numeric', hour: g.time ? 'numeric' : undefined, minute: g.time ? '2-digit' : undefined });
  }
  function dateText(g) {
    var d = new Date(g.date + 'T12:00:00Z');
    return isNaN(d) ? g.date : d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
  }

  // ---------------------------------------------------------------- UI helpers
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
  function $(id) { return document.getElementById(id); }

  var G = { season: null, week: 'all', team: '', open: null };
  var KEY = 'nflcompare.games';
  try { var sv = JSON.parse(localStorage.getItem(KEY) || 'null'); if (sv) { G.season = sv.season; G.week = sv.week; G.team = sv.team; } } catch (e) { /* storage unavailable */ }
  function saveG() { try { localStorage.setItem(KEY, JSON.stringify({ season: G.season, week: G.week, team: G.team })); } catch (e) { /* storage unavailable */ } }

  function teamChip(code, season, score, won) {
    return h('div', { class: 'gt' + (won ? ' won' : ''), style: '--tc:' + teamColor(code) },
      h('span', { class: 'gtab', text: code }), h('span', { class: 'gtn', text: shortName(code, season) }),
      score != null ? h('b', { class: 'gts', text: String(score) }) : null);
  }
  function card(g, opts) {
    var lv = liveFor(g), w = winner(g);
    var as = g.as, hs = g.hs, status = g.played ? (g.ot ? 'Final/OT' : 'Final') : kickoff(g);
    var isLive = lv && lv.state === 'in';
    if (lv && (lv.state === 'in' || (lv.state === 'post' && !g.played))) { as = lv.away.score; hs = lv.home.score; status = lv.detail; if (lv.state === 'post') w = hs > as ? g.home : as > hs ? g.away : 'TIE'; }
    var line = [];
    var sp = spreadText(g);
    if (sp) line.push(sp); else if (lv && lv.odds && lv.odds.details) line.push(lv.odds.details);
    if (g.total != null) line.push('O/U ' + g.total); else if (lv && lv.odds && lv.odds.ou) line.push('O/U ' + lv.odds.ou);
    if (!g.played && (g.aml != null || g.hml != null)) line.push('ML ' + g.away + ' ' + ml(g.aml) + ' / ' + g.home + ' ' + ml(g.hml));
    var res = [coverText(g), g.played && g.total != null ? totalText(g).replace(/ \(.*/, '') : null].filter(Boolean);
    return h('button', { type: 'button', class: 'gcard' + (isLive ? ' live' : '') + (G.open === g.id ? ' sel' : ''), 'data-g': g.id, onclick: function () { openGame(g.id); } },
      h('div', { class: 'gmeta' }, isLive ? h('span', { class: 'lbadge', text: 'LIVE' }) : null, h('span', { text: (opts && opts.noRound ? '' : roundName(g) + ' · ') + status })),
      teamChip(g.away, g.season, as, w === g.away),
      teamChip(g.home, g.season, hs, w === g.home),
      line.length ? h('div', { class: 'gline', text: line.join(' · ') }) : null,
      res.length ? h('div', { class: 'gres', text: res.join(' · ') }) : null);
  }

  // ---------------------------------------------------------------- views
  var host;
  function render() {
    if (!host) return;
    host.replaceChildren(tracker(), browser());
    if (G.open) renderDetail(false);
  }
  // live updates only touch the scoreboard cards, never the open game or the scroll position
  function refreshLive() {
    if (!host || !host.isConnected) return;
    var tr = $('gtrack');
    if (tr) tr.replaceWith(tracker());
    Array.prototype.forEach.call(host.querySelectorAll('#gbrowse .gcard'), function (b) {
      var g = byId.get(b.getAttribute('data-g'));
      if (g && liveFor(g)) b.replaceWith(card(g, { noRound: true }));
    });
  }
  function tracker() {
    var cw = currentWeek();
    var wg = games.filter(function (g) { return g.season === cw.season && g.week === cw.week; });
    var box = h('section', { class: 'gsec gtrack', id: 'gtrack', 'aria-label': 'This week' },
      h('div', { class: 'gsh' }, h('h2', { text: cw.season + ' · ' + (wg[0] ? roundName(wg[0]) : 'Week ' + cw.week) }),
        h('span', { class: 'gstat', id: 'livestat', text: liveStatus() }),
        h('button', { type: 'button', class: 'chip', text: 'Refresh', onclick: function () { $('livestat').textContent = 'Checking for live scores…'; fetchLive(); } })),
      h('div', { class: 'ggrid' }, wg.map(function (g) { return card(g, { noRound: true }); })));
    return box;
  }
  function liveStatus() {
    if (live.ok === null) return 'Checking for live scores…';
    if (!live.ok) return 'Live scores unavailable right now. Showing the latest daily update.';
    var n = Object.keys(live.events).filter(function (k) { return live.events[k].state === 'in'; }).length;
    return (n ? n + ' game' + (n > 1 ? 's' : '') + ' live · updates every 30 seconds' : 'Live scores on · no games in progress') + ' · checked ' + new Date(live.at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  }
  function browser() {
    if (G.season == null || SEASONS.indexOf(+G.season) < 0) { var cw = currentWeek(); G.season = cw.season; G.week = String(cw.week); }
    var sg = games.filter(function (g) { return g.season === +G.season; });
    var weeks = Array.from(new Set(sg.map(function (g) { return g.week; }))).sort(function (a, b) { return a - b; });
    var seasonSel = h('select', { 'aria-label': 'Season', onchange: function (e) { G.season = +e.target.value; G.week = 'all'; G.open = null; saveG(); render(); } },
      SEASONS.map(function (s) { return h('option', { value: s, text: s + ' season' }); }));
    seasonSel.value = G.season;
    var weekSel = h('select', { 'aria-label': 'Week', onchange: function (e) { G.week = e.target.value; G.open = null; saveG(); render(); } },
      h('option', { value: 'all', text: 'All weeks' }), h('option', { value: 'post', text: 'All playoffs' }),
      weeks.map(function (w) { var g = sg.filter(function (x) { return x.week === w; })[0]; return h('option', { value: w, text: g.type ? TYPES[g.type] : 'Week ' + w }); }));
    weekSel.value = String(G.week);
    var teamSel = h('select', { 'aria-label': 'Team', onchange: function (e) { G.team = e.target.value; G.open = null; saveG(); render(); } },
      h('option', { value: '', text: 'All teams' }), T ? T.teams.map(function (t) { return h('option', { value: t[0], text: t[1] }); }) : null);
    teamSel.value = G.team || '';
    var list = sg.filter(function (g) {
      if (G.week === 'post' && !g.type) return false;
      if (G.week !== 'all' && G.week !== 'post' && g.week !== +G.week) return false;
      if (G.team && !isTeam(g, G.team)) return false;
      return true;
    });
    var groups = [], cur = null;
    list.forEach(function (g) { if (!cur || cur.w !== g.week) { cur = { w: g.week, label: roundName(g), items: [] }; groups.push(cur); } cur.items.push(g); });
    var summary = null;
    if (G.team) {
      var rec = { w: 0, l: 0, t: 0, cov: 0, ncov: 0, push: 0 };
      list.forEach(function (g) {
        if (!g.played) return;
        var w = winner(g);
        if (w === 'TIE') rec.t++; else if (fr(w) === fr(G.team)) rec.w++; else rec.l++;
        var c = coverText(g);
        if (c === 'Push') rec.push++; else if (c) { if (fr(c.split(' ')[0]) === fr(G.team)) rec.cov++; else rec.ncov++; }
      });
      summary = h('p', { class: 'hint', text: teamName(G.team) + ': ' + rec.w + '–' + rec.l + (rec.t ? '–' + rec.t : '') + ' in these games · against the spread ' + rec.cov + '–' + rec.ncov + (rec.push ? '–' + rec.push : '') + '.' });
    }
    return h('section', { class: 'gsec', id: 'gbrowse', 'aria-label': 'Find a game' },
      h('div', { class: 'gsh' }, h('h2', { text: 'Every game since 1999' })),
      h('div', { class: 'gfilters' }, seasonSel, weekSel, teamSel),
      summary,
      list.length ? groups.map(function (gr) { return h('div', { class: 'gwk' }, h('h3', { class: 'lbl', text: gr.label }), h('div', { class: 'ggrid' }, gr.items.map(function (g) { return card(g, { noRound: true }); }))); })
        : h('p', { class: 'empty', text: 'No games match.' }),
      h('div', { id: 'gdetail' }));
  }

  function openGame(id) {
    G.open = id;
    Array.prototype.forEach.call(document.querySelectorAll('.gcard'), function (b) { b.classList.toggle('sel', b.getAttribute('data-g') === id); });
    renderDetail(true);
  }
  function statTable(title, cols, rows) {
    if (!rows.length) return null;
    return h('div', { class: 'tablewrap' }, h('table', { class: 'cmp gbox' },
      h('thead', null, h('tr', null, h('th', { scope: 'col', class: 'l', text: title }), cols.map(function (c) { return h('th', { scope: 'col', text: c[0] }); }))),
      h('tbody', null, rows.map(function (r) { return h('tr', null, h('th', { scope: 'row', class: 'l' }, r.name, h('span', { class: 'gpos', text: ' ' + r.pos })), cols.map(function (c) { return h('td', { text: typeof c[1] === 'function' ? c[1](r) : String(r[c[1]]) }); })); }))));
  }
  function teamBox(lines, side) {
    var L = lines.filter(function (x) { return x.side === side; });
    function by(k) { return L.filter(function (x) { return x[k] > 0; }).sort(function (a, b) { return b[k] - a[k]; }); }
    return [
      statTable('Passing', [['C/Att', function (r) { return r.cmp + '/' + r.att; }], ['Yds', 'pyd'], ['TD', 'ptd'], ['INT', 'int'], ['Sck', 'sck']], by('att')),
      statTable('Rushing', [['Car', 'car'], ['Yds', 'ryd'], ['TD', 'rtd'], ['Avg', function (r) { return r.car ? (r.ryd / r.car).toFixed(1) : '–'; }]], by('car')),
      statTable('Receiving', [['Rec', 'rec'], ['Tgt', 'tgt'], ['Yds', 'cyd'], ['TD', 'ctd']], L.filter(function (x) { return x.tgt > 0 || x.rec > 0; }).sort(function (a, b) { return b.cyd - a.cyd; })),
      statTable('Defense', [['Tkl', 'tkl'], ['Sck', 'dsk'], ['INT', 'dint'], ['FF', 'ff']], L.filter(function (x) { return x.tkl + x.dsk + x.dint + x.ff > 0 && C.players[x.p][3] === 'DEF'; }).sort(function (a, b) { return (b.dsk * 3 + b.dint * 4 + b.tkl) - (a.dsk * 3 + a.dint * 4 + a.tkl); }).slice(0, 8)),
      statTable('Kicking', [['FG', function (r) { return r.fgm + '/' + r.fga; }], ['XP', function (r) { return r.xpm + '/' + r.xpa; }]], L.filter(function (x) { return x.fga + x.xpa > 0; }))
    ];
  }
  function injList(list, code, season) {
    var order = { Out: 0, Doubtful: 1, Questionable: 2, Probable: 3, 'Did not practice': 4, 'Limited practice': 5, 'Full practice': 6 };
    list = list.slice().sort(function (a, b) { return (order[a.status] == null ? 9 : order[a.status]) - (order[b.status] == null ? 9 : order[b.status]); });
    return h('div', { class: 'ginj' }, h('h4', { text: teamName(code, season) }),
      list.length ? h('ul', null, list.map(function (x) { return h('li', null, h('span', { class: 'ist s' + (x.status || '').toLowerCase().replace(/ /g, ''), text: x.status }), h('b', { text: x.name }), ' ' + (x.pos || '') + (x.injury ? ' · ' + x.injury + (x.injury2 ? ', ' + x.injury2 : '') : '')); }))
        : h('p', { class: 'note', text: 'No players listed.' }));
  }
  function renderDetail(scroll) {
    var box = $('gdetail'), g = byId.get(G.open);
    if (!box || !g) return;
    var w = winner(g), lv = liveFor(g);
    var info = [dateText(g), person(g.stadium), g.roof ? g.roof.replace('outdoors', 'outdoor').replace('dome', 'dome') : null,
      g.temp != null ? g.temp + '°F' : null, g.wind != null ? 'wind ' + g.wind + ' mph' : null].filter(Boolean).join(' · ');
    var bet = h('div', { class: 'gbet' },
      h('div', null, h('span', { class: 'lbl', text: 'Spread' }), h('b', { text: spreadText(g) || (lv && lv.odds && lv.odds.details) || '–' }), h('span', { text: coverText(g) || '' })),
      h('div', null, h('span', { class: 'lbl', text: 'Total' }), h('b', { text: g.total != null ? 'O/U ' + g.total : (lv && lv.odds && lv.odds.ou ? 'O/U ' + lv.odds.ou : '–') }), h('span', { text: totalText(g) || '' })),
      h('div', null, h('span', { class: 'lbl', text: 'Moneyline' }), h('b', { text: g.away + ' ' + ml(g.aml) + ' · ' + g.home + ' ' + ml(g.hml) }),
        h('span', { text: g.aml == null && g.hml == null ? 'Not available before 2006' : '' })));
    var people = h('p', { class: 'note', text: [person(g.aqb) && 'QBs: ' + person(g.aqb) + ' (' + g.away + '), ' + person(g.hqb) + ' (' + g.home + ')', person(g.acoach) && 'Coaches: ' + person(g.acoach) + ', ' + person(g.hcoach)].filter(Boolean).join(' · ') });
    var head = h('div', { class: 'gdh' },
      h('div', { class: 'gdteam' + (w === g.away ? ' won' : ''), style: '--tc:' + teamColor(g.away) }, h('span', { text: teamName(g.away, g.season) }), h('b', { text: g.played ? String(g.as) : lv && lv.away.score != null ? String(lv.away.score) : '' })),
      h('div', { class: 'gdmid', text: g.played ? (g.ot ? 'Final/OT' : 'Final') : lv ? lv.detail : kickoff(g) }),
      h('div', { class: 'gdteam home' + (w === g.home ? ' won' : ''), style: '--tc:' + teamColor(g.home) }, h('b', { text: g.played ? String(g.hs) : lv && lv.home.score != null ? String(lv.home.score) : '' }), h('span', { text: teamName(g.home, g.season) })));
    var body = h('div', { class: 'gdbody' }, h('p', { class: 'note', text: 'Loading box score and injury report…' }));
    box.replaceChildren(h('section', { class: 'gdetail', 'aria-label': 'Game details' },
      h('div', { class: 'gsh' }, h('h2', { text: g.season + ' ' + roundName(g) + (g.div ? ' · division game' : '') }), h('button', { type: 'button', class: 'x', 'aria-label': 'Close game details', text: '×', onclick: function () { G.open = null; box.replaceChildren(); Array.prototype.forEach.call(document.querySelectorAll('.gcard.sel'), function (b) { b.classList.remove('sel'); }); } })),
      head, h('p', { class: 'hint', text: info }), bet, people, body));
    if (scroll) box.scrollIntoView({ behavior: 'smooth', block: 'start' });
    loadSeason(g.season).then(function (data) {
      if (G.open !== g.id) return;
      var lines = boxLines(data, g);
      var kids = [];
      if (lines.length) kids.push(h('div', { class: 'gcols' },
        h('div', null, h('h3', { class: 'gteamh', style: '--tc:' + teamColor(g.away), text: teamName(g.away, g.season) }), teamBox(lines, 0)),
        h('div', null, h('h3', { class: 'gteamh', style: '--tc:' + teamColor(g.home), text: teamName(g.home, g.season) }), teamBox(lines, 1))));
      else kids.push(h('p', { class: 'note', text: g.played ? 'No player stats for this game yet.' : 'Player stats appear after the game.' }));
      if (g.season >= 2009) kids.push(h('h3', { class: 'lbl', text: 'Injury report' }),
        h('div', { class: 'gcols' }, injList(injuries(data, g.away, g.week), g.away, g.season), injList(injuries(data, g.home, g.week), g.home, g.season)),
        h('p', { class: 'note', text: 'Final injury report before the game. Out and Doubtful players usually did not play; players with only a practice status were expected to play.' }));
      else kids.push(h('p', { class: 'note', text: 'Injury reports are available from 2009 on.' }));
      body.replaceChildren.apply(body, kids);
    }).catch(function () { body.replaceChildren(h('p', { class: 'note', text: 'Could not load the box score. Check your connection and try again.' })); });
  }

  function mount(el) {
    host = el;
    if (!live.listeners.length) live.listeners.push(refreshLive);
    render();
    if (live.ok === null || Date.now() - live.at > 30000) fetchLive();
  }

  window.NFLGames = {
    games: games, byId: byId, seasons: SEASONS, find: find, loadSeason: loadSeason, boxLines: boxLines, injuries: injuries,
    winner: winner, spreadText: spreadText, coverText: coverText, totalText: totalText, ml: ml, teamName: teamName, roundName: roundName,
    fr: fr, isTeam: isTeam, upcoming: upcoming, kickoff: kickoff, dateText: dateText, currentWeek: currentWeek, liveFor: liveFor, fetchLive: fetchLive, live: live,
    mount: mount, open: function (id) { var g = byId.get(id); if (!g) return; G.season = g.season; G.week = String(g.week); G.team = ''; G.open = id; saveG(); render(); renderDetail(true); }
  };
})();
