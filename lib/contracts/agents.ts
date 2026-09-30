import type { Domain } from "./domain.ts";

export type ModelTier = "simple" | "complex";

/** Server-bepaald; nooit uit request body of modeloutput. */
export interface ToolContext {
  customerId: string;
}

/** JSON Schema (object) zoals de Anthropic API verwacht voor tool input. */
export interface JsonObjectSchema {
  type: "object";
  properties: Record<string, unknown>;
  required?: string[];
  additionalProperties?: boolean;
}

/** Enkel read-only tools. Valideer `input` zelf met zod in `run`. */
export interface ToolDefinition {
  name: string;
  description: string;
  input_schema: JsonObjectSchema;
  run(input: unknown, ctx: ToolContext): Promise<unknown>;
}

export interface DomainAgent {
  domain: Domain;
  model: ModelTier;
  systemPrompt: string;
  tools: ToolDefinition[];
}

export interface AgentResult {
  reply: string;
  inputTokens: number;
  model: string;
  toolCalls: string[];
}
