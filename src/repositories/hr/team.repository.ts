import type { ListParams } from "@/services/core";
import {
  TeamsService,
  teamsService,
  type Team,
  type TeamInsert,
  type TeamUpdate,
} from "@/services/hr";

/**
 * TeamRepository — domain operations for teams. Delegates persistence to
 * {@link TeamsService} and frames the access patterns (by department, active,
 * archive) the UI consumes.
 */
export class TeamRepository {
  constructor(private readonly service: TeamsService = teamsService) {}

  list(params: ListParams<Team> = {}): Promise<Team[]> {
    return this.service.list(params);
  }

  listActive(): Promise<Team[]> {
    return this.service.listActive();
  }

  listByDepartment(departmentId: string, params: ListParams<Team> = {}): Promise<Team[]> {
    return this.service.listByDepartment(departmentId, params);
  }

  getById(id: string): Promise<Team | null> {
    return this.service.getById(id);
  }

  getByIdOrThrow(id: string): Promise<Team> {
    return this.service.getByIdOrThrow(id);
  }

  getBySlug(slug: string): Promise<Team | null> {
    return this.service.getBySlug(slug);
  }

  create(input: TeamInsert): Promise<Team> {
    return this.service.create(input);
  }

  update(id: string, patch: TeamUpdate): Promise<Team> {
    return this.service.update(id, patch);
  }

  setLead(id: string, leadId: string | null): Promise<Team> {
    return this.service.setLead(id, leadId);
  }

  archive(id: string): Promise<Team> {
    return this.service.archive(id);
  }

  restore(id: string): Promise<Team> {
    return this.service.restore(id);
  }

  remove(id: string): Promise<void> {
    return this.service.remove(id);
  }
}

/** Shared singleton — import this, not the class. */
export const teamRepository = new TeamRepository();
