import { createFileRoute } from "@tanstack/react-router";
import { OffboardingBoard } from "@/features/hr/components/onboarding-boards";

export const Route = createFileRoute("/_authenticated/app/hr/offboarding")({
  head: () => ({ meta: [{ title: "Offboarding · SpartaFlow Hub" }] }),
  component: () => <OffboardingBoard />,
});
