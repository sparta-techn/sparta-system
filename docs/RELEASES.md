# SpartaFlow — Release Process

> How a change goes from `main` to a versioned production release. Ties together
> the tag-driven pipeline in [`docs/CICD.md`](./CICD.md), the migration rules in
> [`docs/DEPLOYMENT_PLAN.md`](./DEPLOYMENT_PLAN.md), backups
> ([`docs/BACKUPS.md`](./BACKUPS.md)), and environment config
> ([`docs/ENVIRONMENT.md`](./ENVIRONMENT.md)).
>
> **Source of truth for the version is the Git tag** (`vX.Y.Z`). `package.json`
> has no `version` field today; either add one and keep it in lockstep with the
> tag, or treat the annotated tag + release notes as canonical.

---

## 1. Release flow at a glance

```
merge PRs to main ──► main is always releasable (checks green, branch protected)
        │
        ├─ continuous: every push to main auto-deploys to STAGING
        │
        └─ cut a release:
              1. decide the SemVer bump (§2)
              2. update CHANGELOG (§3)
              3. tag  vX.Y.Z   ─────────────────► Deploy pipeline runs
              4. GitHub Environment `production` pauses for MANUAL APPROVAL
              5. approve ──► build image ──► deploy ──► health-check ──► notify
              6. publish GitHub Release with notes (§3)
```

- **Staging** is exercised continuously from `main` — a tag should only promote
  something already validated on staging.
