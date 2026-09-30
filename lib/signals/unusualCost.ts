import { getTransactions } from "@/lib/data";
import type { Transaction } from "@/lib/data";
import type { SignalCandidate } from "@/lib/contracts";
import { eur } from "./normalize.ts";

/** Enkel variabele categorieën; vaste lasten en overschrijvingen vallen erbuiten. */
const VARIABLE: readonly Transaction["category"][] = ["energie", "boodschappen", "restaurant", "transport", "abonnement", "overig"];
const RATIO = 1.8;
const MIN_DIFF = 50;

export function detectUnusualCosts(customerId: string): SignalCandidate[] {
  const spend = getTransactions(customerId).filter((t) => t.amount < 0 && VARIABLE.includes(t.category));
  const months = [...new Set(spend.map((t) => t.date.slice(0, 7)))].sort();
  const current = months[months.length - 1];
  const prev = months.slice(0, -1);
  if (!current || prev.length < 2) return [];
  const out: SignalCandidate[] = [];
  for (const category of VARIABLE) {
    const total = (m: string) => spend.filter((t) => t.category === category && t.date.startsWith(m)).reduce((s, t) => s - t.amount, 0);
    const now = total(current);
    const avg = prev.reduce((s, m) => s + total(m), 0) / prev.length;
    if (avg <= 0 || now <= avg * RATIO || now - avg <= MIN_DIFF) continue;
    const txs = spend.filter((t) => t.category === category && t.date.startsWith(current));
    const last = txs[0];
    if (!last) continue;
    const factor = String(Math.round((now / avg) * 10) / 10).replace(".", ",");
    out.push({
      id: `unusual_cost:${category}:${current}`,
      type: "unusual_cost",
      title: `Ongewoon hoge kost: ${category}`,
      explanation: `Je ${category}-uitgaven deze maand bedragen ${eur(now)}, terwijl je normaal ongeveer ${eur(avg)} per maand uitgeeft (${factor}× zoveel, ${eur(now - avg)} meer).`,
      amount: -now,
      currency: "EUR",
      merchant: last.counterparty,
      date: last.date,
      relatedTransactionIds: txs.map((t) => t.id),
      severity: "warning",
    });
  }
  return out;
}
