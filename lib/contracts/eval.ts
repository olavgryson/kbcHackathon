import { z } from "zod";
import { DOMAINS, DomainSchema, LanguageSchema, ScoreSchema, type Domain, type Language } from "./domain.ts";
import { CLASSIFIER_SOURCES } from "./classifier.ts";

export const EVAL_TAGS = ["multi_intent", "unclear", "injection", "scam", "handover"] as const;
export type EvalTag = (typeof EVAL_TAGS)[number];

export const EvalItemSchema = z
  .object({
    id: z.string().min(1),
    text: z.string().min(1).max(1000),
    language: LanguageSchema,
    expectedDomain: DomainSchema,
    secondaryDomain: DomainSchema.optional(),
    tags: z.array(z.enum(EVAL_TAGS)),
    expectScam: z.boolean().optional(),
    expectHandover: z.boolean().optional(),
  })
  .strict();
export type EvalItem = z.infer<typeof EvalItemSchema>;
export const EvalSetSchema = z.array(EvalItemSchema);

const LangStatsSchema = z
  .object({ total: z.number().int().nonnegative(), correct: z.number().int().nonnegative(), accuracy: ScoreSchema })
  .strict();

const domainRecord = <T extends z.ZodType>(value: T) =>
  z.object(Object.fromEntries(DOMAINS.map((d) => [d, value])) as Record<Domain, T>).strict();

export const EvalResultsSchema = z
  .object({
    generatedAt: z.string(),
    classifier: z.enum(CLASSIFIER_SOURCES),
    total: z.number().int().nonnegative(),
    accuracy: ScoreSchema,
    perLanguage: z.object({ nl: LangStatsSchema, fr: LangStatsSchema, en: LangStatsSchema }).strict(),
    /** confusion[expected][predicted] = aantal */
    confusion: domainRecord(domainRecord(z.number().int().nonnegative())),
    tokens: z
      .object({
        baselineAvg: z.number().nonnegative(),
        plusAvg: z.number().nonnegative(),
        measured: z.enum(["estimated", "live"]),
      })
      .strict(),
    interventions: z
      .object({
        scam_warning: z.number().int().nonnegative(),
        handover: z.number().int().nonnegative(),
        clarify: z.number().int().nonnegative(),
      })
      .strict(),
    signals: z
      .object({
        precision: ScoreSchema,
        recall: ScoreSchema,
        tp: z.number().int().nonnegative(),
        fp: z.number().int().nonnegative(),
        fn: z.number().int().nonnegative(),
      })
      .strict(),
  })
  .strict();
export type EvalResults = z.infer<typeof EvalResultsSchema>;

export type LanguageStats = z.infer<typeof LangStatsSchema>;
export type PerLanguage = Record<Language, LanguageStats>;
