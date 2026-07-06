import { createFileRoute } from "@tanstack/react-router";
import { PreviewBanner } from "@/components/preview-banner";
import { MyTimeLogs } from "@/features/time-tracking/components/my-time-logs";

export const Route = createFileRoute("/_authenticated/app/tasks/time")({
  head: () => ({ meta: [{ title: "My time logs · SpartaFlow Hub" }] }),
  component: TimeLogsPage,
});

function TimeLogsPage() {
  return (
    <>
      <PreviewBanner description="Time tracking is an early preview — your timers and entries are kept only in this browser and aren't saved to the server or shared yet." />
      <MyTimeLogs />
    </>
  );
}
