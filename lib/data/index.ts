import "server-only";
import sofie from "./sofie.json";
import transactionsJson from "./transactions.json";

export const DEMO_CUSTOMER_ID = "sofie-demo";

export type Transaction = {
  id: string;
  date: string;
  time?: string;
  amount: number;
  currency: "EUR";
  counterparty: string;
  merchantRaw: string;
  category:
    | "abonnement"
    | "energie"
    | "restaurant"
    | "boodschappen"
    | "huur"
    | "transport"
    | "loon"
    | "sparen"
    | "verzekering"
    | "krediet"
    | "overschrijving"
    | "overig";
  accountId: string;
  type: "card" | "transfer" | "direct_debit" | "salary";
};
export type Account = { id: string; kind: "zicht" | "spaar" | "beleg"; name: string; ibanMasked: string; balance: number };
export type Card = { id: string; kind: "debet" | "krediet"; last4: string; status: "actief" | "geblokkeerd"; monthlyLimit: number };
export type LoginEvent = { id: string; timestamp: string; device: string; newDevice: boolean; location: string };
export type Payee = { id: string; name: string; ibanMasked: string; addedAt: string };
export type Profile = { id: string; firstName: string; language: "nl"; employer: string; payrollProvider: "SD Worx" };
export type Loan = { id: string; kind: string; outstanding: number; monthly: number; rate: number; endDate: string };
export type Insurance = { id: string; kind: string; premiumMonthly: number; coverage: string };
export type Investment = { id: string; name: string; value: number; changePct3m: number };

const ALL_TRANSACTIONS = transactionsJson as unknown as Transaction[];
const PROFILE = sofie.profile as Profile;
const ACCOUNTS = sofie.accounts as Account[];
const CARDS = sofie.cards as Card[];
const LOANS = sofie.loans as Loan[];
const INSURANCES = sofie.insurances as Insurance[];
const INVESTMENTS = sofie.investments as Investment[];
const PAYEES = sofie.payees as Payee[];
const LOGINS = sofie.logins as LoginEvent[];

function assertCustomer(customerId: string): void {
  if (customerId !== DEMO_CUSTOMER_ID) throw new Error("Onbekende klant.");
}

const byDateDesc = (a: Transaction, b: Transaction) =>
  `${b.date}${b.time ?? ""}`.localeCompare(`${a.date}${a.time ?? ""}`);

export function getProfile(customerId: string): Profile {
  assertCustomer(customerId);
  return { ...PROFILE };
}

export function getAccounts(customerId: string): Account[] {
  assertCustomer(customerId);
  return ACCOUNTS.map((a) => ({ ...a }));
}

export function getTransactions(
  customerId: string,
  filter?: { category?: Transaction["category"]; from?: string; to?: string; limit?: number },
): Transaction[] {
  assertCustomer(customerId);
  let list = ALL_TRANSACTIONS.filter(
    (t) =>
      (!filter?.category || t.category === filter.category) &&
      (!filter?.from || t.date >= filter.from) &&
      (!filter?.to || t.date <= filter.to),
  ).sort(byDateDesc);
  if (filter?.limit !== undefined && filter.limit >= 0) list = list.slice(0, filter.limit);
  return list.map((t) => ({ ...t }));
}

export function getCards(customerId: string): Card[] {
  assertCustomer(customerId);
  return CARDS.map((c) => ({ ...c }));
}

export function getLoans(customerId: string): Loan[] {
  assertCustomer(customerId);
  return LOANS.map((l) => ({ ...l }));
}

export function getInsurances(customerId: string): Insurance[] {
  assertCustomer(customerId);
  return INSURANCES.map((i) => ({ ...i }));
}

export function getInvestments(customerId: string): Investment[] {
  assertCustomer(customerId);
  return INVESTMENTS.map((i) => ({ ...i }));
}

export function getSalaryPayments(customerId: string): Transaction[] {
  assertCustomer(customerId);
  return ALL_TRANSACTIONS.filter((t) => t.category === "loon").sort(byDateDesc).map((t) => ({ ...t }));
}

export function getLoginEvents(customerId: string): LoginEvent[] {
  assertCustomer(customerId);
  return LOGINS.map((l) => ({ ...l }));
}

export function getPayees(customerId: string): Payee[] {
  assertCustomer(customerId);
  return PAYEES.map((p) => ({ ...p }));
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/** Huidige maand = laatste maand in de data; vergelijking met gemiddelde van de voorgaande maanden. */
export function getBalanceSummary(customerId: string): {
  currentMonthSpend: number;
  avgPrevMonthsSpend: number;
  byCategory: { category: string; current: number; avgPrev: number }[];
} {
  assertCustomer(customerId);
  const spend = ALL_TRANSACTIONS.filter((t) => t.amount < 0 && t.category !== "sparen");
  const months = [...new Set(spend.map((t) => t.date.slice(0, 7)))].sort();
  const current = months[months.length - 1];
  const prev = months.slice(0, -1);
  const categories = [...new Set(spend.map((t) => t.category))].sort();
  const total = (month: string, cat?: string) =>
    spend.filter((t) => t.date.startsWith(month) && (!cat || t.category === cat)).reduce((s, t) => s - t.amount, 0);
  const avgPrev = (cat?: string) => (prev.length ? prev.reduce((s, m) => s + total(m, cat), 0) / prev.length : 0);
  return {
    currentMonthSpend: current ? round2(total(current)) : 0,
    avgPrevMonthsSpend: round2(avgPrev()),
    byCategory: categories.map((category) => ({
      category,
      current: current ? round2(total(current, category)) : 0,
      avgPrev: round2(avgPrev(category)),
    })),
  };
}
