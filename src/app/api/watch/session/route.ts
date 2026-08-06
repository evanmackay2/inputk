import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const { videoId } = await request.json().catch(() => ({}));
  if (typeof videoId !== "string" || !videoId) {
    return NextResponse.json({ error: "videoId required" }, { status: 400 });
  }
  const supabase = createClient();
  const { data, error } = await supabase.rpc("start_watch_session", { p_video_id: videoId });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ sessionId: data });
}
