import "server-only";
import { z } from "zod";
import type { Domain, ToolContext, ToolDefinition } from "@/lib/contracts";
import {
  getAccounts,
  getCards,
  getBalanceSummary,
  getInsurances,
  getInvestments,
  getLoans,
  getLoginEvents,
  getPayees,
  getSalaryPayments,
  getTransactions,
} from "@/lib/data";

const MAX_ITEMS = 20;
const CATEGORIES = [
  "abonnement",
  "energie",
  "restaurant",
  "boodschappen",
  "huur",
  "transport",
  "loon",
  "sparen",
  "verzekering",
  "krediet",
  "overschrijving",
  "overig",
] as const;
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

const TransactionsInput = z
  .object({
    category: z.enum(CATEGORIES).optional(),
    from: isoDate.optional(),
    to: isoDate.optional(),
    limit: z.number().int().min(1).max(50).optional(),
  })
  .strict();
const EmptyInput = z.object({}).strict();

const emptySchema = { type: "object", properties: {}, additionalProperties: false } as const;

function simple(name: string, description: string, run: (ctx: ToolContext) => unknown): ToolDefinition {
  return {
    name,
    description,
    input_schema: { ...emptySchema, properties: {} },
    async run(input, ctx) {
      EmptyInput.parse(input ?? {});
      return run(ctx);
    },
  };
}

const get_transactions: ToolDefinition = {
  name: "get_transactions",
  description: "Recente transacties van de klant (nieuwste eerst), optioneel gefilterd. Bedrag negatief = uitgave.",
  input_schema: {
    type: "object",
    properties: {
      category: { type: "string", enum: [...CATEGORIES] },
      from: { type: "string", description: "ISO-datum yyyy-mm-dd" },
      to: { type: "string", description: "ISO-datum yyyy-mm-dd" },
      limit: { type: "integer", minimum: 1, maximum: 50 },
    },
    additionalProperties: false,
  },
  async run(input, ctx) {
    const f = TransactionsInput.parse(input ?? {});
    const rows = getTransactions(ctx.customerId, { ...f, limit: f.limit ?? MAX_ITEMS });
    return rows.slice(0, f.limit ?? MAX_ITEMS).map((t) => ({
      date: t.date,
      amount: t.amount,
      counterparty: t.counterparty,
      category: t.category,
      type: t.type,
    }));
  },
};

const get_balance_summary = simple(
  "get_balance_summary",
  "Uitgaven deze maand versus gemiddelde van vorige maanden, per categorie.",
  (ctx) => getBalanceSummary(ctx.customerId),
);
const get_cards = simple("get_cards", "Bankkaarten van de klant met status en maandlimiet.", (ctx) =>
  getCards(ctx.customerId).slice(0, MAX_ITEMS),
);
const get_accounts = simple("get_accounts", "Rekeningen (zicht, spaar, beleg) met saldo.", (ctx) =>
  getAccounts(ctx.customerId).slice(0, MAX_ITEMS),
);
const get_investments = simple("get_investments", "Beleggingen met waarde en evolutie over 3 maanden.", (ctx) =>
  getInvestments(ctx.customerId).slice(0, MAX_ITEMS),
);
const get_loans = simple("get_loans", "Kredieten met openstaand bedrag, maandlast, rente en einddatum.", (ctx) =>
  getLoans(ctx.customerId).slice(0, MAX_ITEMS),
);
const get_insurances = simple("get_insurances", "Verzekeringen met maandpremie en dekking.", (ctx) =>
  getInsurances(ctx.customerId).slice(0, MAX_ITEMS),
);
const get_login_events = simple("get_login_events", "Recente aanmeldingen in de app (toestel, locatie, nieuw toestel).", (ctx) =>
  getLoginEvents(ctx.customerId).slice(0, MAX_ITEMS),
);
const get_payees = simple("get_payees", "Opgeslagen begunstigden met datum van toevoeging.", (ctx) =>
  getPayees(ctx.customerId).slice(0, MAX_ITEMS),
);
const get_salary_payments = simple("get_salary_payments", "Recente loonstortingen (SD Worx).", (ctx) =>
  getSalaryPayments(ctx.customerId)
    .slice(0, MAX_ITEMS)
    .map((t) => ({ date: t.date, amount: t.amount, counterparty: t.counterparty })),
);

export const DOMAIN_TOOLS: Readonly<Record<Exclude<Domain, "onduidelijk">, ToolDefinition[]>> = {
  betalingen: [get_transactions, get_balance_summary],
  kaarten: [get_cards, get_transactions],
  sparen_beleggen: [get_accounts, get_investments],
  kredieten: [get_loans],
  verzekeringen: [get_insurances],
  app_beveiliging: [get_login_events, get_payees],
  loon_hr: [get_salary_payments],
};

export function toolsForDomain(domain: Domain): ToolDefinition[] {
  return domain === "onduidelijk" ? ALL_TOOLS : DOMAIN_TOOLS[domain];
}

export const ALL_TOOLS: ToolDefinition[] = [
  get_transactions,
  get_balance_summary,
  get_cards,
  get_accounts,
  get_investments,
  get_loans,
  get_insurances,
  get_login_events,
  get_payees,
  get_salary_payments,
];
