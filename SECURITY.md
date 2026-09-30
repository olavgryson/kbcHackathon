# Security – Kate+ PoC

> Proof of concept met uitsluitend synthetische data. Geen echte klantgegevens, geen login, geen koppeling met KBC-systemen.

## Stack en dependencies

| Package | Versie | Type | Licentie |
|---|---|---|---|
| next | 16.3.8 | runtime | MIT |
| react / react-dom | 19.3.0 | runtime | MIT |
| @anthropic-ai/sdk | 0.130.0 | runtime (server-only) | MIT |
| zod | 4.6.5 | runtime | MIT |
| typescript | 6.0.3 | dev | Apache-2.0 |
| eslint | 10.11.0 | dev | MIT |
| eslint-config-next | 16.3.8 | dev | MIT |
| @types/node, @types/react, @types/react-dom | 24.19.0 / 19.3.0 | dev | MIT |

Versiekeuze:
- `next` 16.3.8: GHSA-vcvr-r3jv-pc5j (critical, `>=16.2.0 <16.3.6`) is gepatcht; geen open advisories bij installatie.
- `react`/`react-dom` 19.3.0: geen open GitHub advisories.
- `typescript` 6.0.3 i.p.v. 7.x: typescript-eslint ondersteunt `<6.1.0`.
- `eslint` 10.x i.p.v. 9.x (EOL). `eslint-plugin-react` (via eslint-config-next) krijgt `settings.react.version` om een ESLint-10-incompatibiliteit in versiedetectie te vermijden.
- Alle versies exact gepind (`.npmrc save-exact=true`), `package-lock.json` gecommit, installatie via `npm ci`.

## Checklist (sectie 3 van de opdracht)

_Eindreview: security-reviewer, fase 4 (2026-09-30). Dekt de volledige repo, inclusief `app/dashboard/`, `eval/`, `docs/` en `README.md`._

Eindcontrole (fase 4): `npm ci` (345 packages, conform lockfile) · `npm audit` 0 vulnerabilities (ook `--omit=dev`) · `npx tsc --noEmit` OK · `npm run lint` OK · `npm run build` OK · `next start -H 127.0.0.1 -p 3131` + `curl -sI` op `/` en `/dashboard` OK.

