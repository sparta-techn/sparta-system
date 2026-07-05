/** Barrel for the AI infrastructure type layer. */

export type { AIProviderId, AIRole, AIModelTier, AIFinishReason, AIUsage } from "./common";

export type {
  AIProvider,
  AIProviderMessage,
  AIGenerateParams,
  AIGenerateResult,
  AIStreamChunk,
  AITokenCountParams,
  AIModelDescriptor,
} from "./provider";

export type {
  PromptUser,
  PromptPreferences,
  PromptInput,
  BuiltPrompt,
  PromptAudience,
  PromptVariable,
  PromptTemplate,
} from "./prompt";

export type {
  ContextEntity,
  ContextBlock,
  ContextRequest,
  ContextResolver,
  ContextSourceKey,
  ContextFragment,
  ContextSource,
} from "./context";
