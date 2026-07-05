/**
 * Executive summary catalog + generation helper.
 *
 * Maps the six dashboard summary topics onto their registered AI feature ids and
 * runs them through the **existing** `aiAssistant` (`AIAssistantService`). There
 * is no provider-specific logic here — the assistant owns provider selection and
 * defaults to the offline mock provider.
 */
import type { LucideIcon } from "lucide-react";
import {
  AlertTriangle,
  CalendarClock,
  GaugeCircle,
  HeartPulse,
  TrendingUp,
  Users,
} from "lucide-react";
import { aiAssistant } from "@/ai";
import type { AIFeatureResult, PromptUser } from "@/ai";

export interface ExecutiveSummaryTopic {
  /** Stable key used for state + React keys. */
  key: string;
  title: string;
  description: string;
  /** Registered AI feature id (see `src/ai/features/executive.ts`). */
  featureId: string;
  icon: LucideIcon;
}

/** The six executive summaries, in dashboard display order. */
export const EXECUTIVE_SUMMARY_TOPICS: ExecutiveSummaryTopic[] = [
  {
    key: "company-health",
    title: "Company Health",
    description: "Overall health across delivery, people and dependencies.",
    featureId: "executive-company-health",
    icon: HeartPulse,
  },
  {
    key: "team-performance",
    title: "Team Performance",
    description: "Reports, attendance and workload across teams.",
    featureId: "executive-team-performance",
    icon: Users,
  },
  {
    key: "project-risks",
    title: "Project Risks",
    description: "Top delivery risks with evidence and mitigations.",
    featureId: "executive-project-risks",
    icon: AlertTriangle,
  },
  {
    key: "attendance-trends",
    title: "Attendance Trends",
    description: "Attendance and punctuality trends company-wide.",
    featureId: "executive-attendance-trends",
    icon: CalendarClock,
  },
  {
    key: "engineering-productivity",
    title: "Engineering Productivity",
    description: "Velocity, throughput and blockers.",
    featureId: "executive-engineering-productivity",
    icon: GaugeCircle,
  },
  {
    key: "delivery-forecast",
    title: "Delivery Forecast",
    description: "Forward outlook from velocity vs remaining scope.",
    featureId: "executive-delivery-forecast",
    icon: TrendingUp,
  },
];

export interface GenerateSummaryOptions {
  /** Prompt template variables (e.g. `period`, `date`). */
  variables?: Record<string, string>;
  /** Context grounding hints forwarded to the engine. */
  hints?: Record<string, unknown>;
}

/**
 * Generate one executive summary through the shared AI assistant. Thin wrapper
 * over `aiAssistant.run` so the dashboard never touches feature/provider wiring.
 */
export function generateExecutiveSummary(
  featureId: string,
  user: PromptUser,
  options: GenerateSummaryOptions = {},
): Promise<AIFeatureResult> {
  return aiAssistant.run(featureId, {
    user,
    variables: options.variables,
    hints: options.hints,
  });
}
