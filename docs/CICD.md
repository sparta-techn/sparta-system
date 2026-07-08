# SpartaFlow — CI/CD Guide

> GitHub Actions pipeline that lints, tests, builds, security-scans, deploys,
> and rolls back SpartaFlow. Build artifact is a Docker image (see
> [`docs/DOCKER.md`](./DOCKER.md)) published to **GHCR**; deploys run over SSH to
> the **Hostinger VPS** and are fronted by **Cloudflare + Nginx**
> ([`docs/DEPLOYMENT_PLAN.md`](./DEPLOYMENT_PLAN.md), [`docs/NGINX.md`](./NGINX.md)).

---

## 1. Workflows

| Workflow          | File                                  | Trigger                            | Purpose                                                          |
| ----------------- | ------------------------------------- | ---------------------------------- | ---------------------------------------------------------------- |
| **Lint**          | `.github/workflows/lint.yml`          | PR, non-main push, `workflow_call` | ESLint, Prettier check, `tsc` typecheck                          |
| **Test**          | `.github/workflows/test.yml`          | PR, non-main push, `workflow_call` | Vitest unit + component (blocking); Playwright e2e (best-effort) |
| **Build**         | `.github/workflows/build.yml`         | `workflow_call`, manual            | Build & push the production Docker image to GHCR                 |
| **Security Scan** | `.github/workflows/security-scan.yml` | PR, main push, weekly, manual      | CodeQL, dependency review, npm audit, Gitleaks, Trivy FS         |
| **Deploy**        | `.github/workflows/deploy.yml`        | main push, `v*.*.*` tag, manual    | Gated Lint→Test→Build→Deploy with health-check auto-rollback     |
| **Rollback**      | `.github/workflows/rollback.yml`      | manual                             | Redeploy a previous image to an environment                      |

Lint/Test/Build are **reusable** (`workflow_call`) so Deploy runs them as gates
in one pipeline — no duplicate runs on `main` (their `push` triggers use
`branches-ignore: [main]`; on `main`, Deploy invokes them instead). PRs still get
fast standalone Lint/Test/Security checks.

```
PR ───────────────► Lint · Test · Security Scan            (status checks)
push main ────────► Deploy: Lint→Test→Build→Deploy(staging)→Notify
tag vX.Y.Z ───────► Deploy: Lint→Test→Build→Deploy(production, manual approval)→Notify
manual (dispatch) ► Deploy(chosen env/image)  |  Rollback(chosen env/image)
```

---

## 2. Deployment triggers (as required)

- **Automatic deployment on `main`** — every push to `main` runs the full gated
  pipeline and deploys to the **`staging`** environment automatically.
- **Manual deployment on a production tag** — pushing a semver tag `vX.Y.Z`
  targets the **`production`** environment, which is protected by **required
  reviewers**, so the deploy pauses for a human to approve in the GitHub UI
  (that is the "manual" gate).
- **On-demand** — `workflow_dispatch` lets you deploy any image ref to `staging`
  or `production` from the Actions tab.

> Want `main` to deploy straight to production instead of staging? Change the
> environment expression in `deploy.yml` (`… 'production' || 'staging'`) or point
> both at one environment. Requiring reviewers on `production` will make `main`
> deploys pause for approval too — that's the tradeoff.

---

## 3. Required configuration

### 3.1 Environments (Settings → Environments)

Create **`staging`** and **`production`**. On `production` add **Required
reviewers** (this is the manual-approval gate) and optionally a deployment branch
/ tag rule (`v*.*.*`).

### 3.2 Secrets

Repository or per-environment secrets (per-environment is preferred so staging
and production use different targets/keys):

| Secret                          | Used by          | Notes                                                                    |
| ------------------------------- | ---------------- | ------------------------------------------------------------------------ |
| `VITE_SUPABASE_URL`             | Build            | Inlined into the browser bundle at build time                            |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Build            | Public/publishable key                                                   |
| `VITE_SUPABASE_PROJECT_ID`      | Build            |                                                                          |
| `VPS_HOST`                      | Deploy, Rollback | VPS hostname/IP                                                          |
| `VPS_USER`                      | Deploy, Rollback | SSH user                                                                 |
| `VPS_SSH_KEY`                   | Deploy, Rollback | Private key (deploy key) for that user                                   |
| `VPS_SSH_PORT`                  | Deploy, Rollback | Optional; defaults to `22`                                               |
| `GHCR_TOKEN`                    | Deploy, Rollback | Optional PAT for the VPS to pull from GHCR; falls back to `GITHUB_TOKEN` |
| `SLACK_WEBHOOK_URL`             | Deploy, Rollback | Optional; enables Slack notifications                                    |

> `GITHUB_TOKEN` is provided automatically for pushing to GHCR from the runner
> (Build has `packages: write`). The **server-side** Supabase secrets
> (`SUPABASE_SERVICE_ROLE_KEY`, etc.) are **not** in CI — they live in the VPS
> `.env` and are read at runtime (see [`docs/DEPLOYMENT_PLAN.md`](./DEPLOYMENT_PLAN.md) §3).

