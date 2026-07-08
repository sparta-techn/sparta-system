# SpartaFlow — Docker Guide

> How to build, run, and operate SpartaFlow in containers. This containerizes the
> **existing** app — no business logic is changed. The app is a TanStack Start
> **SSR** application on **Nitro**; in containers it runs as a Node server behind
> an optional **Nginx** reverse proxy, with **Supabase** as the managed backend.
>
> Related: [`docs/DEPLOYMENT_PLAN.md`](./DEPLOYMENT_PLAN.md) (VPS/Cloudflare
> deployment), [`docs/ARCHITECTURE.md`](./ARCHITECTURE.md).

---

## 1. Files

| File                        | Purpose                                                                                                       |
| --------------------------- | ------------------------------------------------------------------------------------------------------------- |
| `Dockerfile`                | **Production** image — multi-stage: Bun builds the app, Node 20-alpine runs `.output/server/index.mjs` (SSR). |
| `Dockerfile.dev`            | **Development** image — Vite dev server with HMR.                                                             |
| `docker-compose.yml`        | **Dev** stack — one `app` service (Vite) on `:8080`, source bind-mounted for hot reload.                      |
| `docker-compose.prod.yml`   | **Prod-like** stack — `app` (Node SSR) + `nginx` reverse proxy on `:80`.                                      |
| `docker/nginx/default.conf` | Nginx proxy config (SSR passthrough, asset caching, `/healthz`).                                              |
| `.dockerignore`             | Keeps `.env`, `node_modules`, `.output`, `.git` out of the build context.                                     |

---

## 2. Prerequisites

- Docker Engine 24+ and the Docker Compose v2 plugin (`docker compose …`).
- A populated **`.env`** in the repo root (copy from `.env.example`). It is
  git-ignored and is **not** copied into images — it is read at runtime
  (`env_file`) and used for build-arg interpolation.

```bash
cp .env.example .env   # then fill in the Supabase values
```

---

## 3. Environment variables

Two classes, split by exposure (see `.env.example` and
[`docs/DEPLOYMENT_PLAN.md`](./DEPLOYMENT_PLAN.md) §3):

| Kind                                                 | Vars                                                                                                           | When consumed  | In Docker                                                                                                                  |
| ---------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- | -------------- | -------------------------------------------------------------------------------------------------------------------------- |
| **Client** (public, inlined into the browser bundle) | `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_SUPABASE_PROJECT_ID`                               | **Build time** | Passed as **build args** (`args:` in `docker-compose.prod.yml`, `ARG` in `Dockerfile`). Changing them needs a **rebuild**. |
| **Server** (secret)                                  | `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_PROJECT_ID`, `PORT`, `HOST` | **Runtime**    | Injected via `env_file: .env`. Changing them needs only a **restart**.                                                     |

> ⚠️ **Never** rename a secret to a `VITE_` name — that would inline it into the
> public bundle. `SUPABASE_SERVICE_ROLE_KEY` must never be `VITE_`-prefixed and
> never committed. `.dockerignore` excludes `.env` so it can't leak into a layer.

---

## 4. Development

```bash
docker compose up --build
# Vite dev server → http://localhost:8080  (HMR; edits on the host hot-reload)
```

- Source is bind-mounted (`.:/app`); the container keeps its own `node_modules`
  via an anonymous volume so host/container installs don't clash.
- Stop: `docker compose down`.
- If you add/remove dependencies, rebuild: `docker compose up --build`.

> Vite's dev port is fixed to **8080** via the container command. If the
> Lovable dev-server bridge forces a different port/host inside the container,
> adjust the `--port`/`--host` args in `Dockerfile.dev` (no app code change).

---

## 5. Production-like stack (SSR + Nginx)

```bash
docker compose -f docker-compose.prod.yml up -d --build
# → http://localhost      (Nginx :80 → app :3000 SSR)
```

Topology:

```
client → nginx (:80) → app (:3000, Nitro/Node SSR) → Supabase (managed)
```

- `app` binds `0.0.0.0:3000` **inside the compose network** (published only to
  Nginx via `expose`, not to the host).
- `nginx` is the only service that publishes a host port (`80`, and `443` once
  TLS is configured).
- Useful commands:

```bash
docker compose -f docker-compose.prod.yml ps          # status + health
docker compose -f docker-compose.prod.yml logs -f app # SSR logs
docker compose -f docker-compose.prod.yml down        # stop
```

### The build preset (important)

The repo's default Nitro preset is `cloudflare-module` (Cloudflare Workers). The
`Dockerfile` overrides it with **`NITRO_PRESET=node-server`** so the output runs
under Node. After a build you can confirm:

```bash
docker run --rm spartaflow:latest cat .output/nitro.json | grep preset
# → "preset": "node-server"
```

This is a build-configuration override only — it does not touch application code.

---

## 6. Health checks

Every service defines a healthcheck; `nginx` waits for `app` to be **healthy**
before starting (`depends_on: condition: service_healthy`).

| Service      | Check                                        | Notes                                                                                     |
| ------------ | -------------------------------------------- | ----------------------------------------------------------------------------------------- |
| `app` (prod) | `node -e "fetch('http://127.0.0.1:3000/')…"` | Uses Node's built-in `fetch`; no extra tooling. Passes on any `status < 500`.             |
| `app` (dev)  | `wget --spider http://127.0.0.1:8080/`       | Vite dev server liveness.                                                                 |
| `nginx`      | `wget --spider http://127.0.0.1/healthz`     | `/healthz` is answered by Nginx directly (returns `200 ok`), independent of the upstream. |

