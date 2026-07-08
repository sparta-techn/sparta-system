# Files

File attachments scoped to a Task. UI only — no real storage backend.

## Data Model

```ts
TaskFile {
  id: string
  taskId: string
  fileName: string
  fileType: string        // mime, e.g. "image/png"
  kind: "image" | "pdf" | "doc" | "zip" | "code" | "other"
  fileSize: number        // bytes
  uploadedBy: string
  uploadedAt: string
  previewUrl: string | null  // blob: URL when an image is added in-session
}
```

Storage: same `commStore` (localStorage) as comments. Blob URLs for
images are created via `URL.createObjectURL` and revoked on delete.

## Features

- **Upload UI** — drag-and-drop zone + `Choose files` button. Accepts
  any file, derives `kind` from extension/mime, registers in the store.
- **File list** — two-column grid on `sm+`, single column on mobile.
  Each row shows kind-tinted icon (or image thumbnail), name, kind,
  size, uploader, relative time.
- **Preview dialog** — click the thumbnail or filename. Images render
  inline; everything else shows a placeholder card with metadata.
- **Download** — sonner toast acknowledging a mock download. Real
  storage signed URLs land with the backend phase.
- **Delete** — removes the file, revokes any blob URL, records a
  `file_deleted` activity event.

## File Kinds & Icons

| Kind  | Extensions / MIME                                                           | Icon        |
| ----- | --------------------------------------------------------------------------- | ----------- |
| image | png, jpg, jpeg, gif, webp, svg, `image/*`                                   | `FileImage` |
| pdf   | pdf, `application/pdf`                                                      | `FileType`  |
| doc   | doc, docx, txt, md, rtf, odt                                                | `FileText`  |
| zip   | zip, rar, 7z, tar, gz                                                       | `Archive`   |
| code  | ts, tsx, js, jsx, json, py, go, rs, rb, java, css, html, sql, sh, yml, yaml | `FileCode2` |
| other | anything else                                                               | `Paperclip` |

Each kind has a semantic tint class (emerald/red/blue/amber/violet/muted)
applied to the thumbnail container only — no hardcoded colors leak into
text or backgrounds elsewhere.

## Integration

`Task Detail → Files tab` renders `<TaskFilesPanel taskId={...} />`.

## Notifications (UI only)

Each successful upload triggers a sonner success toast: `"{uploader}
uploaded {fileName}"`.

## Activity

Every upload and delete pushes a `file_uploaded` / `file_deleted` event
to the communication activity stream surfaced inside the Task Detail
Activity tab — see `TaskCommunication.md`.

## Non-Goals

- No backend storage (S3, Supabase Storage, etc.).
- No virus scanning, signed URLs, or quota enforcement.
- No multi-file zip download.
- No versioning.

These belong to a future Storage module.
