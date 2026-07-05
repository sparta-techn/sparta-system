# SpartaFlow — AI Infrastructure

> Reference for the provider-agnostic AI core in `src/ai/`. This is the **built**
> infrastructure (types, providers, prompt/context builders, orchestration engine)
> — the layer the AI Assistant is composed from. For the end-to-end system design
> (Edge Function, database, RLS, usage/settings tables) see `docs/AI_ARCHITECTURE.md`.
>
> Snapshot date: 2026-07-01. Status: **infrastructure scaffolding — no API calls
> wired.** All three providers are placeholders that throw
> `AIError("not_implemented")`.

---

## 1. Principles

- **Provider-agnostic.** Nothing above the adapter layer names a vendor.
  Everything depends on the neutral `AIProvider` interface and the `AIEngine`
  orchestrator.
- **Server-only secrets.** Provider keys and network calls belong server-side (a
  Supabase Edge Function). This module is the shared, environment-agnostic core it
  builds on — it holds no keys and (today) makes no requests.
- **Strict TypeScript, no `any`.** Every contract is a named interface; loose
  casts are absent. Passes `tsc --noEmit` and ESLint/Prettier.
- **Additive & reusable.** Extends the AI design already sketched in
  `src/services/ai/`. Small modules, single-responsibility, barrel-exported.

---

## 2. Folder structure

```
src/ai/
  index.ts              # Root barrel — import from "@/ai"
  types/                # Neutral contracts (the vocabulary)
    common.ts           #   AIProviderId, AIRole, AIModelTier, AIFinishReason, AIUsage
    provider.ts         #   AIProvider, AIGenerateParams, AIGenerateResult, AIStreamChunk, AIModelDescriptor
    prompt.ts           #   PromptInput, BuiltPrompt, PromptUser, PromptPreferences
    context.ts          #   ContextBlock, ContextEntity, ContextRequest, ContextResolver
    index.ts
  providers/            # Vendor adapters (the only vendor-aware code)
    base-provider.ts    #   BaseAIProvider (abstract) — shared behaviour
    anthropic-provider.ts  # AnthropicProvider (placeholder, default)
    openai-provider.ts     # OpenAIProvider   (placeholder)
    gemini-provider.ts     # GeminiProvider   (placeholder)
    registry.ts         #   getProvider(id) — id → adapter, memoized
    index.ts
  prompts/              # Deterministic prompt assembly (pure functions)
    system-prompts.ts   #   BASE + per-surface + persona templates
    prompt-builder.ts   #   buildPrompt(input) → BuiltPrompt
    index.ts
  context/              # RBAC-scoped grounding (registry of resolvers)
    context-builder.ts  #   ContextBuilder, contextBuilder, emptyContext()
    index.ts
  models/               # Model catalog (limits + illustrative pricing)
    catalog.ts          #   MODEL_CATALOG, findModel, defaultModelFor
    index.ts
  services/             # Orchestration
    ai-engine.ts        #   AIEngine, aiEngine — provider + context + prompt → model
    index.ts
  utils/                # Cross-cutting helpers
    errors.ts           #   AIError, notImplemented()
    tokens.ts           #   token estimation + cost helpers
    index.ts
```

Every folder has a barrel; import from `@/ai` (root) or a subpath barrel.

---

## 3. The provider contract

`AIProvider` (in `types/provider.ts`) is the interface every adapter implements.
A provider is a **thin translator**: neutral request in, neutral result out.

```ts
interface AIProvider {
  readonly id: AIProviderId;                 // "openai" | "anthropic" | "gemini" | "local"
  readonly models: readonly AIModelDescriptor[];
  readonly supportsStreaming: boolean;
  generate(params: AIGenerateParams): Promise<AIGenerateResult>;
  stream(params: AIGenerateParams): AsyncIterable<AIStreamChunk>;
  countTokens(params: AITokenCountParams): Promise<number>;
  getModel(modelId: string): AIModelDescriptor | undefined;
}
```

Neutral request / result:

```ts
interface AIGenerateParams {
  model: string;                 // resolved model id
  system?: string;               // system prompt (from Prompt Builder)
  messages: AIProviderMessage[]; // { role: "user" | "assistant"; content }
  maxOutputTokens?: number;
  temperature?: number;
  stopSequences?: string[];
  signal?: AbortSignal;
}

interface AIGenerateResult {
  text: string;
  usage: AIUsage;                // { inputTokens, outputTokens, totalTokens }
  provider: AIProviderId;
  model: string;
  finishReason: AIFinishReason;  // stop | length | content_filter | tool_use | error
}
```

The system prompt is carried **separately** from `messages` so each adapter can
place it where its vendor expects (Anthropic top-level `system`, OpenAI
`role:"system"` message, Gemini `systemInstruction`).

---

## 4. Providers

### 4.1 `BaseAIProvider` (abstract)

Shared behaviour so no adapter repeats it:

- `getModel(id)` / `defaultModel` — model lookup against the catalog.
- `countTokens()` — heuristic estimate (~4 chars/token) via `utils/tokens`.
  Adapters may override with a vendor-accurate tokenizer.
- `assertValidRequest()` — shared guardrails (model present, model belongs to this
  provider, at least one message) raising typed `AIError`s.

Concrete adapters implement only `generate` and `stream`.

### 4.2 Placeholder adapters

