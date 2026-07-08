# SpartaFlow — Environment Configuration

> How SpartaFlow is configured across **development**, **staging**, and
> **production**: the variables, the two exposure classes, validation, and
> secrets handling.
>
> Template: [`.env.example`](../.env.example) · Validator:
> [`scripts/validate-env.ts`](../scripts/validate-env.ts) → `bun run validate:env`
> · Schema: [`src/lib/env/index.ts`](../src/lib/env/index.ts).
> Related: [`docs/DEPLOYMENT_PLAN.md`](./DEPLOYMENT_PLAN.md) §3,
> [`docs/DOCKER.md`](./DOCKER.md), [`docs/CICD.md`](./CICD.md).

---

## 1. Two classes of variable

The single most important rule in this codebase:

| Class           | Prefix   | Read via          | Bound at                           | Exposure                                     |
| --------------- | -------- | ----------------- | ---------------------------------- | -------------------------------------------- |
| **Server-side** | _(none)_ | `process.env`     | **Runtime** (restart to change)    | Secret — stays on the server                 |
| **Client-side** | `VITE_`  | `import.meta.env` | **Build time** (rebuild to change) | **Public** — inlined into the browser bundle |

> ⚠️ **Never give a secret a `VITE_` name.** Anything `VITE_`-prefixed is compiled
> into the JavaScript every visitor downloads. In particular
> `SUPABASE_SERVICE_ROLE_KEY` must **never** become `VITE_SUPABASE_SERVICE_ROLE_KEY`
> — the validator flags this as a warning.

Both are resolved isomorphically in code: the Supabase clients and logging config
read `import.meta.env.VITE_*` in the browser and fall back to `process.env.*` on
the server (see `src/integrations/supabase/client.ts`, `src/lib/logging/config.ts`).

---

## 2. Variable reference

### Server-side (runtime)

| Variable                    | Required    | Description                                                                                  | Consumed in                                           |
| --------------------------- | ----------- | -------------------------------------------------------------------------------------------- | ----------------------------------------------------- |
| `NODE_ENV`                  | recommended | `development` \| `test` \| `production`. Drives log level, structured logging, CSP defaults. | `src/server.ts`, logging config                       |
| `HOST`                      | no          | SSR bind address (`127.0.0.1` host / `0.0.0.0` in containers).                               | Nitro runtime                                         |
| `PORT`                      | no          | SSR listen port (default `3000`).                                                            | Nitro runtime                                         |
| `SUPABASE_URL`              | **yes**     | Supabase API URL for the server client.                                                      | `client.server.ts`, `auth-middleware.ts`, `server.ts` |
| `SUPABASE_PUBLISHABLE_KEY`  | **yes**     | Publishable/anon key for the RLS-scoped server client.                                       | `auth-middleware.ts`                                  |
| `SUPABASE_SERVICE_ROLE_KEY` | **yes** 🔒  | **Full RLS bypass.** Admin server client only.                                               | `client.server.ts`                                    |
| `SUPABASE_PROJECT_ID`       | no          | Project ref.                                                                                 | tooling                                               |
| `ENFORCE_CSP`               | no          | `true`/`false` — emit Content-Security-Policy headers (recommend `true` in prod).            | `server.ts`                                           |
| `LOG_LEVEL`                 | no          | `debug`\|`info`\|`warn`\|`error` (default: debug dev / info prod).                           | logging config                                        |
| `RELEASE` / `COMMIT_SHA`    | no          | Release identifiers for logs/error reports (set by CI).                                      | logging config                                        |

### Client-side (build time, `VITE_`)

| Variable                           | Required | Description                                            |
| ---------------------------------- | -------- | ------------------------------------------------------ |
| `VITE_SUPABASE_URL`                | **yes**  | Supabase API URL for the browser client.               |
| `VITE_SUPABASE_PUBLISHABLE_KEY`    | **yes**  | Publishable key (safe to expose; RLS enforces access). |
| `VITE_SUPABASE_PROJECT_ID`         | **yes**  | Project ref.                                           |
| `VITE_LOG_LEVEL`                   | no       | Browser log level.                                     |
| `VITE_RELEASE` / `VITE_COMMIT_SHA` | no       | Release identifiers surfaced in client error reports.  |

The authoritative list is the Zod schema in
[`src/lib/env/index.ts`](../src/lib/env/index.ts) — update it and `.env.example`
together when adding a variable.

---

## 3. Per-environment configuration

Each environment is a **separate `.env`** (never shared, never committed) and,
ideally, a **separate Supabase project** so migrations and data are isolated.

|                        | Development                            | Staging                           | Production                           |
| ---------------------- | -------------------------------------- | --------------------------------- | ------------------------------------ |
| `NODE_ENV`             | `development`                          | `production`                      | `production`                         |
| Supabase project       | local or a dev project                 | **staging** project               | **production** project               |
| `HOST` / `PORT`        | `127.0.0.1` / `3000` (or Vite `:8080`) | `0.0.0.0` / `3000` (container)    | `0.0.0.0` / `3000` (container)       |
| `ENFORCE_CSP`          | `false`                                | `true`                            | `true`                               |
| `LOG_LEVEL`            | `debug`                                | `info`                            | `info`/`warn`                        |
| `RELEASE`/`COMMIT_SHA` | unset                                  | CI git SHA                        | CI git tag/SHA                       |
| Where values live      | local `.env` file                      | GitHub `staging` env + VPS `.env` | GitHub `production` env + VPS `.env` |