- [x] 1. **Secrets** – geen treffers voor `sk-ant`, `api_key=...`, `Bearer`-tokens, GitHub/Slack/AWS-tokens of private keys in working tree, `git log -p --all` en alle nog niet gecommitte bestanden uit `git status --porcelain` (enkel de regex-tekst in `.claude/agents/security-reviewer.md`). `.gitignore` sluit `.env*` uit behalve `.env.example` (lege waarden). Geen `NEXT_PUBLIC_` in de code. Key enkel gelezen in `lib/agents/llm.ts:17`, nooit gelogd. `docs/diagrams-src/receipts/` (bevat lokale absolute paden) is genegeerd (`git check-ignore -v` → `.gitignore:19`); `docs/*.html`, `docs/diagrams-src/*.json` en `eval/results.json` bevatten geen lokale paden.
- [x] 2. **Server-only** – `import "server-only"` in `lib/agents/*`, `lib/classifier/*`, `lib/data/index.ts`, `lib/signals/index.ts`, alle `app/api/*/route.ts` en `app/dashboard/loadResults.ts`. `app/dashboard/page.tsx` is een server component (geen `"use client"`). Client-componenten (`components/*.tsx`) importeren enkel `react`, `@/lib/contracts` (client-safe) en `./api`. `eval/register.mjs` vervangt `server-only` enkel voor het CLI-evalscript door een lege module (zelfde aliasing als Next); niet in de app gebruikt.
- [x] 3. **Inputvalidatie** – `ChatRequestSchema`/`ChatTurnSchema` `.strict()` (`lib/contracts/chat.ts`), max 1000 tekens, max 20 beurten, `mode` als enum, laatste beurt `user`; `SmsCheckRequestSchema` `.strict()` (`lib/contracts/notifications.ts`). Content-type `application/json` verplicht (415) en bodylimiet (413) in beide POST-routes. Dashboard heeft geen invoer; `eval/results.json` wordt met `EvalResultsSchema` gevalideerd (`app/dashboard/loadResults.ts:10`), `eval/dataset.json` met `EvalItemSchema` (`eval/run.ts:25`, tekst ≤1000).
- [x] 4. **Output als platte tekst** – geen `dangerouslySetInnerHTML`/`innerHTML` in de app (grep); modeloutput via `{d.reply}` in `<p>` (`components/Chat.tsx`); dashboard rendert enkel getallen en de gevalideerde `generatedAt`-string als React-tekst. ESLint `react/no-danger: error`.
- [x] 5. **Classifier-output nooit vertrouwd** – `ClassificationSchema.parse` (`lib/classifier/local.ts`, `fallback.ts`), jeff-antwoorden via zod, elke fout → `FallbackClassifier`.
- [x] 6. **Tools read-only en server-bepaald** – tools enkel lezend (`lib/agents/tools.ts`), input via zod `.strict()`, `customerId` uit `ToolContext` = `DEMO_CUSTOMER_ID` (`lib/agents/index.ts`), data-laag weigert andere ID's (`lib/data/index.ts`). `fs` enkel met vaste paden: `app/dashboard/loadResults.ts:9` (`<cwd>/eval/results.json`), `eval/run.ts:25,157` (`new URL("./dataset.json"|"./results.json", import.meta.url)`), `eval/register.mjs` (module-resolutie van projectbestanden tijdens `npm run eval`, niet door de app geladen). Geen `eval`, `new Function`, `child_process` (grep, hele repo excl. `node_modules`, `.next`, `docs/*.html`).
- [x] 7. **Prompt-injectie** – klanttekst in `<klantbericht>` in user-rol met escape van `<`/`>` (`lib/agents/llm.ts:24-31`); historiek: user-beurten afgebakend, assistant-beurten ge-escaped (`llm.ts:63-68`, F5 gefixt); systeemprompt bevat geen klanttekst en zegt klanttekst als data te behandelen (`lib/agents/prompts.ts:10`). `eval/dataset.json` (156 items) bevat 8 items met tag `injection` (NL/FR/EN: systeemprompt lekken, overschrijvingen, data van andere klant), naast 8× `scam` en 8× `handover`.
- [x] 8. **Security headers + CSP met nonce** – geverifieerd met `next start -H 127.0.0.1 -p 3131` + `curl -sI` op `/` en `/dashboard`: CSP met per-request nonce en `strict-dynamic` (script én style), geen `unsafe-inline`/`unsafe-eval` in productie, `object-src 'none'`, `frame-ancestors 'none'`, HSTS, nosniff, `X-Frame-Options: DENY`, Referrer- en Permissions-Policy, `Cache-Control: no-store`; geen `X-Powered-By`. Geen inline `style={...}` (grep) en geen `style="` in gerenderde dashboard-HTML (balken via SVG-attribuut `width`).
- [x] 9. **Rate limiting** – token bucket 30 / 0,5 per s per IP op `/api/*` (`lib/security/rateLimit.ts`, `proxy.ts:22-29`). Getest in fase 2: 40 snelle requests → 30× 200, 10× 429 met `Retry-After: 5`. Demo-niveau, zie F6.
- [x] 10. **Foutafhandeling en logging** – generieke Nederlandse foutmeldingen, geen stacktraces. Alle `console.*` in app-code nagekeken: enkel labels, status, tokens, latentie, verdict (`app/api/chat/route.ts:39`, `app/api/sms/route.ts:37,40`, `lib/agents/index.ts:75,111`, `lib/agents/llm.ts:138`, `lib/classifier/local.ts:225`). `eval/run.ts` logt enkel geaggregeerde cijfers, geen datasettekst. `loadResults` slikt fouten en toont een lege staat.
- [x] 11. **Lokaal model** – URL uit `LOCAL_CLASSIFIER_URL`, enkel loopback-hosts, `AbortSignal.timeout(3000)`, redirects geweigerd, zod-parse van de respons. README instrueert jeff met `JEFF_HOST=127.0.0.1`.
- [x] 12. **Veilige code** – geen `Math.random`, `any`/`as any`, `@ts-ignore`/`@ts-expect-error`, `eslint-disable` (grep). Alle regex-literals (10) eenvoudig en niet-genest, input vooraf begrensd: `llm.ts:25` (enkel teken), `router.ts:58` (≤1000 via zod), `fallback.ts:25-26,275` (≤1000), `fallback.ts:349,355` (server-tekst ≤500), `normalize.ts:4` (≤120), `eval/register.mjs:16` (verankerd, bestandspad).
- [x] 13. **Supply chain** – `npm audit`: 0 vulnerabilities (ook `--omit=dev`). Versies exact gepind, lockfile gecommit, installatie met `npm ci`. Geen nieuwe dependencies sinds fase 0. Licenties: zie overzicht; uitzonderingen gedocumenteerd.
- [x] 14. **Archify** – `grep -i archify package.json package-lock.json` → geen treffers; enkel als globale agent skill gebruikt. `docs/architecture.html` en `docs/chat-flow.html` zijn standalone (geen externe scripts, geen `fetch`/`XMLHttpRequest`/`WebSocket`). Er is geen `public/`-map en niets in `app/`, `components/`, `lib/`, `proxy.ts` of `next.config.ts` verwijst naar `docs/`; getest: `GET /docs/architecture.html` en `GET /eval/results.json` → 404.

