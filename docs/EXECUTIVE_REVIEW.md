# SpartaFlow — Executive Dashboard Review

> Review of the Executive Dashboard stack: KPI services, Alert Engine,
> Organization Health, AI summaries, and the dashboard feature/route.
> Scope of fixes applied: **critical issues only** (per request). Everything else
> is recorded as a recommendation.
> Snapshot date: 2026-07-02.

## Verdict

Solid, well-layered implementation: pure services (KPI / alerts / health) cleanly
separated from feature UI, consistent reuse of the analytics charts and `ui/`
primitives, strict TypeScript, and 131 passing unit tests. **One critical gap** —
the owner-only route was not access-gated — has been **fixed**. No other critical
issues found.

| Area | Result |
| --- | --- |
| Performance | ✅ Good · 1 minor rec |
| Charts | ✅ Good |
| Aggregation logic | ✅ Correct · 1 minor rec |
| Permissions | ⛔→✅ **Critical fixed** · 1 minor rec |
| Security | ✅ Good |
| TypeScript | ✅ Strict, clean |
| Reusability | ✅ Strong |
| Documentation | ✅ Thorough |

---

## Critical issue (fixed)

### C1 — Executive route was reachable by any authenticated user
**`src/routes/_authenticated/app/executive.tsx`** — the executive cockpit is
owner-scoped by design (every plan/doc states `owner:access`), but the route only
inherited the `_authenticated` auth guard. Any signed-in `employee` / `viewer`
could open `/app/executive` and read company-wide aggregates — an access-control
gap on exactly the "Permissions/Security" axis under review.

**Fix applied:** a page-level guard using the existing RBAC surface
(`useAuth().hasPermission("owner:access")`, mirror of RLS intent per
`ARCHITECTURE.md §12`). It waits for identity to resolve (`initialized && !loading`)
to avoid flashing the dashboard or a false denial, then redirects non-owners to the
existing `/unauthorized` route.

```tsx
const { hasPermission, initialized, loading } = useAuth();
if (!initialized || loading) return <AppShell><LoadingState … /></AppShell>;
if (!hasPermission("owner:access")) return <Navigate to="/unauthorized" />;
```

Verified: `tsc` clean, `eslint` clean, 131 tests still pass. This is UI gating
only; server-side RLS remains the authoritative enforcement point when live data
lands (unchanged).

---

## Findings by area

### Performance ✅
- KPI, health, and alert computations are memoized (`useMemo`) or effect-gated;
  inputs are stable references (`useMemo(() => …, [])`). Good.
- Alert generation is on-mount + explicit **Re-evaluate**; AI summaries are strictly
  **on-demand** — the expensive path never auto-runs. Good (matches
  `EXECUTIVE_DASHBOARD_PLAN.md §9`).
- Charts are lightweight inline SVG (no heavy runtime).
- **Rec (minor):** the route is statically imported, not code-split. For a page
  this widget-dense, `createLazyFileRoute` / lazy component would trim initial JS.
  Not critical (charts are hand-rolled SVG, not a heavy chart lib).

### Charts ✅
- All charts reuse `@/features/analytics/charts` (`LineChart`, `BarChart`,
  `DonutChart`, `Timeline`, `TrendCard`) via `ChartCard` — no duplicated chart
  code. Prop shapes (`TrendPoint[]`, `series`, `colorClasses`, `formatValue`) are
  used correctly; single-series `BarChart` (velocity) and `%`-formatted lines
  render as intended.

### Aggregation logic ✅
- KPI calculators are pure and unit-tested at their boundaries (rates, ratios,
  safe division, benchmark deltas). Alert rules and health banding likewise.
- Health is a genuine higher-order composite over KPIs — no metric is
  re-measured; the adapter is the only KPI→factor mapping point.
- **Rec (minor):** in `deriveOrganizationHealthInput`, the engineering `flow`
  factor uses `blocked / (openTasks + blocked)`, but `openTasks` (from the workload
  buckets) already includes `blocked` — a slight double-count that marginally
  understates `flow`. Cosmetic; does not change bands materially. Suggest
  `blocked / max(openTasks, 1)`.

### Permissions ⛔→✅
- **C1 fixed** (above).
- **Rec (minor):** the sidebar shows the **Executive** link to everyone
  (`app-sidebar.tsx` `TEAM`); it now leads non-owners to `/unauthorized`. Gate the
  nav item on `hasPermission("owner:access")` for cleaner UX and to avoid
  advertising the feature. Non-critical.

### Security ✅
- Runs entirely on mock/local data; no service-role key, no provider key, no
  direct Supabase writes. AI flows through the shared `aiAssistant` (offline mock
  provider) — no provider-specific logic. `localStorage` stores hold only
  non-sensitive alert lifecycle state and are `window`-guarded for SSR.
- No `dangerouslySetInnerHTML`; AI text renders through the existing `Markdown`
  component. No secrets in source.

### TypeScript ✅
- Strict, **no `any`**. Discriminated unions for bands/severity/priority; `Record`
  maps are exhaustive over their key unions. Public service surfaces are fully
  typed and re-exported. `tsc --noEmit` is clean across the whole project.

### Reusability ✅
- Clear layering: pure services (`services/kpi`, `services/alerts`,
  `services/health`) are UI-agnostic and reused by the feature via thin adapters.
- UI reuses `StatCard`, `TrendCard`, `ChartCard`, `InsightGrid`, `Tabs`, `Card`,
  `Badge`, `Progress`, `states`, `Markdown`, and `useAuth`. New shared widgets
  (`KpiCard`, `DashboardSection`) are generic and barrel-exported.
- **Rec (minor):** band→class maps live in the health section; if other surfaces
  need health bands, lift `BAND_BADGE`/`BAND_TEXT` into a small shared helper.

### Documentation ✅
- Each capability ships a doc: `EXECUTIVE_DASHBOARD_PLAN.md`, `KPI_SERVICES.md`,
  `EXECUTIVE_DASHBOARD.md`, `EXECUTIVE_AI.md`, `EXECUTIVE_ALERTS.md`,
  `ORGANIZATION_HEALTH.md`, and this review. Consistent structure, verification
  commands, and a "going live" adapter path in each.
- **Doc note:** several docs list "gate the route on `owner:access`" as *next* —
  now **done**; update those "Next" sections to reflect it.

---

## Non-critical recommendations (backlog)

1. Lazy-load / code-split the executive route.
2. Gate the sidebar **Executive** entry on `owner:access`.
3. `flow` factor: divide by `max(openTasks, 1)` to avoid double-counting blocked.
4. Cache AI summaries per `(topic, period)` so re-mounts don't re-run the model.
5. Wire the currently-inert **Export** button (CSV/PNG) + audit the export.
6. Lift health band styling into a shared helper if reused elsewhere.

---

## Verification

```
npx tsc --noEmit    # clean
npx eslint src/routes/_authenticated/app/executive.tsx   # clean
npx vitest run      # 131 passed (10 files)
```

*Only the critical access-control gap (C1) was fixed. All other items above are
intentionally left as recommendations per the review scope.*
