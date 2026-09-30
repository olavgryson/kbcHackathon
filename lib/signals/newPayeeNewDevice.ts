import { getLoginEvents, getPayees, getTransactions } from "@/lib/data";
import type { SignalCandidate } from "@/lib/contracts";
import { eur, toMs } from "./normalize.ts";

const DAY_MS = 24 * 3600 * 1000;

export function detectNewPayeeNewDevice(customerId: string): SignalCandidate[] {
  const payees = getPayees(customerId);
  const logins = getLoginEvents(customerId).filter((l) => l.newDevice);
  const out: SignalCandidate[] = [];
  for (const t of getTransactions(customerId)) {
    if (t.type !== "transfer" || t.amount >= 0) continue;
    const payee = payees.find((p) => p.name === t.counterparty);
    if (!payee) continue;
    const at = toMs(t.date, t.time);
    const added = Date.parse(`${payee.addedAt}Z`);
    if (at < added || at - added > 7 * DAY_MS) continue;
    const login = logins.find((l) => {
      const ts = Date.parse(`${l.timestamp}Z`);
      return at >= ts && at - ts <= DAY_MS;
    });
    if (!login) continue;
    const minutes = Math.round((at - Date.parse(`${login.timestamp}Z`)) / 60000);
    out.push({
      id: `new_payee_new_device:${t.id}`,
      type: "new_payee_new_device",
      title: `Grote overschrijving naar nieuwe begunstigde ${t.counterparty}`,
      explanation: `Er werd ${eur(-t.amount)} overgeschreven naar ${t.counterparty}, een begunstigde die pas ${payee.addedAt.slice(0, 10)} werd toegevoegd, ${minutes} minuten na een aanmelding op een nieuw toestel (${login.device}). Dit patroon past bij oplichting.`,
      amount: t.amount,
      currency: "EUR",
      merchant: t.counterparty,
      date: t.date,
      relatedTransactionIds: [t.id],
      severity: "critical",
    });
  }
  return out;
}
