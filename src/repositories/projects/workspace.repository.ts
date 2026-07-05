import {
  WorkspaceService,
  workspaceService,
  type WorkspaceSettings,
  type WorkspaceSettingsUpdate,
} from "@/services/projects";

/**
 * WorkspaceRepository — read/update the singleton workspace configuration
 * (`company_settings`). Delegates to {@link WorkspaceService}; shared with the
 * Attendance module (single source of truth).
 */
export class WorkspaceRepository {
  constructor(private readonly service: WorkspaceService = workspaceService) {}

  /** The workspace settings singleton. */
  get(): Promise<WorkspaceSettings> {
    return this.service.get();
  }

  /** Patch the workspace settings singleton. */
  update(patch: WorkspaceSettingsUpdate): Promise<WorkspaceSettings> {
    return this.service.update(patch);
  }
}

/** Shared singleton — import this, not the class. */
export const workspaceRepository = new WorkspaceRepository();
