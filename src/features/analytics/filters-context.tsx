import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import type { AnalyticsFilters } from "./types";

const DEFAULT: AnalyticsFilters = { range: "30d", benchmark: "mom" };

interface Ctx {
  filters: AnalyticsFilters;
  setFilters: (next: Partial<AnalyticsFilters>) => void;
  reset: () => void;
}

const FiltersContext = createContext<Ctx | null>(null);

export function AnalyticsFiltersProvider({ children }: { children: ReactNode }) {
  const [filters, setState] = useState<AnalyticsFilters>(DEFAULT);
  const value = useMemo<Ctx>(
    () => ({
      filters,
      setFilters: (next) => setState((f) => ({ ...f, ...next })),
      reset: () => setState(DEFAULT),
    }),
    [filters],
  );
  return <FiltersContext.Provider value={value}>{children}</FiltersContext.Provider>;
}

export function useAnalyticsFilters() {
  const ctx = useContext(FiltersContext);
  if (!ctx) throw new Error("useAnalyticsFilters must be used inside AnalyticsFiltersProvider");
  return ctx;
}
