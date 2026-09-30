import { z } from "zod";
import { DomainSchema, LanguageSchema, ScoreSchema } from "./domain.ts";
import type { ChatTurn } from "./chat.ts";
import type { SignalCandidate } from "./signals.ts";

export const CLASSIFIER_SOURCES = ["local", "fallback"] as const;
export type ClassifierSource = (typeof CLASSIFIER_SOURCES)[number];

/**
 * Allowlist-schema voor classifier-output. Parse ALTIJD hiermee;
 * ongeldig → domain "onduidelijk" via FallbackClassifier.
 */
export const ClassificationSchema = z
  .object({
    domain: DomainSchema,
    confidence: ScoreSchema,
    secondaryDomain: DomainSchema.nullable().optional(),
    generic_risk: ScoreSchema,
    frustration: ScoreSchema,
    scam_signal: ScoreSchema,
    needs_human: ScoreSchema,
    language: LanguageSchema,
    source: z.enum(CLASSIFIER_SOURCES),
  })
  .strict();
export type Classification = z.infer<typeof ClassificationSchema>;

export const NotifyDecisionSchema = z.object({ notify: z.boolean(), score: ScoreSchema }).strict();
export type NotifyDecision = z.infer<typeof NotifyDecisionSchema>;

export const SMS_VERDICTS = ["phishing", "verdacht", "veilig"] as const;
export const SmsVerdictSchema = z
  .object({
    verdict: z.enum(SMS_VERDICTS),
    score: ScoreSchema,
    reasons: z.array(z.string().max(300)).max(10),
  })
  .strict();
export type SmsVerdict = z.infer<typeof SmsVerdictSchema>;

export interface Classifier {
  name: ClassifierSource;
  classify(text: string, history?: ChatTurn[]): Promise<Classification>;
  decideNotify(signal: SignalCandidate): Promise<NotifyDecision>;
  judgeSms(text: string): Promise<SmsVerdict>;
}

/** Drempels voor live ingrijpen (router kan overschrijven via env). */
export const INTERVENTION_THRESHOLDS = {
  scam_signal: 0.6,
  needs_human: 0.6,
  /** Onder deze router-confidence → verduidelijkende vraag. Default voor ROUTER_CONFIDENCE_THRESHOLD. */
  confidence: 0.6,
} as const;
