/** Barrel for the AI feature layer. */

export type {
  AIFeatureAudience,
  AIFeatureInput,
  AIFeatureRequest,
  AIFeatureDefinition,
  AIFeatureResult,
} from "./types";
export { ALL_AI_FEATURES, AI_FEATURES, getFeature, listFeatures } from "./registry";
export { EMPLOYEE_FEATURES } from "./employee";
export { MANAGER_FEATURES } from "./manager";
export { OWNER_FEATURES } from "./owner";
export { EXECUTIVE_FEATURES } from "./executive";
