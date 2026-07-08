# SpartaFlow — AI Provider Settings

> Reference for the provider-configuration Settings page in
> `src/features/ai-settings/`. Configure **OpenAI**, **Anthropic** and **Google
> Gemini** (API key, model, temperature, max tokens, system prompt) with
> validation and obfuscated, non-exposed local key storage. Part of the AI stack
> (`docs/AI_INFRASTRUCTURE.md`, `docs/AI_ARCHITECTURE.md`).
>
> Snapshot date: 2026-07-01.

---

## 1. What it does

- A Settings page (`AISettingsPage`) with one tab per provider.
- Per provider, you can set: **API Key**, **Model**, **Temperature**,
  **Max Tokens**, **System Prompt**.
- All fields are **validated** (zod + react-hook-form).
- API keys are stored in a **separate, obfuscated** local store and **never
  rendered back** — only a masked preview (`sk-…a1b2`) is shown.
- One provider is marked **active** (the one the assistant uses).

---

## 2. Structure

```
src/features/ai-settings/
  index.ts                 # barrel
  types.ts                 # ConfigurableProviderId, ProviderConfig, AISettingsState, SecretStatus
  provider-meta.ts         # per-provider display + key patterns; models from @/ai catalog
  validation.ts            # zod: apiKeySchema, providerConfigSchema, validateApiKey
  store.ts                 # non-secret config store (localStorage, reactive)
  secure-store.ts          # API keys — obfuscated, separate, masked previews only
  effective-config.ts      # bridge to the engine (returns the real key; non-UI)
  hooks/
    use-ai-settings.ts     # active provider + secret status facade
  components/
    ai-settings-page.tsx   # the Settings page
    provider-form.tsx      # model / temperature / max tokens / system prompt
    api-key-field.tsx      # secure key entry (masked, reveal-while-typing)
```

Reuses the shared model catalog from `@/ai` (`MODEL_CATALOG`, `defaultModelFor`)
so model lists and limits stay in one place.

---

## 3. Providers & fields

| Provider          | Key format | Temp ceiling | Models (from catalog)                                             |
| ----------------- | ---------- | ------------ | ----------------------------------------------------------------- |
| **OpenAI**        | `sk-…`     | 2.0          | `gpt-4.1`, `gpt-4.1-mini`                                         |
| **Anthropic**     | `sk-ant-…` | 1.0          | `claude-opus-4-8`, `claude-sonnet-5`, `claude-haiku-4-5-20251001` |
| **Google Gemini** | `AIza…`    | 2.0          | `gemini-2.5-pro`, `gemini-2.5-flash`                              |

Each provider config: `{ provider, model, temperature, maxTokens, systemPrompt }`.

---

## 4. Validation

`validation.ts` (zod), surfaced inline in the forms:

- **API key** — required, and must match the provider's shape
  (`sk-` / `sk-ant-` / `AIza` + a minimum length). `validateApiKey(provider, key)`
  returns a message or `null`.
- **Model** — must be one of the provider's catalog models.
- **Temperature** — `0 … 2`, further capped at the **provider's ceiling**
  (Anthropic ≤ 1) via a cross-field refinement.
- **Max Tokens** — a positive integer, capped at the **selected model's**
  `maxOutputTokens`.
- **System Prompt** — optional, ≤ 8000 characters.

---

## 5. Secure key storage & "do not expose secrets"

Keys are handled by `secure-store.ts`, deliberately kept **out** of the config
store:

- **Separate storage** — keys live under `spartaflow:ai-secrets:v1`; non-secret
  config lives under `spartaflow:ai-settings:v1`. They never mix.
- **Obfuscated at rest** — keys are XOR-padded + base64-encoded, so nothing is
  written in plaintext (verified: the raw entry never contains the key).
- **Never rendered back** — once saved, the UI shows only a **masked preview**
  (`sk-…a1b2`) and a boolean "is set". The input holds only what the user is
  currently typing (a replacement), behind a password field with a reveal toggle.
- **Not logged, not in config** — the key is never toasted, logged, or copied into
  the non-secret store.
- **Read for use only** — `getApiKey(provider)` returns the real key for
  _programmatic_ use (a future provider adapter), via the non-UI
  `effective-config.ts`. The reactive `useSecretStatus()` hook the UI consumes
  exposes **only** `{ set, preview }`.

> ⚠️ **Honest limitation.** Browser `localStorage` is **not** a hardened secret
> store, and the obfuscation is **not cryptography** — it deters casual inspection
> only. For production, provider keys belong in **server-side Edge Function
> secrets** (see `docs/AI_ARCHITECTURE.md §12`); this feature is the local-dev
> stand-in. No key is transmitted anywhere from this screen.

---

## 6. Usage

```tsx
import { AISettingsPage } from "@/features/ai-settings";

// e.g. a route at /app/settings/ai
export function AISettingsRoute() {
  return (
    <div className="p-6">
      <AISettingsPage />
    </div>
  );
}
```

Reading the effective config (for a future real provider adapter — **not** a
render path):

```ts
import { getEffectiveConfig } from "@/features/ai-settings";

const cfg = getEffectiveConfig(); // active provider
// { provider, model, temperature, maxTokens, systemPrompt, hasApiKey, apiKey }
```

Public store API (barrel): `useAISettingsState`, `getConfig`,
`getActiveProvider`, `setActiveProvider`, `saveConfig`, `resetConfig`,
`useSecretStatus`, `hasApiKey`.

---

## 7. Relationship to the AI engine

Today the assistant runs on the offline **mock** provider
(`docs/AI_FEATURES.md`); the OpenAI/Anthropic/Gemini adapters are placeholders.
This page is the **configuration surface** those adapters will read via
`getEffectiveConfig()` once implemented — model, sampling, system prompt and key
all flow from here. Wiring the engine to honor the active provider is a follow-up
that touches only the provider layer, not this feature.

---

## 8. Verification

- `npx tsc --noEmit` — **0 errors** (whole project).
- `npx eslint "src/features/ai-settings/**/*.{ts,tsx}"` — clean.
- Unit-checked: obfuscated round-trip (no plaintext at rest), masked-only preview,
  key clearing, per-provider key-format validation, model max-token cap, and the
  Anthropic temperature ceiling.
