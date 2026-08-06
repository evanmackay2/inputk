export type LevelInfo = { n: number; name: string; hint: string; color: string };

export const LEVELS: LevelInfo[] = [
  { n: 1, name: "New",           hint: "Starting from zero",                    color: "#7BC96F" },
  { n: 2, name: "Superbeginner", hint: "Slow speech, lots of visual support",   color: "#9FD066" },
  { n: 3, name: "Beginner",      hint: "Simple stories at a gentle pace",       color: "#C9CF5B" },
  { n: 4, name: "Intermediate",  hint: "Natural topics, clear speech",          color: "#EFC24E" },
  { n: 5, name: "Adv. Intermediate", hint: "Near-native pace on everyday topics", color: "#F49E4C" },
  { n: 6, name: "Advanced",      hint: "Native pace, any topic",                color: "#F07850" },
  { n: 7, name: "Native",        hint: "Content made for native speakers",      color: "#E8555E" },
];

export const levelInfo = (n: number): LevelInfo =>
  LEVELS[Math.min(7, Math.max(1, n)) - 1];

export function fmtDuration(s: number): string {
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = Math.floor(s % 60);
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`
               : `${m}:${String(sec).padStart(2, "0")}`;
}

// The input clock: cumulative hours as a broadcast-style timecode
export function fmtClock(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = Math.floor(totalSeconds % 60);
  return `${String(h).padStart(3, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}
