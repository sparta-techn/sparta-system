import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/states";
import { Timeline, type TimelineEvent } from "@/features/analytics/charts";
import { DashboardSection } from "./dashboard-section";

/** Activity Timeline — recent company-wide events, most recent first. */
export function ActivityTimelineSection({ events }: { events: TimelineEvent[] }) {
  return (
    <DashboardSection
      id="activity"
      title="Activity Timeline"
      description="Notable events across projects, delivery, and people."
    >
      <Card>
        <CardContent className="p-5">
          {events.length > 0 ? (
            <Timeline events={events} />
          ) : (
            <EmptyState title="No recent activity" />
          )}
        </CardContent>
      </Card>
    </DashboardSection>
  );
}
