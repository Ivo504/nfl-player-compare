#!/usr/bin/env bash
# Rebuilds the website into _site/ from the latest nflverse data.
set -euo pipefail
cd "$(dirname "$0")"
rm -rf _site && mkdir -p work/data work/enrich _site/fonts
python fetch.py work/data
python enrich_fetch.py work/enrich
python aggregate.py work/data _site
python enrich_build.py work/data work/enrich . _site
python teams_build.py work/enrich _site
python games_build.py work/data work/enrich _site
cp index.html core.js teamcore.js art.js gamesui.js app.js naturalvoice.js assistant.js _site/
# Barlow fonts (so the site looks the same everywhere)
mkdir -p work/fontsrc && (cd work/fontsrc && npm init -y >/dev/null && npm i --no-audit --no-fund @fontsource/barlow @fontsource/barlow-condensed >/dev/null)
for w in 400 500 600 700; do cp work/fontsrc/node_modules/@fontsource/barlow/files/barlow-latin-$w-normal.woff2 _site/fonts/; done
for w in 500 600 700; do cp work/fontsrc/node_modules/@fontsource/barlow-condensed/files/barlow-condensed-latin-$w-normal.woff2 _site/fonts/; done
touch _site/.nojekyll
ls -la _site
