"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Entry = {
  id: string;
  day: string;
  minutes: number;
  note: string;
};

export function ManualEntry({ langCode, entries }: { langCode: string; entries: Entry[] }) {
  const router = useRouter();
  const [minutes, setMinutes] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function add() {
    const m = parseInt(minutes, 10);
    if (!m || m < 1 || m > 1440) {
      setError("Enter minutes between 1 and 1440.");
      return;
    }
    setBusy(true);
    setError(null);
    const supabase = createClient();
    const { error } = await supabase.rpc("add_manual_input", {
      p_language_code: langCode,
      p_minutes: m,
      p_note: note,
    });
    setBusy(false);
    if (error) return setError(error.message);
    setMinutes("");
    setNote("");
    router.refresh();
  }

  async function remove(id: string) {
    setBusy(true);
    const supabase = createClient();
    const { error } = await supabase.rpc("delete_manual_entry", { p_entry_id: id });
    setBusy(false);
    if (error) return setError(error.message);
    router.refresh();
  }

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        <input
          className="input w-28"
          type="number"
          min={1}
          max={1440}
          placeholder="Minutes"
          value={minutes}
          onChange={(e) => setMinutes(e.target.value)}
        />
        <input
          className="input flex-1 min-w-40"
          type="text"
          maxLength={200}
          placeholder="What was it? (podcast, series, a conversation…)"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && add()}
        />
        <button className="btn-lamp" onClick={add} disabled={busy}>
          Log it
        </button>
      </div>
      {error && <p className="mt-2 text-sm text-[#E8555E]">{error}</p>}
      <p className="mt-2 text-xs text-dust">
        Counts toward today. Podcasts, shows, conversations — input is input.
      </p>

      {entries.length > 0 && (
        <div className="mt-4 divide-y divide-line">
          {entries.map((e) => (
            <div key={e.id} className="flex items-center justify-between gap-3 py-2">
              <div className="min-w-0">
                <span className="font-mono text-sm text-lamp">{e.minutes}m</span>
                <span className="ml-3 truncate text-sm text-dust">{e.note || "manual input"}</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="font-mono text-[10px] text-dust">{e.day}</span>
                <button
                  className="font-mono text-[10px] tracking-widest text-dust hover:text-[#E8555E]"
                  onClick={() => remove(e.id)}
                  disabled={busy}
                >
                  UNDO
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