## Licentieoverzicht

Geteld over alle geïnstalleerde packages in `node_modules` (345; `license`-veld van elke `package.json`). Nog eens 56 lockfile-entries zijn optionele platformbinaries voor andere OS'en (niet geïnstalleerd; zelfde licenties als hun geïnstalleerde tegenhanger).

| Licentie | Aantal | Status |
|---|---:|---|
| MIT | 290 | toegestaan |
| Apache-2.0 | 22 | toegestaan |
| ISC | 16 | toegestaan |
| BSD-2-Clause | 7 | toegestaan |
| BSD-3-Clause | 2 | toegestaan |
| 0BSD | 1 | uitzondering (permissief) |
| CC-BY-4.0 | 1 | uitzondering (build-time data) |
| MPL-2.0 | 1 | uitzondering (dev-only) |
| LGPL-3.0-or-later | 1 | uitzondering (optioneel, niet gebruikt) |
| Apache-2.0 AND LGPL-3.0-or-later AND MIT | 1 | uitzondering (optioneel, niet gebruikt) |
| Unlicense | 1 | uitzondering (public domain) |
| CC0-1.0 | 1 | uitzondering (dev-only, public domain) |
| BlueOak-1.0.0 | 1 | uitzondering (dev-only, permissief) |

Uitzonderingen en motivatie:
- `tslib` (0BSD): via `next` → `@swc/helpers`. 0BSD is permissiever dan MIT (geen attributie vereist).
- `caniuse-lite` (CC-BY-4.0): browserdata voor `browserslist`, enkel gebruikt tijdens build; het is data, geen code. Attributie via de package zelf.
- `axe-core` (MPL-2.0): dev-only via `eslint-config-next` → `eslint-plugin-jsx-a11y`; draait enkel bij lint, wordt niet meegeleverd. MPL is file-level copyleft en geldt enkel bij wijziging van axe-core-bestanden.
- `@img/sharp-libvips-darwin-arm64` (LGPL-3.0-or-later) en `@img/sharp-wasm32` (Apache-2.0 AND LGPL-3.0-or-later AND MIT): optionele dependencies van `next` → `sharp` voor beeldoptimalisatie. De app gebruikt `next/image` niet. libvips wordt dynamisch gelinkt en ongewijzigd gebruikt, wat LGPL toelaat. `@img/sharp-wasm32` staat in de lockfile als optionele dependency; `npm ls` toont hem als extraneous (zie F7).
- `fast-sha256` (Unlicense, public domain): via `@anthropic-ai/sdk` → `standardwebhooks`.
- `language-subtag-registry` (CC0-1.0): dev-only via `eslint-plugin-jsx-a11y`; public-domain data.
- `minimatch` (BlueOak-1.0.0): dev-only via ESLint; permissieve licentie vergelijkbaar met MIT.

