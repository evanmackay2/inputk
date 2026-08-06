import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { fmtClock, fmtDuration } from "@/lib/levels";

export default async function StatsPage({ params }: { params: { lang: string } }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) notFound();

  const since = new Date();
  since.setDate(since.getDate() - 27);
  const sinceStr = since.toISOString().slice(0, 10);

  const [{ data: profile }, { data: days }, { data: sessions }] = await Promise.all([
    supabase
      .from("user_language_profiles")
      .select("*")
      .eq("user_id", user.id)
      .eq("language_code", params.lang)
      .maybeSingle(),
    supabase
      .from("daily_watch_stats")
      .select("day, seconds_watched")
      .eq("user_id", user.id)
      .eq("language_code", params.lang)
      .gte("day", sinceStr)
      .order("day"),
    supabase
      .from("watch_sessions")
      .select("id, started_at, seconds_watched, completed, videos(title, channel_name)")
      .eq("user_id", user.id)
      .eq("language_code", params.lang)
      .order("started_at", { ascending: false })
      .limit(10),
  ]);
  if (!profile) notFound();

  // fill the 28-day grid
  const byDay = new Map((days ?? []).map((d) => [d.day, d.seconds_watched]));
  const grid: { day: string; s: number }[] = [];
  for (let i = 27; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    grid.push({ day: key, s: byDay.get(key) ?? 0 });
  }
  const maxDay = Math.max(60, ...grid.map((g) => g.s));
  const todaySeconds = grid[grid.length - 1].s;
  const goalSeconds = profile.daily_goal_minutes * 60;
  const goalPct = Math.min(100, Math.round((todaySeconds / goalSeconds) * 100));

  return (
    <main className="mx-auto max-w-3xl px-6 py-8">
      <Link href={`/learn/${params.lang}`} className="font-mono text-xs tracking-widest text-dust hover:text-lamp">
        ← BACK TO CH·{params.lang.toUpperCase()}
      </Link>

      <section className="mt-10 text-center">
        <div className="clock text-6xl sm:text-7xl">{fmtClock(profile.total_seconds_watched)}</div>
        <p className="mt-2 font-mono text-xs tracking-[0.3em] text-dust">TOTAL INPUT · HHH:MM:SS</p>
      </section>

      <section className="mt-12">
        <div className="flex items-baseline justify-between">
          <h2 className="font-mono text-xs tracking-[0.3em] text-dust">TODAY</h2>
          <span className="font-mono text-xs text-dust">
            {fmtDuration(todaySeconds)} / {profile.daily_goal_minutes}m goal
          </span>
        </div>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-surface">
          <div className="h-full rounded-full bg-lamp" style={{ width: `${goalPct}%` }} />
        </div>
      </section>

      <section className="mt-10">
        <h2 className="font-mono text-xs tracking-[0.3em] text-dust">LAST 28 DAYS</h2>
        <div className="mt-3 flex h-28 items-end gap-1">
          {grid.map((g) => (
            <div
              key={g.day}
              title={`${g.day}: ${fmtDuration(g.s)}`}
              className="flex-1 rounded-t bg-lamp/80"
              style={{ height: `${Math.max(2, (g.s / maxDay) * 100)}%`, opacity: g.s ? 1 : 0.15 }}
            />
          ))}
        </div>
      </section>

      <section className="mt-10">
        <h2 className="font-mono text-xs tracking-[0.3em] text-dust">RECENT SESSIONS</h2>
        <div className="mt-3 divide-y divide-line">
          {(sessions ?? []).map((s: any) => (
            <div key={s.id} className="flex items-center justify-between gap-4 py-3">
              <div className="min-w-0">
                <div className="truncate text-sm">{s.videos?.title ?? "—"}</div>
                <div className="text-xs text-dust">{s.videos?.channel_name}</div>
              </div>
              <div className="text-right">
                <div className="font-mono text-sm text-lamp">{fmtDuration(Math.round(s.seconds_watched))}</div>
                <div className="font-mono text-[10px] text-dust">
                  {new Date(s.started_at).toLocaleDateString()} {s.completed ? "· ✓" : ""}
                </div>
              </div>
            </div>
          ))}
          {!sessions?.length && <p className="py-3 text-sm text-dust">No sessions yet — go watch something.</p>}
        </div>
      </section>
    </main>
  );
}
