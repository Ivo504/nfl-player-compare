/* Luna: a voice assistant that answers NFL questions from the site's own data, entirely in the browser.
   Depends on window.Core (core.js), window.TCore (teamcore.js, optional), window.NFL_X, window.NFL_T,
   and window.NFLApp (app.js) to load comparisons into the page. */
(function () {
  'use strict';
  var C = window.Core, T = window.TCore, X = window.NFL_X || { aw: {}, awards: [] }, TD = window.NFL_T || { post: {} };
  if (!C) return;
  var Y0 = C.years[0], Y1 = C.years[1];
  var TY0 = T ? T.years[0] : Y0;
  var KEY = 'nflcompare.luna';

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
  function pick(a) { return a[Math.floor(Math.random() * a.length)]; }
  function esc(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

  // ---------------------------------------------------------------- name indexes
  function norm(s) {
    return s.toLowerCase().replace(/[.'’]/g, '').replace(/[^a-z0-9]+/g, ' ')
      .replace(/\b(jr|sr|ii|iii|iv)\b/g, ' ').replace(/\s+/g, ' ').trim();
  }
  var STOP = new Set(('the a an and or of in on at to for by with from since between during who whom which what when how many much most least ' +
    'fewest highest lowest best worst top leader leaders leading led lead leads ever all time alltime career season seasons year years ' +
    'did does do has have had is was were be been are this last next current yet his her their team teams nfl league player players stats stat ' +
    'number total totals record records game games week weeks playoffs playoff postseason regular super bowl bowls won win wins winner losses ' +
    'compare versus vs against better than more less show me tell about give per average yards yard touchdowns touchdown passing rushing receiving ' +
    'sacks sack tackles interceptions points point catches receptions field goals goal punts rating quarterback quarterbacks receiver receivers running ' +
    'back backs tight end ends kicker kickers punter defense defensive offense offensive rookie mvp year history single one rings ring title titles ' +
    'chiefs patriots bills dolphins jets ravens bengals browns steelers texans colts jaguars titans broncos chargers raiders cowboys giants eagles ' +
    'commanders bears lions packers vikings falcons panthers saints buccaneers cardinals rams 49ers seahawks young love green rice hill moss white ' +
    'brown king long price wood black rose stone gray bell cook hunt fox ray lane grant ward fields ford hall west park banks free early sharp page mack ' +
    'will can may say rich dear hope joy star fame jet ram bills jets colts titans').split(' '));
  // well-known nicknames
  var NICK = { gronk: 'Rob Gronkowski', megatron: 'Calvin Johnson', cmc: 'Christian McCaffrey', 'beast mode': 'Marshawn Lynch', 'big ben': 'Ben Roethlisberger',
    'tb12': 'Tom Brady', 'a rod': 'Aaron Rodgers', arod: 'Aaron Rodgers', 'mahomie': 'Patrick Mahomes', 'ochocinco': 'Chad Johnson', 'deebo': 'Deebo Samuel', 'adp': 'Adrian Peterson', 'ad': 'Adrian Peterson' };

  var IDX = null;
  function index() {
    if (IDX) return IDX;
    var g = new Float64Array(C.players.length);
    window.NFL.rows.forEach(function (r) { if (r[2] === 0) g[r[0]] += r[4]; });
    var prom = C.players.map(function (pl, i) {
      var hn = (X.hon && X.hon[i]) || [0, 0, 0];
      return g[i] + 25 * (hn[0] || 0) + 50 * (hn[1] || 0) + 40 * ((X.aw[i] || []).length);
    });
    var full = new Map(), last = new Map();
    C.players.forEach(function (pl, i) {
      var n = norm(pl[1]);
      (full.get(n) || full.set(n, []).get(n)).push(i);
      var w = n.split(' '), ln = w[w.length - 1];
      if (w.length > 1 && ln.length >= 3 && !STOP.has(ln)) (last.get(ln) || last.set(ln, []).get(ln)).push(i);
    });
    var teamAlias = [];
    if (T) {
      var cities = {};
      T.teams.forEach(function (tm) { var c = norm(tm[1].split(' ').slice(0, -1).join(' ')); cities[c] = (cities[c] || 0) + 1; });
      T.teams.forEach(function (tm, i) {
        var w = norm(tm[1]).split(' '), nick = w[w.length - 1], city = w.slice(0, -1).join(' ');
        teamAlias.push([nick, i]);
        if (cities[city] === 1) teamAlias.push([city, i]);
      });
      [['niners', 'SF'], ['redskins', 'WAS'], ['washington football team', 'WAS'], ['football team', 'WAS'], ['oakland', 'LV'], ['san diego', 'LAC'], ['st louis', 'LA'],
        ['bucs', 'TB'], ['pats', 'NE'], ['jags', 'JAX'], ['philly', 'PHI'], ['la rams', 'LA'], ['la chargers', 'LAC'], ['ny giants', 'NYG'], ['ny jets', 'NYJ'], ['new york giants', 'NYG'], ['new york jets', 'NYJ'],
        ['los angeles rams', 'LA'], ['los angeles chargers', 'LAC'], ['bolts', 'LAC'], ['hawks', 'SEA'], ['fins', 'MIA'], ['pack', 'GB'], ['cards', 'ARI'], ['birds', 'PHI']]
        .forEach(function (a) { if (T.byAbbr.has(a[1])) teamAlias.push([a[0], T.byAbbr.get(a[1])]); });
      teamAlias.sort(function (a, b) { return b[0].length - a[0].length; });
    }
    IDX = { prom: prom, full: full, last: last, teamAlias: teamAlias, games: g };
    return IDX;
  }
  function best(ids, grp) {
    var I = index();
    var pool = grp ? ids.filter(function (i) { return C.players[i][3] === grp; }) : ids;
    if (!pool.length) pool = ids;
    return pool.slice().sort(function (a, b) { return I.prom[b] - I.prom[a]; })[0];
  }

  // finds teams then players; returns { teams:[idx], players:[idx], rest:text without them }
  function findEntities(t, rawQ, grp) {
    var I = index(), teams = [], players = [];
    var s = ' ' + t + ' ';
    I.teamAlias.forEach(function (a) {
      var re = new RegExp(' ' + esc(a[0]) + ' ');
      while (re.test(s)) { if (teams.indexOf(a[1]) < 0) teams.push({ i: a[1], at: s.search(re) }); s = s.replace(re, ' # '); }
    });
    if (T) (rawQ.match(/\b[A-Z]{2,3}\b/g) || []).forEach(function (ab) {
      if (T.byAbbr.has(ab) && ['AD', 'TE', 'QB', 'RB', 'WR', 'MVP', 'TD', 'INT', 'NFL', 'FG', 'PPR'].indexOf(ab) < 0) teams.push({ i: T.byAbbr.get(ab), at: rawQ.indexOf(ab) });
    });
    Object.keys(NICK).forEach(function (k) {
      var re = new RegExp(' ' + esc(k) + ' ');
      if (re.test(s)) { var ids = I.full.get(norm(NICK[k])); if (ids) players.push({ i: best(ids, grp), at: s.search(re) }); s = s.replace(re, ' # '); }
    });
    var w = s.trim().split(' ');
    for (var i = 0; i < w.length; i++) {
      var hit = false;
      for (var n = 4; n >= 2 && !hit; n--) {
        if (i + n > w.length) continue;
        var key = w.slice(i, i + n).join(' ');
        if (I.full.has(key)) { players.push({ i: best(I.full.get(key), grp), at: i }); for (var k = i; k < i + n; k++) w[k] = '#'; i += n - 1; hit = true; }
      }
      if (!hit && I.last.has(w[i])) { players.push({ i: best(I.last.get(w[i]), grp), at: i, cands: I.last.get(w[i]) }); w[i] = '#'; }
    }
    function uniq(a) { var seen = new Set(); return a.sort(function (x, y) { return x.at - y.at; }).map(function (x) { return x.i; }).filter(function (x) { if (seen.has(x)) return false; seen.add(x); return true; }); }
    // "Allen vs Mahomes": a bare last name takes the position of the other player named
    var sure = players.filter(function (x) { return !x.cands || x.cands.length === 1; });
    if (!grp && sure.length) {
      var g0 = C.players[sure[0].i][3];
      players.forEach(function (x) { if (x.cands) x.i = best(x.cands, g0); });
    }
    return { teams: uniq(teams), players: uniq(players), rest: w.join(' ') };
  }

  // ---------------------------------------------------------------- years and season type
  var WORDNUM = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10 };
  function romanToInt(r) {
    var v = { i: 1, v: 5, x: 10, l: 50, c: 100 }, n = 0;
    for (var i = 0; i < r.length; i++) { var a = v[r[i]], b = v[r[i + 1]] || 0; n += a < b ? -a : a; }
    return n;
  }
  function parseYears(t) {
    var y = null, m, cur = Y1;
    function clamp(a, b) { return { from: Math.max(Y0, a), to: Math.min(Y1, b) }; }
    if ((m = t.match(/super ?bowl (\d{2})\b/)) || (m = t.match(/super ?bowl ([ivxlc]{2,7})\b/))) {
      var n = /\d/.test(m[1]) ? +m[1] : romanToInt(m[1]);
      if (n >= 30 && n <= 70) return { from: n + 1965, to: n + 1965, single: true, sbn: n, label: 'the ' + (n + 1965) + ' season' };
    }
    if ((m = t.match(/\b(?:from|between) (\d{4}) (?:to|and|through|until|-) (\d{4})\b/)) || (m = t.match(/\b(\d{4}) ?(?:-|to|through) ?(\d{4})\b/)))
      y = clamp(+m[1], +m[2]);
    else if ((m = t.match(/\b(?:since|after) (\d{4})\b/))) y = clamp(+m[1], cur);
    else if ((m = t.match(/\b(?:before|until|through) (\d{4})\b/))) y = clamp(Y0, +m[1]);
    else if ((m = t.match(/\b(?:the )?(\d{2})(\d{2})s\b/)) && +m[2] % 10 === 0) y = clamp(+(m[1] + m[2]), +(m[1] + m[2]) + 9);
    else if ((m = t.match(/\b(?:last|past) (\d+|one|two|three|four|five|six|seven|eight|nine|ten) (?:seasons|years)\b/))) { var k = WORDNUM[m[1]] || +m[1]; y = clamp(cur - k, cur - 1); }
    else if (/\b(this|current) (season|year)\b|\bthis year\b|\bso far\b|\bright now\b|\bcurrently\b/.test(t)) y = { from: cur, to: cur };
    else if (/\blast (season|year)\b/.test(t)) y = { from: cur - 1, to: cur - 1 };
    else if ((m = t.match(/\b(19\d{2}|20\d{2})\b/))) y = { from: +m[1], to: +m[1] };
    if (!y) return null;
    if (y.from > y.to) return { bad: true };
    y.single = y.from === y.to;
    y.label = y.single ? 'in ' + y.from : y.to === Y1 && y.from !== Y0 ? 'since ' + y.from : 'from ' + y.from + ' to ' + y.to;
    return y;
  }
  function stripYears(t) {
    return t.replace(/\s+/g, ' ').replace(/super ?bowl (\d{2}|[ivxlc]{2,7})\b/g, 'super bowl').replace(/\b(19|20)\d{2}s?\b/g, ' ').replace(/\b(this|current|last|past) (season|year|\d+ seasons|\d+ years)\b/g, ' ').replace(/\s+/g, ' ').trim();
  }

  // ---------------------------------------------------------------- stat vocab
  var PSTAT = [
    [/passing (yards|yds)|pass yards|throwing yards|yards passing|threw for/, 'pyd'],
    [/(passing|pass) (touchdowns|tds|td)|touchdown passes|td passes|threw (the most )?(touchdowns|tds)/, 'ptd'],
    [/interceptions thrown|picks thrown|threw (the most )?(interceptions|picks)/, 'int'],
    [/completion (percentage|pct|%|rate)/, 'cmpp'], [/completions/, 'cmp'], [/pass(ing)? attempts/, 'att'],
    [/passer rating|qb rating|quarterback rating/, 'rate'], [/yards per (pass )?attempt/, 'ya'],
    [/yards per carry|ypc|yards per rush/, 'ypc'], [/yards per (catch|reception)/, 'ypr'],
    [/rushing (yards|yds)|rush yards|yards rushing|ran for/, 'ryd'], [/rushing (touchdowns|tds|td)|rush tds|rushing scores/, 'rtd'],
    [/carries|rushing attempts|rush attempts/, 'car'],
    [/receiving (yards|yds)|yards receiving/, 'cyd'], [/receiving (touchdowns|tds|td)|touchdown catches|td catches/, 'ctd'],
    [/receptions|catches/, 'rec'], [/targets/, 'tgt'], [/yards after (the )?catch|yac/, 'yac'], [/air yards/, 'air'],
    [/scrimmage yards|yards from scrimmage|total yards|all purpose/, 'scrim'], [/touches/, 'touch'],
    [/sacks taken|times sacked|been sacked|was sacked|got sacked/, 'sck'],
    [/tackles for (a )?loss|tfl/, 'tfl'], [/sacks/, 'dsk'], [/solo tackles/, 'tks'], [/tackles/, 'tkl'], [/qb hits|quarterback hits/, 'qbh'],
    [/forced fumbles/, 'ff'], [/fumble recoveries/, 'fr'], [/passes defended|pass deflections|pass breakups/, 'pd'], [/defensive (touchdowns|tds)/, 'dtd'], [/safeties/, 'saf'],
    [/longest field goal|longest fg/, 'fgl'], [/field goal (percentage|pct|%)|fg ?%|most accurate kicker/, 'fgp'],
    [/50 ?\+? yard field goals|field goals of 50/, 'fg50'], [/field goals|fgs/, 'fgm'], [/extra points/, 'xpm'], [/kicking points/, 'kpts'],
    [/punting average|punt average|yards per punt/, 'pavg'], [/longest punt/, 'pntl'], [/punts/, 'pnt'],
    [/kick(off)? return yards/, 'kryd'], [/punt return yards/, 'pryd'], [/return (touchdowns|tds)|special teams (touchdowns|tds)/, 'sttd'],
    [/ppr|fantasy points/, 'fpp'], [/passing epa/, 'pepa'], [/epa per dropback/, 'pepad'],
    [/qb wins|wins as a starter|starts won|wins/, 'qbw'], [/win (percentage|pct|%)/, 'qbwp'], [/qb starts|starts/, 'qbs'],
    [/fumbles lost|fumbles/, 'fuml'],
    [/interceptions|picks/, '*int'], [/(total )?(touchdowns|tds|scores)/, '*td'], [/yards|yardage/, '*yds'], [/games( played)?/, '*g']
  ];
  var TSTAT = [
    [/super ?bowl appearances|been to the super ?bowl|super ?bowl trips/, 'sba'],
    [/super ?bowl (wins|titles|championships)|super ?bowls|championships|titles|rings|won the super ?bowl/, 'sbw'],
    [/playoff wins|postseason wins|playoff victories/, 'pw'], [/playoff losses/, 'pl'],
    [/playoff (appearances|seasons|berths|trips)|made the playoffs|playoffs appearances|times in the playoffs/, 'po'],
    [/point differential|point diff|points margin/, 'pdiff'],
    [/points allowed|fewest points|points against|allowed the (fewest|most) points|best defense|worst defense/, 'pa'],
    [/points per game|scoring average/, 'pfg'], [/points|scored|best offense|worst offense|scoring/, 'pf'],
    [/rushing yards allowed|rush yards allowed|run defense/, 'dryd'], [/passing yards allowed|pass yards allowed|pass defense/, 'dpyd'],
    [/yards allowed|total defense/, 'dyd'], [/yards per play allowed/, 'dypp'], [/yards per play/, 'oypp'],
    [/rushing yards|rush yards/, 'ryd'], [/rushing (touchdowns|tds)/, 'rtd'], [/passing yards|pass yards/, 'pnet'], [/passing (touchdowns|tds)/, 'ptd'],
    [/turnover differential|turnover margin/, 'tod'], [/takeaways/, 'take'], [/turnovers|giveaways/, 'give'],
    [/sacks allowed|times sacked/, 'sck'], [/sacks/, 'dsk'], [/interceptions thrown/, 'int'], [/interceptions|picks/, 'dint'],
    [/penalty yards/, 'peny'], [/penalties|penalized/, 'pen'], [/field goal (percentage|%)/, 'fgp'], [/field goals/, 'fgm'],
    [/passer rating/, 'rate'], [/epa/, 'oepap'],
    [/win (percentage|pct|%)|winning percentage|record/, 'winp'],
    [/losses|lost the most/, 'losses'], [/wins|won the most|victories/, 'wins'],
    [/total yards|yards|offense/, 'oyd']
  ];
  function matchStat(list, t) {
    for (var i = 0; i < list.length; i++) { var m = t.match(list[i][0]); if (m) return { id: list[i][1], phrase: m[0] }; }
    return null;
  }
  function resolvePlayerStat(id, grp) {
    if (id === '*int') return grp === 'QB' ? 'int' : 'dint';
    if (id === '*td') return grp === 'QB' ? 'ptd' : 'stdd';
    if (id === '*yds') return grp === 'QB' ? 'pyd' : grp === 'RB' ? 'scrim' : grp === 'WR' || grp === 'TE' ? 'cyd' : 'scrim';
    return id;
  }
  var POS = [[/\b(quarterbacks?|qbs?)\b/, 'QB'], [/\b(running ?backs?|rbs?|halfbacks?)\b/, 'RB'], [/\b(wide receivers?|receivers?|wrs?|wideouts?)\b/, 'WR'],
    [/\b(tight ends?)\b/, 'TE'], [/\b(kickers?)\b/, 'K'], [/\b(punters?)\b/, 'P'],
    [/\b(defenders?|defensive players?|linebackers?|pass rushers?|edge rushers?|cornerbacks?|corners|safet(y|ies)|defensive (ends?|tackles?|backs?)|dbs?|lbs?)\b/, 'DEF']];
  var GROUPNAME = { QB: 'quarterback', RB: 'running back', WR: 'wide receiver', TE: 'tight end', K: 'kicker', P: 'punter', DEF: 'defensive player' };
  var MAIN = { QB: ['pyd', 'ptd', 'int', 'rate'], RB: ['ryd', 'rtd', 'ypc', 'cyd'], WR: ['rec', 'cyd', 'ctd'], TE: ['rec', 'cyd', 'ctd'], DEF: ['tkl', 'dsk', 'dint', 'ff'], K: ['fgm', 'fgp', 'fgl'], P: ['pnt', 'pavg'] };

  var AWARDS = [[/super ?bowl.*\b(mvps?|most valuable)\b|\b(mvps?|most valuable player)\b.*super ?bowl/, ['sbmvp']], [/\bmvps?\b|most valuable/, ['mvp']], [/offensive player of the year|\bopoy\b/, ['opoy']],
    [/defensive player of the year|\bdpoy\b/, ['dpoy']], [/offensive rookie of the year|\boroy\b/, ['oroy']], [/defensive rookie of the year|\bdroy\b/, ['droy']],
    [/rookie of the year/, ['oroy', 'droy']], [/comeback player|\bcpoy\b|comeback of the year/, ['cpoy']], [/walter payton|man of the year/, ['wpmoy']]];
  var AWLABEL = {};
  (X.awards || []).forEach(function (a) { AWLABEL[a[0]] = a[1]; });

  // ---------------------------------------------------------------- formatting
  function pname(p) { return C.players[p][1]; }
  function tname(t) { return T.teams[t][1]; }
  function plist(names) { return names.length < 2 ? names.join('') : names.slice(0, -1).join(', ') + ' and ' + names[names.length - 1]; }
  function lbl(d) { return d.label.replace(/ %$/, ' percentage').replace(/ \/ /g, ' per ').replace(/^FG/, 'field goal').replace(/^XP/, 'extra point').replace(/ \(.*\)/, '').toLowerCase().replace(/\btd\b/g, 'touchdowns').replace(/\bint\b/g, 'interceptions').replace(/\bfg\b/g, 'field goals').replace(/\bxp\b/g, 'extra points').replace(/\bqb\b/g, 'QB').replace(/\bepa\b/g, 'EPA'); }
  function val(d, v) { return C.fmt(d, v, false); }
  // "1,037 passing yards" / "a passer rating of 106.2"
  function phrase(d, v) { return d.kind === 'rate' ? 'a ' + lbl(d) + ' of ' + val(d, v) : val(d, v) + ' ' + lbl(d); }
  function the(mode, id) { return mode === 'teams' ? 'the ' + tname(id) : pname(id); }
  function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }
  function stLabel(st) { return st === 'POST' ? ' in the playoffs' : st === 'ALL' ? ' (regular season and playoffs)' : ''; }
  function rangeText(y, firstYear) {
    if (!y) return 'since ' + firstYear;
    return y.label;
  }

  // ---------------------------------------------------------------- answer builders
  // A reply is { say: text shown and spoken, list: optional ranked rows, note: shown only, show: optional {mode, ids, y} }
  // leaderboards use NFL-style qualifying minimums so tiny samples don't top the list
  function qualifies(d, a, nYears) {
    if (!d.den || !d.min) return true;
    return d.den(a) >= d.min * 3 * Math.min(Math.max(1, nYears), 8);
  }
  function leaders(mode, d, o) {
    var out = [], ny = o.seasonMode ? 1 : o.to - o.from + 1;
    function push(i, a, season) {
      var r = C.value(d, a, false, !!season);
      if (r.v == null || r.small || !qualifies(d, a, ny)) return;
      if (season && o.partial && a.season === Y1) return;
      out.push({ id: i, v: r.v, season: season, a: a });
    }
    if (mode === 'teams') {
      T.teams.forEach(function (tm, i) {
        var a = T.aggregate(i, o);
        if (o.seasonMode) a.seasons.forEach(function (s) { push(i, s, s.season); });
        else if (a.seasons.length) push(i, a.tot, 0);
      });
    } else {
      C.players.forEach(function (pl, i) {
        if (o.grp && pl[3] !== o.grp) return;
        if (pl[5] < o.from || pl[4] > o.to) return;
        var a = C.aggregate(i, o);
        if (!a.seasons.length) return;
        if (o.seasonMode) a.seasons.forEach(function (s) { push(i, s, s.season); });
        else push(i, a.tot, 0);
      });
    }
    out.sort(function (a, b) { return o.low ? a.v - b.v : b.v - a.v; });
    return out;
  }

  function leaderAnswer(mode, statId, t, y, st, grp, n) {
    var M = mode === 'teams' ? T : C;
    var d = M.DEFS[statId];
    if (!d) return null;
    // fewest/lowest ask for small values; best/worst follow the stat's direction
    var low = /\b(fewest|least|lowest)\b/.test(t) ? true : /\bworst\b/.test(t) ? d.better !== 'low' : /\bbest\b/.test(t) ? d.better === 'low' : false;
    if (/\b(most|highest)\b/.test(t) && !/\b(fewest|least|lowest)\b/.test(t)) low = false;
    var seasonMode = !y || !y.single ? /single season|in a season|in one season|one season|season record|best season|worst season|single-season/.test(t) : false;
    var first = mode === 'teams' ? TY0 : Y0;
    var o = { st: st, from: y ? y.from : first, to: y ? y.to : Y1, grp: grp, seasonMode: seasonMode, low: low, partial: true };
    var rows = leaders(mode, d, o);
    if (!rows.length) return { say: 'I could not find enough ' + lbl(d) + ' for that.' };
    var name = function (id) { return the(mode, id); };
    var top = rows[0], ties = rows.filter(function (r) { return Math.abs(r.v - top.v) < 1e-9; });
    var who = grp ? ' by a ' + GROUPNAME[grp] : '';
    var dir = d.kind === 'rate' ? (low ? 'lowest' : 'highest') : (low ? 'fewest' : 'most');
    if (/\bbest\b/.test(t) && !(/\bfewest|most\b/.test(t))) dir = 'best';
    if (/\bworst\b/.test(t) && !(/\bfewest|most\b/.test(t))) dir = 'worst';
    if ((dir === 'best' || dir === 'worst') && d.kind !== 'rate' && statId !== 'winp') dir = d.kind === 'cnt' || !low ? 'most' : 'fewest';
    var what = statId === 'winp' ? 'record' : lbl(d);
    var when = seasonMode ? 'in a single season ' + rangeText(y, first) : rangeText(y, first);
    var stTxt = stLabel(st);
    function shown(r) { return statId === 'winp' ? r.a.w + '–' + r.a.l + (r.a.t ? '–' + r.a.t : '') + ' (' + val(d, r.v) + ')' : val(d, r.v); }
    var past = (y && y.to < Y1) || seasonMode;
    var verb = mode === 'teams' ? (past ? 'had' : 'have') : (past ? 'had' : 'has');
    var say;
    if (seasonMode) say = 'The ' + dir + ' ' + what + who + ' ' + when + stTxt + ' belongs to ' + name(top.id) + ': ' + shown(top) + ' in ' + top.season + '.';
    else if (ties.length > 1) say = cap(plist(ties.map(function (r) { return name(r.id); }))) + ' are tied for the ' + dir + ' ' + what + who + ' ' + when + stTxt + ', at ' + shown(top) + '.';
    else say = cap(name(top.id)) + ' ' + verb + ' the ' + dir + ' ' + what + who + ' ' + when + stTxt + ': ' + shown(top) + '.';
    if (rows.length > 1 && ties.length === 1) say += ' Next is ' + name(rows[1].id) + ' with ' + shown(rows[1]) + (seasonMode ? ' in ' + rows[1].season : '') + '.';
    var list = rows.slice(0, n || 5).map(function (r, i) { return { rank: i + 1, name: (mode === 'teams' ? tname(r.id) : pname(r.id)) + (seasonMode ? ' (' + r.season + ')' : ''), value: shown(r) }; });
    var note = [];
    if (!y && mode === 'players') note.push('Career totals cover 1999 onward, so players who started earlier show partial totals.');
    if (d.den && d.min) note.push('Only qualified ' + (mode === 'teams' ? 'teams' : 'players') + ' are ranked (enough attempts for a fair rate).');
    if (seasonMode) note.push('The ' + Y1 + ' season is in progress, so it is left out of single-season records.');
    else if (y && y.to === Y1) note.push('The ' + Y1 + ' season is still in progress.');
    var ids = rows.slice(0, Math.min(4, Math.max(2, ties.length))).map(function (r) { return r.id; });
    return { say: say, list: list, listTitle: statId === 'winp' ? 'Record' : d.label, note: note.join(' '), show: { mode: mode, ids: ids, y: seasonMode ? null : o } };
  }

  function playerAnswer(p, statId, y, st) {
    var pl = C.players[p], grp = pl[3];
    var o = { st: st, from: y ? y.from : Y0, to: y ? y.to : Y1 };
    var a = C.aggregate(p, o);
    var when = y ? y.label : 'in his career';
    if (!y && pl[7]) when = 'since 1999 (his career began earlier)';
    if (!a.seasons.length) return { say: pname(p) + ' has no recorded stats ' + (y ? y.label : '') + stLabel(st) + '.', show: { mode: 'players', ids: [p] } };
    if (statId === '*g') return { say: pname(p) + ' played ' + a.tot.g + ' games ' + when + stLabel(st) + '.', show: { mode: 'players', ids: [p], y: o } };
    var ids = statId ? [resolvePlayerStat(statId, grp)] : MAIN[grp] || MAIN.QB;
    var parts = [];
    ids.forEach(function (id) {
      var d = C.DEFS[id]; if (!d) return;
      var r = C.value(d, a.tot, false, false);
      if (r.v == null) return;
      parts.push(phrase(d, r.v) + (r.small ? ' (small sample)' : ''));
    });
    if (!parts.length) return { say: pname(p) + ' has no ' + (statId ? lbl(C.DEFS[ids[0]]) : 'stats') + ' ' + when + stLabel(st) + '.', show: { mode: 'players', ids: [p], y: o } };
    var say = pname(p) + ' ' + (y && y.single && y.from === Y1 ? 'has' : 'had') + ' ' + plist(parts) + ' ' + when + stLabel(st) + (statId ? '' : ', in ' + a.tot.g + ' games') + '.';
    if (!statId && grp === 'QB' && a.tot.qw + a.tot.ql + a.tot.qt > 0) say += ' His record as a starter is ' + a.tot.qw + '–' + a.tot.ql + (a.tot.qt ? '–' + a.tot.qt : '') + '.';
    if (!statId && !y) {
      var hn = C.honors(p), extra = [];
      if (hn.sbw.length) extra.push(hn.sbw.length + ' Super Bowl' + (hn.sbw.length > 1 ? 's' : ''));
      if ((hn.aw.mvp || []).length) extra.push(hn.aw.mvp.length + ' MVP' + (hn.aw.mvp.length > 1 ? 's' : ''));
      if (hn.pb) extra.push(hn.pb + ' Pro Bowl' + (hn.pb > 1 ? 's' : ''));
      if (extra.length) say += ' He won ' + plist(extra) + '.';
    }
    if (y && y.single) { var hs = C.seasonHonors(p, y.from); if (hs.length) say += ' That season: ' + hs.join(', ') + '.'; }
    return { say: say, show: { mode: 'players', ids: [p], y: o } };
  }

  function teamPost(t) { return (TD.post && TD.post[t]) || []; }
  function teamAnswer(t, statId, y, st) {
    var o = { st: st, from: y ? Math.max(TY0, y.from) : TY0, to: y ? y.to : Y1 };
    var a = T.aggregate(t, o), tot = a.tot;
    if (!a.seasons.length) return { say: 'I have no games for the ' + tname(t) + ' ' + (y ? y.label : '') + '.' };
    var when = y ? y.label : 'since ' + TY0;
    var rec = tot.w + '–' + tot.l + (tot.t ? '–' + tot.t : '');
    var post = teamPost(t).filter(function (x) { return x[0] >= o.from && x[0] <= o.to; });
    var show = { mode: 'teams', ids: [t], y: o };
    if (statId === 'sbw' || statId === 'sba') {
      var won = post.filter(function (x) { return x[3] === 2; }).map(function (x) { return x[0]; });
      var app = post.filter(function (x) { return x[3] > 0; }).map(function (x) { return x[0]; });
      if (statId === 'sbw') return { say: 'The ' + tname(t) + ' have won ' + (won.length || 'no') + ' Super Bowl' + (won.length === 1 ? '' : 's') + ' ' + when + (won.length ? ', for the ' + plist(won.map(String)) + ' season' + (won.length > 1 ? 's' : '') : '') + '.', show: show };
      return { say: 'The ' + tname(t) + ' have been to ' + app.length + ' Super Bowl' + (app.length === 1 ? '' : 's') + ' ' + when + (app.length ? ' (' + plist(app.map(String)) + ' seasons), winning ' + won.length : '') + '.', show: show };
    }
    if (statId && statId !== 'winp' && statId !== 'wins' && statId !== 'losses') {
      var d = T.DEFS[statId];
      var r = C.value(d, tot, false, false);
      return { say: 'The ' + tname(t) + ' ' + (y && y.to < Y1 ? 'had' : 'have') + ' ' + phrase(d, r.v) + ' ' + when + stLabel(st) + '.', show: show };
    }
    var say;
    if (y && y.single) {
      say = 'In ' + y.from + ', the ' + tname(t) + ' went ' + rec + stLabel(st) + ', scoring ' + tot.pf + ' points and allowing ' + tot.pa + '.';
      var p = post[0];
      if (y.from === Y1 && st === 'REG') say += ' The season is still in progress.';
      else if (p) say += p[3] === 2 ? ' They won the Super Bowl!' : p[3] === 1 ? ' They reached the Super Bowl but lost.' : ' They went ' + p[1] + '–' + p[2] + ' in the playoffs.';
      else if (st !== 'POST') say += ' They missed the playoffs.';
    } else {
      var titles = post.filter(function (x) { return x[3] === 2; }).length;
      say = 'The ' + tname(t) + ' are ' + rec + ' ' + when + stLabel(st) + ' (' + C.fmt({ fmt: 'pct' }, (tot.w + tot.t / 2) / Math.max(1, tot.w + tot.l + tot.t)) + '), with ' + post.length + ' playoff season' + (post.length === 1 ? '' : 's') + ' and ' + (titles || 'no') + ' Super Bowl title' + (titles === 1 ? '' : 's') + '.';
    }
    return { say: say, show: show };
  }

  function sbSeasons() {
    var by = {};
    Object.keys(TD.post || {}).forEach(function (t) {
      TD.post[t].forEach(function (x) { if (x[3]) { by[x[0]] = by[x[0]] || {}; by[x[0]][x[3] === 2 ? 'w' : 'l'] = +t; } });
    });
    return by;
  }
  function superBowlAnswer(y) {
    var by = sbSeasons(), yrs = Object.keys(by).map(Number).sort();
    if (!yrs.length) return null;
    var s = y ? y.from : yrs[yrs.length - 1];
    if (y && !y.single) {
      var list = yrs.filter(function (x) { return x >= y.from && x <= y.to; }).map(function (x) { return { rank: x, name: tname(by[x].w), value: 'beat ' + T.teams[by[x].l][0] }; });
      var cnt = {};
      list.forEach(function (r) { cnt[r.name] = (cnt[r.name] || 0) + 1; });
      var topName = Object.keys(cnt).sort(function (a, b) { return cnt[b] - cnt[a]; })[0];
      return { say: 'There were ' + list.length + ' Super Bowls ' + y.label + '. The ' + topName + ' won the most, with ' + cnt[topName] + '.', list: list, listTitle: 'Super Bowl winners by season' };
    }
    if (!by[s] || by[s].w == null) {
      if (s >= Y1) return { say: 'The Super Bowl for the ' + s + ' season has not been played yet. The most recent one, for the ' + yrs[yrs.length - 1] + ' season, was won by the ' + tname(by[yrs[yrs.length - 1]].w) + '.' };
      return { say: 'I only have Super Bowls from the ' + TY0 + ' season on.' };
    }
    var w = by[s].w, l = by[s].l;
    var nm = y && y.sbn ? 'Super Bowl ' + y.sbn : 'the Super Bowl for the ' + s + ' season';
    return { say: 'The ' + tname(w) + ' won ' + nm + ', beating the ' + tname(l) + '. It was played in February ' + (s + 1) + '.',
      note: y && !y.sbn ? 'NFL seasons are named for the year they start. If you meant the game played in February ' + s + ', that was the ' + (s - 1) + ' season' + (by[s - 1] && by[s - 1].w != null ? ', won by the ' + tname(by[s - 1].w) : '') + '.' : '',
      show: { mode: 'teams', ids: [w, l], y: { st: 'ALL', from: s, to: s } } };
  }

  function awardAnswer(codes, y, players) {
    var winners = [];
    Object.keys(X.aw || {}).forEach(function (p) { X.aw[p].forEach(function (x) { if (codes.indexOf(x[1]) >= 0) winners.push({ p: +p, s: x[0], c: x[1] }); }); });
    winners.sort(function (a, b) { return a.s - b.s; });
    var label = codes.length > 1 ? 'Rookie of the Year' : AWLABEL[codes[0]];
    if (players.length) {
      var p = players[0], mine = winners.filter(function (w) { return w.p === p; });
      if (!mine.length) return { say: pname(p) + ' has not won ' + label + ' (I track awards from 1999 on).', show: { mode: 'players', ids: [p] } };
      return { say: pname(p) + ' won ' + label + ' ' + (mine.length === 1 ? 'once' : mine.length + ' times') + ', in ' + plist(mine.map(function (w) { return String(w.s); })) + '.', show: { mode: 'players', ids: [p] } };
    }
    if (y && y.single) {
      var ws = winners.filter(function (w) { return w.s === y.from; });
      if (!ws.length) return { say: 'I do not have a ' + label + ' winner for ' + y.from + ' yet.' };
      var sbNote = '';
      if (codes[0] === 'sbmvp') {
        // NFL seasons are named for the year they start; the Super Bowl is played the following February
        var prev = winners.filter(function (w) { return w.s === y.from - 1; });
        if (prev.length && !y.sbn) sbNote = ' If you meant the Super Bowl played in February ' + y.from + ', for the ' + (y.from - 1) + ' season, the MVP was ' + plist(prev.map(function (w) { return pname(w.p); })) + '.';
      }
      var who = plist(ws.map(function (w) { return pname(w.p) + (codes.length > 1 ? ' (' + AWLABEL[w.c] + ')' : '') + ' (' + C.players[w.p][2] + ')'; }));
      var head = codes[0] === 'sbmvp' ? (y.sbn ? 'The MVP of Super Bowl ' + y.sbn + ' was ' : 'The Super Bowl MVP for the ' + y.from + ' season, in the game played in February ' + (y.from + 1) + ', was ') + who + '.'
        : 'The ' + y.from + ' ' + label + (ws.length > 1 ? ' winners were ' : ' was ') + who + '.';
      return { say: head + sbNote, show: { mode: 'players', ids: ws.map(function (w) { return w.p; }).slice(0, 4) } };
    }
    var inR = winners.filter(function (w) { return !y || (w.s >= y.from && w.s <= y.to); });
    if (/\bmost\b|how many times|who has won/.test(lastQ)) {
      var cnt = {};
      inR.forEach(function (w) { cnt[w.p] = (cnt[w.p] || 0) + 1; });
      var ranked = Object.keys(cnt).map(Number).sort(function (a, b) { return cnt[b] - cnt[a]; });
      if (ranked.length) return { say: pname(ranked[0]) + ' has won the most ' + label + ' awards since 1999, with ' + cnt[ranked[0]] + '.', list: ranked.slice(0, 5).map(function (p, i) { return { rank: i + 1, name: pname(p), value: String(cnt[p]) }; }), listTitle: label + ' awards' };
    }
    var recent = inR.slice(-5).reverse();
    return { say: 'The most recent ' + label + ' was ' + pname(recent[0].p) + ' in ' + recent[0].s + '.', list: recent.map(function (w) { return { rank: w.s, name: pname(w.p), value: C.players[w.p][2] }; }), listTitle: label + ' winners' };
  }

  function compareAnswer(mode, ids, y, st) {
    if (mode === 'teams') {
      var o = { st: st, from: y ? y.from : TY0, to: y ? y.to : Y1 };
      var parts = ids.map(function (t) {
        var a = T.aggregate(t, o).tot, titles = teamPost(t).filter(function (x) { return x[0] >= o.from && x[0] <= o.to && x[3] === 2; }).length;
        return tname(t) + ' ' + a.w + '–' + a.l + (a.t ? '–' + a.t : '') + (titles ? ' with ' + titles + ' title' + (titles > 1 ? 's' : '') : '');
      });
      return { say: 'Here they are side by side ' + (y ? y.label : 'since ' + TY0) + ': ' + parts.join('; ') + '. I put the full comparison in the table.', show: { mode: 'teams', ids: ids, y: o } };
    }
    var grp = C.players[ids[0]][3], d = C.DEFS[(MAIN[grp] || MAIN.QB)[0]];
    var o2 = { st: st, from: y ? y.from : Y0, to: y ? y.to : Y1 };
    var vals = ids.map(function (p) { var r = C.value(d, C.aggregate(p, o2).tot, false, false); return { p: p, v: r.v }; });
    var ok = vals.filter(function (x) { return x.v != null; }).sort(function (a, b) { return b.v - a.v; });
    var say = 'I loaded ' + plist(ids.map(pname)) + ' into the comparison table.';
    if (ok.length > 1) say += ' In ' + lbl(d) + ' ' + (y ? y.label : 'since 1999') + ', ' + pname(ok[0].p) + ' leads with ' + val(d, ok[0].v) + ', ahead of ' + plist(ok.slice(1).map(function (x) { return pname(x.p) + ' (' + val(d, x.v) + ')'; })) + '.';
    return { say: say, show: { mode: 'players', ids: ids, y: o2 }, autoShow: true };
  }


  // ---------------------------------------------------------------- games: scores, betting, box scores, injuries, schedule
  var NG = window.NFLGames;
  var ROUNDS = [[/wild ?card/, 1], [/divisional|division round/, 2], [/conference (championship|title|game)|afc championship|nfc championship|afc title|nfc title/, 3], [/super ?bowl/, 4]];
  function teamCodes(ent) { return ent.teams.map(function (i) { return T.teams[i][0]; }); }
  function tn(code, season) { return NG.teamName(code, season); }
  function nick(code, season) { var n = tn(code, season).split(' '); return n[n.length - 1] === '49ers' || n.length === 1 ? n[n.length - 1] : n[n.length - 1]; }
  function sc(g, code) { return NG.fr(code) === NG.fr(g.home) ? g.hs : g.as; }
  function opp(g, code) { return NG.fr(code) === NG.fr(g.home) ? g.away : g.home; }
  function when(g) { return (g.type ? 'the ' + g.season + ' season\'s ' + NG.roundName(g) : 'Week ' + g.week + ' of ' + g.season) + ' (' + NG.dateText(g) + ')'; }
  function bettingLine(g) {
    var out = [];
    var sp = NG.spreadText(g);
    var was = g.played ? 'was' : 'is';
    if (sp) out.push(sp === 'Pick\'em' ? 'The game ' + was + ' a pick\'em' : 'The spread ' + was + ' ' + sp.replace('−', 'minus ') + (g.played ? ', and ' + (NG.coverText(g) === 'Push' ? 'it was a push' : tn(NG.coverText(g).split(' ')[0], g.season).split(' ').slice(-1)[0] + ' covered') : ''));
    if (g.total != null) out.push('the over/under ' + was + ' ' + g.total + (g.played ? ', and it went ' + NG.totalText(g).toLowerCase().replace(/ \(.*/, '') : ''));
    if (g.aml != null && g.hml != null) out.push('moneyline ' + g.away + ' ' + NG.ml(g.aml) + ', ' + g.home + ' ' + NG.ml(g.hml));
    return out.length ? cap(out.join('; ')) + '.' : '';
  }
  function gameSentence(g) {
    var lv = NG.liveFor(g);
    if (!g.played && lv && lv.state === 'in') return 'Live right now: ' + tn(g.away, g.season) + ' ' + lv.away.score + ', ' + tn(g.home, g.season) + ' ' + lv.home.score + ' (' + lv.detail + ').';
    if (!g.played) return 'The ' + tn(g.away, g.season) + ' play at the ' + tn(g.home, g.season) + ' on ' + NG.kickoff(g) + ' (' + NG.roundName(g) + ').';
    var w = NG.winner(g);
    if (w === 'TIE') return 'The ' + tn(g.away, g.season) + ' and ' + tn(g.home, g.season) + ' tied ' + g.as + '–' + g.hs + ' in ' + when(g) + '.';
    var l = w === g.home ? g.away : g.home;
    return 'The ' + tn(w, g.season) + ' beat the ' + tn(l, g.season) + ' ' + Math.max(g.hs, g.as) + '–' + Math.min(g.hs, g.as) + (g.ot ? ' in overtime' : '') + ' in ' + when(g) + (w === g.away ? ', on the road' : ', at home') + '.';
  }
  function showGame(g) { return { gameId: g.id }; }
  function gameRow(g, code) {
    if (!g.played) return { rank: g.type ? NG.roundName(g) : 'Wk ' + g.week, name: g.away + ' at ' + g.home, value: NG.kickoff(g) };
    var name = code ? (NG.fr(code) === NG.fr(g.home) ? 'vs ' : 'at ') + opp(g, code) : g.away + ' at ' + g.home;
    var v = code ? (NG.winner(g) === 'TIE' ? 'T ' : NG.fr(NG.winner(g)) === NG.fr(code) ? 'W ' : 'L ') + sc(g, code) + '–' + sc(g, opp(g, code)) : g.as + '–' + g.hs;
    return { rank: g.type ? NG.roundName(g).replace('Conference Championship', 'Conf.') + ' ' + g.season : g.season + ' wk ' + g.week, name: name, value: v };
  }

  function gameAnswer(t, ent, y, roundType, week) {
    var codes = teamCodes(ent).slice(0, 2);
    var q = { teams: codes };
    if (y) { if (y.single) q.season = y.from; else { q.from = y.from; q.to = y.to; } }
    if (roundType) q.type = roundType;
    if (week) q.week = week;
    if (/\bplayoffs?|postseason\b/.test(t) && !roundType) q.type = 'post';
    var list = NG.find(q);
    // "next game", "this week": upcoming
    if (/\bnext\b|\bupcoming\b|\bthis week\b|\btonight\b|\btoday\b|\bwhen do\b|\bwhen is\b|\bschedule\b/.test(t) && !y) {
      var up = NG.upcoming(codes[0], codes.length ? 3 : 16).filter(function (g) { return codes.length < 2 || NG.isTeam(g, codes[1]); });
      if (!up.length) return { say: 'I don\'t see any upcoming ' + (codes.length ? tn(codes[0]) + ' ' : '') + 'games on the schedule yet.' };
      var g0 = up[0];
      var say = gameSentence(g0) + ' ' + bettingLine(g0);
      return { say: say, list: up.slice(0, 8).map(function (g) { return gameRow(g); }), listTitle: codes.length ? 'Upcoming' : 'Upcoming games', gameId: g0.id };
    }
    if (!list.length) return { say: 'I couldn\'t find ' + (codes.length === 2 ? 'a game between the ' + tn(codes[0]) + ' and the ' + tn(codes[1]) : 'that game') + (y ? ' ' + y.label : '') + '. Game results go back to 1999.' };
    var played = list.filter(function (g) { return g.played; });
    if (list.length === 1) { var g = list[0]; return { say: gameSentence(g) + ' ' + bettingLine(g), gameId: g.id }; }
    if (codes.length === 2 && (!y || !y.single) && !roundType && !week && played.length > 1) {
      var a = codes[0], wa = 0, wb = 0, ti = 0;
      played.forEach(function (g) { var w = NG.winner(g); if (w === 'TIE') ti++; else if (NG.fr(w) === NG.fr(a)) wa++; else wb++; });
      var last = played[played.length - 1];
      var next = list.filter(function (g) { return !g.played; })[0];
      var say2 = (y ? cap(y.label) : 'Since 1999') + ' the ' + tn(a) + ' and ' + tn(codes[1]) + ' have played ' + played.length + ' times. The ' + (wa >= wb ? tn(a) + ' lead ' + wa + '–' + wb : tn(codes[1]) + ' lead ' + wb + '–' + wa) + (ti ? ' with ' + ti + ' tie' + (ti > 1 ? 's' : '') : '') + '. Most recently, ' + gameSentence(last).replace(/^The /, 'the ');
      if (next) say2 += ' Next up: ' + NG.kickoff(next) + '.';
      return { say: say2, list: played.slice(-6).reverse().map(function (g) { return gameRow(g, a); }), listTitle: 'Recent meetings', gameId: last.id };
    }
    if (codes.length === 1 && list.length > 4) {
      var c = codes[0], w2 = 0, l2 = 0, t2 = 0;
      played.forEach(function (g) { var w = NG.winner(g); if (w === 'TIE') t2++; else if (NG.fr(w) === NG.fr(c)) w2++; else l2++; });
      return { say: 'The ' + tn(c) + ' went ' + w2 + '–' + l2 + (t2 ? '–' + t2 : '') + ' in those ' + played.length + ' games' + (y ? ' ' + y.label : '') + '. Here they are; tap one in the Games page for the box score.',
        list: list.slice(-18).map(function (g) { return gameRow(g, c); }), listTitle: 'Results', gamesQuery: q };
    }
    var g1 = played[played.length - 1] || list[0];
    return { say: gameSentence(g1) + ' ' + bettingLine(g1) + (list.length > 1 ? ' I found ' + list.length + ' games in all.' : ''), list: list.map(function (g) { return gameRow(g, codes[0]); }), listTitle: 'Games', gameId: g1.id };
  }

  function statLine(r) {
    var out = [];
    if (r.att) out.push(r.cmp + ' of ' + r.att + ' passing for ' + r.pyd + ' yards' + (r.ptd ? ', ' + r.ptd + ' TD' + (r.ptd > 1 ? 's' : '') : '') + (r.int ? ', ' + r.int + ' interception' + (r.int > 1 ? 's' : '') : ''));
    if (r.car) out.push(r.car + ' carr' + (r.car > 1 ? 'ies' : 'y') + ' for ' + r.ryd + ' yards' + (r.rtd ? ' and ' + r.rtd + ' TD' + (r.rtd > 1 ? 's' : '') : ''));
    if (r.rec || r.tgt) out.push(r.rec + ' catch' + (r.rec === 1 ? '' : 'es') + ' for ' + r.cyd + ' yards' + (r.ctd ? ' and ' + r.ctd + ' TD' + (r.ctd > 1 ? 's' : '') : '') + ' on ' + r.tgt + ' targets');
    if (r.tkl || r.dsk || r.dint || r.ff) out.push([r.tkl ? r.tkl + ' tackles' : '', r.dsk ? r.dsk + ' sack' + (r.dsk === 1 ? '' : 's') : '', r.dint ? r.dint + ' interception' + (r.dint > 1 ? 's' : '') : '', r.ff ? r.ff + ' forced fumble' + (r.ff > 1 ? 's' : '') : ''].filter(Boolean).join(', '));
    if (r.fga || r.xpa) out.push(r.fgm + ' of ' + r.fga + ' field goals and ' + r.xpm + ' of ' + r.xpa + ' extra points');
    return out.length ? plist(out) : 'no recorded stats';
  }
  function playerGameAnswer(p, t, ent, y, roundType, week) {
    var pl = C.players[p];
    var seasons = [];
    if (y) for (var s = Math.max(y.from, pl[4]); s <= Math.min(y.to, pl[5]); s++) seasons.push(s);
    else for (var s2 = pl[4]; s2 <= pl[5]; s2++) seasons.push(s2);
    if (!seasons.length) return { say: pname(p) + ' did not play ' + (y ? y.label : '') + '.' };
    var oppCodes = teamCodes(ent);
    return Promise.all(seasons.map(function (s) { return NG.loadSeason(s).then(function (d) { return [s, d]; }, function () { return [s, null]; }); })).then(function (all) {
      var hits = [];
      all.forEach(function (sd) {
        if (!sd[1]) return;
        NG.find({ season: sd[0], week: week || undefined, type: roundType || (/\bplayoffs?|postseason\b/.test(t) ? 'post' : undefined) }).forEach(function (g) {
          var line = NG.boxLines(sd[1], g).filter(function (x) { return x.p === p; })[0];
          if (!line) return;
          var mine = line.side ? g.home : g.away, other = line.side ? g.away : g.home;
          if (oppCodes.length && !oppCodes.some(function (c) { return NG.fr(c) === NG.fr(other); })) return;
          hits.push({ g: g, r: line, mine: mine, other: other });
        });
      });
      if (!hits.length) return { say: 'I couldn\'t find a game for ' + pname(p) + (oppCodes.length ? ' against the ' + tn(oppCodes[0]) : '') + (y ? ' ' + y.label : '') + (week ? ' in week ' + week : '') + '.' };
      function res(hh) { var w = NG.winner(hh.g); return w === 'TIE' ? 'tied ' + sc(hh.g, hh.mine) + '–' + sc(hh.g, hh.other) : (NG.fr(w) === NG.fr(hh.mine) ? 'won ' : 'lost ') + sc(hh.g, hh.mine) + '–' + sc(hh.g, hh.other); }
      var hh = hits[hits.length - 1];
      var say = 'In ' + when(hh.g) + ' against the ' + tn(hh.other, hh.g.season) + ', ' + pname(p) + ' had ' + statLine(hh.r) + '. The ' + nick(hh.mine, hh.g.season) + ' ' + res(hh) + '.';
      if (hits.length > 1) say = 'I found ' + hits.length + ' games. The most recent: ' + say.charAt(0).toLowerCase() + say.slice(1);
      var main = hh.r.att ? 'pyd' : hh.r.car >= hh.r.rec ? 'ryd' : hh.r.rec ? 'cyd' : hh.r.dsk || hh.r.tkl ? 'tkl' : 'fgm';
      var unit = { pyd: ' pass yds', ryd: ' rush yds', cyd: ' rec yds', tkl: ' tackles', fgm: ' FG' }[main];
      return { say: say, list: hits.length > 1 ? hits.slice(-10).reverse().map(function (x) { return { rank: x.g.type ? NG.roundName(x.g).replace('Conference Championship', 'Conf.') + ' ' + x.g.season : x.g.season + ' wk ' + x.g.week, name: (x.mine === x.g.home ? 'vs ' : 'at ') + x.other + ' · ' + res(x).replace(/^(won|lost|tied) /, function (m) { return m.charAt(0).toUpperCase() + ' '; }), value: x.r[main] + unit }; }) : null, listTitle: pname(p) + ' game log', gameId: hh.g.id };
    });
  }

  var BAD = { Out: 3, Doubtful: 2, Questionable: 1 };
  function injuryAnswer(p, codes, t, y, week) {
    if (p == null && codes.length) {
      var code = codes[0], g;
      if (week && y && y.single) g = NG.find({ teams: [code], season: y.from, week: week })[0];
      else if (y && y.single) g = NG.find({ teams: [code], season: y.from }).filter(function (x) { return x.played; }).slice(-1)[0];
      else g = NG.upcoming(code, 1)[0] || NG.find({ teams: [code], played: true }).slice(-1)[0];
      if (!g) return { say: 'I couldn\'t find that game for the ' + tn(code) + '.' };
      if (g.season < 2009) return { say: 'Injury reports start in 2009.' };
      return NG.loadSeason(g.season).then(function (d) {
        var list = NG.injuries(d, code, g.week).filter(function (x) { return BAD[x.status]; }).sort(function (a, b) { return BAD[b.status] - BAD[a.status]; });
        if (!list.length) return { say: 'The ' + tn(code, g.season) + (g.played ? ' had' : ' have') + ' nobody listed as out, doubtful or questionable for ' + when(g) + '.' + (g.played ? '' : ' The final report usually comes out two days before the game, so check back.'), gameId: g.id };
        var outs = list.filter(function (x) { return x.status === 'Out'; });
        return { say: 'For ' + when(g) + ', the ' + tn(code, g.season) + ' listed ' + list.length + ' player' + (list.length > 1 ? 's' : '') + (outs.length ? ', with ' + plist(outs.slice(0, 4).map(function (x) { return x.name + ' (' + (x.injury || 'not given') + ')'; })) + ' out' : '') + '.',
          list: list.slice(0, 12).map(function (x) { return { rank: x.status, name: x.name + ' ' + (x.pos || ''), value: x.injury || '' }; }), listTitle: 'Injury report', gameId: g.id };
      });
    }
    var pl = C.players[p], from = Math.max(2009, y ? y.from : pl[4]), to = Math.min(y ? y.to : pl[5], pl[5]);
    if (to < 2009) return { say: 'Injury reports start in 2009, and ' + pname(p) + '\'s ' + (y ? 'season' : 'career') + ' is earlier than that.' };
    var seasons = [];
    for (var s = Math.max(from, pl[4]); s <= to; s++) seasons.push(s);
    return Promise.all(seasons.map(function (s) { return NG.loadSeason(s).then(function (d) { return [s, d]; }, function () { return [s, null]; }); })).then(function (all) {
      var spells = [];
      all.forEach(function (sd) {
        if (!sd[1]) return;
        var entries = [];
        Object.keys(sd[1].inj).forEach(function (k) {
          sd[1].inj[k].forEach(function (x) { if ((x[1] === p || (x[1] < 0 && x[0] === pl[1])) && BAD[x[4]] && x[3] && x[3] !== 'Not injury related') entries.push({ week: +k.split('|')[1], injury: x[3], status: x[4] }); });
        });
        entries.sort(function (a, b) { return a.week - b.week; });
        entries.forEach(function (e) {
          var last = spells[spells.length - 1];
          if (last && last.season === sd[0] && last.injury === e.injury && e.week - last.to <= 2) { last.to = e.week; last.weeks++; if (BAD[e.status] > BAD[last.worst]) last.worst = e.status; if (e.status === 'Out') last.out++; }
          else spells.push({ season: sd[0], injury: e.injury, from: e.week, to: e.week, weeks: 1, worst: e.status, out: e.status === 'Out' ? 1 : 0 });
        });
      });
      if (!spells.length) return { say: pname(p) + ' was never listed as out, doubtful or questionable with an injury ' + (y ? y.label : 'since 2009') + '.' };
      var recent = spells.slice(-3).reverse();
      function wk(x) { return x.from === x.to ? 'week ' + x.from : 'weeks ' + x.from + ' to ' + x.to; }
      var say = pname(p) + ' was on the injury report ' + spells.length + ' time' + (spells.length > 1 ? 's' : '') + ' ' + (y ? y.label : 'since 2009') + '. Most recently: ' +
        recent.map(function (x) { var inj = x.injury.toLowerCase(); return (/^[aeiou]/.test(inj) ? 'an ' : 'a ') + inj + ' injury in ' + x.season + ' (' + wk(x) + (x.out ? ', out ' + x.out + ' game' + (x.out > 1 ? 's' : '') : ', listed ' + x.worst.toLowerCase()) + ')'; }).join('; ') + '.';
      return { say: say, list: spells.slice(-10).reverse().map(function (x) { return { rank: x.season, name: cap(x.injury) + ' · ' + wk(x), value: x.out ? 'Out ' + x.out : x.worst }; }), listTitle: 'Injury history',
        note: 'From weekly injury reports (2009 on). Players placed on injured reserve drop off the report, so a season-ending injury can show only one or two weeks.' };
    });
  }

  var HELP = {
    say: 'I can answer questions from this site\'s data: player stats since 1999, team records since 2000, every game score, betting line, box score and injury report, awards and Super Bowls. Try one of these.',
    examples: ['Who has the most passing yards ever?', 'Most rushing yards in a single season', 'Who won the Super Bowl in 2019?', 'Who won MVP in 2015?',
      'How many Super Bowls have the Patriots won?', 'Chiefs record in 2023', 'Who won the Bills Chiefs divisional game in 2021?', 'When do the Cowboys play next?', 'How did Mahomes play against the Bills in 2021?', 'Was Joe Burrow hurt in 2023?', 'What was the spread in Super Bowl 57?', 'Patrick Mahomes stats this season', 'Compare Travis Kelce and Rob Gronkowski', 'Which team had the best record in 2007?', 'Most sacks by a defensive player since 2015']
  };

  var lastQ = '';
  // Speech recognition writes things like "M.V.P.", "two thousand nine" or "'09"; turn them into what the parser expects
  var NUMW = { zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14,
    fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19, twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90 };
  function twoDigit(str) {
    var w = str.trim().split(/[\s-]+/), n = 0;
    for (var i = 0; i < w.length; i++) { if (NUMW[w[i]] == null) return null; n += NUMW[w[i]]; }
    return n < 100 ? n : null;
  }
  var NW = '(?:zero|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety)';
  var NW2 = NW + '(?:[\\s-]+' + NW + ')?';
  function normalizeSpoken(q) {
    var t = q.replace(/\bm\s*\.?\s*v\s*\.?\s*p\.?(s)?(?=\W|$)/gi, 'MVP$1').replace(/\bt\s*\.\s*d\s*\.?/gi, 'TD');
    t = t.replace(new RegExp('\\btwo thousand(?: and)?(?: (' + NW2 + '))?\\b', 'gi'), function (m, rest) { var n = rest ? twoDigit(rest.toLowerCase()) : 0; return n != null && n < 100 ? String(2000 + n) : m; });
    t = t.replace(new RegExp('\\b(nineteen|twenty) (' + NW2 + ')\\b', 'gi'), function (m, a, b) { var n = twoDigit(b.toLowerCase()); if (n == null || n < 10) return m; var y = (a.toLowerCase() === 'nineteen' ? 1900 : 2000) + n; return y >= 1990 && y <= 2040 ? String(y) : m; });
    t = t.replace(new RegExp('\\b(?:twenty|nineteen) oh (' + NW + ')\\b', 'gi'), function (m, b) { var n = NUMW[b.toLowerCase()]; return n < 10 ? String((/^nineteen/i.test(m) ? 1900 : 2000) + n) : m; });
    // '09, in 09, the 09 season
    t = t.replace(/(^|[\s(])['’‘](\d{2})\b/g, function (m, a, d) { return a + String((+d > 40 ? 1900 : 2000) + +d); });
    t = t.replace(/\b(in|of|the|for|during|from|since|to|season) (\d{2})\b(?! (?:yards|points|games|times|tds|touchdowns|sacks|catches|carries))/gi, function (m, w, d) { return w + ' ' + ((+d > 40 ? 1900 : 2000) + +d); });
    return t;
  }
  function answer(q) {
    q = normalizeSpoken(String(q));
    var raw = q;
    var t = ' ' + q.toLowerCase().replace(/[’']s\b/g, '').replace(/[’'"?!.,;:()]/g, ' ').replace(/\s+/g, ' ').trim() + ' ';
    t = t.trim();
    lastQ = t;
    if (!t) return HELP;
    if (/^(hi|hello|hey|hola|good (morning|afternoon|evening))\b/.test(t) && t.split(' ').length <= 3) return { say: pick(['Hi! ', 'Hey there! ', 'Hello! ']) + 'Ask me anything about NFL stats from 1999 to today.', examples: HELP.examples.slice(0, 4) };
    if (/\b(help|what can you do|how does this work|examples?)\b/.test(t)) return HELP;
    if (/\bthank/.test(t)) return { say: pick(['You got it!', 'Anytime!', 'My pleasure!']) + ' Ask me another one.' };

    var y = parseYears(t);
    if (y && y.bad) return { say: 'That year range looks backwards. Try something like "from 2010 to 2020".' };
    var st = /including (the )?(playoffs|postseason)|playoffs included|regular season and (the )?playoffs/.test(t) ? 'ALL'
      : /\b(in|during) the (playoffs|postseason)\b|\bpostseason\b|\bplayoff (yards|touchdowns|tds|passing|rushing|receiving|stats|games)\b/.test(t) ? 'POST' : 'REG';
    var tt = stripYears(t);
    var grp = null;
    POS.forEach(function (p) { if (!grp && p[0].test(tt)) grp = p[1]; });

    var ent = findEntities(tt, raw, grp);
    var award = null;
    AWARDS.forEach(function (a) { if (!award && a[0].test(tt)) award = a[1]; });
    if (award) return awardAnswer(award, y, ent.players);

    var wantsTeam = ent.teams.length > 0 || /\b(team|teams|franchise|franchises)\b/.test(tt);
    var isCompare = /\bcompare\b|\bvs\b|\bversus\b|\bbetter\b|\bor\b|\bagainst\b|\bcomparison\b/.test(tt);
    var isLeader = /\b(who|which|whom)\b.*\b(most|least|fewest|highest|lowest|best|worst|top|leads?|led|leader|leading)\b|\b(most|least|fewest|highest|lowest|leaders?|leading|top \d+|top five|top ten|best|worst)\b/.test(tt);
    var topN = (tt.match(/\btop (\d+|five|ten|three)\b/) || [])[1];
    topN = topN ? (WORDNUM[topN] || +topN) : 5;

    // games: injuries, a player's game, scores, betting lines, schedule
    if (NG) {
      var roundType = null;
      ROUNDS.forEach(function (r) { if (roundType == null && r[0].test(tt)) roundType = r[1]; });
      var wm = t.match(/\bweek (\d{1,2})\b/), week = wm ? +wm[1] : null;
      if (/\binjur|\bhurt\b|\binjury report\b|\bhealthy\b|\bon the report\b/.test(tt) && (ent.players.length || ent.teams.length))
        return injuryAnswer(ent.players.length ? ent.players[0] : null, teamCodes(ent), tt, y, week);
      var gameWords = /\bscore\b|\bfinal\b|\bbeat\b|\bresult|\bgame\b|\bgames\b|\bmatchup\b|\bspread\b|\bline\b|\bodds\b|\bmoney ?line\b|\bover ?under\b|\bo\/u\b|\bcover|\bplay(ed|s)?\b|\bhead to head\b|\bvs\b|\bversus\b|\bagainst\b|\bnext\b|\bupcoming\b|\btonight\b|\btoday\b|\bthis week\b|\bschedule\b|\bwho won\b/;
      if (ent.players.length === 1 && (week || roundType || /\bagainst\b|\bvs\b|\bversus\b|\bgame\b|\bin the playoffs\b/.test(tt)) && !/\bcompare\b/.test(tt) && ent.players.length < 2)
        return playerGameAnswer(ent.players[0], tt, ent, y, roundType, week);
      if (!ent.players.length && (ent.teams.length >= 1 && (gameWords.test(tt) || week || roundType) && !/\brecord\b|\bhow many\b|\bmost\b/.test(tt)))
        return gameAnswer(tt, ent, y, roundType, week);
      if (!ent.players.length && !ent.teams.length && /\b(games|schedule|matchups|odds|spreads|lines)\b.*\b(this week|today|tonight|next|upcoming|this weekend)\b|\b(this week|today|tonight|this weekend)\b.*\b(games|odds|spreads)\b|what games/.test(tt))
        return gameAnswer(tt, ent, null, null, null);
      if (/super ?bowl/.test(tt) && /\b(spread|line|odds|score|over ?under|money ?line)\b/.test(tt) && y)
        return gameAnswer(tt, ent, y, 4, null);
    }

    // Super Bowl winners
    if (/super ?bowl/.test(tt) && !ent.teams.length && !ent.players.length && /\b(won|win|winner|winners|champion|champions|who played|played in)\b/.test(tt) && !/\bmost\b/.test(tt))
      return superBowlAnswer(y) || HELP;

    if (isCompare && ent.players.length >= 2) return compareAnswer('players', ent.players.slice(0, 4), y, st);
    if (T && isCompare && ent.teams.length >= 2) return compareAnswer('teams', ent.teams.slice(0, 4), y, st);

    var ps = matchStat(PSTAT, tt), ts = T ? matchStat(TSTAT, tt) : null;

    if (ent.players.length === 1 && !wantsTeam) return playerAnswer(ent.players[0], ps ? ps.id : null, y, st);
    if (T && ent.teams.length === 1 && !ent.players.length) {
      if (isLeader && !/\b(have|has|did)\b/.test(tt)) { /* "most points by the Chiefs" falls through to a team answer anyway */ }
      return teamAnswer(ent.teams[0], ts ? ts.id : null, y, st);
    }
    if (ent.players.length > 1) return compareAnswer('players', ent.players.slice(0, 4), y, st);
    if (T && ent.teams.length > 1) return compareAnswer('teams', ent.teams.slice(0, 4), y, st);

    // leaderboards
    var teamOnly = ts && ['sbw', 'sba', 'pw', 'pl', 'po', 'pdiff', 'pa', 'pf', 'pfg', 'winp', 'wins', 'losses', 'dyd', 'dryd', 'dpyd', 'take', 'give', 'tod', 'pen', 'peny'].indexOf(ts.id) >= 0 && !(ps && ['qbw', 'qbwp'].indexOf(ps.id) >= 0 && grp === 'QB');
    if (T && (wantsTeam || (teamOnly && !grp)) && ts) return leaderAnswer('teams', ts.id, tt, y, st, null, topN);
    if (ps && (isLeader || /\bwho\b/.test(tt))) {
      var id = resolvePlayerStat(ps.id, grp);
      if (id === '*g') return HELP;
      return leaderAnswer('players', id, tt, y, st, grp, topN);
    }
    if (T && ts && isLeader) return leaderAnswer('teams', ts.id, tt, y, st, null, topN);
    if (/super ?bowl/.test(tt)) return superBowlAnswer(y) || HELP;
    return { say: 'Hmm, I\'m not sure about that one. I can answer questions about player and team stats, awards and Super Bowls from this site\'s data. Here are some ideas.', examples: HELP.examples.slice(0, 6) };
  }

  // ---------------------------------------------------------------- speech text
  var ONES = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen'];
  var TENS = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];
  function words(n) {
    if (n < 20) return ONES[n];
    if (n < 100) return TENS[Math.floor(n / 10)] + (n % 10 ? '-' + ONES[n % 10] : '');
    if (n < 1000) return ONES[Math.floor(n / 100)] + ' hundred' + (n % 100 ? ' ' + words(n % 100) : '');
    if (n < 1e6) return words(Math.floor(n / 1000)) + ' thousand' + (n % 1000 ? ' ' + words(n % 1000) : '');
    return words(Math.floor(n / 1e6)) + ' million' + (n % 1e6 ? ' ' + words(n % 1e6) : '');
  }
  function yearWords(y) {
    if (y >= 2000 && y < 2010) return 'two thousand' + (y % 10 ? ' ' + ONES[y % 10] : '');
    return words(Math.floor(y / 100)) + ' ' + (y % 100 < 10 ? 'oh ' + ONES[y % 100] : words(y % 100));
  }
  function numWords(s) {
    var neg = /^[−-]/.test(s);
    s = s.replace(/^[−-]/, '').replace(/,/g, '');
    var p = s.split('.'), out = words(+p[0]);
    if (p[1]) out += ' point ' + p[1].split('').map(function (c) { return ONES[+c]; }).join(' ');
    return (neg ? 'minus ' : '') + out;
  }
  function speakable(text) {
    return text
      .replace(/¡/g, '')
      .replace(/\b((?:19|20)\d{2})[–-]((?:19|20)\d{2})\b/g, '$1 to $2')
      .replace(/(\d+)–(\d+)–(\d+)/g, '$1 wins, $2 losses and $3 ties')
      .replace(/(\d+)–(\d+)/g, '$1 and $2')
      .replace(/(\d)%/g, '$1 percent')
      .replace(/[−-]?\d+(?:,\d{3})*(?:\.\d+)?/g, function (m) {
        var plain = m.replace(/[−-]/, '');
        if (/^(19|20)\d{2}$/.test(plain) && !/[,.]/.test(m)) return yearWords(+plain);
        return numWords(m);
      })
      .replace(/\bTDs?\b/g, 'touchdowns').replace(/\bINT\b/g, 'interceptions').replace(/\bQB\b/g, 'quarterback').replace(/\bRB\b/g, 'running back')
      .replace(/\bWR\b/g, 'wide receiver').replace(/\bTE\b/g, 'tight end').replace(/\bDEF\b/g, 'defense').replace(/\bEPA\b/g, 'E P A').replace(/\bMVPs?\b/g, function (m) { return m.length > 3 ? 'M V Ps' : 'M V P'; })
      .replace(/\bNFL\b/g, 'N F L').replace(/\bvs\.?\b/g, 'versus')
      .replace(/\s*\(\s*/g, ', ').replace(/\s*\)\s*([,.;:!?])/g, '$1').replace(/\s*\)\s*/g, ', ').replace(/\s+([,.])/g, '$1').replace(/,\s*,/g, ',');
  }

  // ---------------------------------------------------------------- voice
  var synth = window.speechSynthesis;
  // Best-sounding American voices first: Edge's neural "Natural" voices, Google's, then Apple's enhanced ones
  var BEST_US = [/online \(natural\).*united states/i, /google us english/i, /\b(ava|samantha|allison|evan|nathan|zoe|tom|alex)\b.*(premium|enhanced)/i, /\b(samantha|alex|aria|jenny|guy|ava)\b/i];
  var DEMONYM = { US: 'American', GB: 'British', IE: 'Irish', AU: 'Australian', NZ: 'New Zealand', CA: 'Canadian', IN: 'Indian', ZA: 'South African', NG: 'Nigerian',
    KE: 'Kenyan', GH: 'Ghanaian', TZ: 'Tanzanian', PH: 'Filipino', SG: 'Singaporean', HK: 'Hong Kong', JM: 'Jamaican', PK: 'Pakistani', MY: 'Malaysian', TT: 'Trinidadian' };
  var regionNames = null;
  try { regionNames = new Intl.DisplayNames(['en'], { type: 'region' }); } catch (e) { /* older browser */ }
  function region(v) {
    var m = String(v.lang).replace('_', '-').split('-'), r = (m[1] || '').toUpperCase();
    if (/scotland/i.test(v.lang + v.name)) return 'Scottish';
    if (DEMONYM[r]) return DEMONYM[r];
    try { if (r && regionNames) return regionNames.of(r); } catch (e) { /* unknown region */ }
    return 'Other English';
  }
  function shortVoice(v) { return v.name.replace(/^(Microsoft|Google)\s+/i, '').replace(/\s*\(.*$/, '').replace(/\s+Online.*$/i, '').replace(/\s*-\s*English.*$/i, ''); }
  var voices = [];
  var prefs = { voice: null, muted: false };
  try { var sp = JSON.parse(localStorage.getItem(KEY) || 'null'); if (sp) prefs = Object.assign(prefs, sp); } catch (e) { /* storage unavailable */ }
  // the old Spanish-accent default is gone; drop a saved Spanish voice
  if (prefs.voice && prefs.voice !== 'mix' && /spanish|español|espanol/i.test(prefs.voice)) prefs.voice = null;
  function savePrefs() { try { localStorage.setItem(KEY, JSON.stringify(prefs)); } catch (e) { /* storage unavailable */ } }
  // Neural voices sound close to a person; older desktop voices and Apple's novelty voices sound robotic
  var NOVELTY = /\b(albert|bad news|bahh|bells|boing|bubbles|cellos|good news|jester|organ|superstar|trinoids|whisper|wobble|zarvox|fred|junior|kathy|ralph|deranged|hysterical|pipe organ|eddy|flo|grandma|grandpa|reed|rocko|sandy|shelley)\b|espeak|festival/i;
  function quality(v) {
    var n = v.name;
    if (/online \(natural\)|neural|premium/i.test(n)) return 3;
    if (/enhanced|siri|^google /i.test(n) || /google/i.test(n) && !v.localService) return 2;
    if (/^microsoft (david|zira|mark|hazel|george|susan|heera|ravi)\b/i.test(n)) return 0;
    return 1;
  }
  function english() {
    return voices.filter(function (v) { return /^en/i.test(v.lang) && !NOVELTY.test(v.name); })
      .sort(function (a, b) { return quality(b) - quality(a); });
  }
  function natural() { var en = english(), best = en.length ? quality(en[0]) : 0; return en.filter(function (v) { return quality(v) >= Math.min(best, 2); }); }
  function loadVoices() { voices = synth ? synth.getVoices() : []; fillVoiceMenu(); }
  function autoVoice() {
    var us = english().filter(function (v) { return /^en[-_]US/i.test(v.lang); });
    var top = us.length ? quality(us[0]) : -1;
    for (var i = 0; i < BEST_US.length; i++) { var v = us.filter(function (x) { return BEST_US[i].test(x.name) && quality(x) === top; })[0]; if (v) return v; }
    return us[0] || english()[0] || voices[0] || null;
  }
  // "Mix it up": a different voice for each answer, rotating through regions so the accents change too
  var lastMix = null;
  function mixVoice() {
    // only rotate through the best-sounding voices on the device
    var en = natural();
    if (en.length < 2) return autoVoice();
    var byRegion = {};
    en.forEach(function (v) { (byRegion[region(v)] = byRegion[region(v)] || []).push(v); });
    var regions = Object.keys(byRegion);
    var lastR = lastMix ? region(lastMix) : null;
    var pickR = regions.length > 1 ? regions.filter(function (r) { return r !== lastR; }) : regions;
    var list = byRegion[pickR[Math.floor(Math.random() * pickR.length)]].filter(function (v) { return v !== lastMix; });
    lastMix = list[Math.floor(Math.random() * list.length)] || en[0];
    return lastMix;
  }
  function currentVoice() {
    if (prefs.voice === 'mix') return mixVoice();
    if (prefs.voice) { var v = voices.filter(function (x) { return x.name === prefs.voice; })[0]; if (v) return v; }
    return autoVoice();
  }
  function speak(text, voice) {
    if (!synth || prefs.muted) return null;
    synth.cancel();
    // one utterance per sentence: Chrome stops long utterances after about 15 seconds
    var parts = speakable(text).split(/(?<=[.!?])\s+/).filter(Boolean), v = voice || currentVoice();
    parts.forEach(function (part, i) {
      var u = new SpeechSynthesisUtterance(part);
      if (v) { try { u.voice = v; } catch (e) { /* voice list changed */ } u.lang = v.lang; }
      u.rate = 1; u.pitch = 1;
      if (i === 0) u.onstart = function () { root.classList.add('talking'); };
      if (i === parts.length - 1) u.onend = function () { root.classList.remove('talking'); };
      u.onerror = function () { root.classList.remove('talking'); };
      synth.speak(u);
    });
    return v;
  }

  // ---------------------------------------------------------------- UI
  var root, log, input, micBtn, voiceSel, muteBtn;
  function fillVoiceMenu() {
    if (!voiceSel) return;
    voiceSel.replaceChildren();
    var auto = autoVoice(), en = english();
    voiceSel.append(h('option', { value: '', text: 'Best American voice' + (auto ? ' (' + shortVoice(auto) + ')' : '') }));
    if (natural().length > 1) voiceSel.append(h('option', { value: 'mix', text: 'Mix it up: a different voice each answer' }));
    var groups = {};
    en.forEach(function (v) { (groups[region(v)] = groups[region(v)] || []).push(v); });
    Object.keys(groups).sort(function (a, b) { return a === 'American' ? -1 : b === 'American' ? 1 : a.localeCompare(b); }).forEach(function (r) {
      voiceSel.append(h('optgroup', { label: r + ' English' }, groups[r].map(function (v) { return h('option', { value: v.name, text: shortVoice(v) + (quality(v) >= 3 ? ' ★ natural' : quality(v) === 2 ? ' · good' : '') }); })));
    });
    // devices with only older voices get a pointer to the free natural ones
    var tip = root && root.querySelector('.lvtip');
    if (tip) tip.hidden = !(en.length && quality(en[0]) < 3);
    voiceSel.value = prefs.voice === 'mix' && en.length > 1 ? 'mix' : prefs.voice && voices.some(function (v) { return v.name === prefs.voice; }) ? prefs.voice : '';
  }
  function scroll() { log.scrollTop = log.scrollHeight; }
  function addUser(text) { log.append(h('div', { class: 'lm me' }, h('div', { class: 'bub', text: text }))); scroll(); }
  function addBot(r) {
    var kids = [h('p', { text: r.say })];
    if (r.list && r.list.length) kids.push(h('div', { class: 'lt', text: r.listTitle || '' }), h('ol', { class: 'lrank' }, r.list.map(function (x) { return h('li', null, h('span', { class: 'rk', text: x.rank }), h('span', { class: 'nm', text: x.name }), h('b', { text: x.value })); })));
    if (r.note) kids.push(h('p', { class: 'lnote', text: r.note }));
    var acts = [];
    if (r.gameId && window.NFLApp) acts.push(h('button', { type: 'button', class: 'lact', text: 'Open the box score', onclick: function () { window.NFLApp.showGame(r.gameId); } }));
    if (r.show && window.NFLApp && !r.autoShow) acts.push(h('button', { type: 'button', class: 'lact', text: r.show.ids.length > 1 ? 'Compare them in the table' : 'Show in the table', onclick: function () { window.NFLApp.show(r.show.mode, r.show.ids, r.show.y); } }));
    acts.push(h('button', { type: 'button', class: 'lact ghost', 'aria-label': 'Say it again', title: 'Say it again', text: '\u{1F50A} Replay', onclick: function () { speak(r.say); } }));
    kids.push(h('div', { class: 'lacts' }, acts));
    if (r.examples) kids.push(h('div', { class: 'lex' }, r.examples.map(function (e) { return h('button', { type: 'button', class: 'chip', text: e, onclick: function () { ask(e); } }); })));
    log.append(h('div', { class: 'lm bot' }, h('div', { class: 'av lav', 'aria-hidden': 'true' }), h('div', { class: 'bub' }, kids)));
    scroll();
  }
  function ask(q) {
    q = String(q || '').trim();
    if (!q) return;
    addUser(q);
    var r, oops = { say: 'Sorry, something went wrong reading the data for that question. Try asking it another way.' };
    try { r = answer(q); } catch (e) { r = oops; }
    if (r && typeof r.then === 'function') {
      var wait = h('div', { class: 'lm bot' }, h('div', { class: 'av lav', 'aria-hidden': 'true' }), h('div', { class: 'bub typing', 'aria-label': 'Luna is looking it up' }, h('i'), h('i'), h('i')));
      log.append(wait); scroll();
      r.then(function (x) { wait.remove(); reply(x || oops); }, function () { wait.remove(); reply({ say: 'I couldn\'t load that season\'s game data. Check your connection and try again.' }); });
      return;
    }
    reply(r);
  }
  function reply(r) {
    if (r.autoShow && r.show && window.NFLApp) window.NFLApp.show(r.show.mode, r.show.ids, r.show.y);
    var opener = r.examples ? '' : pick(['', '', 'Sure! ', 'Here you go. ', 'Okay! ']);
    r.say = opener + r.say;
    addBot(r);
    var v = speak(r.say);
    if (v && prefs.voice === 'mix') voiceTag(v);
  }
  function voiceTag(v) {
    var last = log.querySelector('.lm.bot:last-child .bub');
    if (last) last.append(h('span', { class: 'lvtag', text: 'Voice: ' + shortVoice(v) + ', ' + region(v) + ' English' }));
  }
  function open() {
    root.classList.add('open');
    $fab.setAttribute('aria-expanded', 'true');
    if (!log.children.length) {
      var hi = { say: 'Hey! I\'m Luna, your NFL stats guide. Ask me about any player, team or game since 1999: leaders, records, scores, betting lines, injuries and this week\'s games. Type or tap the microphone.', examples: [HELP.examples[0], HELP.examples[6], HELP.examples[7], HELP.examples[9], HELP.examples[10]] };
      addBot(hi); speak(hi.say);
    }
    setTimeout(function () { input.focus(); }, 50);
  }
  function close() { root.classList.remove('open'); $fab.setAttribute('aria-expanded', 'false'); if (synth) synth.cancel(); $fab.focus(); }

  var $fab;
  function build() {
    $fab = h('button', { type: 'button', class: 'lfab', 'aria-label': 'Ask Luna, the NFL stats assistant', 'aria-expanded': 'false', 'aria-controls': 'luna',
      onclick: function () { if (root.classList.contains('open')) close(); else open(); } },
      h('span', { class: 'av lav', 'aria-hidden': 'true' }), h('span', { class: 'lfl', text: 'Ask Luna' }));
    input = h('input', { type: 'text', id: 'lunaq', autocomplete: 'off', placeholder: 'Ask about any player, team or season…', 'aria-label': 'Your question' });
    var SR = window.SpeechRecognition || window.webkitSpeechRecognition, rec = null;
    micBtn = SR ? h('button', { type: 'button', class: 'lmic', 'aria-label': 'Ask by voice', title: 'Ask by voice' }) : null;
    if (SR) {
      micBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/></svg>';
      micBtn.addEventListener('click', function () {
        if (rec) { rec.stop(); return; }
        if (synth) synth.cancel();
        rec = new SR(); rec.lang = 'en-US'; rec.interimResults = true; rec.maxAlternatives = 1;
        root.classList.add('listening');
        rec.onresult = function (e) {
          var txt = Array.prototype.map.call(e.results, function (r) { return r[0].transcript; }).join('');
          input.value = txt;
          if (e.results[e.results.length - 1].isFinal) { input.value = ''; ask(txt); }
        };
        rec.onerror = function (e) { if (e.error === 'not-allowed') addBot({ say: 'I need permission to use your microphone. You can also type your question.' }); };
        rec.onend = function () { rec = null; root.classList.remove('listening'); };
        rec.start();
      });
    }
    var form = h('form', { class: 'lform', onsubmit: function (e) { e.preventDefault(); var q = input.value; input.value = ''; ask(q); } },
      input, micBtn, h('button', { type: 'submit', class: 'lsend', 'aria-label': 'Send', text: '➤' }));
    voiceSel = h('select', { 'aria-label': 'Luna\'s voice', class: 'lvoice', onchange: function () { prefs.voice = voiceSel.value || null; savePrefs(); var v = speak('Hi! This is how I sound now.'); if (v && prefs.voice !== 'mix') voiceTag(v); } });
    muteBtn = h('button', { type: 'button', class: 'lmute', 'aria-pressed': String(prefs.muted), title: 'Turn voice on or off',
      onclick: function () { prefs.muted = !prefs.muted; savePrefs(); muteBtn.setAttribute('aria-pressed', String(prefs.muted)); muteBtn.textContent = prefs.muted ? '\u{1F507} Voice off' : '\u{1F50A} Voice on'; if (prefs.muted && synth) synth.cancel(); } },
      prefs.muted ? '\u{1F507} Voice off' : '\u{1F50A} Voice on');
    log = h('div', { class: 'llog', role: 'log', 'aria-live': 'polite' });
    var panel = h('div', { class: 'lpanel', id: 'luna', role: 'dialog', 'aria-label': 'Luna, NFL stats assistant' },
      h('div', { class: 'lhead' },
        h('div', { class: 'av lav big', 'aria-hidden': 'true' }, h('i'), h('i'), h('i')),
        h('div', { class: 'lht' }, h('b', { text: 'Luna' }), h('span', { text: 'NFL stats guide · answers from this site\'s data' })),
        h('button', { type: 'button', class: 'lx', 'aria-label': 'Close', text: '×', onclick: close })),
      h('div', { class: 'lbar' }, muteBtn, synth ? voiceSel : null),
      h('p', { class: 'lvtip', hidden: true }, 'Want a more natural voice? Open this site in Microsoft Edge (free Natural voices), or on iPhone, iPad or Mac download a Premium voice in Settings › Accessibility › Spoken Content › Voices › English.'),
      log, form);
    root = h('div', { class: 'luna' }, panel, $fab);
    document.body.append(root);
    panel.addEventListener('keydown', function (e) { if (e.key === 'Escape') close(); });
    if (synth) { loadVoices(); if (typeof synth.addEventListener === 'function') synth.addEventListener('voiceschanged', loadVoices); else synth.onvoiceschanged = loadVoices; }
  }
  build();
  window.Luna = { answer: answer, speakable: speakable, ask: ask };
})();
