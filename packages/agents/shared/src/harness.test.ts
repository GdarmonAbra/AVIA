import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { runAgent, type AgentToolDef } from "./harness.js";
import type { AnthropicLike } from "./claude.js";

type StubMessage = { stop_reason: string; content: unknown[] };

function stubClient(responses: StubMessage[]): AnthropicLike {
  const create = vi.fn();
  for (const r of responses) create.mockResolvedValueOnce(r);
  return { messages: { create } } as unknown as AnthropicLike;
}

describe("runAgent", () => {
  it("parses a final JSON response when the model returns no tool calls", async () => {
    const client = stubClient([
      {
        stop_reason: "end_turn",
        content: [{ type: "text", text: '```json\n{"value":42}\n```' }],
      },
    ]);

    const out = await runAgent({
      systemPrompt: "you are a test agent",
      tools: [],
      input: { ignored: true },
      outputSchema: z.object({ value: z.number() }),
      client,
    });

    expect(out).toEqual({ value: 42 });
  });

  it("executes a tool call and round-trips the result", async () => {
    const add: AgentToolDef<{ a: number; b: number }, { sum: number }> = {
      name: "add",
      description: "adds",
      inputSchema: {
        type: "object",
        properties: { a: { type: "number" }, b: { type: "number" } },
        required: ["a", "b"],
      },
      handler: async ({ a, b }) => ({ sum: a + b }),
    };

    const client = stubClient([
      {
        stop_reason: "tool_use",
        content: [
          { type: "tool_use", id: "t1", name: "add", input: { a: 2, b: 3 } },
        ],
      },
      {
        stop_reason: "end_turn",
        content: [{ type: "text", text: '{"sum":5}' }],
      },
    ]);

    const out = await runAgent({
      systemPrompt: "tool agent",
      tools: [add as AgentToolDef],
      input: {},
      outputSchema: z.object({ sum: z.number() }),
      client,
    });

    expect(out).toEqual({ sum: 5 });
  });
});
