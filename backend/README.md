# cricketScrap

Production-structured cricket data ingestion backend. Scrapes Cricbuzz match/series pages using Cheerio (primary) with optional Playwright fallback, and exposes a clean normalized JSON REST API.

---

## Stack

| Layer | Library |
|---|---|
| HTTP server | Express 4 + helmet, cors, compression |
| Rate limiting | express-rate-limit |
| Scraping (static) | Cheerio 1.x |
| Scraping (dynamic) | Playwright (optional peer dep) |
| HTTP client | Axios + Bottleneck (2 concurrent, 400 ms min gap) |
| Caching | node-cache (per-section TTLs) |
| Validation | Zod |
| Logging | Winston |
| Runtime types | TypeScript 5 strict |
| Tests | Jest + ts-jest |

---

## Setup

```bash
# 1 — install deps (pnpm recommended)
pnpm install

# 2 — copy env file and fill in any overrides
cp .env.example .env

# 3 — dev mode (ts-node + nodemon)
pnpm dev

# 4 — production build
pnpm build && pnpm start
```

### Optional: Playwright fallback

If Cricbuzz starts rendering scores client-side (JavaScript), enable Playwright:

```bash
pnpm add playwright
pnpx playwright install chromium
```

Then set `USE_PLAYWRIGHT_FALLBACK=true` in `.env`.

---

## Environment variables

| Variable | Default | Description |
|---|---|---|
| `PORT` | `3001` | Server port |
| `NODE_ENV` | `development` | `development` or `production` |
| `FETCH_TIMEOUT_MS` | `12000` | Axios request timeout |
| `FETCH_RETRIES` | `2` | Retry attempts on transient errors |
| `FETCH_RETRY_DELAY_MS` | `800` | Delay between retries |
| `CONCURRENCY_CAP` | `2` | Max concurrent Cricbuzz requests (Bottleneck) |
| `CACHE_TTL_LIVE_LIST` | `20` | Live scores list cache (seconds) |
| `CACHE_TTL_MATCH_LIVE` | `15` | Match live detail cache (seconds) |
| `CACHE_TTL_SCORECARD` | `15` | Scorecard cache (seconds) |
| `CACHE_TTL_COMMENTARY` | `12` | Commentary cache (seconds) |
| `CACHE_TTL_SQUADS` | `3600` | Match squads cache (seconds) |
| `CACHE_TTL_POINTS_TABLE` | `3600` | Series points table cache (seconds) |
| `CACHE_TTL_HIGHLIGHTS` | `600` | Highlights cache (seconds) |
| `USE_PLAYWRIGHT_FALLBACK` | `false` | Enable Playwright for JS-rendered pages |
| `LOG_LEVEL` | `info` | Winston log level |
| `LOG_SELECTOR_MISSES` | `false` | Log CSS selector fallback events |
| `CORS_ORIGIN` | `http://localhost:5173` | Allowed CORS origin |
| `PARSER_VERSION` | `1.0.0` | Bump this when selectors change |

---

## Endpoints

All successful responses wrap data in `{ ok: true, data: ..., meta: { fromCache, cachedAt, cacheAgeMs } }`.

Error responses use `{ ok: false, error: { code, message, section } }`.

### Live scores

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/live` | All live/upcoming matches. Query: `?series=ipl&team=csk&status=live` |
| `GET` | `/api/live/upcoming` | Only upcoming matches |
| `GET` | `/api/live/recent` | Only recent / completed matches |
| `GET` | `/api/live/:matchId` | Full live detail for one match (batters, bowler, recent balls, key stats) |
| `GET` | `/api/live/:matchId/scorecard` | Innings scorecard(s) |
| `GET` | `/api/live/:matchId/commentary` | Recent commentary blocks |
| `GET` | `/api/live/:matchId/squads` | Playing XI squads |
| `GET` | `/api/live/:matchId/highlights` | Match highlight cards |
| `GET` | `/api/live/:matchId/widget` | Compact widget payload (score + status + derived fields) |
| `GET` | `/api/live/:matchId/delta` | Only fields that changed since the last snapshot |

### Series

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/series/:seriesId/points-table` | League standings / points table |
| `GET` | `/api/series/:seriesId/squads` | All team squads for a series |

