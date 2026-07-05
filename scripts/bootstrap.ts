/**
 * SpartaFlow bootstrap CLI.
 *
 * One-time platform provisioning: creates the owner account, company, default
 * workspace, default departments, and the default roles / permissions matrix,
 * then disables public self-registration. Safe to re-run — it no-ops once the
 * platform is already bootstrapped.
 *
 * Usage (bun auto-loads `.env`):
 *   OWNER_EMAIL=you@co.com OWNER_PASSWORD='…' bun run bootstrap
 *   bun run bootstrap --status      # print current state and exit
 *
 * Required env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, OWNER_EMAIL,
 *               OWNER_PASSWORD.
 * Optional env: OWNER_NAME, COMPANY_NAME, COMPANY_SLUG, COMPANY_TIMEZONE,
 *               WORKSPACE_NAME, WORKSPACE_SLUG,
 *               BOOTSTRAP_KEEP_PUBLIC_REGISTRATION ("true" keeps signup open).
 */
import { getBootstrapStatus, runBootstrap } from "@/repositories/bootstrap/bootstrap.server";
import type { BootstrapInput } from "@/repositories/bootstrap/types";

function env(name: string): string | undefined {
  const value = process.env[name];
  return value && value.trim() !== "" ? value.trim() : undefined;
}

function requireEnv(name: string): string {
  const value = env(name);
  if (!value) {
    console.error(`✖ Missing required environment variable: ${name}`);
    process.exit(1);
  }
  return value;
}

async function printStatus(): Promise<void> {
  const status = await getBootstrapStatus();
  console.log("SpartaFlow platform status:");
  console.log(`  bootstrapped:                ${status.isBootstrapped}`);
  console.log(`  public registration enabled: ${status.publicRegistrationEnabled}`);
  console.log(`  company id:                  ${status.companyId ?? "—"}`);
  console.log(`  bootstrapped at:             ${status.bootstrappedAt ?? "—"}`);
}

async function main(): Promise<void> {
  if (process.argv.includes("--status")) {
    await printStatus();
    return;
  }

  const status = await getBootstrapStatus();
  if (status.isBootstrapped) {
    console.log("✓ Platform is already bootstrapped — nothing to do.");
    await printStatus();
    return;
  }

  const input: BootstrapInput = {
    owner: {
      email: requireEnv("OWNER_EMAIL"),
      password: requireEnv("OWNER_PASSWORD"),
      fullName: env("OWNER_NAME"),
    },
    company: {
      name: env("COMPANY_NAME"),
      slug: env("COMPANY_SLUG"),
      timezone: env("COMPANY_TIMEZONE"),
    },
    workspace: {
      name: env("WORKSPACE_NAME"),
      slug: env("WORKSPACE_SLUG"),
    },
    disablePublicRegistration: env("BOOTSTRAP_KEEP_PUBLIC_REGISTRATION") !== "true",
  };

  console.log("→ Bootstrapping SpartaFlow…");
  const result = await runBootstrap(input);

  if (result.alreadyBootstrapped) {
    console.log("✓ Platform was already bootstrapped — no changes made.");
  } else {
    console.log("✓ Bootstrap complete:");
    console.log(`    owner user id:      ${result.ownerUserId}`);
    console.log(`    company id:         ${result.companyId}`);
    console.log(`    default workspace:  ${result.workspaceId}`);
    console.log(`    departments:        ${result.departmentCount}`);
    console.log(`    roles:              ${result.roleCount}`);
    console.log(`    permissions:        ${result.permissionCount}`);
    console.log(
      `    public registration: ${result.publicRegistrationEnabled ? "ENABLED" : "DISABLED"}`,
    );
  }
}

main().catch((error) => {
  console.error("✖ Bootstrap failed:");
  console.error(error);
  process.exit(1);
});
