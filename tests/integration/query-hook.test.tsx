/**
 * INTEGRATION test example — data layer + TanStack Query + providers.
 *
 * Shows the pattern used across the app: a hook/component reads data through a
 * *service* (never Supabase directly — see CLAUDE.md), and the test swaps that
 * service for a `vi.fn()`. Rendered inside the shared `TestProviders`
 * (QueryClientProvider), it asserts the loading → success and error lifecycles
 * without a network or a database. See `docs/TESTING.md`.
 */
import { describe, expect, it, vi } from "vitest";
import { useQuery } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { TestProviders } from "../utils/render";

interface Employee {
  id: string;
  name: string;
}

/** Stand-in for a real service method, e.g. `employeesService.list()`. */
type ListEmployees = () => Promise<Employee[]>;

/** The hook under test — the kind a feature would export from its `queries.ts`. */
function useEmployees(listEmployees: ListEmployees) {
  return useQuery({ queryKey: ["employees"], queryFn: listEmployees });
}

describe("useEmployees integration", () => {
  it("moves from loading to success with the service payload", async () => {
    const listEmployees = vi.fn<ListEmployees>().mockResolvedValue([
      { id: "1", name: "Ada" },
      { id: "2", name: "Grace" },
    ]);

    const { result } = renderHook(() => useEmployees(listEmployees), { wrapper: TestProviders });

    expect(result.current.isPending).toBe(true);

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toHaveLength(2);
    expect(result.current.data?.[0].name).toBe("Ada");
    expect(listEmployees).toHaveBeenCalledOnce();
  });

  it("surfaces a service rejection as an error state", async () => {
    const listEmployees = vi.fn<ListEmployees>().mockRejectedValue(new Error("boom"));

    const { result } = renderHook(() => useEmployees(listEmployees), { wrapper: TestProviders });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toBeInstanceOf(Error);
    expect((result.current.error as Error).message).toBe("boom");
  });
});
