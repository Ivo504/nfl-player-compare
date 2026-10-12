import sys, nflreadpy as nfl
last = nfl.get_current_season()
out = sys.argv[1]
df = nfl.load_player_stats(seasons=list(range(1999, last + 1)), summary_level="week")
print(df.shape, sorted(df["season"].unique().to_list())[:2])
df.write_csv(out + "/weekly.csv")
