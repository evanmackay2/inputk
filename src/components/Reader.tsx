"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Segment = { t: number; d: number; text: string };
type WordStatus = "learning" | "known";

const normalize = (w: string) => w.normalize("NFC").toLowerCase();

// Tokenize with Intl.Segmenter when available (handles Japanese etc.);
// fall back to a Unicode-letter regex split.
function tokenize(text: string, lang: string): { s: string; isWord: boolean }[] {
  if (typeof Intl !== "undefined" && "Segmenter" in Intl) {
    const seg = new Intl.Segmenter(lang, { granularity: "word" });
    return Array.from(seg.segment(text)).map((x: any) => ({
      s: x.segment,
      isWord: !!x.isWordLike,
    }));
  }
  return text.split(/(\p{L}[\p{L}\p{M}'’-]*)/u).filter(Boolean).map((s) => ({
    s,
    isWord: /^\p{L}/u.test(s),
  }));
}

async function fetchDefinition(word: string, lang: string): Promise<string[]> {
  try {
    const res = await fetch(
      `https://en.wiktionary.org/api/rest_v1/page/definition/${encodeURIComponent(word)}`,
      { headers: { Accept: "application/json" } }
    );
    if (!res.ok) return [];
    const data = await res.json();
    const entries = data[lang] ?? data[Object.keys(data)[0]] ?? [];
    const defs: string[] = [];
    for (const entry of entries) {
      for (const d of entry.definitions ?? []) {
        const clean = (d.definition ?? "").replace(/<[^>]*>/g, "").trim();
        if (clean) defs.push(clean);
        if (defs.length >= 4) return defs;
      }
    }
    return defs;
  } catch {
    return [];
  }
}

