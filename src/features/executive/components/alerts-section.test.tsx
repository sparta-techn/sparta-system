import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AlertsSection } from "./alerts-section";

/**
 * Regression: the executive Alerts store selectors used to return a fresh array
 * on every `getSnapshot` call, so mounting `AlertsSection` looped
 * `useSyncExternalStore` until React threw "Maximum update depth exceeded" —
 * taking down the whole Executive dashboard for Owner/Admin. Rendering it must
 * now settle without tripping the update-depth guard.
 */
describe("AlertsSection", () => {
  it("mounts without an infinite render loop", () => {
    expect(() => render(<AlertsSection />)).not.toThrow();
    expect(screen.getByText("Executive Alerts")).toBeTruthy();
  });
});