- **Production** is gated: pushing `vX.Y.Z` requires a human to approve in the
  GitHub UI (the `production` environment's required reviewers). That approval
  **is** the "release" decision.

---

## 2. Semantic Versioning

Format `MAJOR.MINOR.PATCH`, tagged `vMAJOR.MINOR.PATCH` (e.g. `v1.4.2`).

| Bump      | When                                                                                                 | Examples                                           |
| --------- | ---------------------------------------------------------------------------------------------------- | -------------------------------------------------- |
| **MAJOR** | Breaking change to a user workflow, API/contract, or a **non-reversible / destructive** DB migration | Remove a feature, change auth flow, drop a column  |
| **MINOR** | Backward-compatible feature or additive, expand-phase migration                                      | New module wired live, new table/column (nullable) |
| **PATCH** | Backward-compatible bug/security fix, copy, perf, docs                                               | Fix a calc, dependency bump, style fix             |

Pre-releases use suffixes: `v1.5.0-rc.1`, `v1.5.0-beta.1` (the pipeline treats
`v*.*.*` as production; scope pre-release tags to staging if you wire them).

**Deriving the bump** — use **Conventional Commits** so the bump is mechanical:

| Commit prefix                              | Bump                    |
| ------------------------------------------ | ----------------------- |
| `fix:` , `perf:`                           | PATCH                   |
| `feat:`                                    | MINOR                   |
| `feat!:` / `BREAKING CHANGE:` footer       | MAJOR                   |
| `chore:` `docs:` `test:` `refactor:` `ci:` | no release on their own |

> **Lovable note:** per [`AGENTS.md`](../AGENTS.md), never rewrite pushed history
> (no force-push/rebase of pushed commits) — it desyncs Lovable. Tag forward; use
> revert commits, not history edits.

---

## 3. Release notes

Keep a human-readable **`CHANGELOG.md`** at the repo root in the
[Keep a Changelog](https://keepachangelog.com/) shape, and mirror it into the
**GitHub Release** body for each tag.

Structure:

```markdown
## [1.4.0] - 2026-07-10

### Added

- Kanban board wired to live Supabase data (#412)

### Changed

- Attendance summary now uses server-side aggregation (#420)

### Fixed

- Timezone drift in EOD report timestamps (#418)

### Security

- Bumped <dep> to patch CVE-XXXX-YYYY

### Migrations

- `2026070...` add `tasks` table (expand-phase, backward-compatible)
```

Rules:

- Group by **Added / Changed / Fixed / Security / Migrations**; link PRs/issues.
- Write for the reader (what changed & why it matters), not raw commit subjects.
- Keep an **`[Unreleased]`** section at the top; on release, rename it to the
  version + date and open a fresh `[Unreleased]`.
- The **Migrations** subsection is mandatory whenever the schema changed — it is
  the audit trail operators read before/after deploy (§6).
- Passing `RELEASE`/`VITE_RELEASE` (the tag) and `COMMIT_SHA` at build time makes
  the running version visible in logs, error reports, and `/healthz`
  ([`docs/MONITORING.md`](./MONITORING.md)).

---

## 4. Cutting a release (step by step)

1. **Confirm staging is healthy** for the commit you intend to ship (smoke the
   key flows; check error rate/latency).
2. **Choose the version** (§2) from the commits since the last tag.
3. **Update `CHANGELOG.md`** — promote `[Unreleased]` → `[X.Y.Z] - <date>`.
4. **(If tracking in package)** bump `package.json` `version` to match.
5. **Run the Production Checklist** (§5).
6. **Tag & push:**
   ```bash
   git tag -a v1.4.0 -m "SpartaFlow v1.4.0"
   git push origin v1.4.0
   ```
7. **Approve** the `production` deployment in GitHub Actions when it pauses.
8. **Watch** the deploy: build → deploy → health-check → Slack notification.
9. **Publish the GitHub Release** for `v1.4.0` with the changelog section.
10. **Post-release:** verify in prod (§5.3), monitor for ~30 min, announce.

---

## 5. Production Checklist

Run before tagging. All boxes checked = safe to release.

### 5.1 Pre-flight

- [ ] `main` is green: Lint, Test, Security Scan all passing.
- [ ] Change validated on **staging** (key flows: sign-in, attendance check-in/out, a live-wired feature).
- [ ] Version chosen per SemVer; `CHANGELOG.md` updated (incl. **Migrations** section if schema changed).
- [ ] Any **migrations** follow expand/contract and are backward-compatible for one release (§6).
- [ ] **Env parity:** new/changed env vars exist in the `production` GitHub env (build `VITE_*`) and the VPS `.env` (runtime); `bun run validate:env` passes ([`docs/ENVIRONMENT.md`](./ENVIRONMENT.md)).
- [ ] Supabase **Auth redirect URLs** cover the prod domain if auth routes changed.
- [ ] **Backup fresh:** last nightly DB dump succeeded; take an on-demand snapshot/PITR marker before a schema change ([`docs/BACKUPS.md`](./BACKUPS.md)).
- [ ] Feature flags / config for the release set to their intended prod state.
- [ ] Rollback path known: previous image tag identified (§7).

### 5.2 Release

- [ ] Tag `vX.Y.Z` pushed; pipeline started.
- [ ] Production deployment **approved** by a reviewer.
- [ ] Migrations applied (expand phase) **before** the app cutover (§6).
- [ ] Post-deploy **health check** passed (`/healthz` = 200; app readiness healthy).

### 5.3 Post-release verification

- [ ] Sign-in works; a protected route loads.
- [ ] The headline change of this release works in prod.
- [ ] Error rate & latency normal for ~30 min ([`docs/MONITORING.md`](./MONITORING.md)).
- [ ] GitHub Release published; team notified.
- [ ] `[Unreleased]` reopened in `CHANGELOG.md`.

---

## 6. Migration Checklist

Schema changes are the highest-risk part of a release. Migrations live in
`supabase/migrations/` and must be **safe to deploy alongside both the old and
new app** for one release window (**expand → migrate → contract**).

### 6.1 Authoring

- [ ] Migration is **idempotent** and has a clear **reverse** (or a documented forward-fix).
- [ ] **Expand phase only** in this release: additive/nullable columns, new tables, new indexes `CONCURRENTLY`. No `DROP`/rename/`NOT NULL`-without-default that would break the currently-running app.
- [ ] RLS policies added/updated for any new table (RLS on **every** table — [`docs/DB_RULES.md`](./DB_RULES.md)); UUID PKs.
- [ ] Large backfills run **batched**/online, not in one long lock.
- [ ] Reviewed against a **prod-sized** dataset for lock/timeout risk.

### 6.2 Before applying

- [ ] Fresh backup / PITR marker taken (§5.1).
- [ ] Applied & verified on **staging** first.
- [ ] Ordering decided: apply migration **before** the app cutover for expand
      changes; destructive **contract** changes wait until the next release,
      after the old app is fully gone.

### 6.3 Applying (production)

- [ ] `supabase db push` (or `migration up`) against prod via the gated deploy.
- [ ] Verify: expected tables/columns/policies present; sanity `SELECT`s; RLS holds.
- [ ] Regenerate `src/integrations/supabase/types.ts` from the live schema (in a follow-up dev change, not during deploy).

### 6.4 Contract (a later release)

- [ ] Only after no running code references the old shape: drop columns/tables,
      add constraints, in their own migration + release, with the **Migrations**
      changelog entry marking it potentially **MAJOR** if externally visible.

> **Why expand/contract:** it keeps app rollback (§7) safe — reverting to the
> previous image still works against the newer schema, because the new schema is
> a superset of what the old app needs.

---

## 7. Rollback Checklist

Two paths (both in [`docs/CICD.md`](./CICD.md) §5). Prefer roll-_forward_ for
data-affecting issues; roll-_back_ for app regressions.

### 7.1 Decide

- [ ] Symptom triaged: is it the **app** (bad release) or **data/schema**?
- [ ] Severity/blast radius assessed; incident channel opened if Sev-1/2.

### 7.2 App rollback (fast — seconds to minutes)

- [ ] **Automatic:** a failed post-deploy health check already rolled back to the
      previous image within the deploy run — confirm it did.
- [ ] **Manual:** run the **Rollback** workflow → pick `production` → previous
      image tag (or blank for last-good). It pulls, `up -d`, health-checks, notifies.
- [ ] Verify prod healthy; error rate recovered.
- [ ] Announce; open a fix-forward issue; **do not** re-tag the bad version.

### 7.3 Data / migration rollback (careful)

- [ ] If the migration was **expand-phase** (backward-compatible), an app
      rollback is sufficient — **no DB rollback needed**.
- [ ] If a **destructive** change shipped: prefer a **forward fix** migration over
      dropping/restoring. Restore-from-backup (PITR to just before the change,
      [`docs/BACKUPS.md`](./BACKUPS.md) §8) is the last resort and loses data
      written since the marker.
- [ ] Record the action in `audit_logs` / the ops log.

### 7.4 After any rollback

- [ ] Root-cause captured; regression test added.
- [ ] `CHANGELOG.md` notes the reverted change.
- [ ] Next release includes the fix; re-run the Production Checklist.

---

## 8. Roles & cadence

- **Release owner** — drives the checklist, cuts the tag, approves prod, watches
  the deploy, publishes notes.
- **Reviewer/approver** — a second person approves the `production` environment.
- **Cadence** — release from `main` as often as it's green; batch risky/schema
  changes deliberately. Hotfix = a PATCH tag off `main` following the same flow.

---

## 9. First-time setup checklist

- [ ] Create `CHANGELOG.md` (`[Unreleased]` section).
- [ ] (Optional) Add a `version` field to `package.json` and keep it in lockstep with tags.
- [ ] Configure GitHub Environments `staging` / `production` with required reviewers on `production` ([`docs/CICD.md`](./CICD.md) §3).
- [ ] Adopt Conventional Commits so bumps and notes are mechanical.
- [ ] Ensure `RELEASE`/`VITE_RELEASE` + `COMMIT_SHA` are passed at build time so the running version is observable.

```

```
