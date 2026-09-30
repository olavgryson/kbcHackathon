import { readFileSync, writeFileSync } from "node:fs";
import { z } from "zod";
import {
  DOMAINS,
  EvalItemSchema,
  EvalResultsSchema,
  INTERVENTION_THRESHOLDS,
  LANGUAGES,
  type Classification,
  type Domain,
  type EvalResults,
  type Language,
  type Signal,
} from "@/lib/contracts";
import { getClassifier } from "@/lib/classifier";
import { DEMO_CUSTOMER_ID } from "@/lib/data";
import { getSignals } from "@/lib/signals";
import { baselineSystemPrompt, domainSystemPrompt } from "@/lib/agents/prompts";
import { ALL_TOOLS, toolsForDomain } from "@/lib/agents/tools";
import { buildUserContent, estimateTokens } from "@/lib/agents/llm";
import { confidenceThreshold, relevantSignals, scamContextLine } from "@/lib/agents/router";
import { runChat } from "@/lib/agents";
import groundTruth from "@/lib/data/ground-truth.json";

const dataset = z.array(EvalItemSchema).parse(JSON.parse(readFileSync(new URL("./dataset.json", import.meta.url), "utf8")));
const truth = z
  .array(z.object({ type: z.string(), relatedTransactionIds: z.array(z.string()) }))
  .parse(groundTruth);

const live = process.argv.includes("--live");
const toolsJson = (tools: { name: string; description: string; input_schema: unknown }[]) =>
  JSON.stringify(tools.map((t) => ({ name: t.name, description: t.description, input_schema: t.input_schema })));

const classifier = getClassifier();

// Signalen worden eenmaal berekend (zelfde klant, zelfde data).
const allSignals: Signal[] = await getSignals(DEMO_CUSTOMER_ID, classifier);

type Row = { expected: Domain; predicted: Domain; language: Language; c: Classification; text: string; scam: boolean; handover: boolean; unclear: boolean };
const rows: Row[] = [];
for (const item of dataset) {
  const c = await classifier.classify(item.text);
  rows.push({
    expected: item.expectedDomain,
    predicted: c.domain,
    language: item.language,
    c,
    text: item.text,
    scam: c.scam_signal >= INTERVENTION_THRESHOLDS.scam_signal,
    handover: c.needs_human >= INTERVENTION_THRESHOLDS.needs_human,
    unclear: c.domain === "onduidelijk" || c.confidence < confidenceThreshold(),
  });
}

// Accuraatheid (router-beslissing: bij scam wordt naar app_beveiliging gerouteerd, zoals in runChat).
const perLanguage = Object.fromEntries(LANGUAGES.map((l) => [l, { total: 0, correct: 0, accuracy: 0 }])) as EvalResults["perLanguage"];
const confusion = Object.fromEntries(
  DOMAINS.map((e) => [e, Object.fromEntries(DOMAINS.map((p) => [p, 0]))]),
) as EvalResults["confusion"];
let correct = 0;
for (const r of rows) {
  confusion[r.expected][r.predicted] += 1;
  const ok = r.expected === r.predicted;
  if (ok) correct += 1;
  perLanguage[r.language].total += 1;
  if (ok) perLanguage[r.language].correct += 1;
}
for (const l of LANGUAGES) perLanguage[l].accuracy = perLanguage[l].total ? perLanguage[l].correct / perLanguage[l].total : 0;

// Interventies, identiek aan runChat.
const interventions = { scam_warning: 0, handover: 0, clarify: 0 };
for (const r of rows) {
  if (r.scam) interventions.scam_warning += 1;
  if (r.handover) interventions.handover += 1;
  if (!r.scam && !r.handover && r.unclear) interventions.clarify += 1;
}

