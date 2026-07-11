import { STORAGE_BUCKETS, getPublicUrl, uploadFile } from "@/lib/supabase/storage";
import { ServiceError, toServiceError } from "@/services/core/errors";
import {
  CompaniesService,
  companiesService,
  type Company,
  type CompanyUpdate,
} from "@/services/organization";

/** Logo upload constraints — mirrored by the bucket policy in migration 20260711130000. */
export const LOGO_MAX_BYTES = 2 * 1024 * 1024; // 2 MB
export const LOGO_ACCEPTED_MIME = [
  "image/png",
  "image/jpeg",
  "image/svg+xml",
  "image/webp",
] as const;

type LogoMime = (typeof LOGO_ACCEPTED_MIME)[number];

const MIME_EXT: Record<LogoMime, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/svg+xml": "svg",
  "image/webp": "webp",
};

/**
 * CompanyRepository — domain-facing API over the organization identity
 * (`public.companies`, migrations 20260702120000 + 20260707120000).
 *
 * The deployment is single-company in practice, so the org-settings UI reads
 * {@link getPrimary} and writes through {@link update}. Delegates to
 * {@link CompaniesService}; writes are gated to owner/admin by RLS.
 */
export class CompanyRepository {
  constructor(private readonly service: CompaniesService = companiesService) {}

  /** The primary (first, active) company — the org whose settings are edited. */
  getPrimary(): Promise<Company | null> {
    return this.service.getPrimary();
  }

  getById(id: string): Promise<Company | null> {
    return this.service.getById(id);
  }

  /** Patch an existing company's settings (name, timezone, logo, hours, …). */
  update(id: string, patch: CompanyUpdate): Promise<Company> {
    return this.service.update(id, patch);
  }

  /**
   * Upload a logo image to the `company-assets` bucket and persist its public
   * URL onto the company. Guards type/size before hitting Storage so the caller
   * gets a clean ServiceError rather than a raw storage failure.
   */
  async uploadLogo(companyId: string, file: File): Promise<Company> {
    try {
      if (!LOGO_ACCEPTED_MIME.includes(file.type as LogoMime)) {
        throw new ServiceError("Logo must be a PNG, JPG, SVG, or WebP image.", "invalid_file_type");
      }
      if (file.size > LOGO_MAX_BYTES) {
        throw new ServiceError("Logo must be 2 MB or smaller.", "file_too_large");
      }
      const ext = MIME_EXT[file.type as LogoMime] ?? "png";
      // Timestamped path → the public URL changes on each upload, so the
      // sidebar/favicon cache-bust automatically instead of serving a stale logo.
      const path = `${companyId}/logo-${Date.now()}.${ext}`;
      await uploadFile(STORAGE_BUCKETS.companyAssets, path, file, {
        upsert: true,
        contentType: file.type,
        cacheControlSeconds: 3600,
      });
      const publicUrl = getPublicUrl(STORAGE_BUCKETS.companyAssets, path);
      return this.service.update(companyId, { logo_url: publicUrl });
    } catch (error) {
      throw toServiceError(error, "Failed to upload company logo");
    }
  }
}

/** Shared singleton — import this, not the class. */
export const companyRepository = new CompanyRepository();
