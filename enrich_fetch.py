import sys, nflreadpy as nfl, polars as pl
out = sys.argv[1]
nfl.load_players().write_csv(out + "/players.csv")
dp = nfl.load_draft_picks()
dp.write_csv(out + "/draft_picks.csv")
sch = nfl.load_schedules(seasons=list(range(1999, nfl.get_current_season() + 1)))
sch.write_csv(out + "/schedules.csv")
sb = sch.filter(pl.col("game_type") == "SB").select("season","game_id","week","away_team","away_score","home_team","home_score").sort("season")
print(sb)
# freshness of draft_picks honors
print("draft_picks max season:", dp["season"].max())
for nm in ["Peyton Manning","Patrick Mahomes","Aaron Donald","Tom Brady","Larry Fitzgerald","Calvin Johnson"]:
    r = dp.filter(pl.col("pfr_player_name") == nm).select("season","pfr_player_name","probowls","allpro","hof","to")
    print(r)
# team pages: per-game team stats (offense and defense) and team names/colors
nfl.load_team_stats(seasons=list(range(2000, nfl.get_current_season() + 1)), summary_level="week").write_csv(out + "/team_week.csv")
nfl.load_teams().write_csv(out + "/teams.csv")
# game pages: weekly injury reports (2009 onward)
nfl.load_injuries(seasons=list(range(2009, nfl.get_current_season() + 1))).write_csv(out + "/injuries.csv")
