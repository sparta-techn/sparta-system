# SpartaFlow — Production Deployment Plan

> Operational runbook for deploying and operating SpartaFlow in production on the
> current infrastructure: **GitHub → Hostinger VPS (Ubuntu) → Cloudflare →
> Supabase**.
>
> This document does **not** change application code. It describes how the
> existing build artifact (`.output/`, produced by TanStack Start + Nitro) is
> shipped, served, secured, backed up, and recovered.
>
> Related: [`docs/INFRASTRUCTURE.md`](./INFRASTRUCTURE.md) (infra-status
> integrations), [`docs/ARCHITECTURE.md`](./ARCHITECTURE.md) (as-built app),
> [`docs/SECURITY.md`](./SECURITY.md), [`docs/SUPABASE_SETUP.md`](./SUPABASE_SETUP.md).

---

## 0. What we are deploying

| Fact                        | Value                                                                                | Source                             |
| --------------------------- | ------------------------------------------------------------------------------------ | ---------------------------------- |
| App type                    | TanStack Start **SSR** app on **Nitro**                                              | `vite.config.ts`, `src/server.ts`  |
| Package manager             | **Bun** (lockfile `bun.lock`, `bunfig.toml`)                                         | repo root                          |
| Runtime                     | Node.js 20 LTS+ / Bun (build currently uses Node 26)                                 | `node -v`                          |
| Build output                | `.output/` — `.output/server/index.mjs` (server) + `.output/public/` (static assets) | `.output/nitro.json`               |
| Current build preset        | `cloudflare-module` ⚠️                                                               | `.output/nitro.json`               |
| **Required preset for VPS** | **`node-server`** (see §7.1)                                                         | this plan                          |
| Client env                  | `VITE_*` vars — **inlined into the browser bundle at build time**                    | `.env.example`                     |
| Server env                  | `SUPABASE_*` (incl. **service-role key** — server-only)                              | `.env.example`, `client.server.ts` |
| Backend                     | **Supabase** (managed Postgres + Auth + Storage + Realtime)                          | `src/integrations/supabase/`       |

> ⚠️ **Critical prerequisite.** The checked-in `.output/` was built with the
> `cloudflare-module` preset (Cloudflare Workers). It **will not run under Node on
> the VPS.** The VPS deployment must rebuild with the Nitro **`node-server`**
> preset. See §7.1.

---

## 1. Deployment Architecture

Four planes, each with a single responsibility:

| Plane                | Provider               | Responsibility                                                        |
| -------------------- | ---------------------- | --------------------------------------------------------------------- |
| **Source & CI/CD**   | GitHub                 | Version control, CI (lint/typecheck/test/build), release trigger      |
| **Edge**             | Cloudflare             | DNS, global CDN, TLS termination, WAF, DDoS, caching, rate limiting   |
| **Origin / compute** | Hostinger VPS (Ubuntu) | Nginx reverse proxy → Nitro Node server (SSR), managed by systemd/PM2 |
| **Backend / data**   | Supabase               | Postgres (RLS), Auth, Storage, Realtime, automated backups            |

```
                         ┌───────────────────────────────────────────┐
                         │                  GitHub                    │
                         │  main → CI (lint/typecheck/test/build)     │
                         │        → build artifact → deploy job       │
                         └────────────────────┬──────────────────────┘
                                              │ SSH / rsync (release)
                                              ▼
  End user ──HTTPS──►  ┌──────────────┐   ┌──────────────────────────────────────┐
                       │  Cloudflare  │──►│        Hostinger VPS (Ubuntu)         │
                       │  DNS + CDN   │   │                                       │
                       │  TLS + WAF   │   │   Nginx (443/80, reverse proxy)       │
                       │  Cache/Rate  │   │        │  proxy_pass 127.0.0.1:3000   │
                       └──────────────┘   │        ▼                              │
                          (Full strict)   │   Nitro Node server (.output)         │
                                          │   systemd/PM2 · Node 20 LTS · :3000   │
                                          └───────────────────┬───────────────────┘
                                                              │ HTTPS (service-role
                                                              │ key, server-only)
                                                              ▼
                                          ┌──────────────────────────────────────┐
                                          │   Supabase (managed cloud)           │
                                          │   Postgres + RLS · Auth · Storage     │
                                          │   Realtime · PITR backups             │
                                          └──────────────────────────────────────┘
```

