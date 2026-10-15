/* Team stat logic for NFL Player Compare. Depends on window.NFL_T (teams.js) and window.Core (core.js). No DOM access. */
(function (root) {
  'use strict';
  var D = root.NFL_T, C = root.Core;
  if (!D || !C) return;
  var F = D.fields, OFF = 5, FI = {};
  F.forEach(function (k, i) { FI[k] = i + OFF; });
  var teams = D.teams; // [abbr, name, conf, division, color, color2]

  var byTeam = new Map();
  var Y0 = 9999, Y1 = 0;
  D.rows.forEach(function (r) {
    var a = byTeam.get(r[0]);
    if (!a) { a = []; byTeam.set(r[0], a); }
    a.push(r);
    if (r[1] < Y0) Y0 = r[1];
    if (r[1] > Y1) Y1 = r[1];
  });
  var post = new Map(); // team -> Map(season -> [playoff wins, playoff losses, Super Bowl 0 none / 1 lost / 2 won])
  Object.keys(D.post || {}).forEach(function (t) {
    var m = new Map();
    D.post[t].forEach(function (x) { m.set(x[0], [x[1], x[2], x[3]]); });
    post.set(+t, m);
  });

  function blank() {
    var o = { g: 0, teams: [], season: 0, n: 0, po: 0, pw: 0, pl: 0, sba: 0, sbw: 0 };
    F.forEach(function (k) { o[k] = 0; });
    return o;
  }
  function aggregate(t, o) {
    var bySeason = new Map();
    (byTeam.get(t) || []).forEach(function (r) {
      if (r[1] < o.from || r[1] > o.to) return;
      if (o.st === 'REG' && r[2] !== 0) return;
      if (o.st === 'POST' && r[2] !== 1) return;
      var s = bySeason.get(r[1]);
      if (!s) { s = blank(); s.season = r[1]; bySeason.set(r[1], s); }
      s.g += r[4];
      F.forEach(function (k) { s[k] += r[FI[k]]; });
      r[3].split('/').forEach(function (x) { if (x && s.teams.indexOf(x) < 0) s.teams.push(x); });
    });
    // playoff results belong to the season whatever the season-type filter
    var pm = post.get(t);
    bySeason.forEach(function (s) {
      var p = pm && pm.get(s.season);
      if (p) { s.po = 1; s.pw = p[0]; s.pl = p[1]; s.sba = p[2] ? 1 : 0; s.sbw = p[2] === 2 ? 1 : 0; }
    });
    var seasons = Array.from(bySeason.values()).sort(function (a, b) { return a.season - b.season; });
    var tot = blank();
    seasons.forEach(function (s) {
      tot.g += s.g; ['po', 'pw', 'pl', 'sba', 'sbw'].forEach(function (k) { tot[k] += s[k]; });
      F.forEach(function (k) { tot[k] += s[k]; });
      s.teams.forEach(function (x) { if (tot.teams.indexOf(x) < 0) tot.teams.push(x); });
    });
    tot.n = seasons.length;
    return { tot: tot, seasons: seasons };
  }

  // ---------- stat definitions (same shape as Core.CATS) ----------
  function div(a, b) { return b > 0 ? a / b : null; }
  function P(id, label, o) { return Object.assign({ id: id, label: label, kind: 'sum', fmt: 'int', lead: true, better: 'high' }, o); }
  function R(id, label, fmt, o) { return P(id, label, Object.assign({ kind: 'rate', fmt: fmt }, o)); }
  // season counts (playoff trips, titles): never divided per game
  function N(id, label, o) { return P(id, label, Object.assign({ kind: 'cnt' }, o)); }
  function gp(a) { return a.w + a.l + a.t; }
  function offyd(a) { return a.pyd - a.sckyd + a.ryd; }
  function defyd(a) { return a.apyd - a.asckyd + a.aryd; }
  function plays(a) { return a.att + a.sck + a.car; }
  function aplays(a) { return a.aatt + a.asck + a.acar; }
  function give(a) { return a.int + a.fuml; }
  function take(a) { return a.dint + a.fr; }
  function rating(c, at, y, td, i) { return C.rating({ cmp: c, att: at, pyd: y, ptd: td, int: i }); }

  var CATS = [
    { id: 'rec', label: 'Record', main: 'wins', stats: [
      P('wins', 'Wins', { val: function (a) { return a.w; }, log: 1 }),
      P('losses', 'Losses', { val: function (a) { return a.l; }, lead: false, log: 1 }),
      P('ties', 'Ties', { val: function (a) { return a.t; }, lead: false }),
      R('winp', 'Win %', 'pct', { tip: 'Ties count half', val: function (a) { return gp(a) ? (a.w + a.t / 2) / gp(a) : null; }, log: 1 }),
      P('pf', 'Points Scored', { val: function (a) { return a.pf; }, log: 1 }),
      P('pa', 'Points Allowed', { val: function (a) { return a.pa; }, better: 'low', log: 1 }),
      P('pdiff', 'Point Differential', { val: function (a) { return a.pf - a.pa; }, log: 1 }),
      R('pfg', 'Points / Game', 'd1', { val: function (a) { return div(a.pf, gp(a)); } }),
      R('pag', 'Points Allowed / Game', 'd1', { val: function (a) { return div(a.pa, gp(a)); }, better: 'low' })
    ] },
    { id: 'post', label: 'Playoffs', main: 'po', stats: [
      N('po', 'Playoff Seasons', { tip: 'Seasons with at least one playoff game', val: function (a) { return a.po; }, log: 1 }),
      N('pw', 'Playoff Wins', { val: function (a) { return a.pw; }, log: 1 }),
      N('pl', 'Playoff Losses', { val: function (a) { return a.pl; }, lead: false }),
      N('sba', 'Super Bowl Appearances', { val: function (a) { return a.sba; }, log: 1 }),
      N('sbw', 'Super Bowl Wins', { val: function (a) { return a.sbw; }, log: 1 })
    ] },
    { id: 'off', label: 'Offense', main: 'oyd', stats: [
      P('oyd', 'Total Yards', { tip: 'Passing yards - sack yards + rushing yards', val: offyd, log: 1 }),
      R('oypp', 'Yards / Play', 'd2', { tip: 'Total yards / (pass attempts + sacks + carries)', val: function (a) { return div(offyd(a), plays(a)); }, log: 1 }),
      P('ofd', 'First Downs', { tip: 'Passing + rushing first downs', val: function (a) { return a.pfd + a.rfd; } }),
      P('give', 'Turnovers', { tip: 'Interceptions thrown + fumbles lost', val: give, better: 'low', log: 1 }),
      P('oepa', 'Offensive EPA', { fmt: 'd1', tip: 'Expected points added on passes and runs (nflverse)', val: function (a) { return a.pepa + a.repa; } }),
      R('oepap', 'EPA / Play', 'd3', { val: function (a) { return div(a.pepa + a.repa, plays(a)); }, log: 1 })
    ] },
    { id: 'pass', label: 'Passing Offense', main: 'pnet', stats: [
      P('cmp', 'Completions', { val: function (a) { return a.cmp; } }),
      P('att', 'Attempts', { val: function (a) { return a.att; } }),
      R('cmpp', 'Completion %', 'pct', { val: function (a) { return div(a.cmp, a.att); }, log: 1 }),
      P('pyd', 'Passing Yards', { tip: 'Gross, before sacks', val: function (a) { return a.pyd; } }),
      P('pnet', 'Net Passing Yards', { tip: 'Passing yards - sack yards', val: function (a) { return a.pyd - a.sckyd; }, log: 1 }),
      P('ptd', 'Passing TD', { val: function (a) { return a.ptd; }, log: 1 }),
      P('int', 'Interceptions Thrown', { val: function (a) { return a.int; }, better: 'low', log: 1 }),
      R('nya', 'Net Yards / Attempt', 'd2', { tip: '(Passing yards - sack yards) / (attempts + sacks)', val: function (a) { return div(a.pyd - a.sckyd, a.att + a.sck); } }),
      R('rate', 'Passer Rating', 'd1', { val: function (a) { return rating(a.cmp, a.att, a.pyd, a.ptd, a.int); }, log: 1 }),
      P('sck', 'Sacks Allowed', { val: function (a) { return a.sck; }, better: 'low' }),
      R('sckr', 'Sack %', 'pct', { tip: 'Sacks / (attempts + sacks)', val: function (a) { return div(a.sck, a.att + a.sck); }, better: 'low' })
    ] },
    { id: 'rush', label: 'Rushing Offense', main: 'ryd', stats: [
      P('car', 'Carries', { val: function (a) { return a.car; }, log: 1 }),
      P('ryd', 'Rushing Yards', { val: function (a) { return a.ryd; }, log: 1 }),
      P('rtd', 'Rushing TD', { val: function (a) { return a.rtd; }, log: 1 }),
      R('ypc', 'Yards / Carry', 'd2', { val: function (a) { return div(a.ryd, a.car); }, log: 1 }),
      P('fuml', 'Fumbles Lost', { val: function (a) { return a.fuml; }, better: 'low' })
    ] },
    { id: 'def', label: 'Defense', main: 'dyd', stats: [
      P('dyd', 'Yards Allowed', { tip: 'Opponent passing yards - sack yards + rushing yards', val: defyd, better: 'low', log: 1 }),
      R('dypp', 'Yards / Play Allowed', 'd2', { val: function (a) { return div(defyd(a), aplays(a)); }, better: 'low', log: 1 }),
      P('dpyd', 'Pass Yards Allowed', { tip: 'Net of sacks', val: function (a) { return a.apyd - a.asckyd; }, better: 'low' }),
      P('dryd', 'Rush Yards Allowed', { val: function (a) { return a.aryd; }, better: 'low' }),
      P('dtda', 'TD Allowed (pass + rush)', { val: function (a) { return a.aptd + a.artd; }, better: 'low' }),
      R('drate', 'Opp. Passer Rating', 'd1', { val: function (a) { return rating(a.acmp, a.aatt, a.apyd, a.aptd, a.dint); }, better: 'low' }),
      P('dsk', 'Sacks', { fmt: 'half', val: function (a) { return a.dsk; }, log: 1 }),
      P('qbh', 'QB Hits', { val: function (a) { return a.qbh; } }),
      P('tfl', 'Tackles for Loss', { val: function (a) { return a.tfl; } }),
      P('dint', 'Interceptions', { val: function (a) { return a.dint; }, log: 1 }),
      P('pd', 'Passes Defended', { val: function (a) { return a.pd; } }),
      P('ff', 'Forced Fumbles', { val: function (a) { return a.ff; } }),
      P('fr', 'Fumble Recoveries', { val: function (a) { return a.fr; } }),
      P('take', 'Takeaways', { tip: 'Interceptions + fumble recoveries', val: take, log: 1 }),
      P('tod', 'Turnover Differential', { tip: 'Takeaways - turnovers', val: function (a) { return take(a) - give(a); }, log: 1 }),
      P('dtd', 'Defensive TD', { val: function (a) { return a.dtd; } }),
      P('saf', 'Safeties', { val: function (a) { return a.saf; } }),
      R('depap', 'EPA / Play Allowed', 'd3', { val: function (a) { return div(a.apepa + a.arepa, aplays(a)); }, better: 'low' })
    ] },
    { id: 'st', label: 'Special Teams', main: 'fgp', stats: [
      P('fgm', 'FG Made', { val: function (a) { return a.fgm; }, log: 1 }),
      P('fga', 'FG Attempted', { val: function (a) { return a.fga; } }),
      R('fgp', 'FG %', 'pct', { val: function (a) { return div(a.fgm, a.fga); }, log: 1 }),
      P('fg50', 'FG Made, 50+ yds', { val: function (a) { return a.fg50; } }),
      R('xpp', 'XP %', 'pct', { val: function (a) { return div(a.xpm, a.xpa); } }),
      P('pnt', 'Punts', { val: function (a) { return a.pnt; }, lead: false }),
      R('pavg', 'Gross Punt Average', 'd1', { val: function (a) { return div(a.pntyd, a.pnt); }, log: 1 }),
      R('pnet', 'Net Punt Average', 'd1', { val: function (a) { return div(a.pntnet, a.pnt); } }),
      R('pravg', 'Punt Return Average', 'd1', { val: function (a) { return div(a.pryd, a.pr); } }),
      R('kravg', 'Kick Return Average', 'd1', { val: function (a) { return div(a.kryd, a.kr); } }),
      P('sttd', 'Special Teams TD', { val: function (a) { return a.sttd; } })
    ] },
    { id: 'pen', label: 'Penalties', main: 'peny', stats: [
      P('pen', 'Penalties', { val: function (a) { return a.pen; }, better: 'low', log: 1 }),
      P('peny', 'Penalty Yards', { val: function (a) { return a.peny; }, better: 'low', log: 1 })
    ] }
  ];
  var DEFS = {};
  CATS.forEach(function (c) { c.stats.forEach(function (d) { d.cat = c.id; DEFS[d.id] = d; }); });
  function autoCats() { return new Set(['rec', 'post', 'off', 'def']); }

  function seasonHonors(t, season) {
    var p = post.has(t) && post.get(t).get(season);
    if (!p) return [];
    if (p[2] === 2) return ['Won Super Bowl'];
    if (p[2] === 1) return ['Lost Super Bowl'];
    return ['Playoffs ' + p[0] + '–' + p[1]];
  }

  root.TCore = {
    years: [Y0, Y1], teams: teams, CATS: CATS, DEFS: DEFS, aggregate: aggregate, autoCats: autoCats, seasonHonors: seasonHonors,
    byAbbr: new Map(teams.map(function (t, i) { return [t[0], i]; }))
  };
})(typeof window !== 'undefined' ? window : globalThis);
