import { LEVELS } from "./levels";

// Hours-of-input roadmap, Dreaming Spanish-style.
// Base milestones are calibrated for a Romance language learned by an English
// speaker; other languages scale by a difficulty multiplier (rough FSI-informed
// guesses — language "distance" from what you already speak matters more than
// any table can capture, so these are guides, not promises).

const BASE_MILESTONE_HOURS = [0, 50, 150, 300, 600, 1000, 1500]; // index = level - 1

const MULTIPLIERS: Record<string, number> = {
  es: 1.0,
  pt: 1.0,
  it: 1.0,
  fr: 1.1,
  en: 1.0,
  de: 1.35,
  ja: 2.2,
};

export function multiplierFor(code: string): number {
  return MULTIPLIERS[code] ?? 1.2;
}

export type Milestone = { level: number; name: string; hours: number };

export function roadmapFor(code: string): Milestone[] {
  const m = multiplierFor(code);
  return LEVELS.map((l, i) => ({
    level: l.n,
    name: l.name,
    hours: Math.round((BASE_MILESTONE_HOURS[i] * m) / 10) * 10,
  }));
}

export function totalHoursFor(code: string): number {
  const r = roadmapFor(code);
  return r[r.length - 1].hours;
}

// Where a given number of watched hours falls on the roadmap.
export function progressFor(code: string, hoursWatched: number) {
  const roadmap = roadmapFor(code);
  let reached = roadmap[0];
  let next: Milestone | null = null;
  for (const m of roadmap) {
    if (hoursWatched >= m.hours) reached = m;
    else { next = m; break; }
  }
  return { roadmap, reached, next };
}
