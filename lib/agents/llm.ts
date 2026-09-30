import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import type { ChatTurn, ToolContext, ToolDefinition } from "@/lib/contracts";

export const MAX_ITERATIONS = 4;
export const MAX_OUTPUT_TOKENS = 500;

export function modelSimple(): string {
  return process.env.MODEL_SIMPLE || "claude-haiku-4-5-20251001";
}
export function modelComplex(): string {
  return process.env.MODEL_COMPLEX || "claude-sonnet-5-5";
}

let client: Anthropic | null = null;
function getClient(): Anthropic | null {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;
  client ??= new Anthropic({ apiKey });
  return client;
}

/** Zorgt dat klanttekst de <klantbericht>-tags niet kan breken. */
export function escapeCustomerText(text: string): string {
  return text.replace(/</g, "‹").replace(/>/g, "›");
}

export function wrapCustomerText(text: string): string {
  return `<klantbericht>\n${escapeCustomerText(text)}\n</klantbericht>`;
}

export function buildUserContent(text: string, contextBlock?: string): string {
  const base = wrapCustomerText(text);
  return contextBlock ? `${base}\n\n<context>\n${contextBlock}\n</context>` : base;
}

export function estimateTokens(...parts: string[]): number {
  return Math.ceil(parts.reduce((n, p) => n + p.length, 0) / 4);
}

export interface AgentLoopInput {
  model: string;
  system: string;
  /** Reeds opgebouwde huidige user-beurt (klanttekst gewrapt + optionele context). */
  userContent: string;
  history: ChatTurn[];
  tools: ToolDefinition[];
  ctx: ToolContext;
  /** Deterministisch antwoord voor demo-modus. */
  demoReply: () => Promise<string>;
}

export interface AgentLoopOutput {
  reply: string;
  inputTokens: number;
  model: string;
  toolCalls: string[];
  demo: boolean;
}

function historyMessages(history: ChatTurn[]): Anthropic.MessageParam[] {
  return history.map((t) => ({
    role: t.role,
    content: t.role === "user" ? wrapCustomerText(t.content) : t.content,
  }));
}

async function demoOutput(input: AgentLoopInput): Promise<AgentLoopOutput> {
  const reply = await input.demoReply();
  const inputTokens = estimateTokens(
    input.system,
    JSON.stringify(input.tools.map((t) => ({ name: t.name, description: t.description, input_schema: t.input_schema }))),
    input.history.map((t) => t.content).join(""),
    input.userContent,
  );
  return { reply, inputTokens, model: input.model, toolCalls: [], demo: true };
}

export async function runAgentLoop(input: AgentLoopInput): Promise<AgentLoopOutput> {
  const anthropic = getClient();
  if (!anthropic) return demoOutput(input);

  try {
    const tools: Anthropic.Tool[] = input.tools.map((t) => ({
      name: t.name,
      description: t.description,
      input_schema: t.input_schema as Anthropic.Tool.InputSchema,
    }));
    const messages: Anthropic.MessageParam[] = [
      ...historyMessages(input.history),
      { role: "user", content: input.userContent },
    ];
    let inputTokens = 0;
    const toolCalls: string[] = [];

    for (let i = 0; i < MAX_ITERATIONS; i++) {
      const lastRound = i === MAX_ITERATIONS - 1;
      const response = await anthropic.messages.create({
        model: input.model,
        max_tokens: MAX_OUTPUT_TOKENS,
        system: input.system,
        messages,
        ...(tools.length > 0 && !lastRound ? { tools } : {}),
      });
      inputTokens += response.usage.input_tokens;

      if (response.stop_reason === "tool_use" && !lastRound) {
        messages.push({ role: "assistant", content: response.content });
        const results: Anthropic.ToolResultBlockParam[] = [];
        for (const block of response.content) {
          if (block.type !== "tool_use") continue;
          toolCalls.push(block.name);
          const tool = input.tools.find((t) => t.name === block.name);
          try {
            if (!tool) throw new Error("unknown tool");
            const out = await tool.run(block.input, input.ctx);
            results.push({ type: "tool_result", tool_use_id: block.id, content: JSON.stringify(out) });
          } catch {
            results.push({ type: "tool_result", tool_use_id: block.id, content: "Ongeldige aanvraag.", is_error: true });
          }
        }
        messages.push({ role: "user", content: results });
        continue;
      }

      const reply = response.content
        .flatMap((b) => (b.type === "text" ? [b.text] : []))
        .join("\n")
        .trim();
      if (!reply) break;
      return { reply, inputTokens, model: input.model, toolCalls, demo: false };
    }
    throw new Error("no final reply");
  } catch (err) {
    const status = err instanceof Anthropic.APIError ? String(err.status) : "n/a";
    console.error(`[agents] llm error status=${status}`);
    return demoOutput(input);
  }
}
