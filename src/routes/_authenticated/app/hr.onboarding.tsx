import { createFileRoute } from "@tanstack/react-router";
import { OnboardingBoard } from "@/features/hr/components/onboarding-boards";

export const Route = createFileRoute("/_authenticated/app/hr/onboarding")({
  head: () => ({ meta: [{ title: "Onboarding · SpartaFlow Hub" }] }),
  component: () => <OnboardingBoard />,
});
