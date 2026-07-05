/**
 * Dependencies source — cross-team blockers the user requested or owns. Reads
 * through the dependency-requests service.
 */

import { dependencyRequestsService } from "@/services";
import type { DependencyRequestRow } from "@/services/reports/types";
import type { ContextEntity, ContextSource } from "../../types";
import { clampList, dedupeById, emptyFragment, fragment } from "./source-utils";

/** Dependency states that are still "in flight" and worth surfacing first. */
const OPEN_STATES = new Set(["draft", "pending", "accepted", "in_progress", "blocked"]);

function summarize(d: DependencyRequestRow): ContextEntity {
  const due = d.due_at ? `; due ${d.due_at}` : "";
  return {
    type: "dependency",
    id: d.id,
    ref: d.title,
    summary: `${d.title} — ${d.type}/${d.state}, priority ${d.priority}${due}`,
  };
}

export const dependenciesSource: ContextSource = {
  key: "dependencies",
  label: "Dependencies",

  async gather({ userId }) {
    const [asRequester, asOwner] = await Promise.all([
      dependencyRequestsService.listByRequester(userId, {
        limit: 10,
        orderBy: "updated_at",
        direction: "desc",
      }),
      dependencyRequestsService.listByOwner(userId, {
        limit: 10,
        orderBy: "updated_at",
        direction: "desc",
      }),
    ]);

    const merged = dedupeById([...asRequester, ...asOwner]);
    if (merged.length === 0) {
      return emptyFragment("dependencies", this.label, "No dependencies requested or owned.");
    }

    // Open items first, then the rest.
    const ordered = [...merged].sort((a, b) => {
      const aOpen = OPEN_STATES.has(a.state) ? 0 : 1;
      const bOpen = OPEN_STATES.has(b.state) ? 0 : 1;
      return aOpen - bOpen;
    });

    const { items, truncated } = clampList(ordered);
    return fragment("dependencies", this.label, items.map(summarize), { truncated });
  },
};
