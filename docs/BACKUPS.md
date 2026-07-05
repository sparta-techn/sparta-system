# SpartaFlow — Backup & Recovery Strategy

> The **operational** backup and disaster-recovery plan for the current
> infrastructure — **GitHub · Hostinger VPS (Docker) · Cloudflare · Supabase**.
> It concretizes the intent in [`docs/BackupStrategy.md`](./BackupStrategy.md)
> (the target spec) and the DR section of
> [`docs/DEPLOYMENT_PLAN.md`](./DEPLOYMENT_PLAN.md) §9–10 into runnable procedures.
>
> Guiding principle: **the VPS holds no unique state.** All durable data lives in
> Supabase; the VPS is reproducible from Git + CI. That is what makes recovery
> fast and cheap.

---

## 1. Objectives (RPO / RTO)

| Tier | RPO (max data loss) | RTO (time to restore) |
|---|---|---|
| **Database (Supabase)** | ≤ 5 min with PITR · ≤ 24 h snapshot-only | Row/table: ≤ 1 h · Full: ≤ 4 h |
| **Storage (files)** | ≤ 24 h (nightly sync) · 0 within version window | ≤ 1 h |
| **Application origin (VPS)** | 0 (no unique state) | ≤ 2 h (rebuild) |
| **Configuration / secrets** | 0 (in Git / vault) | minutes |

Confirm these with stakeholders; they drive the schedule and plan tier in §7.

---

## 2. What gets backed up

| Asset | Where it lives | Mechanism | Owner |
|---|---|---|---|
| **Postgres data** | Supabase | Managed daily snapshot **+ PITR (WAL)** | Supabase (managed) |
| **Logical DB dump** | Supabase → off-site bucket | `pg_dump --format=custom`, encrypted | CI cron (§7) |
| **Auth users** | Supabase `auth.*` | Included in the logical dump | CI cron |
| **Storage objects** | Supabase Storage (4 buckets, §4) | Nightly sync to off-site + version window | CI cron |
| **Schema migrations** | Git `supabase/migrations/` | Version control | Git |
| **Application code** | Git + GHCR images | Version control + image registry | Git / CI |
| **VPS config** | `deployment/`, `docker/`, compose, workflows in Git | Version control | Git |
| **Runtime secrets** | VPS `.env`, GitHub Actions secrets | Secrets vault (not Git) | Ops |
| **Audit logs** | `audit_logs` table | In DB backups; optional cold export | Supabase / CI |

> **Off-site** = a cloud object store in a **different account/provider** from
> Supabase (e.g. Cloudflare R2 or AWS S3), so a single-account compromise or
> deletion can't take the primary and its backups together.

---

## 3. Supabase backups

Two independent layers — never rely on one.

### 3.1 Managed backups + PITR (primary)
- Enable **Point-in-Time Recovery** on the production project (paid plan).
  Gives continuous WAL archiving → restore to any moment within the window.
- Daily base snapshots retained per plan (target: **PITR ≥ 7 days**, snapshots
  **30 days**).
- Staging is a **separate Supabase project** so migrations are validated before
  prod and a bad migration can't touch prod data.

### 3.2 Off-site logical dumps (defense in depth)
A managed backup you can't export is a single point of failure. Take a daily
`pg_dump` to an off-site, encrypted bucket:

```bash
# Custom format (parallel restore, selective table restore), gzipped + age-encrypted.
pg_dump "$SUPABASE_DB_URL" \
  --format=custom --no-owner --no-privileges \
  | gzip \
  | age -r "$AGE_PUBLIC_KEY" \
  > "spartaflow-$(date -u +%Y%m%dT%H%M%SZ).dump.gz.age"
# → upload to r2://spartaflow-backups/db/ (object-lock / write-once if available)
```

- Use a **read-only** DB role for dumps.
- **Encrypt at rest** (age/GPG) before upload; the bucket is also SSE-encrypted.
- **Integrity check:** monthly, restore the latest dump into an ephemeral DB and
  diff `pg_dump --schema-only` against the migrations-derived schema (§6).

---

## 4. Storage backups

Real buckets (authoritative list from `src/lib/supabase/storage.ts`):

| Bucket | Contents | Backup |
|---|---|---|
| `avatars` | Profile images (public) | Nightly sync + version window |
| `task-attachments` | Files on tasks (private) | Nightly sync + version window |
| `project-files` | Project documents (private) | Nightly sync + version window |
| `report-attachments` | EOD/report attachments (private) | Nightly sync + version window |

> The broader bucket catalogue in [`docs/StorageArchitecture.md`](./StorageArchitecture.md)
> is the target spec; back up **whatever buckets exist** in `STORAGE_BUCKETS` —
> keep this table in sync when buckets are added.

