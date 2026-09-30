import "server-only";
import type { Classifier } from "@/lib/contracts";
import { FallbackClassifier } from "./fallback.ts";
import { LocalJeffClassifier } from "./local.ts";

let cached: { mode: string; instance: Classifier } | null = null;

/** CLASSIFIER_MODE=local → LocalJeffClassifier (met fallback bij fout), anders FallbackClassifier. */
export function getClassifier(): Classifier {
  const mode = process.env.CLASSIFIER_MODE === "local" ? "local" : "fallback";
  if (cached?.mode === mode) return cached.instance;
  const instance: Classifier = mode === "local" ? new LocalJeffClassifier() : new FallbackClassifier();
  cached = { mode, instance };
  return instance;
}

export { FallbackClassifier } from "./fallback.ts";
export { LocalJeffClassifier } from "./local.ts";