export function Reader({ videoId, langCode }: { videoId: string; langCode: string }) {
  const [segments, setSegments] = useState<Segment[] | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "unavailable">("loading");
  const [words, setWords] = useState<Map<string, WordStatus>>(new Map());
  const [activeIdx, setActiveIdx] = useState(-1);
  const [popup, setPopup] = useState<{ word: string; x: number; y: number } | null>(null);
  const [defs, setDefs] = useState<string[] | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // transcript + saved words
  useEffect(() => {
    fetch(`/api/transcript/${videoId}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.status === "fetched" && d.segments?.length) {
          setSegments(d.segments);
          setStatus("ready");
        } else setStatus("unavailable");
      })
      .catch(() => setStatus("unavailable"));

    const supabase = createClient();
    supabase
      .from("user_words")
      .select("word, status")
      .eq("language_code", langCode)
      .then(({ data }) => {
        if (data) setWords(new Map(data.map((w) => [w.word, w.status as WordStatus])));
      });
  }, [videoId, langCode]);

  // follow the player clock
  useEffect(() => {
    const onTime = (e: Event) => {
      const t = (e as CustomEvent<number>).detail;
      if (!segments) return;
      const idx = segments.findIndex((s) => t >= s.t && t < s.t + s.d + 0.5);
      if (idx !== -1) setActiveIdx(idx);
    };
    window.addEventListener("inputtv:time", onTime);
    return () => window.removeEventListener("inputtv:time", onTime);
  }, [segments]);

  // stats for this video
  const { knownCount, learningCount, newInVideo } = useMemo(() => {
    let known = 0, learning = 0;
    words.forEach((s) => (s === "known" ? known++ : learning++));
    const fresh = new Set<string>();
    if (segments) {
      for (const seg of segments) {
        for (const tok of tokenize(seg.text, langCode)) {
          if (!tok.isWord) continue;
          const n = normalize(tok.s);
          if (n && !words.has(n)) fresh.add(n);
        }
      }
    }
    return { knownCount: known, learningCount: learning, newInVideo: fresh.size };
  }, [words, segments, langCode]);

  const openPopup = useCallback((word: string, e: React.MouseEvent) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = Math.min(e.clientX - rect.left, rect.width - 290);
    const y = e.clientY - rect.top + 20;
    setPopup({ word: normalize(word), x: Math.max(0, x), y });
    setDefs(null);
  }, []);

  useEffect(() => {
    if (!popup) return;
    let alive = true;
    fetchDefinition(popup.word, langCode).then((d) => alive && setDefs(d));
    return () => { alive = false; };
  }, [popup, langCode]);

  async function mark(word: string, s: WordStatus) {
    const next = new Map(words);
    next.set(word, s);
    setWords(next);
    setPopup(null);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await supabase.from("user_words").upsert({
      user_id: user.id,
      language_code: langCode,
      word,
      status: s,
      updated_at: new Date().toISOString(),
    });
  }

  async function forget(word: string) {
    const next = new Map(words);
    next.delete(word);
    setWords(next);
    setPopup(null);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await supabase
      .from("user_words")
      .delete()
      .eq("user_id", user.id)
      .eq("language_code", langCode)
      .eq("word", word);
  }

  function seek(t: number) {
    window.dispatchEvent(new CustomEvent("inputtv:seek", { detail: t }));
  }

  if (status === "loading") {
    return <p className="mt-6 font-mono text-xs tracking-widest text-dust">LOADING TRANSCRIPT…</p>;
  }
  if (status === "unavailable" || !segments) {
    return (
      <p className="mt-6 text-sm text-dust">
        No transcript available for this video — the reader needs captions to exist on YouTube.
      </p>
    );
  }

  const wordClass = (s: WordStatus | undefined) =>
    s === "known"
      ? "cursor-pointer hover:text-lamp"
      : s === "learning"
      ? "cursor-pointer rounded-sm bg-lamp/20 border-b border-dotted border-lamp hover:bg-lamp/30"
      : "cursor-pointer rounded-sm bg-[#6FA8DC]/15 border-b border-dotted border-[#6FA8DC] hover:bg-[#6FA8DC]/25";

  return (
    <div className="mt-8" ref={containerRef} style={{ position: "relative" }}>
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line pb-3">
        <h2 className="font-mono text-xs tracking-[0.3em] text-dust">TRANSCRIPT · READER</h2>
        <div className="flex gap-4 font-mono text-[11px] tracking-wider">
          <span className="text-cream">{knownCount.toLocaleString()} known</span>
          <span className="text-lamp">{learningCount.toLocaleString()} learning</span>
          <span className="text-[#6FA8DC]">{newInVideo.toLocaleString()} new here</span>
        </div>
      </div>

      <div className="mt-4 space-y-1 text-[17px] leading-relaxed">
        {segments.map((seg, i) => (
          <p
            key={i}
            className={`rounded-lg px-2 py-1 transition-colors ${i === activeIdx ? "bg-surface" : ""}`}
          >
            <button
              className="mr-2 select-none font-mono text-[10px] text-dust hover:text-lamp align-middle"
              onClick={() => seek(seg.t)}
              title="Jump the video here"
            >
              {Math.floor(seg.t / 60)}:{String(Math.floor(seg.t % 60)).padStart(2, "0")}
            </button>
            {tokenize(seg.text, langCode).map((tok, j) =>
              tok.isWord ? (
                <span
                  key={j}
                  className={wordClass(words.get(normalize(tok.s)))}
                  onClick={(e) => openPopup(tok.s, e)}
                >
                  {tok.s}
                </span>
              ) : (
                <span key={j}>{tok.s}</span>
              )
            )}
          </p>
        ))}
      </div>

      {popup && (
        <div
          className="absolute z-40 w-72 rounded-xl border border-line bg-raised p-4 shadow-xl"
          style={{ left: popup.x, top: popup.y }}
        >
          <div className="flex items-start justify-between gap-2">
            <span className="font-display text-xl">{popup.word}</span>
            <button className="text-dust hover:text-cream" onClick={() => setPopup(null)}>✕</button>
          </div>
          <div className="mt-2 max-h-36 overflow-y-auto text-sm text-dust">
            {defs === null && <p className="font-mono text-[10px] tracking-widest">LOOKING UP…</p>}
            {defs?.length === 0 && (
              <p>
                No dictionary entry found.{" "}
                <a
                  className="text-lamp"
                  target="_blank"
                  rel="noreferrer"
                  href={`https://translate.google.com/?sl=${langCode}&tl=en&text=${encodeURIComponent(popup.word)}`}
                >
                  Translate ↗
                </a>
              </p>
            )}
            {defs?.map((d, i) => (
              <p key={i} className="mb-1.5">
                <span className="text-lamp">{i + 1}.</span> {d}
              </p>
            ))}
          </div>
          <div className="mt-3 flex gap-2">
            <button
              className="btn flex-1 border border-lamp bg-lamp/15 text-xs text-lamp hover:bg-lamp/30"
              onClick={() => mark(popup.word, "learning")}
            >
              Learning
            </button>
            <button
              className="btn flex-1 border border-line text-xs text-cream hover:border-lamp"
              onClick={() => mark(popup.word, "known")}
            >
              Known ✓
            </button>
            {words.has(popup.word) && (
              <button
                className="btn border border-line text-xs text-dust hover:text-[#E8555E]"
                onClick={() => forget(popup.word)}
                title="Remove from my words"
              >
                ↺
              </button>
            )}
          </div>
          <p className="mt-2 text-[10px] text-dust">
            Definitions from Wiktionary · blue = new, amber = learning, plain = known
          </p>
        </div>
      )}
    </div>
  );
}