// inputtv ingestion pipeline
//
// For every channel in the `channels` table:
//   1. Resolve its YouTube channel ID from its @handle if not yet resolved (1 unit)
//   2. Walk its uploads playlist (UC... -> UU...) via playlistItems.list (1 unit / 50 videos)
//   3. Hydrate details in batches of 50 via videos.list (1 unit / 50 videos)
//   4. Upsert into `videos`, skipping non-embeddable ones, level = channel level_prior
//
// Usage:  npm run ingest            (nightly: newest 50 uploads per channel)
//         npm run ingest -- --full  (first run / backfill: entire uploads playlist)
//
// Env is read from .env.local / .env automatically (plain Node doesn't do this
// on its own — only Next.js does), or from real environment variables (CI).

import { createClient } from "@supabase/supabase-js";
import { readFileSync, existsSync } from "node:fs";

// ---- minimal .env loader: real environment variables always win ----
for (const file of [".env.local", ".env"]) {
  if (!existsSync(file)) continue;
  for (const line of readFileSync(file, "utf8").split("\n")) {
    const m = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/.exec(line);
    if (!m || line.trim().startsWith("#")) continue;
    const key = m[1];
    let val = m[2];
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = val;
  }
}
// --------------------------------------------------------------------

const YT = "https://www.googleapis.com/youtube/v3";
const KEY = process.env.YOUTUBE_API_KEY;
const FULL = process.argv.includes("--full");

if (!KEY || !process.env.SUPABASE_SERVICE_ROLE_KEY || !process.env.NEXT_PUBLIC_SUPABASE_URL) {
  console.error("Missing env. Needed: YOUTUBE_API_KEY, SUPABASE_SERVICE_ROLE_KEY, NEXT_PUBLIC_SUPABASE_URL");
  console.error("Present:", {
    YOUTUBE_API_KEY: !!KEY,
    SUPABASE_SERVICE_ROLE_KEY: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
    NEXT_PUBLIC_SUPABASE_URL: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
  });
  console.error("Run from the project root (the folder containing .env.local).");
  process.exit(1);
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

async function yt(endpoint, params) {
  const url = new URL(`${YT}/${endpoint}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  url.searchParams.set("key", KEY);
  const res = await fetch(url);
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`YouTube ${endpoint} ${res.status}: ${body.slice(0, 300)}`);
  }
  return res.json();
}

// ISO 8601 duration (PT1H2M3S) -> seconds
function parseDuration(iso) {
  const m = /PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/.exec(iso ?? "");
  if (!m) return 0;
  return (+m[1] || 0) * 3600 + (+m[2] || 0) * 60 + (+m[3] || 0);
}

function bestThumb(thumbs) {
  return (thumbs?.maxres ?? thumbs?.standard ?? thumbs?.high ?? thumbs?.medium ?? thumbs?.default)?.url ?? "";
}

async function resolveChannel(ch) {
  if (!ch.id.startsWith("pending:")) return ch;
  const data = await yt("channels", { part: "id,snippet", forHandle: ch.handle.replace(/^@/, "") });
  const found = data.items?.[0];
  if (!found) {
    console.warn(`  !! could not resolve handle ${ch.handle} — check youtube.com/${ch.handle} exists, skipping`);
    return null;
  }
  // re-key the row to the real channel ID
  await supabase.from("channels").delete().eq("id", ch.id);
  const resolved = { ...ch, id: found.id, name: found.snippet.title };
  const { error } = await supabase.from("channels").upsert({
    id: resolved.id,
    handle: ch.handle,
    language_code: ch.language_code,
    name: resolved.name,
    is_ci_channel: ch.is_ci_channel,
    level_prior: ch.level_prior,
  });
  if (error) throw error;
  console.log(`  resolved ${ch.handle} -> ${found.id} (${found.snippet.title})`);
  return resolved;
}

async function listUploads(channelId) {
  const playlistId = "UU" + channelId.slice(2);
  const ids = [];
  let pageToken;
  do {
    const data = await yt("playlistItems", {
      part: "contentDetails",
      playlistId,
      maxResults: "50",
      ...(pageToken ? { pageToken } : {}),
    });
    ids.push(...(data.items ?? []).map((i) => i.contentDetails.videoId));
    pageToken = data.nextPageToken;
  } while (pageToken && FULL);
  return ids;
}

async function hydrate(ids, ch) {
  const rows = [];
  for (let i = 0; i < ids.length; i += 50) {
    const batch = ids.slice(i, i + 50);
    const data = await yt("videos", {
      part: "snippet,contentDetails,status,statistics",
      id: batch.join(","),
      maxResults: "50",
    });
    for (const v of data.items ?? []) {
      const dur = parseDuration(v.contentDetails?.duration);
      if (!v.status?.embeddable) continue;      // can't track what we can't embed
      if (v.snippet?.liveBroadcastContent !== "none") continue;
      if (dur < 120) continue;                  // skip shorts / stubs
      rows.push({
        id: v.id,
        channel_id: ch.id,
        language_code: ch.language_code,
        title: v.snippet.title,
        channel_name: v.snippet.channelTitle,
        description: (v.snippet.description ?? "").slice(0, 2000),
        duration_seconds: dur,
        published_at: v.snippet.publishedAt,
        thumbnail_url: bestThumb(v.snippet.thumbnails),
        embeddable: true,
        available: true,
        view_count: +(v.statistics?.viewCount ?? 0),
        level: Math.min(7, Math.max(1, Math.round(ch.level_prior ?? 4))),
        level_confidence: 0.3,                  // channel-prior heuristic
        metadata_refreshed_at: new Date().toISOString(),
      });
    }
  }
  return rows;
}

async function main() {
  const { data: channels, error } = await supabase.from("channels").select("*").eq("is_ci_channel", true);
  if (error) throw error;
  console.log(`Ingesting ${channels.length} channels (${FULL ? "full backfill" : "latest 50 per channel"})\n`);

  for (const raw of channels) {
    console.log(`# ${raw.name || raw.handle} [${raw.language_code}]`);
    try {
      const ch = await resolveChannel(raw);
      if (!ch) continue;
      const ids = await listUploads(ch.id);
      const rows = await hydrate(ids, ch);
      if (rows.length) {
        const { error: upErr } = await supabase.from("videos").upsert(rows);
        if (upErr) throw upErr;
      }
      await supabase.from("channels").update({ last_ingested_at: new Date().toISOString() }).eq("id", ch.id);
      console.log(`  ${rows.length}/${ids.length} videos upserted\n`);
    } catch (e) {
      console.error(`  !! ${e.message}\n`);
    }
  }
  console.log("Done.");
}

main().catch((e) => { console.error(e); process.exit(1); });
