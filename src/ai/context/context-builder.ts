/**
 * Context Builder — turns a {@link ContextRequest} into an authorized
 * {@link ContextBlock} by delegating to a per-surface {@link ContextResolver}.
 *
 * Resolvers gather data through the **service layer** only (see
 * `src/ai/context/sources/`). They MUST read through a caller-scoped client so
 * Postgres RLS filters every row — the AI must never see data the user could not
 * open in the UI, and never queries a UI component or feature store directly.
 */

import type { ContextBlock, ContextRequest, ContextResolver } from "../types";

/** An empty, safe context block. */
export function emptyContext(): ContextBlock {
  return { summary: "", entities: [], truncated: false };
}

/**
 * Registry-backed context builder. Register surface resolvers up front; the
 * builder dispatches on `request.surface`, falling back to a default (global)
 * resolver, then to an empty block.
 */
export class ContextBuilder {
  private readonly resolvers = new Map<string, ContextResolver>();
  private fallback?: ContextResolver;

  /** Register a resolver for its declared surface. */
  register(resolver: ContextResolver): this {
    this.resolvers.set(resolver.surface, resolver);
    return this;
  }

  /**
   * Set the default resolver used for the global (`null`) surface and for any
   * surface without a dedicated resolver.
   */
  setDefault(resolver: ContextResolver): this {
    this.fallback = resolver;
    return this;
  }

  /** Whether a resolver is registered for a surface. */
  has(surface: string): boolean {
    return this.resolvers.has(surface);
  }

  /** Build context for a request, or an empty block when unresolved. */
  async build(request: ContextRequest): Promise<ContextBlock> {
    const resolver =
      (request.surface ? this.resolvers.get(request.surface) : undefined) ?? this.fallback;
    if (!resolver) return emptyContext();
    return resolver.resolve(request);
  }
}

/** Shared default builder. Surface resolvers are registered as features land. */
export const contextBuilder = new ContextBuilder();
