# SpartaFlow — Executive Dashboard AI

> How the Executive Dashboard is connected to AI. Six on-demand executive
> summaries are generated through the **existing** AI assistant service — no new
> provider integration, no provider-specific logic.
> Snapshot date: 2026-07-02.

---

## 1. What shipped

The Executive Dashboard's **AI Insights** section now generates six leadership
summaries on demand:

| Summary                      | AI feature id                        | Grounding surface |
| ---------------------------- | ------------------------------------ | ----------------- |
| **Company Health**           | `executive-company-health`           | `analytics`       |
| **Team Performance**         | `executive-team-performance`         | `reports`         |
| **Project Risks**            | `executive-project-risks`            | `projects`        |
| **Attendance Trends**        | `executive-attendance-trends`        | `analytics`       |
| **Engineering Productivity** | `executive-engineering-productivity` | `sprints`         |
| **Delivery Forecast**        | `executive-delivery-forecast`        | `sprints`         |

Each renders as a card with a **Generate / Regenerate** action; a **Generate all**
button runs the six in parallel. Output is rendered with the existing AI
`Markdown` component. Loading, ready, and error states are handled per card.

---

## 2. How it uses the existing AI service

The implementation adds **feature definitions and UI only** — it reuses the whole
AI pipeline already in `src/ai/`:

```
ExecutiveSummaries (UI)
  → useExecutiveSummaries (hook)
    → generateExecutiveSummary(featureId, user, opts)
      → aiAssistant.run(featureId, input)        ← existing AIAssistantService
        → getFeature(featureId).build(input)      → { surface, prompt }
        → AIEngine: Context Engine → Prompt Builder → Provider (mock default)
        → AIFeatureResult { text, provider, model, usage, finishReason }
```

- **Entry point:** `aiAssistant` (`AIAssistantService`) from `@/ai` — the same
  singleton the chat UI uses. The dashboard never touches the engine, context
  sources, prompt builder, or any provider.
- **Provider:** whatever the assistant is configured with; it **defaults to the
  offline `mock` provider**, so the summaries run end-to-end with no API key or
  network. Switching providers is a service-construction concern, untouched here.
- **No provider-specific logic:** there is no OpenAI/Anthropic/Gemini branching in
  the dashboard or the new features — only `{ surface, prompt }` requests, exactly
  like every other feature in `src/ai/features/`.

---

## 3. Files

```
src/ai/features/executive.ts                       # 6 owner AIFeatureDefinitions (EXECUTIVE_FEATURES)
src/ai/features/registry.ts                        # + EXECUTIVE_FEATURES in ALL_AI_FEATURES
src/ai/features/index.ts                           # + EXECUTIVE_FEATURES export

src/features/executive/ai/executive-summaries.ts   # topic catalog + generateExecutiveSummary()
src/features/executive/hooks/use-executive-summaries.ts   # per-topic generation state
src/features/executive/components/executive-summaries.tsx # the six summary cards
src/features/executive/components/ai-insights-section.tsx # renders ExecutiveSummaries
src/features/executive/ai/executive-summaries.test.ts     # registration + build guards
```

---

## 4. The AI features (`src/ai/features/executive.ts`)

Each summary is a standard owner-scoped `AIFeatureDefinition` whose `build()`
returns a grounded `{ surface, prompt }`:

- **Company Health** delegates to the existing `company-health` prompt template
  (`renderRequest(getPrompt("company-health"), …)`) — the prompt is **reused, not
  duplicated**.
- The other five use concise inline prompts, each grounded in an existing surface
  from `SURFACE_SOURCES` (`analytics`, `reports`, `projects`, `sprints`). No new
  context sources or surfaces were introduced.
- Every prompt instructs the model to **stay grounded in `<context>` and not
  invent metrics**, matching the house style of the existing owner features.

They are registered by appending `EXECUTIVE_FEATURES` to `ALL_AI_FEATURES`, so
`getFeature(id)` and `listFeatures("owner")` resolve them like any other feature.

---

## 5. Dashboard integration

- **Catalog** (`ai/executive-summaries.ts`): `EXECUTIVE_SUMMARY_TOPICS` maps each
  topic (key, title, description, icon) to its `featureId`.
  `generateExecutiveSummary()` is a one-line wrapper over `aiAssistant.run`.
- **Hook** (`hooks/use-executive-summaries.ts`): holds `Record<key, SummaryState>`
  (`idle | loading | ready | error`), builds the `PromptUser` from `useAuth`
  (same shape as `useChat`), de-dupes in-flight requests, and exposes
  `generate(key)` / `generateAll()` / `busy`.
- **UI** (`components/executive-summaries.tsx`): six cards; per-card Generate /
  Regenerate, a Generate-all control, `Skeleton` while loading, `Markdown` for the
  result, inline error + retry. Rendered inside the existing **AI Insights**
  dashboard section alongside the at-a-glance `InsightGrid`.

### On-demand, not on-load

Summaries are generated when the user asks (per card or Generate-all), not on
mount — LLM calls are the dashboard's most expensive operation, so they stay
explicit (consistent with `EXECUTIVE_DASHBOARD_PLAN.md §9`, "AI band: manual /
on-demand, never auto-poll").

---

## 6. Design notes

- **Reuse-first (CLAUDE.md):** new code is limited to feature definitions + a hook
  - a component. The engine, context sources, prompt builder, provider registry,
    `Markdown`, `Skeleton`, `Card`, `Button`, and `useAuth` are all reused.
- **RBAC:** features are `audience: "owner"`; context grounding is owner-scoped by
  the service/RLS layer. The route itself should be gated on `owner:access`
  (tracked in `EXECUTIVE_DASHBOARD_PLAN.md §8`).
- **Grounding data:** summaries read live context via the AI context sources
  (offline mock stores today). This is separate from the numeric KPI snapshot in
  `features/executive/mock-data.ts`; the two are complementary.
- **Failure isolation:** a failing summary shows an inline error + retry and does
  not affect the other five or the rest of the dashboard.

---

## 7. Verification

```
npx tsc --noEmit                              # clean
npx eslint src/ai/features src/features/executive   # clean
npx vitest run src/features/executive         # executive-summaries.test.ts passes
```

`executive-summaries.test.ts` asserts the six topics exist in order, each maps to
a **registered owner feature**, and each `build()` returns a non-empty prompt on a
real engine surface — proving the wiring into the existing AI feature system.

---

_Next: gate the route on `owner:access`; optionally stream summaries via
`aiAssistant.runStream` for token-by-token rendering; cache the last completion
per `(topic, period)` so re-opening the dashboard doesn't re-run the model._