**Design principles**

- **Cloudflare is the only public entry point.** The VPS origin is not reachable
  directly on 80/443 from the internet (firewall + Cloudflare allowlist, §5/§6).
- **Nitro binds to loopback** (`127.0.0.1:3000`); only Nginx talks to it.
- **The browser never holds the service-role key.** It ships only `VITE_`
  publishable values; privileged access lives in the SSR process
  (`client.server.ts`, dynamic-imported inside server handlers).
- **Supabase is managed** — we do not run Postgres on the VPS.

---

## 2. Network Flow

### 2.1 Request path (page load / SSR)

```
Browser
  → DNS resolve (Cloudflare authoritative) → Cloudflare edge PoP
  → Cloudflare: WAF + rate limit + cache lookup
      ├─ static asset (/assets/*, immutable hash) → served from edge cache (HIT)
      └─ HTML / server function → miss → origin pull
  → TLS to origin (Cloudflare Origin Cert, Full(strict)) → VPS :443
  → Nginx → proxy_pass 127.0.0.1:3000
  → Nitro Node SSR (renders / runs server function)
      └─ server function → Supabase (RLS-scoped or service-role) over HTTPS
  → response → Nginx → Cloudflare (cache per headers) → Browser
```

### 2.2 Auth & data path (client-side)

Per [`docs/ARCHITECTURE.md`](./ARCHITECTURE.md) §10–11, the browser Supabase
client talks to Supabase **directly** for auth and most live reads (session in
`localStorage`, `_authenticated` layout is `ssr: false`). Server functions
(`requireSupabaseAuth` + `attachSupabaseAuth`) exist for privileged paths.

```
Browser ──HTTPS──► Supabase Auth / REST / Realtime      (VITE_SUPABASE_URL, publishable key)
SSR     ──HTTPS──► Supabase (service-role or RLS-scoped) (SUPABASE_URL, server keys)
```

> **CORS / allowed origins:** the production app origin(s) must be added to the
> Supabase project's allowed URL list (Auth → URL Configuration → Site URL +
> Redirect URLs), including reset-password / invitation redirect routes.

### 2.3 Ports & exposure

| Port     | Host     | Exposure                                        | Purpose                            |
| -------- | -------- | ----------------------------------------------- | ---------------------------------- |
| 443 / 80 | VPS      | **Cloudflare IPs only** (UFW + Nginx allowlist) | Public HTTPS/HTTP (80 → 301 https) |
| 3000     | VPS      | **loopback only** (`127.0.0.1`)                 | Nitro Node server                  |
| 22       | VPS      | **admin IP allowlist / key-only**               | SSH                                |
| 443      | Supabase | public (managed)                                | Postgres/Auth/Storage/Realtime API |

---

## 3. Environment Variables

Two classes, split by exposure. This split is load-bearing for security —
**never** promote a secret to a `VITE_` name.

### 3.1 Server-side (secret — never in the browser bundle)

| Var                         | Purpose                                           | Notes                                                   |
| --------------------------- | ------------------------------------------------- | ------------------------------------------------------- |
| `SUPABASE_URL`              | Supabase project API URL (server client)          |                                                         |
| `SUPABASE_PUBLISHABLE_KEY`  | Publishable/anon key for RLS-scoped server client |                                                         |
| `SUPABASE_SERVICE_ROLE_KEY` | **Full RLS bypass.** Server-only admin client     | **Secret.** Never `VITE_`, never commit, rotate on leak |
| `SUPABASE_PROJECT_ID`       | Project ref                                       |                                                         |
| `NODE_ENV`                  | `production`                                      |                                                         |
| `PORT`                      | `3000`                                            | Nitro listen port (loopback)                            |
| `HOST`                      | `127.0.0.1`                                       | Bind loopback only                                      |

