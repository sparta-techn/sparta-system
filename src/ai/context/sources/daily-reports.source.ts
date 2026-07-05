/**
 * Daily Reports source — the user's recent end-of-day reports and status updates
 * (morning check-in / midday). Reads through the reports services.
 */

import { dailyReportsService, statusUpdatesService } from "@/services";
import type { ContextEntity, ContextSource } from "../../types";
import { clampList, emptyFragment, fragment, snippet } from "./source-utils";

export const dailyReportsSource: ContextSource = {
  key: "daily_reports",
  label: "Daily Reports",

  async gather({ userId }) {
    const [reports, updates] = await Promise.all([
      dailyReportsService.listByUser(userId, {
        limit: 3,
        orderBy: "work_date",
        direction: "desc",
      }),
      statusUpdatesService.listByUser(userId, {
        limit: 3,
        orderBy: "work_date",
        direction: "desc",
      }),
    ]);

    const entities: ContextEntity[] = [];

    const clampedReports = clampList(reports, 3);
    for (const r of clampedReports.items) {
      const summary = snippet(r.summary, 160) || "(no summary)";
      entities.push({
        type: "daily_report",
        id: r.id,
        ref: r.work_date,
        summary: `EOD ${r.work_date} [${r.status}] — ${summary}`,
      });
    }

    const clampedUpdates = clampList(updates, 3);
    for (const u of clampedUpdates.items) {
      const focus = u.current_focus ?? u.main_goal ?? "";
      const progress = u.progress != null ? `${u.progress}%` : "—";
      entities.push({
        type: "status_update",
        id: u.id,
        ref: u.work_date,
        summary: snippet(
          `${u.kind} ${u.work_date} — progress ${progress}${focus ? `; focus: ${focus}` : ""}`,
          160,
        ),
      });
    }

    if (entities.length === 0) {
      return emptyFragment("daily_reports", this.label, "No recent reports submitted.");
    }
    return fragment("daily_reports", this.label, entities, {
      truncated: clampedReports.truncated || clampedUpdates.truncated,
    });
  },
};
