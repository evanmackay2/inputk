"use client";

import { useEffect, useState } from "react";
import { fmtClock } from "@/lib/levels";

/** Landing-page demo of the input clock, ticking from a plausible mid-journey count. */
export function DemoClock() {
  const [s, setS] = useState(147 * 3600 + 22 * 60 + 41);
  useEffect(() => {
    const id = setInterval(() => setS((v) => v + 1), 1000);
    return () => clearInterval(id);
  }, []);
  return <div className="clock text-5xl sm:text-6xl">{fmtClock(s)}</div>;
}
