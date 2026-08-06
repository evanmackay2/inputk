"use client";

import { useEffect, useRef, useState } from "react";
import { fmtClock } from "@/lib/levels";

declare global {
  interface Window {
    YT: any;
    onYouTubeIframeAPIReady?: () => void;
  }
}

const POLL_MS = 1000;
const FLUSH_MS = 10_000;

/**
 * Embeds the YouTube IFrame player and reports watch time.
 *
 * Time only accrues while player state === PLAYING, per-tick deltas are clamped
 * (so seeking never inflates the counter), and the server re-validates every
 * heartbeat against wall-clock elapsed time. sendBeacon covers tab closes.
 */
export function Player({
  videoId,
  baseSeconds,
}: {
  videoId: string;
  baseSeconds: number; // profile total at page load, for the live clock
}) {
  const playerRef = useRef<any>(null);
  const sessionRef = useRef<string | null>(null);
  const acc = useRef(0);          // seconds accumulated since last flush
  const lastTime = useRef(0);     // last observed player position
  const maxPos = useRef(0);
  const [live, setLive] = useState(baseSeconds);
  const [playing, setPlaying] = useState(false);
  const [unplayable, setUnplayable] = useState(false);

  useEffect(() => {
    let poll: ReturnType<typeof setInterval>;
    let flushTimer: ReturnType<typeof setInterval>;
    let destroyed = false;

    // open a session first so heartbeats have somewhere to land
    fetch("/api/watch/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ videoId }),
    })
      .then((r) => r.json())
      .then((d) => { sessionRef.current = d.sessionId ?? null; })
      .catch(() => {});

    function flush(useBeacon = false) {
      if (!sessionRef.current || acc.current < 1) return;
      const payload = JSON.stringify({
        sessionId: sessionRef.current,
        seconds: acc.current,
        maxPosition: maxPos.current,
      });
      acc.current = 0;
      if (useBeacon && navigator.sendBeacon) {
        navigator.sendBeacon("/api/watch/heartbeat", new Blob([payload], { type: "application/json" }));
      } else {
        fetch("/api/watch/heartbeat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: payload,
          keepalive: true,
        }).catch(() => {});
      }
    }

    function createPlayer() {
      if (destroyed) return;
      playerRef.current = new window.YT.Player("yt-player", {
        videoId,
        playerVars: { rel: 0, modestbranding: 1 },
        events: {
          onReady: () => {
            poll = setInterval(() => {
              const p = playerRef.current;
              if (!p?.getPlayerState) return;
              const isPlaying = p.getPlayerState() === 1;
              setPlaying(isPlaying);
              const now = p.getCurrentTime?.() ?? 0;
              if (isPlaying) {
                const delta = now - lastTime.current;
                // count only plausible forward motion; a seek produces |delta| >> poll interval
                if (delta > 0 && delta < (POLL_MS / 1000) * 1.8) {
                  acc.current += delta;
                  setLive((v) => v + delta);
                }
                maxPos.current = Math.max(maxPos.current, now);
              }
              lastTime.current = now;
            }, POLL_MS);
            flushTimer = setInterval(() => flush(), FLUSH_MS);
          },
          onError: () => setUnplayable(true), // embed revoked since ingest
        },
      });
    }

    if (window.YT?.Player) {
      createPlayer();
    } else {
      const tag = document.createElement("script");
      tag.src = "https://www.youtube.com/iframe_api";
      document.body.appendChild(tag);
      const prev = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = () => { prev?.(); createPlayer(); };
    }

    const onHide = () => { if (document.hidden) flush(true); };
    const onPageHide = () => flush(true);
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("pagehide", onPageHide);

    return () => {
      destroyed = true;
      flush(true);
      clearInterval(poll);
      clearInterval(flushTimer);
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("pagehide", onPageHide);
      playerRef.current?.destroy?.();
    };
  }, [videoId]);

  if (unplayable) {
    return (
      <div className="card flex aspect-video items-center justify-center p-8 text-center">
        <div>
          <p className="text-dust">This video can no longer be embedded.</p>
          <a
            href={`https://www.youtube.com/watch?v=${videoId}`}
            target="_blank"
            rel="noreferrer"
            className="btn-ghost mt-4 text-sm"
          >
            Watch on YouTube ↗
          </a>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="overflow-hidden rounded-xl border border-line bg-black">
        <div className="aspect-video">
          <div id="yt-player" className="h-full w-full" />
        </div>
      </div>
      <div className="mt-3 flex items-center gap-3">
        <span
          className={`inline-block h-2 w-2 rounded-full ${playing ? "bg-lamp" : "bg-line"}`}
          style={playing ? { boxShadow: "0 0 10px rgba(255,180,84,.8)" } : undefined}
        />
        <span className="clock text-xl">{fmtClock(live)}</span>
        <span className="font-mono text-[10px] tracking-widest text-dust">
          {playing ? "ON AIR — CLOCK RUNNING" : "PAUSED"}
        </span>
      </div>
    </div>
  );
}
