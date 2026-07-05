import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";
import react from "@vitejs/plugin-react";

/**
 * Vitest config — two projects, one runner.
 *
 * The test pyramid's bottom two layers live here (E2E is Playwright — see
 * `playwright.config.ts` and `docs/TESTING.md`):
 *
 *  - **unit**       Pure domain/business-rule modules. No React, no DOM, so a
 *                   plain `node` environment keeps them fast. Co-located as
 *                   `src/**\/*.test.ts`. Most existing tests live here.
 *  - **component**  React component + integration tests that need a DOM. Runs
 *                   in `jsdom` with React Testing Library and jest-dom matchers.
 *                   Lives under `tests/component` and `tests/integration`.
 *
 * The `@/*` alias is set explicitly (not only via `vite-tsconfig-paths`) so it
 * resolves consistently under the React plugin and across a path containing a
 * space. Run everything with `npm test`, or one layer with `--project unit` /
 * `--project component`.
 */
const srcAlias = { "@": fileURLToPath(new URL("./src", import.meta.url)) };

export default defineConfig({
  test: {
    projects: [
      {
        plugins: [tsconfigPaths()],
        resolve: { alias: srcAlias },
        test: {
          name: "unit",
          environment: "node",
          include: ["src/**/*.test.ts"],
          globals: false,
        },
      },
      {
        plugins: [tsconfigPaths(), react()],
        resolve: { alias: srcAlias },
        test: {
          name: "component",
          environment: "jsdom",
          include: [
            "tests/component/**/*.test.{ts,tsx}",
            "tests/integration/**/*.test.{ts,tsx}",
            "src/**/*.test.tsx",
          ],
          setupFiles: ["./tests/setup/vitest.setup.ts"],
          globals: true,
        },
      },
    ],
  },
});
