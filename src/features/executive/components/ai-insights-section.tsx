import { InsightGrid } from "@/features/analytics/components/insight-card";
import { EmptyState } from "@/components/states";
import type { Insight } from "@/features/analytics/types";
import { DashboardSection } from "./dashboard-section";
import { ExecutiveSummaries } from "./executive-summaries";

/**
 * AI Insights — the dashboard's AI surface. Combines quick at-a-glance insight
 * cards with the six on-demand AI executive summaries (Company Health, Team
 * Performance, Project Risks, Attendance Trends, Engineering Productivity,
 * Delivery Forecast), all generated through the shared AI assistant.
 */
export function AiInsightsSection({ insights }: { insights: Insight[] }) {
  return (
    <DashboardSection
      id="ai-insights"
      title="AI Insights"
      description="At-a-glance signals plus AI executive summaries across the company's operating data."
    >
      <div className="space-y-6">
        {insights.length > 0 ? (
          <InsightGrid insights={insights} />
        ) : (
          <EmptyState
            title="No insights yet"
            description="Analyse the latest data to surface signals."
          />
        )}
        <ExecutiveSummaries />
      </div>
    </DashboardSection>
  );
}
