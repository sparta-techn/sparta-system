# GitHub Integration

Architecture for connecting SpartaFlow to GitHub as a **read-only version-control
activity source**: repositories, pull requests, issues, commits, releases,
branches and per-developer activity signals.

> **Status: architecture only — no GitHub API is called yet.**
> Every network path terminates at a single `notImplemented` seam
> (`GitHubClient`). Metadata + the settings schema are live, so GitHub renders in
> the Admin integrations list today; `available` stays `false` until the client
> bodies are wired. Wiring the real integration touches **only**
> `github-client.ts` — no interface, service, feature or other adapter changes.

This is a concrete instance of the platform in
[`docs/INTEGRATION_ARCHITECTURE.md`](./INTEGRATION_ARCHITECTURE.md) and
[`src/integrations/README.md`](../src/integrations/README.md). GitHub follows the
documented two-layer shape: the generic six-method `Integration` lifecycle **plus**
a `VcsActivityPort` capability port, with all GitHub specifics behind the port.

---

## Where it lives

```
src/integrations/
  ports/
    vcs-activity.ts          # VcsActivityPort + neutral Vcs* DTOs (the contract)
    index.ts
  github/
    types.ts                 # GitHub domain DTOs + request-option types
    github-client.ts         # the ONE HTTP/SDK seam (all notImplemented today)
    mappers.ts               # pure GitHub DTO → neutral Vcs* DTO transforms
    github-vcs-activity.ts    # VcsActivityPort impl, composes the services
    github-integration.ts     # adapter: BaseIntegration + VcsActivityPort
    index.ts                  # provider barrel
    services/
      repositories.service.ts
      branches.service.ts
      commits.service.ts
      pull-requests.service.ts
      issues.service.ts
      releases.service.ts
      developer-activity.service.ts
      index.ts
```

Import from the platform barrel (`@/integrations`), never from sub-paths.

---

## The two layers

### 1. Capability port — `VcsActivityPort` (vendor-neutral)

The six lifecycle methods (`connect` / `disconnect` / `sync` / `healthCheck` /
`settings` / `validate`) are universal and stay on `Integration`. Everything
GitHub-shaped is layered on as a **capability port** so the core interface never
widens (Architecture doc §5).

`ports/vcs-activity.ts` declares `VcsActivityPort` plus neutral DTOs
(`VcsRepository`, `VcsBranch`, `VcsCommit`, `VcsPullRequest`, `VcsIssue`,
`VcsRelease`, `VcsDeveloperActivity`) and query/pagination primitives
(`VcsPageParams`, `VcsPage<T>`, `Vcs*Query`). A feature depends on this port and
**never names GitHub** — swapping in GitLab later is a registry/config change, not
a feature change.

```ts
export interface VcsActivityPort {
  listRepositories(accountId, params?): Promise<VcsPage<VcsRepository>>;
  getRepository(accountId, ref): Promise<VcsRepository>;
  listBranches(accountId, ref, params?): Promise<VcsPage<VcsBranch>>;
  listCommits(accountId, ref, query?): Promise<VcsPage<VcsCommit>>;
  listPullRequests(accountId, ref, query?): Promise<VcsPage<VcsPullRequest>>;
  listIssues(accountId, ref, query?): Promise<VcsPage<VcsIssue>>;
  listReleases(accountId, ref, params?): Promise<VcsPage<VcsRelease>>;
  getDeveloperActivity(accountId, query): Promise<VcsDeveloperActivity>;
}
```

### 2. GitHub adapter (vendor-specific)

`GitHubIntegration` extends `BaseIntegration` (inheriting the whole lifecycle) and
**additionally implements `VcsActivityPort`**, delegating each port method to
`GitHubVcsActivity`. It writes only the four vendor hooks — `authenticate`,
`performSync`, `probe`, `settingsSchema` — three of which resolve to the
`notImplemented` seam for now.

---

## Feature services (the seven capability areas)

Each requested feature is its own service: a small **interface** (the contract
features and tests depend on) plus a **class** that delegates to `GitHubClient`.
Per CLAUDE.md, all external communication goes through these service classes;
components never touch the network directly.

| Feature            | Service interface          | Class                            | Returns                   |
| ------------------ | -------------------------- | -------------------------------- | ------------------------- |
| Repositories       | `RepositoriesService`      | `GitHubRepositoriesService`      | `GitHubRepository`        |
| Branches           | `BranchesService`          | `GitHubBranchesService`          | `GitHubBranch`            |
| Commits            | `CommitsService`           | `GitHubCommitsService`           | `GitHubCommit`            |
| Pull Requests      | `PullRequestsService`      | `GitHubPullRequestsService`      | `GitHubPullRequest`       |
| Issues             | `IssuesService`            | `GitHubIssuesService`            | `GitHubIssue`             |
| Releases           | `ReleasesService`          | `GitHubReleasesService`          | `GitHubRelease`           |
| Developer Activity | `DeveloperActivityService` | `GitHubDeveloperActivityService` | `GitHubDeveloperActivity` |

