/**
 * Small helpers shared by feature definitions.
 */

import { AIError } from "../utils/errors";
import type { AIFeatureInput } from "./types";

/** Read the user-supplied text for input-driven features, or throw. */
export function requireText(input: AIFeatureInput, featureId: string): string {
  const text = input.text?.trim();
  if (!text) {
    throw new AIError(
      "invalid_request",
      `Feature "${featureId}" requires input text (\`input.text\`).`,
    );
  }
  return text;
}

/** Fence a block of user text so the model treats it as data, not instructions. */
export function fenceText(text: string): string {
  return `"""\n${text}\n"""`;
}
