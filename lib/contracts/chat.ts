import { z } from "zod";
import { DomainSchema, ScoreSchema, type Domain } from "./domain.ts";

export const MODES = ["baseline", "plus"] as const;
export type Mode = (typeof MODES)[number];
export const ModeSchema = z.enum(MODES);

export const MAX_MESSAGE_CHARS = 1000;
export const MAX_HISTORY_TURNS = 20;

export const ChatTurnSchema = z
  .object({
    role: z.enum(["user", "assistant"]),
    content: z.string().trim().min(1).max(MAX_MESSAGE_CHARS),
  })
  .strict();
export type ChatTurn = z.infer<typeof ChatTurnSchema>;

export const ChatRequestSchema = z
  .object({
    mode: ModeSchema,
    messages: z.array(ChatTurnSchema).min(1).max(MAX_HISTORY_TURNS),
  })
  .strict()
  .refine((req) => req.messages[req.messages.length - 1]?.role === "user", {
    message: "Laatste bericht moet van de gebruiker zijn.",
    path: ["messages"],
  });
export type ChatRequest = z.infer<typeof ChatRequestSchema>;

export const InterventionSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("scam_warning"), title: z.string(), message: z.string() }).strict(),
  z.object({ type: z.literal("handover"), summary: z.string(), reason: z.string() }).strict(),
  z.object({ type: z.literal("clarify"), question: z.string(), options: z.array(DomainSchema) }).strict(),
]);
export type Intervention = z.infer<typeof InterventionSchema>;
export type InterventionType = Intervention["type"];
export const INTERVENTION_TYPES = ["scam_warning", "handover", "clarify"] as const satisfies readonly InterventionType[];

export const ChatResponseSchema = z
  .object({
    id: z.uuid(),
    reply: z.string(),
    meta: z
      .object({
        mode: ModeSchema,
        domain: DomainSchema.nullable(),
        confidence: ScoreSchema.nullable(),
        model: z.string(),
        inputTokens: z.number().int().nonnegative(),
        latencyMs: z.number().nonnegative(),
        interventions: z.array(InterventionSchema),
        signalsUsed: z.array(z.string()),
        classifierSource: z.enum(["local", "fallback"]).nullable(),
        demo: z.boolean(),
      })
      .strict(),
  })
  .strict();
export type ChatResponse = z.infer<typeof ChatResponseSchema>;

/** Generic error body for all API routes (never stacktraces). */
export type ApiError = { error: string };

// Re-export for convenience in UI code.
export type { Domain };
