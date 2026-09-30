import "server-only";
import { NOTIFY_THRESHOLDS, type Classifier, type Signal, type SignalCandidate } from "@/lib/contracts";
import { detectDuplicatePayments } from "./duplicates.ts";
import { detectNewPayeeNewDevice } from "./newPayeeNewDevice.ts";
import { detectSubscriptionIncreases } from "./subscriptions.ts";
import { detectUnusualCosts } from "./unusualCost.ts";

export { normalizeMerchant } from "./normalize.ts";

export function detectCandidates(customerId: string): SignalCandidate[] {
  return [
    ...detectNewPayeeNewDevice(customerId),
    ...detectDuplicatePayments(customerId),
    ...detectUnusualCosts(customerId),
    ...detectSubscriptionIncreases(customerId),
  ];
}

export async function getSignals(customerId: string, classifier: Classifier): Promise<Signal[]> {
  const candidates = detectCandidates(customerId);
  return Promise.all(
    candidates.map(async (c) => {
      const { notify, score } = await classifier.decideNotify(c);
      return { ...c, notify: notify && score >= NOTIFY_THRESHOLDS[c.type], notifyScore: score };
    }),
  );
}