**Where the values are stored per environment:**

- **Development** — a local `.env` (git-ignored). Copy `.env.example`, fill in a
  dev Supabase project. `bun run dev` / `docker compose up`.
- **Staging & Production** — split by exposure:
  - `VITE_*` → **GitHub Actions environment secrets** (injected as Docker build
    args by the Build workflow — they're baked into the image). See
    [`docs/CICD.md`](./CICD.md) §3.
  - Server-side secrets → the **VPS** `.env` at `${DEPLOY_DIR}/.env`
    (`0640`, referenced by the systemd unit / compose `env_file`), read at
    runtime. See [`docs/DEPLOYMENT_PLAN.md`](./DEPLOYMENT_PLAN.md) §3.

> Because `VITE_*` are build-time, **staging and production images are not
> interchangeable** — each is built with its own `VITE_SUPABASE_*`. Server-side
> vars, being runtime, can differ per host without a rebuild.

---

## 4. Environment validation

A Zod schema validates both scopes and fails fast on missing/malformed values.

```bash
bun run validate:env                    # validate both scopes from the loaded .env
bun run validate:env -- --scope=server  # server-side only (e.g. on the VPS)
bun run validate:env -- --scope=client  # VITE_* only (e.g. before a build)
```

It checks:

- **Presence & shape** — required keys exist; URLs look like URLs; `LOG_LEVEL`
  is one of the allowed values; `PORT` is a positive integer.
- **Secret-leak guard** — warns if a secret was accidentally `VITE_`-prefixed
  (e.g. `VITE_SUPABASE_SERVICE_ROLE_KEY`).

Exit code `0` = valid, `1` = failed. Wire it in:

- **Local** — run after editing `.env`.
- **Prebuild** — before `bun run build` so a bad build fails early.
- **CI** — `--scope=client` in the Build job (needs the `VITE_*` secrets);
  `--scope=server` in a VPS deploy step before `docker compose up`.

Programmatic use (e.g. asserting at server bootstrap):

```ts
import { assertEnv } from "@/lib/env";
const env = assertEnv("server", process.env); // throws a formatted error if invalid
```

---

## 5. Secrets documentation

### 5.1 What is secret

| Value                                                        | Secret?              | Why                                                                                              |
| ------------------------------------------------------------ | -------------------- | ------------------------------------------------------------------------------------------------ |
| `SUPABASE_SERVICE_ROLE_KEY`                                  | **Yes — critical**   | Bypasses all RLS; full DB access.                                                                |
| `SUPABASE_PUBLISHABLE_KEY` / `VITE_SUPABASE_PUBLISHABLE_KEY` | No (low-sensitivity) | Publishable/anon key; access is bounded by RLS. Keep tidy but it ships to the browser by design. |
| `SUPABASE_URL` / `VITE_SUPABASE_URL` / project id            | No                   | Public endpoint identifiers.                                                                     |
| `SLACK_WEBHOOK_URL`, `VPS_SSH_KEY`, `GHCR_TOKEN`             | **Yes**              | CI/CD credentials (GitHub secrets only — see [`docs/CICD.md`](./CICD.md)).                       |

### 5.2 Where secrets live (never in Git)

- **Local:** `.env` — git-ignored (`.gitignore` covers `.env` and `.env.*`,
  except `.env.example`). `.dockerignore` also excludes it so it never enters an
  image layer.
- **CI:** GitHub **Actions secrets**, scoped per environment (`staging` /
  `production`).
- **VPS runtime:** `${DEPLOY_DIR}/.env`, mode `0640`, owned by the deploy user;
  loaded via systemd `EnvironmentFile=` or compose `env_file:`.
- **Never:** in `VITE_` vars (public), in the repo, in image layers, or in logs
  (the logging layer redacts — see `src/lib/logging/redact.ts`).

### 5.3 Rotation

- **Service-role key** — rotate in the Supabase dashboard → update the VPS `.env`
  → restart the service. **No rebuild** (runtime var).
- **Publishable key** — rotate in Supabase → update the CI `VITE_*` secret →
  **rebuild + redeploy** (it's inlined). Keep the server-side copy in sync.
- **CI/SSH secrets** — rotate in GitHub and on the VPS `authorized_keys`.
- On any suspected leak of the service-role key: rotate immediately, restart,
  and review Supabase access logs ([`docs/DEPLOYMENT_PLAN.md`](./DEPLOYMENT_PLAN.md) §10).

### 5.4 Golden rules

1. Real values never leave `.env` / a secrets store — commit only `.env.example`.
2. Secrets are never `VITE_`-prefixed.
3. Staging and production use **separate** Supabase projects and separate secrets.
4. Run `bun run validate:env` before builds and deploys.

---

## 6. Adding a new variable

1. Add it to the Zod schema in `src/lib/env/index.ts` (client or server scope;
   mark optional unless truly required).
2. Add it to [`.env.example`](../.env.example) with a comment.
3. If client-side, prefix with `VITE_` and remember it's **public** and
   **build-time**.
4. Add it to the relevant store: GitHub Actions secret (CI) and/or the VPS `.env`.
5. Document it in §2 above.
6. `bun run validate:env` to confirm.
