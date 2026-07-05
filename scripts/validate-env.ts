/**
 * Fail-fast environment validation.
 *
 *   bun run validate:env                # validate both scopes from process.env
 *   bun run validate:env -- --scope=server
 *   bun run validate:env -- --scope=client
 *
 * Bun auto-loads `.env`, so this checks the same values the app will read.
 * In CI, VITE_* come from Actions secrets; server secrets live on the VPS.
 * Run it in prebuild / deploy to catch missing or malformed config early.
 *
 * Exit code 0 = valid; 1 = one or more scopes failed.
 */
import { validateEnv, type EnvScope } from "../src/lib/env/index";

const arg = process.argv.find((a) => a.startsWith("--scope="));
const requested = arg?.split("=")[1] as EnvScope | undefined;
const scopes: EnvScope[] = requested ? [requested] : ["server", "client"];

const source = process.env as Record<string, unknown>;
let failed = false;

for (const scope of scopes) {
  const { success, errors, warnings } = validateEnv(scope, source);

  for (const w of warnings) console.warn(`⚠️  [${scope}] ${w}`);

  if (success) {
    console.log(`✅ ${scope} environment OK`);
  } else {
    failed = true;
    console.error(`❌ ${scope} environment invalid:`);
    for (const e of errors) console.error(`   - ${e}`);
  }
}

if (failed) {
  console.error("\nEnvironment validation failed. See docs/ENVIRONMENT.md.");
  process.exit(1);
}
