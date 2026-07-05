import { describe, expect, it } from "vitest";

import { getFeature } from "@/ai";
import { EXECUTIVE_SUMMARY_TOPICS } from "./executive-summaries";

const SURFACES = new Set([
  "global",
  "tasks",
  "projects",
  "sprints",
  "analytics",
  "reports",
  "dependencies",
]);

describe("executive summary topics", () => {
  it("exposes the six required summaries in order", () => {
    expect(EXECUTIVE_SUMMARY_TOPICS.map((t) => t.title)).toEqual([
      "Company Health",
      "Team Performance",
      "Project Risks",
      "Attendance Trends",
      "Engineering Productivity",
      "Delivery Forecast",
    ]);
  });

  it("maps each topic to a registered owner AI feature", () => {
    for (const topic of EXECUTIVE_SUMMARY_TOPICS) {
      const feature = getFeature(topic.featureId);
      expect(feature.audience).toBe("owner");
    }
  });

  it("builds a grounded { surface, prompt } for each summary", () => {
    for (const topic of EXECUTIVE_SUMMARY_TOPICS) {
      const feature = getFeature(topic.featureId);
      const request = feature.build({
        user: { id: "u1", displayName: "Owner", roles: ["owner"] },
        variables: { period: "the last 30 days", date: "today" },
      });
      expect(request.prompt.length).toBeGreaterThan(0);
      // A real, engine-recognised surface so the Context Engine can ground it.
      expect(request.surface === null || SURFACES.has(request.surface)).toBe(true);
    }
  });
});
