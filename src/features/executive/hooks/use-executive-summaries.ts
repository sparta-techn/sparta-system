/**
 * useExecutiveSummaries — drives the dashboard's AI summary panel.
 *
 * Holds per-topic generation state and calls the shared AI assistant (offline
 * mock provider by default) through {@link generateExecutiveSummary}. Nothing
 * here is provider-specific.
 */
import { useCallback, useMemo, useRef, useState } from "react";
import type { PromptUser } from "@/ai";
import { useAuth } from "@/features/auth/auth-context";
import {
  EXECUTIVE_SUMMARY_TOPICS,
  generateExecutiveSummary,
  type GenerateSummaryOptions,
} from "../ai/executive-summaries";

export type SummaryStatus = "idle" | "loading" | "ready" | "error";

export interface SummaryState {
  status: SummaryStatus;
  text?: string;
  error?: string;
  model?: string;
  /** Epoch ms when the summary was produced. */
  generatedAt?: number;
}

type SummaryMap = Record<string, SummaryState>;

const INITIAL: SummaryMap = Object.fromEntries(
  EXECUTIVE_SUMMARY_TOPICS.map((t) => [t.key, { status: "idle" as const }]),
);

export interface UseExecutiveSummaries {
  summaries: SummaryMap;
  /** True while any topic is generating. */
  busy: boolean;
  /** Generate a single topic by key. */
  generate: (key: string) => Promise<void>;
  /** Generate all six topics (idempotent per topic; skips in-flight ones). */
  generateAll: () => Promise<void>;
}

export function useExecutiveSummaries(options: GenerateSummaryOptions = {}): UseExecutiveSummaries {
  const { user, profile, roles } = useAuth();
  const [summaries, setSummaries] = useState<SummaryMap>(INITIAL);
  const inFlight = useRef<Set<string>>(new Set());

  const promptUser = useMemo<PromptUser>(
    () => ({
      id: user?.id ?? "anonymous",
      displayName: profile?.display_name ?? profile?.full_name ?? user?.email ?? "there",
      roles: roles as string[],
    }),
    [user?.id, user?.email, profile?.display_name, profile?.full_name, roles],
  );

  // Keep the latest options without forcing new callback identities each render.
  const optionsRef = useRef(options);
  optionsRef.current = options;

  const generate = useCallback(
    async (key: string) => {
      const topic = EXECUTIVE_SUMMARY_TOPICS.find((t) => t.key === key);
      if (!topic || inFlight.current.has(key)) return;

      inFlight.current.add(key);
      setSummaries((prev) => ({
        ...prev,
        [key]: { ...prev[key], status: "loading", error: undefined },
      }));

      try {
        const result = await generateExecutiveSummary(
          topic.featureId,
          promptUser,
          optionsRef.current,
        );
        setSummaries((prev) => ({
          ...prev,
          [key]: {
            status: "ready",
            text: result.text,
            model: result.model,
            generatedAt: Date.now(),
          },
        }));
      } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to generate summary";
        setSummaries((prev) => ({
          ...prev,
          [key]: { ...prev[key], status: "error", error: message },
        }));
      } finally {
        inFlight.current.delete(key);
      }
    },
    [promptUser],
  );

  const generateAll = useCallback(async () => {
    await Promise.all(EXECUTIVE_SUMMARY_TOPICS.map((t) => generate(t.key)));
  }, [generate]);

  const busy = Object.values(summaries).some((s) => s.status === "loading");

  return { summaries, busy, generate, generateAll };
}
