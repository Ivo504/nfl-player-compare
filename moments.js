/* NFL Player Compare: Moments. The greatest moments in NFL history, each with a YouTube link and,
   from 1999 on, a link to the game's box score. Links are YouTube searches rather than single videos,
   so they keep working when individual uploads are removed or blocked in some countries.
   Also builds lists from the site's game data: biggest upsets by the point spread and highest-scoring games. */
(function () {
  'use strict';
  var NG = window.NFLGames, T = window.TCore;
  var YT = 'https://www.youtube.com/results?search_query=';

  // type: 0 regular season (with week), 1 Wild Card, 2 Divisional, 3 Conference Championship, 4 Super Bowl.
  // w/l: winner and loser as the schedule names them that season; art overrides helmet colors for old franchises.
  var MOMENTS = [
    // ---------- classics before 1999 ----------
    { title: 'The Ice Bowl', date: '1967-12-31', round: 'NFL Championship', w: 'GB', l: 'DAL', score: '21–17', cat: 'classic',
      desc: 'At −13°F in Green Bay, Bart Starr sneaks in behind Jerry Kramer\'s block with 13 seconds left to send the Packers to Super Bowl II.', q: 'Ice Bowl 1967 Packers Cowboys Bart Starr sneak' },
    { title: 'Namath\'s Guarantee', date: '1969-01-12', round: 'Super Bowl III', w: 'NYJ', l: 'BAL', art: { BAL: ['IND', 'BAL'] }, score: '16–7', cat: 'classic',
      desc: 'Joe Namath guarantees a win as an 18-point underdog, and the AFL\'s Jets stun the Baltimore Colts.', q: 'Super Bowl III Joe Namath Jets Colts highlights' },
    { title: 'The Immaculate Reception', date: '1972-12-23', round: 'AFC Divisional', w: 'PIT', l: 'OAK', score: '13–7', cat: 'classic',
      desc: 'A deflected fourth-down pass is scooped off the turf by Franco Harris, who runs it in for the Steelers\' first playoff win.', q: 'Immaculate Reception Franco Harris 1972' },
    { title: 'The Perfect Season', date: '1973-01-14', round: 'Super Bowl VII', w: 'MIA', l: 'WAS', score: '14–7', cat: 'classic',
      desc: 'The Dolphins finish 17–0, still the NFL\'s only perfect season.', q: '1972 Dolphins perfect season Super Bowl VII' },
    { title: 'The Catch', date: '1982-01-10', round: 'NFC Championship', w: 'SF', l: 'DAL', score: '28–27', cat: 'classic',
      desc: 'Joe Montana throws off his back foot and Dwight Clark leaps in the back of the end zone, launching the 49ers dynasty.', q: 'The Catch Dwight Clark Joe Montana 1982' },
    { title: 'The Drive', date: '1987-01-11', round: 'AFC Championship', w: 'DEN', l: 'CLE', score: '23–20 (OT)', cat: 'classic',
      desc: 'John Elway marches the Broncos 98 yards to tie the game late, and they win it in overtime in Cleveland.', q: 'The Drive John Elway 1987 AFC Championship Browns' },
    { title: 'Montana to Taylor', date: '1989-01-22', round: 'Super Bowl XXIII', w: 'SF', l: 'CIN', score: '20–16', cat: 'classic',
      desc: 'Joe Montana drives 92 yards and hits John Taylor with 34 seconds left.', q: 'Super Bowl XXIII Montana John Taylor game winning drive' },
    { title: 'Wide Right', date: '1991-01-27', round: 'Super Bowl XXV', w: 'NYG', l: 'BUF', score: '20–19', cat: 'classic',
      desc: 'Scott Norwood\'s 47-yard try sails wide right as time expires.', q: 'Super Bowl XXV Wide Right Scott Norwood' },
    { title: 'The Comeback', date: '1993-01-03', round: 'AFC Wild Card', w: 'BUF', l: 'HOU', art: { HOU: ['TEN', 'HOU'] }, score: '41–38 (OT)', cat: 'classic',
      desc: 'Down 35–3 to the Oilers, backup QB Frank Reich leads the Bills to the biggest comeback in NFL history at the time.', q: 'The Comeback Bills Oilers 1993 Frank Reich' },
    { title: 'The Helicopter', date: '1998-01-25', round: 'Super Bowl XXXII', w: 'DEN', l: 'GB', score: '31–24', cat: 'classic',
      desc: 'John Elway\'s spinning dive for a first down sparks the Broncos to their first title.', q: 'John Elway helicopter Super Bowl XXXII' },

    // ---------- 1999 on: each is checked against the site's game data ----------
    { title: 'Music City Miracle', season: 1999, type: 1, w: 'TEN', l: 'BUF', cat: 'playoffs',
      desc: 'Down with 16 seconds left, the Titans\' kickoff return lateral from Frank Wycheck to Kevin Dyson goes 75 yards for the win.', q: 'Music City Miracle Titans Bills' },
    { title: 'One Yard Short', season: 1999, type: 4, w: 'STL', l: 'TEN', cat: 'superbowl',
      desc: 'Mike Jones tackles Kevin Dyson a yard from the end zone on the final play to save the Rams\' title.', q: 'Super Bowl XXXIV Mike Jones tackle Kevin Dyson one yard short' },
    { title: 'The Tuck Rule Game', season: 2001, type: 2, w: 'NE', l: 'OAK', cat: 'playoffs',
      desc: 'An apparent Tom Brady fumble in the snow is ruled an incomplete pass; Adam Vinatieri forces overtime and wins it.', q: 'Tuck Rule game Patriots Raiders snow' },
    { title: 'Vinatieri Wins It', season: 2001, type: 4, w: 'NE', l: 'STL', cat: 'superbowl',
      desc: 'Huge underdogs, the Patriots upset the "Greatest Show on Turf" on a last-second 48-yard field goal. Brady\'s first title.', q: 'Super Bowl XXXVI Vinatieri game winning field goal Patriots Rams' },
    { title: 'The Helmet Catch', season: 2007, type: 4, w: 'NYG', l: 'NE', cat: 'superbowl',
      desc: 'Eli Manning escapes a sack and David Tyree pins the ball to his helmet; the Giants end New England\'s bid for 19–0.', q: 'David Tyree helmet catch Super Bowl XLII' },
    { title: 'Adrian Peterson Runs for 296', season: 2007, week: 9, w: 'MIN', l: 'SD', cat: 'records', stat: { p: 'Adrian Peterson', k: 'ryd', v: 296 },
      desc: 'As a rookie, Adrian Peterson sets the NFL single-game rushing record against the Chargers.', q: 'Adrian Peterson 296 yards record Chargers 2007' },
    { title: 'Holmes Tiptoes, Harrison Rumbles', season: 2008, type: 4, w: 'PIT', l: 'ARI', cat: 'superbowl',
      desc: 'James Harrison\'s 100-yard interception return before halftime, then Santonio Holmes\' toe-tap touchdown with 35 seconds left.', q: 'Super Bowl XLIII Santonio Holmes catch James Harrison interception return' },
    { title: 'The Ambush', season: 2009, type: 4, w: 'NO', l: 'IND', cat: 'superbowl',
      desc: 'The Saints open the second half with a surprise onside kick, and Tracy Porter\'s pick-six seals New Orleans\' first title.', q: 'Super Bowl XLIV Saints onside kick Tracy Porter interception' },
    { title: 'Beast Quake', season: 2010, type: 1, w: 'SEA', l: 'NO', cat: 'playoffs',
      desc: 'Marshawn Lynch breaks nine tackles on a 67-yard touchdown run so loud it registers on a seismograph.', q: 'Marshawn Lynch Beast Quake run Saints' },
    { title: 'Tebow to Thomas in Overtime', season: 2011, type: 1, w: 'DEN', l: 'PIT', cat: 'playoffs',
      desc: 'On the first play of overtime, Tim Tebow hits Demaryius Thomas for an 80-yard touchdown.', q: 'Tebow Demaryius Thomas overtime touchdown Steelers' },
    { title: 'Mile High Miracle', season: 2012, type: 2, w: 'BAL', l: 'DEN', cat: 'playoffs',
      desc: 'Joe Flacco\'s 70-yard bomb to Jacoby Jones ties it with 31 seconds left; the Ravens win in double overtime on the way to a title.', q: 'Mile High Miracle Flacco Jacoby Jones' },
    { title: 'The Butt Fumble', season: 2012, week: 12, w: 'NE', l: 'NYJ', cat: 'regular',
      desc: 'Mark Sanchez runs into his own lineman\'s backside and fumbles on Thanksgiving night. The Patriots score three touchdowns in 52 seconds.', q: 'Butt Fumble Mark Sanchez Thanksgiving' },
    { title: 'Peyton Breaks the Record', season: 2013, week: 16, w: 'DEN', l: 'HOU', cat: 'records',
      desc: 'Peyton Manning throws his 51st touchdown pass of the season, passing Tom Brady\'s record on the way to 55.', q: 'Peyton Manning 51st touchdown record 2013 Texans' },
    { title: 'Legion of Boom Rolls', season: 2013, type: 4, w: 'SEA', l: 'DEN', cat: 'superbowl',
      desc: 'A safety on the first snap and Seattle\'s defense overwhelms the record-setting Broncos offense.', q: 'Super Bowl XLVIII Seahawks Broncos highlights' },
    { title: 'Odell\'s One-Handed Catch', season: 2014, week: 12, w: 'DAL', l: 'NYG', cat: 'regular',
      desc: 'Odell Beckham Jr. reaches back with three fingers for a touchdown catch that became an instant classic, even in a Giants loss.', q: 'Odell Beckham one handed catch Cowboys 2014' },
    { title: 'Malcolm Butler\'s Interception', season: 2014, type: 4, w: 'NE', l: 'SEA', cat: 'superbowl',
      desc: 'Seattle throws from the 1-yard line and undrafted rookie Malcolm Butler jumps the route to save the Patriots.', q: 'Malcolm Butler interception Super Bowl XLIX' },
    { title: 'Miracle in Motown', season: 2015, week: 13, w: 'GB', l: 'DET', cat: 'regular',
      desc: 'After a facemask penalty gives them an untimed down, Aaron Rodgers throws a 61-yard Hail Mary to Richard Rodgers.', q: 'Aaron Rodgers Hail Mary Lions 2015 Miracle in Motown' },
    { title: '28–3', season: 2016, type: 4, w: 'NE', l: 'ATL', cat: 'superbowl',
      desc: 'Down 28–3 in the third quarter, the Patriots pull off the biggest comeback in Super Bowl history and win the first overtime Super Bowl.', q: 'Patriots 28-3 comeback Super Bowl LI Falcons' },
    { title: 'Minneapolis Miracle', season: 2017, type: 2, w: 'MIN', l: 'NO', cat: 'playoffs',
      desc: 'Case Keenum to Stefon Diggs, 61 yards for the winning touchdown as time expires.', q: 'Minneapolis Miracle Stefon Diggs Saints' },
    { title: 'Philly Special', season: 2017, type: 4, w: 'PHI', l: 'NE', cat: 'superbowl',
      desc: 'Backup QB Nick Foles catches a trick-play touchdown on fourth down, and the Eagles win their first Super Bowl.', q: 'Philly Special Nick Foles Super Bowl LII' },
    { title: 'Monday Night Shootout', season: 2018, week: 11, w: 'LA', l: 'KC', cat: 'regular',
      desc: 'Rams 54, Chiefs 51: the first game with both teams scoring 50, between Jared Goff and a young Patrick Mahomes.', q: 'Rams Chiefs 54-51 Monday Night Football 2018' },
    { title: 'Mahomes\' First Ring', season: 2019, type: 4, w: 'KC', l: 'SF', cat: 'superbowl',
      desc: 'Down 10 in the fourth quarter, "Jet Chip Wasp" to Tyreek Hill sparks 21 straight points for the Chiefs\' first title in 50 years.', q: 'Super Bowl LIV Chiefs comeback Jet Chip Wasp Tyreek Hill' },
    { title: 'Hail Murray', season: 2020, week: 10, w: 'ARI', l: 'BUF', cat: 'regular',
      desc: 'Kyler Murray scrambles and heaves it to DeAndre Hopkins, who catches it in triple coverage with 1 second left.', q: 'Hail Murray DeAndre Hopkins catch Bills' },
    { title: 'Brady\'s Seventh', season: 2020, type: 4, w: 'TB', l: 'KC', cat: 'superbowl',
      desc: 'In his first season in Tampa, Tom Brady wins a seventh Super Bowl, the first team to win one in its home stadium.', q: 'Super Bowl LV Buccaneers Chiefs Tom Brady highlights' },
    { title: 'Tucker From 66', season: 2021, week: 3, w: 'BAL', l: 'DET', cat: 'records',
      desc: 'Justin Tucker\'s 66-yard field goal bounces off the crossbar and in as time expires, then the longest in NFL history.', q: 'Justin Tucker 66 yard field goal Lions' },
    { title: '13 Seconds', season: 2021, type: 2, w: 'KC', l: 'BUF', cat: 'playoffs',
      desc: 'Josh Allen puts Buffalo ahead with 13 seconds left; Mahomes needs just two plays to set up the tying kick and wins it in overtime.', q: 'Chiefs Bills 13 seconds divisional 2022' },
    { title: 'Kupp and Donald Finish It', season: 2021, type: 4, w: 'LA', l: 'CIN', cat: 'superbowl',
      desc: 'Cooper Kupp\'s late touchdown and Aaron Donald\'s pressure on the final drive give the Rams a title in their own stadium.', q: 'Super Bowl LVI Rams Bengals Cooper Kupp Aaron Donald highlights' },
    { title: 'The 33-Point Comeback', season: 2022, week: 15, w: 'MIN', l: 'IND', cat: 'records',
      desc: 'Down 33–0 at halftime, the Vikings come all the way back to win in overtime: the biggest comeback in NFL history.', q: 'Vikings 33 point comeback Colts 2022' },
    { title: 'Mahomes on One Ankle', season: 2022, type: 4, w: 'KC', l: 'PHI', cat: 'superbowl',
      desc: 'Playing on a sprained ankle, Patrick Mahomes leads the winning drive in a 38–35 classic against Jalen Hurts.', q: 'Super Bowl LVII Chiefs Eagles highlights' },
    { title: 'Walk-Off in Vegas', season: 2023, type: 4, w: 'KC', l: 'SF', cat: 'superbowl',
      desc: 'Mahomes hits Mecole Hardman in overtime and the Chiefs repeat as champions.', q: 'Super Bowl LVIII Chiefs 49ers overtime Mecole Hardman' },
    { title: 'Eagles Stop the Three-Peat', season: 2024, type: 4, w: 'PHI', l: 'KC', cat: 'superbowl',
      desc: 'Philadelphia\'s defense dominates and Jalen Hurts is MVP as the Eagles deny Kansas City a third straight title.', q: 'Super Bowl LIX Eagles Chiefs highlights' }
  ];
  var CATS = [['all', 'All moments'], ['superbowl', 'Super Bowls'], ['playoffs', 'Playoffs'], ['regular', 'Regular season'], ['records', 'Records'], ['classic', 'Classics before 1999'], ['upsets', 'Biggest upsets'], ['shootouts', 'Highest scoring']];

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
  function roman(n) { var r = '', m = [[50, 'L'], [40, 'XL'], [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']]; m.forEach(function (x) { while (n >= x[0]) { r += x[1]; n -= x[0]; } }); return r; }
  function teamName(code, season) {
    if (NG && season) return NG.teamName(code, season);
    var OLD = { BAL: 'Baltimore Colts', HOU: 'Houston Oilers', OAK: 'Oakland Raiders', WAS: 'Washington', STL: 'St. Louis Rams' };
    if (OLD[code]) return OLD[code];
    var t = T && T.byAbbr.get(code);
    return t != null ? T.teams[t][1] : code;
  }

  // link each moment from 1999 on to its game in the site's data, and take the score from there
  var resolved = null;
  function resolve() {
    if (resolved) return resolved;
    resolved = MOMENTS.map(function (m) {
      var o = Object.assign({}, m);
      if (m.season && NG) {
        var q = { season: m.season, teams: [m.w, m.l], played: true };
        if (m.type) q.type = m.type; else q.week = m.week;
        var g = NG.find(q)[0];
        if (g) {
          o.game = g;
          var ws = NG.fr(g.home) === NG.fr(m.w) ? g.hs : g.as, ls = NG.fr(g.home) === NG.fr(m.w) ? g.as : g.hs;
          o.score = ws + '–' + ls + (g.ot ? ' (OT)' : '');
          o.date = g.date;
          o.round = g.type === 4 ? 'Super Bowl ' + roman(g.season - 1965) : g.type ? roundLabel(g) : 'Week ' + g.week + ', ' + g.season;
          o.ok = NG.fr(NG.winner(g)) === NG.fr(m.w);
        }
      }
      return o;
    });
    return resolved;
  }
  function roundLabel(g) {
    var t = T && T.byAbbr.get(NG.fr(g.home)), conf = t != null ? T.teams[t][2] + ' ' : '';
    return conf + (g.type === 3 ? 'Championship' : NG.roundName(g));
  }
  function dateText(iso) {
    var d = new Date(iso + 'T12:00:00Z');
    return isNaN(d) ? iso : d.toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
  }
  function helmet(code, m, left) {
    var span = h('span', { class: 'mo-h', 'aria-hidden': 'true' });
    var a = m.art && m.art[code];
    if (window.Art) span.innerHTML = window.Art.helmet(a ? a[0] : code, { label: a ? a[1] : code, left: left });
    return span;
  }

  // ---------------------------------------------------------------- lists from the data
  function gameMoment(g, kind) {
    var w = NG.winner(g), l = w === g.home ? g.away : g.home;
    var ws = Math.max(g.as, g.hs), ls = Math.min(g.as, g.hs);
    var title, desc;
    if (kind === 'upset') {
      title = 'The ' + teamName(w, g.season).split(' ').slice(-1)[0] + ' stun the ' + teamName(l, g.season).split(' ').slice(-1)[0];
      desc = 'The ' + teamName(w, g.season) + ' won as ' + Math.abs(g.spread) + '-point underdogs' + (g.aml != null ? ' (moneyline ' + NG.ml(w === g.home ? g.hml : g.aml) + ')' : '') + '.';
    } else {
      title = (g.as + g.hs) + ' points';
      desc = 'The ' + teamName(w, g.season) + ' outlasted the ' + teamName(l, g.season) + (g.ot ? ' in overtime' : '') + '; the over/under was ' + (g.total != null ? g.total : 'not listed') + '.';
    }
    return { title: title, w: w, l: l, season: g.season, game: g, score: ws + '–' + ls + (g.ot ? ' (OT)' : ''), date: g.date,
      round: g.type === 4 ? 'Super Bowl ' + roman(g.season - 1965) : g.type ? roundLabel(g) : 'Week ' + g.week + ', ' + g.season,
      desc: desc, q: g.season + ' ' + teamName(g.away, g.season) + ' vs ' + teamName(g.home, g.season) + ' highlights', cat: kind === 'upset' ? 'upsets' : 'shootouts' };
  }
  function upsets() {
    return NG.games.filter(function (g) { var w = NG.winner(g); return g.played && g.spread && w !== 'TIE' && w !== (g.spread > 0 ? g.home : g.away); })
      .sort(function (a, b) { return Math.abs(b.spread) - Math.abs(a.spread); }).slice(0, 15).map(function (g) { return gameMoment(g, 'upset'); });
  }
  function shootouts() {
    return NG.games.filter(function (g) { return g.played; }).sort(function (a, b) { return (b.as + b.hs) - (a.as + a.hs); }).slice(0, 15).map(function (g) { return gameMoment(g, 'shootout'); });
  }

  // ---------------------------------------------------------------- UI
  var KEY = 'nflcompare.moments';
  var M = { cat: 'all', q: '', order: 'new' };
  try { var sv = JSON.parse(localStorage.getItem(KEY) || 'null'); if (sv) M = Object.assign(M, sv, { q: '' }); } catch (e) { /* storage unavailable */ }
  function save() { try { localStorage.setItem(KEY, JSON.stringify({ cat: M.cat, order: M.order })); } catch (e) { /* storage unavailable */ } }
  var host;

  function card(m) {
    var seasonForName = m.season || null;
    var yt = h('a', { class: 'mo-yt', href: YT + encodeURIComponent(m.q), target: '_blank', rel: 'noopener', 'aria-label': 'Watch ' + m.title + ' on YouTube (opens a new tab)' },
      h('span', { class: 'mo-play', 'aria-hidden': 'true' }), 'Watch on YouTube');
    return h('article', { class: 'mo-card mo-' + m.cat },
      h('div', { class: 'mo-meta' }, h('span', { class: 'mo-tag', text: (CATS.filter(function (c) { return c[0] === m.cat; })[0] || ['', ''])[1] }), h('span', { text: (m.round ? m.round + ' · ' : '') + dateText(m.date) })),
      h('h3', { class: 'mo-title', text: m.title }),
      h('div', { class: 'mo-match' },
        helmet(m.w, m), h('b', { text: teamName(m.w, seasonForName).split(' ').slice(-1)[0] }),
        h('span', { class: 'mo-score', text: m.score }),
        h('span', { text: teamName(m.l, seasonForName).split(' ').slice(-1)[0] }), helmet(m.l, m, true)),
      h('p', { class: 'mo-desc', text: m.desc }),
      h('div', { class: 'mo-acts' }, yt,
        m.game && window.NFLApp ? h('button', { type: 'button', class: 'chip', text: 'Box score', onclick: function () { window.NFLApp.showGame(m.game.id); } }) : null));
  }
  function render() {
    if (!host) return;
    var list;
    if (M.cat === 'upsets') list = upsets();
    else if (M.cat === 'shootouts') list = shootouts();
    else list = resolve().filter(function (m) { return M.cat === 'all' || m.cat === M.cat; });
    if (M.cat !== 'upsets' && M.cat !== 'shootouts') list = list.slice().sort(function (a, b) { return M.order === 'new' ? b.date.localeCompare(a.date) : a.date.localeCompare(b.date); });
    var q = M.q.trim().toLowerCase();
    if (q) list = list.filter(function (m) { return (m.title + ' ' + m.desc + ' ' + teamName(m.w, m.season) + ' ' + teamName(m.l, m.season) + ' ' + (m.round || '') + ' ' + m.date.slice(0, 4)).toLowerCase().indexOf(q) >= 0; });
    var search = h('input', { type: 'search', class: 'mo-search', placeholder: 'Search moments: team, player or year', 'aria-label': 'Search moments', value: M.q,
      oninput: function (e) { M.q = e.target.value; var pos = e.target.selectionStart; render(); var s = host.querySelector('.mo-search'); s.focus(); s.setSelectionRange(pos, pos); } });
    host.replaceChildren(
      h('section', { class: 'mo-head' },
        h('div', null, h('h2', { text: 'Greatest moments' }), h('p', { text: 'The plays, games and records fans never forget. Tap Watch on YouTube to see the highlights.' })),
        h('div', { class: 'chips' }, CATS.map(function (c) { return h('button', { type: 'button', class: 'chip', 'aria-pressed': String(M.cat === c[0]), text: c[1], onclick: function () { M.cat = c[0]; save(); render(); } }); })),
        h('div', { class: 'mo-tools' }, search,
          M.cat === 'upsets' || M.cat === 'shootouts' ? h('span', { class: 'gstat', text: M.cat === 'upsets' ? 'Biggest point-spread upsets since 1999, from the game data' : 'Most combined points since 1999, from the game data' })
            : h('div', { class: 'seg', role: 'group', 'aria-label': 'Order' }, [['new', 'Newest first'], ['old', 'Oldest first']].map(function (o) { return h('button', { type: 'button', 'aria-pressed': String(M.order === o[0]), text: o[1], onclick: function () { M.order = o[0]; save(); render(); } }); })))),
      list.length ? h('div', { class: 'mo-grid' }, list.map(card)) : h('p', { class: 'empty', text: 'No moments match that search.' }),
      h('p', { class: 'note', text: 'Video links open a YouTube search for each moment, so they keep working even when individual uploads are removed. The official NFL channel\'s highlight is usually the first result.' }));
  }
  function mount(el) { host = el; render(); }

  window.NFLMoments = { mount: mount, moments: MOMENTS, resolve: resolve, upsets: upsets, shootouts: shootouts };
})();
