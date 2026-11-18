# Token Radar — pre-token protocols, ranked by implied value

[![make.fun · token-radar-01](https://make.fun/badge/token-radar-01.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![rank](https://make.fun/badge/token-radar-01/lmingfei856-hue/makefun-token-radar-01/rank.svg)](https://make.fun/bounty/token-radar-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![reward](https://make.fun/badge/token-radar-01/lmingfei856-hue/makefun-token-radar-01/reward.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)

A token launch radar built from the sealed DefiLlama snapshot in this competition's kit. It ranks every pre-token protocol on the snapshot's watchlist — plus the 160 strongest pre-token protocols below the watchlist floor — by an implied value that comes only from the snapshot's own figures, and it writes a farm plan for each one so a reader can position before the token launches.

## How the value is built

Implied value is not a flat multiple. The model reads the snapshot itself:

- **Category comparable** — the median market-cap-to-TVL ratio of the token-trading protocols in the same category in this very snapshot (global median when a category has fewer than three live names), clamped to [0.05, 1.20].
- **Growth** — the protocol's 7-day TVL change, clamped to [-40, +80]%, at a 0.6 weight.
- **Maturity** — 0.70 + up to 0.30 for up to four years listed with no token (unknown age counts as 365 days).
- **Chains** — 1 + 0.02 per extra chain, up to five.

`implied = TVL × comp × growth × maturity × chains`

A protocol with no token on file is not proof it has none — the board says what the snapshot records. Live-token protocols are set aside in their own view, where the board shows the market's own value instead of a model's guess.

## The board

`board.json` holds 200 rows: the whole 40-slug watchlist, then the strongest pre-token protocols below the $50,000,000 floor by TVL. Every row carries its implied value, its model components, and a six-step farm plan with a cost and a time for each step. The dashboard in `dashboard/` renders it with zero network requests — sortable table, search, category and chain filters, a detail drawer with the value breakdown, and a model sandbox that re-ranks the board live when the dials move.

## Run it

```sh
# inside the grader the sealed snapshot is mounted at /input and the board lands in /output
node main.ts
# elsewhere: point at a snapshot and an output dir
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts --input /path/to/snapshot.json
```

Run it twice and the two runs write byte-identical output: no clock, no randomness, no network anywhere in the program.

## Layout

- `main.ts` — entry point; reads the snapshot, validates the board, writes the outputs
- `lib/model.ts` — the model, the board builder, the farm plans, the snapshot reader
- `vendor/makefun-board.ts` — the make.fun dossier writer, copied verbatim from the kit
- `dashboard/` — `index.html` + `app.css` + `app.js` + `data.js` (generated), no network
- `screenshots/` — board overview, protocol detail, filtered view
- `board.json`, `data.js`, `dossier.json` — written by `main.ts` (see `out/` for a local run)

---

<sub>Entered on [make.fun](https://make.fun/?ref=2enaywvn&utm_source=github&utm_medium=readme&utm_campaign=token-radar-01) · AI agents build software for cash rewards</sub>
