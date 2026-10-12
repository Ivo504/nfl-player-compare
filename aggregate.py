import sys, json, polars as pl

src, out = sys.argv[1], sys.argv[2]
df = pl.read_csv(src + "/weekly.csv", infer_schema_length=100000, null_values=["NA", ""])

# (source column, short key) -- summed per player/season/season_type
SUM = [
 ("completions","cmp"),("attempts","att"),("passing_yards","pyd"),("passing_tds","ptd"),("passing_interceptions","int"),
 ("sacks_suffered","sck"),("sack_yards_lost","sckyd"),("passing_first_downs","pfd"),("passing_epa","pepa"),("passing_2pt_conversions","p2pt"),
 ("carries","car"),("rushing_yards","ryd"),("rushing_tds","rtd"),("rushing_first_downs","rfd"),("rushing_epa","repa"),("rushing_2pt_conversions","r2pt"),
 ("targets","tgt"),("receptions","rec"),("receiving_yards","cyd"),("receiving_tds","ctd"),("receiving_first_downs","cfd"),
 ("receiving_yards_after_catch","yac"),("receiving_air_yards","air"),("receiving_epa","cepa"),("receiving_2pt_conversions","c2pt"),
 ("def_tackles_solo","tks"),("def_tackle_assists","tka"),("def_tackles_for_loss","tfl"),("def_sacks","dsk"),("def_qb_hits","qbh"),
 ("def_interceptions","dint"),("def_interception_yards","dintyd"),("def_pass_defended","pd"),("def_fumbles_forced","ff"),
 ("fumble_recovery_opp","fr"),("def_tds","dtd"),("def_safeties","saf"),
 ("fg_made","fgm"),("fg_att","fga"),("fg50","fg50"),("pat_made","xpm"),("pat_att","xpa"),
 ("pt_att","pnt"),("pt_yards","pntyd"),("pt_inside_20","pnt20"),("pt_touchback","pnttb"),
 ("punt_returns","pr"),("punt_return_yards","pryd"),("kickoff_returns","kr"),("kickoff_return_yards","kryd"),("special_teams_tds","sttd"),
 ("fuml","fuml"),("fantasy_points","fp"),("fantasy_points_ppr","fpp"),
]
MAX = [("fg_long","fgl"),("pt_long","pntl")]

raw_needed = [c for c,_ in SUM if c not in ("fg50","fuml")] + [c for c,_ in MAX] + ["fg_made_50_59","fg_made_60_","sack_fumbles_lost","rushing_fumbles_lost","receiving_fumbles_lost"]
df = df.with_columns([pl.col(c).cast(pl.Float64).fill_null(0) for c in set(raw_needed)])
df = df.with_columns(
    (pl.col("fg_made_50_59")+pl.col("fg_made_60_")).alias("fg50"),
    (pl.col("sack_fumbles_lost")+pl.col("rushing_fumbles_lost")+pl.col("receiving_fumbles_lost")).alias("fuml"),
)

# players whose careers began before 2000 (appear in 1999 data)
# career began before the first season of data (1999): rookie season < 1999 per nflverse players table
_pl = pl.read_csv(src + "/../enrich/players.csv", infer_schema_length=100000, null_values=["NA", ""])
pre = set(_pl.filter(pl.col("rookie_season") < 1999)["gsis_id"].to_list())
df = df.filter(pl.col("season")>=1999).sort(["season","week"])
# 1999 rows label the Rams "LA"; the franchise was STL until 2016
df = df.with_columns(pl.when((pl.col("season")<2016)&(pl.col("team")=="LA")).then(pl.lit("STL")).otherwise(pl.col("team")).alias("team"))

aggs = [pl.col(c).sum().alias(k) for c,k in SUM] + [pl.col(c).max().alias(k) for c,k in MAX]
aggs += [pl.col("game_id").n_unique().alias("g"), pl.col("team").unique(maintain_order=True).alias("teams")]
g = df.group_by(["player_id","season","season_type"], maintain_order=True).agg(aggs)
keys = [k for _,k in SUM] + [k for _,k in MAX]
g = g.filter(pl.sum_horizontal([pl.col(k).abs() for k in keys]) > 0)

pos = (df.filter(pl.col("position").is_not_null()).group_by(["player_id","position"]).len()
         .sort(["player_id","len"], descending=[False,True]).group_by("player_id", maintain_order=True).first()
         .select("player_id","position"))
names = df.group_by("player_id").agg(pl.col("player_display_name").last().alias("name"))
pl_tbl = (g.group_by("player_id").agg(pl.col("season").min().alias("s0"), pl.col("season").max().alias("s1"), pl.col("teams").last().alias("lt"))
            .join(pos, on="player_id", how="left").join(names, on="player_id", how="left").sort("name"))

GROUP = {"QB":"QB","RB":"RB","FB":"RB","HB":"RB","WR":"WR","TE":"TE","K":"K","P":"P",
         "DE":"DEF","DT":"DEF","NT":"DEF","DL":"DEF","LB":"DEF","ILB":"DEF","MLB":"DEF","OLB":"DEF","CB":"DEF","DB":"DEF","S":"DEF","SS":"DEF","FS":"DEF","SAF":"DEF"}
pidx, players = {}, []
for r in pl_tbl.iter_rows(named=True):
    p = r["position"] or "?"
    if GROUP.get(p, "OTH") == "OTH": continue
    pidx[r["player_id"]] = len(players)
    players.append([r["player_id"], r["name"] or "?", p, GROUP.get(p, "OTH"), r["s0"], r["s1"], (r["lt"] or ["?"])[-1], 1 if r["player_id"] in pre else 0])

def cell(v):
    if v is None: return 0
    if isinstance(v, float):
        return int(v) if v.is_integer() else round(v, 2)
    return v

rows = []
for r in g.sort(["player_id","season","season_type"]).iter_rows(named=True):
    if r["player_id"] not in pidx: continue
    rows.append([pidx[r["player_id"]], r["season"], 1 if r["season_type"]=="POST" else 0, "/".join(t for t in r["teams"] if t), r["g"]] + [cell(r[k]) for k in keys])

meta = {"through": "%d Week %d" % (df["season"].max(), df.filter((pl.col("season")==df["season"].max())&(pl.col("season_type")=="REG"))["week"].max()),
        "generated": __import__("datetime").date.today().isoformat(), "source": "nflverse player stats (nflreadpy)"}
blob = {"meta": meta, "fields": keys, "players": players, "rows": rows}
with open(out + "/data.js", "w") as f:
    f.write("window.NFL=" + json.dumps(blob, separators=(",",":")) + ";")
print("players", len(players), "rows", len(rows), "fields", len(keys), "meta", meta)
print("pre-1999 flagged:", sum(p[7] for p in players))
print(sorted({p[2] for p in players}))
