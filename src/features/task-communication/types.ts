import { employees } from "@/features/hr/mock-data";

export type CommentReaction = {
  emoji: string;
  userIds: string[];
};

export type TaskThreadComment = {
  id: string;
  taskId: string;
  userId: string;
  message: string;
  parentCommentId: string | null;
  mentions: string[]; // employee ids
  reactions: CommentReaction[];
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
};

export const FILE_KINDS = ["image", "pdf", "doc", "zip", "code", "other"] as const;
export type FileKind = (typeof FILE_KINDS)[number];

export type TaskFile = {
  id: string;
  taskId: string;
  fileName: string;
  fileType: string; // mime-ish, e.g. "image/png"
  kind: FileKind;
  fileSize: number; // bytes (UI only)
  uploadedBy: string;
  uploadedAt: string;
  previewUrl?: string | null; // for image kind, blob URL when user "uploads"
};

export type CommActivityKind =
  | "comment_added"
  | "comment_edited"
  | "comment_deleted"
  | "comment_reaction"
  | "file_uploaded"
  | "file_deleted";

export type TaskCommActivity = {
  id: string;
  taskId: string;
  actorId: string;
  kind: CommActivityKind;
  summary: string;
  at: string;
  refId?: string; // comment or file id
};

export const MENTIONABLE_USERS = employees.slice(0, 25).map((e) => ({
  id: e.id,
  name: e.name,
  handle: e.name.toLowerCase().replace(/[^a-z]+/g, ""),
}));

export const QUICK_EMOJIS = ["👍", "❤️", "🎉", "🚀", "👀", "🙏", "✅", "🔥"] as const;
