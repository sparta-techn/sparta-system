/**
 * Mock seed for time tracking. Spreads logs across the seeded tasks/users
 * over the last ~30 days so dashboards have something to render.
 */
import { seedTasks } from "@/features/tasks/mock-data";
import { employees } from "@/features/hr/mock-data";
import type { TimeLog } from "./types";

const CURRENT_USER_ID = "emp_001";

function iso(daysAgo: number, hour: number, minute = 0): string {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  d.setHours(hour, minute, 0, 0);
  return d.toISOString();
}

function makeLog(
  i: number,
  taskId: string,
  userId: string,
  daysAgo: number,
  startHour: number,
  durationMin: number,
  description: string | null = null,
  source: "timer" | "manual" = "timer",
): TimeLog {
  const start = iso(daysAgo, startHour, 0);
  const end = new Date(new Date(start).getTime() + durationMin * 60_000).toISOString();
  return {
    id: `tl_${i.toString().padStart(4, "0")}`,
    taskId,
    userId,
    startTime: start,
    endTime: end,
    durationMinutes: durationMin,
    description,
    source,
    createdAt: end,
  };
}

const sampleTasks = seedTasks.slice(0, 24);
const sampleUsers = employees.slice(0, 10).map((e) => e.id);

const logs: TimeLog[] = [];
let counter = 1;

sampleTasks.forEach((task, idx) => {
  const days = [0, 1, 1, 2, 3, 4, 7, 10, 14];
  const offsets = [9, 10, 11, 13, 14, 15, 16];
  for (let j = 0; j < 3 + (idx % 4); j += 1) {
    const userId = sampleUsers[(idx + j) % sampleUsers.length] ?? CURRENT_USER_ID;
    const dur = 25 + ((idx * 7 + j * 13) % 95); // 25-120 min
    logs.push(
      makeLog(
        counter++,
        task.id,
        userId,
        days[(idx + j) % days.length] ?? 1,
        offsets[(idx + j) % offsets.length] ?? 10,
        dur,
        j % 2 === 0 ? "Implementation pass" : "Review & polish",
        j % 4 === 0 ? "manual" : "timer",
      ),
    );
  }
});

// Ensure current user has fresh entries spanning today/week/month
const myTasks = sampleTasks.slice(0, 8);
myTasks.forEach((t, i) => {
  logs.push(makeLog(counter++, t.id, CURRENT_USER_ID, 0, 9 + i, 30 + i * 15, "Focus block"));
});
logs.push(makeLog(counter++, myTasks[0]!.id, CURRENT_USER_ID, 1, 10, 75, "Pairing session"));
logs.push(makeLog(counter++, myTasks[1]!.id, CURRENT_USER_ID, 2, 14, 110, "Bugfix"));
logs.push(makeLog(counter++, myTasks[2]!.id, CURRENT_USER_ID, 6, 11, 90, "Spec review", "manual"));
logs.push(makeLog(counter++, myTasks[3]!.id, CURRENT_USER_ID, 12, 9, 180, "Deep work", "manual"));
logs.push(makeLog(counter++, myTasks[4]!.id, CURRENT_USER_ID, 21, 15, 60, "QA pass"));

// One active timer for the current user on the first sample task.
const activeStart = new Date(Date.now() - 23 * 60_000).toISOString();
logs.push({
  id: `tl_active_001`,
  taskId: myTasks[0]!.id,
  userId: CURRENT_USER_ID,
  startTime: activeStart,
  endTime: null,
  durationMinutes: null,
  description: "Working on this now",
  source: "timer",
  createdAt: activeStart,
});

export const seedTimeLogs: TimeLog[] = logs;
export const TIME_TRACKING_CURRENT_USER_ID = CURRENT_USER_ID;
