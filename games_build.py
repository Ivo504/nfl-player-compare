import sys, os, json, polars as pl

# Game pages: every game since 1999 with scores and betting lines (games.js), plus one file per
# season with player box scores and injury reports (games/<season>.js), loaded on demand.
# Usage: python games_build.py work/data work/enrich _site
data_dir, enrich_dir, build_dir = sys.argv[1], sys.argv[2], sys.argv[3]
os.makedirs(build_dir + "/games", exist_ok=True)
GT = {"REG": 0, "WC": 1, "DIV": 2, "CON": 3, "SB": 4}

t = open(build_dir + "/data.js").read()
D = json.loads(t[len("window.NFL="):-1])
pidx = {p[0]: i for i, p in enumerate(D["players"])}

sch = pl.read_csv(enrich_dir + "/schedules.csv", infer_schema_length=20000, null_values=["NA", ""]).filter(pl.col("season") >= 1999).sort(["season", "week", "gameday", "gametime"])
names, nidx = [], {}
def nm(s):
    if s is None: return -1
    if s not in nidx: nidx[s] = len(names); names.append(s)
    return nidx[s]
def num(v):
    if v is None: return None
    return int(v) if float(v).is_integer() else float(v)

games, gid_ix = [], {}
for r in sch.iter_rows(named=True):
    gid_ix[r["game_id"]] = len(games)
    games.append([r["game_id"], r["season"], r["week"], GT.get(r["game_type"], 0), r["gameday"], r["gametime"],
                  r["away_team"], r["home_team"], num(r["away_score"]), num(r["home_score"]), int(r["overtime"] or 0),
                  num(r["spread_line"]), num(r["away_moneyline"]), num(r["home_moneyline"]), num(r["total_line"]),
                  r["roof"], nm(r["stadium"]), num(r["temp"]), num(r["wind"]),
                  nm(r["away_qb_name"]), nm(r["home_qb_name"]), nm(r["away_coach"]), nm(r["home_coach"]), int(r["div_game"] or 0)])
FIELDS = ["id", "season", "week", "type", "date", "time", "away", "home", "as", "hs", "ot", "spread", "aml", "hml", "total",
          "roof", "stadium", "temp", "wind", "aqb", "hqb", "acoach", "hcoach", "div"]
with open(build_dir + "/games.js", "w") as f:
    f.write("window.NFL_GAMES=" + json.dumps({"fields": FIELDS, "names": names, "games": games}, separators=(",", ":")) + ";")
print("games", len(games), "names", len(names))

# player box scores
BOX = [("completions", "cmp"), ("attempts", "att"), ("passing_yards", "pyd"), ("passing_tds", "ptd"), ("passing_interceptions", "int"), ("sacks_suffered", "sck"),
       ("carries", "car"), ("rushing_yards", "ryd"), ("rushing_tds", "rtd"),
       ("receptions", "rec"), ("targets", "tgt"), ("receiving_yards", "cyd"), ("receiving_tds", "ctd"),
       ("tkl", "tkl"), ("def_sacks", "dsk"), ("def_interceptions", "dint"), ("def_fumbles_forced", "ff"),
       ("fg_made", "fgm"), ("fg_att", "fga"), ("pat_made", "xpm"), ("pat_att", "xpa"), ("fuml", "fuml")]
wk = pl.read_csv(data_dir + "/weekly.csv", infer_schema_length=100000, null_values=["NA", ""]).filter(pl.col("season") >= 1999)
raw = [c for c, _ in BOX if c not in ("tkl", "fuml")] + ["def_tackles_solo", "def_tackle_assists", "sack_fumbles_lost", "rushing_fumbles_lost", "receiving_fumbles_lost"]
wk = wk.with_columns([pl.col(c).cast(pl.Float64).fill_null(0) for c in raw])
wk = wk.with_columns((pl.col("def_tackles_solo") + pl.col("def_tackle_assists")).alias("tkl"),
                     (pl.col("sack_fumbles_lost") + pl.col("rushing_fumbles_lost") + pl.col("receiving_fumbles_lost")).alias("fuml"))
FRANCHISE = {"OAK": "LV", "SD": "LAC", "STL": "LA"}
def same(a, b): return a == b or FRANCHISE.get(a, a) == FRANCHISE.get(b, b)

inj = pl.read_csv(enrich_dir + "/injuries.csv", infer_schema_length=100000, null_values=["NA", ""]) if os.path.exists(enrich_dir + "/injuries.csv") else None
total = 0
seasons = sorted(set(sch["season"].unique().to_list()))
for season in seasons:
    box = {}
    for r in wk.filter(pl.col("season") == season).iter_rows(named=True):
        gi = gid_ix.get(r["game_id"])
        if gi is None or r["player_id"] not in pidx: continue
        g = games[gi]
        side = 1 if same(r["team"], g[7]) else 0
        vals = [num(r[c]) or 0 for c, _ in BOX]
        while vals and vals[-1] == 0: vals.pop()
        if not vals: continue
        box.setdefault(g[0], []).append([pidx[r["player_id"]], side] + vals)
    injd = {}
    if inj is not None:
        rows = inj.filter((pl.col("season") == season) & (pl.col("report_status").is_not_null() | pl.col("practice_primary_injury").is_not_null() | pl.col("report_primary_injury").is_not_null()))
        for r in rows.iter_rows(named=True):
            status = r["report_status"]
            if status == "Note": continue
            injury = r["report_primary_injury"] or r["practice_primary_injury"] or ""
            if not status:
                # on the report without a game status: the player practiced and was expected to play
                ps = (r["practice_status"] or "").lower()
                status = "Limited practice" if "limited" in ps else "Did not practice" if "did not" in ps else "Full practice" if "full" in ps else "Listed"
            if "not injury related" in injury.lower(): injury = "Not injury related"
            key = "%s|%d" % (r["team"], int(r["week"]))
            injd.setdefault(key, []).append([r["full_name"], pidx.get(r["gsis_id"], -1), r["position"], injury, status,
                                              r["report_secondary_injury"] or r["practice_secondary_injury"] or ""])
    blob = {"box": box, "inj": injd, "boxf": [k for _, k in BOX]}
    with open(build_dir + "/games/%d.js" % season, "w") as f:
        f.write("(window.NFL_G=window.NFL_G||{})[%d]=" % season + json.dumps(blob, separators=(",", ":")) + ";")
    total += sum(len(v) for v in box.values())
    print(season, "games with box scores", len(box), "player lines", sum(len(v) for v in box.values()), "injury entries", sum(len(v) for v in injd.values()))

# sanity: a famous game
g = [x for x in games if x[1] == 2022 and x[3] == 4][0]
print("SB LVII:", g[6], g[8], "@", g[7], g[9], "spread", g[11], "total", g[14], "ML", g[12], g[13])
