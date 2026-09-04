import { NextResponse } from "next/server";
import { YoutubeTranscript } from "youtube-transcript";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

// GET /api/transcript/:videoId — reads the ID from the URL path directly,
// so the dynamic folder's name no longer matters.

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\n/g, " ");
}

export async function GET(req: Request) {
  const videoId = new URL(req.url).pathname.split("/").filter(Boolean).pop() ?? "";
  console.log("[transcript] request for:", videoId);

  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  const { data: cached } = await supabase
    .from("transcripts")
    .select("status, segments")
    .eq("video_id", videoId)
    .maybeSingle();
  if (cached) {
    console.log("[transcript] cache hit:", cached.status);
    return NextResponse.json(cached);
  }

  const { data: video } = await supabase
    .from("videos")
    .select("id, language_code")
    .eq("id", videoId)
    .maybeSingle();
  if (!video) {
    console.log("[transcript] not in catalog:", videoId);
    return NextResponse.json({ error: "unknown video" }, { status: 404 });
  }

  const admin = createAdminClient();

  let raw: { text: string; offset: number; duration: number }[] | null = null;
  try {
    raw = await YoutubeTranscript.fetchTranscript(videoId, { lang: video.language_code });
  } catch (e1) {
    console.log("[transcript] lang fetch failed:", (e1 as Error).message);
    try {
      raw = await YoutubeTranscript.fetchTranscript(videoId);
    } catch (e2) {
      console.log("[transcript] any-lang fetch failed:", (e2 as Error).message);
      raw = null;
    }
  }

  if (!raw || raw.length === 0) {
    await admin.from("transcripts").upsert({
      video_id: videoId,
      language_code: video.language_code,
      status: "unavailable",
      segments: [],
    });
    await admin.from("videos").update({ transcript_status: "unavailable" }).eq("id", videoId);
    return NextResponse.json({ status: "unavailable", segments: [] });
  }

  const maxOffset = Math.max(...raw.map((r) => r.offset));
  const scale = maxOffset > 36_000 ? 1000 : 1;
  const segments = raw.map((r) => ({
    t: Math.round((r.offset / scale) * 10) / 10,
    d: Math.round((r.duration / scale) * 10) / 10,
    text: decodeEntities(r.text),
  }));

  await admin.from("transcripts").upsert({
    video_id: videoId,
    language_code: video.language_code,
    status: "fetched",
    segments,
  });
  await admin.from("videos").update({ transcript_status: "fetched" }).eq("id", videoId);

  console.log("[transcript] fetched", segments.length, "segments");
  return NextResponse.json({ status: "fetched", segments });
}