### 3.2 Client-side (public — inlined into the bundle at **build** time)

| Var                             | Purpose                                               |
| ------------------------------- | ----------------------------------------------------- |
| `VITE_SUPABASE_URL`             | Supabase API URL for browser client                   |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Publishable key (safe to expose; RLS enforces access) |
| `VITE_SUPABASE_PROJECT_ID`      | Project ref                                           |

> **Build-time vs runtime.** `VITE_*` values are **baked into the artifact** by
> Vite. Changing them requires a **rebuild + redeploy**, not just a process
> restart. Server-side vars are read at **runtime** and can change with a restart.
> ⇒ The CI build must be given the production `VITE_*` values.

### 3.3 Where secrets live (never in Git)

- **Local:** `.env` (git-ignored — confirmed in `.gitignore`). Template is
  `.env.example`.
- **CI:** GitHub Actions **repository/environment secrets** (Settings → Secrets
  and variables → Actions). Build job injects `VITE_*`; deploy job carries SSH
  key + non-`VITE_` secrets to the server.
- **VPS runtime:** `/etc/spartaflow/spartaflow.env`, `root:spartaflow`, mode
  `0640`, referenced by the systemd unit `EnvironmentFile=` (or PM2 `env_file`).
  Never world-readable.

### 3.4 Rotation

- Service-role key rotation: rotate in Supabase dashboard → update
  `/etc/spartaflow/spartaflow.env` → `systemctl restart spartaflow`. No rebuild
  (server-side var).
- Publishable key rotation: update CI secret → **rebuild + redeploy** (it is
  inlined). Publishable keys are low-sensitivity but keep them in sync.

---

## 4. Domains

Cloudflare is authoritative DNS for the apex zone. Suggested layout (adjust the
zone to the real domain):

| Hostname                 | Type     | Proxied (orange cloud) | Points to           | Purpose                           |
| ------------------------ | -------- | ---------------------- | ------------------- | --------------------------------- |
| `spartaflow.com`         | A / AAAA | ✅                     | VPS IP              | Marketing / redirect to app       |
| `app.spartaflow.com`     | A / AAAA | ✅                     | VPS IP              | **Production app (SSR origin)**   |
| `staging.spartaflow.com` | A / AAAA | ✅                     | VPS IP (or 2nd VPS) | Staging / pre-prod                |
| `<ref>.supabase.co`      | —        | (managed)              | Supabase            | Backend API (not in our zone)     |
| `www.spartaflow.com`     | CNAME    | ✅                     | `spartaflow.com`    | Redirect (Cloudflare rule) → apex |

Rules:

- **All app hostnames are proxied** (orange cloud) so the origin IP is hidden and
  WAF/CDN/TLS apply.
- The Supabase hostname stays on Supabase — do **not** proxy it through our zone.
- Add `app.spartaflow.com` (and staging) to Supabase Auth **Site URL** +
  **Redirect URLs** so sign-in, reset-password, invitation, and verify-email
  links resolve to production (§2.2, [`docs/AUTH_IMPLEMENTATION.md`](./AUTH_IMPLEMENTATION.md)).

---

## 5. SSL / TLS

Two TLS legs — edge and origin — both must be encrypted. Target Cloudflare mode:
**Full (strict)**.

```
Browser ──TLS(Cloudflare Universal/Edge cert)──► Cloudflare ──TLS(Origin cert, verified)──► VPS Nginx
```

**Edge (browser ↔ Cloudflare)**

- Cloudflare **Universal SSL** (auto) covers apex + one subdomain level. For
  `app.` and `staging.` this is covered; deeper nesting needs Advanced Cert
  Manager.
- Enable **Always Use HTTPS**, **Automatic HTTPS Rewrites**, **HSTS**
  (`max-age ≥ 15552000`, includeSubDomains, preload once verified), min TLS
  **1.2**.

**Origin (Cloudflare ↔ VPS)** — pick one:

