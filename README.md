# NFL Player Compare

Compare NFL players' career, season and per-game stats, 1999 to present, with awards,
Super Bowl results and quarterback records. Data: [nflverse](https://github.com/nflverse/nflverse-data).

The site rebuilds itself every day (GitHub Actions) and publishes to GitHub Pages.

- `index.html`, `core.js`, `app.js`: the website. `data.js` and `extra.js` are generated daily.
- `*.py`: the data pipeline
- `update.sh` runs the pipeline locally (`pip install -r requirements.txt` first)
- `awards_src.py` award winners are typed in by hand; add the new season's winners each February
