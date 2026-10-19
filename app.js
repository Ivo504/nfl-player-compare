/* NFL Player Compare: UI. Depends on window.NFL (data.js) and window.Core (core.js). */
(function () {
  'use strict';
  var C = window.Core, T = window.TCore;
  var MAXP = 4;
  var SVGNS = 'http://www.w3.org/2000/svg';
  var KEY = 'nflcompare.v1';

  function $(id) { return document.getElementById(id); }
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
    var kids = Array.prototype.slice.call(arguments, 2);
    kids.forEach(function (c) {
      if (Array.isArray(c)) c.forEach(function (x) { add(e, x); }); else add(e, c);
    });
    return e;
  }
  function add(e, c) {
    if (c == null || c === false) return;
    e.append(c.nodeType ? c : document.createTextNode(String(c)));
  }
  function sv(tag, attrs) {
    var e = document.createElementNS(SVGNS, tag);
    if (attrs) Object.keys(attrs).forEach(function (k) { if (attrs[k] != null) e.setAttribute(k, attrs[k]); });
    var kids = Array.prototype.slice.call(arguments, 2);
    kids.forEach(function (c) { if (Array.isArray(c)) c.forEach(function (x) { add(e, x); }); else add(e, c); });
    return e;
  }

  var GROUPS = [['ALL', 'All'], ['QB', 'QB'], ['RB', 'RB'], ['WR', 'WR'], ['TE', 'TE'], ['DEF', 'Defense'], ['K', 'K'], ['P', 'P']];
  var STYPES = [['REG', 'Regular season'], ['POST', 'Postseason'], ['ALL', 'Both']];
  var STLABEL = { REG: 'Regular season', POST: 'Postseason', ALL: 'Regular season + postseason' };
  var TABS = [['compare', 'Compare'], ['trends', 'Trends'], ['log', 'Season log']];

  var PRESETS_RAW = [
    ['Mahomes, Allen, Jackson, Burrow', [['Patrick Mahomes', 'QB'], ['Josh Allen', 'QB'], ['Lamar Jackson', 'QB'], ['Joe Burrow', 'QB']]],
    ['Brady, Manning, Brees', [['Tom Brady', 'QB'], ['Peyton Manning', 'QB'], ['Drew Brees', 'QB']]],
    ['Henry, Peterson, Barkley, McCaffrey', [['Derrick Henry', 'RB'], ['Adrian Peterson', 'RB'], ['Saquon Barkley', 'RB'], ['Christian McCaffrey', 'RB']]],
    ['Fitzgerald, Johnson, Jones, Adams', [['Larry Fitzgerald', 'WR'], ['Calvin Johnson', 'WR'], ['Julio Jones', 'WR'], ['Davante Adams', 'WR']]],
    ['Kelce, Gronkowski, Kittle, Andrews', [['Travis Kelce', 'TE'], ['Rob Gronkowski', 'TE'], ['George Kittle', 'TE'], ['Mark Andrews', 'TE']]],
    ['Donald, T.J. Watt, Garrett, Crosby', [['Aaron Donald', 'DEF'], ['T.J. Watt', 'DEF'], ['Myles Garrett', 'DEF'], ['Maxx Crosby', 'DEF']]],
    ['Tucker, Butker, Prater, Koo', [['Justin Tucker', 'K'], ['Harrison Butker', 'K'], ['Matt Prater', 'K'], ['Younghoe Koo', 'K']]]
  ];
  var PRESETS = PRESETS_RAW.map(function (p) {
    return { label: p[0], ids: p[1].map(function (n) { return C.findByName(n[0], n[1]); }).filter(function (i) { return i >= 0; }) };
  }).filter(function (p) { return p.ids.length >= 2; });

  var TPRESETS = [
    ['Patriots, Chiefs, Steelers, 49ers', ['NE', 'KC', 'PIT', 'SF']],
    ['Packers, Bears, Lions, Vikings', ['GB', 'CHI', 'DET', 'MIN']],
    ['Cowboys, Eagles, Giants, Commanders', ['DAL', 'PHI', 'NYG', 'WAS']],
    ['Ravens, Bengals, Browns, Steelers', ['BAL', 'CIN', 'CLE', 'PIT']]
  ].map(function (p) { return { label: p[0], ids: T ? p[1].map(function (a) { return T.byAbbr.get(a); }).filter(function (i) { return i != null; }) : [] }; });

  // Players and teams share the views; a model supplies the stats, names and aggregation for each.
  var MODELS = {
    players: {
      noun: 'player', years: C.years, CATS: C.CATS, DEFS: C.DEFS, aggregate: C.aggregate, seasonHonors: C.seasonHonors,
      autoCats: function (tots, ids) { return C.autoCats(tots, ids.map(function (p) { return C.players[p][3]; })); },
      name: function (p) { return C.players[p][1]; },
      sub: function (p, x) { return C.players[p][2] + ' · ' + spanText(x); }
    },
    teams: T ? {
      noun: 'team', years: T.years, CATS: T.CATS, DEFS: T.DEFS, aggregate: T.aggregate, seasonHonors: T.seasonHonors, autoCats: T.autoCats,
      name: function (t) { return T.teams[t][1]; },
      sub: function (t, x) { return T.teams[t][3] + ' · ' + spanText(x); }
    } : null
  };
  function M() { return MODELS[S.mode]; }

  var S = {
    mode: 'players', view: 'compare', picks: [], grp: 'ALL', st: 'REG', from: C.years[0], to: C.years[1], pg: false,
    cats: new Set(), manual: false, tab: 'compare', metric: null, xmode: 'cal', logp: null, example: false
  };
  // per-mode selections, so switching between players and teams keeps each side's picks
  var MODEKEYS = ['picks', 'from', 'to', 'cats', 'manual', 'metric', 'logp', 'example'];
  var STORE = { players: null, teams: null };
  var RO = null;
  var shown = new Set(); // player ids already on screen (so only new cards animate)
  var hiddenSlots = new Set(); // chart series turned off via the legend
  var TAB_ICONS = {
    compare: 'M4 6h16M4 12h16M4 18h16M10 4v16',
    trends: 'M3 17l6-6 4 4 8-8M15 7h6v6',
    log: 'M5 4h14v16H5zM9 8h6M9 12h6M9 16h4'
  };

  // ---------- persistence (per-viewer convenience only) ----------
  function save() {
    try {
      var pp = S.mode === 'players' ? S.picks : (STORE.players ? STORE.players.picks : []);
      var tp = S.mode === 'teams' ? S.picks : (STORE.teams ? STORE.teams.picks : []);
      localStorage.setItem(KEY, JSON.stringify({
        mode: S.mode, games: S.view === 'games', view: S.view,
        ids: pp.map(function (p) { return C.players[p.p][0]; }),
        tids: T ? tp.map(function (p) { return T.teams[p.p][0]; }) : [],
        st: S.st, pg: S.pg, tab: S.tab, xmode: S.xmode, from: S.from, to: S.to
      }));
    } catch (e) { /* storage unavailable */ }
  }
  function load() {
    try { return JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) { return null; }
  }

  // ---------- state helpers ----------
  function aggs() {
    return S.picks.map(function (pk) { return M().aggregate(pk.p, { st: S.st, from: S.from, to: S.to }); });
  }
  function freeSlot() {
    for (var s = 0; s < MAXP; s++) if (!S.picks.some(function (p) { return p.slot === s; })) return s;
    return -1;
  }
  function setPicks(ids) {
    S.picks = [];
    ids.slice(0, MAXP).forEach(function (p, i) { S.picks.push({ p: p, slot: i }); });
  }
  function addPlayer(p) {
    if (S.picks.length >= MAXP || S.picks.some(function (x) { return x.p === p; })) return;
    S.picks.push({ p: p, slot: freeSlot() });
    S.manual = false; S.example = false;
    update();
  }
  function removePlayer(p) {
    S.picks = S.picks.filter(function (x) { return x.p !== p; });
    S.manual = false; S.example = false;
    update();
  }
  function spanText(x) {
    if (!x.seasons.length) return 'no stats in range';
    var a = x.seasons[0].season, b = x.seasons[x.seasons.length - 1].season;
    return a === b ? String(a) : a + '–' + b;
  }
  function teamsText(x) { return x.tot.teams.length ? x.tot.teams.join('/') : ''; }

  function update() {
    var A = aggs();
    if (!S.manual) S.cats = M().autoCats(A.map(function (x) { return x.tot; }), S.picks.map(function (pk) { return pk.p; }));
    renderPicks(A);
    renderResults();
    syncControls();
    renderView(A);
    save();
  }


  // ---------- player card extras ----------
  function bioText(b) {
    if (!b) return '';
    var parts = [];
    if (b.college) parts.push(b.college);
    if (b.height) parts.push(Math.floor(b.height / 12) + '-' + (b.height % 12) + (b.weight ? ', ' + b.weight + ' lb' : ''));
    if (b.dyear) parts.push('Drafted ' + b.dyear + ', round ' + b.dround + ', pick ' + b.dpick + (b.dteam ? ' (' + b.dteam + ')' : ''));
    return parts.join(' \u00b7 ');
  }
  function times(n, label) { return n > 1 ? n + '\u00d7 ' + label : label; }
  function badgeList(hn) {
    var out = [];
    function badge(txt, title, cls) { out.push(h('span', { class: 'badge' + (cls ? ' ' + cls : ''), title: title || null, text: txt })); }
    if (hn.hof) badge('Hall of Fame', 'Pro Football Hall of Fame member', 'hof');
    if (hn.sbw.length) badge(times(hn.sbw.length, 'Super Bowl champion'), 'Super Bowl wins: ' + hn.sbw.join(', '), 'gold');
    C.awardList.forEach(function (a) {
      var ys = hn.aw[a.id];
      if (ys && ys.length) badge(times(ys.length, a.short), a.label + ': ' + ys.join(', '), 'aw');
    });
    if (hn.ap) badge(times(hn.ap, '1st-team All-Pro'), 'AP first-team All-Pro selections, whole career', 'aw');
    if (hn.pb) badge(times(hn.pb, 'Pro Bowl'), 'Pro Bowl selections, whole career');
    return out;
  }
  function linkRow(b) {
    if (!b) return null;
    var kids = [];
    if (b.espn) kids.push(h('a', { href: 'https://www.espn.com/nfl/player/_/id/' + encodeURIComponent(b.espn), target: '_blank', rel: 'noopener', text: 'Photo and bio (ESPN)' }));
    if (b.pfr) kids.push(h('a', { href: 'https://www.pro-football-reference.com/players/' + encodeURIComponent(b.pfr.charAt(0)) + '/' + encodeURIComponent(b.pfr) + '.htm', target: '_blank', rel: 'noopener', text: 'Full honors (PFR)' }));
    return kids.length ? h('div', { class: 'links' }, kids) : null;
  }

  // original helmet artwork (art.js) in a team's colors; falls back to nothing if art.js is missing
  function helmetBox(cls, code, label) {
    var d = h('div', { class: cls, 'aria-hidden': 'true' });
    if (window.Art && code) d.innerHTML = window.Art.helmet(code, { label: label });
    else if (label) d.textContent = label;
    return d;
  }
  // Super Bowl badges: confetti in the team's colors
  document.addEventListener('click', function (e) {
    var b = e.target.closest && e.target.closest('.badge.gold');
    if (!b || !window.Art) return;
    var card = b.closest('.pcard');
    window.Art.confetti(card || b.parentNode, ['#f7d774', getComputedStyle(card || b).getPropertyValue('--pc').trim() || '#e5484d']);
  });
  function initials(name) {
    var w = name.replace(/\b(Jr|Sr|II|III|IV)\.?$/i, '').trim().split(/\s+/);
    return ((w[0] || '').charAt(0) + (w.length > 1 ? w[w.length - 1].charAt(0) : '')).toUpperCase();
  }
  function posTag(pl) { return h('span', { class: 'pos g' + pl[3], text: pl[2] }); }

  // ---------- picker ----------
  function renderPicks(A) {
    var box = $('picks');
    box.replaceChildren();
    var teams = S.mode === 'teams';
    $('ppick').hidden = teams; $('tpick').hidden = !teams;
    if (teams) { renderTeamPicks(A, box); return; }
    A.forEach(function (x, i) {
      var pk = S.picks[i], pl = C.players[pk.p];
      var hn = C.honors(pk.p);
      var isNew = !shown.has(pk.p);
      box.append(h('div', { class: 'pcard k' + pk.slot + (isNew ? ' new' : '') },
        helmetBox('av helm', (pl[6] || '').split('/').pop(), initials(pl[1])),
        h('div', { class: 'pinfo' },
          h('div', { class: 'pn', text: pl[1] }),
          h('div', { class: 'pm' }, posTag(pl), ' ' + (teamsText(x) || pl[6]) + ' · ' + spanText(x)),
          bioText(hn.bio) ? h('div', { class: 'bio', text: bioText(hn.bio) }) : null,
          pl[7] ? h('div', { class: 'pill', text: 'Career began before 1999' }) : null,
          badgeList(hn).length ? h('div', { class: 'badges' }, badgeList(hn)) : null,
          linkRow(hn.bio)),
        h('button', { type: 'button', class: 'x', 'aria-label': 'Remove ' + pl[1], onclick: function () { removePlayer(pk.p); } }, '×')));
    });
    shown = new Set(S.picks.map(function (pk) { return pk.p; }));
    $('example').hidden = !S.example;
    $('example').textContent = 'Example comparison. Search above to swap in your own players.';
    var full = S.picks.length >= MAXP;
    $('q').disabled = full;
    $('q').placeholder = full ? 'Remove a player to add another' : 'Search ' + C.players.length.toLocaleString('en-US') + ' players: Mahomes, T.J. Watt, Fitzgerald';
  }
  function renderTeamPicks(A, box) {
    A.forEach(function (x, i) {
      var pk = S.picks[i], tm = T.teams[pk.p], tot = x.tot;
      var isNew = !shown.has(pk.p);
      var badges = [];
      if (tot.sbw) badges.push(h('span', { class: 'badge gold', text: times(tot.sbw, 'Super Bowl champion') }));
      if (tot.sba - tot.sbw > 0) badges.push(h('span', { class: 'badge aw', text: times(tot.sba - tot.sbw, 'Super Bowl loss') }));
      badges.push(h('span', { class: 'badge', text: tot.po + ' playoff season' + (tot.po === 1 ? '' : 's') }));
      var old = tot.teams.filter(function (a) { return a !== tm[0]; });
      box.append(h('div', { class: 'pcard k' + pk.slot + (isNew ? ' new' : '') },
        helmetBox('av helm', tm[0]),
        h('div', { class: 'pinfo' },
          h('div', { class: 'pn', text: tm[1] }),
          h('div', { class: 'pm', text: tm[3] + ' · ' + spanText(x) }),
          h('div', { class: 'bio', text: tot.w + '\u2013' + tot.l + (tot.t ? '\u2013' + tot.t : '') + ' (' + C.fmt({ fmt: 'pct' }, (tot.w + tot.t / 2) / Math.max(1, tot.w + tot.l + tot.t)) + ') · ' + tot.pf.toLocaleString('en-US') + ' points scored' }),
          old.length ? h('div', { class: 'bio', text: 'Played as ' + old.join(', ') + ' in some seasons' }) : null,
          h('div', { class: 'badges' }, badges)),
        h('button', { type: 'button', class: 'x', 'aria-label': 'Remove ' + tm[1], onclick: function () { removePlayer(pk.p); } }, '×')));
    });
    shown = new Set(S.picks.map(function (pk) { return pk.p; }));
    $('example').hidden = !S.example;
    $('example').textContent = 'Example comparison. Click teams above to swap in your own.';
    var full = S.picks.length >= MAXP;
    Array.prototype.forEach.call($('tgrid').querySelectorAll('.tile'), function (b) {
      var t = +b.getAttribute('data-t');
      var pk = S.picks.filter(function (x) { return x.p === t; })[0];
      b.setAttribute('aria-pressed', String(!!pk));
      b.className = 'tile' + (pk ? ' k' + pk.slot : '');
      b.disabled = full && !pk;
    });
  }
  function buildTeamGrid() {
    var grid = $('tgrid'), divs = {};
    T.teams.forEach(function (tm, i) { (divs[tm[3]] = divs[tm[3]] || []).push(i); });
    Object.keys(divs).sort().forEach(function (dv) {
      var ids = divs[dv];
      grid.append(h('div', { class: 'tdiv' },
        h('button', { type: 'button', class: 'dvh', title: 'Compare the whole ' + dv, onclick: function () { setPicks(ids); S.manual = false; S.example = false; update(); } }, dv),
        ids.map(function (t) {
          var tm = T.teams[t];
          return h('button', {
            type: 'button', class: 'tile', 'data-t': t, style: '--tc:' + tm[4], 'aria-pressed': 'false', title: tm[1],
            onclick: function () { if (S.picks.some(function (x) { return x.p === t; })) removePlayer(t); else addPlayer(t); }
          }, helmetBox('th', tm[0]), h('b', { text: tm[0] }), h('span', { text: tm[1].split(' ').slice(-1)[0] }));
        })));
    });
    var ps = $('tpresets');
    TPRESETS.forEach(function (p) {
      if (p.ids.length < 2) return;
      ps.append(h('button', { type: 'button', class: 'chip preset', text: p.label, onclick: function () { setPicks(p.ids); S.manual = false; S.example = false; update(); } }));
    });
    ps.append(h('button', { type: 'button', class: 'chip dice', text: '\u2684 Random matchup', title: 'Pick 2 to 4 random teams', onclick: randomMatchup }));
  }
  function setMode(m) {
    if (m === 'games' || m === 'trivia') { showView(m); return; }
    if (S.view !== 'compare') showView('compare');
    if (m === S.mode || !MODELS[m]) { syncControls(); save(); return; }
    var cur = {};
    MODEKEYS.forEach(function (k) { cur[k] = S[k]; });
    STORE[S.mode] = cur;
    S.mode = m;
    var nx = STORE[m];
    if (nx) MODEKEYS.forEach(function (k) { S[k] = nx[k]; });
    else {
      var ys = M().years;
      S.from = ys[0]; S.to = ys[1]; S.manual = false; S.metric = null; S.logp = null;
      var pre = m === 'teams' ? TPRESETS : PRESETS;
      setPicks(pre.length ? pre[0].ids : []); S.example = true;
    }
    hiddenSlots.clear(); shown = new Set();
    buildYears(); buildCats(); setMeta();
    update();
  }
  // Games and Trivia swap the comparison panels for their own pages (gamesui.js, trivia.js)
  function showView(v) {
    S.view = v; S.games = v === 'games';
    document.body.setAttribute('data-view', v);
    $('games').hidden = v !== 'games';
    $('trivia').hidden = v !== 'trivia';
    var meta = C.meta || {};
    if (v === 'games') { window.NFLGames.mount($('games')); $('meta').textContent = 'Every game since 1999 · scores, betting lines, box scores and injury reports · data through ' + (meta.through || ''); }
    else if (v === 'trivia') { window.NFLTrivia.mount($('trivia')); $('meta').textContent = 'NFL trivia · questions built from every season since 1999'; }
    else setMeta();
    syncControls(); save();
  }
  function showGames(on) { showView(on ? 'games' : 'compare'); }
  function buildYears() {
    var fy = $('from'), ty = $('to'), ys = M().years;
    fy.replaceChildren(); ty.replaceChildren();
    for (var y = ys[0]; y <= ys[1]; y++) { fy.append(h('option', { value: y, text: y })); ty.append(h('option', { value: y, text: y })); }
  }
  function setMeta() {
    var meta = C.meta || {}, ys = M().years;
    $('meta').textContent = ys[0] + '–' + ys[1] + ' seasons · data through ' + (meta.through || ys[1]) + ' · ' +
      (S.mode === 'teams' ? T.teams.length + ' teams' : C.players.length.toLocaleString('en-US') + ' players');
  }
  function renderResults() {
    var q = $('q').value.trim();
    var box = $('results');
    box.replaceChildren();
    if (!q) { box.hidden = true; return; }
    box.hidden = false;
    var res = C.search(q, S.grp, 10);
    if (!res.length) { box.append(h('div', { class: 'none', text: 'No players match that search.' })); return; }
    res.forEach(function (p) {
      var pl = C.players[p];
      var taken = S.picks.some(function (x) { return x.p === p; });
      box.append(h('button', {
        type: 'button', class: 'res', disabled: taken || S.picks.length >= MAXP,
        onclick: function () { $('q').value = ''; addPlayer(p); $('q').focus(); }
      },
        h('span', { class: 'rn', text: pl[1] }),
        posTag(pl),
        h('span', { class: 'rm', text: pl[6] + ' · ' + pl[4] + '–' + pl[5] }),
        pl[7] ? h('span', { class: 'pill', text: 'Career began before 1999' }) : null,
        taken ? h('span', { class: 'rm', text: 'Added' }) : null));
    });
  }

  // ---------- controls (built once, synced on update) ----------
  function seg(host, items, getter, setter, label) {
    host.setAttribute('role', 'group');
    if (label) host.setAttribute('aria-label', label);
    items.forEach(function (it) {
      var b = h('button', { type: 'button', 'data-v': it[0], text: it[1] });
      b.addEventListener('click', function () { setter(it[0]); });
      host.append(b);
    });
    host._get = getter;
  }
  function syncSeg(host) {
    var cur = String(host._get());
    Array.prototype.forEach.call(host.children, function (b) {
      b.setAttribute('aria-pressed', b.getAttribute('data-v') === cur ? 'true' : 'false');
    });
  }
  function buildControls() {
    seg($('grpchips'), GROUPS, function () { return S.grp; }, function (v) { S.grp = v; syncControls(); renderResults(); }, 'Filter search by position group');
    Array.prototype.forEach.call($('grpchips').children, function (b) { b.className = 'chip'; });
    seg($('stseg'), STYPES, function () { return S.st; }, function (v) { S.st = v; update(); }, 'Season type');
    seg($('pgseg'), [['0', 'Totals'], ['1', 'Per game']], function () { return S.pg ? '1' : '0'; }, function (v) { S.pg = v === '1'; update(); }, 'Totals or per game');
    seg($('xseg'), [['cal', 'Calendar year'], ['car', 'Career year']], function () { return S.xmode; }, function (v) { S.xmode = v; update(); }, 'Chart x-axis');
    seg($('tabs'), TABS, function () { return S.tab; }, function (v) { S.tab = v; update(); }, 'View');
    $('tabs').setAttribute('role', 'tablist');
    Array.prototype.forEach.call($('tabs').children, function (b) {
      b.setAttribute('role', 'tab'); b.className = 'tab';
      var ic = sv('svg', { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': 2, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'aria-hidden': 'true' }, sv('path', { d: TAB_ICONS[b.getAttribute('data-v')] }));
      b.prepend(ic);
    });
    var fy = $('from'), ty = $('to');
    buildYears();
    fy.addEventListener('change', function () { S.from = +fy.value; if (S.from > S.to) S.to = S.from; update(); });
    ty.addEventListener('change', function () { S.to = +ty.value; if (S.to < S.from) S.from = S.to; update(); });
    buildCats();
    var modes = [['players', 'Players']];
    if (T) modes.push(['teams', 'Teams']);
    if (window.NFLGames) modes.push(['games', 'Games']);
    if (window.NFLTrivia) modes.push(['trivia', 'Trivia']);
    seg($('modesw'), modes, function () { return S.view !== 'compare' ? S.view : S.mode; }, setMode, 'Players, teams, games or trivia');
    if (T) buildTeamGrid();
    $('q').addEventListener('input', renderResults);
    $('q').addEventListener('keydown', function (e) {
      if (e.key === 'Enter') { var f = $('results').querySelector('button:not([disabled])'); if (f) f.click(); }
      if (e.key === 'Escape') { $('q').value = ''; renderResults(); }
      if (e.key === 'ArrowDown') { var b = $('results').querySelector('button:not([disabled])'); if (b) { b.focus(); e.preventDefault(); } }
    });
    $('results').addEventListener('keydown', function (e) {
      var bs = Array.prototype.slice.call($('results').querySelectorAll('button:not([disabled])'));
      var i = bs.indexOf(document.activeElement);
      if (i < 0) return;
      if (e.key === 'ArrowDown' && i < bs.length - 1) { bs[i + 1].focus(); e.preventDefault(); }
      else if (e.key === 'ArrowUp') { (i ? bs[i - 1] : $('q')).focus(); e.preventDefault(); }
      else if (e.key === 'Escape') { $('q').value = ''; renderResults(); $('q').focus(); }
    });
    var ps = $('presets');
    PRESETS.forEach(function (p) {
      ps.append(h('button', {
        type: 'button', class: 'chip preset', text: p.label,
        onclick: function () { setPicks(p.ids); S.manual = false; S.example = false; update(); }
      }));
    });
    ps.append(h('button', { type: 'button', class: 'chip dice', text: '\u2684 Random matchup', title: 'Pick 2 to 4 long-career players at the same position', onclick: randomMatchup }));
    $('theme').addEventListener('click', function () {
      var dark = isDark();
      document.documentElement.setAttribute('data-theme', dark ? 'light' : 'dark');
      try { localStorage.setItem(KEY + '.theme', dark ? 'light' : 'dark'); } catch (e) { /* storage unavailable */ }
      syncTheme();
    });
  }
  function buildCats() {
    var cc = $('cats');
    cc.replaceChildren();
    cc.append(h('button', { type: 'button', class: 'chip auto', 'data-c': 'auto', text: 'Auto', onclick: function () { S.manual = false; update(); } }));
    M().CATS.forEach(function (c) {
      cc.append(h('button', {
        type: 'button', class: 'chip', 'data-c': c.id, text: c.label.replace(' (rush + receive)', ''),
        onclick: function () {
          S.manual = true;
          if (S.cats.has(c.id)) S.cats.delete(c.id); else S.cats.add(c.id);
          syncControls(); renderView(aggs()); save();
        }
      }));
    });
  }
  function isDark() {
    var t = document.documentElement.getAttribute('data-theme');
    if (t) return t === 'dark';
    return !!(window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches);
  }
  function syncTheme() { $('theme').textContent = isDark() ? 'Light mode' : 'Dark mode'; }
  var POOL = null;
  function randomMatchup() {
    if (S.mode === 'teams') {
      var all = T.teams.map(function (t, i) { return i; }), pick = [], k = 2 + Math.floor(Math.random() * 3);
      while (pick.length < k) pick.push(all.splice(Math.floor(Math.random() * all.length), 1)[0]);
      setPicks(pick); S.manual = false; S.example = false; update(); return;
    }
    if (!POOL) {
      POOL = {};
      C.players.forEach(function (pl, i) {
        if (pl[7] || pl[5] - pl[4] < 7) return;
        (POOL[pl[3]] = POOL[pl[3]] || []).push(i);
      });
    }
    var groups = ['QB', 'RB', 'WR', 'TE', 'DEF'].filter(function (g) { return POOL[g] && POOL[g].length >= 4; });
    if (!groups.length) return;
    var pool = POOL[groups[Math.floor(Math.random() * groups.length)]].slice();
    var n = 2 + Math.floor(Math.random() * 3), ids = [];
    while (ids.length < n && pool.length) ids.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0]);
    setPicks(ids); S.manual = false; S.example = false; update();
  }
  function syncControls() {
    ['grpchips', 'stseg', 'pgseg', 'xseg', 'tabs', 'modesw'].forEach(function (id) { syncSeg($(id)); });
    $('from').value = S.from; $('to').value = S.to;
    Array.prototype.forEach.call($('cats').children, function (b) {
      var c = b.getAttribute('data-c');
      b.setAttribute('aria-pressed', c === 'auto' ? String(!S.manual) : String(S.cats.has(c)));
    });
    $('xwrap').hidden = S.tab !== 'trends';
    Array.prototype.forEach.call($('tabs').children, function (b) {
      b.setAttribute('aria-selected', b.getAttribute('data-v') === S.tab ? 'true' : 'false');
    });
  }

  // ---------- views ----------
  function renderView(A) {
    if (RO) { RO.disconnect(); RO = null; }
    var v = $('view');
    v.replaceChildren();
    if (!A.length) { v.append(emptyMsg(S.mode === 'teams' ? 'Pick at least one team above to see stats.' : 'Add at least one player to see stats. Pick a preset above or search by name.')); return; }
    var cats = M().CATS.filter(function (c) { return S.cats.has(c.id); });
    if (!cats.length) { v.append(emptyMsg('No stats to show for these players in this year range. Widen the years or turn on a stat group.')); return; }
    if (S.tab === 'compare') v.append(viewCompare(A, cats));
    else if (S.tab === 'trends') v.append(viewTrends(A, cats));
    else v.append(viewLog(A, cats));
  }
  function emptyMsg(t) { return h('p', { class: 'empty', text: t }); }
  function pgNote() {
    return S.pg ? h('p', { class: 'note', text: 'Per game: counting stats are divided by games with a recorded stat. Rates and longest plays are unchanged.' }) : null;
  }

  function viewCompare(A, cats) {
    var cols = A.length;
    var head = h('tr', null, h('th', { class: 'corner', scope: 'col' }, h('span', { class: 'sr', text: 'Stat' })));
    A.forEach(function (x, i) {
      var pk = S.picks[i], partial = S.mode === 'players' && C.players[pk.p][7];
      head.append(h('th', { scope: 'col', class: 'ph k' + pk.slot },
        h('div', { class: 'pnh' }, h('i', { class: 'sw' }), h('span', { text: M().name(pk.p) })),
        h('div', { class: 'pm', text: M().sub(pk.p, x) }),
        partial ? h('div', { class: 'pill', text: 'Partial career' }) : null));
    });
    var tb = h('tbody');
    function group(label) { tb.append(h('tr', { class: 'g' }, h('th', { colspan: cols + 1, scope: 'colgroup', text: label }))); }
    function line(label, tip, cells, metric) {
      var lab = metric ? h('button', { type: 'button', class: 'sl', title: (tip ? tip + '. ' : '') + 'Click to chart by season', onclick: function () { S.metric = metric; S.tab = 'trends'; update(); window.scrollTo({ top: $('tabs').offsetTop - 8, behavior: 'smooth' }); } }, label) : label;
      tb.append(h('tr', null, h('th', { scope: 'row', title: metric ? null : tip || null }, lab), cells));
    }
    var wins = A.map(function () { return 0; }), contested = 0;
    group('Overview');
    line('Games', 'Games with at least one recorded stat', A.map(function (x, i) { return h('td', { class: 'k' + S.picks[i].slot, text: C.fmt({ fmt: 'int', kind: 'x' }, x.tot.g, false) }); }));
    line('Seasons', null, A.map(function (x, i) { return h('td', { class: 'k' + S.picks[i].slot, text: String(x.tot.n) }); }));
    line('Years', null, A.map(function (x, i) { return h('td', { class: 'k' + S.picks[i].slot, text: spanText(x) }); }));
    var HN = S.mode === 'players' ? S.picks.map(function (pk) { return C.honors(pk.p); }) : [];
    var hrows = (HN.length ? C.honorRows : []).map(function (row) {
      var cells = HN.map(function (hn) { return C.honorCell(row, hn); });
      return { row: row, cells: cells, show: cells.some(function (c) { return c.v > 0; }) };
    }).filter(function (x) { return x.show; });
    if (hrows.length) {
      group('Honors');
      hrows.forEach(function (x) {
        var win = x.row.kind === 'flag' ? [] : C.leaders({ lead: true, better: 'high' }, x.cells.map(function (c) { return { v: c.v, small: false }; }));
        line(x.row.label, x.row.tip, x.cells.map(function (c, i) {
          var txt = c.v == null ? '\u2013' : x.row.kind === 'flag' ? (c.v ? 'Yes' : '\u2013') : (c.v === 0 && x.row.kind === 'years' ? '\u2013' : String(c.v));
          var cls = 'k' + S.picks[i].slot + (win.indexOf(i) >= 0 ? ' lead' : '');
          var kids = [txt];
          if (c.years && c.years.length && c.years.length <= 5) kids.push(h('div', { class: 'yrs', text: c.years.join(', ') }));
          return h('td', { class: cls, title: c.v == null ? 'Not available for undrafted players' : null }, kids);
        }));
      });
    }
    cats.forEach(function (c) {
      group(c.label);
      c.stats.forEach(function (d) {
        var cells = A.map(function (x) { return C.value(d, x.tot, S.pg, false); });
        var win = C.leaders(d, cells);
        if (win.length && A.length > 1) { contested++; win.forEach(function (i) { wins[i]++; }); }
        var vs = cells.filter(function (cl) { return cl.v != null && !cl.small; }).map(function (cl) { return cl.v; });
        var mx = vs.length && Math.min.apply(null, vs) >= 0 ? Math.max.apply(null, vs) : 0;
        line(d.label, d.tip, cells.map(function (cl, i) {
          var bar = mx > 0 && A.length > 1 && cl.v != null && !cl.small;
          var cls = 'k' + S.picks[i].slot + (win.indexOf(i) >= 0 ? ' lead' : '') + (cl.small ? ' small' : '') + (bar ? ' bar' : '');
          return h('td', { class: cls, style: bar ? '--bw:' + (cl.v / mx * 100).toFixed(1) + '%' : null, title: cl.small ? 'Small sample, not ranked' : null, text: C.fmt(d, cl.v, S.pg) });
        }), d.id);
      });
    });
    var t = h('table', { class: 'cmp' }, h('caption', { class: 'sr', text: 'Player comparison' }), h('thead', null, head), tb);
    return h('div', null,
      scoreboard(wins, contested),
      h('p', { class: 'hint', text: STLABEL[S.st] + ', ' + S.from + '–' + S.to + (S.pg ? ', per game' : ', totals') + '. Shaded cell = leader in that row. Bars show each value against the row\u2019s best. Click a stat name to chart it by season.' }),
      pgNote(),
      h('div', { class: 'tablewrap' }, t),
      hrows.length ? h('p', { class: 'note', text: 'Honors ignore the year filter. Awards and Super Bowls cover 1999 onward. Pro Bowls, All-Pro and Hall of Fame cover each career (drafted players only).' }) : null,
      partialNote(A));
  }
  function scoreboard(wins, contested) {
    if (S.picks.length < 2 || !contested) return null;
    var top = Math.max.apply(null, wins);
    var cards = S.picks.map(function (pk, i) {
      var fill = h('div', { class: 'fill' });
      var lead = wins[i] === top && top > 0 && wins.filter(function (w) { return w === top; }).length === 1;
      requestAnimationFrame(function () { requestAnimationFrame(function () { fill.style.width = (wins[i] / contested * 100) + '%'; }); });
      return h('div', { class: 'sc k' + pk.slot + (lead ? ' top' : '') },
        lead ? h('span', { class: 'crown', text: 'Leader' }) : null,
        h('div', { class: 'n', text: M().name(pk.p) }),
        h('div', null, h('span', { class: 'big', text: String(wins[i]) }), h('span', { class: 'of', text: ' of ' + contested + ' stats led' })),
        h('div', { class: 'trk', 'aria-hidden': 'true' }, fill));
    });
    return h('section', { class: 'score', 'aria-label': 'Head-to-head: stats led by each player' }, cards);
  }
  function partialNote(A) {
    var any = S.mode === 'players' && S.picks.some(function (pk) { return C.players[pk.p][7]; });
    return any ? h('p', { class: 'note', text: 'Partial career: this player was active before 1999, so totals here cover 1999 onward only.' }) : null;
  }

  // ----- trends -----
  function niceTicks(lo, hi, n) {
    if (hi === lo) hi = lo + 1;
    var raw = (hi - lo) / n, p = Math.pow(10, Math.floor(Math.log10(raw))), f = raw / p;
    var step = (f < 1.5 ? 1 : f < 3 ? 2 : f < 7 ? 5 : 10) * p;
    var t0 = Math.floor(lo / step + 1e-9) * step, t1 = Math.ceil(hi / step - 1e-9) * step;
    var out = [];
    for (var v = t0; v <= t1 + step * 1e-6; v += step) out.push(Math.round(v / step) * step);
    return { ticks: out, step: step };
  }
  function axisFmt(d, v, step) {
    if (d.fmt === 'pct') return (v * 100).toFixed(step * 100 < 1 ? 1 : 0) + '%';
    if (Math.abs(v) >= 1000 && step >= 500) return String(Math.round(v / 100) / 10).replace(/\.0$/, '') + 'K';
    var dp = step >= 1 ? 0 : step >= 0.1 ? 1 : 2;
    return v.toLocaleString('en-US', { minimumFractionDigits: dp, maximumFractionDigits: dp }).replace('-', '−');
  }
  function ensureMetric(cats) {
    var ok = cats.some(function (c) { return c.stats.some(function (d) { return d.id === S.metric; }); });
    if (!ok) S.metric = cats[0].main;
  }

  function viewTrends(A, cats) {
    ensureMetric(cats);
    var sel = h('select', { id: 'metric', 'aria-label': 'Stat to chart' });
    cats.forEach(function (c) {
      var og = h('optgroup', { label: c.label });
      c.stats.forEach(function (d) { og.append(h('option', { value: d.id, text: d.label })); });
      sel.append(og);
    });
    sel.value = S.metric;
    var body = h('div');
    sel.addEventListener('change', function () { S.metric = sel.value; draw(); });

    function draw() {
      if (RO) { RO.disconnect(); RO = null; }
      body.replaceChildren();
      var d = M().DEFS[S.metric];
      var series = A.map(function (x, i) {
        var pts = [];
        x.seasons.forEach(function (s, k) {
          var r = C.value(d, s, S.pg, true);
          if (r.v == null || r.small) return;
          pts.push({ x: S.xmode === 'cal' ? s.season : k + 1, y: r.v, season: s.season, team: s.teams.join('/') });
        });
        return { slot: S.picks[i].slot, name: M().name(S.picks[i].p), pts: pts };
      });
      var visible = series.filter(function (s) { return !hiddenSlots.has(s.slot); });
      var unit = (S.pg && d.kind === 'sum') ? 'per game' : d.kind === 'sum' || d.kind === 'cnt' ? 'season totals' : d.kind === 'max' ? 'season best' : 'by season';
      var wrap = h('div', { class: 'chartwrap', tabindex: '0', role: 'group', 'aria-label': d.label + ' by season. Use left and right arrow keys to read values.' });
      var box = h('div', { class: 'chartbox' },
        h('div', { class: 'ct' },
          h('div', { class: 'cn', text: d.label }),
          h('div', { class: 'cs', text: STLABEL[S.st] + ' · ' + unit + ' · ' + S.from + '–' + S.to })),
        series.length >= 2 ? h('div', { class: 'legend', role: 'group', 'aria-label': 'Show or hide players' }, series.map(function (s) {
          var on = !hiddenSlots.has(s.slot);
          return h('button', {
            type: 'button', class: 'lg k' + s.slot, 'aria-pressed': String(on), title: on ? 'Hide ' + s.name : 'Show ' + s.name,
            onclick: function () {
              if (on && visible.length === 1) return;
              if (on) hiddenSlots.add(s.slot); else hiddenSlots.delete(s.slot);
              draw();
            },
            onmouseenter: function () { if (on) wrap.setAttribute('data-focus', s.slot); },
            onmouseleave: function () { wrap.removeAttribute('data-focus'); },
            onfocus: function () { if (on) wrap.setAttribute('data-focus', s.slot); },
            onblur: function () { wrap.removeAttribute('data-focus'); }
          }, h('i', { class: 'key' }), h('span', { text: s.name }));
        })) : null,
        wrap);
      body.append(box);
      drawChart(wrap, visible, d, true);
      if (window.ResizeObserver) {
        var lastW = wrap.clientWidth;
        RO = new ResizeObserver(function () {
          if (wrap.clientWidth && Math.abs(wrap.clientWidth - lastW) > 1) { lastW = wrap.clientWidth; drawChart(wrap, visible, d, false); }
        });
        RO.observe(wrap);
      }
      if (d.den) body.append(h('p', { class: 'note', text: 'Seasons with a very small sample are left off the chart for rate stats.' }));
      body.append(dataTable(series, d));
    }
    draw();
    return h('div', null,
      h('div', { class: 'metricrow' }, h('label', { class: 'lbl', for: 'metric', text: 'Stat' }), sel),
      pgNote(), body);
  }

  function dataTable(series, d) {
    var xs = Array.from(new Set(series.flatMap(function (s) { return s.pts.map(function (p) { return p.x; }); }))).sort(function (a, b) { return a - b; });
    var head = h('tr', null, h('th', { scope: 'col', text: S.xmode === 'cal' ? 'Year' : 'Career year' }),
      series.map(function (s) { return h('th', { scope: 'col', class: 'ph k' + s.slot }, h('div', { class: 'pnh' }, h('i', { class: 'sw' }), h('span', { text: s.name }))); }));
    var tb = h('tbody');
    xs.forEach(function (x) {
      tb.append(h('tr', null, h('th', { scope: 'row', text: String(x) }),
        series.map(function (s) {
          var p = s.pts.filter(function (q) { return q.x === x; })[0];
          return h('td', { text: p ? C.fmt(d, p.y, S.pg) : '–', title: p && S.xmode === 'car' ? String(p.season) : null });
        })));
    });
    return h('details', { class: 'dtl' }, h('summary', { text: 'Data table' }),
      h('div', { class: 'tablewrap' }, h('table', { class: 'cmp' }, h('thead', null, head), tb)));
  }

  function drawChart(host, series, d, anim) {
    host.replaceChildren();
    var W = Math.max(300, host.clientWidth || 720), H = W < 520 ? 250 : 330;
    var m = { l: W < 520 ? 44 : 54, r: 16, t: 12, b: 30 };
    var iw = W - m.l - m.r, ih = H - m.t - m.b;
    var all = series.reduce(function (a, s) { return a.concat(s.pts); }, []);
    if (!all.length) { host.append(emptyMsg('Nothing to plot for these players, stat and years.')); return; }
    var xs = Array.from(new Set(all.map(function (p) { return p.x; }))).sort(function (a, b) { return a - b; });
    var xmin = xs[0] - 0.5, xmax = xs[xs.length - 1] + 0.5;
    var lo = Math.min.apply(null, all.map(function (p) { return p.y; }));
    var hi = Math.max.apply(null, all.map(function (p) { return p.y; }));
    var ymin = lo, ymax = hi;
    if (d.kind === 'sum' || d.kind === 'cnt') { ymin = Math.min(0, lo); if (ymax <= 0) ymax = 1; }
    else {
      var pad = (hi - lo) * 0.12 || Math.abs(hi) * 0.1 || 1;
      ymin = lo - pad; ymax = hi + pad;
      if (lo >= 0 && ymin < 0) ymin = 0;
      if (d.fmt === 'pct' && ymax > 1) ymax = 1;
    }
    var nt = niceTicks(ymin, ymax, 5);
    var ticks = nt.ticks, y0 = ticks[0], y1 = ticks[ticks.length - 1];
    function X(v) { return m.l + (v - xmin) / (xmax - xmin) * iw; }
    function Y(v) { return m.t + (1 - (v - y0) / (y1 - y0)) * ih; }

    var svg = sv('svg', { class: 'chart' + (anim ? ' anim' : ''), viewBox: '0 0 ' + W + ' ' + H, width: W, height: H, 'aria-hidden': 'true' });
    ticks.forEach(function (t) {
      svg.append(sv('line', { class: 'gl', x1: m.l, x2: W - m.r, y1: Y(t), y2: Y(t) }));
      svg.append(sv('text', { class: 'tk', x: m.l - 8, y: Y(t) + 4, 'text-anchor': 'end' }, axisFmt(d, t, nt.step)));
    });
    svg.append(sv('line', { class: 'axl', x1: m.l, x2: W - m.r, y1: Y(y0), y2: Y(y0) }));
    if (y0 < 0 && y1 > 0) svg.append(sv('line', { class: 'axl', x1: m.l, x2: W - m.r, y1: Y(0), y2: Y(0) }));
    var pxPer = iw / (xmax - xmin), every = Math.max(1, Math.ceil(46 / pxPer));
    xs.forEach(function (x) {
      if ((x - xs[0]) % every !== 0) return;
      svg.append(sv('text', { class: 'tk', x: X(x), y: H - 8, 'text-anchor': 'middle' }, String(x)));
    });
    series.forEach(function (s) {
      var segs = [], cur = null, prev = null;
      s.pts.forEach(function (p) {
        if (!cur || p.x - prev > 1) { cur = []; segs.push(cur); }
        cur.push(p); prev = p.x;
      });
      segs.forEach(function (sg) {
        if (sg.length < 2) return;
        var dd = sg.map(function (p, i) { return (i ? 'L' : 'M') + X(p.x).toFixed(1) + ' ' + Y(p.y).toFixed(1); }).join(' ');
        if (d.kind === 'sum') {
          var base = Y(Math.max(y0, Math.min(0, y1))).toFixed(1);
          svg.insertBefore(sv('path', { class: 'area k' + s.slot, d: dd + ' L' + X(sg[sg.length - 1].x).toFixed(1) + ' ' + base + ' L' + X(sg[0].x).toFixed(1) + ' ' + base + ' Z' }), svg.firstChild);
        }
        svg.append(sv('path', { class: 'ln k' + s.slot, pathLength: 1, d: dd }));
      });
      s.pts.forEach(function (p) { svg.append(sv('circle', { class: 'dot k' + s.slot, cx: X(p.x), cy: Y(p.y), r: 4 })); });
    });
    var cross = sv('line', { class: 'cross', y1: m.t, y2: Y(y0), style: 'display:none' });
    var hlg = sv('g');
    var overlay = sv('rect', { x: m.l, y: m.t, width: iw, height: ih, fill: 'transparent' });
    svg.append(cross, hlg, overlay);
    var tip = h('div', { class: 'tip', hidden: true });
    host.append(svg, tip);

    var cur = -1;
    function hide() { cur = -1; cross.style.display = 'none'; hlg.replaceChildren(); tip.hidden = true; }
    function show(i) {
      cur = i;
      var x = xs[i], px = X(x);
      cross.setAttribute('x1', px); cross.setAttribute('x2', px); cross.style.display = '';
      hlg.replaceChildren();
      var rows = [];
      series.forEach(function (s) {
        var p = s.pts.filter(function (q) { return q.x === x; })[0];
        if (p) { hlg.append(sv('circle', { class: 'hl k' + s.slot, cx: px, cy: Y(p.y), r: 6 })); rows.push({ s: s, p: p }); }
      });
      tip.replaceChildren();
      tip.append(h('div', { class: 'th', text: S.xmode === 'cal' ? String(x) : 'Career year ' + x }));
      rows.forEach(function (r) {
        tip.append(h('div', { class: 'tr k' + r.s.slot }, h('i', { class: 'key' }), h('b', { text: C.fmt(d, r.p.y, S.pg) }),
          h('span', { class: 'tn', text: r.s.name }), h('span', { class: 'tm', text: S.xmode === 'cal' ? r.p.team : String(r.p.season) })));
      });
      tip.hidden = false;
      var tw = tip.offsetWidth, left = px + 14;
      if (left + tw > W - 4) left = px - 14 - tw;
      tip.style.left = Math.max(4, left) + 'px';
      tip.style.top = (m.t + 6) + 'px';
    }
    overlay.addEventListener('pointermove', function (e) {
      var r = svg.getBoundingClientRect(), px = (e.clientX - r.left) * (W / (r.width || W));
      var bi = 0, bd = 1e9;
      xs.forEach(function (x, i) { var dd = Math.abs(X(x) - px); if (dd < bd) { bd = dd; bi = i; } });
      show(bi);
    });
    overlay.addEventListener('pointerleave', function () { if (document.activeElement !== host) hide(); });
    host.onkeydown = function (e) {
      if (e.key === 'ArrowRight') { show(Math.min(xs.length - 1, cur < 0 ? 0 : cur + 1)); e.preventDefault(); }
      else if (e.key === 'ArrowLeft') { show(Math.max(0, cur < 0 ? xs.length - 1 : cur - 1)); e.preventDefault(); }
      else if (e.key === 'Home') { show(0); e.preventDefault(); }
      else if (e.key === 'End') { show(xs.length - 1); e.preventDefault(); }
      else if (e.key === 'Escape') hide();
    };
    host.onfocus = function () { if (cur < 0) show(xs.length - 1); };
    host.onblur = hide;
  }

  // ----- season log -----
  function viewLog(A, cats) {
    if (!S.logp || !S.picks.some(function (p) { return p.p === S.logp; })) S.logp = S.picks[0].p;
    var body = h('div');
    var selrow = h('div', { class: 'seg', role: 'group', 'aria-label': 'Player' });
    S.picks.forEach(function (pk) {
      var b = h('button', { type: 'button', class: 'k' + pk.slot, 'data-p': pk.p }, h('i', { class: 'sw' }), M().name(pk.p));
      b.addEventListener('click', function () { S.logp = pk.p; sync(); draw(); });
      selrow.append(b);
    });
    function sync() {
      Array.prototype.forEach.call(selrow.children, function (b) { b.setAttribute('aria-pressed', String(+b.getAttribute('data-p') === S.logp)); });
    }
    function draw() {
      body.replaceChildren();
      var i = S.picks.findIndex(function (p) { return p.p === S.logp; });
      var x = A[i], slot = S.picks[i].slot;
      var use = S.manual || S.mode === 'teams' ? cats : C.CATS.filter(function (c) { return C.autoCats([x.tot], [C.players[S.logp][3]]).has(c.id); });
      if (!use.length) { body.append(emptyMsg('No stats for this player in the selected years.')); return; }
      var hasH = x.seasons.some(function (s) { return M().seasonHonors(S.logp, s.season).length > 0; });
      var h1 = h('tr', null, h('th', { colspan: 3, class: 'gh', text: 'Season' }));
      var h2 = h('tr', null, h('th', { scope: 'col', class: 'l', text: 'Year' }), h('th', { scope: 'col', class: 'l', text: 'Team' }), h('th', { scope: 'col', text: 'G' }));
      var cols = [];
      use.forEach(function (c) {
        var ds = c.stats.filter(function (d) { return d.log; });
        h1.append(h('th', { colspan: ds.length, class: 'gh', text: c.label.replace(' (rush + receive)', '') }));
        ds.forEach(function (d) { h2.append(h('th', { scope: 'col', title: d.tip || d.label, text: shortLabel(d) })); cols.push(d); });
      });
      if (hasH) { h1.append(h('th', { colspan: 1, class: 'gh', text: S.mode === 'teams' ? 'Postseason' : 'Honors' })); h2.append(h('th', { scope: 'col', class: 'l', text: S.mode === 'teams' ? 'Result' : 'Awards and Super Bowls' })); }
      var best = cols.map(function (d) {
        var cells = x.seasons.map(function (s) { return C.value(d, s, S.pg, true); });
        var vals = cells.filter(function (c) { return c.v != null && !c.small; }).map(function (c) { return c.v; });
        if (!d.lead || vals.length < 2) return null;
        var b = d.better === 'low' ? Math.min.apply(null, vals) : Math.max.apply(null, vals);
        return vals.every(function (v) { return Math.abs(v - b) < 1e-9; }) ? null : b;
      });
      var tb = h('tbody');
      x.seasons.forEach(function (s) {
        var tr = h('tr', null, h('th', { scope: 'row', class: 'l', text: String(s.season) }), h('td', { class: 'l', text: s.teams.join('/') }), h('td', { text: String(s.g) }));
        cols.forEach(function (d, k) {
          var r = C.value(d, s, S.pg, true);
          var isBest = best[k] != null && r.v != null && !r.small && Math.abs(r.v - best[k]) < 1e-9;
          tr.append(h('td', { class: (isBest ? 'lead ' : '') + (r.small ? 'small' : ''), text: C.fmt(d, r.v, S.pg) }));
        });
        if (hasH) tr.append(h('td', { class: 'l', text: M().seasonHonors(S.logp, s.season).join(', ') }));
        tb.append(tr);
      });
      var tf = h('tr', { class: 'tot' }, h('th', { scope: 'row', class: 'l', text: 'Total' }), h('td', { class: 'l', text: teamsText(x) }), h('td', { text: String(x.tot.g) }));
      cols.forEach(function (d) { var r = C.value(d, x.tot, S.pg, false); tf.append(h('td', { class: r.small ? 'small' : '', text: C.fmt(d, r.v, S.pg) })); });
      if (hasH) tf.append(h('td', { class: 'l', text: '' }));
      var t = h('table', { class: 'cmp log k' + slot }, h('caption', { class: 'sr', text: 'Season by season stats' }), h('thead', null, h1, h2), tb, h('tfoot', null, tf));
      body.append(h('p', { class: 'hint', text: STLABEL[S.st] + ', ' + S.from + '–' + S.to + (S.pg ? ', per game' : ', totals') + '. Shaded cell = best season in that column.' }),
        pgNote() || '', h('div', { class: 'tablewrap' }, t));
    }
    sync(); draw();
    return h('div', null, selrow, body);
  }
  function shortLabel(d) {
    var map = { cmpp: 'Cmp%', ya: 'Y/A', rate: 'Rate', ypc: 'Y/C', ypr: 'Y/R', yptouch: 'Y/Tch', stdd: 'TD', tkl: 'Tkl', tfl: 'TFL', dsk: 'Sck', dint: 'INT', pd: 'PD', ff: 'FF',
      fgp: 'FG%', fgl: 'Lng', pavg: 'Avg', pnt20: 'In20', pr: 'PR', pryd: 'PR Yds', kr: 'KR', kryd: 'KR Yds', fp: 'Std', fpp: 'PPR', cmp: 'Cmp', att: 'Att', pyd: 'Yds', ptd: 'TD', int: 'INT',
      car: 'Car', ryd: 'Yds', rtd: 'TD', tgt: 'Tgt', rec: 'Rec', cyd: 'Yds', ctd: 'TD', touch: 'Tch', scrim: 'Scr Yds', fgm: 'FGM', fga: 'FGA', xpm: 'XPM', kpts: 'Pts', pnt: 'Punts', pntyd: 'Yds' };
    return map[d.id] || d.label;
  }

  // lets the assistant (assistant.js) load players or teams into the page
  window.NFLApp = {
    show: function (mode, ids, y) {
      if (!MODELS[mode]) return;
      if (S.view !== 'compare') showView('compare');
      if (mode !== S.mode) setMode(mode);
      setPicks(ids); S.manual = false; S.example = false; S.tab = 'compare'; S.metric = null;
      if (y) {
        var ys = M().years;
        S.from = Math.max(ys[0], y.from); S.to = Math.min(ys[1], y.to);
        if (y.st) S.st = y.st;
      }
      update();
      $('tabs').scrollIntoView({ behavior: 'smooth', block: 'start' });
    },
    showGame: function (id) {
      if (!window.NFLGames) return;
      showGames(true);
      window.NFLGames.open(id);
    }
  };

  // ---------- init ----------
  function init() {
    try { var th = localStorage.getItem(KEY + '.theme'); if (th === 'dark' || th === 'light') document.documentElement.setAttribute('data-theme', th); } catch (e) { /* storage unavailable */ }
    buildControls();
    syncTheme();
    var saved = load() || {};
    function inYears(ys) { return +saved.from >= ys[0] && +saved.to <= ys[1] && +saved.from <= +saved.to; }
    if (['REG', 'POST', 'ALL'].indexOf(saved.st) >= 0) S.st = saved.st;
    if (typeof saved.pg === 'boolean') S.pg = saved.pg;
    if (['compare', 'trends', 'log'].indexOf(saved.tab) >= 0) S.tab = saved.tab;
    if (saved.xmode === 'cal' || saved.xmode === 'car') S.xmode = saved.xmode;
    var ids = [], tids = [];
    (saved.ids || []).forEach(function (id) { if (C.byId.has(id)) ids.push(C.byId.get(id)); });
    if (T) (saved.tids || []).forEach(function (a) { if (T.byAbbr.has(a)) tids.push(T.byAbbr.get(a)); });
    if (ids.length) setPicks(ids);
    else if (PRESETS.length) { setPicks(PRESETS[0].ids); S.example = true; }
    if (saved.mode !== 'teams' && inYears(C.years)) { S.from = +saved.from; S.to = +saved.to; }
    if (T && tids.length) {
      // park the saved team picks so the Teams switch restores them
      STORE.teams = { picks: tids.slice(0, MAXP).map(function (p, i) { return { p: p, slot: i }; }), from: T.years[0], to: T.years[1], cats: new Set(), manual: false, metric: null, logp: null, example: false };
      if (saved.mode === 'teams' && inYears(T.years)) { STORE.teams.from = +saved.from; STORE.teams.to = +saved.to; }
    }
    if (T && saved.mode === 'teams') setMode('teams');
    else { buildYears(); setMeta(); update(); }
    var sv = saved.view || (saved.games ? 'games' : 'compare');
    if (sv === 'games' && window.NFLGames) showView('games');
    else if (sv === 'trivia' && window.NFLTrivia) showView('trivia');
  }
  init();
})();
