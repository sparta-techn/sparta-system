/**
 * Feature registry — every AI feature, keyed by id, with role-scoped lookups.
 */

import { AIError } from "../utils/errors";
import type { AIFeatureAudience, AIFeatureDefinition } from "./types";
import { EMPLOYEE_FEATURES } from "./employee";
import { MANAGER_FEATURES } from "./manager";
import { OWNER_FEATURES } from "./owner";
import { EXECUTIVE_FEATURES } from "./executive";

/** Every feature, in stable declaration order. */
export const ALL_AI_FEATURES: AIFeatureDefinition[] = [
  ...EMPLOYEE_FEATURES,
  ...MANAGER_FEATURES,
  ...OWNER_FEATURES,
  ...EXECUTIVE_FEATURES,
];

/** Features indexed by id. */
export const AI_FEATURES: Record<string, AIFeatureDefinition> = Object.fromEntries(
  ALL_AI_FEATURES.map((f) => [f.id, f]),
);

/** Resolve a feature by id, or throw when unknown. */
export function getFeature(id: string): AIFeatureDefinition {
  const feature = AI_FEATURES[id];
  if (!feature) {
    throw new AIError("invalid_request", `Unknown AI feature "${id}".`);
  }
  return feature;
}

/** List features, optionally filtered by audience. */
export function listFeatures(audience?: AIFeatureAudience): AIFeatureDefinition[] {
  if (!audience) return ALL_AI_FEATURES;
  return ALL_AI_FEATURES.filter((f) => f.audience === audience);
}
