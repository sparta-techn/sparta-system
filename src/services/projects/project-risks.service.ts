import { BaseService } from "../core/base-service";
import type { ListParams } from "../core/types";
import type { ProjectRiskInsert, ProjectRiskRow, ProjectRiskUpdate, RiskStatus } from "./types";

/** Risk statuses that count as no-longer-open (stamp `resolved_at`). */
const RESOLVED_STATES: RiskStatus[] = ["resolved", "closed"];
/** Risk statuses that count as still-open. */
const OPEN_STATES: RiskStatus[] = ["open", "mitigating", "accepted"];

/**
 * ProjectRisksService — the project risk register (`project_risks`). A risk may
 * link to a milestone and/or a `dependency_requests` row. Reaching
 * resolved/closed stamps `resolved_at`; reopening clears it.
 */
export class ProjectRisksService extends BaseService<
  ProjectRiskRow,
  ProjectRiskInsert,
  ProjectRiskUpdate
> {
  protected readonly table = "project_risks";
  protected readonly entity = "Project risk";
  protected readonly defaultOrderBy = "created_at";

  /** Risks of a project. */
  listByProject(
    projectId: string,
    params: ListParams<ProjectRiskRow> = {},
  ): Promise<ProjectRiskRow[]> {
    return this.list({ ...params, filters: { ...params.filters, project_id: projectId } });
  }

  /** Risks filtered by status. */
  listByStatus(
    status: RiskStatus,
    params: ListParams<ProjectRiskRow> = {},
  ): Promise<ProjectRiskRow[]> {
    return this.list({ ...params, filters: { ...params.filters, status } });
  }

  /** Open risks for a project (not resolved/closed). */
  async listOpen(projectId: string): Promise<ProjectRiskRow[]> {
    const rows = await this.listByProject(projectId);
    return rows.filter((r) => OPEN_STATES.includes(r.status));
  }

  /** Transition a risk's status, maintaining `resolved_at`. */
  setStatus(id: string, status: RiskStatus): Promise<ProjectRiskRow> {
    return this.update(id, {
      status,
      resolved_at: RESOLVED_STATES.includes(status) ? new Date().toISOString() : null,
    });
  }
}

/** Shared singleton — import this, not the class. */
export const projectRisksService = new ProjectRisksService();
