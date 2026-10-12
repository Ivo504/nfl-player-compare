import sys, json, re, polars as pl
sys.path.insert(0, sys.argv[3])
from awards_src import AWARDS, LABELS
data_dir, enrich_dir, scripts_dir, build_dir = sys.argv[1], sys.argv[2], sys.argv[3], sys.argv[4]

t = open(build_dir + "/data.js").read()
D = json.loads(t[len("window.NFL="):-1])
players, rows = D["players"], D["rows"]
seasons_of = {}   # idx -> {season: games(REG)}
for r in rows:
    if r[2] == 0:
        seasons_of.setdefault(r[0], {})[r[1]] = seasons_of.setdefault(r[0], {}).get(r[1], 0) + r[4]
SUFFIX = {"jr", "sr", "ii", "iii", "iv", "v"}
def norm(n):
    toks = [x for x in re.sub(r"[^a-z0-9 ]", "", n.lower().replace(".", "").replace("'", "")).split() if x not in SUFFIX]
    return " ".join(toks)
byname = {}
for i, p in enumerate(players): byname.setdefault(norm(p[1]), []).append(i)
ALIAS = {"cadillac williams": "carnell williams", "shaquille leonard": "darius leonard", "patrick surtain": "pat surtain", "michael vick": "mike vick"}
TEAMHINT = {("oroy", 2007, "Adrian Peterson"): "MIN"}
DEF_POS = {"DE","DT","NT","DL","LB","ILB","OLB","MLB","LDE","RDE","LDT","RDT","LCB","RCB","CB","SS","FS","S","DB","LOLB","ROLB","LILB","RILB","LLB","RLB","SAF"}
def group(pos):
    if pos in ("QB","TE","WR","K","P"): return pos
    if pos in ("RB","FB","HB"): return "RB"
    if pos in DEF_POS: return "DEF"
    return "OL"

aw, unresolved, ambiguous, multi = {}, [], [], []
for code, blob in AWARDS.items():
    for line in blob.split("\n"):
        s, name, pos = line.split("|"); s = int(s); g = group(pos)
        if g == "OL":
            unresolved.append((code, s, name, pos, "offensive line, not in dataset")); continue
        cands = byname.get(norm(name), [])
        c2 = [i for i in cands if s in seasons_of.get(i, {})]
        if not c2: c2 = [i for i in byname.get(ALIAS.get(norm(name), "~"), []) if s in seasons_of.get(i, {})]
        hint = TEAMHINT.get((code, s, name))
        if hint and len(c2) > 1:
            c2 = [i for i in c2 if any(r[0] == i and r[1] == s and hint in r[3].split("/") for r in rows)] or c2
        if len(byname.get(norm(name), [])) > 1: multi.append((code, s, name, [(i, players[i][2], players[i][3]) for i in c2]))
        if len(c2) > 1:
            c3 = [i for i in c2 if players[i][3] == g] or c2
            if len(c3) > 1: ambiguous.append((code, s, name, [(players[i][1], players[i][2], seasons_of[i][s]) for i in c3]))
            c2 = sorted(c3, key=lambda i: -seasons_of[i][s])[:1]
        if not c2: unresolved.append((code, s, name, pos, "no match with stats that season")); continue
        aw.setdefault(c2[0], []).append([s, code])
print("award rows resolved:", sum(len(v) for v in aw.values()), "of", sum(len(b.split("\n")) for b in AWARDS.values()))
print("UNRESOLVED:"); [print("  ", u) for u in unresolved]
print("AMBIGUOUS (picked most games):"); [print("  ", a) for a in ambiguous]
print("SAME-NAME CHECK (award, season, name, chosen idx/pos/group):"); [print("  ", m) for m in multi]

# Super Bowl appearances / wins (a player counts if he has a recorded stat in the game)
sch = pl.read_csv(enrich_dir + "/schedules.csv", infer_schema_length=20000, null_values=["NA", ""]).filter(pl.col("game_type") == "SB")
sb_game, sb_win = {}, {}
for r in sch.iter_rows(named=True):
    sb_game[r["game_id"]] = r["season"]
    sb_win[r["season"]] = r["home_team"] if r["home_score"] > r["away_score"] else r["away_team"]
wk = pl.read_csv(data_dir + "/weekly.csv", columns=["player_id","season","game_id","team"], infer_schema_length=20000, null_values=["NA", ""])
wk = wk.filter(pl.col("game_id").is_in(list(sb_game.keys())))
idx_of = {p[0]: i for i, p in enumerate(players)}
sb = {}
percount = {}
for r in wk.iter_rows(named=True):
    i = idx_of.get(r["player_id"])
    if i is None: continue
    s = r["season"]; tm = "STL" if (s < 2016 and r["team"] == "LA") else r["team"]; won = 1 if tm == sb_win[s] else 0
    sb.setdefault(i, []).append([s, won])
    percount[(s, won)] = percount.get((s, won), 0) + 1
