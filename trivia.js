/* NFL Player Compare: Trivia. Every question is generated from the site's own data (data.js, extra.js,
   teams.js, games.js), so answers always match the rest of the site. Depends on Core, TCore, NFLGames, Art. */
(function () {
  'use strict';
  var C = window.Core, T = window.TCore, NG = window.NFLGames, D = window.NFL, X = window.NFL_X || { aw: {}, awards: [] };
  if (!C || !D) return;
  var KEY = 'nflcompare.trivia';
  var ROUND = 10, SECONDS = 20;
  var Y1 = C.years[1];

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
  function rnd(n) { return Math.floor(Math.random() * n); }
  function pick(a) { return a[rnd(a.length)]; }
  function shuffle(a) { a = a.slice(); for (var i = a.length - 1; i > 0; i--) { var j = rnd(i + 1), t = a[i]; a[i] = a[j]; a[j] = t; } return a; }
  function num(v) { return Math.abs(v - Math.round(v)) < 1e-9 ? Math.round(v).toLocaleString('en-US') : v.toLocaleString('en-US', { maximumFractionDigits: 1 }); }
  function roman(n) { var r = '', m = [[50, 'L'], [40, 'XL'], [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']]; m.forEach(function (x) { while (n >= x[0]) { r += x[1]; n -= x[0]; } }); return r; }
  function pname(p) { return C.players[p][1]; }
  function tname(code, season) { return NG ? NG.teamName(code, season) : code; }
  function nick(code, season) { var n = tname(code, season).split(' '); return n[n.length - 1]; }

  // ---------------------------------------------------------------- data, built once on first use
  var STATS = [
    { id: 'pyd', label: 'passing yards', grp: 'QB', min: 1000 }, { id: 'ptd', label: 'passing touchdowns', grp: 'QB', min: 10 },
    { id: 'ryd', label: 'rushing yards', grp: 'RB', min: 400 }, { id: 'rtd', label: 'rushing touchdowns', grp: 'RB', min: 5 },
    { id: 'rec', label: 'receptions', grp: 'WR', min: 40 }, { id: 'cyd', label: 'receiving yards', grp: 'WR', min: 500 },
    { id: 'ctd', label: 'receiving touchdowns', grp: 'WR', min: 5 }, { id: 'dsk', label: 'sacks', grp: 'DEF', min: 5 },
    { id: 'dint', label: 'interceptions', grp: 'DEF', min: 3 }, { id: 'fgm', label: 'field goals made', grp: 'K', min: 15 }
  ];
  var EASY_STATS = ['pyd', 'ryd', 'cyd', 'dsk', 'ptd', 'rec'];
  var DB = null;
  function db() {
    if (DB) return DB;
    var FI = {};
    D.fields.forEach(function (k, i) { FI[k] = i + 5; });
    var bySeason = {}, career = new Map(), games = new Float64Array(C.players.length);
    D.rows.forEach(function (r) {
      if (r[2] !== 0) return;
      games[r[0]] += r[4];
      var sm = bySeason[r[1]] || (bySeason[r[1]] = new Map());
      var a = sm.get(r[0]); if (!a) { a = {}; sm.set(r[0], a); }
      var c = career.get(r[0]); if (!c) { c = {}; career.set(r[0], c); }
      STATS.forEach(function (st) { var v = r[FI[st.id]] || 0; a[st.id] = (a[st.id] || 0) + v; c[st.id] = (c[st.id] || 0) + v; });
    });
    // how well known a player is: games played plus honors; used to pick fair wrong answers
    var prom = C.players.map(function (pl, i) {
      var hn = (X.hon && X.hon[i]) || [0, 0, 0];
      return games[i] + 25 * (hn[0] || 0) + 50 * (hn[1] || 0) + 40 * ((X.aw[i] || []).length);
    });
    var seasons = Object.keys(bySeason).map(Number).filter(function (s) { return s < Y1; }).sort();
    var sb = NG ? NG.games.filter(function (g) { return g.type === 4 && g.played; }) : [];
    var awards = {};
    Object.keys(X.aw || {}).forEach(function (p) { X.aw[p].forEach(function (x) { (awards[x[1]] = awards[x[1]] || []).push({ p: +p, s: x[0] }); }); });
    DB = { bySeason: bySeason, career: career, prom: prom, seasons: seasons, sb: sb, awards: awards };
    return DB;
  }
  function seasonsFor(level) {
    var s = db().seasons;
    if (level === 'easy') return s.filter(function (x) { return x >= Y1 - 12; });
    if (level === 'medium') return s.filter(function (x) { return x >= 2005; });
    return s;
  }
  function ranked(map, stat, grp) {
    var out = [];
    map.forEach(function (a, p) { if (a[stat] > 0 && (!grp || C.players[p][3] === grp || (grp === 'WR' && C.players[p][3] === 'TE') || (grp === 'RB' && stat === 'rtd'))) out.push({ p: p, v: a[stat] }); });
    return out.sort(function (a, b) { return b.v - a.v; });
  }
  // three wrong answers from a ranked list, skipping anyone tied with the answer
  function distractors(list, answerV, count, from, to) {
    var pool = list.slice(from || 1, to || 10).filter(function (x) { return Math.abs(x.v - answerV) > 1e-9; });
    return shuffle(pool).slice(0, count || 3);
  }

  // ---------------------------------------------------------------- question makers
  // each returns { cat, q, choices: [text], answer: index, explain, look: optional action } or null
  function mc(cat, q, right, wrong, explain, look, key) {
    var all = shuffle([right].concat(wrong));
    return { cat: cat, q: q, choices: all, answer: all.indexOf(right), explain: explain, look: look, key: key || q };
  }
  var MAKERS = {
    seasonLeader: { cat: 'players', make: function (lvl) {
      var st = pick(STATS.filter(function (x) { return lvl !== 'easy' || EASY_STATS.indexOf(x.id) >= 0; }));
      var s = pick(seasonsFor(lvl));
      var list = ranked(db().bySeason[s], st.id);
      if (list.length < 6 || list[0].v === list[1].v) return null;
      var wrong = distractors(list, list[0].v, 3, 1, lvl === 'hard' ? 6 : 8);
      if (wrong.length < 3) return null;
      return mc('players', 'Who led the NFL in ' + st.label + ' in the ' + s + ' regular season?', pname(list[0].p), wrong.map(function (x) { return pname(x.p); }),
        pname(list[0].p) + ' led with ' + num(list[0].v) + '. ' + pname(list[1].p) + ' was next with ' + num(list[1].v) + '.',
        { players: [list[0].p, list[1].p] }, 'sl' + st.id + s);
    } },
    careerLeader: { cat: 'players', make: function (lvl) {
      var st = pick(STATS.filter(function (x) { return lvl !== 'easy' || EASY_STATS.indexOf(x.id) >= 0; }));
      var list = ranked(db().career, st.id);
      var rank = lvl === 'easy' ? 0 : rnd(lvl === 'medium' ? 2 : 3);
      var ans = list[rank];
      var wrong = shuffle(list.slice(0, 12).filter(function (x, i) { return i !== rank && Math.abs(x.v - ans.v) > 1e-9; })).slice(0, 3);
      var place = ['the most', 'the second-most', 'the third-most'][rank];
      return mc('players', 'Since 1999, who has ' + place + ' regular-season ' + st.label + '?', pname(ans.p), wrong.map(function (x) { return pname(x.p); }),
        pname(ans.p) + ' has ' + num(ans.v) + '. The top three: ' + list.slice(0, 3).map(function (x) { return pname(x.p) + ' (' + num(x.v) + ')'; }).join(', ') + '.',
        { players: list.slice(0, 3).map(function (x) { return x.p; }) }, 'cl' + st.id + rank);
    } },
    moreCareer: { cat: 'players', make: function (lvl) {
      var st = pick(STATS);
      var list = ranked(db().career, st.id).slice(0, lvl === 'easy' ? 25 : 60);
      var a = pick(list), b = pick(list);
      if (!a || !b || a.p === b.p || Math.abs(a.v - b.v) < (lvl === 'hard' ? 1 : list[0].v * 0.04)) return null;
      var hi = a.v > b.v ? a : b, lo = hi === a ? b : a;
      return mc('players', 'Who has more regular-season ' + st.label + ' since 1999: ' + pname(a.p) + ' or ' + pname(b.p) + '?', pname(hi.p), [pname(lo.p)],
        pname(hi.p) + ' has ' + num(hi.v) + ', ' + pname(lo.p) + ' has ' + num(lo.v) + '.', { players: [hi.p, lo.p] }, 'mc' + st.id + Math.min(a.p, b.p) + '-' + Math.max(a.p, b.p));
    } },
    award: { cat: 'awards', make: function (lvl) {
      var codes = lvl === 'easy' ? ['mvp', 'sbmvp', 'oroy', 'dpoy'] : ['mvp', 'opoy', 'dpoy', 'oroy', 'droy', 'cpoy', 'sbmvp'];
      var code = pick(codes), list = (db().awards[code] || []).filter(function (w) { return seasonsFor(lvl).indexOf(w.s) >= 0 || (lvl !== 'easy' && w.s >= 1999); });
      if (!list.length) return null;
      var w = pick(list), grp = C.players[w.p][3];
      // wrong answers: well-known players at the same position who played that season (rookies for rookie awards)
      var pool = [];
      db().bySeason[w.s].forEach(function (a, p) {
        if (p === w.p || C.players[p][3] !== grp) return;
        if ((code === 'oroy' || code === 'droy') && C.players[p][4] !== w.s) return;
        pool.push(p);
      });
      pool.sort(function (a, b) { return db().prom[b] - db().prom[a]; });
      var wrong = shuffle(pool.slice(0, 12)).slice(0, 3);
      if (wrong.length < 3) return null;
      var label = (X.awards.filter(function (a) { return a[0] === code; })[0] || [0, code])[1];
      var when = code === 'sbmvp' ? 'Super Bowl ' + roman(w.s - 1965) + ' (the ' + w.s + ' season)' : 'the ' + w.s + ' season';
      return mc('awards', 'Who won ' + (code === 'sbmvp' ? 'MVP of ' + when : label + ' for ' + when) + '?', pname(w.p), wrong.map(pname),
        pname(w.p) + ' (' + C.players[w.p][2] + ') won ' + label + ' for ' + w.s + '.', { players: [w.p] }, 'aw' + code + w.s);
    } },
    superBowl: { cat: 'awards', make: function (lvl) {
      var list = db().sb.filter(function (g) { return seasonsFor(lvl).indexOf(g.season) >= 0 || lvl !== 'easy'; });
      if (!list.length) return null;
      var g = pick(list), w = NG.winner(g), l = w === g.home ? g.away : g.home;
      var others = shuffle(T.teams.map(function (t) { return t[0]; }).filter(function (c) { return NG.fr(c) !== NG.fr(w) && NG.fr(c) !== NG.fr(l); })).slice(0, 2);
      return mc('awards', 'Who won Super Bowl ' + roman(g.season - 1965) + ', after the ' + g.season + ' season?', tname(w, g.season), [tname(l, g.season)].concat(others.map(function (c) { return tname(c); })),
        'The ' + tname(w, g.season) + ' beat the ' + tname(l, g.season) + ' ' + Math.max(g.as, g.hs) + '–' + Math.min(g.as, g.hs) + '.', { game: g.id }, 'sb' + g.season);
    } },
    superBowlScore: { cat: 'awards', make: function (lvl) {
      if (lvl === 'easy') return null;
      var g = pick(db().sb), hi = Math.max(g.as, g.hs), lo = Math.min(g.as, g.hs), w = NG.winner(g), l = w === g.home ? g.away : g.home;
      var right = hi + '–' + lo, seen = {}, wrong = [];
      seen[right] = 1;
      while (wrong.length < 3) {
        var a = hi + pick([-7, -4, -3, 3, 4, 7, 0]), b = lo + pick([-7, -3, 3, 7, 0, -4]);
        if (a <= b || b < 0) continue;
        var t = a + '–' + b;
        if (!seen[t]) { seen[t] = 1; wrong.push(t); }
      }
      return mc('awards', 'The ' + tname(w, g.season) + ' beat the ' + tname(l, g.season) + ' in Super Bowl ' + roman(g.season - 1965) + '. What was the final score?', right, wrong,
        'It finished ' + right + (g.ot ? ' in overtime' : '') + '.', { game: g.id }, 'sbs' + g.season);
    } },
    bestRecord: { cat: 'teams', make: function (lvl) {
      var s = pick(seasonsFor(lvl).filter(function (x) { return x >= 2000; }));
      var rows = T.teams.map(function (t, i) { var a = T.aggregate(i, { st: 'REG', from: s, to: s }).tot; return { i: i, a: a, v: (a.w + a.t / 2) / Math.max(1, a.w + a.l + a.t) }; })
        .filter(function (r) { return r.a.w + r.a.l + r.a.t > 0; }).sort(function (a, b) { return b.v - a.v; });
      if (rows.length < 8 || rows[0].v === rows[1].v) return null;
      var wrong = shuffle(rows.slice(1, 9).filter(function (r) { return r.v < rows[0].v; })).slice(0, 3);
      function rec(a) { return a.w + '–' + a.l + (a.t ? '–' + a.t : ''); }
      return mc('teams', 'Which team had the best regular-season record in ' + s + '?', T.teams[rows[0].i][1], wrong.map(function (r) { return T.teams[r.i][1]; }),
        'The ' + T.teams[rows[0].i][1] + ' went ' + rec(rows[0].a) + '. Next best: the ' + T.teams[rows[1].i][1] + ' at ' + rec(rows[1].a) + '.',
        { teams: [rows[0].i, rows[1].i], season: s }, 'br' + s);
    } },
    teamWins: { cat: 'teams', make: function (lvl) {
      var s = pick(seasonsFor(lvl).filter(function (x) { return x >= 2000; })), t = rnd(T.teams.length);
      var a = T.aggregate(t, { st: 'REG', from: s, to: s }).tot;
      if (!a.w && !a.l) return null;
      var opts = {}, wrong = [];
      opts[a.w] = 1;
      shuffle([-3, -2, -1, 1, 2, 3, 4, -4]).forEach(function (d) { var v = a.w + d; if (wrong.length < 3 && v >= 0 && v <= a.w + a.l + a.t && !opts[v]) { opts[v] = 1; wrong.push(String(v)); } });
      if (wrong.length < 3) return null;
      return mc('teams', 'How many regular-season games did the ' + T.teams[t][1] + ' win in ' + s + '?', String(a.w), wrong,
        'They went ' + a.w + '–' + a.l + (a.t ? '–' + a.t : '') + ' and scored ' + a.pf + ' points.', { teams: [t], season: s }, 'tw' + t + s);
    } },
    playoffWinner: { cat: 'teams', make: function (lvl) {
      var list = NG.games.filter(function (g) { return g.type >= 1 && g.type <= 3 && g.played && (lvl !== 'easy' || g.season >= Y1 - 12); });
      if (!list.length) return null;
      var g = pick(list), w = NG.winner(g), l = w === g.home ? g.away : g.home;
      if (w === 'TIE') return null;
      var ti = T.byAbbr.get(NG.fr(g.home)), round = g.type === 3 && ti != null ? T.teams[ti][2] + ' Championship' : NG.roundName(g);
      return mc('teams', 'Who won the ' + g.season + ' season\'s ' + round + ' game between the ' + tname(g.away, g.season) + ' and the ' + tname(g.home, g.season) + '?',
        tname(w, g.season), [tname(l, g.season)],
        'The ' + nick(w, g.season) + ' won ' + Math.max(g.as, g.hs) + '–' + Math.min(g.as, g.hs) + (g.ot ? ' in overtime' : '') + '.', { game: g.id }, 'pw' + g.id);
    } },
    favorite: { cat: 'betting', make: function () {
      var g = pick(db().sb.filter(function (x) { return x.spread; }));
      if (!g) return null;
      var fav = g.spread > 0 ? g.home : g.away, dog = fav === g.home ? g.away : g.home;
      return mc('betting', 'Which team was favored to win Super Bowl ' + roman(g.season - 1965) + ' (' + g.season + ' season)?', tname(fav, g.season), [tname(dog, g.season)],
        'The ' + nick(fav, g.season) + ' were ' + Math.abs(g.spread) + '-point favorites. ' + (NG.winner(g) === fav ? 'And they won.' : 'The ' + nick(dog, g.season) + ' won anyway.'), { game: g.id }, 'fv' + g.season);
    } },
    cover: { cat: 'betting', make: function (lvl) {
      var list = NG.games.filter(function (g) { return g.played && g.spread && g.hs - g.as !== g.spread && (lvl !== 'easy' || g.season >= Y1 - 5); });
      var g = pick(list), fav = g.spread > 0 ? g.home : g.away, dog = fav === g.home ? g.away : g.home;
      var c = NG.coverText(g).split(' ')[0];
      var favScore = fav === g.home ? g.hs : g.as, dogScore = fav === g.home ? g.as : g.hs;
      return mc('betting', NG.roundName(g) + ', ' + g.season + ': the ' + tname(fav, g.season) + ' were ' + Math.abs(g.spread) + '-point favorites over the ' + tname(dog, g.season) +
        ' and the final was ' + nick(fav, g.season) + ' ' + favScore + ', ' + nick(dog, g.season) + ' ' + dogScore + '. Who covered the spread?',
        tname(c, g.season), [tname(c === fav ? dog : fav, g.season)],
        c === fav ? 'The ' + nick(fav, g.season) + ' won by ' + (favScore - dogScore) + ', more than ' + Math.abs(g.spread) + '.' : 'The ' + nick(dog, g.season) + (dogScore > favScore ? ' won outright.' : ' lost by less than ' + Math.abs(g.spread) + '.'),
        { game: g.id }, 'cv' + g.id);
    } },
    overUnder: { cat: 'betting', make: function () {
      var g = pick(db().sb.filter(function (x) { return x.total != null && x.as + x.hs !== x.total; }));
      if (!g) return null;
      var pts = g.as + g.hs, over = pts > g.total;
      return mc('betting', 'The over/under for Super Bowl ' + roman(g.season - 1965) + ' (' + tname(g.away, g.season) + ' vs ' + tname(g.home, g.season) + ') was ' + g.total + '. Did it go over or under?',
        over ? 'Over' : 'Under', [over ? 'Under' : 'Over'], 'The teams combined for ' + pts + ' points (' + g.as + '–' + g.hs + ').', { game: g.id }, 'ou' + g.season);
    } }
  };
  var CATS = [['all', 'Everything'], ['players', 'Players'], ['teams', 'Teams & games'], ['awards', 'Super Bowls & awards'], ['betting', 'Betting lines']];
  function makeQuestion(cat, lvl, used) {
    var makers = Object.keys(MAKERS).filter(function (k) { return cat === 'all' || MAKERS[k].cat === cat; });
    for (var tries = 0; tries < 60; tries++) {
      var q = null;
      try { q = MAKERS[pick(makers)].make(lvl); } catch (e) { q = null; }
      if (q && !used[q.key]) { used[q.key] = 1; return q; }
    }
    return null;
  }

  // ---------------------------------------------------------------- game state and UI
  var st = { cat: 'all', lvl: 'medium', timer: true, voice: false, best: {}, played: 0 };
  try { var sv = JSON.parse(localStorage.getItem(KEY) || 'null'); if (sv) st = Object.assign(st, sv); } catch (e) { /* storage unavailable */ }
  function save() { try { localStorage.setItem(KEY, JSON.stringify({ cat: st.cat, lvl: st.lvl, timer: st.timer, voice: st.voice, best: st.best, played: st.played })); } catch (e) { /* storage unavailable */ } }
  var host, round = null, tick = null;

  function bestKey() { return st.cat + '|' + st.lvl; }
  function say(text) { if (st.voice && window.Luna && window.Luna.say) window.Luna.say(text); }
  function quiet() { if (window.Luna && window.Luna.stop) window.Luna.stop(); }
  function stopTimer() { if (tick) { clearInterval(tick); tick = null; } }

  function seg(items, cur, onPick, label) {
    return h('div', { class: 'seg', role: 'group', 'aria-label': label }, items.map(function (it) {
      return h('button', { type: 'button', 'aria-pressed': String(cur === it[0]), text: it[1], onclick: function () { onPick(it[0]); } });
    }));
  }
  function startScreen() {
    stopTimer(); quiet(); round = null;
    var best = st.best[bestKey()];
    host.replaceChildren(h('section', { class: 'tv-card tv-start' },
      h('div', { class: 'tv-hero' }, h('div', { class: 'tv-ball', 'aria-hidden': 'true' }), h('div', null, h('h2', { text: 'NFL Trivia' }),
        h('p', { text: ROUND + ' questions built from every season since 1999. Answer fast for bonus points, and keep a streak going.' }))),
      h('div', { class: 'tv-opts' },
        h('div', { class: 'fg' }, h('span', { class: 'lbl', text: 'Topic' }), h('div', { class: 'chips' }, CATS.map(function (c) {
          return h('button', { type: 'button', class: 'chip', 'aria-pressed': String(st.cat === c[0]), text: c[1], onclick: function () { st.cat = c[0]; save(); startScreen(); } });
        }))),
        h('div', { class: 'frow' },
          h('div', { class: 'fg' }, h('span', { class: 'lbl', text: 'Difficulty' }), seg([['easy', 'Rookie'], ['medium', 'Pro'], ['hard', 'Hall of Fame']], st.lvl, function (v) { st.lvl = v; save(); startScreen(); }, 'Difficulty')),
          h('div', { class: 'fg' }, h('span', { class: 'lbl', text: 'Timer' }), seg([[true, SECONDS + ' seconds'], [false, 'Off']], st.timer, function (v) { st.timer = v; save(); startScreen(); }, 'Timer')),
          window.Luna && window.Luna.say ? h('div', { class: 'fg' }, h('span', { class: 'lbl', text: 'Luna reads questions' }), seg([[true, 'On'], [false, 'Off']], st.voice, function (v) { st.voice = v; save(); startScreen(); }, 'Read questions aloud')) : null)),
      h('div', { class: 'tv-go' },
        h('button', { type: 'button', class: 'tv-btn', text: 'Kick off ▶', onclick: startRound }),
        best ? h('span', { class: 'gstat', text: 'Your best here: ' + best.score.toLocaleString('en-US') + ' points (' + best.right + '/' + ROUND + ')' }) : null)));
  }
  function startRound() {
    var used = {}, qs = [];
    for (var i = 0; i < ROUND; i++) { var q = makeQuestion(st.cat, st.lvl, used); if (q) qs.push(q); }
    if (!qs.length) { host.replaceChildren(h('p', { class: 'empty', text: 'Could not build questions for that topic. Try another one.' })); return; }
    round = { qs: qs, i: 0, score: 0, right: 0, streak: 0, bestStreak: 0, answers: [] };
    show();
  }
  function show() {
    stopTimer();
    var q = round.qs[round.i], left = SECONDS, locked = false;
    var bar = h('div', { class: 'tv-timer' }, h('i'));
    var choices = h('div', { class: 'tv-choices' + (q.choices.length === 2 ? ' two' : '') }, q.choices.map(function (c, i) {
      return h('button', { type: 'button', class: 'tv-choice', 'data-i': i, onclick: function () { answer(i); } }, h('span', { class: 'tv-key', text: 'ABCD'[i] }), h('span', { text: c }));
    }));
    var feedback = h('div', { class: 'tv-feedback', 'aria-live': 'polite' });
    var card = h('section', { class: 'tv-card', 'aria-label': 'Question ' + (round.i + 1) + ' of ' + round.qs.length },
      h('div', { class: 'tv-top' },
        h('span', { class: 'tv-count', text: 'Question ' + (round.i + 1) + ' / ' + round.qs.length }),
        h('span', { class: 'tv-cat', text: (CATS.filter(function (c) { return c[0] === q.cat; })[0] || ['', ''])[1] }),
        h('span', { class: 'tv-score' }, h('b', { text: round.score.toLocaleString('en-US') }), ' pts', round.streak >= 2 ? h('span', { class: 'tv-streak', text: ' \u{1F525} ' + round.streak }) : null),
        h('button', { type: 'button', class: 'chip', text: 'Quit', onclick: startScreen })),
      st.timer ? bar : null,
      h('h3', { class: 'tv-q', text: q.q }),
      choices, feedback);
    host.replaceChildren(card);
    say(q.q + ' ' + q.choices.map(function (c, i) { return 'ABCD'[i] + ': ' + c + '.'; }).join(' '));
    card.querySelector('.tv-choice').focus({ preventScroll: true });
    if (st.timer) {
      var fill = bar.firstChild, t0 = Date.now();
      tick = setInterval(function () {
        if (!host.isConnected || host.hidden) { stopTimer(); return; }
        left = SECONDS - (Date.now() - t0) / 1000;
        fill.style.width = Math.max(0, left / SECONDS * 100) + '%';
        if (left <= 5) bar.classList.add('low');
        if (left <= 0) answer(-1);
      }, 100);
    }
    function answer(i) {
      if (locked) return;
      locked = true; stopTimer(); quiet();
      var ok = i === q.answer, pts = 0;
      if (ok) {
        round.right++; round.streak++; round.bestStreak = Math.max(round.bestStreak, round.streak);
        pts = 100 + (st.timer ? Math.round(Math.max(0, left) / SECONDS * 50) : 0) + (round.streak >= 3 ? 25 : 0);
        round.score += pts;
      } else round.streak = 0;
      round.answers.push({ q: q, picked: i, ok: ok });
      Array.prototype.forEach.call(choices.children, function (b, k) {
        b.disabled = true;
        if (k === q.answer) b.classList.add('right');
        else if (k === i) b.classList.add('wrong');
      });
      var head = ok ? pick(['Touchdown!', 'Nailed it!', 'Right on!', 'Correct!']) + ' +' + pts : i < 0 ? 'Time\'s up!' : pick(['Fumble!', 'Not quite.', 'Incomplete.']);
      feedback.replaceChildren(
        h('p', { class: 'tv-res ' + (ok ? 'ok' : 'no'), text: head }),
        h('p', { text: q.explain }),
        h('div', { class: 'tv-acts' },
          q.look ? h('button', { type: 'button', class: 'chip', text: 'Look it up', title: 'Leaves the quiz and opens this in the stats pages', onclick: function () { lookUp(q.look); } }) : null,
          h('button', { type: 'button', class: 'tv-btn', text: round.i + 1 < round.qs.length ? 'Next question ▶' : 'See my score', onclick: next })));
      say((ok ? 'Correct! ' : 'The answer is ' + q.choices[q.answer] + '. ') + q.explain);
      if (ok && window.Art && round.streak >= 3) window.Art.confetti(card, ['#f7d774', '#1baf7a']);
      feedback.querySelector('.tv-btn').focus({ preventScroll: true });
    }
    card.addEventListener('keydown', function (e) {
      var k = e.key.toUpperCase(), idx = 'ABCD'.indexOf(k);
      if (!locked && idx >= 0 && idx < q.choices.length) { e.preventDefault(); answer(idx); }
      else if (!locked && /^[1-4]$/.test(e.key) && +e.key <= q.choices.length) { e.preventDefault(); answer(+e.key - 1); }
    });
  }
  function next() {
    quiet();
    round.i++;
    if (round.i < round.qs.length) show(); else finish();
  }
  function finish() {
    stopTimer();
    var k = bestKey(), prev = st.best[k], isBest = !prev || round.score > prev.score;
    if (isBest) st.best[k] = { score: round.score, right: round.right };
    st.played++; save();
    var rating = round.right === round.qs.length ? 'Perfect game! Hall of Fame material.' : round.right >= 8 ? 'All-Pro performance!' : round.right >= 6 ? 'Solid starter.' : round.right >= 4 ? 'Practice squad. Run it back!' : 'Rough day at the office. Try Rookie level?';
    var share = 'I scored ' + round.score.toLocaleString('en-US') + ' points (' + round.right + '/' + round.qs.length + ') on NFL trivia: ' + location.href.split('#')[0];
    var copyBtn = h('button', { type: 'button', class: 'chip', text: 'Copy my score', onclick: function () {
      var done = function () { copyBtn.textContent = 'Copied!'; };
      if (navigator.clipboard) navigator.clipboard.writeText(share).then(done, function () { copyBtn.textContent = share; });
      else copyBtn.textContent = share;
    } });
    var card = h('section', { class: 'tv-card tv-end' },
      h('h2', { text: rating }),
      h('div', { class: 'gsum' },
        h('div', null, h('span', { class: 'lbl', text: 'Score' }), h('b', { text: round.score.toLocaleString('en-US') })),
        h('div', null, h('span', { class: 'lbl', text: 'Correct' }), h('b', { text: round.right + ' / ' + round.qs.length })),
        h('div', null, h('span', { class: 'lbl', text: 'Best streak' }), h('b', { text: String(round.bestStreak) })),
        h('div', null, h('span', { class: 'lbl', text: isBest ? 'New best!' : 'Your best' }), h('b', { text: (isBest ? round.score : prev.score).toLocaleString('en-US') }))),
      h('ol', { class: 'tv-review' }, round.answers.map(function (a) {
        return h('li', { class: a.ok ? 'ok' : 'no' }, h('span', { class: 'tv-mark', text: a.ok ? '✓' : '✗' }), h('div', null, h('b', { text: a.q.q }), h('span', { text: ' Answer: ' + a.q.choices[a.q.answer] + '.' })));
      })),
      h('div', { class: 'tv-acts' }, h('button', { type: 'button', class: 'tv-btn', text: 'Play again ▶', onclick: startRound }), h('button', { type: 'button', class: 'chip', text: 'Change topic or difficulty', onclick: startScreen }), copyBtn));
    host.replaceChildren(card);
    say(rating + ' You got ' + round.right + ' out of ' + round.qs.length + ', for ' + round.score + ' points.');
    if (window.Art && (isBest || round.right >= 8)) window.Art.confetti(card);
  }
  function lookUp(look) {
    stopTimer(); quiet();
    if (!window.NFLApp) return;
    if (look.game) window.NFLApp.showGame(look.game);
    else if (look.players) window.NFLApp.show('players', look.players);
    else if (look.teams) window.NFLApp.show('teams', look.teams, look.season ? { from: look.season, to: look.season, st: 'REG' } : null);
  }
  function mount(el) {
    host = el;
    if (round && round.i < round.qs.length) show(); else startScreen();
  }
  document.addEventListener('visibilitychange', function () { if (document.hidden) quiet(); });

  window.NFLTrivia = { mount: mount, makeQuestion: makeQuestion, makers: MAKERS };
})();