### Health

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/health` | Uptime, memory, cache stats, per-section error counts |

#### Query parameters for `/api/live`

| Param | Example | Description |
|---|---|---|
| `series` | `ipl`, `psl`, `bbl`, `test`, `odi` | Filter by league/series keyword |
| `team` | `csk`, `india` | Filter by team name or short code |
| `status` | `live`, `upcoming`, `result` | Filter by match state |

---

## Sample responses

### `GET /api/live`

```json
{
  "ok": true,
  "data": [
    {
      "matchId": "152086",
      "slug": "csk-vs-lsg-53rd-match-indian-premier-league-2026",
      "title": "Chennai Super Kings vs Lucknow Super Giants, 53rd Match, Indian Premier League 2026",
      "series": "Indian Premier League 2026",
      "venue": "MA Chidambaram Stadium, Chennai",
      "statusText": "CSK need 55 runs in 44 balls",
      "state": "live",
      "format": "T20",
      "startTimeText": null,
      "teams": [
        { "name": "Chennai Super Kings", "shortName": "CSK", "score": "149-3", "overs": "12.5" },
        { "name": "Lucknow Super Giants", "shortName": "LSG", "score": "203-8", "overs": "20.0" }
      ],
      "links": {
        "live": "https://www.cricbuzz.com/live-cricket-scores/152086/csk-vs-lsg-...",
        "scorecard": "https://www.cricbuzz.com/live-cricket-scorecard/152086/...",
        "commentary": "https://www.cricbuzz.com/live-cricket-full-commentary/152086/...",
        "squads": "https://www.cricbuzz.com/cricket-match-squads/152086/...",
        "highlights": "https://www.cricbuzz.com/cricket-match-highlights/152086/..."
      }
    }
  ],
  "meta": { "fromCache": false, "cachedAt": "2026-05-10T14:32:00.000Z", "cacheAgeMs": 0 }
}
```

### `GET /api/live/:matchId/widget`

```json
{
  "ok": true,
  "data": {
    "matchId": "152086",
    "title": "CSK vs LSG",
    "format": "T20",
    "state": "live",
    "statusText": "CSK need 55 runs in 44 balls",
    "teams": [
      { "name": "Chennai Super Kings", "shortName": "CSK", "score": "149-3", "overs": "12.5" },
      { "name": "Lucknow Super Giants", "shortName": "LSG", "score": "203-8", "overs": "20.0" }
    ],
    "derived": {
      "isChase": true,
      "runsRequired": 55,
      "ballsRemaining": 44,
      "currentRunRate": 11.6,
      "requiredRunRate": 7.5,
      "wicketsInHand": 7,
      "lastUpdatedAgeSec": 4
    }
  }
}
```

### `GET /api/health`

```json
{
  "ok": true,
  "uptime": 3620,
  "memoryMB": 48,
  "cacheStats": { "keys": 12, "hits": 341, "misses": 18, "ksize": 6144, "vsize": 204800 },
  "sections": {
    "live_list": { "requests": 120, "errors": 0, "lastError": null },
    "match_live": { "requests": 84, "errors": 2, "lastError": "2026-05-10T14:01:00.000Z" }
  },
  "providerMode": "fetch-cheerio",
  "parserVersion": "1.0.0"
}
```

---

## Project structure

```
cricketScrap/
├── src/
│   ├── app.ts                          # Express app entry point
│   ├── config/index.ts                 # Typed env config
│   ├── types/index.ts                  # All domain TypeScript interfaces
│   ├── models/index.ts                 # Zod validation schemas
│   ├── utils/
│   │   ├── logger.ts                   # Winston (colorized dev / JSON prod)
│   │   ├── cache.ts                    # NodeCache wrapper with freshMeta()
│   │   ├── normalizer.ts               # Score parsing, state/format inference, short names
│   │   └── delta.ts                    # Snapshot Map + field diff computation
│   ├── scrapers/
│   │   └── cricbuzzFetcher.ts          # Axios + Bottleneck + Playwright fallback
│   ├── parsers/
│   │   ├── cricbuzzParserLive.ts       # Live scores list page
│   │   ├── cricbuzzParserMatchLive.ts  # Match live detail page (batters/bowler/balls)
│   │   ├── cricbuzzParserScorecard.ts  # Innings scorecard
│   │   ├── cricbuzzParserCommentary.ts # Commentary blocks + event classification
│   │   ├── cricbuzzParserSquads.ts     # Match squads / Playing XI
│   │   ├── cricbuzzParserSeriesTable.ts# Points table (auto column-detect)
│   │   ├── cricbuzzParserSeriesSquads.ts # Series-level all-teams squads
│   │   └── cricbuzzParserHighlights.ts # Highlight cards
│   ├── services/
│   │   └── cricbuzzService.ts          # Cache-first service layer + section stats
│   ├── controllers/
│   │   ├── liveController.ts           # 8 route handlers (list, detail, widget, delta...)
│   │   └── seriesController.ts         # 2 route handlers
│   └── routes/
│       ├── live.ts
│       ├── series.ts
│       └── health.ts
├── tests/
│   ├── fixtures/
│   │   └── live_scores_sample.html     # 3-match HTML fixture for parser tests
│   └── parsers/
│       ├── live.test.ts                # parseLiveScoresPage, filterMatches, normalizer utils
│       └── scorecard.test.ts           # parseScorecardPage, parseScoreText, safeFloat/Int
├── .env.example
├── nodemon.json
├── package.json
└── tsconfig.json
```

---

## Scraping URLs targeted

| Section | Cricbuzz URL pattern |
|---|---|
| Live scores list | `/cricket-match/live-scores` |
| Match live detail | `/live-cricket-scores/:matchId/:slug` |
| Match scorecard | `/live-cricket-scorecard/:matchId/:slug` |
| Full commentary | `/live-cricket-full-commentary/:matchId/:slug` |
| Match squads | `/cricket-match-squads/:matchId/:slug` |
| Match highlights | `/cricket-match-highlights/:matchId/:slug` |
| Series points table | `/cricket-series/:seriesId/:slug/points-table` |
| Series squads | `/cricket-series/:seriesId/:slug/squads` |

---

## Scripts

```bash
pnpm dev          # ts-node + nodemon hot-reload
pnpm build        # tsc → dist/
pnpm start        # node dist/app.js
pnpm test         # jest --runInBand --forceExit
pnpm test:watch   # jest --watch
pnpm typecheck    # tsc --noEmit (no emit, type errors only)
```

---

## Deployment

### Railway

This project is configured for one-click deployment on [Railway](https://railway.app/).

1. **Push to GitHub** — Create a repo and push your code.
2. **New Project** — On Railway, select "Deploy from GitHub repo".
3. **Variables** — Add the following environment variables (from `.env.example`):
   - `PORT`: 3001 (Railway will automatically map this)
   - `NODE_ENV`: production
   - `CORS_ORIGIN`: Your frontend URL (e.g., `https://myapp.vercel.app`)
   - `FETCH_TIMEOUT_MS`: 12000
   - ... and any other overrides from `.env.example`.

