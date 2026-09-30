import "server-only";
import type { ChatTurn, ToolContext, ToolDefinition } from "@/lib/contracts";

export const MAX_ITERATIONS = 4;
export const MAX_OUTPUT_TOKENS = 500;

export function modelSimple(): string {
  return process.env.MODEL_SIMPLE || "llm-simple";
}
export function modelComplex(): string {
  return process.env.MODEL_COMPLEX || "llm-complex";
}

// OpenAI-compatible Chat Completions (vLLM, Ollama, TGI, Azure, ...): self-hosted model, data stays in-house.
type Message =
  | { role: "system" | "user"; content: string }
  | { role: "assistant"; content: string | null; tool_calls?: ToolCall[] }
  | { role: "tool"; tool_call_id: string; content: string };
interface ToolCall {
  id: string;
  type: "function";
  function: { name: string; arguments: string };
}
interface Completion {
  choices: { finish_reason: string; message: { content: string | null; tool_calls?: ToolCall[] } }[];
  usage?: { prompt_tokens: number };
}

export function llmConfigured(): boolean {
  return !!process.env.LLM_BASE_URL;
}

async function complete(body: object): Promise<Completion> {
  const key = process.env.LLM_API_KEY;
  const res = await fetch(`${process.env.LLM_BASE_URL!.replace(/\/$/, "")}/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(key ? { Authorization: `Bearer ${key}` } : {}) },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) throw new Error(`status=${res.status}`);
  return (await res.json()) as Completion;
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

// History comes from the client, so earlier assistant turns are untrusted too:
// escape them so they cannot inject <klantbericht>/<context> blocks.
function historyMessages(history: ChatTurn[]): Message[] {
  return history.map((t) => ({
    role: t.role,
    content: t.role === "user" ? wrapCustomerText(t.content) : escapeCustomerText(t.content),
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
  if (!llmConfigured()) return demoOutput(input);

  try {
    const tools = input.tools.map((t) => ({
      type: "function",
      function: { name: t.name, description: t.description, parameters: t.input_schema },
    }));
    const messages: Message[] = [
      { role: "system", content: input.system },
      ...historyMessages(input.history),
      { role: "user", content: input.userContent },
    ];
    let inputTokens = 0;
    const toolCalls: string[] = [];

    for (let i = 0; i < MAX_ITERATIONS; i++) {
      const lastRound = i === MAX_ITERATIONS - 1;
      const response = await complete({
        model: input.model,
        max_tokens: MAX_OUTPUT_TOKENS,
        messages,
        ...(tools.length > 0 && !lastRound ? { tools } : {}),
      });
      inputTokens += response.usage?.prompt_tokens ?? 0;
      const msg = response.choices[0]?.message;
      if (!msg) break;

      if (msg.tool_calls?.length && !lastRound) {
        messages.push({ role: "assistant", content: msg.content, tool_calls: msg.tool_calls });
        for (const call of msg.tool_calls) {
          toolCalls.push(call.function.name);
          const tool = input.tools.find((t) => t.name === call.function.name);
          let content: string;
          try {
            if (!tool) throw new Error("unknown tool");
            content = JSON.stringify(await tool.run(JSON.parse(call.function.arguments || "{}"), input.ctx));
          } catch {
            content = "Ongeldige aanvraag.";
          }
          messages.push({ role: "tool", tool_call_id: call.id, content });
        }
        continue;
      }

      const reply = (msg.content ?? "").trim();
      if (!reply) break;
      return { reply, inputTokens, model: input.model, toolCalls, demo: false };
    }
    throw new Error("no final reply");
  } catch (err) {
    console.error(`[agents] llm error ${err instanceof Error ? err.message : "n/a"}`);
    return demoOutput(input);
  }
}
