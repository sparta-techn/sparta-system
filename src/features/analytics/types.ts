export type AnalyticsScope = "personal" | "team" | "hr" | "executive";

export type DateRange = "7d" | "30d" | "qtd" | "ytd" | "custom";
export type BenchmarkPeriod = "wow" | "mom" | "qoq";

export interface AnalyticsFilters {
  range: DateRange;
  benchmark: BenchmarkPeriod;
  department?: string;
  team?: string;
  role?: string;
  employee?: string;
  project?: string;
}

export interface TrendPoint {
  label: string;
  value: number;
}

export interface Insight {
  id: string;
  title: string;
  description: string;
  intent: "positive" | "negative" | "neutral" | "warning";
  metric?: string;
  delta?: string;
}

export interface SavedReport {
  id: string;
  name: string;
  scope: AnalyticsScope;
  filters: AnalyticsFilters;
  pinned: boolean;
  createdAt: string;
  schedule?: "daily" | "weekly" | "monthly";
}

export interface BenchmarkValue {
  current: number;
  previous: number;
  unit?: string;
  format?: "number" | "percent" | "hours" | "minutes";
}