#### Dockerized Deployment
The project includes a `Dockerfile` for a consistent production environment. Railway will automatically detect this and use it to build and deploy your app.

#### Playwright on Railway
If you need to enable `USE_PLAYWRIGHT_FALLBACK=true` on Railway:
1. Update the `Dockerfile` to use a Playwright-compatible base image (e.g., `mcr.microsoft.com/playwright:v1.44.1-jammy`).
2. Ensure `playwright` is installed in your `package.json`.

---

## Known limitations

1. **Selector fragility** — Cricbuzz redesigns their HTML periodically. The multi-selector fallback arrays reduce breakage but parsers still need updating when classes change. Bump `PARSER_VERSION` and redeploy.

2. **No authentication bypass** — Requests use realistic browser headers but Cricbuzz can still return 403 for automated traffic. The Playwright fallback handles JS challenges; for persistent blocks consider a rotating proxy.

3. **Rate limits** — Default concurrency cap is 2 requests at 400 ms minimum gap. Increase only with caution — aggressive scraping may get the server IP blocked.

4. **In-memory cache only** — Cache is per-process and lost on restart. For multi-instance deployments, swap `node-cache` for Redis in `src/utils/cache.ts`.

5. **Delta endpoint cold start** — `/delta` returns `{ changed: false }` on the first call for any match (no prior snapshot to diff against). The second call onwards reflects real changes.

6. **Playwright peer dep** — Playwright is listed as `optionalDependencies`. Running with `USE_PLAYWRIGHT_FALLBACK=true` without installing it will cause a runtime `require` error only when Playwright is actually triggered (lazy import).
