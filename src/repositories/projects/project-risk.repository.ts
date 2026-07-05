import type { ListParams } from "@/services/core";
import {
  ProjectActivityService,
  projectActivityService,
  ProjectRisksService,
  projectRisksService,
  type ProjectRiskInsert,
  type ProjectRiskRow,
  type ProjectRiskUpdate,
  type RiskStatus,
} from "@/services/projects";

/**
 * ProjectRiskRepository — the project risk register over `project_risks`. Risks
 * may link to a milestone and/or a `dependency_requests` row. Raising/resolving
 * a risk is recorded in the project activity feed.
 */
export class ProjectRiskRepository {
  constructor(
    private readonly service: ProjectRisksService = projectRisksService,
    private readonly activity: ProjectActivityService = projectActivityService,
  ) {}

  listForProject(
    projectId: string,
    params: ListParams<ProjectRiskRow> = {},
  ): Promise<ProjectRiskRow[]> {
    return this.service.listByProject(projectId, params);
  }

  /** Open risks for a project (not resolved/closed). */
  listOpen(projectId: string): Promise<ProjectRiskRow[]> {
    return this.service.listOpen(projectId);
  }

  getById(id: string): Promise<ProjectRiskRow | null> {
    return this.service.getById(id);
  }

  async raise(input: ProjectRiskInsert): Promise<ProjectRiskRow> {
    const risk = await this.service.create(input);
    await this.activity.log({
      project_id: risk.project_id,
      type: "risk_raised",
      summary: `Risk “${risk.title}” raised`,
      meta: { risk_id: risk.id, severity: risk.severity },
    });
    return risk;
  }

  update(id: string, patch: ProjectRiskUpdate): Promise<ProjectRiskRow> {
    return this.service.update(id, patch);
  }

  setStatus(id: string, status: RiskStatus): Promise<ProjectRiskRow> {
    return this.service.setStatus(id, status);
  }

  /** Resolve a risk (stamps `resolved_at`, logs `risk_resolved`). */
  async resolve(id: string): Promise<ProjectRiskRow> {
    const risk = await this.service.setStatus(id, "resolved");
    await this.activity.log({
      project_id: risk.project_id,
      type: "risk_resolved",
      summary: `Risk “${risk.title}” resolved`,
      meta: { risk_id: id },
    });
    return risk;
  }

  remove(id: string): Promise<void> {
    return this.service.remove(id);
  }
}

/** Shared singleton — import this, not the class. */
export const projectRiskRepository = new ProjectRiskRepository();