1. **Cloudflare Origin CA cert (recommended).** Generate a 15-year origin cert in
   Cloudflare, install on Nginx (`/etc/ssl/spartaflow/origin.pem` +
   `origin.key`), set SSL mode **Full (strict)**, and enable
   **Authenticated Origin Pulls** so the VPS only accepts Cloudflare.
2. **Let's Encrypt** on the VPS (certbot + Nginx, auto-renew via systemd timer).
   Use if the origin must also serve non-Cloudflare clients.

> **Do not use "Flexible" SSL** — it leaves Cloudflare→origin in cleartext and
> creates redirect loops with `Always Use HTTPS`.

---

## 6. Reverse Proxy (Nginx on the VPS)

Nginx terminates the origin TLS and proxies to the loopback Nitro server. It also
enforces "Cloudflare-only" ingress and long-cache headers for hashed assets.

`/etc/nginx/sites-available/spartaflow` (illustrative):

```nginx
# Restrict origin to Cloudflare IP ranges (keep updated from cloudflare.com/ips)
# include /etc/nginx/cloudflare-ips.conf;  # set of `allow <cidr>;` + `deny all;`

upstream spartaflow_ssr {
    server 127.0.0.1:3000;
    keepalive 32;
}

server {
    listen 80;
    server_name app.spartaflow.com;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name app.spartaflow.com;

    ssl_certificate     /etc/ssl/spartaflow/origin.pem;
    ssl_certificate_key /etc/ssl/spartaflow/origin.key;
    # Authenticated Origin Pulls (Full strict): verify Cloudflare client cert
    ssl_client_certificate /etc/ssl/spartaflow/cloudflare-origin-pull-ca.pem;
    ssl_verify_client on;

    ssl_protocols TLSv1.2 TLSv1.3;
    add_header Strict-Transport-Security "max-age=15552000; includeSubDomains" always;

    # Immutable, content-hashed assets → long cache
    location /assets/ {
        alias /var/www/spartaflow/current/.output/public/assets/;
        access_log off;
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # Everything else → SSR (HTML + server functions)
    location / {
        proxy_pass http://spartaflow_ssr;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto https;
        proxy_read_timeout 60s;
    }

    client_max_body_size 10m;  # tune to Supabase Storage upload path
}
```

Firewall (UFW): allow 22 (admin IPs), 80/443 (Cloudflare IPs only), deny the
rest. Nitro's 3000 stays loopback and is never opened.

> **Alternative:** **Caddy** can replace Nginx and auto-manage Let's Encrypt certs
> with a ~10-line Caddyfile. Nginx is assumed here for explicit Cloudflare-only
> control.

---

## 7. Deployment Strategy

### 7.0 Model

- **Build once in CI**, ship the immutable artifact, **release by atomic symlink
  swap** on the VPS. No building on the production host.
- Directory layout on VPS (zero-downtime, rollback-friendly):

```
/var/www/spartaflow/
  releases/
    2026-07-03T19-30-00Z/   # timestamped release (contains .output/ + node_modules if needed)
    2026-07-02T14-20-00Z/
  current -> releases/2026-07-03T19-30-00Z   # atomic symlink Nginx & systemd use
  shared/                    # persisted across releases (logs, uploads if any)
```

### 7.1 Build (CI) — **must target Node, not Cloudflare**

The repo's default Nitro preset is `cloudflare-module`. For the VPS, build with
the **`node-server`** preset so `.output/server/index.mjs` runs under Node:

```bash
# In CI, with production VITE_* values present in the environment:
export NITRO_PRESET=node-server        # override the cloudflare-module default
bun install --frozen-lockfile
bun run build                          # → .output/  (Node server + public assets)
```

> If `NITRO_PRESET` is not honored by the Lovable config wrapper, set the Nitro
> preset via the config's Nitro options or a `nitro.config` override. **Verify**
> `.output/nitro.json` shows `"preset": "node-server"` and
> `"serverEntry": "server/index.mjs"` before shipping. This is a config/CI change
> only — no application source change.

