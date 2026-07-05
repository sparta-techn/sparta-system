/**
 * Composite context resolver — runs a set of {@link ContextSource}s for a surface
 * and merges their fragments into one {@link ContextBlock}.
 *
 * Sources run concurrently and are isolated: one failing source degrades to a
 * note instead of failing the whole request, so the AI still gets partial,
 * useful grounding. The resolver is data-driven — it holds no module knowledge
 * beyond the source list handed to it.
 */

import type {
  ContextBlock,
  ContextEntity,
  ContextFragment,
  ContextRequest,
  ContextResolver,
  ContextSource,
} from "../types";
import { AIError } from "../utils/errors";

/** Merge source fragments into a single, cited context block. */
export function mergeFragments(fragments: ContextFragment[]): ContextBlock {
  const entities: ContextEntity[] = [];
  const summaryParts: string[] = [];
  let truncated = false;

  for (const f of fragments) {
    if (f.entities.length > 0) {
      entities.push(...f.entities);
      const suffix = f.note ? ` (${f.note})` : "";
      summaryParts.push(`${f.label}: ${f.entities.length} item(s)${suffix}`);
    } else if (f.note) {
      summaryParts.push(`${f.label}: ${f.note}`);
    }
    truncated = truncated || f.truncated;
  }

  return {
    summary: summaryParts.join("; "),
    entities,
    truncated,
  };
}

export class CompositeContextResolver implements ContextResolver {
  constructor(
    readonly surface: string,
    private readonly sources: ContextSource[],
  ) {}

  /** The source keys this resolver composes (for introspection/testing). */
  get sourceKeys(): string[] {
    return this.sources.map((s) => s.key);
  }

  async resolve(request: ContextRequest): Promise<ContextBlock> {
    const settled = await Promise.allSettled(this.sources.map((source) => source.gather(request)));

    const fragments: ContextFragment[] = settled.map((result, i) => {
      const source = this.sources[i];
      if (result.status === "fulfilled") return result.value;
      const reason =
        result.reason instanceof AIError || result.reason instanceof Error
          ? result.reason.message
          : "unknown error";
      return {
        source: source.key,
        label: source.label,
        entities: [],
        truncated: false,
        note: `unavailable — ${reason}`,
      };
    });

    return mergeFragments(fragments);
  }
}
