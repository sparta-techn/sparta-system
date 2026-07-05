/**
 * Shared shapes for the service layer. Kept intentionally small and generic so
 * every service speaks the same query/pagination vocabulary.
 */

/** A row that can be addressed by an `id` primary key (UUID). */
export interface Identifiable {
  id: string;
}

export type SortDirection = "asc" | "desc";

/** Equality filters keyed by column name. */
export type Filters<Row> = Partial<Record<keyof Row & string, unknown>>;

/** Parameters accepted by every `list` method. */
export interface ListParams<Row> {
  /** Equality filters applied with `.eq(...)`. */
  filters?: Filters<Row>;
  /** Column to order by. */
  orderBy?: (keyof Row & string) | string;
  /** Sort direction; defaults to `desc`. */
  direction?: SortDirection;
  /** Max rows to return. */
  limit?: number;
  /** Row offset for manual pagination. */
  offset?: number;
  /** Postgrest select projection; defaults to `*`. */
  select?: string;
}

/** Page request used by paginated lists. */
export interface PageParams<Row> extends Omit<ListParams<Row>, "limit" | "offset"> {
  page: number;
  pageSize: number;
}

/** Result envelope for paginated lists. */
export interface Paginated<Row> {
  rows: Row[];
  count: number;
  page: number;
  pageSize: number;
}
