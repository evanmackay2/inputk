"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { CATEGORIES } from "@/lib/categories";

export function InterestsEditor({
  langCode,
  interests,
}: {
  langCode: string;
  interests: string[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(interests.length === 0);
  const [selected, setSelected] = useState<Set<string>>(new Set(interests));
  const [busy, setBusy] = useState(false);

  async function toggle(id: string) {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
    setBusy(true);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      await supabase
        .from("user_language_profiles")
        .update({ interests: Array.from(next) })
        .eq("user_id", user.id)
        .eq("language_code", langCode);
    }
    setBusy(false);
    router.refresh();
  }

  return (
    <div className="mt-4 rounded-xl border border-line bg-surface/60 px-4 py-3">
      <button
        className="flex w-full items-center justify-between"
        onClick={() => setOpen(!open)}
      >
        <span className="font-mono text-[10px] tracking-[0.3em] text-dust">
          MY INTERESTS{selected.size ? ` · ${selected.size}` : ""}
        </span>
        <span className="font-mono text-xs text-dust">{open ? "−" : "+"}</span>
      </button>
      {open && (
        <div className="mt-3">
          <div className="flex flex-wrap gap-2">
            {CATEGORIES.map((c) => {
              const on = selected.has(c.id);
              return (
                <button
                  key={c.id}
                  disabled={busy}
                  onClick={() => toggle(c.id)}
                  className={`rounded-full border px-3 py-1.5 text-xs transition-colors ${
                    on
                      ? "border-lamp bg-lamp/15 text-lamp"
                      : "border-line text-dust hover:border-lamp-dim hover:text-cream"
                  }`}
                >
                  {c.emoji} {c.label}
                </button>
              );
            })}
          </div>
          <p className="mt-2 text-xs text-dust">
            {selected.size
              ? "Your feed shows only these topics. Deselect everything to see it all."
              : "Pick a few topics and your feed narrows to them — or leave empty for everything."}
          </p>
        </div>
      )}
    </div>
  );
}