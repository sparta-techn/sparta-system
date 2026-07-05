import { db } from "../core/client";
import { toServiceError } from "../core/errors";
import type { SystemSettings, SystemSettingsUpdate } from "./types";

/**
 * SystemSettingsService — the platform singleton (`public.system_settings`).
 *
 * Holds the two platform-wide flags read across the app: `is_bootstrapped`
 * (has the one-time {@link ../../repositories/bootstrap bootstrap} completed?)
 * and `public_registration_enabled` (may anyone self-register?).
 *
 * The row is keyed on a boolean primary key (`id = true`), so this service does
 * not extend {@link ../core/base-service BaseService} (whose CRUD verbs address
 * rows by a UUID string). Reads are open to any authenticated user; writes are
 * gated to `owner` / `admin` by RLS — the bootstrap orchestrator flips
 * these flags with the service role.
 */
export class SystemSettingsService {
  private readonly table = "system_settings";
  private readonly entity = "SystemSettings";

  /** The singleton settings row, or `null` if it has not been seeded. */
  async get(): Promise<SystemSettings | null> {
    try {
      const { data, error } = await db.from(this.table).select("*").eq("id", true).maybeSingle();
      if (error) throw error;
      return (data as unknown as SystemSettings | null) ?? null;
    } catch (error) {
      throw toServiceError(error, `Failed to load ${this.entity}`);
    }
  }

  /** Whether the one-time bootstrap has completed. Defaults to `false`. */
  async isBootstrapped(): Promise<boolean> {
    const settings = await this.get();
    return settings?.is_bootstrapped ?? false;
  }

  /** Whether public self-registration is currently allowed. Defaults to `true`. */
  async isPublicRegistrationEnabled(): Promise<boolean> {
    const settings = await this.get();
    return settings?.public_registration_enabled ?? true;
  }

  /** Patch the singleton, returning the updated row. */
  async update(patch: SystemSettingsUpdate): Promise<SystemSettings> {
    try {
      const { data, error } = await db
        .from(this.table)
        .update(patch as never)
        .eq("id", true)
        .select()
        .single();
      if (error) throw error;
      return data as unknown as SystemSettings;
    } catch (error) {
      throw toServiceError(error, `Failed to update ${this.entity}`);
    }
  }

  /** Enable or disable public self-registration. */
  setPublicRegistration(enabled: boolean): Promise<SystemSettings> {
    return this.update({ public_registration_enabled: enabled });
  }
}

/** Shared singleton — import this, not the class. */
export const systemSettingsService = new SystemSettingsService();