Mechanism:
- Storage objects sit in Supabase's underlying object store and are included in
  project snapshots, **but** also run an independent **nightly diff-sync** to the
  off-site bucket (e.g. `rclone sync` via the S3-compatible Storage endpoint) so
  files survive a project-level loss.
- Enable **bucket versioning** where available (30-day window) so accidental
  overwrites/deletes are recoverable without a full restore.
- Object paths are UUID-prefixed, so re-uploads never collide on restore.

---

## 5. Configuration backups

Configuration is **code**, so Git is the backup — nothing bespoke to snapshot:

| Config | Source of truth |
|---|---|
| Nginx | `deployment/nginx.conf`, `docker/nginx/default.conf` |
| Containers | `Dockerfile`, `Dockerfile.dev`, `docker-compose*.yml` |
| CI/CD | `.github/workflows/*` |
| DB schema | `supabase/migrations/` |
| Env template | `.env.example` (real values excluded) |
| systemd unit / UFW rules | documented in `docs/DEPLOYMENT_PLAN.md`; keep the unit file in an infra repo |

**Secrets are NOT in Git.** Back them up separately:
- **GitHub Actions secrets** (CI) — per environment; re-enterable from the vault.
- **VPS `.env`** — the live server secrets; keep a copy of current + previous in a
  **password manager / secrets vault**. Rotate per
  [`docs/ENVIRONMENT.md`](./ENVIRONMENT.md) §5.3.
- `SUPABASE_SERVICE_ROLE_KEY` is the crown jewel — vault-only, rotate on any leak.

---

## 6. Backup integrity & verification

A backup is not real until a restore has been demonstrated.

- **Monthly** — restore the latest logical dump into a scratch project; run the
  restore smoke pack (§8.5). Diff schema against migrations.
- **Nightly** — the backup job fails loudly (alert) if `pg_dump` exits non-zero,
  the artifact is smaller than a floor size, or the upload fails.
- **Quarterly** — spot-check N random storage objects' checksums against source.
- **Encryption** — verify a dump can be decrypted with the escrowed key (a lost
  key = lost backup).

---

## 7. Backup schedule

| Job | Frequency | Retention | Location | Automation |
|---|---|---|---|---|
| Supabase PITR (WAL) | continuous | ≥ 7 days | Supabase | Managed |
| Supabase daily snapshot | daily | 30 days | Supabase | Managed |
| Logical `pg_dump` (encrypted) | **daily 02:00 UTC** | 30 days (+ monthly kept 365 d) | Off-site bucket | GitHub Actions cron |
| Storage diff-sync | **nightly 03:00 UTC** | 30 days | Off-site bucket | GitHub Actions cron |
| Restore verification | monthly | — | scratch project | GitHub Actions / manual |
| Secrets escrow refresh | on rotation | current + previous | Vault | Manual |
| Config (Git) | on change | permanent | GitHub | Git |
| DR drill (full) | quarterly | logged | — | Manual (§9) |

Automate the two data jobs with a scheduled workflow (sketch):

```yaml
# .github/workflows/backup.yml (illustrative — add when secrets are provisioned)
on:
  schedule:
    - cron: "0 2 * * *"   # daily DB dump
    - cron: "0 3 * * *"   # nightly storage sync
jobs:
  db-dump:
    runs-on: ubuntu-latest
    steps:
      - run: ./scripts/backup-db.sh      # pg_dump | gzip | age | upload to R2
  storage-sync:
    runs-on: ubuntu-latest
    steps:
      - run: rclone sync supabase:spartaflow r2:spartaflow-backups/storage
```

Store `SUPABASE_DB_URL` (read-only role), `AGE_PUBLIC_KEY`, and the off-site
bucket credentials as GitHub Actions secrets.

---

## 8. Restore process

Each runbook: **assess → restore → verify → cut over → record** (write an
`audit_logs`/ops-log entry). Prefer roll-*forward* over destructive undo.

### 8.1 Recover deleted rows (PITR clone) — RTO ~30 min
1. Supabase → **restore to a new project / branch** at `T = incident − 5 min` (PITR).
2. `psql` into the clone; `COPY`/`SELECT` the affected rows.
3. Re-insert into prod preserving original IDs and FKs.
4. Write an `audit_logs` entry `action = 'restore'`; drop the clone.

### 8.2 Recover a dropped table — RTO ~1 h
1. PITR clone to just before the drop.
2. `pg_dump -t schema.table` from the clone → `pg_restore` into prod.
3. Re-apply dependent objects (views, policies, indexes) from `supabase/migrations/`.
4. Restore RLS; run sanity queries; audit-log.