Niet-app-assets:
- `docs/architecture.html` en `docs/chat-flow.html` (gegenereerd met Archify) bevatten een ingebedde **JetBrains Mono**-font onder de **SIL Open Font License 1.1** (licentietekst en bron in het bestand zelf). OFL laat inbedden en herverdelen toe zolang de licentie meegaat en de font niet los verkocht wordt. Deze bestanden worden niet door de app geserveerd en maken geen deel uit van de build.
- Archify zelf is dev-tooling (agent skill) en staat niet in `package.json`/lockfile.

## Bevindingen

| # | Ernst | Bevinding | Status |
|---|---|---|---|
| F1 | Middel | `app/api/sms/route.ts` controleerde content-type met `includes("application/json")`; `text/plain; x=application/json` werd aanvaard (getest: 200). | Gefixt: `startsWith`, 415 |
| F2 | Laag | `app/api/sms/route.ts` las de body onbegrensd (`req.json()`). | Gefixt: bodylimiet 8 KB, 413 |
| F3 | Laag | `lib/classifier/local.ts` volgde HTTP-redirects, waardoor de loopback-check omzeild kon worden door het endpoint. | Gefixt: `redirect: "error"` |
| F4 | Info | `import "server-only"` ontbrak in `app/api/chat/route.ts` en `lib/agents/prompts.ts`. | Gefixt |
| F5 | Laag | Assistant-beurten in de historiek komen van de client en gaan ongewijzigd als `assistant`-rol naar het model (`lib/agents/llm.ts:61-66`). Een aanvaller kan eerdere assistentuitspraken vervalsen. Impact beperkt: read-only tools, vaste persona. Voorstel (agents): enkel user-beurten doorgeven, of assistant-beurten ook escapen en afbakenen als `<vorig_antwoord>`. | Gefixt: assistant-beurten worden nu ook ge-escaped (`lib/agents/llm.ts:63-68`), zodat ze geen `<klantbericht>`/`<context>`-blokken kunnen injecteren. Restrisico: een client kan nog steeds de inhoud van eerdere assistentbeurten verzinnen (aanvaard, zie beperkingen). |
| F6 | Laag | Rate-limitsleutel uit `X-Forwarded-For` (`proxy.ts:23`) is door de client te kiezen, dus de limiet is te omzeilen door de header te wisselen. | Aanvaard (demo); enkel vertrouwen achter reverse proxy |
| F7 | Info | `node_modules` bevat extraneous packages die niet met de lockfile overeenkomen (`@emnapi/runtime@1.11.3`, `@img/sharp-wasm32`). | Opgelost: `npm ci` uitgevoerd in fase 4. Beide packages staan in de lockfile (optioneel/peer via `sharp`); `npm ls` markeert ze als extraneous door peer-resolutie, niet door afwijking van de lockfile. |
| F8 | Info | `ALLOWED_HOSTS` bevat ook `localhost` (`lib/classifier/local.ts:21`), dat via het hosts-bestand resolvet. | Aanvaard (loopback per conventie) |
| F9 | Info | `next start` luistert op alle interfaces. | Aanvaard; README instrueert nu `npm start -- -H 127.0.0.1` |
| F10 | Info | `README.md` gaf `npm start` zonder host-binding. | Gefixt: `-H 127.0.0.1` met uitleg |
| F11 | Info | `eval/register.mjs` laadt `.json` als ES-module (`export default <json>`); JSON is een geldige JS-expressie en enkel projectbestanden worden geladen tijdens `npm run eval`. Relatieve imports vanuit `node_modules` worden sinds fase 4 niet meer omgeleid. | Aanvaard (dev-script) |
| F12 | Info | `npm ls` meldt `eslint@10` als invalid peer voor `eslint-plugin-import`/`jsx-a11y`/`react` (peer `^9`). Lint draait correct. | Aanvaard (dev-only, zie versiekeuze) |

