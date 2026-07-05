/**
 * Bootstrap module — the one-time platform provisioning process.
 *
 * The orchestration itself is privileged and **server-only**: import it
 * explicitly from `./bootstrap.server` inside a server entrypoint (see
 * `scripts/bootstrap.ts`). It is deliberately not re-exported here so this
 * barrel stays safe to import from client code.
 *
 * See `docs/BOOTSTRAP.md` for the operator runbook.
 */
export type { BootstrapInput, BootstrapResult, BootstrapStatus } from "./types";

export {
  DEFAULT_COMPANY_NAME,
  DEFAULT_DEPARTMENTS,
  DEFAULT_PERMISSIONS,
  DEFAULT_ROLE_PERMISSIONS,
  DEFAULT_ROLES,
  DEFAULT_TIMEZONE,
  DEFAULT_WORKSPACE_NAME,
} from "./constants";
