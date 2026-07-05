import { RefreshCw, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Markdown } from "@/features/ai/components/markdown";
import { EXECUTIVE_SUMMARY_TOPICS } from "../ai/executive-summaries";
import { useExecutiveSummaries, type SummaryState } from "../hooks/use-executive-summaries";

function SummaryBody({ state, onGenerate }: { state: SummaryState; onGenerate: () => void }) {
  if (state.status === "loading") {
    return (
      <div className="space-y-2" aria-hidden>
        <Skeleton className="h-3 w-11/12" />
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-3 w-4/5" />
        <Skeleton className="h-3 w-2/3" />
      </div>
    );
  }

  if (state.status === "error") {
    return (
      <div className="space-y-2">
        <p className="text-sm text-destructive">{state.error ?? "Failed to generate."}</p>
        <Button variant="outline" size="sm" onClick={onGenerate}>
          Try again
        </Button>
      </div>
    );
  }

  if (state.status === "ready" && state.text) {
    return (
      <div className="space-y-2">
        <div className="max-h-72 overflow-y-auto pr-1 text-sm">
          <Markdown content={state.text} />
        </div>
        {state.model ? (
          <p className="text-[11px] text-muted-foreground">Generated · {state.model}</p>
        ) : null}
      </div>
    );
  }

  return (
    <p className="text-sm text-muted-foreground">
      Not generated yet. Generate an AI summary grounded in the latest company data.
    </p>
  );
}

/**
 * ExecutiveSummaries — the six AI-generated leadership summaries. Owns the
 * generation hook; each card generates on demand through the shared AI service.
 */
export function ExecutiveSummaries() {
  const { summaries, busy, generate, generateAll } = useExecutiveSummaries({
    variables: { period: "the last 30 days", date: "today" },
  });

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Sparkles className="size-4 text-primary" aria-hidden />
          AI-generated summaries grounded in live operational data.
        </div>
        <Button variant="outline" size="sm" onClick={generateAll} disabled={busy}>
          <RefreshCw className={`size-4 ${busy ? "animate-spin" : ""}`} aria-hidden />
          {busy ? "Generating…" : "Generate all"}
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {EXECUTIVE_SUMMARY_TOPICS.map((topic) => {
          const state = summaries[topic.key] ?? { status: "idle" as const };
          const Icon = topic.icon;
          const generated = state.status === "ready";
          return (
            <Card key={topic.key} className="flex flex-col">
              <CardHeader>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <div
                      className="grid size-8 shrink-0 place-items-center rounded-lg bg-primary-soft text-primary"
                      aria-hidden
                    >
                      <Icon className="size-4" />
                    </div>
                    <div>
                      <CardTitle className="text-sm">{topic.title}</CardTitle>
                      <p className="text-xs text-muted-foreground">{topic.description}</p>
                    </div>
                  </div>
                  {generated ? (
                    <Badge variant="outline" className="shrink-0 text-[10px]">
                      AI
                    </Badge>
                  ) : null}
                </div>
              </CardHeader>
              <CardContent className="flex flex-1 flex-col justify-between gap-3">
                <SummaryBody state={state} onGenerate={() => generate(topic.key)} />
                <Button
                  variant={generated ? "ghost" : "secondary"}
                  size="sm"
                  className="self-start"
                  onClick={() => generate(topic.key)}
                  disabled={state.status === "loading"}
                >
                  {generated ? "Regenerate" : "Generate"}
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
