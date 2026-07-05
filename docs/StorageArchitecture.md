# Storage Architecture — SpartaFlow Hub

Supabase Storage organizes files by **purpose**, not by uploader. Every object also has a row in `public.attachments` so application code never queries `storage.objects` directly.

## 1. Bucket Catalogue

| Bucket | Public? | Purpose | Max size | Allowed MIME | Retention |
|---|---|---|---|---|---|
| `avatars` | Public read | User profile pictures | 2 MB | `image/png`, `image/jpeg`, `image/webp` | Until user replaces/offboarded |
| `announcement-assets` | Private | Images, PDFs attached to announcements | 10 MB | image/*, application/pdf | Tied to announcement; deleted when announcement hard-deleted |
| `documents` | Private | Internal documents shared via the directory | 25 MB | docs, pdf, image | 3 years then archive |
| `attachments` | Private | Files attached to dependencies, EOD reports, comments | 25 MB | docs, images, archives | Tied to parent row |
| `exports` | Private | Generated CSV/PDF exports (manager reports) | 50 MB | csv, pdf, xlsx | 30 days hard delete |
| `company-assets` | Public read | Branding, logos, default avatars | 5 MB | image/* | Manual |

## 2. Path Conventions

- `avatars/{user_id}/{uuid}.{ext}`
- `announcement-assets/{announcement_id}/{uuid}.{ext}`
- `documents/{department_id|global}/{uuid}-{filename}`
- `attachments/{parent_table}/{parent_id}/{uuid}-{filename}`
- `exports/{user_id}/{yyyy-mm-dd}/{uuid}.{ext}`
- `company-assets/{slug}.{ext}`

Filenames are slugged + UUID-prefixed to avoid collisions and prevent traversal. Original filename stored in `attachments.metadata` / `attachments.object_path` segment.

## 3. Upload Pipeline

All uploads go through a signed-URL Edge Function `requestUpload`:

1. Client requests `{ bucket, parent_table?, parent_id?, filename, mime, size }`.
2. Edge Function:
   - Validates the caller's permission to write to that target.
   - Validates MIME against the bucket allow-list and `size` against the cap.
   - Generates the deterministic path.
   - Inserts a placeholder row in `public.attachments` with `checksum=null`.
   - Returns a one-shot signed upload URL (Supabase `createSignedUploadUrl`, 5 min TTL).
3. Client PUTs the file to the signed URL.
4. Client calls `completeUpload(attachment_id, checksum)`; Edge Function:
   - Downloads first KB to validate MIME via magic bytes (not just the header the client sent).
   - Runs AV scan (ClamAV via Edge Function) for `documents` and `attachments` buckets.
   - On pass: sets `checksum`, marks attachment as final, emits domain event.
   - On fail: deletes the object, deletes the attachment row, returns error.

This eliminates direct browser writes that bypass validation.

## 4. Download / Access

- Public buckets (`avatars`, `company-assets`) — direct CDN URL.
- Private buckets — `getAttachment(id)` server fn returns a short-lived signed URL (60 s) after RLS check.
- Signed URLs are minted server-side only; the browser never holds the service-role key.

## 5. Storage Policies (storage.objects)

Defined per bucket; full predicates in `RLSPolicies.md` §4. Summary:

| Bucket | Read | Write | Delete |
|---|---|---|---|
| `avatars` | authenticated, all | owner only | owner only |
| `announcement-assets` | audience members (via `is_audience_of`) | author w/ scope perm | author or admin |
| `documents` | dept members + managers + HR | uploader + HR | uploader + HR |
| `attachments` | per linked parent row | parent participants | owner + admin |
| `exports` | owner only | owner only (via Edge Function) | retention job |
| `company-assets` | authenticated, all | admin (`admin.config`) | admin |

## 6. Lifecycle & Retention

- pg_cron job `purge_old_exports` deletes `exports` objects + rows older than 30 days.
- Announcement hard delete cascades to `attachments` rows; a follow-up Edge Function removes the storage objects.
- Offboarding: avatar removed (replaced with default); user's documents transferred to their team lead's archive; export history deleted.
- All deletions tombstoned in `audit_logs`.

## 7. Quotas & Abuse Controls

- Per-user daily upload quota enforced in `requestUpload` (default 200 MB/day).
- Per-bucket total quota tracked via nightly aggregate; alerts at 80% / 95%.
- Rate-limit on `requestUpload` per user/IP (30/min).

## 8. Backups

- Storage buckets backed by Supabase's underlying object store; daily snapshots part of project backup.
- Critical buckets (`documents`, `attachments`, `announcement-assets`) are versioned for 30 days so accidental deletes can be recovered.

## 9. CDN & Performance

- Public buckets served from Supabase CDN with long-cache immutable headers (filenames are UUID-prefixed).
- Image transformations via Supabase image proxy for `avatars` (width/height presets only — no arbitrary transforms accepted).
- `exports` served with `Content-Disposition: attachment` and short cache.

## 10. Threats Addressed

| Threat | Mitigation |
|---|---|
| Malware upload | AV scan on `documents`/`attachments`. |
| MIME spoofing | Magic-byte validation post-upload. |
| Traversal / collision | UUID paths, server-generated names. |
| Quota exhaustion | Per-user + per-bucket quotas. |
| Stolen signed URL | 60 s TTL on download URLs. |
| Public exposure of private docs | Bucket private; signed URLs only; storage policies + RLS on parent row. |
