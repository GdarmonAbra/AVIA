import Anthropic from "@anthropic-ai/sdk";

export type AnthropicLike = Pick<Anthropic, "messages">;

export function createAnthropicClient(apiKey = process.env["ANTHROPIC_API_KEY"]): Anthropic {
  if (!apiKey) {
    throw new Error(
      "ANTHROPIC_API_KEY is not set. Copy .env.example to .env and fill it in, or export it in your shell.",
    );
  }
  return new Anthropic({ apiKey });
}

export const DEFAULT_MODEL = process.env["AVIA_MODEL_DEFAULT"] ?? "claude-opus-4-7";
export const FAST_MODEL = process.env["AVIA_MODEL_FAST"] ?? "claude-sonnet-4-6";
