import { memo } from "react";
import { StatusBadge } from "@/components/status-badge";
import {
  LABEL_TONE,
  PRIORITY_LABEL,
  PRIORITY_TONE,
  STATUS_LABEL,
  STATUS_TONE,
  type TaskLabel,
  type TaskPriority,
  type TaskStatus,
} from "../types";

// Single-primitive-prop badges rendered in every task row/card/board — memoized.
export const TaskStatusBadge = memo(function TaskStatusBadge({ status }: { status: TaskStatus }) {
  return <StatusBadge tone={STATUS_TONE[status]} label={STATUS_LABEL[status]} withDot />;
});

export const TaskPriorityBadge = memo(function TaskPriorityBadge({ priority }: { priority: TaskPriority }) {
  return <StatusBadge tone={PRIORITY_TONE[priority]} label={PRIORITY_LABEL[priority]} withDot={false} />;
});

export const TaskLabelChip = memo(function TaskLabelChip({ label }: { label: TaskLabel }) {
  return <StatusBadge tone={LABEL_TONE[label]} label={label} withDot={false} size="sm" />;
});
