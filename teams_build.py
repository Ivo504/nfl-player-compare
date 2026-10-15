import sys, json, polars as pl

# Team pages: one row per franchise/season/season_type, 2000 onward.
# Usage: python teams_build.py work/enrich _site
enrich_dir, build_dir = sys.argv[1], sys.argv[2]
FIRST = 2000
# schedules use the abbreviation of the season; team stats use today's franchise codes
FRANCHISE = {"OAK": "LV", "SD": "LAC", "STL": "LA"}

tw = pl.read_csv(enrich_dir + "/team_week.csv", infer_schema_length=100000, null_values=["NA", ""]).filter(pl.col("season") >= FIRST)

# (source column, short key): the team's own numbers, summed
OWN = [
 ("completions","cmp"),("attempts","att"),("passing_yards","pyd"),("passing_tds","ptd"),("passing_interceptions","int"),
 ("sacks_suffered","sck"),("sack_yards_lost","sckyd"),("passing_first_downs","pfd"),("passing_epa","pepa"),
 ("carries","car"),("rushing_yards","ryd"),("rushing_tds","rtd"),("rushing_first_downs","rfd"),("rushing_epa","repa"),
 ("def_sacks","dsk"),("def_qb_hits","qbh"),("def_tackles_for_loss","tfl"),("def_interceptions","dint"),("def_pass_defended","pd"),
 ("def_fumbles_forced","ff"),("fumble_recovery_opp","fr"),("def_tds","dtd"),("def_safeties","saf"),
 ("fg_made","fgm"),("fg_att","fga"),("fg50","fg50"),("pat_made","xpm"),("pat_att","xpa"),
 ("pt_att","pnt"),("pt_yards","pntyd"),("pt_net_yards","pntnet"),("pt_inside_20","pnt20"),
 ("punt_returns","pr"),("punt_return_yards","pryd"),("kickoff_returns","kr"),("kickoff_return_yards","kryd"),("special_teams_tds","sttd"),
 ("penalties","pen"),("penalty_yards","peny"),("fuml","fuml"),
]
# the opponent's offense in the same game = what this team allowed
ALLOWED = [("cmp","acmp"),("att","aatt"),("pyd","apyd"),("ptd","aptd"),("sckyd","asckyd"),("sck","asck"),
           ("car","acar"),("ryd","aryd"),("rtd","artd"),("pfd","apfd"),("rfd","arfd"),("pepa","apepa"),("repa","arepa")]

num = [c for c, _ in OWN if c not in ("fg50", "fuml")] + ["fg_made_50_59", "fg_made_60_", "sack_fumbles_lost", "rushing_fumbles_lost", "receiving_fumbles_lost"]
tw = tw.with_columns([pl.col(c).cast(pl.Float64).fill_null(0) for c in num])
tw = tw.with_columns(pl.col("sack_yards_lost").abs())  # stored as negative numbers
tw = tw.with_columns(
    (pl.col("fg_made_50_59") + pl.col("fg_made_60_")).alias("fg50"),
    (pl.col("sack_fumbles_lost") + pl.col("rushing_fumbles_lost") + pl.col("receiving_fumbles_lost")).alias("fuml"),
)
g = tw.select(["game_id", "season", "season_type", "team", "opponent_team"] + [pl.col(c).alias(k) for c, k in OWN])
opp = g.select(["game_id", pl.col("team").alias("opponent_team")] + [pl.col(c).alias(k) for c, k in ALLOWED])
g = g.join(opp, on=["game_id", "opponent_team"], how="left").fill_null(0)

# results and points from schedules
sch = pl.read_csv(enrich_dir + "/schedules.csv", infer_schema_length=20000, null_values=["NA", ""])
sch = sch.filter((pl.col("season") >= FIRST) & pl.col("home_score").is_not_null())
res = []
for r in sch.iter_rows(named=True):
    for side, other in (("home", "away"), ("away", "home")):
        pf, pa = r[side + "_score"], r[other + "_score"]
        res.append({"game_id": r["game_id"], "abbr": r[side + "_team"], "team": FRANCHISE.get(r[side + "_team"], r[side + "_team"]),
                    "gt": r["game_type"], "pf": pf, "pa": pa, "w": int(pf > pa), "l": int(pf < pa), "t": int(pf == pa)})
res = pl.DataFrame(res)
g = res.join(g, on=["game_id", "team"], how="left")
g = g.with_columns(pl.col("season").fill_null(pl.col("game_id").str.slice(0, 4).cast(pl.Int64)),
                   pl.when(pl.col("gt") == "REG").then(pl.lit("REG")).otherwise(pl.lit("POST")).alias("season_type")).fill_null(0)

keys = ["w", "l", "t", "pf", "pa"] + [k for _, k in OWN] + [k for _, k in ALLOWED]
agg = g.group_by(["team", "season", "season_type"]).agg(
    [pl.col(k).sum() for k in keys] + [pl.col("game_id").n_unique().alias("g"), pl.col("abbr").unique().alias("abbrs")])

# team list: the 32 current franchises
tm = pl.read_csv(enrich_dir + "/teams.csv", infer_schema_length=1000, null_values=["NA", ""])
cur = sorted(agg["team"].unique().to_list())
info = {r["team_abbr"]: r for r in tm.iter_rows(named=True)}
teams = []
for ab in cur:
    r = info[ab]
    teams.append([ab, r["team_name"], r["team_conf"], r["team_division"], r["team_color"], r["team_color2"] or r["team_color"]])
tidx = {t[0]: i for i, t in enumerate(teams)}

def cell(v):
    if isinstance(v, float):
        return int(v) if v.is_integer() else round(v, 2)
    return v

rows = []
for r in agg.sort(["team", "season", "season_type"]).iter_rows(named=True):
    rows.append([tidx[r["team"]], r["season"], 1 if r["season_type"] == "POST" else 0, "/".join(sorted(r["abbrs"])), r["g"]] + [cell(r[k]) for k in keys])

# postseason results per season: [season, playoff wins, playoff losses, Super Bowl (0 none, 1 lost, 2 won)]
post = {}
pg = g.filter(pl.col("season_type") == "POST").group_by(["team", "season"]).agg(
    pl.col("w").sum(), pl.col("l").sum(),
    ((pl.col("gt") == "SB") & (pl.col("w") == 1)).any().alias("sbw"), (pl.col("gt") == "SB").any().alias("sba"))
for r in pg.sort(["team", "season"]).iter_rows(named=True):
    post.setdefault(tidx[r["team"]], []).append([r["season"], r["w"], r["l"], 2 if r["sbw"] else 1 if r["sba"] else 0])

blob = {"first": FIRST, "fields": keys, "teams": teams, "rows": rows, "post": post}
with open(build_dir + "/teams.js", "w") as f:
    f.write("window.NFL_T=" + json.dumps(blob, separators=(",", ":")) + ";")
print("teams", len(teams), "rows", len(rows), "fields", len(keys))
# sanity checks against well-known seasons
def show(ab, s):
    r = agg.filter((pl.col("team") == ab) & (pl.col("season") == s) & (pl.col("season_type") == "REG")).row(0, named=True)
    print(ab, s, "W-L-T %d-%d-%d" % (r["w"], r["l"], r["t"]), "PF", r["pf"], "PA", r["pa"], "pass yds", r["pyd"], "rush yds", r["ryd"], "yds allowed", r["apyd"] - r["asckyd"] + r["aryd"])
show("NE", 2007); show("KC", 2023); show("LV", 2002); show("DET", 2008)
print("SB winners:", sorted((p[0], teams[t][0]) for t, ps in post.items() for p in ps if p[3] == 2)[-6:])
