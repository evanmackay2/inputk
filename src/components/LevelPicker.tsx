"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { LEVELS } from "@/lib/levels";

export function LevelPicker({ langCode, langName }: { langCode: string; langName: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function choose(level: number) {
    setBusy(true);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return router.push("/login");
    await supabase.from("user_language_profiles").upsert({
      user_id: user.id,
      language_code: langCode,
      current_level: level,
    });
    router.refresh();
  }

  return (
    <div className="mx-auto max-w-2xl py-16">
      <h1 className="font-display text-4xl">Tuning in to {langName}</h1>
      <p className="mt-3 text-dust">
        How much do you understand right now? Pick honestly — this sets which videos you see,
        and you can change it any time.
      </p>
      <div className="mt-8 space-y-2">
        {LEVELS.map((l) => (
          <button
            key={l.n}
            disabled={busy}
            onClick={() => choose(l.n)}
            className="card flex w-full items-center justify-between px-5 py-4 text-left disabled:opacity-50"
          >
            <div>
              <div className="font-medium" style={{ color: l.color }}>
                L{l.n} · {l.name}
              </div>
              <div className="text-sm text-dust">{l.hint}</div>
            </div>
            <span className="font-mono text-xs text-dust">→</span>
          </button>
        ))}
      </div>
    </div>
  );
}