| Adapter | id | Models | Status |
| --- | --- | --- | --- |
| `AnthropicProvider` | `anthropic` | `claude-opus-4-8`, `claude-sonnet-5`, `claude-haiku-4-5-20251001` | **placeholder, default** |
| `OpenAIProvider` | `openai` | `gpt-4.1`, `gpt-4.1-mini` | placeholder |
| `GeminiProvider` | `gemini` | `gemini-2.5-pro`, `gemini-2.5-flash` | placeholder |

Each `generate` / `stream` runs `assertValidRequest()` then calls
`notImplemented(...)`, which throws `AIError("not_implemented")`. **No network
calls exist yet.** Each file documents, in a `TODO`, exactly how the real mapping
will work and which server-side secret supplies the key
(`ANTHROPIC_API_KEY` / `OPENAI_API_KEY` / `GOOGLE_API_KEY`).

### 4.3 Registry

`registry.ts` maps an id → adapter and memoizes instances:

```ts
getProvider();               // default → AnthropicProvider
getProvider("openai");       // OpenAIProvider
registeredProviders();       // ["anthropic", "openai", "gemini"]
DEFAULT_PROVIDER_ID;         // "anthropic"
```

`local` is reserved in the catalog for a future OpenAI-compatible adapter (Ollama
/ vLLM) and has no factory yet — requesting it raises `AIError("unknown_provider")`.

---

## 5. Prompt Builder (`prompts/`)

Pure, deterministic, provider-unaware. `buildPrompt(input: PromptInput):
BuiltPrompt` composes:

- **System prompt** — `BASE_SYSTEM_PROMPT` (persona + guardrails) + optional
  per-`surface` snippet + persona directive + response language + a one-line user
  identity + the rendered `<context>` block.
- **Messages** — prior `history` followed by the new user turn.

Context is rendered as a delimited `<context>…</context>` section with cited rows
(`- [task (ETB-142)] …`) and a truncation note when applicable, so the model can
tell grounding data from instructions. Helpers `buildSystemPrompt`,
`buildMessages`, and `renderContext` are exported for testing.

---

## 6. Context Builder (`context/`)

`ContextBuilder` is a registry of per-`surface` `ContextResolver`s. `build(request)`
dispatches on `request.surface`, falling back to `emptyContext()` when no resolver
is registered (the current default — no resolvers ship yet).

> **Security contract.** A real resolver MUST read through a **caller-scoped**
> Supabase client so Postgres RLS filters every row — the AI must never surface
> data the user could not open in the UI. This module defines the shapes and the
> dispatch seam only; it performs no I/O.

---

## 7. Model catalog (`models/`)

`MODEL_CATALOG: Record<AIProviderId, AIModelDescriptor[]>` is the single source of
truth for model limits and (illustrative) pricing. Helpers: `findModel(id)`,
`defaultModelFor(provider)`, `ALL_MODELS`. Costs feed the usage/cost estimates in
`utils/tokens` and, later, the token-usage tracking described in
`docs/AI_ARCHITECTURE.md`.

---

## 8. Orchestration — `AIEngine` (`services/`)

`AIEngine` is the seam that wires everything together for one completion:

```
resolve provider  →  build context  →  build prompt  →  provider.generate() / .stream()
```

```ts
import { aiEngine } from "@/ai";

const result = await aiEngine.generate({
  user: { id, displayName, roles },
  surface: "tasks",
  prompt: "What should I focus on today?",
  // optional: providerId, model, temperature, maxOutputTokens, history, contextHints
});
```

Resolution rules: `providerId` → configured/default provider; `model` →
`defaultModelFor(provider)` when omitted; preferences merged over
`{ persona: "balanced", language: "en" }`. Because providers are placeholders, the
call reaches a real, validated pipeline and then throws
`AIError("not_implemented")` — **the wiring is complete, the network is not.**

In production this orchestration runs **server-side** (a Supabase Edge Function)
so keys never reach the browser; `AIEngine` is the environment-agnostic core it
builds on.

---

## 9. Errors & utilities (`utils/`)

- `AIError` — single error shape with a stable `code`
  (`not_implemented` · `unknown_provider` · `unknown_model` · `invalid_request` ·
  `provider_error` · `aborted`), mirroring the service layer's `ServiceError`.
- `notImplemented(what)` — throws the placeholder error used by all three adapters.
- `tokens.ts` — `estimateTextTokens`, `estimatePromptTokens`, `toUsage`,
  `estimateCostUsd` (per-1M-token rates from the catalog).

---

## 10. Adding a real provider

1. Extend `BaseAIProvider` in `providers/<vendor>-provider.ts`; implement
   `generate` / `stream` (map params, normalize usage → `AIUsage`), reading the
   key from a **server-side** secret.
2. Register a factory in `providers/registry.ts`.
3. Add the models to `models/catalog.ts` (ids, limits, pricing).

No change to `AIEngine`, the Prompt/Context builders, the types, or any consumer.
That is the payoff of the neutral `AIProvider` interface.

---

## 11. Verification

- `npx tsc --noEmit` — **0 errors** (whole project).
- `npx eslint "src/ai/**/*.ts"` — clean (Prettier + typescript-eslint).
- No `any`; no network calls; no secrets in the module.

---

*This layer is intentionally inert (no API calls). It exists so the AI Assistant
can be built against a stable, provider-agnostic surface. Wiring a provider and
moving orchestration into a Supabase Edge Function are the next steps — see
`docs/AI_ARCHITECTURE.md §12 (Edge Function)`.*