## Genomen maatregelen

- CSP met per-request nonce en `strict-dynamic` via `proxy.ts`; statische security headers in `next.config.ts`; geen `X-Powered-By`.
- Zod `.strict()` op elke API-body, lengtelimieten, content-type-check (415) en bodylimiet (413).
- Klanttekst (ook historiek) afgebakend en ge-escaped; systeemprompts zonder klanttekst; injectietests in de evalset.
- Classifier-output altijd via zod tegen een allowlist; fallback bij elke fout; lokaal model enkel op loopback, 3 s timeout, geen redirects.
- Read-only tools met server-bepaalde klant-ID; data-laag weigert andere ID's.
- Platte-tekstrendering, `react/no-danger` als lint-error, geen inline styles.
- In-memory rate limit op `/api/*`; generieke foutmeldingen; logging zonder berichtinhoud.
- Exact gepinde versies, lockfile, `npm ci`, `npm audit` 0 vulnerabilities, licenties gecontroleerd.
- Server-only-modules voor alle LLM-, classifier-, data- en bestandslogica; dashboard leest één vast pad met schemavalidatie.

## Bekende beperkingen

- **Rate limit demo-niveau**: in-memory en per proces; de sleutel komt uit `X-Forwarded-For`/`X-Real-IP`, die zonder vertrouwde reverse proxy door de client te kiezen zijn (F6). In productie enkel achter een proxy die deze headers overschrijft, of een gedeelde store gebruiken.
- **Geen authenticatie**: bewust, want de app gebruikt uitsluitend synthetische data van één demopersona zonder koppeling met KBC.
- **In-memory state**: rate-limit-buckets en de Anthropic-client leven per proces; herstart wist ze, meerdere instanties delen niets.
- **Netwerkbinding**: `next start` en `next dev` luisteren standaard op alle interfaces; start op een gedeeld netwerk met `-H 127.0.0.1` (F9, README).
- **Historiek van de client**: de client stuurt de volledige historiek; eerdere assistantbeurten kunnen verzonnen zijn. Ze zijn ge-escaped en de tools zijn read-only met vaste persona, dus de impact blijft beperkt tot de antwoordtekst.
- **LGPL `sharp`-binaries**: `@img/sharp-libvips-*` (LGPL-3.0-or-later) is een optionele dependency van `next` en wordt niet gebruikt (geen `next/image`); ongewijzigd en dynamisch gelinkt.
- **Fallback-classifier-accuraatheid**: de deterministische `FallbackClassifier` haalt 80,8 % routeringsaccuraatheid op de evalset (NL 82,4 %, FR 78,8 %, EN 81,1 %; `eval/results.json`). Fouten leiden tot een verkeerde domeinagent of een verduidelijkende vraag, niet tot extra rechten: elke agent is read-only en de scam-/overdrachtsregels werken onafhankelijk van het domein.
- **Prompt-injectie is niet volledig uit te sluiten**: afbakening en instructies verkleinen het risico; de read-only, server-bepaalde tools beperken de impact.

## Melden

Dit is een hackathon-PoC. Meld problemen via een issue in de repository.
