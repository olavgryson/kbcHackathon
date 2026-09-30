# Module-API's (bindend voor fase 1–2)

Alle modules hieronder zijn server-only (`import "server-only"` bovenaan), behalve `lib/contracts`.
Relatieve imports met `.ts`-extensie; alias `@/` mag ook. Types komen uit `@/lib/contracts`.

## lib/data/index.ts  (eigenaar: data-eval-engineer)
```ts
export const DEMO_CUSTOMER_ID = "sofie-demo";
export type Transaction = { id: string; date: string /* ISO yyyy-mm-dd */; time?: string /* HH:mm */; amount: number /* negatief = uitgave */; currency: "EUR"; counterparty: string; merchantRaw: string; category: "abonnement"|"energie"|"restaurant"|"boodschappen"|"huur"|"transport"|"loon"|"sparen"|"verzekering"|"krediet"|"overschrijving"|"overig"; accountId: string; type: "card"|"transfer"|"direct_debit"|"salary" };
export type Account = { id: string; kind: "zicht"|"spaar"|"beleg"; name: string; ibanMasked: string; balance: number };
export type Card = { id: string; kind: "debet"|"krediet"; last4: string; status: "actief"|"geblokkeerd"; monthlyLimit: number };
export type LoginEvent = { id: string; timestamp: string /* ISO */; device: string; newDevice: boolean; location: string };
export type Payee = { id: string; name: string; ibanMasked: string; addedAt: string; };
export function getProfile(customerId: string): { id: string; firstName: string; language: "nl"; employer: string; payrollProvider: "SD Worx" };
export function getAccounts(customerId: string): Account[];
export function getTransactions(customerId: string, filter?: { category?: Transaction["category"]; from?: string; to?: string; limit?: number }): Transaction[];
export function getCards(customerId: string): Card[];
export function getLoans(customerId: string): { id: string; kind: string; outstanding: number; monthly: number; rate: number; endDate: string }[];
export function getInsurances(customerId: string): { id: string; kind: string; premiumMonthly: number; coverage: string }[];
export function getInvestments(customerId: string): { id: string; name: string; value: number; changePct3m: number }[];
export function getSalaryPayments(customerId: string): Transaction[]; // loonstortingen via SD Worx
export function getLoginEvents(customerId: string): LoginEvent[];
export function getPayees(customerId: string): Payee[];
export function getBalanceSummary(customerId: string): { currentMonthSpend: number; avgPrevMonthsSpend: number; byCategory: { category: string; current: number; avgPrev: number }[] };
```
Onbekend customerId → lege arrays / throw generieke Error. Data in `lib/data/*.json`, statisch geïmporteerd.

## lib/signals/index.ts  (eigenaar: data-eval-engineer)
```ts
export function detectCandidates(customerId: string): SignalCandidate[];            // deterministisch, sync
export async function getSignals(customerId: string, classifier: Classifier): Promise<Signal[]>; // decideNotify + NOTIFY_THRESHOLDS
```

## lib/classifier/index.ts  (eigenaar: classifier-engineer)
```ts
export function getClassifier(): Classifier;   // CLASSIFIER_MODE=local → LocalJeffClassifier (met fallback bij fout), anders FallbackClassifier
export { FallbackClassifier } from "./fallback.ts";
export { LocalJeffClassifier } from "./local.ts";
```

## lib/agents/index.ts  (eigenaar: agents-engineer)
```ts
export async function runChat(req: ChatRequest): Promise<ChatResponse>;
```

## API-routes
- `POST /api/chat` body `ChatRequest` → `ChatResponse` (agents-engineer)
- `GET /api/notifications` → `NotificationsResponse` (data-eval-engineer)
- `POST /api/sms` body `SmsCheckRequest` → `SmsCheckResponse` (data-eval-engineer)
Fouten: `{ error: string }` generiek, status 400/429/500. `Cache-Control: no-store`.