### 8.3 Full database restore — RTO ≤ 4 h
1. **PITR path (preferred):** restore the prod project to the chosen timestamp.
2. **Dump path (project lost):** create a new project, apply
   `supabase/migrations/`, then `pg_restore` the latest decrypted logical dump.
3. Regenerate `src/integrations/supabase/types.ts` if schema changed.
4. Point the app at the restored project: update `SUPABASE_*` in the VPS `.env`
   and the `VITE_SUPABASE_*` CI secrets (**rebuild** — they're inlined, see
   [`docs/ENVIRONMENT.md`](./ENVIRONMENT.md)).
5. Update Supabase **Auth redirect URLs** for the app domain.
6. Verify (§8.5); cut over.

### 8.4 Recover storage objects — RTO ~1 h
1. Find the object path (`attachments`/feature row → bucket + path).
2. **Within version window:** restore the prior version in place.
3. **Beyond window:** pull from the off-site sync copy → re-upload to the same
   UUID-prefixed path.

### 8.5 Rebuild the VPS origin — RTO ≤ 2 h
No data restore needed (state is in Supabase). Follow
[`docs/DEPLOYMENT_PLAN.md`](./DEPLOYMENT_PLAN.md) §10.2:
1. Provision a fresh Hostinger VPS (Ubuntu LTS); harden (SSH keys, UFW, Cloudflare-only 80/443).
2. Install Docker + Compose; restore `nginx`, systemd unit, `.env` from Git + vault.
3. `docker compose -f docker-compose.prod.yml pull && up -d` (or redeploy via CI).
4. Health-check `/healthz`; update Cloudflare DNS to the new origin IP (proxied).
5. Verify (§8.6).

### 8.6 Post-restore verification (smoke pack)
- `select count(*) > 0 from profiles;` and `from user_roles where …;`
- RLS holds (a non-privileged user can't read another's rows).
- Auth **sign-in** works for two test accounts.
- An **attendance** check-in/out cycle works (the live-wired feature).
- A signed URL for a private storage object resolves.
- The app health endpoint is `healthy` ([`docs/MONITORING.md`](./MONITORING.md)).

---

## 9. Disaster recovery

| Scenario | RPO | Response |
|---|---|---|
| Accidental row/table delete | 0 (PITR) | §8.1 / §8.2 |
| Bad migration corrupts data | ≤ 5 min | PITR restore (§8.3) then roll schema forward |
| Supabase project lost | ≤ 24 h | Rebuild from dump into a new project (§8.3) |
| Supabase region outage | ≤ 24 h | Restore latest cross-region dump into a project in another region |
| Storage object lost | 0–24 h | §8.4 |
| VPS lost/corrupted | 0 | Rebuild origin (§8.5) — no data loss |
| Bad app release | 0 | Image rollback (auto or manual) — [`docs/CICD.md`](./CICD.md) §5 |
| Service-role key leak | 0 | Rotate immediately, restart, audit access ([`docs/DEPLOYMENT_PLAN.md`](./DEPLOYMENT_PLAN.md) §10) |
| Backup account compromise | — | Off-site write-once/object-lock; separate account; rotate credentials |

**DR drills:** quarterly full restore of the latest dump into a scratch project +
smoke pack; semi-annual VPS-rebuild drill from backups/Git only. Record measured
RTO/RPO and fix any gap (missing config in Git, stale secret, undocumented step).

---

## 10. Access control & compliance

- Backups stored in a **separate cloud account** from production; **write-once /
  object-lock** where supported to resist tampering and ransomware.
- Restore credentials held by **≥ 2** engineers; rotated quarterly; restore
  actions logged and reviewed.
- Backups stay in the primary's **data-residency region** unless cross-region DR
  explicitly requires otherwise.
- **GDPR erasure** cascades into backups via a suppression list applied at
  restore time; audit-log cold archive retained per policy
  ([`docs/AUDIT_LOGS.md`](./AUDIT_LOGS.md)).

---

## 11. Gaps to close (current state)

- [ ] Enable Supabase **PITR** on production (paid plan).
- [ ] Provision the off-site bucket + `scripts/backup-db.sh` + `.github/workflows/backup.yml`.
- [ ] Provision storage diff-sync (`rclone`) and enable bucket versioning.
- [ ] Escrow `SUPABASE_SERVICE_ROLE_KEY` and the age key in the vault.
- [ ] Run the first monthly restore-verification and quarterly DR drill; log RTO/RPO.

---

*This is the operational plan for the as-built infrastructure. When infra changes
(new buckets, a managed replica, a second region), update §4, §7, and §9.*