CI pipeline (GitHub Actions, `main` → production):

1. `bun install --frozen-lockfile`
2. `bun run lint` · `bun run typecheck`
3. `bun run test` (unit + component); Playwright e2e on a preview if configured
4. `NITRO_PRESET=node-server bun run build` (inject production `VITE_*` secrets)
5. Package `.output/` (+ `package.json`, lockfile) → artifact / tarball
6. Deploy job (on protected `production` environment, manual approval):
   `rsync` the release to `releases/<ts>/`, run any DB migrations (§7.3),
   flip `current` symlink, `systemctl restart spartaflow`, health-check, then
   purge Cloudflare cache for HTML.

### 7.2 Run (systemd on the VPS)

`/etc/systemd/system/spartaflow.service`:

```ini
[Unit]
Description=SpartaFlow SSR (Nitro/Node)
After=network.target

[Service]
Type=simple
User=spartaflow
WorkingDirectory=/var/www/spartaflow/current
EnvironmentFile=/etc/spartaflow/spartaflow.env
Environment=NODE_ENV=production
Environment=HOST=127.0.0.1
Environment=PORT=3000
ExecStart=/usr/bin/node .output/server/index.mjs
Restart=always
RestartSec=3
# Hardening
NoNewPrivileges=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=/var/www/spartaflow/shared

[Install]
WantedBy=multi-user.target
```

> PM2 is an acceptable alternative (`pm2 start .output/server/index.mjs --name
spartaflow -i 1` + `pm2 save` + `pm2 startup`). systemd is preferred for a
> single-app VPS: simpler, no extra dependency, native journald logs.

### 7.3 Database migrations (Supabase)

- Migrations live in `supabase/migrations/` (10 today, per ARCHITECTURE §10).
- Apply **before** flipping the symlink to a release that depends on new schema:
  `supabase db push` (or `supabase migration up`) against the **production**
  project using a CI service token — **never** point CI at prod without a review
  gate.
- After a migration, regenerate `src/integrations/supabase/types.ts` in a normal
  dev change (not during deploy).
- Migrations must be **forward-only and backward-compatible** for one release
  (expand/contract) so a rollback of the app code still works against the new
  schema (§8).

### 7.4 Health check & cutover

- Health endpoint: an SSR route returning 200 (e.g. `/` or a lightweight
  `/healthz` if added later). Deploy job polls `http://127.0.0.1:3000/` for 200
  before flipping the symlink; abort + keep old release on failure.
- After cutover: purge Cloudflare cache for HTML (assets are content-hashed and
  need no purge).

### 7.5 Environments

| Env        | Branch               | Host                     | Supabase project         |
| ---------- | -------------------- | ------------------------ | ------------------------ |
| Production | `main` (tag/release) | `app.spartaflow.com`     | prod project             |
| Staging    | `staging`            | `staging.spartaflow.com` | separate staging project |

Keep prod and staging on **separate Supabase projects** so migrations and seed
data can be validated before prod.

---

## 8. Rollback Strategy

Fast path is a symlink swap; the artifact for the previous release is retained.

**App rollback (seconds):**

```bash
ln -sfn /var/www/spartaflow/releases/<previous-ts> /var/www/spartaflow/current
systemctl restart spartaflow
# health check, then purge Cloudflare HTML cache
```

- Keep the last **5** releases in `releases/`; prune older.
- Trigger criteria: failed post-deploy health check, error-rate/latency spike
  (surfaced via logging, [`docs/LOGGING.md`](./LOGGING.md)), or a Sev-1 bug.

**Config/secret rollback:** revert `/etc/spartaflow/spartaflow.env` from the
previous copy and `systemctl restart` (no rebuild for server-side vars).

**Database rollback (careful):**

- Because migrations are **expand/contract & backward-compatible for one
  release**, rolling the app back one version is safe against the newer schema —
  no DB rollback needed in the normal case.
- A destructive migration must ship its own reverse migration and be treated as a
  **separate, gated** change. Prefer roll-_forward_ (a new fix migration) over
  dropping columns to undo. Restore-from-backup (§9) is the last resort and loses
  data written since the snapshot.

