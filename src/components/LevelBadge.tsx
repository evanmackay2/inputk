import { levelInfo } from "@/lib/levels";

export function LevelBadge({ level, size = "sm" }: { level: number; size?: "sm" | "lg" }) {
  const info = levelInfo(level);
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full font-mono uppercase tracking-wider ${
        size === "lg" ? "px-3 py-1 text-xs" : "px-2 py-0.5 text-[10px]"
      }`}
      style={{ color: info.color, border: `1px solid ${info.color}55`, background: `${info.color}14` }}
    >
      <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ background: info.color }} />
      L{info.n} {info.name}
    </span>
  );
}
