import { useState, type DragEvent } from "react";
import {
  Archive,
  Download,
  FileCode2,
  FileImage,
  FileText,
  FileType,
  Paperclip,
  Trash2,
  Upload,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { EmptyState } from "@/features/hr/components/empty-state";
import { EmployeeChip } from "@/features/tasks/components/employee-chip";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { commStore, selectTaskFiles, useCommState } from "../store";
import type { FileKind, TaskFile } from "../types";
import { formatBytes, kindFromName, relativeTime } from "../utils";

const CURRENT_USER_ID = "emp_001";

const KIND_ICON: Record<FileKind, typeof FileText> = {
  image: FileImage,
  pdf: FileType,
  doc: FileText,
  zip: Archive,
  code: FileCode2,
  other: Paperclip,
};

const KIND_TINT: Record<FileKind, string> = {
  image: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  pdf: "bg-red-500/10 text-red-600 dark:text-red-400",
  doc: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
  zip: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  code: "bg-violet-500/10 text-violet-600 dark:text-violet-400",
  other: "bg-muted text-muted-foreground",
};

export function TaskFilesPanel({ taskId }: { taskId: string }) {
  const files = useCommState(selectTaskFiles(taskId));
  const [dragOver, setDragOver] = useState(false);
  const [previewFile, setPreviewFile] = useState<TaskFile | null>(null);

  function uploadMany(list: FileList | File[]) {
    const arr = Array.from(list);
    for (const f of arr) {
      const kind = kindFromName(f.name, f.type);
      const previewUrl = kind === "image" ? URL.createObjectURL(f) : null;
      commStore.addFile({
        taskId,
        userId: CURRENT_USER_ID,
        fileName: f.name,
        fileType: f.type || "application/octet-stream",
        fileSize: f.size,
        kind,
        previewUrl,
      });
    }
  }

  function onDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files?.length) uploadMany(e.dataTransfer.files);
  }

  return (
    <div className="space-y-4">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        className={cn(
          "flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed bg-muted/30 px-4 py-6 text-center transition-colors",
          dragOver && "border-primary bg-primary/5",
        )}
      >
        <Upload className="size-5 text-muted-foreground" />
        <p className="text-sm font-medium">Drop files here to attach</p>
        <p className="text-xs text-muted-foreground">
          Images, PDFs, documents, zips, code — up to 25MB each (UI only)
        </p>
        <label className="mt-1">
          <input
            type="file"
            multiple
            className="hidden"
            onChange={(e) => {
              if (e.target.files?.length) uploadMany(e.target.files);
              e.target.value = "";
            }}
          />
          <Button asChild size="sm" variant="outline">
            <span>
              <Paperclip className="size-3.5" /> Choose files
            </span>
          </Button>
        </label>
      </div>

      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">
          Attachments{" "}
          <span className="text-xs font-normal text-muted-foreground">
            · {files.length}
          </span>
        </h3>
      </div>

      {files.length === 0 ? (
        <EmptyState
          icon={Paperclip}
          title="No files attached"
          description="Drop a file above or click Choose files to add an attachment."
        />
      ) : (
        <ul className="grid gap-2 sm:grid-cols-2">
          {files
            .slice()
            .sort((a, b) => (a.uploadedAt < b.uploadedAt ? 1 : -1))
            .map((f) => {
              const Icon = KIND_ICON[f.kind];
              const tint = KIND_TINT[f.kind];
              return (
                <li
                  key={f.id}
                  className="group flex items-center gap-3 rounded-lg border bg-card p-3"
                >
                  <button
                    type="button"
                    onClick={() => setPreviewFile(f)}
                    className={cn(
                      "grid size-10 shrink-0 place-items-center overflow-hidden rounded-md",
                      tint,
                    )}
                    aria-label={`Preview ${f.fileName}`}
                  >
                    {f.previewUrl ? (
                      <img
                        src={f.previewUrl}
                        alt=""
                        className="size-full object-cover"
                      />
                    ) : (
                      <Icon className="size-5" />
                    )}
                  </button>
                  <div className="min-w-0 flex-1">
                    <button
                      type="button"
                      onClick={() => setPreviewFile(f)}
                      className="block truncate text-left text-sm font-medium hover:underline"
                    >
                      {f.fileName}
                    </button>
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-muted-foreground">
                      <span className="uppercase">{f.kind}</span>
                      <span>·</span>
                      <span>{formatBytes(f.fileSize)}</span>
                      <span>·</span>
                      <EmployeeChip id={f.uploadedBy} />
                      <span>·</span>
                      <span>{relativeTime(f.uploadedAt)}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-8"
                      aria-label="Download"
                      onClick={() =>
                        toast(`Download started · ${f.fileName}`, {
                          description: "Mock download — wired to storage in backend phase.",
                        })
                      }
                    >
                      <Download className="size-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-8 text-destructive"
                      aria-label="Delete"
                      onClick={() => commStore.deleteFile(f.id)}
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </div>
                </li>
              );
            })}
        </ul>
      )}

      <Dialog open={!!previewFile} onOpenChange={(o) => !o && setPreviewFile(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="truncate">{previewFile?.fileName}</DialogTitle>
          </DialogHeader>
          {previewFile ? <FilePreview file={previewFile} /> : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function FilePreview({ file }: { file: TaskFile }) {
  const Icon = KIND_ICON[file.kind];
  return (
    <div className="space-y-3">
      <div className="grid min-h-[260px] place-items-center rounded-lg border bg-muted/30 p-4">
        {file.kind === "image" && file.previewUrl ? (
          <img
            src={file.previewUrl}
            alt={file.fileName}
            className="max-h-[420px] rounded object-contain"
          />
        ) : (
          <div className="flex flex-col items-center gap-3 text-center">
            <div
              className={cn(
                "grid size-16 place-items-center rounded-xl",
                KIND_TINT[file.kind],
              )}
            >
              <Icon className="size-8" />
            </div>
            <div>
              <p className="text-sm font-medium">{file.fileName}</p>
              <p className="text-xs text-muted-foreground">
                Inline preview unavailable in mock mode.
              </p>
            </div>
          </div>
        )}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
        <div className="flex flex-wrap items-center gap-x-2">
          <span className="uppercase">{file.kind}</span>
          <span>·</span>
          <span>{formatBytes(file.fileSize)}</span>
          <span>·</span>
          <span>{file.fileType}</span>
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={() =>
            toast(`Download started · ${file.fileName}`, {
              description: "Mock download — wired to storage in backend phase.",
            })
          }
        >
          <Download className="size-3.5" /> Download
        </Button>
      </div>
    </div>
  );
}