### 3.3 Variables (Settings → Variables)

| Variable     | Used by          | Notes                                                                                        |
| ------------ | ---------------- | -------------------------------------------------------------------------------------------- |
| `DEPLOY_DIR` | Deploy, Rollback | Absolute path on the VPS holding `docker-compose.prod.yml` + `.env` (e.g. `/opt/spartaflow`) |

### 3.4 VPS prerequisites

- Docker + Compose v2 installed; the SSH user is in the `docker` group.
- `DEPLOY_DIR` contains `docker-compose.prod.yml`, `.env` (runtime secrets), and
  `deployment/nginx.conf` (or the `docker/nginx/` config).
- The compose `app` service image is `${SPARTAFLOW_IMAGE:-…}` (already wired), so
  CI can pin the exact image to run.

### 3.5 Branch protection

Require **Lint**, **Test**, and **Security Scan** checks to pass before merging to
`main`. That keeps `main` releasable; Deploy re-runs Lint/Test/Build as a final
gate regardless.

---

## 4. How a deploy works

1. **Gates** — `lint` + `test` run; on success `build` builds the Docker image
   (with `VITE_*` build args) and pushes it to GHCR tagged by commit SHA
   (`ghcr.io/<owner>/<repo>:<sha>`), plus `latest` on main and the semver on tags.
2. **Resolve image** — Deploy uses the SHA-tagged ref from Build (or the manual
   `image` input).
3. **Ship (SSH)** — on the VPS: `docker login ghcr.io`, set
   `SPARTAFLOW_IMAGE=<ref>`, `docker compose -f docker-compose.prod.yml pull`,
   then `up -d`.
4. **Health-check** — polls `http://127.0.0.1/healthz` (the Nginx endpoint) up to
   ~60s.
5. **Auto-rollback** — if unhealthy, it redeploys the **previous** image recorded
   in `.deployed_image` and fails the job. On success it records the new image as
   the next rollback baseline.
6. **Notify** — Slack message with status, environment, image, and a run link
   (skipped if `SLACK_WEBHOOK_URL` is unset).

---

## 5. Rollback

Two paths (both satisfy the rollback requirement):

- **Automatic** — a failed post-deploy health check rolls back to the previous
  good image within the same Deploy run (§4.5).
- **Manual** — run the **Rollback** workflow (Actions → Rollback → _Run
  workflow_): pick the environment and either paste an image ref to roll back to,
  or leave it blank to use the host's previous-good image (`.rollback_image`).
  It pulls, `up -d`, health-checks, updates the baseline, and notifies.

Because images are retained in GHCR by SHA, you can always roll back to any prior
build by tag.

---

## 6. Security scanning

`security-scan.yml` runs five independent checks:

| Check                    | Tool                                               | Blocking?                            |
| ------------------------ | -------------------------------------------------- | ------------------------------------ |
| Static analysis          | **CodeQL** (`security-and-quality`)                | Findings surface in the Security tab |
| PR dependency diff       | **dependency-review-action**                       | Blocks PR on `high`+ new vulns       |
| Dependency vulns         | **npm audit** (uses committed `package-lock.json`) | Non-blocking (triage in log)         |
| Secrets                  | **Gitleaks**                                       | Blocks on leaked secrets             |
| FS vuln/secret/misconfig | **Trivy** (`HIGH,CRITICAL`, SARIF → code scanning) | Reports to Security tab              |

Runs on PRs, `main`, and weekly. It's reusable (`workflow_call`) — add it to
Deploy's `needs` if you want deploys gated on a clean scan.

---

## 7. Local parity

The pipeline runs exactly what you can run locally:

```bash
bun run lint && bunx prettier --check . && bun run typecheck   # Lint
bun run test:unit && bun run test:component                     # Test
docker build -t spartaflow:local .                             # Build (Node preset)
docker compose -f docker-compose.prod.yml up -d                 # Deploy (local)
```

---

## 8. Notes & caveats

- **No git remote is configured yet.** These workflows assume the repo is hosted
  on GitHub; image names derive from `${{ github.repository }}` automatically once
  it is.
- **Lovable history:** per [`AGENTS.md`](../AGENTS.md), don't rewrite pushed
  history. The pipeline never force-pushes; it only reads the repo and deploys.
- **e2e is best-effort** — Playwright boots the app via `npm run dev` and needs
  `VITE_*` secrets; it's `continue-on-error` so it never blocks a deploy. Promote
  it to blocking once it's stable with seeded test data.
- **Preset reminder:** the image builds with `NITRO_PRESET=node-server`
  (Dockerfile) — the Cloudflare default preset won't run under Node. See
  [`docs/DOCKER.md`](./DOCKER.md) §5.
