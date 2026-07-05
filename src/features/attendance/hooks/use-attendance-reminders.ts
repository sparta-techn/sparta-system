import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { useQuery } from "@tanstack/react-query";

import { companySettingsQuery } from "../queries";
import type { TodaySession } from "../types";

interface Reminder {
  /** Hour in 24h company timezone (we approximate with browser local time). */
  hour: number;
  minute: number;
  /** Unique key per day so each fires once. */
  key: string;
  message: string;
  shouldFire: (session: TodaySession | undefined) => boolean;
}

const STORAGE_KEY = "spartaflow.reminders.fired";

function loadFired(): Record<string, true> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as { date: string; keys: string[] };
    const today = new Date().toISOString().slice(0, 10);
    if (parsed.date !== today) return {};
    return parsed.keys.reduce<Record<string, true>>((acc, k) => {
      acc[k] = true;
      return acc;
    }, {});
  } catch {
    return {};
  }
}

function saveFired(map: Record<string, true>) {
  if (typeof window === "undefined") return;
  const today = new Date().toISOString().slice(0, 10);
  window.localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({ date: today, keys: Object.keys(map) }),
  );
}

/**
 * Surfaces in-browser reminders as toasts at company-defined moments:
 *  - 30 min after work_start_time: nudge to start work
 *  - 17:30 local: end-of-day report nudge
 *  - 18:00 local: checkout nudge
 *
 * Reminders fire at most once per day per key, persisted in localStorage.
 * Backend cron / push notifications are a future phase.
 */
export function useAttendanceReminders(today: TodaySession | undefined) {
  const settingsQ = useQuery(companySettingsQuery());
  const firedRef = useRef<Record<string, true>>(loadFired());

  useEffect(() => {
    if (!settingsQ.data) return;
    const startTime = settingsQ.data.work_start_time; // "HH:MM:SS"
    const [sh, sm] = startTime.split(":").map(Number);
    const reminderH = sh ?? 9;
    const reminderM = (sm ?? 0) + 30;
    const startHour = reminderM >= 60 ? reminderH + 1 : reminderH;
    const startMin = reminderM % 60;

    const reminders: Reminder[] = [
      {
        hour: startHour,
        minute: startMin,
        key: `start-${startHour}-${startMin}`,
        message: "Have you started work? Open today's session from the dashboard.",
        shouldFire: (t) => !t?.session || t.session.session_status === "not_started",
      },
      {
        hour: 17,
        minute: 30,
        key: "eod-1730",
        message: "Heads up — submit your end-of-day report before checkout.",
        shouldFire: (t) =>
          !!t?.session && t.session.session_status !== "finished",
      },
      {
        hour: 18,
        minute: 0,
        key: "checkout-1800",
        message: "You haven't checked out yet. Wrap up and finish your session.",
        shouldFire: (t) =>
          !!t?.session && t.session.session_status !== "finished",
      },
    ];

    const tick = () => {
      const now = new Date();
      for (const r of reminders) {
        if (firedRef.current[r.key]) continue;
        const target = new Date(now);
        target.setHours(r.hour, r.minute, 0, 0);
        if (now < target) continue;
        // Within 5 minutes after target → fire once.
        if (now.getTime() - target.getTime() > 5 * 60_000) {
          firedRef.current[r.key] = true; // missed window, don't spam later
          saveFired(firedRef.current);
          continue;
        }
        if (!r.shouldFire(today)) {
          firedRef.current[r.key] = true;
          saveFired(firedRef.current);
          continue;
        }
        toast(r.message, { duration: 8000 });
        firedRef.current[r.key] = true;
        saveFired(firedRef.current);
      }
    };

    tick();
    const id = window.setInterval(tick, 60_000);
    return () => window.clearInterval(id);
  }, [settingsQ.data, today]);
}
