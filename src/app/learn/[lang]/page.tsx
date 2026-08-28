import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { LevelPicker } from "@/components/LevelPicker";
import { VideoCard } from "@/components/VideoCard";
import { InterestsEditor } from "@/components/InterestsEditor";
import { fmtClock, LEVELS } from "@/lib/levels";
import { ALL_CATEGORIES, categoryById } from "@/lib/categories";
import type { Language, Profile, Video } from "@/lib/types";

export default async function FeedPage({
  params,
  searchParams,
}: {
  params: { lang: string };
  searchParams: { level?: string; cat?: string };
}) {
  const supabase = createClient();

  const [{ data: lang }, { data: { user } }] = await Promise.all([
    supabase.from("languages").select("*").eq("code", params.lang).single(),
    supabase.auth.getUser(),
  ]);
  if (!lang || !user) notFound();
  const language = lang as Language;

  const { data: profileRow } = await supabase
    .from("user_language_profiles")
    .select("*")
    .eq("user_id", user.id)
    .eq("language_code", params.lang)
    .maybeSingle();

  if (!profileRow) {
    return (
      <main className="px-6">
        <LevelPicker langCode={language.code} langName={language.name} />
      </main>
    );
  }
  const profile = profileRow as Profile & { interests: string[] };
  const interests: string[] = profile.interests ?? [];

  // level filter: explicit ?level= pin, else a band around the user's level
  const pinned = searchParams.level ? parseInt(searchParams.level) : null;
  const lo = pinned ?? Math.max(1, profile.current_level - 1);
  const hi = pinned ?? Math.min(7, profile.current_level + 1);

  // category filter: explicit ?cat= pin overrides interests
  const cat = searchParams.cat ?? null;

  let query = supabase
    .from("videos")
    .select("id, channel_id, language_code, title, channel_name, duration_seconds, published_at, thumbnail_url, view_count, level, categories")
    .eq("language_code", params.lang)
    .eq("embeddable", true)
    .eq("available", true)
    .gte("level", lo)
    .lte("level", hi);

  if (cat) {
    query = query.contains("categories", [cat]);
  } else if (interests.length) {
    query = query.overlaps("categories", interests);
  }

  const { data: videos } = await query
    .order("published_at", { ascending: false })
    .limit(48);

  // channel diversity: interleave so one channel can't dominate the page
  const feed: (Video & { categories: string[] })[] = [];
  const byChannel = new Map<string, (Video & { categories: string[] })[]>();
  for (const v of (videos as (Video & { categories: string[] })[] | null) ?? []) {
    const arr = byChannel.get(v.channel_id) ?? [];
    arr.push(v);
    byChannel.set(v.channel_id, arr);
  }
  const queues = [...byChannel.values()];
  while (feed.length < ((videos as Video[] | null)?.length ?? 0)) {
    for (const q of queues) {
      const v = q.shift();
      if (v) feed.push(v);
    }
  }

  const levelHref = (n?: number) =>
    `/learn/${language.code}?${new URLSearchParams({
      ...(n ? { level: String(n) } : {}),
      ...(cat ? { cat } : {}),
    }).toString()}`;
  const catHref = (id?: string) =>
    `/learn/${language.code}?${new URLSearchParams({
      ...(pinned ? { level: String(pinned) } : {}),
      ...(id ? { cat: id } : {}),
    }).toString()}`;

  return (
    <main className="mx-auto max-w-6xl px-6 py-8">
      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-line pb-6">
        <div className="flex items-center gap-4">
          <Link href="/" className="font-mono text-sm tracking-[0.3em] text-lamp">
            INPUT·TV
          </Link>
          <span className="font-mono text-xs text-dust">
            / ch·{language.code} {language.flag} {language.name}
          </span>
        </div>
        <Link href={`/learn/${language.code}/stats`} className="group text-right">
          <div className="clock text-2xl group-hover:text-cream">
            {fmtClock(profile.total_seconds_watched)}
          </div>
          <div className="font-mono text-[10px] tracking-widest text-dust">
            {language.name.toUpperCase()} INPUT · VIEW STATS
          </div>
        </Link>
      </header>

      <nav className="mt-6 flex flex-wrap items-center gap-2">
        <Link
          href={levelHref()}
          className={`btn text-xs ${!pinned ? "bg-lamp text-ink" : "btn-ghost"}`}
        >
          My band · L{Math.max(1, profile.current_level - 1)}–L{Math.min(7, profile.current_level + 1)}
        </Link>
        {LEVELS.map((l) => (
          <Link
            key={l.n}
            href={levelHref(l.n)}
            className={`btn text-xs ${pinned === l.n ? "bg-lamp text-ink" : "btn-ghost"}`}
          >
            L{l.n}
          </Link>
        ))}
      </nav>

      <nav className="mt-3 flex flex-wrap items-center gap-2">
        <Link
          href={catHref()}
          className={`rounded-full border px-3 py-1 text-xs ${
            !cat ? "border-lamp bg-lamp/15 text-lamp" : "border-line text-dust hover:text-cream"
          }`}
        >
          {interests.length ? "★ For you" : "All"}
        </Link>
        {ALL_CATEGORIES.map((c) => (
          <Link
            key={c.id}
            href={catHref(c.id)}
            className={`rounded-full border px-3 py-1 text-xs ${
              cat === c.id ? "border-lamp bg-lamp/15 text-lamp" : "border-line text-dust hover:text-cream"
            }`}
          >
            {c.emoji} {c.label}
          </Link>
        ))}
      </nav>

      <InterestsEditor langCode={language.code} interests={interests} />

      {feed.length ? (
        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {feed.map((v) => (
            <VideoCard key={v.id} video={v} />
          ))}
        </div>
      ) : (
        <div className="mt-16 text-center text-dust">
          <p>
            Nothing on air {cat ? `in ${categoryById(cat).label}` : interests.length ? "for your interests" : ""} at this level.
          </p>
          <p className="mt-2 text-sm">
            Try another level or category — or if the whole catalog looks thin, re-run{" "}
            <code className="text-lamp">npm run ingest -- --full</code> so existing videos get categorized.
          </p>
        </div>
      )}
    </main>
  );
}