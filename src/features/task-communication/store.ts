import { useSyncExternalStore } from "react";
import { toast } from "sonner";
import { employeeById } from "@/features/tasks/utils";
import { seedActivity, seedComments, seedFiles } from "./mock-data";
import type { FileKind, TaskCommActivity, TaskFile, TaskThreadComment } from "./types";
import { MENTIONABLE_USERS } from "./types";
import { extractMentions, kindFromName } from "./utils";

const STORAGE_KEY = "spartaflow:task-communication:v1";

type State = {
  comments: TaskThreadComment[];
  files: TaskFile[];
  activity: TaskCommActivity[];
};

const listeners = new Set<() => void>();

function load(): State {
  if (typeof window === "undefined") {
    return { comments: seedComments, files: seedFiles, activity: seedActivity };
  }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { comments: seedComments, files: seedFiles, activity: seedActivity };
    const parsed = JSON.parse(raw) as State;
    return {
      comments: parsed.comments ?? [],
      files: parsed.files ?? [],
      activity: parsed.activity ?? [],
    };
  } catch {
    return { comments: seedComments, files: seedFiles, activity: seedActivity };
  }
}

let state: State = load();

function persist() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* quota — ignore */
  }
}

function emit() {
  persist();
  listeners.forEach((l) => l());
}

function nextId(prefix: string) {
  return `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

function pushActivity(a: Omit<TaskCommActivity, "id" | "at"> & { at?: string }) {
  state = {
    ...state,
    activity: [...state.activity, { ...a, id: nextId("a"), at: a.at ?? new Date().toISOString() }],
  };
}

// ----- Public store API -------------------------------------------------

export const commStore = {
  getSnapshot: () => state,
  subscribe(cb: () => void) {
    listeners.add(cb);
    return () => listeners.delete(cb);
  },

  addComment(input: {
    taskId: string;
    userId: string;
    message: string;
    parentCommentId?: string | null;
  }): TaskThreadComment {
    const mentions = extractMentions(input.message, MENTIONABLE_USERS);
    const now = new Date().toISOString();
    const comment: TaskThreadComment = {
      id: nextId("tc"),
      taskId: input.taskId,
      userId: input.userId,
      message: input.message,
      parentCommentId: input.parentCommentId ?? null,
      mentions,
      reactions: [],
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    };
    state = { ...state, comments: [...state.comments, comment] };
    pushActivity({
      taskId: input.taskId,
      actorId: input.userId,
      kind: "comment_added",
      summary: input.parentCommentId ? "replied to a comment" : "added a comment",
      refId: comment.id,
    });
    emit();

    // UI-only notifications
    const author = employeeById(input.userId)?.name ?? "Someone";
    toast(`${author} commented`, {
      description: input.message.slice(0, 120),
    });
    if (mentions.length) {
      const names = mentions
        .map((id) => employeeById(id)?.name)
        .filter(Boolean)
        .join(", ");
      toast.success(`Mention sent to ${names}`);
    }
    return comment;
  },

  editComment(commentId: string, message: string) {
    state = {
      ...state,
      comments: state.comments.map((c) =>
        c.id === commentId
          ? {
              ...c,
              message,
              mentions: extractMentions(message, MENTIONABLE_USERS),
              updatedAt: new Date().toISOString(),
            }
          : c,
      ),
    };
    const c = state.comments.find((x) => x.id === commentId);
    if (c) {
      pushActivity({
        taskId: c.taskId,
        actorId: c.userId,
        kind: "comment_edited",
        summary: "edited a comment",
        refId: c.id,
      });
    }
    emit();
  },

  deleteComment(commentId: string) {
    const c = state.comments.find((x) => x.id === commentId);
    if (!c) return;
    state = {
      ...state,
      comments: state.comments.map((x) =>
        x.id === commentId ? { ...x, deletedAt: new Date().toISOString(), message: "" } : x,
      ),
    };
    pushActivity({
      taskId: c.taskId,
      actorId: c.userId,
      kind: "comment_deleted",
      summary: "deleted a comment",
      refId: c.id,
    });
    emit();
  },

  toggleReaction(commentId: string, emoji: string, userId: string) {
    state = {
      ...state,
      comments: state.comments.map((c) => {
        if (c.id !== commentId) return c;
        const existing = c.reactions.find((r) => r.emoji === emoji);
        let reactions: typeof c.reactions;
        if (!existing) {
          reactions = [...c.reactions, { emoji, userIds: [userId] }];
        } else {
          const has = existing.userIds.includes(userId);
          const next = has
            ? existing.userIds.filter((u) => u !== userId)
            : [...existing.userIds, userId];
          reactions = c.reactions
            .map((r) => (r.emoji === emoji ? { ...r, userIds: next } : r))
            .filter((r) => r.userIds.length > 0);
        }
        return { ...c, reactions };
      }),
    };
    emit();
  },

  addFile(input: {
    taskId: string;
    userId: string;
    fileName: string;
    fileType: string;
    fileSize: number;
    previewUrl?: string | null;
    kind?: FileKind;
  }): TaskFile {
    const file: TaskFile = {
      id: nextId("tf"),
      taskId: input.taskId,
      fileName: input.fileName,
      fileType: input.fileType,
      kind: input.kind ?? kindFromName(input.fileName, input.fileType),
      fileSize: input.fileSize,
      uploadedBy: input.userId,
      uploadedAt: new Date().toISOString(),
      previewUrl: input.previewUrl ?? null,
    };
    state = { ...state, files: [...state.files, file] };
    pushActivity({
      taskId: input.taskId,
      actorId: input.userId,
      kind: "file_uploaded",
      summary: `uploaded ${file.fileName}`,
      refId: file.id,
    });
    emit();
    const author = employeeById(input.userId)?.name ?? "Someone";
    toast.success(`${author} uploaded ${file.fileName}`);
    return file;
  },

  deleteFile(fileId: string) {
    const f = state.files.find((x) => x.id === fileId);
    if (!f) return;
    if (f.previewUrl?.startsWith("blob:")) {
      try {
        URL.revokeObjectURL(f.previewUrl);
      } catch {
        /* ignore */
      }
    }
    state = { ...state, files: state.files.filter((x) => x.id !== fileId) };
    pushActivity({
      taskId: f.taskId,
      actorId: f.uploadedBy,
      kind: "file_deleted",
      summary: `deleted ${f.fileName}`,
      refId: f.id,
    });
    emit();
  },
};

// ----- Reactive selector hook ------------------------------------------

export function useCommState<T>(selector: (s: State) => T): T {
  return useSyncExternalStore(
    commStore.subscribe,
    () => selector(commStore.getSnapshot()),
    () => selector(commStore.getSnapshot()),
  );
}

// Convenience selectors
export const selectTaskComments = (taskId: string) => (s: State) =>
  s.comments.filter((c) => c.taskId === taskId);
export const selectTaskFiles = (taskId: string) => (s: State) =>
  s.files.filter((f) => f.taskId === taskId);
export const selectTaskCommActivity = (taskId: string) => (s: State) =>
  s.activity.filter((a) => a.taskId === taskId);
