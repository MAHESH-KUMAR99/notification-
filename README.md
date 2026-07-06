# MBBS/BDS Counselling Updates — Notification Board

A curated directory of MCC, NTA/NEET, NMC and every State Medical Counselling
authority in India, mirroring their official notices verbatim (no
summarization) so nothing gets misquoted.

Most authorities are fully automated: a scraper polls each official site's
notice board and any new notice appears on the homepage automatically. A
handful of sites are manual (dead links, thin/static content, or JS-only
pages our scraper can't read) — those show an admin-edited "latest update"
line instead.

## Stack

- Next.js 16 (App Router) + Tailwind CSS v4
- Data stored in flat JSON files under `data/` — no database
- Admin auth via a single password (`ADMIN_PASSWORD` env var) + httpOnly cookie
- `cheerio` for HTML parsing (all target sites are server-rendered; no
  headless browser needed)

## Setup

```bash
npm install
cp .env.local.example .env.local   # then edit ADMIN_PASSWORD
npm run dev
```

Visit `http://localhost:3000` for the public board and
`http://localhost:3000/admin` to manage the manual-only authorities.

## How automation works

`data/watchers.json` lists one or more scrape configs per automated
authority — a URL plus a CSS selector (or a JSON-feed parser for a couple of
sites). `lib/watcher.js` fetches each source, extracts notices, diffs them
against `data/watch-state.json` (what's already been seen), and appends any
new ones to that authority's entry in `data/authorities.json` — verbatim
title, link, and date, no rewriting.

Triggering a check:

- **In the admin panel** — the "Check Now" button calls
  `POST /api/admin/check-updates` on demand.
- **On a schedule** — `.github/workflows/check-updates.yml` runs this every
  30 minutes via `scripts/run-check.mjs`, then commits any changed
  `data/*.json` straight back to this repo. That's deliberate: Vercel's
  filesystem is read-only at runtime, so a write from inside the deployed
  app would never persist. Committing to the repo instead means the next
  push triggers a normal Vercel redeploy with the fresh data.

Adding a new automated authority: add a watcher entry to
`data/watchers.json` (see existing entries for the shape — `html-list`,
`html-table`, `html-list-grouped`, `html-tabs-auto`, `nmc-json`, and
`embedded-json` types are supported) and make sure the authority already
exists in `data/authorities.json` with a `"notices": []` field. If a
selector breaks after a site redesign, that watcher just reports an error in
the check response — nothing publishes silently wrong, and the rest of the
authorities keep updating normally.

## Deployment (Vercel + GitHub Actions)

1. Push this repo to GitHub (**public**, so the scheduled Action gets
   unlimited free minutes — private repos are capped at 2,000 min/month,
   which a 30-minute cron across ~40 sites can exceed).
2. Import the repo in Vercel, set `ADMIN_PASSWORD` in its Environment
   Variables, and deploy.
3. The GitHub Action (already in `.github/workflows/check-updates.yml`)
   needs no extra secrets — it runs `scripts/run-check.mjs` directly, not
   through the HTTP API, so there's no auth token to configure. It commits
   updated data on its own schedule, and each commit triggers a Vercel
   redeploy.

## How manual updates work

1. Go to `/admin` and log in with `ADMIN_PASSWORD`.
2. Edit the "Latest Update" text for a manual authority and click Save —
   this writes to `data/authorities.json` and the homepage reflects it
   immediately (until the next Vercel redeploy resets it, since Vercel's
   filesystem doesn't persist writes — see the deployment note above; if you
   need manual edits to stick in production, commit them through the same
   GitHub flow as automated updates).

## Data shape

Each entry in `data/authorities.json`:

```json
{
  "id": "gujarat",
  "name": "UG Gujarat",
  "state": "Gujarat",
  "category": "state",
  "officialLink": "https://www.medadmgujarat.org/ug/home.aspx",
  "latestUpdate": "",
  "lastUpdatedDate": "2026-07-03T10:00:00.000Z",
  "notices": [
    { "id": "...", "title": "...", "link": "...", "date": "03/07/2026" }
  ]
}
```

`category` is one of `central`, `state`, `institute`.

## Adding a new manual-only authority

Add a new object to `data/authorities.json` with a unique `id` and no
`notices` field. No code changes needed — the homepage and admin panel both
read the same file.
