# SpartaFlow — AI Features

> Reference for the role-scoped AI features in `src/ai/features/`, connected to
> the AI service and running on the **offline mock provider** (no external APIs).
> Builds on `docs/AI_INFRASTRUCTURE.md`, `docs/CONTEXT_ENGINE.md` and
> `docs/PROMPTS.md`.
>
> Snapshot date: 2026-07-01. Status: **runs end-to-end offline** — every feature
> produces a deterministic mock completion; no provider key or network is used.

---

## 1. What a "feature" is

An **AI feature** is a named, role-scoped assistant action (Generate Morning Plan,
Detect Blockers, Executive Summary, …). Each feature is a small definition that
**builds a grounded request** — a `surface` (what context to gather) plus a
`prompt` — from typed input. The AI service runs that request through the engine:

```
feature.build(input)          → { surface, prompt }
   → Context Engine.build(surface)   → authorized <context>   (service-sourced, RLS)
   → Prompt Builder                  → system + messages
   → Provider (mock)                 → completion             (offline, deterministic)
   → AIFeatureResult
```

Features never call a provider or a service directly. They connect to one entry
point — `AIAssistantService` — which wires context → prompt → provider.

---

## 2. The catalog (14 features)

### Employee (`EMPLOYEE_FEATURES`)

| Feature id | Title | Backing | Surface | Input |
| --- | --- | --- | --- | --- |
| `generate-morning-plan` | Generate Morning Plan | `morning-plan` template | `global` | `variables.date?` |
| `improve-midday-report` | Improve Midday Report | inline | `reports` | `text` (draft, **required**) |
| `generate-end-of-day-report` | Generate End-of-Day Report | `end-of-day-report` template | `reports` | `variables.date?` |
| `rewrite-text` | Rewrite Text | inline | `null` | `text` (**required**), `instruction?` |
| `summarize-tasks` | Summarize Tasks | inline | `tasks` | — |

### Manager (`MANAGER_FEATURES`)

| Feature id | Title | Backing | Surface | Input |
| --- | --- | --- | --- | --- |
| `summarize-team` | Summarize Team | `team-summary` template | `reports` | `variables.date?` |
| `detect-blockers` | Detect Blockers | inline | `dependencies` | — |
| `sprint-summary` | Sprint Summary | `sprint-review` template | `sprints` | `variables.sprint_name` (**required**) |
| `missing-reports` | Missing Reports | `missing-reports` template | `reports` | `variables.date?` |
| `workload-suggestions` | Workload Suggestions | `workload-analysis` template | `analytics` | — |

### Owner (`OWNER_FEATURES`)

| Feature id | Title | Backing | Surface | Input |
| --- | --- | --- | --- | --- |
| `executive-summary` | Executive Summary | `executive-summary` template | `analytics` | `variables.period?` |
| `company-health` | Company Health | `company-health` template | `analytics` | `variables.date?` |
| `risk-detection` | Risk Detection | inline | `analytics` | — |
| `weekly-insights` | Weekly Insights | inline | `analytics` | — |

Template-backed features reuse the Prompt Library (`docs/PROMPTS.md`); inline
features carry their own grounded prompt. Both paths reference the injected
`<context>` and are forbidden from inventing data.

---

## 3. Connecting to the AI service

Features connect to **`AIAssistantService`** (`src/ai/services/assistant-service.ts`),
exposed as the shared `aiAssistant` singleton. It resolves the feature, builds the
request, and runs it through the `AIEngine`.

```ts
import { aiAssistant } from "@/ai";

const result = await aiAssistant.run("generate-morning-plan", {
  user: { id, displayName, roles },
  variables: { date: "2026-07-01" },
  hints: { workDate: "2026-07-01" },   // forwarded to the Context Engine
});

result.text;         // the completion
result.provider;     // "mock"
result.model;        // "mock-1"
result.usage;        // { inputTokens, outputTokens, totalTokens }
```

Input-driven features:

```ts
await aiAssistant.run("rewrite-text", {
  user, text: "we need fix the bug asap", instruction: "professional tone",
});

await aiAssistant.run("improve-midday-report", { user, text: draftMarkdown });
```

Streaming (deltas):

```ts
for await (const chunk of aiAssistant.runStream("summarize-tasks", { user })) {
  append(chunk.delta);           // final chunk also carries `usage` + `finishReason`
}
```

`AIFeatureResult` shape: `{ featureId, text, provider, model, usage, finishReason }`.

---

## 4. Mock providers (no external APIs)

`aiAssistant` defaults to the **`mock` provider** (`src/ai/providers/mock-provider.ts`):

- **Offline & deterministic** — no network, no API key. `generate()` returns a
  clearly-labelled `[MOCK AI RESPONSE …]` that echoes the request and the grounded
  `<context>` items, so output is obviously mock and never mistaken for a real model.
- **Full contract** — implements `generate`, `stream` (word-by-word deltas) and
  heuristic token `usage`, so features behave exactly as they will with a real
  provider.
- **Catalogued** — a single zero-cost `mock-1` model (`MODEL_CATALOG.mock`), so
  model resolution, usage and cost paths all work.

Registered in the provider registry alongside the placeholder Anthropic / OpenAI /
Gemini adapters. **No external API is connected.** To switch later, construct the
service with a real provider once its adapter is wired:

```ts
const assistant = new AIAssistantService(aiEngine, "anthropic"); // when implemented
```

---

## 5. Registry API

From `@/ai` (or `@/ai/features`):

| Export | Description |
| --- | --- |
| `ALL_AI_FEATURES` | Every feature, declaration order |
| `AI_FEATURES` | Features keyed by id |
| `getFeature(id)` | Resolve one feature (throws `AIError` if unknown) |
| `listFeatures(audience?)` | All, or by `employee`/`manager`/`owner` |
| `EMPLOYEE_FEATURES` · `MANAGER_FEATURES` · `OWNER_FEATURES` | Per-role sets |
| `aiAssistant` / `AIAssistantService` | The service features connect to |

Driving a role-scoped menu:

```ts
import { listFeatures } from "@/ai";
listFeatures(hasRole("owner") ? "owner" : "employee")   // → [{ id, title, description }]
```

---

## 6. Validation & errors

- Missing **required** template variable (e.g. `sprint-summary` without
  `sprint_name`) → `AIError("invalid_request")` at build time.
- Missing **required** text (e.g. `rewrite-text` / `improve-midday-report` without
  `input.text`) → `AIError("invalid_request")`.
- Context sources that fail are isolated by the Context Engine (degrade to notes),
  so a feature still returns partial, grounded output.

---

## 7. Extending

1. Add an `AIFeatureDefinition` to the right `features/<audience>.ts` set:
   an `id`, `title`, `audience`, `description`, and a `build(input)` returning
   `{ surface, prompt }` — reuse a Prompt Library template via
   `renderRequest(getPrompt(id), input.variables)`, or write an inline grounded
   prompt.
2. It's auto-registered (sets flow into `ALL_AI_FEATURES`).
3. Keep prompts grounded (reference `<context>`, never embed data) and validate
   required input via `requireText` / template `required` variables.

No change to `AIAssistantService`, the engine, or providers when features evolve.

---

## 8. Verification

- `npx tsc --noEmit` — **0 errors** (whole project).
- `npx eslint "src/ai/**/*.ts"` — clean.
- Offline end-to-end smoke run (mock provider): 14 features registered (5/5/4);
  template, input-driven, inline and streaming paths all produce output; required
  variable/text omissions throw `AIError`. No external API contacted.
