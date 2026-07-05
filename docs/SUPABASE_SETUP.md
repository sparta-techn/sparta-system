# SpartaFlow — Supabase Setup

> Infrastructure layer at `src/lib/supabase`. Low-level, framework-agnostic
> Supabase primitives — the shared client, environment loading, and typed
> **auth / storage / realtime** helpers. Higher layers (`src/services`,
> `features/*`) compose these.
>
> **Status:** created but **not yet wired into the UI**. Mock data stays in place
> (per task scope). Nothing here connects on import — the client is lazy.

---

## 1. Layout

```
src/lib/supabase/
  client.ts      # Env loading + shared, typed browser client
  auth.ts        # Session primitives over supabase.auth
  storage.ts     # Buckets, upload/download, signed & public URLs
  realtime.ts    # Postgres change streams, broadcast, presence
  index.ts       # Barrel — import from "@/lib/supabase"
```

### Relationship to existing code

This layer **reuses** the generated client in `src/integrations/supabase`
instead of constructing a second one — a duplicate client would break shared
auth tokens and the realtime socket (see CLAUDE.md). Concretely:

- `src/integrations/supabase/client.ts` — the generated **browser** client
  (lazy `Proxy`). `lib/supabase/client.ts` re-exports it as `supabaseClient`.
- `src/integrations/supabase/client.server.ts` — the **service-role** admin
  client for server functions. Not touched here; never import it into client code.

---

## 2. Environment variables

Loaded by `client.ts` via `getSupabaseEnv()`, which reads from both runtimes:

- **Browser / Vite build:** `import.meta.env.VITE_*` (statically replaced at build).
- **SSR / server functions:** `process.env.*` (no `VITE_` prefix).

| Variable | Required | Purpose |
| --- | --- | --- |
| `VITE_SUPABASE_URL` / `SUPABASE_URL` | ✅ | Project API URL. |
| `VITE_SUPABASE_PUBLISHABLE_KEY` / `SUPABASE_PUBLISHABLE_KEY` | ✅ | Public (anon / publishable) key. Safe for the browser. |
| `VITE_SUPABASE_PROJECT_ID` / `SUPABASE_PROJECT_ID` | ⬜ | Project ref; informational. |
| `SUPABASE_SERVICE_ROLE_KEY` | server-only | Used **only** by `client.server.ts`. **Never** expose to the client. |

`.env` template (already scaffolded in the repo):

```dotenv
SUPABASE_PROJECT_ID=
SUPABASE_PUBLISHABLE_KEY=
SUPABASE_URL=
VITE_SUPABASE_PROJECT_ID=
VITE_SUPABASE_PUBLISHABLE_KEY=
VITE_SUPABASE_URL=
```

> New-style Supabase keys (`sb_publishable_…` / `sb_secret_…`) are opaque, not
> JWTs; the client's custom `fetch` already handles the `apikey` header for them.

Helpers:

- `getSupabaseEnv(): SupabaseEnv` — resolves + validates once (memoized). Throws a
  descriptive error naming every missing variable, pointing back to this doc.
- `isSupabaseConfigured(): boolean` — non-throwing presence check (useful for
  guarding optional features).

---

## 3. Modules

### `client.ts`

| Export | Description |
| --- | --- |
| `supabaseClient: AppSupabaseClient` | Shared, lazily-initialized browser client, typed to the generated `Database`. |
| `getSupabaseClient()` | Accessor form of the above. |
| `getSupabaseEnv()` / `isSupabaseConfigured()` | Env resolution / presence check. |
| `AppSupabaseClient`, `SupabaseEnv` | Types. |

### `auth.ts` — session primitives over `supabase.auth`

`signInWithPassword`, `signUp`, `signInWithOAuth`, `signOut`, `getSession`,
`getUser`, `resetPasswordForEmail`, `updateUser`, `onAuthStateChange`
(returns a `Subscription` — call `.unsubscribe()` in cleanup), plus the raw
`auth` namespace.

> Business rules (profile/role hydration, redirect URLs) deliberately stay in
> `features/auth` and `src/services/auth` — this module is intentionally thin.

### `storage.ts` — typed helpers over `supabase.storage`

`uploadFile`, `downloadFile`, `getPublicUrl`, `createSignedUrl`, `listFiles`,
`removeFiles`, plus `STORAGE_BUCKETS` constants.

Declared buckets (create these before use — §4):

| Constant | Bucket | Suggested visibility |
| --- | --- | --- |
| `STORAGE_BUCKETS.avatars` | `avatars` | public |
| `STORAGE_BUCKETS.taskAttachments` | `task-attachments` | private (signed URLs) |
| `STORAGE_BUCKETS.projectFiles` | `project-files` | private (signed URLs) |
| `STORAGE_BUCKETS.reportAttachments` | `report-attachments` | private (signed URLs) |

### `realtime.ts` — channel helpers

| Helper | Use |
| --- | --- |
| `subscribeToTable(name, { table, event?, filter?, onChange })` | Postgres row changes; returns an unsubscribe fn. |
| `createBroadcastChannel(name, event, onMessage?)` | Ephemeral cross-client messages (cursors, typing). |
| `createPresenceChannel(name, state, onSync?)` | Who's online / viewing. |
| `unsubscribe(channel)` | Remove a channel and release its socket. |

---

## 4. One-time backend provisioning

Run once per environment (dashboard or migration):

1. **Connect Supabase** and fill the `.env` variables above.
2. **Create storage buckets** matching `STORAGE_BUCKETS`. Mark `avatars` public;
   keep the rest private and serve via `createSignedUrl`.
3. **RLS:** keep Row-Level Security on for every table (per CLAUDE.md). Add per-bucket
   storage policies so users only read/write their own paths.
4. **Realtime:** enable replication for the tables you intend to stream
   (`supabase_realtime` publication) before relying on `subscribeToTable`.

---

## 5. Usage (once wired)

```ts
import {
  supabaseClient,
  isSupabaseConfigured,
  supabaseAuth,
  supabaseStorage,
  supabaseRealtime,
} from "@/lib/supabase";

// Auth
const session = await supabaseAuth.getSession();

// Storage
const path = await supabaseStorage.uploadFile(
  supabaseStorage.STORAGE_BUCKETS.avatars,
  `${userId}/avatar.png`,
  file,
  { upsert: true },
);

// Realtime
const off = supabaseRealtime.subscribeToTable("tasks-feed", {
  table: "tasks",
  event: "*",
  filter: `project_id=eq.${projectId}`,
  onChange: (payload) => console.log(payload.eventType, payload.new),
});
// later: off();
```

---

## 6. Conventions

- **Single client instance.** Always import `supabaseClient` from
  `@/lib/supabase` — never call `createClient` again.
- **Never expose the service-role key** to client code; it lives only in
  `client.server.ts`, loaded inside server handlers.
- **Reference buckets via `STORAGE_BUCKETS`,** not string literals.
- **Always tear down realtime channels** (return value of `subscribeToTable`, or
  `unsubscribe(channel)`) inside React effect cleanups.
- **Not connected yet.** Wiring these into hooks/components and replacing the
  in-browser mock stores is a deliberate later step — mocks remain untouched.
```
