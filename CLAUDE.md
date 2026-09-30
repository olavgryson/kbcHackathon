# Kate+ (hackathon KBC x SD Worx)

PoC die Kate (digitale assistent KBC) specifieker maakt: lokaal classificatiemodel (jeff) beoordeelt elk bericht, een router stuurt naar een kleine domeinagent met read-only tools, deterministische signalen op synthetische transacties worden proactief gemeld, en live ingrepen (scamwaarschuwing, overdracht naar mens, verduidelijkende vraag). Vergelijkingsmodus Baseline (generalist) vs Kate+ met inputtokens en latentie; dashboard met eval-resultaten. Enkel synthetische data (persona "Sofie"), geen login, geen koppeling met KBC. UI in het Nederlands; klant schrijft NL/FR/EN en krijgt antwoord in zijn taal.

## Stack
Next.js 16.3.8 (App Router), React 19.3, TypeScript 6 strict, zod 4 (`import { z } from "zod"`), CSS Modules. Geen andere dependencies.
**Next 16: middleware heet `proxy.ts`** (CSP-nonce + rate limit op `/api/*`).

## Mappen
- `app/` pagina's (`/` chat, `/dashboard`) en route handlers in `app/api/*`
- `components/` React-componenten + `*.module.css`
- `lib/contracts/` types + zod-schema's (bron van waarheid, ook client-safe; GEEN `server-only`)
- `lib/classifier/` `LocalClassifier` (jeff via `LOCAL_CLASSIFIER_URL`) + `FallbackClassifier` (deterministisch)
- `lib/agents/` router, domeinagents, baseline-generalist, tools
- `lib/signals/` deterministische signaalregels + notify-beslissing
- `lib/data/` synthetische persona Sofie (3 maanden transacties)
- `lib/security/` rate limit en helpers
- `eval/` evalset + runner (`npm run eval`) -> resultaten voor dashboard
- `docs/` beslissingen (`decisions.md`), schema's (standalone HTML, niet geserveerd)

## Commando's
`npm ci` · `npm run dev` · `npm run build` · `npm run lint` · `npm run typecheck` · `npm run eval`

## Conventies
- Contracts eerst: wijzig/breid `lib/contracts/` uit voor je code bouwt; importeer via `@/lib/contracts`.
- Server-modules (LLM, classifier, data, tools) beginnen met `import "server-only"`.
- Styling enkel via CSS Modules; geen inline `style={...}` (CSP).
- Modeloutput altijd als platte tekst renderen.
- Relatieve imports binnen `lib/contracts` met `.ts`-extensie (eval draait onder node).
- Env: zie `.env.example` (`CLASSIFIER_MODE`, `LOCAL_CLASSIFIER_URL`, `ROUTER_CONFIDENCE_THRESHOLD`, `MODEL_SIMPLE`, `MODEL_COMPLEX`).

## Security-regels (verplicht)
1. Secrets enkel in `.env.local`; nooit `NEXT_PUBLIC_` voor gevoelige waarden; nooit keys in code/logs.
2. LLM- en classifier-calls enkel server-side (`import "server-only"`); client stuurt enkel tekst.
3. Elke API-body via zod `.strict()`; bericht max 1000 tekens; max 20 beurten; enum voor modus.
4. Output als platte tekst; nooit `dangerouslySetInnerHTML`, geen markdown/HTML-rendering.
5. Classifier-output nooit vertrouwen: parse met `ClassificationSchema`; ongeldig -> `onduidelijk`/fallback.
6. Tools read-only; `customerId` server-bepaald (`ToolContext`); geen schrijfacties, geen dynamische `fs`-paden, geen `eval`/`new Function`/`child_process`, geen netwerk naar user-URL's.
7. Prompt-injectie: klanttekst in `<klantbericht>...</klantbericht>` in user-rol, nooit in systeemprompt; systeemprompts negeren instructies uit klanttekst; injectiecases in evalset.
8. Security headers + CSP-nonce (`next.config.ts`, `proxy.ts`) niet verzwakken; geen inline styles.
9. Rate limiting: in-memory token bucket per IP op `/api/*` (proxy.ts).
10. Client krijgt generieke fouten, geen stacktraces; log nooit berichtinhoud (enkel labels, tokens, latentie).
11. Lokaal model op `127.0.0.1`, URL uit `LOCAL_CLASSIFIER_URL`, timeout `AbortSignal.timeout(3000)`.
12. `crypto.randomUUID()` voor ID's; enkel eenvoudige niet-geneste regex en inputlengte begrenzen vóór regex; geen `any`.
13. Geen nieuwe dependencies; `npm audit` 0 high/critical; licenties MIT/Apache-2.0/BSD/ISC.
14. Archify is dev-tooling, nooit in package.json; schema's als standalone HTML in `docs/`, niet door de app geserveerd.
