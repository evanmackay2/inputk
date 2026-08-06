import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  // sendBeacon posts a Blob — read text and parse manually
  const body = await request.text();
  let payload: { sessionId?: string; seconds?: number; maxPosition?: number };
  try {
    payload = JSON.parse(body);
  } catch {
    return NextResponse.json({ error: "bad payload" }, { status: 400 });
  }
  const { sessionId, seconds, maxPosition } = payload;
  if (typeof sessionId !== "string" || typeof seconds !== "number" || seconds < 0 || seconds > 3600) {
    return NextResponse.json({ error: "bad payload" }, { status: 400 });
  }

  const supabase = createClient();
  const { error } = await supabase.rpc("record_heartbeat", {
    p_session_id: sessionId,
    p_seconds: seconds,
    p_max_position: typeof maxPosition === "number" ? maxPosition : 0,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
