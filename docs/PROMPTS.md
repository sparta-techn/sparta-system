# SpartaFlow — Prompt Library

> Reference for the reusable prompt templates in `src/ai/prompts/`. Each template
> is a role-scoped, parameterized instruction that the AI Assistant runs against
> service-sourced grounding (see `docs/CONTEXT_ENGINE.md`). Part of the AI
> infrastructure (`docs/AI_INFRASTRUCTURE.md`).
>
> Snapshot date: 2026-07-01.

---

## 1. What this is

A **library of stored, reusable prompts** — not ad-hoc strings scattered in the
UI. Each template declares:

- **who it's for** (`audience`: employee / manager / owner),
- **what grounding it needs** (`surface` + `sources`, wired to the Context Engine),
- **which variables it takes** (`{{placeholder}}` tokens with defaults/required flags),
- **the instruction body** itself.

A rendered template becomes the _user message_; its `surface` tells the Context
Engine what to gather. Templates never contain data — they reference the
`<context>` block the Context Engine injects, so the same template works for every
user and stays grounded, authorized (RLS-scoped), and reusable.

---

## 2. Structure

```
src/ai/prompts/
  prompt-library.ts        # registry + renderer (getPrompt, listPrompts, renderPrompt, renderRequest)
  templates/
    employee.ts            # EMPLOYEE_TEMPLATES
    manager.ts             # MANAGER_TEMPLATES
    owner.ts               # OWNER_TEMPLATES
    index.ts
  system-prompts.ts        # (existing) base persona + per-surface + persona snippets
  prompt-builder.ts        # (existing) assembles system + messages for a provider
  index.ts                 # barrel
```

Contracts (`PromptTemplate`, `PromptVariable`, `PromptAudience`) live in
`src/ai/types/prompt.ts`.

---

## 3. The templates

13 templates across three roles. `surface` selects the Context Engine source set;
`vars` marks **required** (⚑) vs. defaulted variables.

### Employee (`EMPLOYEE_TEMPLATES`)

| id                  | Title             | Surface   | Vars                       | Purpose                                                              |
| ------------------- | ----------------- | --------- | -------------------------- | -------------------------------------------------------------------- |
| `morning-plan`      | Morning Plan      | `global`  | `date`=today               | Plan the day from tasks, yesterday's EOD, attendance, blockers       |
| `midday-report`     | Midday Report     | `reports` | `date`=today               | Draft a midday status: progress, focus, new blockers, on-track check |
| `end-of-day-report` | End-of-Day Report | `reports` | `date`=today               | Draft an EOD: summary, completed, in-progress, blockers, tomorrow    |
| `weekly-summary`    | Weekly Summary    | `reports` | `week_start`⚑, `week_end`⚑ | Summarize the week from reports, tasks, time, attendance             |

### Manager (`MANAGER_TEMPLATES`)

| id                  | Title             | Surface        | Vars           | Purpose                                                           |
| ------------------- | ----------------- | -------------- | -------------- | ----------------------------------------------------------------- |
| `team-summary`      | Team Summary      | `reports`      | `date`=today   | Current team status from reports, tasks, attendance, dependencies |
| `sprint-review`     | Sprint Review     | `sprints`      | `sprint_name`⚑ | Goal, completed vs carried-over, scope changes, risks, actions    |
| `team-risks`        | Team Risks        | `dependencies` | —              | Top 5 team risks from dependencies, tasks, sprints, reports       |
| `missing-reports`   | Missing Reports   | `reports`      | `date`=today   | Who's missing check-in/midday/EOD reports + a reminder message    |
| `workload-analysis` | Workload Analysis | `analytics`    | —              | Balance across the team from tasks, time, projects, attendance    |

### Owner (`OWNER_TEMPLATES`)

| id                  | Title             | Surface     | Vars                       | Purpose                                                                |
| ------------------- | ----------------- | ----------- | -------------------------- | ---------------------------------------------------------------------- |
| `company-health`    | Company Health    | `analytics` | `date`=today               | Overall health from projects, analytics, attendance, dependencies      |
| `executive-summary` | Executive Summary | `analytics` | `period`=this week         | One-page leadership summary: delivery, metrics, risks, decisions       |
| `weekly-report`     | Weekly Report     | `analytics` | `week_start`⚑, `week_end`⚑ | Company weekly: exec summary, per-project, people, risks, priorities   |
| `monthly-report`    | Monthly Report    | `analytics` | `month`⚑                   | Company monthly: delivery, operational trends, wins/setbacks, strategy |

