import { getTransactions } from "@/lib/data";
import type { SignalCandidate } from "@/lib/contracts";
import { eur, normalizeMerchant, toMs } from "./normalize.ts";

const WINDOW_MS = 48 * 3600 * 1000;

export function detectDuplicatePayments(customerId: string): SignalCandidate[] {
  const txs = getTransactions(customerId)
    .filter((t) => t.amount < 0 && t.type === "card")
    .reverse();
  const out: SignalCandidate[] = [];
  const used = new Set<string>();
  for (let i = 0; i < txs.length; i++) {
    const a = txs[i];
    if (!a || used.has(a.id)) continue;
    for (let j = i + 1; j < txs.length; j++) {
      const b = txs[j];
      if (!b || used.has(b.id)) continue;
      const gap = toMs(b.date, b.time) - toMs(a.date, a.time);
      if (gap > WINDOW_MS) break;
      if (a.amount !== b.amount || normalizeMerchant(a.merchantRaw) !== normalizeMerchant(b.merchantRaw)) continue;
      used.add(a.id);
      used.add(b.id);
      const minutes = Math.round(gap / 60000);
      const span = minutes < 120 ? `${minutes} minuten` : `${Math.round(minutes / 60)} uur`;
      out.push({
        id: `duplicate_payment:${b.id}`,
        type: "duplicate_payment",
        title: `Mogelijk dubbele betaling bij ${a.counterparty}`,
        explanation: `Je betaalde ${eur(-a.amount)} twee keer aan ${a.counterparty} binnen ${span} (${a.date} ${a.time ?? ""} en ${b.date} ${b.time ?? ""}). Dat lijkt op een dubbele afrekening.`,
        amount: b.amount,
        currency: "EUR",
        merchant: a.counterparty,
        date: b.date,
        relatedTransactionIds: [a.id, b.id],
        severity: "warning",
      });
      break;
    }
  }
  return out;
}