**Cloudflare rollback:** WAF/cache/rule changes are versioned in the dashboard;
revert the specific rule. Keep DNS + SSL changes small and logged.

---

## 9. Backup Strategy

Aligns with the intent in [`docs/BackupStrategy.md`](./BackupStrategy.md);
concretized for this stack.

| What                         | Mechanism                                                                                                 | Frequency                              | Retention                       | Location                                |
| ---------------------------- | --------------------------------------------------------------------------------------------------------- | -------------------------------------- | ------------------------------- | --------------------------------------- |
| **Supabase Postgres**        | Managed daily backups **+ PITR** (Point-in-Time Recovery) — enable on the paid plan                       | Continuous WAL (PITR) + daily snapshot | ≥ 7 days PITR; 30-day snapshots | Supabase-managed, off-VPS               |
| **Logical DB dump**          | `pg_dump` via CI cron (or Supabase CLI) to encrypted object storage                                       | Daily                                  | 30 days                         | Off-site bucket (e.g. R2/S3), encrypted |
| **Supabase Storage (files)** | Bucket replication / periodic sync to off-site object storage                                             | Daily                                  | 30 days                         | Off-site bucket                         |
| **Source of truth (code)**   | GitHub (repo + tags/releases)                                                                             | On push                                | Indefinite                      | GitHub                                  |
| **Migrations**               | `supabase/migrations/` in Git — schema is reproducible                                                    | On change                              | Indefinite                      | GitHub                                  |
| **VPS config**               | Nginx conf, systemd unit, `spartaflow.env` **template** (no secrets), UFW rules → infra repo / documented | On change                              | Indefinite                      | Git (secrets excluded)                  |
| **Secrets**                  | Stored in a password manager / secrets vault + GitHub Actions secrets                                     | On rotation                            | Current + previous              | Vault                                   |
| **Release artifacts**        | Last 5 releases retained on VPS                                                                           | Per deploy                             | 5 releases                      | VPS `releases/`                         |

Principles:

- **The VPS holds no unique state.** All durable data lives in Supabase; the VPS
  is reproducible from Git + CI. This is what makes DR (§10) fast.
- Backups are **encrypted at rest** and **stored off the VPS and off the primary
  Supabase project**.
- **Test restores quarterly** — a backup is only real once a restore has been
  demonstrated (§10.3).

---

## 10. Disaster Recovery

**Objectives (targets — confirm with stakeholders):**

| Metric                             | Target                                   |
| ---------------------------------- | ---------------------------------------- |
| **RTO** (time to restore service)  | ≤ 2 hours                                |
| **RPO** (max acceptable data loss) | ≤ 15 min (PITR) / ≤ 24 h (snapshot-only) |

### 10.1 Failure scenarios & response

| Scenario                               | Blast radius                  | Response                                                                                                                                                    |
| -------------------------------------- | ----------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Nitro process crash**                | SSR down                      | `Restart=always` auto-recovers; alert if flapping                                                                                                           |
| **VPS reboot**                         | Brief outage                  | systemd `WantedBy=multi-user.target` auto-starts; Cloudflare serves cached assets meanwhile                                                                 |
| **VPS lost / corrupted**               | Origin down                   | Provision new Hostinger VPS → run bootstrap (§10.2) → flip DNS/keep Cloudflare → restore config from Git. **No data restore needed** (state is in Supabase) |
| **Bad release**                        | Errors in prod                | Symlink rollback (§8)                                                                                                                                       |
| **Supabase outage**                    | App degraded/down (auth+data) | Wait on Supabase status; app shows error states ([`docs/ERROR_HANDLING.md`](./ERROR_HANDLING.md)); no local failover (managed dependency)                   |
| **Supabase data loss / bad migration** | Data corruption               | **PITR** restore to just before the event, or restore latest logical dump; then roll app forward                                                            |
| **Cloudflare outage**                  | Edge down                     | Rare; optionally keep a documented "grey-cloud" (DNS-only) fallback to reach origin directly, accepting loss of WAF/CDN                                     |
| **Secret leak (service-role key)**     | Full DB exposure risk         | Rotate key in Supabase immediately (§3.4), restart service, audit access logs, review RLS                                                                   |
| **Domain/DNS compromise**              | Traffic hijack                | Cloudflare 2FA + scoped API tokens; registrar lock; recover via Cloudflare support                                                                          |

