/**
 * Sprints source — a project's sprints (`projectId` hint) or the active sprints
 * across visible projects. Reads through the sprints service.
 */

import { sprintsService } from "@/services";
import type { ContextEntity, ContextSource } from "../../types";
import { clampList, emptyFragment, fragment, hintString, snippet } from "./source-utils";
import type { Sprint } from "@/features/sprints/types";

function summarize(s: Sprint): ContextEntity {
  const goal = s.goal ? `; goal: ${snippet(s.goal, 80)}` : "";
  return {
    type: "sprint",
    id: s.id,
    ref: s.name,
    summary: `${s.name} — ${s.status}, ${s.startDate}→${s.endDate}, capacity ${s.capacity}${goal}`,
  };
}

export const sprintsSource: ContextSource = {
  key: "sprints",
  label: "Sprints",

  async gather({ hints }) {
    const projectId = hintString(hints, "projectId");
    const rows = projectId
      ? await sprintsService.listByProject(projectId, {
          limit: 5,
          orderBy: "startDate",
          direction: "desc",
        })
      : await sprintsService.listByStatus("active", { limit: 5 });

    if (rows.length === 0) {
      return emptyFragment(
        "sprints",
        this.label,
        projectId ? "No sprints in this project." : "No active sprints.",
      );
    }
    const { items, truncated } = clampList(rows);
    return fragment("sprints", this.label, items.map(summarize), { truncated });
  },
};
