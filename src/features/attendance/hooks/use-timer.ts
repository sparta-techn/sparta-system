import { useEffect, useRef, useState } from "react";

/**
 * Ticking clock that minimizes re-renders by only emitting when the
 * specified granularity changes.
 *
 * - granularity "second": ticks every second.
 * - granularity "minute": ticks once per minute (use for header clocks).
 *
 * Components that don't need second-resolution should use "minute".
 */
export function useNow(granularity: "second" | "minute" = "second") {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const intervalMs = granularity === "second" ? 1000 : 60_000;
    const id = window.setInterval(() => setNow(new Date()), intervalMs);
    return () => window.clearInterval(id);
  }, [granularity]);
  return now;
}

/**
 * Live elapsed seconds since `startISO`, or 0 when null.
 * `running` lets the caller pause/resume without remounting.
 */
export function useLiveElapsedSeconds(startISO: string | null, running: boolean): number {
  const [seconds, setSeconds] = useState(() => computeElapsed(startISO));
  const startRef = useRef(startISO);

  useEffect(() => {
    startRef.current = startISO;
    setSeconds(computeElapsed(startISO));
  }, [startISO]);

  useEffect(() => {
    if (!running || !startISO) return;
    const id = window.setInterval(() => {
      setSeconds(computeElapsed(startRef.current));
    }, 1000);
    return () => window.clearInterval(id);
  }, [running, startISO]);

  return seconds;
}

function computeElapsed(startISO: string | null): number {
  if (!startISO) return 0;
  const t = new Date(startISO).getTime();
  if (Number.isNaN(t)) return 0;
  return Math.max(0, Math.floor((Date.now() - t) / 1000));
}

export function formatDurationHMS(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}h ${String(m).padStart(2, "0")}m`;
  if (m > 0) return `${m}m ${String(sec).padStart(2, "0")}s`;
  return `${sec}s`;
}

export function formatDurationLong(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (h === 0) return `${m} min`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}