Inspect health:

```bash
docker inspect --format '{{.State.Health.Status}}' spartaflow-app
curl -s http://localhost/healthz     # → ok
```

Tunables live on each healthcheck: `interval`, `timeout`, `retries`,
`start_period` (grace window while the server boots).

---

## 7. Restart policies

| Stack                            | Policy                    | Rationale                                                   |
| -------------------------------- | ------------------------- | ----------------------------------------------------------- |
| Dev (`docker-compose.yml`)       | `restart: unless-stopped` | Survives crashes/reboots but respects a manual stop.        |
| Prod (`docker-compose.prod.yml`) | `restart: always`         | Auto-recovers `app` and `nginx` after crash or host reboot. |

Combined with the healthchecks, a hung `app` is reported unhealthy and Nginx
holds until it recovers. Under an orchestrator, pair `restart` with the health
status to drive automated replacement.

---

## 8. TLS in production (behind Cloudflare)

In real production the container stack sits behind **Cloudflare** (TLS, CDN,
WAF) exactly as in [`docs/DEPLOYMENT_PLAN.md`](./DEPLOYMENT_PLAN.md) §5–6. Two
options:

1. **Cloudflare terminates TLS; origin stays HTTP** on `:80` (Cloudflare mode
   _Full_ — acceptable when the origin is locked to Cloudflare IPs by the host
   firewall). No cert needed in the container. Simplest; default here.
2. **Origin TLS (Full strict, recommended for public origins):** generate a
   Cloudflare Origin CA cert, drop `origin.pem`/`origin.key` into
   `docker/nginx/certs/`, uncomment the `443` block in `docker/nginx/default.conf`,
   uncomment the `443:443` port and the `certs` volume in
   `docker-compose.prod.yml`, then redeploy.

Either way, restrict host ports `80/443` to Cloudflare IP ranges at the VPS
firewall (UFW) so the origin is not directly reachable.

---

## 9. Deploying the image to the VPS

Two patterns (see [`docs/DEPLOYMENT_PLAN.md`](./DEPLOYMENT_PLAN.md) §7):

- **Build on CI, run compose on the VPS:** CI builds `spartaflow:latest` (with
  production `VITE_*` build args) and pushes to a registry; the VPS pulls and
  runs `docker compose -f docker-compose.prod.yml up -d`.
- **Build on the VPS:** `git pull` then
  `docker compose -f docker-compose.prod.yml up -d --build`.

Registry-based flow (illustrative):

```bash
# CI
docker build \
  --build-arg VITE_SUPABASE_URL=$VITE_SUPABASE_URL \
  --build-arg VITE_SUPABASE_PUBLISHABLE_KEY=$VITE_SUPABASE_PUBLISHABLE_KEY \
  --build-arg VITE_SUPABASE_PROJECT_ID=$VITE_SUPABASE_PROJECT_ID \
  -t registry.example.com/spartaflow:$GIT_SHA -t registry.example.com/spartaflow:latest .
docker push registry.example.com/spartaflow:$GIT_SHA

# VPS
docker compose -f docker-compose.prod.yml pull && \
docker compose -f docker-compose.prod.yml up -d
```

**Rollback:** redeploy a previous image tag (`:$GIT_SHA`) — mirrors the
symlink-rollback strategy in the deployment plan. Keep the last few tags.

---

## 10. Image & operational notes

- **Image size:** runtime is `node:20-alpine` with only `.output` copied. Nitro's
  `node-server` output bundles its dependencies, so **no `node_modules`** ships in
  the runtime image.
- **Non-root:** the runtime runs as the unprivileged `app` user.
- **Logging:** prod services use the `json-file` driver with rotation
  (`max-size: 10m`, `max-file: 3`). App-level logging still flows through
  `@/lib/logging` ([`docs/LOGGING.md`](./LOGGING.md)).
- **Resources:** `app` has a `512M` / `1 CPU` limit in prod compose — tune to the
  VPS. SSR memory scales with concurrency.
- **The container holds no durable state.** All data lives in Supabase; images are
  disposable and reproducible from Git + CI (see DR in the deployment plan).

---

## 11. Troubleshooting

| Symptom                           | Likely cause                          | Fix                                                                                             |
| --------------------------------- | ------------------------------------- | ----------------------------------------------------------------------------------------------- |
| `app` unhealthy / exits at boot   | Built with `cloudflare-module` preset | Ensure `NITRO_PRESET=node-server` (it's set in `Dockerfile`); verify `.output/nitro.json` (§5). |
| Blank app / auth fails in browser | `VITE_*` build args missing at build  | Rebuild with the args populated from `.env` (§3). They are inlined, not runtime.                |
| `nginx` never starts              | `app` not healthy yet                 | Check `docker compose logs app`; `nginx` waits on `service_healthy`.                            |
| 502 from Nginx                    | `app` down or wrong upstream port     | Confirm `app` listens on `3000`; check `docker/nginx/default.conf` upstream.                    |
| Secrets appear in bundle          | A secret was `VITE_`-prefixed         | Rename to a non-`VITE_` server var; rebuild (§3).                                               |
| Dev has no HMR                    | Bind mount not applied                | Run via `docker compose up` (not the prod file); confirm the `.:/app` volume.                   |
