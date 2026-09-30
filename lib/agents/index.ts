import "server-only";
import {
  ChatResponseSchema,
  type ChatRequest,
  type ChatResponse,
  type Domain,
  type Intervention,
  type Language,
  type Signal,
} from "@/lib/contracts";
import { getClassifier } from "@/lib/classifier";
import { DEMO_CUSTOMER_ID } from "@/lib/data";
import { getSignals } from "@/lib/signals";
import { baselineSystemPrompt, domainSystemPrompt } from "./prompts";
import { ALL_TOOLS, toolsForDomain } from "./tools";
import { buildUserContent, modelComplex, runAgentLoop } from "./llm";
import { baselineDemoReply, detectLanguage, plusDemoReply } from "./demo";
import {
  clarifyIntervention,
  confidenceThreshold,
  handoverIntervention,
  handoverReply,
  modelForDomain,
  relevantSignals,
  scamContextLine,
  scamWarning,
} from "./router";
import { INTERVENTION_THRESHOLDS } from "@/lib/contracts";

export async function runChat(req: ChatRequest): Promise<ChatResponse> {
  const started = performance.now();
  const last = req.messages[req.messages.length - 1];
  const text = last?.content ?? "";
  const history = req.messages.slice(0, -1);
  const ctx = { customerId: DEMO_CUSTOMER_ID };

  let reply = "";
  let model = "";
  let inputTokens = 0;
  let demo = false;
  let domain: Domain | null = null;
  let confidence: number | null = null;
  let classifierSource: "local" | "fallback" | null = null;
  let signalsUsed: string[] = [];
  const interventions: Intervention[] = [];

  if (req.mode === "baseline") {
    const lang = detectLanguage(text);
    const out = await runAgentLoop({
      model: modelComplex(),
      system: baselineSystemPrompt(lang),
      userContent: buildUserContent(text),
      history,
      tools: ALL_TOOLS,
      ctx,
      demoReply: async () => baselineDemoReply(lang),
    });
    ({ reply, model, inputTokens, demo } = out);
  } else {
    const classifier = getClassifier();
    const c = await classifier.classify(text, history);
    const lang: Language = c.language;
    classifierSource = c.source;
    confidence = c.confidence;
    const scam = c.scam_signal >= INTERVENTION_THRESHOLDS.scam_signal;
    const handover = c.needs_human >= INTERVENTION_THRESHOLDS.needs_human;
    const unclear = c.domain === "onduidelijk" || c.confidence < confidenceThreshold();
    const routed: Domain = scam ? "app_beveiliging" : c.domain;
    domain = routed;

    let signals: Signal[] = [];
    try {
      signals = relevantSignals(routed, await getSignals(ctx.customerId, classifier));
    } catch {
      console.error("[agents] signals error");
    }
    signalsUsed = signals.map((s) => s.id);

    if (scam) interventions.push(scamWarning(lang));
    if (handover) interventions.push(handoverIntervention(routed, c, text, signalsUsed));

    if (!scam && handover) {
      reply = handoverReply(lang);
      model = "router";
    } else if (!scam && unclear) {
      const q = clarifyIntervention(c, lang);
      interventions.push(q);
      reply = q.question;
      model = "router";
    } else {
      const agentDomain: Domain = routed;
      const contextLines = signals.map((s) => `- ${s.title}: ${s.explanation}`);
      if (scam) contextLines.unshift(scamContextLine());
      const out = await runAgentLoop({
        model: modelForDomain(agentDomain),
        system: domainSystemPrompt(agentDomain, lang),
        userContent: buildUserContent(text, contextLines.length ? contextLines.join("\n") : undefined),
        history,
        tools: toolsForDomain(agentDomain),
        ctx,
        demoReply: async () =>
          scam
            ? scamWarning(lang).message
            : plusDemoReply({ domain: agentDomain, lang, signals, ctx }),
      });
      ({ reply, model, inputTokens, demo } = out);
    }
  }

  const latencyMs = Math.round(performance.now() - started);
  console.log(
    `[chat] mode=${req.mode} domain=${domain ?? "-"} conf=${confidence ?? "-"} tokens=${inputTokens} ms=${latencyMs} interventions=${interventions.map((i) => i.type).join(",") || "-"}`,
  );

  return ChatResponseSchema.parse({
    id: crypto.randomUUID(),
    reply,
    meta: {
      mode: req.mode,
      domain,
      confidence,
      model,
      inputTokens,
      latencyMs,
      interventions,
      signalsUsed,
      classifierSource,
      demo,
    },
  });
}
