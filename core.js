/* Core stat logic for NFL Player Compare. No DOM access: testable in node. */
(function (root) {
  'use strict';
  var D = root.NFL;
  var F = D.fields, OFF = 5, FI = {};
  F.forEach(function (k, i) { FI[k] = i + OFF; });
  var MAXK = { fgl: 1, pntl: 1 };
  var players = D.players; // [id, name, pos, group, firstSeason, lastSeason, lastTeam, startedBefore1999]

  var byPlayer = new Map();
  var Y0 = 9999, Y1 = 0;
  D.rows.forEach(function (r) {
    var a = byPlayer.get(r[0]);
    if (!a) { a = []; byPlayer.set(r[0], a); }
    a.push(r);
    if (r[1] < Y0) Y0 = r[1];
    if (r[1] > Y1) Y1 = r[1];
  });

  var idx = players.map(function (p, i) {
    var toks = p[1].toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
    var g = 0;
    (byPlayer.get(i) || []).forEach(function (r) { if (r[2] === 0) g += r[4]; });
    return { i: i, flat: toks.join(''), toks: toks, g: g };
  });
  var byId = new Map(players.map(function (p, i) { return [p[0], i]; }));

  function search(q, grp, lim) {
    var qt = String(q).toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
    if (!qt.length) return [];
    var qf = qt.join('');
    var out = [];
    for (var n = 0; n < idx.length; n++) {
      var e = idx[n];
      if (grp && grp !== 'ALL' && players[e.i][3] !== grp) continue;
      var sc = -1;
      if (e.flat === qf) sc = 0;
      else if (e.flat.indexOf(qf) === 0) sc = 1;
      else if (e.toks.length && e.toks[e.toks.length - 1].indexOf(qf) === 0) sc = 2;
      else if (qt.every(function (t) { return e.toks.some(function (w) { return w.indexOf(t) === 0; }); })) sc = 3;
      else if (e.flat.indexOf(qf) >= 0) sc = 4;
      if (sc < 0) continue;
      out.push([sc, e.g, e.i]);
    }
    out.sort(function (a, b) { return a[0] - b[0] || b[1] - a[1]; });
    return out.slice(0, lim || 10).map(function (x) { return x[2]; });
  }

  function findByName(name, group) {
    var best = -1, bg = -1;
    idx.forEach(function (e) {
      var p = players[e.i];
      if (p[1] === name && (!group || p[3] === group) && e.g > bg) { best = e.i; bg = e.g; }
    });
    return best;
  }

  // ---------- aggregation ----------
  function blank() {
    var o = { g: 0, teams: [], season: 0, n: 0, qw: 0, ql: 0, qt: 0 };
    F.forEach(function (k) { o[k] = 0; });
    return o;
  }
  function addTeams(o, str) {
    str.split('/').forEach(function (t) { if (t && o.teams.indexOf(t) < 0) o.teams.push(t); });
  }
  function addRow(s, r) {
    s.g += r[4];
    F.forEach(function (k) {
      var v = r[FI[k]];
      if (MAXK[k]) { if (v > s[k]) s[k] = v; } else s[k] += v;
    });
    addTeams(s, r[3]);
  }
  function merge(t, s) {
    t.g += s.g; t.qw += s.qw; t.ql += s.ql; t.qt += s.qt;
    F.forEach(function (k) {
      if (MAXK[k]) { if (s[k] > t[k]) t[k] = s[k]; } else t[k] += s[k];
    });
    s.teams.forEach(function (x) { if (t.teams.indexOf(x) < 0) t.teams.push(x); });
  }
  // o: {st:'REG'|'POST'|'ALL', from, to}
  function aggregate(p, o) {
    var rows = byPlayer.get(p) || [];
    var bySeason = new Map();
    rows.forEach(function (r) {
      if (r[1] < o.from || r[1] > o.to) return;
      if (o.st === 'REG' && r[2] !== 0) return;
      if (o.st === 'POST' && r[2] !== 1) return;
      var s = bySeason.get(r[1]);
      if (!s) { s = blank(); s.season = r[1]; bySeason.set(r[1], s); }
      addRow(s, r);
    });
    // QB starter record (starting QB per game, nflverse schedules)
    ((root.NFL_X && root.NFL_X.rec && root.NFL_X.rec[p]) || []).forEach(function (x) {
      if (x[0] < o.from || x[0] > o.to) return;
      if (o.st === 'REG' && x[1] !== 0) return;
      if (o.st === 'POST' && x[1] !== 1) return;
      var s = bySeason.get(x[0]);
      if (!s) return;
      s.qw += x[2]; s.ql += x[3]; s.qt += x[4];
    });
    var seasons = Array.from(bySeason.values()).sort(function (a, b) { return a.season - b.season; });
    var tot = blank();
    seasons.forEach(function (s) { merge(tot, s); });
    tot.n = seasons.length;
    return { tot: tot, seasons: seasons };
  }

  // ---------- stat definitions ----------
  function div(a, b) { return b > 0 ? a / b : null; }
  function clamp(x) { return Math.max(0, Math.min(2.375, x)); }
  function rating(a) {
    if (a.att <= 0) return null;
    var A = clamp((a.cmp / a.att - 0.3) * 5);
    var B = clamp((a.pyd / a.att - 3) * 0.25);
    var C = clamp(a.ptd / a.att * 20);
    var Dd = clamp(2.375 - a.int / a.att * 25);
    return (A + B + C + Dd) / 6 * 100;
  }
  function P(id, label, o) { return Object.assign({ id: id, label: label, kind: 'sum', fmt: 'int', lead: true, better: 'high' }, o); }
  function R(id, label, fmt, o) { return P(id, label, Object.assign({ kind: 'rate', fmt: fmt }, o)); }

  function qbn(a) { return a.qw + a.ql + a.qt; }
  var CATS = [
    { id: 'pass', label: 'Passing', main: 'pyd', gate: function (a) { return a.att >= 20; }, stats: [
      P('cmp', 'Completions', { val: function (a) { return a.cmp; }, log: 1 }),
      P('att', 'Attempts', { val: function (a) { return a.att; }, log: 1 }),
      R('cmpp', 'Completion %', 'pct', { val: function (a) { return div(a.cmp, a.att); }, den: function (a) { return a.att; }, min: 50, log: 1 }),
      P('pyd', 'Passing Yards', { val: function (a) { return a.pyd; }, log: 1 }),
      P('ptd', 'Passing TD', { val: function (a) { return a.ptd; }, log: 1 }),
      P('int', 'Interceptions', { val: function (a) { return a.int; }, lead: false, log: 1 }),
      R('tdp', 'TD %', 'pct', { val: function (a) { return div(a.ptd, a.att); }, den: function (a) { return a.att; }, min: 50 }),
      R('intp', 'INT %', 'pct', { val: function (a) { return div(a.int, a.att); }, den: function (a) { return a.att; }, min: 50, better: 'low' }),
      R('ya', 'Yards / Attempt', 'd1', { val: function (a) { return div(a.pyd, a.att); }, den: function (a) { return a.att; }, min: 50, log: 1 }),
      R('nya', 'Net Yards / Attempt', 'd2', { tip: '(Passing yards - sack yards) / (attempts + sacks)', val: function (a) { return div(a.pyd - a.sckyd, a.att + a.sck); }, den: function (a) { return a.att + a.sck; }, min: 50 }),
      R('anya', 'Adj. Net Yards / Attempt', 'd2', { tip: '(Passing yards + 20 x TD - 45 x INT - sack yards) / (attempts + sacks)', val: function (a) { return div(a.pyd + 20 * a.ptd - 45 * a.int - a.sckyd, a.att + a.sck); }, den: function (a) { return a.att + a.sck; }, min: 50 }),
      R('rate', 'Passer Rating', 'd1', { tip: 'NFL passer rating formula, computed from the totals shown', val: rating, den: function (a) { return a.att; }, min: 50, log: 1 }),
      P('sck', 'Sacks Taken', { val: function (a) { return a.sck; }, lead: false }),
      R('sckr', 'Sack %', 'pct', { tip: 'Sacks / (attempts + sacks)', val: function (a) { return div(a.sck, a.att + a.sck); }, den: function (a) { return a.att + a.sck; }, min: 50, better: 'low' }),
      P('pfd', 'Passing 1st Downs', { val: function (a) { return a.pfd; } }),
      P('pepa', 'Passing EPA', { fmt: 'd1', tip: 'Expected points added on pass plays (nflverse)', val: function (a) { return a.pepa; } }),
      R('pepad', 'EPA / Dropback', 'd2', { tip: 'Passing EPA / (attempts + sacks)', val: function (a) { return div(a.pepa, a.att + a.sck); }, den: function (a) { return a.att + a.sck; }, min: 50 }),
      R('qbs', 'QB Starts', 'int', { tip: 'Games started at quarterback (nflverse schedules). Quarterbacks only.', val: function (a) { return qbn(a) > 0 ? qbn(a) : null; } }),
      R('qbw', 'QB Wins', 'int', { tip: 'Team wins in games he started at quarterback. Quarterbacks only.', log: 1, val: function (a) { return qbn(a) > 0 ? a.qw : null; } }),
      R('qbl', 'QB Losses', 'int', { tip: 'Team losses in games he started at quarterback. Quarterbacks only.', better: 'low', lead: false, log: 1, val: function (a) { return qbn(a) > 0 ? a.ql : null; } }),
      R('qbwp', 'QB Win %', 'pct', { tip: 'Wins (ties count half) / starts. Quarterbacks only.', val: function (a) { return qbn(a) > 0 ? (a.qw + a.qt / 2) / qbn(a) : null; }, den: qbn, min: 10 })
    ] },
    { id: 'rush', label: 'Rushing', main: 'ryd', gate: function (a) { return a.car >= 20; }, stats: [
      P('car', 'Carries', { val: function (a) { return a.car; }, log: 1 }),
      P('ryd', 'Rushing Yards', { val: function (a) { return a.ryd; }, log: 1 }),
      P('rtd', 'Rushing TD', { val: function (a) { return a.rtd; }, log: 1 }),
      R('ypc', 'Yards / Carry', 'd1', { val: function (a) { return div(a.ryd, a.car); }, den: function (a) { return a.car; }, min: 50, log: 1 }),
      P('rfd', 'Rushing 1st Downs', { val: function (a) { return a.rfd; } }),
      P('repa', 'Rushing EPA', { fmt: 'd1', tip: 'Expected points added on rushing plays (nflverse)', val: function (a) { return a.repa; } }),
      R('repac', 'EPA / Carry', 'd2', { val: function (a) { return div(a.repa, a.car); }, den: function (a) { return a.car; }, min: 50 })
    ] },
    { id: 'recv', label: 'Receiving', main: 'cyd', gate: function (a) { return a.tgt >= 20; }, stats: [
      P('tgt', 'Targets', { val: function (a) { return a.tgt; }, log: 1 }),
      P('rec', 'Receptions', { val: function (a) { return a.rec; }, log: 1 }),
      P('cyd', 'Receiving Yards', { val: function (a) { return a.cyd; }, log: 1 }),
      P('ctd', 'Receiving TD', { val: function (a) { return a.ctd; }, log: 1 }),
      R('catchp', 'Catch %', 'pct', { val: function (a) { return div(a.rec, a.tgt); }, den: function (a) { return a.tgt; }, min: 25 }),
      R('ypr', 'Yards / Reception', 'd1', { val: function (a) { return div(a.cyd, a.rec); }, den: function (a) { return a.rec; }, min: 25, log: 1 }),
      R('ypt', 'Yards / Target', 'd1', { val: function (a) { return div(a.cyd, a.tgt); }, den: function (a) { return a.tgt; }, min: 25 }),
      P('cfd', 'Receiving 1st Downs', { val: function (a) { return a.cfd; } }),
      P('yac', 'Yards After Catch', { val: function (a) { return a.yac; } }),
      P('air', 'Air Yards', { tip: 'Yards the ball traveled in the air on targets', val: function (a) { return a.air; } }),
      P('cepa', 'Receiving EPA', { fmt: 'd1', tip: 'Expected points added on targets (nflverse)', val: function (a) { return a.cepa; } }),
      R('cepat', 'EPA / Target', 'd2', { val: function (a) { return div(a.cepa, a.tgt); }, den: function (a) { return a.tgt; }, min: 25 })
    ] },
    { id: 'scrim', label: 'Scrimmage (rush + receive)', main: 'scrim', gate: function (a) { return a.car + a.rec >= 40; }, stats: [
      P('touch', 'Touches', { tip: 'Carries + receptions', val: function (a) { return a.car + a.rec; }, log: 1 }),
      P('scrim', 'Scrimmage Yards', { val: function (a) { return a.ryd + a.cyd; }, log: 1 }),
      R('yptouch', 'Yards / Touch', 'd1', { val: function (a) { return div(a.ryd + a.cyd, a.car + a.rec); }, den: function (a) { return a.car + a.rec; }, min: 50, log: 1 }),
      P('stdd', 'Total TD', { tip: 'Rushing + receiving TD', val: function (a) { return a.rtd + a.ctd; }, log: 1 }),
      P('sfd', 'Scrimmage 1st Downs', { val: function (a) { return a.rfd + a.cfd; } })
    ] },
    { id: 'def', label: 'Defense', main: 'tkl', gate: function (a) { return a.tks + a.tka >= 10 || a.dsk >= 2 || a.dint >= 1; }, stats: [
      P('tkl', 'Total Tackles', { tip: 'Solo + assisted', val: function (a) { return a.tks + a.tka; }, log: 1 }),
      P('tks', 'Solo Tackles', { val: function (a) { return a.tks; } }),
      P('tka', 'Assisted Tackles', { val: function (a) { return a.tka; } }),
      P('tfl', 'Tackles for Loss', { val: function (a) { return a.tfl; }, log: 1 }),
      P('dsk', 'Sacks', { fmt: 'half', val: function (a) { return a.dsk; }, log: 1 }),
      P('qbh', 'QB Hits', { val: function (a) { return a.qbh; } }),
      P('dint', 'Interceptions', { val: function (a) { return a.dint; }, log: 1 }),
      P('dintyd', 'INT Return Yards', { val: function (a) { return a.dintyd; } }),
      P('pd', 'Passes Defended', { val: function (a) { return a.pd; }, log: 1 }),
      P('ff', 'Forced Fumbles', { val: function (a) { return a.ff; }, log: 1 }),
      P('fr', 'Fumble Recoveries', { val: function (a) { return a.fr; } }),
      P('dtd', 'Defensive TD', { val: function (a) { return a.dtd; } }),
      P('saf', 'Safeties', { val: function (a) { return a.saf; } })
    ] },
    { id: 'kick', label: 'Kicking', main: 'fgm', gate: function (a) { return a.fga + a.xpa >= 10; }, stats: [
      P('fgm', 'FG Made', { val: function (a) { return a.fgm; }, log: 1 }),
      P('fga', 'FG Attempted', { val: function (a) { return a.fga; }, log: 1 }),
      R('fgp', 'FG %', 'pct', { val: function (a) { return div(a.fgm, a.fga); }, den: function (a) { return a.fga; }, min: 20, log: 1 }),
      P('fg50', 'FG Made, 50+ yds', { val: function (a) { return a.fg50; } }),
      P('fgl', 'Longest FG', { kind: 'max', val: function (a) { return a.fgl; }, log: 1 }),
      P('xpm', 'XP Made', { val: function (a) { return a.xpm; }, log: 1 }),
      P('xpa', 'XP Attempted', { val: function (a) { return a.xpa; } }),
      R('xpp', 'XP %', 'pct', { val: function (a) { return div(a.xpm, a.xpa); }, den: function (a) { return a.xpa; }, min: 20 }),
      P('kpts', 'Kicking Points', { tip: '3 x FG made + XP made', val: function (a) { return 3 * a.fgm + a.xpm; }, log: 1 })
    ] },
    { id: 'punt', label: 'Punting', main: 'pnt', gate: function (a) { return a.pnt >= 10; }, stats: [
      P('pnt', 'Punts', { val: function (a) { return a.pnt; }, log: 1 }),
      P('pntyd', 'Punt Yards', { val: function (a) { return a.pntyd; }, log: 1 }),
      R('pavg', 'Gross Average', 'd1', { val: function (a) { return div(a.pntyd, a.pnt); }, den: function (a) { return a.pnt; }, min: 20, log: 1 }),
      P('pnt20', 'Punts Inside 20', { val: function (a) { return a.pnt20; }, log: 1 }),
      R('p20p', 'Inside 20 %', 'pct', { val: function (a) { return div(a.pnt20, a.pnt); }, den: function (a) { return a.pnt; }, min: 20 }),
      P('pnttb', 'Touchbacks', { val: function (a) { return a.pnttb; }, lead: false }),
      P('pntl', 'Longest Punt', { kind: 'max', val: function (a) { return a.pntl; } })
    ] },
    { id: 'ret', label: 'Returns', main: 'pryd', gate: function (a) { return a.pr + a.kr >= 10; }, stats: [
      P('pr', 'Punt Returns', { val: function (a) { return a.pr; }, log: 1 }),
      P('pryd', 'Punt Return Yards', { val: function (a) { return a.pryd; }, log: 1 }),
      R('pravg', 'Punt Return Average', 'd1', { val: function (a) { return div(a.pryd, a.pr); }, den: function (a) { return a.pr; }, min: 10 }),
      P('kr', 'Kick Returns', { val: function (a) { return a.kr; }, log: 1 }),
      P('kryd', 'Kick Return Yards', { val: function (a) { return a.kryd; }, log: 1 }),
      R('kravg', 'Kick Return Average', 'd1', { val: function (a) { return div(a.kryd, a.kr); }, den: function (a) { return a.kr; }, min: 10 }),
      P('sttd', 'Special Teams TD', { val: function (a) { return a.sttd; } })
    ] },
    { id: 'fant', label: 'Fantasy', main: 'fpp', gate: function (a) { return a.fp > 0; }, stats: [
      P('fp', 'Fantasy Points (Standard)', { fmt: 'd1', tip: 'nflverse standard scoring', val: function (a) { return a.fp; }, log: 1 }),
      P('fpp', 'Fantasy Points (PPR)', { fmt: 'd1', tip: 'nflverse standard scoring plus 1 per reception', val: function (a) { return a.fpp; }, log: 1 }),
      P('fuml', 'Fumbles Lost', { val: function (a) { return a.fuml; }, lead: false })
    ] }
  ];
  var DEFS = {};
  CATS.forEach(function (c) { c.stats.forEach(function (d) { d.cat = c.id; DEFS[d.id] = d; }); });

  // groups (optional, parallel to tots): defense stats only count for defensive players,
  // so a kicker's kickoff tackles don't switch the Defense group on.
  function autoCats(tots, groups) {
    var on = new Set();
    CATS.forEach(function (c) {
      if (c.id === 'scrim' || c.id === 'fant') return;
      if (tots.some(function (a, i) { return c.gate(a) && (c.id !== 'def' || !groups || groups[i] === 'DEF'); })) on.add(c.id);
    });
    if (on.has('rush') && on.has('recv')) on.add('scrim');
    if (on.has('pass') || on.has('rush') || on.has('recv')) on.add('fant');
    return on;
  }

  // v: number|null, small: below the minimum sample for a rate stat
  function value(d, a, pg, isSeason) {
    var v = d.val(a);
    if (v == null || !isFinite(v)) return { v: null, small: false };
    var small = false;
    if (d.den) {
      var min = isSeason ? Math.max(1, Math.ceil(d.min / 3)) : d.min;
      small = d.den(a) < min;
    }
    if (pg && d.kind === 'sum') v = a.g > 0 ? v / a.g : null;
    if (v == null) return { v: null, small: false };
    return { v: v, small: small };
  }

  function num(v, dp) {
    var s = v.toLocaleString('en-US', { minimumFractionDigits: dp, maximumFractionDigits: dp });
    return s.replace('-', '−');
  }
  function fmt(d, v, pg) {
    if (v == null) return '–';
    var k = (pg && d.kind === 'sum') ? 'pg' : d.fmt;
    switch (k) {
      case 'int': return num(Math.round(v), 0);
      case 'half': return num(v, Math.abs(v - Math.round(v)) < 1e-9 ? 0 : 1);
      case 'd1': return num(v, 1);
      case 'd2': return num(v, 2);
      case 'd3': return num(v, 3);
      case 'pct': return num(v * 100, 1) + '%';
      case 'pg': return num(v, Math.abs(v) >= 10 ? 1 : 2);
      default: return String(v);
    }
  }

  // indexes of the winning cells in a row of {v, small}
  function leaders(d, cells) {
    if (!d.lead) return [];
    var ok = [];
    cells.forEach(function (c, i) { if (c.v != null && !c.small) ok.push({ v: c.v, i: i }); });
    if (ok.length < 2) return [];
    var vals = ok.map(function (x) { return x.v; });
    var best = d.better === 'low' ? Math.min.apply(null, vals) : Math.max.apply(null, vals);
    var win = ok.filter(function (x) { return Math.abs(x.v - best) < 1e-9; });
    if (win.length === ok.length) return [];
    return win.map(function (x) { return x.i; });
  }


  // ---------- honors: awards, Super Bowls, Pro Bowls, profile links ----------
  var X = root.NFL_X || { awards: [], aw: {}, sb: {}, hon: {}, bio: {} };
  var awardList = X.awards.map(function (a) { return { id: a[0], label: a[1], short: a[2] }; });
  var AWSHORT = {};
  awardList.forEach(function (a) { AWSHORT[a.id] = a.short; });
  function honors(p) {
    var aw = {};
    (X.aw[p] || []).forEach(function (x) { (aw[x[1]] = aw[x[1]] || []).push(x[0]); });
    var sb = X.sb[p] || [];
    var hn = X.hon[p], bi = X.bio[p];
    return {
      aw: aw,
      sbw: sb.filter(function (x) { return x[1]; }).map(function (x) { return x[0]; }),
      sba: sb.map(function (x) { return x[0]; }),
      pb: hn ? hn[0] : null, ap: hn ? hn[1] : null, hof: hn ? !!hn[2] : null,
      bio: bi ? { espn: bi[0], pfr: bi[1], college: bi[2], dyear: bi[3], dround: bi[4], dpick: bi[5], dteam: bi[6], height: bi[7], weight: bi[8] } : null
    };
  }
  function seasonHonors(p, season) {
    var out = [];
    (X.aw[p] || []).forEach(function (x) { if (x[0] === season) out.push(AWSHORT[x[1]] || x[1]); });
    (X.sb[p] || []).forEach(function (x) { if (x[0] === season) out.push(x[1] ? 'SB win' : 'SB loss'); });
    return out;
  }
  var HONOR_ROWS = [
    { id: 'sbw', label: 'Super Bowl wins', kind: 'years', tip: 'Won the Super Bowl and recorded a stat in the game (1999 onward)' },
    { id: 'sba', label: 'Super Bowl appearances', kind: 'years', tip: 'Recorded a stat in a Super Bowl (1999 onward)' }
  ];
  awardList.forEach(function (a) { HONOR_ROWS.push({ id: a.id, label: a.label, kind: 'years', tip: 'Seasons won, 1999 onward' }); });
  HONOR_ROWS.push({ id: 'pb', label: 'Pro Bowls', kind: 'num', tip: 'Selections over the whole career. Drafted players only; undrafted players show a dash.' });
  HONOR_ROWS.push({ id: 'ap', label: 'First-team All-Pro', kind: 'num', tip: 'AP first-team selections over the whole career. Drafted players only.' });
  HONOR_ROWS.push({ id: 'hof', label: 'Pro Football Hall of Fame', kind: 'flag', tip: 'Inducted. Drafted players only.' });
  function honorCell(row, hn) {
    if (row.kind === 'years') {
      var ys = row.id === 'sbw' ? hn.sbw : row.id === 'sba' ? hn.sba : (hn.aw[row.id] || []);
      return { v: ys.length, years: ys };
    }
    if (row.kind === 'num') return { v: row.id === 'pb' ? hn.pb : hn.ap, years: null };
    return { v: hn.hof == null ? null : (hn.hof ? 1 : 0), years: null };
  }

  root.Core = {
    years: [Y0, Y1], players: players, meta: D.meta, byId: byId,
    search: search, findByName: findByName, aggregate: aggregate,
    CATS: CATS, DEFS: DEFS, honors: honors, seasonHonors: seasonHonors, honorRows: HONOR_ROWS, honorCell: honorCell, awardList: awardList, autoCats: autoCats, value: value, fmt: fmt, leaders: leaders, rating: rating
  };
})(typeof window !== 'undefined' ? window : globalThis);
