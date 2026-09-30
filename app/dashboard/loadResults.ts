import "server-only";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { EvalResultsSchema, type EvalResults } from "@/lib/contracts";

/** Leest eval/results.json (vast pad). Geeft null bij ontbrekend of ongeldig bestand. */
export async function loadResults(): Promise<EvalResults | null> {
  try {
    const raw = await readFile(path.join(process.cwd(), "eval", "results.json"), "utf8");
    const parsed = EvalResultsSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}
