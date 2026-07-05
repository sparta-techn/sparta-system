import type { ListParams } from "@/services/core";
import {
  PositionsService,
  positionsService,
  type Position,
  type PositionInsert,
  type PositionUpdate,
} from "@/services/hr";

/**
 * PositionRepository — domain operations for the job-title catalog. Delegates
 * persistence to {@link PositionsService}.
 */
export class PositionRepository {
  constructor(private readonly service: PositionsService = positionsService) {}

  list(params: ListParams<Position> = {}): Promise<Position[]> {
    return this.service.list(params);
  }

  listActive(params: ListParams<Position> = {}): Promise<Position[]> {
    return this.service.listActive(params);
  }

  listByDepartment(departmentId: string, params: ListParams<Position> = {}): Promise<Position[]> {
    return this.service.listByDepartment(departmentId, params);
  }

  getById(id: string): Promise<Position | null> {
    return this.service.getById(id);
  }

  getByIdOrThrow(id: string): Promise<Position> {
    return this.service.getByIdOrThrow(id);
  }

  getBySlug(slug: string): Promise<Position | null> {
    return this.service.getBySlug(slug);
  }

  create(input: PositionInsert): Promise<Position> {
    return this.service.create(input);
  }

  update(id: string, patch: PositionUpdate): Promise<Position> {
    return this.service.update(id, patch);
  }

  setActive(id: string, isActive: boolean): Promise<Position> {
    return this.service.setActive(id, isActive);
  }

  archive(id: string): Promise<Position> {
    return this.service.archive(id);
  }

  remove(id: string): Promise<void> {
    return this.service.remove(id);
  }
}

/** Shared singleton — import this, not the class. */
export const positionRepository = new PositionRepository();
