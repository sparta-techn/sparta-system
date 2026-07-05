/* eslint-disable react-refresh/only-export-components -- test harness: intentionally
   exports helpers alongside a provider component; Fast Refresh doesn't apply to tests. */
/**
 * renderWithProviders — the standard harness for component & integration tests.
 *
 * Wraps the unit under test in the app-level providers it expects (currently a
 * fresh TanStack Query client per test). Add more providers here (theme, auth)
 * as tests need them — keeping one harness means individual tests stay focused
 * on behavior, not wiring.
 *
 * A fresh QueryClient per render guarantees isolation: no cached data or
 * in-flight requests bleed across tests. Retries are off so error paths resolve
 * immediately instead of backing off.
 */
import type { ReactElement, ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, type RenderOptions } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

export function makeTestQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0, staleTime: 0 },
      mutations: { retry: false },
    },
  });
}

export interface ProvidersProps {
  children: ReactNode;
  queryClient?: QueryClient;
}

export function TestProviders({ children, queryClient }: ProvidersProps) {
  const client = queryClient ?? makeTestQueryClient();
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

export interface RenderWithProvidersOptions extends Omit<RenderOptions, "wrapper"> {
  queryClient?: QueryClient;
}

/**
 * Render `ui` inside the app providers and return RTL's result plus a
 * pre-bound `user` (userEvent) instance and the `queryClient` used.
 */
export function renderWithProviders(ui: ReactElement, options: RenderWithProvidersOptions = {}) {
  const { queryClient, ...rtl } = options;
  const client = queryClient ?? makeTestQueryClient();
  const result = render(ui, {
    wrapper: ({ children }) => <TestProviders queryClient={client}>{children}</TestProviders>,
    ...rtl,
  });
  return { ...result, user: userEvent.setup(), queryClient: client };
}

// Re-export RTL so tests import a single module.
export * from "@testing-library/react";
export { default as userEvent } from "@testing-library/user-event";