> **Grounding & authorization.** Manager and owner templates rely on the service
> layer returning team-/company-scoped rows under RLS — a manager sees their
> team, an owner the company, and no more. Every template instructs the model to
> base claims on the `<context>` and to flag missing data, so it never invents
> figures. Team- and company-wide context sources will deepen as those services
> land (see `docs/CONTEXT_ENGINE.md §7`); template ids and call sites stay stable.

---

## 4. Rendering

`renderPrompt(template, values)` fills `{{placeholder}}` tokens deterministically:

1. For each declared variable, use `values[key]`, else the variable's `default`.
2. A missing **required** variable throws `AIError("invalid_request")`.
3. Unresolved optional variables render as empty.

```ts
import { getPrompt, renderPrompt } from "@/ai";

const prompt = renderPrompt(getPrompt("weekly-summary"), {
  week_start: "2026-06-22",
  week_end: "2026-06-26",
});
```

---

## 5. Running a template through the engine

`renderRequest(template, values)` returns the `{ surface, prompt }` an engine call
needs, so callers don't hard-code which surface a template targets:

```ts
import { aiEngine, getPrompt, renderRequest } from "@/ai";

const template = getPrompt("morning-plan");
const { surface, prompt } = renderRequest(template, { date: "2026-07-01" });

const result = await aiEngine.generate({
  user: { id, displayName, roles },
  surface, // "global" → Context Engine gathers the right sources
  contextHints: { workDate: "2026-07-01" },
  prompt,
});
```

The engine gathers context for `surface`, the Prompt Builder wraps it with the
base persona + guardrails, and the (placeholder) provider is called. Wiring a real
provider is the only missing piece — see `docs/AI_INFRASTRUCTURE.md §4`.

---

## 6. Registry API

From `@/ai` (or `@/ai/prompts`):

| Export                                                         | Description                                              |
| -------------------------------------------------------------- | -------------------------------------------------------- |
| `ALL_PROMPT_TEMPLATES`                                         | Every template, in declaration order                     |
| `PROMPT_TEMPLATES`                                             | Templates keyed by id                                    |
| `getPrompt(id)`                                                | Resolve one template (throws if unknown)                 |
| `listPrompts(audience?)`                                       | All templates, or those for `employee`/`manager`/`owner` |
| `renderPrompt(template, values?)`                              | Fill tokens → final prompt string                        |
| `renderRequest(template, values?)`                             | → `{ surface, prompt }` for `aiEngine`                   |
| `EMPLOYEE_TEMPLATES` · `MANAGER_TEMPLATES` · `OWNER_TEMPLATES` | The per-role sets                                        |

Driving a role-scoped picker UI:

```ts
import { listPrompts } from "@/ai";
const managerPrompts = listPrompts("manager"); // 5 templates, titles + descriptions
```

---

## 7. Adding a template

1. Add a `PromptTemplate` to the right `templates/<audience>.ts` set: a stable
   kebab `id`, `title`, `audience`, `surface` (a key in `SURFACE_SOURCES`), the
   `sources` it relies on, its `variables`, and the `template` body referencing
   `<context>`.
2. It's automatically registered (the sets flow into `ALL_PROMPT_TEMPLATES`).
3. Keep bodies data-free: reference the context, don't embed values; declare every
   `{{placeholder}}` in `variables`.

---

## 8. Conventions

- **Grounded, not generative-from-nothing.** Every body says "using … in
  `<context>`" and forbids inventing data — matching the base system-prompt
  guardrails.
- **Role-appropriate scope.** Employee = self; manager = team; owner = company.
  Scope is enforced by RLS in the service layer, not by the prompt.
- **Actionable output.** Prompts ask for prioritized, structured, cited answers
  (task refs, owners, next steps).
- **Stable ids.** Kebab-case; ids are the contract for call sites and analytics.

---

## 9. Verification

- `npx tsc --noEmit` — **0 errors** (whole project).
- `npx eslint "src/ai/**/*.ts"` — clean.
- 13 templates registered (4 employee · 5 manager · 4 owner); required variables
  enforced at render time.
