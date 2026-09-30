import { getTransactions } from "@/lib/data";
import type { SignalCandidate } from "@/lib/contracts";
import { eur, monthNameNl, normalizeMerchant } from "./normalize.ts";

export function detectSubscriptionIncreases(customerId: string): SignalCandidate[] {
  const txs = getTransactions(customerId, { category: "abonnement" })
    .filter((t) => t.amount < 0)
    .reverse(); // oudste eerst
  const groups = new Map<string, typeof txs>();
  for (const t of txs) {
    const key = normalizeMerchant(t.merchantRaw);
    groups.set(key, [...(groups.get(key) ?? []), t]);
  }
  const out: SignalCandidate[] = [];
  for (const list of groups.values()) {
    const months = new Set(list.map((t) => t.date.slice(0, 7)));
    if (list.length < 2 || months.size < 2) continue; // niet terugkerend
    const last = list[list.length - 1];
    const prev = list[list.length - 2];
    if (!last || !prev) continue;
    const now = -last.amount;
    const before = -prev.amount;
    if (now < before * 1.05) continue;
    const diff = Math.round((now - before) * 100) / 100;
    const pct = Math.round(((now - before) / before) * 1000) / 10;
    out.push({
      id: `subscription_increase:${last.id}`,
      type: "subscription_increase",
      title: `${last.counterparty} is duurder geworden`,
      explanation: `Je ${last.counterparty}-abonnement kost sinds ${monthNameNl(last.date)} ${eur(now)} in plaats van ${eur(before)} (+${eur(diff)}/maand, +${String(pct).replace(".", ",")}%).`,
      amount: last.amount,
      currency: "EUR",
      merchant: last.counterparty,
      date: last.date,
      relatedTransactionIds: [last.id],
      severity: "info",
    });
  }
  return out;
}
