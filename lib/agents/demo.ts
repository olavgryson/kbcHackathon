import "server-only";
import type { Domain, Language, Signal, ToolContext } from "@/lib/contracts";
import { DOMAIN_TOOLS } from "./tools";

const t = (lang: Language, nl: string, fr: string, en: string): string => (lang === "fr" ? fr : lang === "en" ? en : nl);
const eur = (n: number): string => `€${Math.abs(n).toFixed(2).replace(".", ",")}`;

export function detectLanguage(text: string): Language {
  const s = ` ${text.toLowerCase().slice(0, 500)} `;
  const score = (words: string[]) => words.reduce((n, w) => n + (s.includes(w) ? 1 : 0), 0);
  const fr = score([" mon ", " ma ", " je ", " est ", " pourquoi", " carte", " compte", " est-ce", " les ", " une ", "é"]);
  const en = score([" my ", " the ", " why ", " is ", " what ", " card ", " account", " how ", " i "]);
  const nl = score([" mijn ", " de ", " het ", " waarom", " niet ", " een ", " staat ", " rekening", " ik "]);
  if (fr > en && fr > nl) return "fr";
  if (en > fr && en > nl) return "en";
  return "nl";
}

export function baselineDemoReply(lang: Language): string {
  return t(
    lang,
    "Je saldo kan lager zijn door hogere uitgaven, terugkerende betalingen of domiciliëringen. Bekijk je rekeningoverzicht in de app of neem contact op met KBC voor meer hulp.",
    "Votre solde peut être plus bas à cause de dépenses plus élevées ou de paiements récurrents. Consultez l'aperçu de votre compte dans l'app ou contactez KBC pour plus d'aide.",
    "Your balance may be lower because of higher spending or recurring payments. Check your account overview in the app or contact KBC for more help.",
  );
}

function asRecords(v: unknown): Record<string, unknown>[] {
  return Array.isArray(v) ? (v.filter((x) => typeof x === "object" && x !== null) as Record<string, unknown>[]) : [];
}

/** Voert de read-only tools van het domein uit en vat letterlijk samen. */
async function summarizeDomain(domain: Domain, lang: Language, ctx: ToolContext): Promise<string> {
  if (domain === "onduidelijk") return "";
  const tools = DOMAIN_TOOLS[domain];
  const run = async (name: string, input: unknown = {}) => tools.find((x) => x.name === name)?.run(input, ctx);
  try {
    switch (domain) {
      case "betalingen": {
        const s = (await run("get_balance_summary")) as { currentMonthSpend: number; avgPrevMonthsSpend: number } | undefined;
        if (!s) return "";
        return t(
          lang,
          `Deze maand gaf je ${eur(s.currentMonthSpend)} uit, tegenover gemiddeld ${eur(s.avgPrevMonthsSpend)} in de vorige maanden.`,
          `Ce mois-ci vous avez dépensé ${eur(s.currentMonthSpend)}, contre ${eur(s.avgPrevMonthsSpend)} en moyenne les mois précédents.`,
          `This month you spent ${eur(s.currentMonthSpend)}, versus an average of ${eur(s.avgPrevMonthsSpend)} in previous months.`,
        );
      }
      case "kaarten": {
        const cards = asRecords(await run("get_cards"));
        const list = cards.map((c) => `${String(c.kind)} *${String(c.last4)} (${String(c.status)})`).join(", ");
        return t(lang, `Je kaarten: ${list}.`, `Vos cartes : ${list}.`, `Your cards: ${list}.`);
      }
      case "sparen_beleggen": {
        const acc = asRecords(await run("get_accounts"));
        const list = acc.map((a) => `${String(a.name)} ${eur(Number(a.balance))}`).join(", ");
        return t(lang, `Je rekeningen: ${list}.`, `Vos comptes : ${list}.`, `Your accounts: ${list}.`);
      }
      case "kredieten": {
        const l = asRecords(await run("get_loans"));
        const list = l
          .map((x) => `${String(x.kind)}: ${eur(Number(x.outstanding))} / ${eur(Number(x.monthly))}/m`)
          .join("; ");
        return t(lang, `Je kredieten (openstaand/maandlast): ${list}.`, `Vos crédits (restant/mensualité) : ${list}.`, `Your loans (outstanding/monthly): ${list}.`);
      }
      case "verzekeringen": {
        const i = asRecords(await run("get_insurances"));
        const list = i.map((x) => `${String(x.kind)} ${eur(Number(x.premiumMonthly))}/m`).join(", ");
        return t(lang, `Je verzekeringen: ${list}.`, `Vos assurances : ${list}.`, `Your insurances: ${list}.`);
      }
      case "app_beveiliging": {
        const e = asRecords(await run("get_login_events"));
        const nw = e.filter((x) => x.newDevice === true).length;
        return t(
          lang,
          `Ik zie ${e.length} recente aanmeldingen, waarvan ${nw} op een nieuw toestel.`,
          `Je vois ${e.length} connexions récentes, dont ${nw} sur un nouvel appareil.`,
          `I see ${e.length} recent logins, ${nw} of them on a new device.`,
        );
      }
      case "loon_hr": {
        const p = asRecords(await run("get_salary_payments"));
        const first = p[0];
        if (!first) return "";
        return t(
          lang,
          `Je laatste loonstorting: ${eur(Number(first.amount))} op ${String(first.date)}.`,
          `Votre dernier salaire : ${eur(Number(first.amount))} le ${String(first.date)}.`,
          `Your latest salary payment: ${eur(Number(first.amount))} on ${String(first.date)}.`,
        );
      }
    }
  } catch {
    return "";
  }
}

export async function plusDemoReply(args: {
  domain: Domain;
  lang: Language;
  signals: Signal[];
  ctx: ToolContext;
}): Promise<string> {
  const { domain, lang, signals, ctx } = args;
  const parts: string[] = [];
  if (signals.length > 0) {
    parts.push(t(lang, "Dit valt me op in je gegevens:", "Voici ce que je constate dans vos données :", "Here is what stands out in your data:"));
    signals.slice(0, 3).forEach((s, i) => parts.push(`${i + 1}) ${s.explanation}`));
  }
  const summary = await summarizeDomain(domain, lang, ctx);
  if (summary) parts.push(summary);
  parts.push(
    t(
      lang,
      "Wil je dat ik een van deze punten verder uitleg?",
      "Voulez-vous que j'explique l'un de ces points plus en détail ?",
      "Would you like me to explain any of these points further?",
    ),
  );
  return parts.join("\n");
}
