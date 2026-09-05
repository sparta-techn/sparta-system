import { useMemo, useState } from "react";
import { ChevronDown, Lock, Search } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { PermissionScope, RbacPermission } from "@/services/rbac";

import {
  bulkState,
  type BulkState,
  distinctActions,
  groupByModule,
  idsForAction,
  idsForScope,
  actionLabel,
  SCOPE_HINTS,
  SCOPE_LABELS,
  SCOPE_ORDER,
  toggleMany,
} from "../permission-tree";

interface PermissionPickerProps {
  catalog: RbacPermission[];
  selected: Set<string>;
  onChange: (next: Set<string>) => void;
  /** Protected roles render the whole tree read-only. */
  disabled?: boolean;
}

/**
 * The module → action → scope permission picker.
 *
 * 123 catalog rows is far too many to work through one checkbox at a time, so
 * selection is driven by bulk controls at three levels: whole catalog, one
 * action across every module ("all view permissions"), one scope tier, and one
 * module. Individual cells remain available for fine tuning.
 */
export function PermissionPicker({
  catalog,
  selected,
  onChange,
  disabled = false,
}: PermissionPickerProps) {
  const [query, setQuery] = useState("");
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  const groups = useMemo(() => groupByModule(catalog), [catalog]);
  const actions = useMemo(() => distinctActions(catalog), [catalog]);
  const allIds = useMemo(() => catalog.map((p) => p.id), [catalog]);

  const visibleGroups = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return groups;
    return groups
      .map((g) => ({
        ...g,
        actions: g.actions.filter(
          (a) => g.label.toLowerCase().includes(q) || a.label.toLowerCase().includes(q),
        ),
      }))
      .filter((g) => g.actions.length > 0);
  }, [groups, query]);

  const apply = (ids: string[], select: boolean) => {
    if (disabled) return;
    onChange(toggleMany(selected, ids, select));
  };

  const toggleCollapse = (module: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(module)) next.delete(module);
      else next.add(module);
      return next;
    });
  };

  const overall = bulkState(selected, allIds);

  return (
    <div className="space-y-4">
      {/* ------------------------------------------------ global bulk controls */}
      <div className="rounded-lg border bg-surface/60 p-3 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <label className="flex items-center gap-2 text-sm font-medium">
            <Checkbox
              checked={checkedValue(overall)}
              disabled={disabled}
              onCheckedChange={(v) => apply(allIds, v === true)}
            />
            Select everything
            <Badge variant="secondary" className="tabular-nums">
              {selected.size} / {allIds.length}
            </Badge>
          </label>
          <div className="relative w-full max-w-56">
            <Search className="pointer-events-none absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Filter modules…"
              className="h-8 pl-7 text-xs"
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <BulkRow label="By action">
            {actions.map((action) => {
              const ids = idsForAction(catalog, action);
              const state = bulkState(selected, ids);
              return (
                <BulkChip
                  key={action}
                  label={actionLabel(action)}
                  state={state}
                  disabled={disabled}
                  onClick={() => apply(ids, state !== "all")}
                />
              );
            })}
          </BulkRow>

          <BulkRow label="By scope">
            {SCOPE_ORDER.map((scope) => {
              const ids = idsForScope(catalog, scope);
              if (ids.length === 0) return null;
              const state = bulkState(selected, ids);
              return (
                <Tooltip key={scope}>
                  <TooltipTrigger asChild>
                    <span>
                      <BulkChip
                        label={SCOPE_LABELS[scope]}
                        state={state}
                        disabled={disabled}
                        onClick={() => apply(ids, state !== "all")}
                      />
                    </span>
                  </TooltipTrigger>
                  <TooltipContent>{SCOPE_HINTS[scope]}</TooltipContent>
                </Tooltip>
              );
            })}
          </BulkRow>
        </div>
      </div>

      {/* --------------------------------------------------- module sections */}
      <div className="space-y-2">
        {visibleGroups.map((group) => {
          const state = bulkState(selected, group.allIds);
          const isCollapsed = collapsed.has(group.module);
          const count = group.allIds.filter((id) => selected.has(id)).length;

          return (
            <section key={group.module} className="rounded-lg border">
              <header className="flex items-center gap-3 px-3 py-2">
                <Checkbox
                  checked={checkedValue(state)}
                  disabled={disabled}
                  aria-label={`Select all ${group.label} permissions`}
                  onCheckedChange={(v) => apply(group.allIds, v === true)}
                />
                <button
                  type="button"
                  onClick={() => toggleCollapse(group.module)}
                  className="flex flex-1 items-center gap-2 text-left"
                >
                  <span className="text-sm font-medium">{group.label}</span>
                  <Badge variant={count > 0 ? "secondary" : "outline"} className="tabular-nums">
                    {count} / {group.allIds.length}
                  </Badge>
                  <ChevronDown
                    className={cn(
                      "ml-auto size-4 text-muted-foreground transition-transform",
                      isCollapsed && "-rotate-90",
                    )}
                  />
                </button>
              </header>

              {!isCollapsed ? (
                <div className="divide-y border-t">
                  {group.actions.map((row) => {
                    const rowIds = row.cells.map((c) => c.id);
                    const rowState = bulkState(selected, rowIds);
                    return (
                      <div
                        key={row.action}
                        className="flex flex-wrap items-center gap-x-4 gap-y-2 px-3 py-2"
                      >
                        <label className="flex w-40 shrink-0 items-center gap-2 text-sm">
                          <Checkbox
                            checked={checkedValue(rowState)}
                            disabled={disabled}
                            onCheckedChange={(v) => apply(rowIds, v === true)}
                          />
                          {row.label}
                        </label>
                        <div className="flex flex-wrap items-center gap-3">
                          {row.cells.map((cell) => (
                            <ScopeCell
                              key={cell.id}
                              scope={cell.scope}
                              checked={selected.has(cell.id)}
                              disabled={disabled}
                              onToggle={(v) => apply([cell.id], v)}
                            />
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : null}
            </section>
          );
        })}

        {visibleGroups.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            No modules match “{query}”.
          </p>
        ) : null}
      </div>

      {disabled ? (
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Lock className="size-3" />
          This role is protected — its permissions are fixed and cannot be edited.
        </p>
      ) : null}
    </div>
  );
}

/** Map a tri-state to the Radix `checked` prop. */
function checkedValue(state: BulkState): boolean | "indeterminate" {
  if (state === "all") return true;
  if (state === "partial") return "indeterminate";
  return false;
}

function BulkRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      {children}
    </div>
  );
}

function BulkChip({
  label,
  state,
  disabled,
  onClick,
}: {
  label: string;
  state: "none" | "partial" | "all";
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <Button
      type="button"
      size="sm"
      variant={state === "all" ? "default" : "outline"}
      disabled={disabled}
      onClick={onClick}
      className={cn("h-6 rounded-full px-2.5 text-xs", state === "partial" && "border-primary")}
    >
      {label}
      {state === "partial" ? <span className="ml-1 text-primary">•</span> : null}
    </Button>
  );
}

function ScopeCell({
  scope,
  checked,
  disabled,
  onToggle,
}: {
  scope: PermissionScope;
  checked: boolean;
  disabled?: boolean;
  onToggle: (checked: boolean) => void;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <label
          className={cn(
            "flex cursor-pointer items-center gap-1.5 rounded-md border px-2 py-1 text-xs",
            checked ? "border-primary bg-primary-soft" : "border-transparent bg-muted/50",
            disabled && "cursor-not-allowed opacity-60",
          )}
        >
          <Checkbox
            checked={checked}
            disabled={disabled}
            onCheckedChange={(v) => onToggle(v === true)}
            className="size-3.5"
          />
          {SCOPE_LABELS[scope]}
        </label>
      </TooltipTrigger>
      <TooltipContent>{SCOPE_HINTS[scope]}</TooltipContent>
    </Tooltip>
  );
}
