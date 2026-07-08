# Chart Library

Reusable, dependency-free chart primitives for the Analytics module. Implemented as inline SVG / CSS so they render on the server, work without a chart library upgrade path, and are easy to theme via Tailwind classes.

Location: `src/features/analytics/charts/`

```ts
import {
  LineChart,
  AreaChart,
  BarChart,
  DonutChart,
  Heatmap,
  TrendCard,
  Timeline,
} from "@/features/analytics/charts";
```

## Components

### `LineChart`

```tsx
<LineChart
  data={[{ label: "W1", value: 88 } /* ... */]}
  colorClass="stroke-success" // any Tailwind stroke-* class
  formatValue={(n) => `${n}%`}
  showDots
  showGrid
  ariaLabel="Attendance"
/>
```

Renders a polyline with a filled-area underlay. Auto-scales to data, draws 5 horizontal grid lines, and labels each point on the x-axis. Re-exported as `AreaChart` since the area is always rendered.

### `BarChart`

```tsx
<BarChart
  data={[{ label: "Mon", value: 7 }, /* ... */]}
  colorClasses={["fill-primary"]}
/>

// Grouped bars
<BarChart
  data={[{ label: "W1", opened: 8, resolved: 6 }, /* ... */]}
  series={[{ label: "opened", values: [] }, { label: "resolved", values: [] }]}
  colorClasses={["fill-warning", "fill-success"]}
/>
```

For grouped bars, pass the series names and they will be read from each row by key. `values` is unused; the row values drive the bars (this is a design decision so callers can keep the per-row data shape).

### `DonutChart`

```tsx
<DonutChart data={[{ label: "Flow", value: 86 } /* ... */]} centerValue="82" centerLabel="Health" />
```

Donut + side legend with percentages. Palette cycles through `fill-primary`, `fill-success`, `fill-warning`, `fill-info`, `fill-destructive`, `fill-secondary`; override per slice via `colorClass`.

### `Heatmap`

```tsx
<Heatmap
  data={[
    [0, 1, 2],
    [3, 4, 5],
  ]}
  rowLabels={["Mon", "Tue"]}
  colLabels={["8a", "9a", "10a"]}
/>
```

Renders as an accessible `<table>` with `color-mix(in oklab, hsl(var(--primary)) X%, transparent)` to encode intensity. Empty cells (value `0`) fall back to `hsl(var(--muted))`.

### `TrendCard`

```tsx
<TrendCard
  label="Attendance rate"
  value={{ current: 96, previous: 92, format: "percent" }}
  positiveIsDown={false}
/>
```

Displays a KPI with an inferred trend arrow. `positiveIsDown` flips the color semantics (used for metrics like "blocker duration" or "open risks" where lower is better). Supported formats: `number`, `percent`, `hours`, `minutes`.

### `Timeline`

```tsx
<Timeline events={[{ id, date, title, description, intent: "positive" }]} />
```

Vertical event list with intent-colored markers.

## Theming

All charts use Tailwind utility classes for color. Theme tokens come from `src/styles.css` — change a CSS variable (e.g. `--primary`) and every chart updates. To support dark mode, ensure your `stroke-*` / `fill-*` classes resolve to theme tokens, not hardcoded shades.

## Accessibility

- Every chart accepts `ariaLabel` and renders `role="img"`.
- `Heatmap` is a real `<table>` with `<th scope="row">` headers and per-cell tooltips.
- `TrendCard` includes the previous value in plain text so the trend is not color-only.
- Labels are always rendered alongside chart series — color is supportive, not the only encoding.

## Responsiveness

`LineChart` and `BarChart` use `viewBox` + `h-auto w-full`, so they scale to any container width while preserving aspect ratio. `DonutChart` uses a fixed `size` prop (defaults to 180) and stacks legend horizontally next to the SVG.

## When NOT to use these

- Need crosshair tooltips, brushing, or zoom → use a real charting lib (Recharts is already in shadcn's `chart.tsx`).
- Need stacked time series with thousands of points → switch to a Canvas-based renderer.

These primitives are optimized for **summary dashboards** with ≤ 50 data points per series, which covers every analytics surface in SpartaFlow Hub today.
