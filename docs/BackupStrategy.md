# Backup & Disaster Recovery — SpartaFlow Hub

Goal: **RPO ≤ 1 hour, RTO ≤ 4 hours** for production. Tested quarterly with documented runbooks.

## 1. What Gets Backed Up

| Asset | Mechanism | Frequency | Retention |
|---|---|---|---|
| Postgres data | Supabase Daily Backup + Point-in-Time Recovery (PITR) | Continuous WAL; daily base | 30 days PITR, 90 days daily |
| Logical dumps (cross-region) | `pg_dump --format=custom` to off-platform object store (S3/R2) | Daily | 365 days |
| Storage buckets | Supabase bucket versioning + nightly diff-sync to off-platform | Versioning continuous; sync nightly | 30 days versioned, 1 year sync |
| Auth users (metadata) | Included in logical dump (`auth.users` snapshot via Admin API export) | Daily | 365 days |
| Edge Functions code | Git repo + tagged release artifacts | Per release | Permanent |
| Schema migrations | Git repo `supabase/migrations/` | Per change | Permanent |
| Vault secrets | Encrypted export to off-platform KMS-wrapped store | Weekly | 90 days |
| Audit logs | Monthly export to cold storage (Parquet) | Monthly | 7 years |

## 2. RPO / RTO

| Failure | RPO | RTO |
|---|---|---|
| Accidental row delete | 0 (PITR) | 30 min (clone DB to target time → cherry-pick rows) |
| Table dropped | 0 (PITR) | 1 h |
| Project corruption | ≤ 1 h (PITR) | 4 h |
| Region outage | ≤ 24 h (cross-region dump) | 8 h (restore into new project) |
| Storage object lost | 0 (versioning) within 30 days, ≤ 24 h cold-restore beyond | 1 h |
| Total tenant loss | ≤ 24 h | 24 h (full rebuild from migrations + dump + bucket sync) |

## 3. Restore Runbooks

Each runbook lives in `/ops/runbooks/` and includes commands, verification steps, and rollback notes.

### R1 — Recover deleted rows (PITR clone)
1. In Supabase dashboard, create PITR clone of prod at `T = now() - 5 min`.
2. Connect via `psql`, extract affected rows.
3. Insert into prod with original IDs preserved.
4. Write `audit_logs` entry `action='restore'`.
5. Destroy clone.

### R2 — Recover dropped table
1. PITR clone before drop.
2. `pg_dump -t schema.table` from clone.
3. `pg_restore` into prod.
4. Re-create dependent objects (views, policies) from migrations.
5. Run sanity queries; restore RLS; audit log.

### R3 — Full database restore
1. New Supabase project from latest daily backup.
2. Apply WAL up to chosen PITR moment.
3. Re-run idempotent `seed.sql` only if needed.
4. Switch app `SUPABASE_URL` / keys via Vercel env (feature-flagged).
5. Validate: sign-in, dashboard, dependency lifecycle, RLS smoke tests.
6. Cut over DNS / app config.

### R4 — Region failover
1. Restore latest cross-region logical dump into standby project in alternate region.
2. Replay last 24 h of `domain_event_outbox` (kept in dump) to refire integrations as needed.
3. Sync `storage` buckets from cold copy.
4. Validate, cut over.

### R5 — Storage object restore
1. Read `attachments.object_path`.
2. If within 30 days → restore prior bucket version.
3. Else → pull from cold copy → re-upload with same path → update `attachments.checksum`.

## 4. Validation After Restore

Run the smoke pack (`/ops/restore-smoke.sql` + Playwright pack):

- `select count(*) > 0 from profiles where status='active';`
- `select count(*) > 0 from user_roles where revoked_at is null;`
- pgTAP RLS suite passes.
- Auth sign-in works for two test accounts.
- A check-in / check-out cycle works.
- A dependency can be created, acknowledged, resolved.
- An announcement publishes and is visible to its audience.

## 5. Testing

- **Quarterly DR drill** — restore the most recent daily backup to a sandbox project, run validation, document time-to-recover, lessons learned.
- **Monthly restore-row drill** — practice R1 for an arbitrary table.
- **Annual region failover drill** — full R4 with synthetic traffic.

Results logged in `/ops/dr-log.md`; missed drills create a Sev-2 ticket.

## 6. Backup Integrity

- Logical dumps verified by re-importing into an ephemeral DB and running `pg_dump --schema-only` diff against expected schema.
- Storage sync verified by spot-checking N random objects' checksums.
- Cold-archive audit Parquet files re-hashed quarterly.

## 7. Access Control

- Backups stored in a separate cloud account from production.
- Restore keys held by ≥ 2 platform engineers; rotation quarterly.
- Restore actions logged separately and reviewed monthly.

## 8. Data Residency & Compliance

- Backups stay within the same data-residency region as the primary unless explicit cross-region is required.
- GDPR erasure cascades into backups via a documented suppression list applied at restore time.
- Audit log cold archive retained 7 years to satisfy potential labor-law audits.

## 9. Risks Identified

| Risk | Mitigation |
|---|---|
| Restore drift (untested runbooks) | Quarterly drills, results published. |
| Backup tampering | Off-platform store with write-once policy, monthly hash check. |
| Secret loss during restore | Vault export wrapped in KMS; documented re-bind procedure. |
| Cross-region failover stale | Logical dump every 24 h; outbox replay covers near-term events. |
| Storage bucket explosion | Quotas + retention jobs keep backup size bounded. |

## 10. Cross-references

- Storage retention: `StorageArchitecture.md`.
- Audit retention: `AuditSystem.md`.
- Environments: `SupabaseArchitecture.md`.
