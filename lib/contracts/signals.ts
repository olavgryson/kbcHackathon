import { z } from "zod";
import { ScoreSchema } from "./domain.ts";

export const SIGNAL_TYPES = [
  "subscription_increase",
  "duplicate_payment",
  "unusual_cost",
  "new_payee_new_device",
] as const;
export type SignalType = (typeof SIGNAL_TYPES)[number];
export const SignalTypeSchema = z.enum(SIGNAL_TYPES);

export const SEVERITIES = ["info", "warning", "critical"] as const;
export type Severity = (typeof SEVERITIES)[number];

export const SignalCandidateSchema = z
  .object({
    id: z.string().min(1).max(100),
    type: SignalTypeSchema,
    title: z.string(),
    /** Waarom dit signaal, in het Nederlands. */
    explanation: z.string(),
    amount: z.number(),
    currency: z.literal("EUR"),
    merchant: z.string().optional(),
    /** ISO-datum (YYYY-MM-DD). */
    date: z.string(),
    relatedTransactionIds: z.array(z.string()),
    severity: z.enum(SEVERITIES),
  })
  .strict();
export type SignalCandidate = z.infer<typeof SignalCandidateSchema>;

export const SignalSchema = SignalCandidateSchema.extend({
  notify: z.boolean(),
  notifyScore: ScoreSchema,
}).strict();
export type Signal = z.infer<typeof SignalSchema>;

/** Minimum notify-score per type: scam-achtig laag (snel melden), abonnement hoog. */
export const NOTIFY_THRESHOLDS: Readonly<Record<SignalType, number>> = {
  new_payee_new_device: 0.2,
  duplicate_payment: 0.4,
  unusual_cost: 0.5,
  subscription_increase: 0.6,
};
