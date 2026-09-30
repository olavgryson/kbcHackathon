import "server-only";
import {
  DOMAINS,
  DOMAIN_LABELS_NL,
  INTERVENTION_THRESHOLDS,
  type Classification,
  type Domain,
  type Intervention,
  type Language,
  type Signal,
} from "@/lib/contracts";
import { modelComplex, modelSimple } from "./llm";

const COMPLEX_DOMAINS: readonly Domain[] = ["kredieten", "sparen_beleggen", "app_beveiliging"];

const t = (lang: Language, nl: string, fr: string, en: string): string => (lang === "fr" ? fr : lang === "en" ? en : nl);

export function confidenceThreshold(): number {
  const raw = process.env.ROUTER_CONFIDENCE_THRESHOLD;
  if (raw === undefined || raw.trim() === "") return INTERVENTION_THRESHOLDS.confidence;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 && n <= 1 ? n : INTERVENTION_THRESHOLDS.confidence;
}

export function modelForDomain(domain: Domain): string {
  return COMPLEX_DOMAINS.includes(domain) ? modelComplex() : modelSimple();
}

const RELEVANT_SIGNALS: Partial<Record<Domain, Signal["type"][]>> = {
  betalingen: ["subscription_increase", "duplicate_payment", "unusual_cost"],
  app_beveiliging: ["new_payee_new_device"],
};

export function relevantSignals(domain: Domain, signals: Signal[]): Signal[] {
  const allowed = RELEVANT_SIGNALS[domain] ?? [];
  return signals.filter((s) => allowed.includes(s.type));
}

export function scamWarning(lang: Language): Extract<Intervention, { type: "scam_warning" }> {
  return {
    type: "scam_warning",
    title: t(lang, "Mogelijke oplichting", "Possible arnaque", "Possible scam"),
    message: t(
      lang,
      "KBC vraagt nooit om geld naar een 'veilige rekening' over te zetten. Hang op, doe geen overschrijving en bel Card Stop of KBC via het nummer op je kaart.",
      "KBC ne vous demande jamais de transférer de l'argent vers un « compte sécurisé ». Raccrochez, ne faites aucun virement et appelez Card Stop ou KBC via le numéro figurant sur votre carte.",
      "KBC never asks you to move money to a 'safe account'. Hang up, make no transfer, and call Card Stop or KBC using the number on your card.",
    ),
  };
}

export function handoverIntervention(
  domain: Domain,
  classification: Classification,
  text: string,
  signalIds: string[],
): Extract<Intervention, { type: "handover" }> {
  const snippet = text.replace(/\s+/g, " ").trim().slice(0, 140);
  const sig = signalIds.length > 0 ? `; signalen: ${signalIds.join(", ")}` : "";
  return {
    type: "handover",
    summary: `Domein: ${DOMAIN_LABELS_NL[domain]}${sig}. Klant schrijft: "${snippet}${text.length > 140 ? "…" : ""}"`,
    reason:
      classification.frustration >= 0.6
        ? "Klant lijkt gefrustreerd en vraagt om menselijke hulp."
        : "Klant heeft hulp van een medewerker nodig.",
  };
}

export function handoverReply(lang: Language): string {
  return t(
    lang,
    "Ik breng je graag in contact met een medewerker van KBC. Ik heb een samenvatting van je vraag klaargezet zodat je niet alles opnieuw moet uitleggen.",
    "Je vous mets volontiers en contact avec un collaborateur de KBC. J'ai préparé un résumé de votre demande pour que vous n'ayez pas à tout réexpliquer.",
    "I'll gladly connect you with a KBC colleague. I've prepared a summary of your question so you don't have to explain everything again.",
  );
}

export function clarifyIntervention(
  classification: Classification,
  lang: Language,
): Extract<Intervention, { type: "clarify" }> {
  const options: Domain[] = [];
  for (const d of [classification.domain, classification.secondaryDomain ?? "onduidelijk", ...DOMAINS]) {
    if (d !== "onduidelijk" && !options.includes(d)) options.push(d);
    if (options.length === 3) break;
  }
  const labels = options.map((d) => DOMAIN_LABELS_NL[d]).join(", ");
  return {
    type: "clarify",
    question: t(
      lang,
      `Kan je iets meer vertellen? Gaat je vraag over: ${labels}?`,
      `Pouvez-vous m'en dire un peu plus ? Votre question concerne-t-elle : ${labels} ?`,
      `Could you tell me a bit more? Is your question about: ${labels}?`,
    ),
    options,
  };
}

export function scamContextLine(): string {
  return "Waarschuwing: de klant lijkt mogelijk doelwit van oplichting. Raad af om geld over te maken of codes te delen en verwijs naar Card Stop of KBC via het kaartnummer.";
}
