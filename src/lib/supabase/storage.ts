/**
 * Supabase Storage infrastructure.
 *
 * Typed helpers over `supabase.storage` for uploads, downloads, signed/public
 * URLs and listing. Bucket names are centralized in {@link STORAGE_BUCKETS} so
 * call sites never hard-code strings.
 *
 * Not wired into the app yet — see CLAUDE.md / task scope.
 */
import type { FileObject } from "@supabase/storage-js";
import { supabaseClient } from "./client";

/**
 * Known storage buckets. Create the matching buckets in the Supabase dashboard
 * (or via migration) before use — see docs/SUPABASE_SETUP.md.
 */
export const STORAGE_BUCKETS = {
  avatars: "avatars",
  companyAssets: "company-assets",
  taskAttachments: "task-attachments",
  projectFiles: "project-files",
  reportAttachments: "report-attachments",
} as const;

export type StorageBucket = (typeof STORAGE_BUCKETS)[keyof typeof STORAGE_BUCKETS];

/** The underlying storage namespace, for advanced use. */
export const storage = supabaseClient.storage;

export interface UploadOptions {
  /** Overwrite an existing object at the same path. Defaults to `false`. */
  upsert?: boolean;
  /** Content-Type; inferred by Supabase when omitted. */
  contentType?: string;
  /** Cache-Control max-age in seconds. */
  cacheControlSeconds?: number;
}

/** Upload (or replace) a file at `path` within a bucket. Returns the object path. */
export async function uploadFile(
  bucket: StorageBucket,
  path: string,
  file: File | Blob | ArrayBuffer,
  options: UploadOptions = {},
): Promise<string> {
  const { data, error } = await storage.from(bucket).upload(path, file, {
    upsert: options.upsert ?? false,
    contentType: options.contentType,
    cacheControl: options.cacheControlSeconds ? String(options.cacheControlSeconds) : undefined,
  });
  if (error) throw error;
  return data.path;
}

/** Download a file as a `Blob`. */
export async function downloadFile(bucket: StorageBucket, path: string): Promise<Blob> {
  const { data, error } = await storage.from(bucket).download(path);
  if (error) throw error;
  return data;
}

/** Public URL for an object in a public bucket. */
export function getPublicUrl(bucket: StorageBucket, path: string): string {
  return storage.from(bucket).getPublicUrl(path).data.publicUrl;
}

/** Time-limited signed URL for an object in a private bucket. */
export async function createSignedUrl(
  bucket: StorageBucket,
  path: string,
  expiresInSeconds = 3600,
): Promise<string> {
  const { data, error } = await storage.from(bucket).createSignedUrl(path, expiresInSeconds);
  if (error) throw error;
  return data.signedUrl;
}

/** List objects under an optional folder prefix. */
export async function listFiles(bucket: StorageBucket, prefix?: string): Promise<FileObject[]> {
  const { data, error } = await storage.from(bucket).list(prefix);
  if (error) throw error;
  return data ?? [];
}

/** Remove one or more objects by path. */
export async function removeFiles(bucket: StorageBucket, paths: string[]): Promise<void> {
  const { error } = await storage.from(bucket).remove(paths);
  if (error) throw error;
}