Services hold **no network code** — they add account scoping/defaults around the
one client seam. `GitHubDeveloperActivityService` is the composite: GitHub has no
single "activity" endpoint, so it will fan out across commits / PRs / issues and
reduce the results (all still placeholder).

---

## Data flow

```
feature ──depends-on──▶ VcsActivityPort
                          ▲
                          │ implements + delegates
                    GitHubIntegration ──▶ GitHubVcsActivity
                                              │ composes
                                              ▼
        Repositories / Branches / Commits / PullRequests /
        Issues / Releases / DeveloperActivity  (services)
                                              │ delegate
                                              ▼
                                        GitHubClient  ── notImplemented
                                        (single HTTP/SDK seam)
```

`mappers.ts` is the boundary between the two vocabularies — pure, total functions
that translate GitHub DTOs and page numbers into the neutral `Vcs*` DTOs and
opaque cursors the port exposes. No I/O, so they are trivially unit-testable the
moment the client returns real data.

---

## Boundaries the design keeps

- **Two layers, cleanly split.** GitHub types never leak past `github-vcs-activity.ts`;
  features see only `Vcs*` DTOs.
- **One network seam.** `GitHubClient` is the only file that will ever import a
  GitHub SDK or issue HTTP — the single place to audit rate limits, retries and
  auth (per Architecture doc §9).
- **Neutral pagination.** GitHub's `Link`-header page numbers are mapped to the
  port's opaque forward `nextCursor`; callers never learn GitHub paginates by page.
- **Strict TypeScript, no `any`.** Verified with `npx tsc --noEmit`.

---

## Metadata & settings

```ts
GITHUB_METADATA = {
  id: "github",
  displayName: "GitHub",
  category: "vcs",
  scope: "user", // connected per developer, opt-in
  auth: "oauth2",
  capabilities: ["vcs.activity", "webhook.inbound"],
  supportsWebhooks: true,
  available: false, // placeholder until the client is wired
};
```

Settings fields (rendered by the Admin form via `SettingsSchema`):

| Key              | Type                     | Purpose                                      |
| ---------------- | ------------------------ | -------------------------------------------- |
| `org`            | string (optional)        | Restrict activity signals to one GitHub org. |
| `includeReviews` | boolean (default `true`) | Count PR reviews toward developer activity.  |

---

## Usage (once wired)

```ts
import { getIntegrationRegistry, isVcsActivityPort } from "@/integrations";

const gh = getIntegrationRegistry().get("github");
if (isVcsActivityPort(gh)) {
  const repos = await gh.listRepositories(accountId);
  const activity = await gh.getDeveloperActivity(accountId, {
    login: "octocat",
    periodStart: "2026-06-01T00:00:00Z",
    periodEnd: "2026-07-01T00:00:00Z",
  });
}
```

A feature that only wants VCS activity resolves the port by capability instead of
naming GitHub — GitHub today, GitLab tomorrow, no feature change:

```ts
const provider = getIntegrationRegistry().firstWithCapability("vcs.activity");
if (provider && isVcsActivityPort(provider)) {
  await provider.listRepositories(accountId);
}
```

> `firstWithCapability` only returns _available_ providers, so it yields GitHub
> once `available` is flipped to `true`; until then, resolve by id as above.

---

## Wiring the real integration (the only future change)

1. Fill the `GitHubClient` method bodies: resolve a token via
   `config.resolveToken(accountId)`, call the GitHub REST/GraphQL API, and map the
   raw payloads to the `GitHub*` DTOs in `types.ts`.
2. Implement the three placeholder vendor hooks in `github-integration.ts`
   (`authenticate` = OAuth code exchange, `performSync`, `probe` = `GET /user`).
3. Flip `available: true` in `GITHUB_METADATA`.

The `VcsActivityPort`, mappers, services, registry, hooks and every other adapter
stay untouched — the Open/Closed guarantee in practice.

---

## Related

- [`docs/INTEGRATION_ARCHITECTURE.md`](./INTEGRATION_ARCHITECTURE.md) — full platform design.
- [`src/integrations/README.md`](../src/integrations/README.md) — implementation overview.
- [`docs/Integrations.md`](./Integrations.md) — ports-and-adapters rationale.
