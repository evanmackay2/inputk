import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Player } from "@/components/Player";
import { LevelBadge } from "@/components/LevelBadge";
import { fmtDuration } from "@/lib/levels";

export default async function WatchPage({
  params,
}: {
  params: { lang: string; videoId: string };
}) {
  const supabase = createClient();
  const [{ data: video }, { data: { user } }] = await Promise.all([
    supabase.from("videos").select("*").eq("id", params.videoId).single(),
    supabase.auth.getUser(),
  ]);
  if (!video || !user) notFound();

  const { data: profile } = await supabase
    .from("user_language_profiles")
    .select("total_seconds_watched")
    .eq("user_id", user.id)
    .eq("language_code", params.lang)
    .maybeSingle();

  return (
    <main className="mx-auto max-w-4xl px-6 py-8">
      <Link href={`/learn/${params.lang}`} className="font-mono text-xs tracking-widest text-dust hover:text-lamp">
        ← BACK TO CH·{params.lang.toUpperCase()}
      </Link>

      <div className="mt-4">
        <Player videoId={video.id} baseSeconds={profile?.total_seconds_watched ?? 0} />
      </div>

      <div className="mt-6 border-t border-line pt-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <h1 className="font-display text-2xl leading-snug">{video.title}</h1>
          <LevelBadge level={video.level} size="lg" />
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-dust">
          <span className="text-cream">{video.channel_name}</span>
          <span className="font-mono text-xs">{fmtDuration(video.duration_seconds)}</span>
          <span className="font-mono text-xs">{Number(video.view_count).toLocaleString()} views</span>
          {video.published_at && (
            <span className="font-mono text-xs">
              {new Date(video.published_at).toLocaleDateString()}
            </span>
          )}
          <a
            href={`https://www.youtube.com/watch?v=${video.id}`}
            target="_blank"
            rel="noreferrer"
            className="font-mono text-xs hover:text-lamp"
          >
            YouTube ↗
          </a>
        </div>
        {video.description && (
          <p className="mt-4 line-clamp-4 max-w-2xl whitespace-pre-line text-sm text-dust">
            {video.description}
          </p>
        )}
      </div>
    </main>
  );
}
