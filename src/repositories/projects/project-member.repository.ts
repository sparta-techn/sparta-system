import type { ListParams } from "@/services/core";
import {
  ProjectActivityService,
  projectActivityService,
  ProjectMembersService,
  projectMembersService,
  ProjectRolesService,
  projectRolesService,
  type ProjectMemberRow,
} from "@/services/projects";

/**
 * ProjectMemberRepository — member assignment over `project_members`. Resolves
 * roles from the `project_roles` catalog and records add/remove in the project
 * activity feed.
 */
export class ProjectMemberRepository {
  constructor(
    private readonly members: ProjectMembersService = projectMembersService,
    private readonly roles: ProjectRolesService = projectRolesService,
    private readonly activity: ProjectActivityService = projectActivityService,
  ) {}

  listMembers(
    projectId: string,
    params: ListParams<ProjectMemberRow> = {},
  ): Promise<ProjectMemberRow[]> {
    return this.members.listByProject(projectId, params);
  }

  listMembershipsForUser(userId: string): Promise<ProjectMemberRow[]> {
    return this.members.listByUser(userId);
  }

  getMembership(projectId: string, userId: string): Promise<ProjectMemberRow | null> {
    return this.members.getMembership(projectId, userId);
  }

  /** Assign a user to a project with an explicit project-role id (or none). */
  async assign(
    projectId: string,
    userId: string,
    projectRoleId: string | null = null,
  ): Promise<ProjectMemberRow> {
    const member = await this.members.create({
      project_id: projectId,
      user_id: userId,
      project_role_id: projectRoleId,
    });
    await this.activity.log({
      project_id: projectId,
      type: "member_added",
      summary: "Member added to project",
      meta: { user_id: userId, project_role_id: projectRoleId },
    });
    return member;
  }

  /** Assign a user by role slug (e.g. `lead`, `contributor`). */
  async assignByRole(
    projectId: string,
    userId: string,
    roleSlug: string,
  ): Promise<ProjectMemberRow> {
    const role = await this.roles.getBySlug(roleSlug);
    return this.assign(projectId, userId, role?.id ?? null);
  }

  /** Change a member's project role. */
  setRole(memberId: string, projectRoleId: string | null): Promise<ProjectMemberRow> {
    return this.members.setRole(memberId, projectRoleId);
  }

  /** Remove a user from a project (logs `member_removed`). */
  async remove(projectId: string, userId: string): Promise<void> {
    const membership = await this.members.getMembership(projectId, userId);
    if (!membership) return;
    await this.members.remove(membership.id);
    await this.activity.log({
      project_id: projectId,
      type: "member_removed",
      summary: "Member removed from project",
      meta: { user_id: userId },
    });
  }
}

/** Shared singleton — import this, not the class. */
export const projectMemberRepository = new ProjectMemberRepository();