### 10.2 VPS rebuild runbook (origin lost)

1. Provision fresh Hostinger VPS (Ubuntu LTS), harden (SSH keys, UFW, fail2ban).
2. Install runtime: Node 20 LTS (or Bun), Nginx.
3. Restore `/etc/nginx/sites-available/spartaflow`, systemd unit, UFW + Cloudflare
   IP allowlist, origin TLS cert/key from the config backup (§9).
4. Restore `/etc/spartaflow/spartaflow.env` from the secrets vault.
5. Pull the latest release artifact from CI (or re-run the deploy job targeting
   the new host); lay it under `releases/`, point `current`.
6. `systemctl enable --now spartaflow`; health-check on loopback.
7. Update Cloudflare DNS A/AAAA to the new origin IP (proxied). TTL is low
   because Cloudflare proxies — propagation is edge-side and fast.
8. Verify end-to-end (auth sign-in, a live read, an SSR route).

### 10.3 Verification & drills

- **Quarterly:** restore the latest Supabase logical dump into a scratch project
  and run smoke tests; time it against RTO/RPO.
- **Semi-annually:** full VPS-rebuild drill on a throwaway host from
  backups/Git only.
- Record each drill's measured RTO/RPO and fix any gap (missing config in Git,
  undocumented step, stale secret).

### 10.4 Monitoring & alerting (feeds DR)

- **Uptime:** external monitor (e.g. Cloudflare Health Checks / UptimeRobot) on
  `https://app.spartaflow.com` → alert on non-200.
- **Logs:** journald on the VPS; app errors via `@/lib/logging`
  ([`docs/LOGGING.md`](./LOGGING.md)). Ship to a central sink if/when available.
- **Supabase:** dashboard alerts (DB CPU, storage, connection saturation) +
  status page subscription.
- **Certs:** alert ≥ 14 days before origin/edge cert expiry (Let's Encrypt renews
  automatically; Cloudflare Origin CA is long-lived).
- **Deploys:** CI notifies on build/deploy failure; post-deploy health check gates
  cutover (§7.4).

---

## 11. Pre-Production Checklist

- [ ] Build produces **`node-server`** preset (`.output/nitro.json` verified) — §7.1
- [ ] Production `VITE_*` values injected at **build** time in CI — §3.2
- [ ] `SUPABASE_SERVICE_ROLE_KEY` present **only** in `/etc/spartaflow/spartaflow.env` (0640), never `VITE_`, never in Git — §3
- [ ] Supabase Auth Site URL + Redirect URLs include prod (and staging) hostnames — §4
- [ ] Cloudflare SSL mode = **Full (strict)**; Always Use HTTPS + HSTS on — §5
- [ ] Origin cert installed; **Authenticated Origin Pulls** enabled — §5/§6
- [ ] UFW: 80/443 restricted to Cloudflare IPs; 3000 loopback; SSH key-only — §6
- [ ] systemd unit enabled, `Restart=always`, hardening flags on — §7.2
- [ ] Atomic-symlink release layout + last-5 retention — §7/§8
- [ ] Migrations applied (expand/contract) before dependent release — §7.3
- [ ] Supabase PITR enabled; daily logical dump to off-site encrypted bucket — §9
- [ ] Uptime monitor + Supabase alerts + cert-expiry alerts configured — §10.4
- [ ] Rollback + VPS-rebuild runbooks tested at least once — §8/§10

---

_This plan operates the artifact as built. The single blocking change before the
first VPS deploy is switching the Nitro build preset from `cloudflare-module` to
`node-server` (§7.1) — a build/CI configuration change, not an application code
change._
