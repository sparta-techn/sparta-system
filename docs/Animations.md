# Animations — SpartaFlow Hub

Motion is functional, not decorative. It explains state changes; it never blocks input.

## 1. Principles

- **Fast and subtle.** 120–200 ms for most interactions, 220–300 ms for overlays.
- **Ease-out for entering, ease-in for leaving.** `ease-out` reveals; `ease-in` exits.
- **Respect `prefers-reduced-motion`.** Transitions degrade to instant; no movement, only opacity where feasible.
- **One thing at a time.** Don't stack reveal + slide + scale on the same element.

## 2. Duration Scale

| Token          | Duration | Use                                      |
| -------------- | -------- | ---------------------------------------- |
| `duration-100` | 100 ms   | hover background tint, badge tone change |
| `duration-150` | 150 ms   | button press, focus ring, switch thumb   |
| `duration-200` | 200 ms   | tabs underline, popover open             |
| `duration-300` | 300 ms   | dialog, drawer, sheet                    |
| `duration-500` | 500 ms   | success confirmation pulse               |

## 3. Easing

- Default `ease-out` for entering and most movement.
- `ease-in-out` for things that travel both ways (drawer).
- `ease-in` reserved for outgoing elements.

## 4. Where Motion Lives

- **Hover** — color/background only, no transform on body content. Cards lift via `shadow-md → shadow-lg` over 150 ms when interactive.
- **Buttons** — instant color change on press; no scale.
- **Dialogs / Drawers** — fade + 4–8 px translate, 240 ms, `ease-out`.
- **Popovers / Menus** — fade + 2 px translate, 150 ms.
- **Toasts (sonner)** — slide-in 250 ms, dwell, fade-out 200 ms.
- **Tabs** — underline slide 200 ms, content cross-fade 150 ms.
- **Page transitions** — none by default. Route changes are instant; loading states fill the gap.
- **Loading** — `Loader2` spin (existing keyframe), skeleton shimmer at 1.4 s loop.
- **Success** — brief `text-success` flash on the affected field (300 ms) plus an icon swap; no confetti.
- **Error** — shake disabled; instead, field border turns `border-destructive` with a 150 ms tint and an inline error message.

## 5. Implementation

- `tw-animate-css` already bundled. Use its `animate-in` / `animate-out` utilities with `fade-in`, `zoom-in-95`, `slide-in-from-top-2`.
- Radix primitives drive their own `data-[state=...]` animations; map to Tailwind via the existing shadcn classes — don't rewrite.
- Custom keyframes live in `@theme` only; component-level keyframes are forbidden.

## 6. Reduced Motion

The base layer should include (added at the bottom of `styles.css` when needed):

```css
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.001ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.001ms !important;
  }
}
```

## 7. Don't

- Don't animate font size or font weight.
- Don't animate layout (height, width) — animate `transform` and `opacity`.
- Don't loop attention-grabbing motion on non-critical UI.
- Don't auto-play any motion above 500 ms on initial page load.
