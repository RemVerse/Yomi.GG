# RiftScope

A personal League of Legends dashboard built with React, Vite, TypeScript, regular CSS, Node.js, and Express. It uses actual Riot API responses: no demo account, generated statistics, or fake insights. Your existing portfolio lives separately in `../Project-Website`.

## Run locally

Requires Node.js 22.12 or newer.

```sh
cd RiftScope
npm install
cp .env.example .env
# Edit .env and replace your_key_here with your Riot API key.
npm run dev
```

Open http://127.0.0.1:5173. The frontend proxies `/api` to the Express server on port 3001. Both start together and shut down together. Enter your Riot ID as `Game Name#Tagline`, select your account's platform, and click **Connect account**. The ID and platform are remembered locally in your browser. You can also set `RIOT_ID` and `RIOT_PLATFORM` in `.env` for defaults; the last `#` separates the name and tagline. Change accounts from Settings.

Get a development key by signing in at the [Riot Developer Portal](https://developer.riotgames.com/). Development keys typically expire after 24 hours. Replace expired keys in `.env` and restart the backend. Never paste an API key into the browser, source code, or chat. `.env` is ignored; `.env.example` contains only placeholders. No API key uses a `VITE_` variable or enters the client build. Both servers bind to loopback for personal local use.

Production local build:

```sh
npm run build
npm start
```

Then open http://127.0.0.1:3001. For development, keep PORT=3001 unless you also update the Vite proxy.

## Features

- Riot ID → Account-V1 PUUID → Summoner-V4 profile, League-V4 ranks, Mastery-V4, Match-V5 history.
- Solo/Duo and Flex ranks, LP, records, win rates, profile icon and level.
- Latest 20 matches with loading of older games in batches of 20. Queue, champion, role, and result filters apply to all loaded games.
- Expand any match to inspect both teams, items, damage, CS, vision, kills, gold, and reported objectives. Your row is highlighted.
- Recent form, champion and role tables with sorting, mastery collection, and interactive SVG point tooltips for trends.
- Rule-based insights require minimum sample sizes. Champion focus compares your latest 10 champion games with the previous 10 only when both samples exist.
- Refresh reloads mutable account data while retaining cached historical matches. Partial match failures and missing rank/mastery data are reported.

## Routing and data

`server/riot.ts` centralizes platform-to-region mapping. EUW uses `euw1` for profile/rank/mastery and `europe` for accounts/matches. The Riot ID tagline is not used to infer platform. NA/BR/LAN/LAS use Americas; KR/JP use Asia; supported Southeast Asia and Oceania platforms use SEA. All requests use HTTPS and the server-only `X-Riot-Token` header.

`server/app.ts` exposes `/api/config`, `/api/player`, `/api/player/ranked`, `/api/player/mastery`, `/api/player/matches`, `/api/matches/:matchId`, and `/api/dashboard`. Player routes accept `riotId` and `platform`; `refresh=1` bypasses mutable caches. Match history accepts a nonnegative `start` offset up to 1000. Static data comes from the newest available Data Dragon version, cached daily; champion, profile, item, spell, and rune assets use Riot URLs.

In-memory caches: account/profile/mastery 5 minutes, rank/history 2 minutes, completed match details 7 days. Requests are deduplicated and serialized with a minimum 75ms gap. A conservative 90 requests per 2-minute local budget helps protect development-key limits. A 429 respects `Retry-After` (seconds or HTTP date) and blocks requests to the affected host until its cooldown ends. No automatic retry storm. Caches reset on restart and have a bounded size.

## Calculations

`src/analytics.ts` contains all aggregations, filtering, insights, and the documented `performanceScore` function. KDA is `(kills + assists) / max(1, deaths)`; a zero-death match is labeled Perfect. Summary KDA uses totals, not averages of individual ratios. CS includes lane and jungle minions; CS/min divides by match duration in minutes. Kill participation divides your kills plus assists by team kills. Damage share uses team damage to champions.

Custom performance score weights: KDA 25%, kill participation 20%, CS/min 15%, damage share 15%, vision/min 15%, death restraint 10%. Farming, damage, and vision targets adjust for Support. Each component is clamped to 0–1. Missing vision contributes zero. This is a descriptive personal metric, **not an official Riot rating, rank, ELO, or MMR**. It is not balanced for every special game mode. Edit the function to suit your priorities.

Recent summary and statistical tables exclude games shorter than five minutes, treated as remakes. History retains them. Trends include all loaded matches. Role is Riot's team position with individual position as fallback; unknown roles are Other. Missing damage, vision, and player gold show as unavailable in team details. Vision summaries average only reported values, and vision charts omit unavailable observations. Team gold totals include available participant gold only. Zero item IDs show empty slots. Only returned keystone and secondary rune style are shown; unavailable runes are omitted.

## API limitations

A valid Riot key and internet access are needed for live account data and remote images. Match history is limited by Riot's retained history, queue coverage, and regional routing. Some special modes do not provide standard roles or all metrics. Newly released game patches can precede Data Dragon updates. You may have no ranked entries before placements. There is no speculative MMR estimation or live spectator feature. Nothing depends on spectator permissions.

Riot's developer policy requires product registration and review for products serving players. Consult the [official policies](https://developer.riotgames.com/policies/general) and [League documentation](https://developer.riotgames.com/docs/lol) before distributing or hosting the app. The required legal notice is visible in the footer.

## Verification

```sh
npm test
npm run build
```

Tests use isolated fixtures only inside `tests/`: they do not populate the application. They verify PUUID routing, HTTP endpoints, normalization, ranked arithmetic, CS/min, KDA, aggregations, filters, team details, cache expiry/deduplication, immutable refresh, safe errors, and Retry-After handling. Actual live lookup cannot be verified without your valid key. A successful fixture test is not proof of live credentials or Riot availability.

## Screenshots

_Add screenshots of your own connected account here. Do not share your API key or `.env`._

To rename the app, change `APP_NAME` in `src/main.tsx` and the title in `index.html`.
