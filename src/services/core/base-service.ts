import type { z } from "zod";

import { db } from "./client";
import { notFound, toServiceError } from "./errors";
import type { Identifiable, ListParams, PageParams, Paginated } from "./types";
import { validate } from "@/lib/security/validate";

/**
 * Generic CRUD foundation for every domain service.
 *
 * A concrete service declares its table name and row/insert/update shapes, then
 * inherits a clean, uniform CRUD surface. Domain-specific reads and mutations
 * are added as extra methods on the subclass — the shared verbs never need to be
 * re-implemented.
 *
 * ```ts
 * class ProjectsService extends BaseService<Project, ProjectInsert, ProjectUpdate> {
 *   protected readonly table = "projects";
 *   protected readonly entity = "Project";
 * }
 * ```
 *
 * All persistence flows through the relaxed {@link db} client so services can
 * target tables that are not yet in the generated `Database` types, while keeping
 * every loose cast contained to {@link ./client}.
 */
export abstract class BaseService<
  Row extends Identifiable,
  Insert = Partial<Row>,
  Update = Partial<Row>,
> {
  /** Supabase table this service is bound to. */
  protected abstract readonly table: string;
  /** Human-readable entity name used in error messages. */
  protected abstract readonly entity: string;
  /** Default column used to order `list` results. */
  protected readonly defaultOrderBy: string = "created_at";

  /**
   * Optional write-validation schemas. When a subclass sets these, every
   * `create`/`createMany`/`update`/`upsert` runs input through the schema before
   * it reaches Supabase, throwing {@link ValidationError} on bad input. Leaving
   * them undefined preserves the previous (unvalidated) behavior, so existing
   * services are unaffected until they opt in.
   */
  protected readonly insertSchema?: z.ZodType<Insert>;
  protected readonly updateSchema?: z.ZodType<Update>;

  /** Shared relaxed client; subclasses may use it for custom queries. */
  protected get client() {
    return db;
  }

  /** Validate an insert payload when an `insertSchema` is declared. */
  protected validateInsert(input: Insert): Insert {
    return this.insertSchema ? validate(this.insertSchema, input, this.entity) : input;
  }

  /** Validate an update payload when an `updateSchema` is declared. */
  protected validateUpdate(patch: Update): Update {
    return this.updateSchema ? validate(this.updateSchema, patch, this.entity) : patch;
  }

  /** List rows with optional equality filters, ordering and pagination. */
  async list(params: ListParams<Row> = {}): Promise<Row[]> {
    try {
      let query = this.client.from(this.table).select(params.select ?? "*");

      for (const [column, value] of Object.entries(params.filters ?? {})) {
        if (value !== undefined) query = query.eq(column, value as never);
      }

      query = query.order(params.orderBy ?? this.defaultOrderBy, {
        ascending: params.direction === "asc",
      });

      if (typeof params.limit === "number") {
        const offset = params.offset ?? 0;
        query = query.range(offset, offset + params.limit - 1);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as unknown as Row[];
    } catch (error) {
      throw toServiceError(error, `Failed to list ${this.entity}`);
    }
  }

  /** List rows with an exact total count, page-addressed. */
  async paginate(params: PageParams<Row>): Promise<Paginated<Row>> {
    try {
      const from = params.page * params.pageSize;
      const to = from + params.pageSize - 1;

      let query = this.client.from(this.table).select(params.select ?? "*", { count: "exact" });

      for (const [column, value] of Object.entries(params.filters ?? {})) {
        if (value !== undefined) query = query.eq(column, value as never);
      }

      query = query
        .order(params.orderBy ?? this.defaultOrderBy, {
          ascending: params.direction === "asc",
        })
        .range(from, to);

      const { data, error, count } = await query;
      if (error) throw error;
      return {
        rows: (data ?? []) as unknown as Row[],
        count: count ?? 0,
        page: params.page,
        pageSize: params.pageSize,
      };
    } catch (error) {
      throw toServiceError(error, `Failed to list ${this.entity}`);
    }
  }

  /** Fetch a single row by id, or `null` when absent. */
  async getById(id: string, select = "*"): Promise<Row | null> {
    try {
      const { data, error } = await this.client
        .from(this.table)
        .select(select)
        .eq("id", id)
        .maybeSingle();
      if (error) throw error;
      return (data as unknown as Row | null) ?? null;
    } catch (error) {
      throw toServiceError(error, `Failed to load ${this.entity}`);
    }
  }

  /** Fetch a single row by id, throwing {@link ServiceError} if missing. */
  async getByIdOrThrow(id: string, select = "*"): Promise<Row> {
    const row = await this.getById(id, select);
    if (!row) throw notFound(this.entity, id);
    return row;
  }

  /** Insert one row and return the created record. */
  async create(input: Insert): Promise<Row> {
    try {
      const payload = this.validateInsert(input);
      const { data, error } = await this.client
        .from(this.table)
        .insert(payload as never)
        .select()
        .single();
      if (error) throw error;
      return data as unknown as Row;
    } catch (error) {
      throw toServiceError(error, `Failed to create ${this.entity}`);
    }
  }

  /** Insert many rows in a single round-trip. */
  async createMany(input: Insert[]): Promise<Row[]> {
    try {
      const payload = input.map((row) => this.validateInsert(row));
      const { data, error } = await this.client
        .from(this.table)
        .insert(payload as never)
        .select();
      if (error) throw error;
      return (data ?? []) as unknown as Row[];
    } catch (error) {
      throw toServiceError(error, `Failed to create ${this.entity}`);
    }
  }

  /** Patch a row by id and return the updated record. */
  async update(id: string, patch: Update): Promise<Row> {
    try {
      const validated = this.validateUpdate(patch);
      const { data, error } = await this.client
        .from(this.table)
        .update(validated as never)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data as unknown as Row;
    } catch (error) {
      throw toServiceError(error, `Failed to update ${this.entity}`);
    }
  }

  /** Insert or update a row on its primary key. */
  async upsert(input: Insert | Update): Promise<Row> {
    try {
      // Upsert carries a full row shape; validate against the insert schema.
      const payload = this.insertSchema ? validate(this.insertSchema, input, this.entity) : input;
      const { data, error } = await this.client
        .from(this.table)
        .upsert(payload as never)
        .select()
        .single();
      if (error) throw error;
      return data as unknown as Row;
    } catch (error) {
      throw toServiceError(error, `Failed to save ${this.entity}`);
    }
  }

  /** Hard-delete a row by id. */
  async remove(id: string): Promise<void> {
    try {
      const { error } = await this.client.from(this.table).delete().eq("id", id);
      if (error) throw error;
    } catch (error) {
      throw toServiceError(error, `Failed to delete ${this.entity}`);
    }
  }

  /** Count rows matching optional equality filters. */
  async count(filters: ListParams<Row>["filters"] = {}): Promise<number> {
    try {
      let query = this.client.from(this.table).select("id", { count: "exact", head: true });
      for (const [column, value] of Object.entries(filters)) {
        if (value !== undefined) query = query.eq(column, value as never);
      }
      const { count, error } = await query;
      if (error) throw error;
      return count ?? 0;
    } catch (error) {
      throw toServiceError(error, `Failed to count ${this.entity}`);
    }
  }
}
