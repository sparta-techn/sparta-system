/**
 * Global setup for the `component` Vitest project (jsdom).
 *
 * - Registers jest-dom matchers (`toBeInTheDocument`, `toHaveAttribute`, …) on
 *   Vitest's `expect`.
 * - Unmounts React trees after each test so DOM/state never leaks between tests.
 * - Stubs `matchMedia`, which jsdom doesn't implement but several UI primitives
 *   (theme, sidebar, `use-mobile`) read at render time.
 */
import "@testing-library/jest-dom/vitest";
import { afterEach, vi } from "vitest";
import { cleanup } from "@testing-library/react";

afterEach(() => {
  cleanup();
});

if (typeof window !== "undefined" && !window.matchMedia) {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }));
}
