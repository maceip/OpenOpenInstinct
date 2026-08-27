import { createAnthropic } from "@ai-sdk/anthropic";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createOpenAI } from "@ai-sdk/openai";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import type { LanguageModel } from "ai";
import { env } from "./env";

export interface ConfiguredModel {
  readonly model: LanguageModel;
  readonly modelContextWindowTokens?: number;
  readonly modelId: string;
  readonly provider: string;
}

let cachedModel: ConfiguredModel | undefined;

export function getModelSettings(): ConfiguredModel {
  return (cachedModel ??= createConfiguredModel());
}

function createConfiguredModel(): ConfiguredModel {
  const shared = {
    modelContextWindowTokens: env.AI_MODEL_CONTEXT_WINDOW,
    modelId: env.AI_MODEL,
    provider: env.AI_PROVIDER,
  };

  switch (env.AI_PROVIDER) {
    case "anthropic":
      return {
        ...shared,
        model: createAnthropic({
          apiKey: requireCredential("ANTHROPIC_API_KEY", env.ANTHROPIC_API_KEY),
          baseURL: env.AI_BASE_URL,
        })(env.AI_MODEL),
      };
    case "google":
      return {
        ...shared,
        model: createGoogleGenerativeAI({
          apiKey: requireCredential(
            "GOOGLE_GENERATIVE_AI_API_KEY",
            env.GOOGLE_GENERATIVE_AI_API_KEY
          ),
          baseURL: env.AI_BASE_URL,
        })(env.AI_MODEL),
      };
    case "openai-compatible":
      return {
        ...shared,
        model: createOpenAICompatible({
          apiKey: env.AI_API_KEY,
          baseURL: requireCredential("AI_BASE_URL", env.AI_BASE_URL),
          name: env.AI_PROVIDER_NAME ?? "openai-compatible",
        })(env.AI_MODEL),
      };
    case "openai":
      return {
        ...shared,
        model: createOpenAI({
          apiKey: requireCredential("OPENAI_API_KEY", env.OPENAI_API_KEY),
          baseURL: env.AI_BASE_URL,
        })(env.AI_MODEL),
      };
  }
}

function requireCredential(name: string, value: string | undefined) {
  if (!value) throw new Error(`${name} is required for ${env.AI_PROVIDER}.`);
  return value;
}
