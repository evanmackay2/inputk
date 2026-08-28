import Link from "next/link";
import Image from "next/image";
import { LevelBadge } from "./LevelBadge";
import { fmtDuration } from "@/lib/levels";
import { categoryById } from "@/lib/categories";
import type { Video } from "@/lib/types";

export function VideoCard({ video }: { video: Video & { categories?: string[] } }) {
  const primaryCat = video.categories?.[0] ? categoryById(video.categories[0]) : null;
  return (
    <Link href={`/learn/${video.language_code}/watch/${video.id}`} className="card group block">
      <div className="relative aspect-video bg-ink">
        {video.thumbnail_url && (
          <Image
            src={video.thumbnail_url}
            alt=""
            fill
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
            className="object-cover"
          />
        )}
        <span className="absolute bottom-2 right-2 rounded bg-ink/85 px-1.5 py-0.5 font-mono text-[11px] text-cream">
          {fmtDuration(video.duration_seconds)}
        </span>
        {primaryCat && primaryCat.id !== "general" && (
          <span className="absolute bottom-2 left-2 rounded bg-ink/85 px-1.5 py-0.5 text-[11px]">
            {primaryCat.emoji}
          </span>
        )}
      </div>
      <div className="p-3">
        <h3 className="line-clamp-2 text-sm font-medium leading-snug group-hover:text-lamp">
          {video.title}
        </h3>
        <div className="mt-2 flex items-center justify-between gap-2">
          <span className="truncate text-xs text-dust">{video.channel_name}</span>
          <LevelBadge level={video.level} />
        </div>
      </div>
    </Link>
  );
}