import "server-only";
import {
  ClassificationSchema,
  NOTIFY_THRESHOLDS,
  NotifyDecisionSchema,
  SmsVerdictSchema,
  type ChatTurn,
  type Classification,
  type Classifier,
  type Domain,
  type Language,
  type NotifyDecision,
  type SignalCandidate,
  type SmsVerdict,
} from "@/lib/contracts";

const MAX_CHARS = 1000;

/** Normaliseer: lowercase, accenten weg, enkel [a-z0-9] en spaties. */
export function normalizeText(input: string): string {
  return input
    .slice(0, MAX_CHARS)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function tokenSet(norm: string): Set<string> {
  return new Set(norm.split(" ").filter((t) => t.length > 0));
}

/** "=woord" = exact token; anders substring op genormaliseerde tekst. */
function matches(norm: string, tokens: Set<string>, kw: string): boolean {
  if (kw.startsWith("=")) return tokens.has(kw.slice(1));
  return norm.includes(kw);
}

function firstMatch(norm: string, tokens: Set<string>, kws: readonly string[]): string | null {
  for (const kw of kws) {
    if (matches(norm, tokens, kw)) return kw.startsWith("=") ? kw.slice(1) : kw;
  }
  return null;
}

function clamp01(n: number): number {
  return Math.min(1, Math.max(0, n));
}

// ---------------------------------------------------------------- taal

const STOPWORDS: Readonly<Record<Language, readonly string[]>> = {
  nl: ["het", "een", "en", "ik", "mijn", "niet", "van", "op", "te", "voor", "met", "dat", "die", "hoe", "waarom", "wat", "kan", "ook", "maar", "nog", "heb", "om", "naar", "aan", "er", "staat", "ben", "zijn", "moet", "mij", "me", "geen", "dan", "wordt"],
  fr: ["le", "la", "les", "je", "du", "des", "un", "une", "ma", "mes", "mon", "pour", "que", "qui", "et", "ce", "cette", "avec", "sur", "dans", "vous", "nous", "il", "est", "pas", "n", "j", "ne", "comment", "pourquoi", "mais", "au", "aux", "sont", "suis"],
  en: ["the", "my", "i", "to", "of", "and", "for", "you", "it", "with", "this", "that", "are", "was", "not", "have", "how", "why", "what", "can", "do", "me", "on", "from", "but", "be", "am", "does", "did", "your"],
};

export function detectLanguage(text: string): Language {
  const tokens = normalizeText(text).split(" ");
  const score: Record<Language, number> = { nl: 0, fr: 0, en: 0 };
  for (const lang of ["nl", "fr", "en"] as const) {
    const list = STOPWORDS[lang];
    for (const t of tokens) if (list.includes(t)) score[lang] += 1;
  }
  if (score.nl === 0 && score.fr === 0 && score.en === 0) return "nl";
  if (score.nl >= score.fr && score.nl >= score.en) return "nl";
  return score.fr >= score.en ? "fr" : "en";
}

// ---------------------------------------------------------------- domein

type Weighted = readonly (readonly [string, number])[];

const DOMAIN_KEYWORDS: Readonly<Record<Exclude<Domain, "onduidelijk">, Weighted>> = {
  betalingen: [
    ["rekening", 2], ["saldo", 2], ["overschrijving", 2], ["overschrijf", 2], ["betaal", 2], ["betaling", 2],
    ["uitgave", 2], ["uitgegeven", 1], ["afschrift", 2], ["domiciliering", 2], ["transactie", 2], ["bancontact", 1],
    ["storting", 1], ["abonnement", 1], ["=geld", 1], ["begunstigde", 1], ["=iban", 1],
    ["compte", 2], ["virement", 2], ["paiement", 2], ["solde", 2], ["depense", 2], ["prelevement", 2],
    ["transaction", 2], ["=argent", 1], ["payment", 2], ["=account", 1], ["balance", 2], ["spending", 2],
    ["statement", 2], ["direct debit", 2], ["=money", 1], ["=transfer", 1],
  ],
  kaarten: [
    ["=kaart", 2], ["=kaarten", 2], ["bankkaart", 2], ["kredietkaart", 2], ["debetkaart", 2], ["geblokkeerd", 2],
    ["blokkeer", 2], ["blokkeren", 2], ["=visa", 1], ["mastercard", 1], ["contactloos", 1], ["limiet", 1], ["=cvv", 1],
    ["=pincode", 1], ["=carte", 2], ["=cartes", 2], ["bloque", 2], ["bloquer", 2], ["opposition", 2], ["plafond", 1],
    ["=card", 2], ["=cards", 2], ["=blocked", 2], ["=block", 1], ["credit card", 3], ["debit card", 3],
    ["carte de credit", 3], ["contactless", 1],
  ],
  sparen_beleggen: [
    ["spaar", 2], ["sparen", 2], ["beleg", 2], ["aandelen", 2], ["=fonds", 2], ["=etf", 2], ["=rente", 1],
    ["pensioen", 2], ["rendement", 2], ["portefeuille", 1], ["epargne", 2], ["placer", 2], ["investir", 2],
    ["investissement", 2], ["bourse", 2], ["savings", 2], ["saving", 2], ["invest", 2], ["=stocks", 1],
    ["=fund", 2], ["=funds", 2], ["pension", 1], ["=actions", 1],
  ],
  kredieten: [
    ["lening", 2], ["=krediet", 2], ["=kredieten", 2], ["woonkrediet", 2], ["hypotheek", 2], ["aflossing", 2],
    ["terugbetal", 1], ["schuld", 1], ["looptijd", 2], ["=credit", 2], ["=credits", 2], ["=pret", 2], ["hypotheque", 2],
    ["remboursement", 1], ["emprunt", 2], ["mortgage", 2], ["=loan", 2], ["=loans", 2], ["borrow", 2], ["repayment", 1],
    ["=interest", 1],
  ],
  verzekeringen: [
    ["verzeker", 2], ["polis", 2], ["schade", 1], ["dekking", 2], ["franchise", 1], ["hospitalisatie", 2],
    ["ziekenhuis", 1], ["=premie", 1], ["=premies", 1], ["ongeval", 1], ["assurance", 2], ["sinistre", 2],
    ["couverture", 1], ["mutuelle", 2], ["insurance", 2], ["=insured", 2], ["=claim", 1], ["coverage", 2],
    ["=policy", 2], ["accident", 1],
  ],
  app_beveiliging: [
    ["=app", 2], ["itsme", 2], ["wachtwoord", 2], ["phishing", 2], ["=code", 1], ["=pin", 1], ["=pincode", 1],
    ["inloggen", 2], ["aanmelden", 1], ["=login", 2], ["kaartlezer", 2], ["beveilig", 2], ["fraude", 2],
    ["oplichting", 2], ["oplicht", 2], ["=scam", 2], ["=sms", 1], ["verdacht", 1], ["gehackt", 2], ["=hack", 2],
    ["mot de passe", 2], ["connecter", 2], ["securite", 2], ["arnaque", 2], ["password", 2], ["log in", 2],
    ["sign in", 2], ["secur", 2], ["fraud", 2], ["hacked", 2], ["=otp", 1], ["application", 2], ["nieuw toestel", 1],
    ["=phishing", 1],
  ],
  loon_hr: [
    ["loon", 2], ["loonstorting", 1], ["salaris", 2], ["loonbrief", 2], ["loonfiche", 2], ["payslip", 2],
    ["sd worx", 2], ["werkgever", 2], ["verlof", 2], ["vakantiegeld", 2], ["eindejaarspremie", 2],
    ["bedrijfswagen", 1], ["salaire", 2], ["fiche de paie", 2], ["employeur", 2], ["conges", 2], ["=paie", 2],
    ["payroll", 2], ["salary", 2], ["=wage", 2], ["=wages", 2], ["employer", 2], ["=leave", 1], ["=bonus", 1],
  ],
};

const DOMAIN_ORDER = Object.keys(DOMAIN_KEYWORDS) as (keyof typeof DOMAIN_KEYWORDS)[];

function scoreDomains(norm: string, tokens: Set<string>): { domain: keyof typeof DOMAIN_KEYWORDS; score: number }[] {
  const out: { domain: keyof typeof DOMAIN_KEYWORDS; score: number }[] = [];
  for (const domain of DOMAIN_ORDER) {
    let score = 0;
    for (const [kw, w] of DOMAIN_KEYWORDS[domain]) if (matches(norm, tokens, kw)) score += w;
    out.push({ domain, score });
  }
  return out.sort((a, b) => b.score - a.score);
}

// ---------------------------------------------------------------- rode vlaggen (scam + sms)

type RedFlag = { id: string; weight: number; keywords: readonly string[]; reason: (kw: string) => string; all?: readonly string[] };

const RED_FLAGS: readonly RedFlag[] = [
  {
    id: "safe_account", weight: 0.65,
    keywords: ["veilige rekening", "veilig rekening", "compte securise", "compte sur", "safe account", "secure account", "safe bank account"],
    reason: () => "Vraagt om geld naar een 'veilige rekening' te sturen: een bank doet dit nooit.",
  },
  {
    id: "bank_called", weight: 0.3,
    keywords: ["bank belde", "bank heeft gebeld", "bank gebeld", "iemand van de bank", "medewerker van de bank", "banque a appele", "la banque m a", "quelqu un de la banque", "bank called", "from the bank called", "bank rang", "someone from the bank", "bank phoned"],
    reason: () => "Iemand die zich als de bank voorstelt nam telefonisch contact op: een typisch oplichtingsscenario.",
  },
  {
    id: "transfer", weight: 0.25,
    keywords: ["geld overzetten", "spaargeld overzetten", "overzetten naar", "geld overschrijven", "overschrijven naar", "overboeken", "virer", "transferer mon", "transferer l argent", "move my money", "transfer my", "transfer the money", "transfer money", "overzetten"],
    reason: () => "Vraagt om geld over te zetten of over te schrijven.",
  },
  {
    id: "credentials", weight: 0.45,
    keywords: ["doorgeven", "communiquer", "donner mon", "donner le", "transmettre", "read out", "give them", "give him", "give her", "share my", "share the", "bevestigen via itsme", "itsme bevestigen", "confirm with itsme", "confirmer avec itsme"],
    all: ["=code", "=pin", "=pincode", "kaartlezer", "itsme", "wachtwoord", "mot de passe", "password", "=otp"],
    reason: () => "Vraagt om een code, pincode of itsme-bevestiging door te geven: deel dit nooit met anderen.",
  },
  {
    id: "click", weight: 0.3,
    keywords: ["klik hier", "klik op", "tik op", "cliquez", "click here", "click on", "click the link", "click the"],
    reason: () => "Vraagt om op een link te klikken.",
  },
  {
    id: "urgency", weight: 0.25,
    keywords: ["vervalt vandaag", "verloopt vandaag", "vervalt binnen", "binnen 24 uur", "dringend", "onmiddellijk", "laatste kans", "expire", "expires today", "within 24 hours", "urgent", "immediately", "immediatement", "expire aujourd", "aujourd hui"],
    reason: (kw) => `Tijdsdruk: '${kw}'.`,
  },
  {
    id: "app_renewal", weight: 0.4,
    keywords: ["verleng", "vernieuw", "renew", "prolong", "renouvel"],
    all: ["=app", "app "],
    reason: () => "KBC vraagt nooit via sms om je app te verlengen of te vernieuwen.",
  },
];

function hasLink(rawLower: string): boolean {
  return ["http", "www.", "bit.ly", "tinyurl", ".be/", ".com/"].some((p) => rawLower.includes(p));
}

function evaluateRedFlags(text: string): { score: number; reasons: string[]; categories: number } {
  const slice = text.slice(0, MAX_CHARS);
  const raw = slice.toLowerCase();
  const norm = normalizeText(slice);
  const padded = `${norm} `;
  const tokens = tokenSet(norm);
  let score = 0;
  let categories = 0;
  const reasons: string[] = [];

  for (const flag of RED_FLAGS) {
    const hit = firstMatch(norm, tokens, flag.keywords);
    if (hit === null) continue;
    if (flag.all && !flag.all.some((kw) => (kw === "app " ? padded.includes(" app ") : matches(norm, tokens, kw)))) continue;
    score += flag.weight;
    categories += 1;
    reasons.push(flag.reason(hit));
  }

  if (hasLink(raw)) {
    const short = raw.includes("bit.ly") || raw.includes("tinyurl");
    score += short ? 0.4 : 0.3;
    categories += 1;
    reasons.push(short ? "Bevat een verkorte link (bit.ly of gelijkaardig): je ziet niet waar die naartoe leidt." : "Bevat een link naar een onbekende website.");
  }

  if (categories >= 2) score += 0.15;
  if (norm.includes("kbc") && categories >= 2) reasons.push("Doet zich voor als KBC, maar KBC vraagt je nooit om via sms of telefoon in te loggen of codes te delen.");

  return { score: clamp01(score), reasons: reasons.slice(0, 10), categories };
}

// ---------------------------------------------------------------- frustratie / mens / risico

const FRUSTRATION_STRONG: readonly string[] = [
  "al drie keer", "al twee keer", "al vier keer", "al vijf keer", "al weken", "nog steeds", "nog altijd", "belachelijk", "nutteloos",
  "waardeloos", "schandalig", "kan niet waar zijn", "toujours pas", "encore une fois", "ridicule", "inutile", "deja trois fois",
  "deja deux fois", "pour la troisieme fois", "still not", "still no", "useless", "ridiculous", "third time", "for the third time",
  "already told", "nul", "=unacceptable",
];
const FRUSTRATION_WEAK: readonly string[] = ["alweer", "opnieuw", "=encore", "=again", "=still", "=terrible", "=pff", "=zucht", "frustr"];

const HUMAN_PHRASES: readonly string[] = [
  "medewerker", "iemand spreken", "iemand praten", "met iemand", "echte persoon", "=mens", "een mens", "klantendienst",
  "adviseur", "conseiller", "parler a quelqu", "agent humain", "une personne", "un humain", "quelqu un", "=human",
  "=agent", "real person", "speak to someone", "talk to someone", "speak to a", "talk to a", "representative",
  "bel me", "rappelez", "call me",
];

function jaccard(a: string, b: string): number {
  const ta = tokenSet(a);
  const tb = tokenSet(b);
  if (ta.size === 0 || tb.size === 0) return 0;
  let inter = 0;
  for (const t of ta) if (tb.has(t)) inter += 1;
  return inter / (ta.size + tb.size - inter);
}

function frustrationScore(rawText: string, norm: string, tokens: Set<string>, history: ChatTurn[] | undefined): number {
  let score = 0;
  if (firstMatch(norm, tokens, FRUSTRATION_STRONG) !== null) score += 0.55;
  if (firstMatch(norm, tokens, FRUSTRATION_WEAK) !== null) score += 0.25;
  const bangs = rawText.slice(0, MAX_CHARS).split("!").length - 1;
  if (bangs >= 2) score += 0.25;
  else if (bangs === 1) score += 0.1;
  if (history) {
    for (let i = history.length - 1; i >= 0; i -= 1) {
      const turn = history[i];
      if (turn && turn.role === "user") {
        if (jaccard(norm, normalizeText(turn.content)) >= 0.6) score += 0.5;
        break;
      }
    }
  }
  return clamp01(score);
}

const PERSONAL: readonly string[] = ["=mijn", "=mon", "=ma", "=mes", "=my", "=ik", "=j", "=i"];
const ACCOUNT_WORDS: readonly string[] = ["rekening", "uitgave", "saldo", "=geld", "compte", "depense", "=argent", "=account", "spending", "balance", "=money", "afschrift"];
const VAGUE_WORDS: readonly string[] = ["=waarom", "=pourquoi", "=why", "=lager", "=hoger", "=minder", "=meer", "=raar", "=vreemd", "=weird", "=moins", "=plus", "=less", "=lower", "=higher", "=weinig", "normaal"];

function genericRiskScore(raw: string, norm: string, tokens: Set<string>): number {
  const personal = firstMatch(norm, tokens, PERSONAL) !== null;
  const account = firstMatch(norm, tokens, ACCOUNT_WORDS) !== null;
  const vague = firstMatch(norm, tokens, VAGUE_WORDS) !== null;
  let score = 0.1;
  if (personal && account && vague) score = 0.85;
  else if (account && vague) score = 0.7;
  else if (personal && account) score = 0.5;
  else if (vague && personal) score = 0.3;
  const specific = /[0-9]/.test(raw.slice(0, MAX_CHARS)) || raw.includes("€") || norm.includes("iban");
  if (specific) score -= 0.35;
  return clamp01(score);
}

// ---------------------------------------------------------------- classifier

function domainConfidence(top: number, second: number): number {
  if (top <= 0) return 0.2;
  const base = 0.4 + 0.175 * Math.min(top, 3.2);
  const ratio = (top - second) / top;
  return clamp01(Math.min(0.95, base * (0.75 + 0.25 * ratio)));
}

export class FallbackClassifier implements Classifier {
  readonly name = "fallback" as const;

  async classify(text: string, history?: ChatTurn[]): Promise<Classification> {
    const raw = text.slice(0, MAX_CHARS);
    const norm = normalizeText(raw);
    const tokens = tokenSet(norm);

    const ranked = scoreDomains(norm, tokens);
    const top = ranked[0];
    const second = ranked[1];
    const topScore = top?.score ?? 0;
    const secondScore = second?.score ?? 0;
    let confidence = domainConfidence(topScore, secondScore);
    let domain: Domain = top && topScore > 0 && confidence >= 0.6 ? top.domain : "onduidelijk";
    let secondary: Domain | null = second && topScore > 0 && secondScore >= 0.5 * topScore && secondScore > 0 && domain !== "onduidelijk" ? second.domain : null;

    const flags = evaluateRedFlags(raw);
    const scam = flags.score;
    if (scam >= 0.6) {
      if (domain !== "app_beveiliging") secondary = domain !== "onduidelijk" ? domain : null;
      domain = "app_beveiliging";
      confidence = Math.max(confidence, 0.85);
    }

    const frustration = frustrationScore(raw, norm, tokens, history);
    const explicitHuman = firstMatch(norm, tokens, HUMAN_PHRASES) !== null;
    let needsHuman = 0.05;
    if (explicitHuman) needsHuman = 0.9;
    if (scam >= 0.8) needsHuman = Math.max(needsHuman, 0.7);
    else if (scam >= 0.6) needsHuman = Math.max(needsHuman, 0.6);
    if (frustration >= 0.6) needsHuman = Math.max(needsHuman, 0.65);
    else needsHuman = Math.max(needsHuman, frustration * 0.5);

    return ClassificationSchema.parse({
      domain,
      confidence,
      secondaryDomain: secondary,
      generic_risk: genericRiskScore(raw, norm, tokens),
      frustration,
      scam_signal: scam,
      needs_human: clamp01(needsHuman),
      language: detectLanguage(raw),
      source: "fallback",
    });
  }

  async decideNotify(signal: SignalCandidate): Promise<NotifyDecision> {
    const explanation = signal.explanation.slice(0, 500);
    let score: number;
    switch (signal.type) {
      case "new_payee_new_device":
        score = signal.severity === "critical" ? 0.95 : signal.severity === "warning" ? 0.8 : 0.5;
        break;
      case "duplicate_payment":
        score = signal.severity === "critical" ? 0.85 : signal.severity === "warning" ? 0.75 : 0.5;
        break;
      case "unusual_cost": {
        score = signal.severity === "critical" ? 0.8 : signal.severity === "warning" ? 0.6 : 0.4;
        if (Math.abs(signal.amount) >= 200) score += 0.1;
        const m = /(\d+(?:[.,]\d+)?)\s?(?:x|keer|×)/.exec(explanation);
        const ratio = m?.[1] ? Number.parseFloat(m[1].replace(",", ".")) : 0;
        if (ratio > 2) score = Math.max(score, 0.7);
        break;
      }
      case "subscription_increase": {
        const m = /(\d+(?:[.,]\d+)?)\s?%/.exec(explanation);
        const pct = m?.[1] ? Number.parseFloat(m[1].replace(",", ".")) : null;
        if (pct === null) score = signal.severity === "info" ? 0.4 : 0.65;
        else if (pct >= 10) score = pct >= 25 ? 0.75 : 0.65;
        else score = 0.3;
        break;
      }
    }
    score = clamp01(score);
    return NotifyDecisionSchema.parse({ notify: score >= NOTIFY_THRESHOLDS[signal.type], score });
  }

  async judgeSms(text: string): Promise<SmsVerdict> {
    return SmsVerdictSchema.parse(judgeSmsSync(text));
  }
}

/** Gedeeld met LocalJeffClassifier voor de uitleg per rode vlag. */
export function judgeSmsSync(text: string): SmsVerdict {
  const { score, reasons } = evaluateRedFlags(text);
  const verdict = score >= 0.6 ? "phishing" : score >= 0.3 ? "verdacht" : "veilig";
  return {
    verdict,
    score,
    reasons: reasons.length > 0 ? reasons : ["Geen typische rode vlaggen gevonden (link, tijdsdruk, vraag naar codes)."],
  };
}
