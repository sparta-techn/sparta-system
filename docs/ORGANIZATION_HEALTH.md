# SpartaFlow — Organization Health Dashboard

> Reference for the Organization Health service (`src/services/health/`) and the
> dashboard section that renders it (`src/features/executive/`). Seven composite
> health metrics, each displayed in one of four bands.
> Snapshot date: 2026-07-02.

---

## 1. What it does

Rolls the operational KPIs up into **seven health metrics**, each scored 0–100 and
mapped to a **four-level band**:

| Metric | Composed from |
| --- | --- |
| **Engineering Health** | velocity attainment · flow (blockers) · capacity · workload balance |
| **HR Health** | retention · staffing · onboarding |
| **Project Health** | on-track ratio · completion rate · delivery success |
| **Attendance Health** | attendance rate · punctuality · anomaly load |
| **Collaboration Health** | report completion · responsiveness · dependency flow |
| **AI Confidence** | data coverage · grounding quality · signal agreement |
| **Overall Organization Score** | weighted blend of the six domains above |

### Bands (display)

| Band | Label | Default cutoff |
| --- | --- | --- |
| `excellent` | **Excellent** | score ≥ 85 |
| `good` | **Good** | score ≥ 70 |
| `needs_attention` | **Needs Attention** | score ≥ 50 |
| `critical` | **Critical** | score < 50 |

Cutoffs are configurable per call via `BandThresholds`.

---

## 2. Architecture

Health is a **higher-order composite over the KPI layer** — it does not
re-measure anything, it re-weights existing KPI outputs into 0–100 factors.

```
executiveKpiService.computeAll(...)          ← KPIs (already computed)
        │
        ▼
deriveOrganizationHealthInput(kpis, extras)  ← normalize KPIs → 0–100 factor scores  (feature adapter)
        │  OrganizationHealthInput
        ▼
computeOrganizationHealth(input)             ← pure scoring + banding   (src/services/health)
        │  OrganizationHealth (7 metrics)
        ▼
OrganizationHealthSection                    ← hero Overall card + 6 domain cards
```

- **Service (`src/services/health/`)** — pure, deterministic scoring + banding. No
  I/O, no KPI-recompute. Each domain metric = `weightedScore(factors)` → band.
- **Adapter (`features/executive/health/organization-health.ts`)** — the only
  place that knows how a KPI maps to a health factor (e.g. `avgResponseTime` →
  responsiveness, `blockedTasks` → flow). Swap this for a live adapter without
  touching the service or UI.

### Files

```
src/services/health/
  health-types.ts          # HealthBand, BAND_LABEL, HealthMetric, factor inputs, weights
  health-calculators.ts    # weightedScore, bandForScore, 6 domain fns, overall, compute*
  index.ts
  health-calculators.test.ts   # 8 unit tests
src/features/executive/
  health/organization-health.ts   # deriveOrganizationHealthInput(kpis, extras)
  health/mock-data.ts              # extras (HR/attendance/deps/AI) — swap for adapter
  components/organization-health-section.tsx   # the dashboard section
```

Exported: `computeOrganizationHealth` from `@/services` and `@/services/health`;
`OrganizationHealthSection` / `deriveOrganizationHealthInput` from
`@/features/executive`.

---

## 3. Scoring model

- **Factors** — every factor is a 0–100 "goodness" score (higher is always
  better), clamped to range. Rules that are naturally "lower is better" (blocked
  tasks, response time, anomalies) are inverted in the adapter before scoring.
- **Domain score** — `weightedScore(factors)`: a weighted average, robust to
  weights that don't sum to 1. Each domain has fixed, documented factor weights.
- **Overall Organization Score** — weighted blend of the six domain scores.
  **AI Confidence carries the lightest weight (0.10)** because it is advisory;
  Engineering and Project carry the most (0.22 each). Weights are overridable via
  `OverallWeights`.
- **Band** — `bandForScore(score, bands)` maps to the four display levels.

Each `HealthMetric` also carries its contributing `factors` (label + value) for
drill-down, and a one-line `summary` for the band.

---

## 4. Display

`OrganizationHealthSection` (wired into the Executive Dashboard right after
Overview) renders, from reused primitives (`Card`, `Badge`, `Progress`, `cn`):

- A **hero card** for the Overall Organization Score — large band-coloured number,
  band badge, progress bar, and the six domain contributions.
- A **grid of six domain cards** — score, band badge, progress bar, and the
  metric's factor breakdown.

Band colour is consistent everywhere: Excellent → success, Good → primary, Needs
Attention → warning, Critical → destructive. The band is shown as a **labelled
badge** (never colour alone), and the score text is band-coloured. Labels come
from `BAND_LABEL`, so the four required display strings are single-sourced.

---

## 5. Going live

Replace `health/mock-data.ts` (the extras) and feed
`deriveOrganizationHealthInput` from live KPIs — the section already consumes the
dashboard's real computed `ExecutiveKpis`. The service, adapter contract, and UI
are unchanged. The AI Confidence factors are the natural hook for real grounding
telemetry from the AI layer (`docs/EXECUTIVE_AI.md`).

---

## 6. Verification

```
npx tsc --noEmit                       # clean
npx eslint src/services/health src/features/executive   # clean
npx vitest run src/services/health     # 8 passed
npx vitest run                         # 131 passed (full suite)
```

`health-calculators.test.ts` covers banding boundaries, the required display
labels, weighted scoring + clamping, a domain metric end-to-end, the overall
blend, and a weak-domain scenario (Project → Critical) flowing into the overall
score.

---

*Next: gate the dashboard route on `owner:access`, feed live KPIs/extras via the
adapter, and (optionally) trend the Overall Organization Score over time using the
existing `LineChart`.*
