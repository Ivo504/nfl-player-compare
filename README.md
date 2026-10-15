# NFL Player Compare

Compare NFL players' career, season and per-game stats, 1999 to present, with awards,
Super Bowl results and quarterback records. A Teams mode compares all 32 franchises from 2000 on:
records, points, playoffs, offense, defense, special teams and penalties. Data: [nflverse](https://github.com/nflverse/nflverse-data).

The site rebuilds itself every day (GitHub Actions) and publishes to GitHub Pages.

- `index.html`, `core.js`, `teamcore.js`, `app.js`: the website. `assistant.js` is Luna, the voice assistant that answers questions from the site data in the browser. `data.js`, `extra.js` and `teams.js` are generated daily.
- `*.py`: the data pipeline
- `update.sh` runs the pipeline locally (`pip install -r requirements.txt` first)
- `awards_src.py` award winners are typed in by hand; add the new season's winners each February
