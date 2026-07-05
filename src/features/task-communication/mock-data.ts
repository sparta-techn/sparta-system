import { seedTasks } from "@/features/tasks/mock-data";
import type { TaskCommActivity, TaskFile, TaskThreadComment } from "./types";

const T = seedTasks.slice(0, 12).map((t) => t.id);
const day = (d: number, h = 9) =>
  new Date(Date.now() - d * 86_400_000 + h * 3_600_000).toISOString();

function c(
  id: string,
  taskIdx: number,
  userId: string,
  message: string,
  daysAgo: number,
  parentCommentId: string | null = null,
  mentions: string[] = [],
  reactions: TaskThreadComment["reactions"] = [],
): TaskThreadComment {
  const at = day(daysAgo);
  return {
    id,
    taskId: T[taskIdx],
    userId,
    message,
    parentCommentId,
    mentions,
    reactions,
    createdAt: at,
    updatedAt: at,
    deletedAt: null,
  };
}

export const seedComments: TaskThreadComment[] = T.length === 0
  ? []
  : [
      c("tc_001", 0, "emp_002", "Kicking this off — pulled the spec from Notion. @emp001 can you review the schema before I code?", 3, null, ["emp_001"], [
        { emoji: "👍", userIds: ["emp_001", "emp_003"] },
      ]),
      c("tc_002", 0, "emp_001", "Looked it over. Two things:\n1. Add an `audit_id` FK\n2. Index `created_at`", 2, "tc_001"),
      c("tc_003", 0, "emp_002", "Done. Pushed migration to the branch.", 1, "tc_001", [], [
        { emoji: "🚀", userIds: ["emp_001"] },
      ]),
      c("tc_004", 0, "emp_004", "Nice — I'll wire the UI once this lands.", 1, null),

      c("tc_010", 1, "emp_003", "Blocked on the design tokens. @emp005 any update?", 4, null, ["emp_005"]),
      c("tc_011", 1, "emp_005", "Tokens shipped this morning. Pull latest from main.", 3, "tc_010", [], [
        { emoji: "🎉", userIds: ["emp_003", "emp_002"] },
      ]),
      c("tc_012", 1, "emp_003", "Unblocked, thanks!", 3, "tc_010"),

      c("tc_020", 2, "emp_006", "First pass attached. Feedback welcome.", 5),
      c("tc_021", 2, "emp_001", "Loving the empty state. Tiny nit — the icon weight feels heavy.", 4, "tc_020"),
      c("tc_022", 2, "emp_006", "Switched to the lucide line variant.", 2, "tc_020", [], [
        { emoji: "❤️", userIds: ["emp_001"] },
      ]),

      c("tc_030", 3, "emp_007", "QA pass: 3 minor issues, 0 blockers. Notes in the doc.", 1),
      c("tc_031", 4, "emp_002", "@emp008 mind taking the review pass?", 2, null, ["emp_008"]),
      c("tc_032", 4, "emp_008", "On it after standup.", 1, "tc_031"),

      c("tc_040", 5, "emp_001", "Heads up — scope might creep here. Let's timebox to 1 day.", 6),
      c("tc_050", 6, "emp_004", "Closing this one out — verified in staging.", 0, null, [], [
        { emoji: "✅", userIds: ["emp_001", "emp_002"] },
      ]),
    ];

function f(
  id: string,
  taskIdx: number,
  fileName: string,
  fileType: string,
  kind: TaskFile["kind"],
  fileSize: number,
  uploadedBy: string,
  daysAgo: number,
): TaskFile {
  return {
    id,
    taskId: T[taskIdx],
    fileName,
    fileType,
    kind,
    fileSize,
    uploadedBy,
    uploadedAt: day(daysAgo),
    previewUrl: null,
  };
}

export const seedFiles: TaskFile[] = T.length === 0
  ? []
  : [
      f("tf_001", 0, "schema-v2.sql", "application/sql", "code", 8_421, "emp_002", 2),
      f("tf_002", 0, "review-notes.pdf", "application/pdf", "pdf", 412_998, "emp_001", 2),
      f("tf_003", 0, "audit-flow.png", "image/png", "image", 1_204_311, "emp_002", 1),
      f("tf_010", 1, "tokens-cheatsheet.pdf", "application/pdf", "pdf", 287_551, "emp_005", 3),
      f("tf_011", 1, "spec.docx", "application/msword", "doc", 64_201, "emp_003", 4),
      f("tf_020", 2, "design-v3.png", "image/png", "image", 2_881_433, "emp_006", 5),
      f("tf_021", 2, "design-source.zip", "application/zip", "zip", 18_440_120, "emp_006", 5),
      f("tf_030", 3, "qa-report.pdf", "application/pdf", "pdf", 521_004, "emp_007", 1),
      f("tf_040", 5, "scope-notes.md", "text/markdown", "doc", 4_410, "emp_001", 6),
      f("tf_050", 6, "release-evidence.png", "image/png", "image", 988_201, "emp_004", 0),
    ];

export const seedActivity: TaskCommActivity[] = [
  ...seedComments
    .filter((c) => !c.parentCommentId)
    .map<TaskCommActivity>((c) => ({
      id: `a_${c.id}`,
      taskId: c.taskId,
      actorId: c.userId,
      kind: "comment_added",
      summary: c.parentCommentId ? "replied to a comment" : "added a comment",
      at: c.createdAt,
      refId: c.id,
    })),
  ...seedFiles.map<TaskCommActivity>((f) => ({
    id: `a_${f.id}`,
    taskId: f.taskId,
    actorId: f.uploadedBy,
    kind: "file_uploaded",
    summary: `uploaded ${f.fileName}`,
    at: f.uploadedAt,
    refId: f.id,
  })),
];