// Tokens (geschat): enkel items waarbij Kate+ effectief een domeinagent aanroept, baseline op dezelfde items.
let baseSum = 0;
let plusSum = 0;
let agentItems = 0;
const baseTools = toolsJson(ALL_TOOLS);
for (const r of rows) {
  if (!r.scam && (r.handover || r.unclear)) continue;
  const routed: Domain = r.scam ? "app_beveiliging" : r.predicted;
  const lines = relevantSignals(routed, allSignals).map((s) => `- ${s.title}: ${s.explanation}`);
  if (r.scam) lines.unshift(scamContextLine());
  baseSum += estimateTokens(baselineSystemPrompt(r.c.language), baseTools, buildUserContent(r.text));
  plusSum += estimateTokens(
    domainSystemPrompt(routed, r.c.language),
    toolsJson(toolsForDomain(routed)),
    buildUserContent(r.text, lines.length ? lines.join("\n") : undefined),
  );
  agentItems += 1;
}
let tokens: EvalResults["tokens"] = {
  baselineAvg: agentItems ? Math.round(baseSum / agentItems) : 0,
  plusAvg: agentItems ? Math.round(plusSum / agentItems) : 0,
  measured: "estimated",
};

if (live) {
  if (!process.env.ANTHROPIC_API_KEY) {
    console.log("--live genegeerd: geen ANTHROPIC_API_KEY, schattingen behouden.");
  } else {
    const step = Math.max(1, Math.floor(dataset.length / 10));
    const sample = dataset.filter((_, i) => i % step === 0).slice(0, 10);
    let b = 0;
    let p = 0;
    let bn = 0;
    let pn = 0;
    for (const item of sample) {
      const msgs = [{ role: "user" as const, content: item.text }];
      const base = await runChat({ mode: "baseline", messages: msgs });
      const plus = await runChat({ mode: "plus", messages: msgs });
      if (!base.meta.demo) {
        b += base.meta.inputTokens;
        bn += 1;
      }
      if (!plus.meta.demo && plus.meta.inputTokens > 0) {
        p += plus.meta.inputTokens;
        pn += 1;
      }
    }
    if (bn > 0 && pn > 0) tokens = { baselineAvg: Math.round(b / bn), plusAvg: Math.round(p / pn), measured: "live" };
    else console.log("--live: onvoldoende echte metingen, schattingen behouden.");
  }
}

// Signalen: notify=true tegen ground truth (type + overlap relatedTransactionIds).
const flagged = allSignals.filter((s) => s.notify);
const matched = new Set<number>();
let tp = 0;
let fp = 0;
for (const s of flagged) {
  const idx = truth.findIndex(
    (g, i) => !matched.has(i) && g.type === s.type && g.relatedTransactionIds.some((id) => s.relatedTransactionIds.includes(id)),
  );
  if (idx >= 0) {
    matched.add(idx);
    tp += 1;
  } else fp += 1;
}
const fn = truth.length - matched.size;

const results: EvalResults = EvalResultsSchema.parse({
  generatedAt: new Date().toISOString(),
  classifier: classifier.name,
  total: rows.length,
  accuracy: rows.length ? correct / rows.length : 0,
  perLanguage,
  confusion,
  tokens,
  interventions,
  signals: { precision: tp + fp ? tp / (tp + fp) : 0, recall: tp + fn ? tp / (tp + fn) : 0, tp, fp, fn },
});
writeFileSync(new URL("./results.json", import.meta.url), `${JSON.stringify(results, null, 2)}\n`);

const pct = (n: number) => `${(n * 100).toFixed(1)}%`;
console.log(`classifier=${results.classifier} items=${results.total} accuracy=${pct(results.accuracy)}`);
console.log(`talen: ${LANGUAGES.map((l) => `${l} ${pct(perLanguage[l].accuracy)} (${perLanguage[l].correct}/${perLanguage[l].total})`).join(", ")}`);
console.log(`tokens (${tokens.measured}): baseline ${tokens.baselineAvg} vs plus ${tokens.plusAvg}`);
console.log(`interventies: scam ${interventions.scam_warning}, handover ${interventions.handover}, clarify ${interventions.clarify}`);
console.log(`signalen: P ${pct(results.signals.precision)} R ${pct(results.signals.recall)} (tp ${tp}, fp ${fp}, fn ${fn})`);
