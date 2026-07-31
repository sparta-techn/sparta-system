export { BaseService } from "./base-service";
export { ServiceError, toServiceError, notFound, DeleteAffectedNoRowsError } from "./errors";
export { db, supabase } from "./client";
export type {
  Identifiable,
  Filters,
  ListParams,
  PageParams,
  Paginated,
  SortDirection,
} from "./types";