print("SB winners:", {s: sb_win[s] for s in sorted(sb_win)})
bad = [s for s in sorted(sb_win) if percount.get((s, 1), 0) < 10 or percount.get((s, 0), 0) < 10]
print("seasons with <10 tracked players on a side (team-code mismatch?):", bad)
print("players tracked per SB (winner/loser) sample:", [(s, percount.get((s,1),0), percount.get((s,0),0)) for s in (2000, 2012, 2021, 2025)])

# Pro Bowl / All-Pro / Hall of Fame (drafted players only)
pc = pl.read_csv(enrich_dir + "/players.csv", infer_schema_length=30000, null_values=["NA", ""])
pfr_to_gsis = {r["pfr_id"]: r["gsis_id"] for r in pc.select("pfr_id","gsis_id").drop_nulls().iter_rows(named=True)}
dp = pl.read_csv(enrich_dir + "/draft_picks.csv", infer_schema_length=30000, null_values=["NA", ""])
hon = {}
for r in dp.iter_rows(named=True):
    g = r["gsis_id"] or pfr_to_gsis.get(r["pfr_player_id"])
    i = idx_of.get(g)
    if i is None: continue
    hon[i] = [int(r["probowls"] or 0), int(r["allpro"] or 0), 1 if r["hof"] in (True, "true", "TRUE") else 0]
print("players with honors counts:", len(hon), "of", len(players))
und = [players[i][1] for i in range(len(players)) if i not in hon and sum(r[4] for r in []) == 0]
big_missing = sorted([(sum(seasons_of[i].values()), players[i][1], players[i][3]) for i in range(len(players)) if i not in hon and i in seasons_of and sum(seasons_of[i].values()) > 120], reverse=True)[:25]
print("most-games players without Pro Bowl data (undrafted):", big_missing)

# Bio + profile links
bio = {}
for r in pc.iter_rows(named=True):
    i = idx_of.get(r["gsis_id"])
    if i is None: continue
    h = r["height"]
    bio[i] = [str(int(r["espn_id"])) if r["espn_id"] not in (None, "") else "", r["pfr_id"] or "", r["college_name"] or "",
              int(r["draft_year"]) if r["draft_year"] not in (None, "") else 0, int(r["draft_round"]) if r["draft_round"] not in (None, "") else 0,
              int(r["draft_pick"]) if r["draft_pick"] not in (None, "") else 0, r["draft_team"] or "",
              int(round(float(h))) if h not in (None, "") else 0, int(round(float(r["weight"]))) if r["weight"] not in (None, "") else 0]
print("bio:", len(bio), "with espn id:", sum(1 for b in bio.values() if b[0]), "with pfr id:", sum(1 for b in bio.values() if b[1]))

# QB starter records: starting QB per game from nflverse schedules. rec[idx] = [[season, st(0 reg/1 post), W, L, T]]
sch_all = pl.read_csv(enrich_dir + "/schedules.csv", infer_schema_length=20000, null_values=["NA", ""]).filter(
    (pl.col("season") >= 1999) & pl.col("home_score").is_not_null() & pl.col("away_score").is_not_null())
recd = {}
for r in sch_all.iter_rows(named=True):
    st = 0 if r["game_type"] == "REG" else 1
    for side, other in (("home", "away"), ("away", "home")):
        q = r[side + "_qb_id"]
        i = idx_of.get(q)
        if i is None: continue
        a, b = r[side + "_score"], r[other + "_score"]
        e = recd.setdefault((i, r["season"], st), [0, 0, 0])
        e[0 if a > b else 1 if a < b else 2] += 1
rec = {}
for (i, s_, st), e in recd.items():
    rec.setdefault(i, []).append([s_, st] + e)
print("QBs with starts:", len(rec))

X = {"awards": [[c, l, s] for c, l, s in LABELS],
     "aw": {str(k): sorted(v) for k, v in aw.items()},
     "sb": {str(k): sorted(v) for k, v in sb.items()},
     "hon": {str(k): v for k, v in hon.items()},
     "bio": {str(k): v for k, v in bio.items()},
     "rec": {str(k): sorted(v) for k, v in rec.items()},
     "note": "Awards: Pro Football Reference. Pro Bowl, All-Pro, Hall of Fame: nflverse draft picks (PFR). Super Bowl: nflverse schedules + player game stats."}
open(build_dir + "/extra.js", "w").write("window.NFL_X=" + json.dumps(X, separators=(",", ":")) + ";")
# a few spot checks
def show(name, g):
    for i, p in enumerate(players):
        if p[1] == name and p[3] == g:
            print(name, "| awards", aw.get(i), "| SB", sb.get(i), "| hon", hon.get(i), "| bio", bio.get(i))
for n, g in [("Patrick Mahomes","QB"),("Tom Brady","QB"),("Peyton Manning","QB"),("Aaron Donald","DEF"),("Larry Fitzgerald","WR")]: show(n, g)
