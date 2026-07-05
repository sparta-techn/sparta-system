/**
 * INTEGRATION test example — several units wired together.
 *
 * Exercises the real `ConnectionBanner` component + `useOnlineStatus` hook +
 * the browser online/offline events, asserting the banner appears and clears in
 * response to connectivity changes. Nothing is mocked — this is the value of an
 * integration test: it proves the pieces talk to each other. See
 * `docs/TESTING.md`.
 */
import { describe, expect, it, afterEach } from "vitest";
import { act, render, screen } from "@testing-library/react";
import { ConnectionBanner } from "@/components/layout/connection-banner";

/** Flip navigator.onLine and emit the matching window event, inside act(). */
function setOnline(online: boolean) {
  act(() => {
    Object.defineProperty(navigator, "onLine", { configurable: true, value: online });
    window.dispatchEvent(new Event(online ? "online" : "offline"));
  });
}

afterEach(() => {
  Object.defineProperty(navigator, "onLine", { configurable: true, value: true });
});

describe("<ConnectionBanner> integration", () => {
  it("renders nothing while online", () => {
    render(<ConnectionBanner />);
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("appears when the browser goes offline and clears on reconnect", () => {
    render(<ConnectionBanner />);

    setOnline(false);
    expect(screen.getByRole("status")).toHaveTextContent(/offline/i);

    setOnline(true);
    expect(screen.queryByRole("status")).toBeNull();
  });
});
