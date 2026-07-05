import type { FileKind } from "./types";

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

export function kindFromName(name: string, mime?: string): FileKind {
  const ext = name.toLowerCase().split(".").pop() ?? "";
  if (mime?.startsWith("image/")) return "image";
  if (["png", "jpg", "jpeg", "gif", "webp", "svg"].includes(ext)) return "image";
  if (ext === "pdf" || mime === "application/pdf") return "pdf";
  if (["doc", "docx", "txt", "md", "rtf", "odt"].includes(ext)) return "doc";
  if (["zip", "rar", "7z", "tar", "gz"].includes(ext)) return "zip";
  if (
    ["ts", "tsx", "js", "jsx", "json", "py", "go", "rs", "rb", "java", "css", "html", "sql", "sh", "yml", "yaml"].includes(
      ext,
    )
  )
    return "code";
  return "other";
}

export function relativeTime(iso: string, now = Date.now()): string {
  const diff = now - new Date(iso).getTime();
  const m = Math.floor(diff / 60_000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d ago`;
  return new Date(iso).toLocaleDateString();
}

/** Parses inline @handle mentions and returns matching employee ids. */
export function extractMentions(
  message: string,
  directory: { id: string; handle: string }[],
): string[] {
  const ids = new Set<string>();
  const re = /@([a-z0-9_]+)/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(message))) {
    const handle = m[1].toLowerCase();
    const hit = directory.find((d) => d.handle === handle);
    if (hit) ids.add(hit.id);
  }
  return [...ids];
}
