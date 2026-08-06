# inputtv

Comprehensible-input YouTube immersion for any language. Curated CI channels are
ingested nightly, videos are leveled 1–7, and an embedded player tracks validated
watch time per language — your "input clock."

Stack: Next.js 14 (App Router) · Supabase (auth, Postgres, RLS) · YouTube Data API v3 · Tailwind.

## Setup

### 1. Supabase
1. Create a project at supabase.com.
2. SQL editor → run `supabase/schema.sql`, then `supabase/seed.sql`.
3. **Verify the seeded channel handles** — open `youtube.com/@TheHandle` for each row
   in `seed.sql` and fix any that don't resolve. Add your own CI channels the same way
   (`id` can be any `pending:*` placeholder; set `level_prior` 1–7 for the channel's
   typical difficulty).
4. Auth → Providers → Email: for local dev, turn **off** "Confirm email" so
   password signup works immediately. Turn it back on before real users.

### 2. YouTube API key
Google Cloud Console → new project → enable **YouTube Data API v3** → create an
API key. Default quota is 10,000 units/day; this pipeline uses a few hundred.

### 3. Environment
```bash
cp .env.example .env.local   # fill in all four values
```

### 4. Install, ingest, run
```bash
npm install
npm run ingest -- --full     # first run: full backfill of every channel
npm run dev                  # http://localhost:3000
```

Nightly refresh (newest 50 per channel): `npm run ingest`.

## Deploy

Push to GitHub → import in Vercel → add the four env vars. For the nightly ingest,
a GitHub Action is more comfortable than Vercel cron (no function timeout):

```yaml
# .github/workflows/ingest.yml
name: ingest
on:
  schedule: [{ cron: "0 7 * * *" }]
  workflow_dispatch:
jobs:
  ingest:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20 }
      - run: npm ci
      - run: npm run ingest
        env:
          NEXT_PUBLIC_SUPABASE_URL: ${{ secrets.NEXT_PUBLIC_SUPABASE_URL }}
          SUPABASE_SERVICE_ROLE_KEY: ${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}
          YOUTUBE_API_KEY: ${{ secrets.YOUTUBE_API_KEY }}
```

## How watch tracking works

- The watch page opens a `watch_sessions` row via the `start_watch_session` RPC.
- A client poller accrues time only while the IFrame player state is `PLAYING`,
  clamps per-tick deltas so seeking can't inflate the count, and flushes every
  10s (with `sendBeacon` on tab close).
- The `record_heartbeat` RPC re-validates on the server: credited seconds can
  never exceed wall-clock time since the previous heartbeat. It updates the
  session, `daily_watch_stats`, and the profile total atomically.

## Leveling today, and next

Today: `videos.level` = the channel's `level_prior` (confidence 0.3). The schema
already carries `wpm`, `top1k_coverage`, `top5k_coverage`, and
`transcript_status`, so the transcript-based leveler slots in without a
migration: fetch transcripts, compute speech rate + frequency coverage against
per-language lemma lists, calibrate against known-level videos, then update
`level` + `level_confidence` in place.

## Notes & obligations

- YouTube ToS: refresh cached metadata at least every 30 days (the nightly
  ingest does this for active channels), prune deleted/privated videos (set
  `available = false`), and always show attribution — the player, title, and
  channel name link back to YouTube.
- Only embeddable videos are ingested; the player still handles embed-revoked
  errors at runtime with a "Watch on YouTube" fallback.
- Mobile autoplay is muted-only by design; the UI expects a tap-to-play.
