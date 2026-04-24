import type Anthropic from "@anthropic-ai/sdk";
import type { z } from "zod";
import { createAnthropicClient, DEFAULT_MODEL, type AnthropicLike } from "./claude.js";

/**
 * One tool the agent can call. `handler` is executed server-side (in-process
 * for now; will be delegated to an MCP client transport later).
 */
export interface AgentToolDef<TInput = unknown, TOutput = unknown> {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>; // JSON Schema
  handler: (input: TInput) => Promise<TOutput>;
}

export interface RunAgentOptions<TOut> {
  systemPrompt: string;
  tools: AgentToolDef[];
  input: unknown;
  // Third type param left open so schemas with `.default(...)` (whose input
  // type differs from output) still satisfy the constraint.
  outputSchema: z.ZodType<TOut, z.ZodTypeDef, unknown>;
  model?: string;
  maxTokens?: number;
  maxTurns?: number;
  client?: AnthropicLike;
}

type ContentBlock =
  | { type: "text"; text: string }
  | { type: "tool_use"; id: string; name: string; input: unknown }
  | { type: "tool_result"; tool_use_id: string; content: string; is_error?: boolean };

type Message = { role: "user" | "assistant"; content: ContentBlock[] };

/**
 * Runs a tool-use loop against Claude until the model returns a final text
 * block that parses as the agent's output schema. The system prompt and tool
 * list are marked as ephemeral cache breakpoints so the repeated turns in a
 * compile-fix loop stay cheap.
 */
export async function runAgent<TOut>(opts: RunAgentOptions<TOut>): Promise<TOut> {
  const client: AnthropicLike = opts.client ?? createAnthropicClient();
  const model = opts.model ?? DEFAULT_MODEL;
  const maxTokens = opts.maxTokens ?? 4096;
  const maxTurns = opts.maxTurns ?? 20;

  const toolsForApi = opts.tools.map((t, i) => ({
    name: t.name,
    description: t.description,
    input_schema: t.inputSchema,
    // Cache the entire tool list (one breakpoint on the last tool covers the block).
    ...(i === opts.tools.length - 1
      ? { cache_control: { type: "ephemeral" as const } }
      : {}),
  }));

  const system = [
    {
      type: "text" as const,
      text: opts.systemPrompt,
      cache_control: { type: "ephemeral" as const },
    },
  ];

  const messages: Message[] = [
    {
      role: "user",
      content: [{ type: "text", text: JSON.stringify(opts.input) }],
    },
  ];

  const toolByName = new Map(opts.tools.map((t) => [t.name, t]));

  for (let turn = 0; turn < maxTurns; turn++) {
    const response = (await (client as Anthropic).messages.create({
      model,
      max_tokens: maxTokens,
      system,
      tools: toolsForApi as unknown as Anthropic.Tool[],
      messages: messages as Anthropic.MessageParam[],
    })) as Anthropic.Message;

    const assistantBlocks = response.content as ContentBlock[];
    messages.push({ role: "assistant", content: assistantBlocks });

    if (response.stop_reason === "tool_use") {
      const toolResults: ContentBlock[] = [];
      for (const block of assistantBlocks) {
        if (block.type !== "tool_use") continue;
        const tool = toolByName.get(block.name);
        if (!tool) {
          toolResults.push({
            type: "tool_result",
            tool_use_id: block.id,
            content: JSON.stringify({
              error: { code: "unknown_tool", message: `No tool named ${block.name}` },
            }),
            is_error: true,
          });
          continue;
        }
        try {
          const out = await tool.handler(block.input);
          toolResults.push({
            type: "tool_result",
            tool_use_id: block.id,
            content: JSON.stringify(out),
          });
        } catch (err) {
          toolResults.push({
            type: "tool_result",
            tool_use_id: block.id,
            content: JSON.stringify({
              error: {
                code: "tool_exception",
                message: err instanceof Error ? err.message : String(err),
              },
            }),
            is_error: true,
          });
        }
      }
      messages.push({ role: "user", content: toolResults });
      continue;
    }

    // Final turn: parse the last text block as JSON and validate.
    const finalText = assistantBlocks
      .filter((b): b is { type: "text"; text: string } => b.type === "text")
      .map((b) => b.text)
      .join("")
      .trim();
    if (!finalText) {
      throw new Error("Agent returned no text on final turn.");
    }
    const json = extractJson(finalText);
    return opts.outputSchema.parse(json);
  }

  throw new Error(`Agent exceeded maxTurns=${maxTurns}.`);
}

function extractJson(text: string): unknown {
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const payload = fence?.[1]?.trim() ?? text;
  return JSON.parse(payload);
}
