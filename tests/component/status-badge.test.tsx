/**
 * COMPONENT test example — React Testing Library + jsdom.
 *
 * Renders a single presentational component and asserts on the *accessible*
 * output (role, name, text) rather than implementation details like class
 * names. Runs in the `component` Vitest project. See `docs/TESTING.md`.
 */
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { StatusBadge } from "@/components/status-badge";

describe("<StatusBadge>", () => {
  it("renders the label for a known status", () => {
    render(<StatusBadge status="working" />);
    const badge = screen.getByRole("status");
    expect(badge).toHaveTextContent("Working");
    expect(badge).toHaveAttribute("aria-label", "Working");
  });

  it("prefers an explicit label + tone over the status map", () => {
    render(<StatusBadge tone="danger" label="Overdue" />);
    expect(screen.getByRole("status")).toHaveTextContent("Overdue");
  });

  it("falls back to Unknown when nothing is provided", () => {
    render(<StatusBadge />);
    expect(screen.getByRole("status")).toHaveTextContent("Unknown");
  });

  it("omits the status dot when withDot is false", () => {
    const { container } = render(<StatusBadge label="Plain" withDot={false} />);
    expect(container.querySelector(".status-dot")).toBeNull();
  });
});
