# Architectuurbeslissingen (ADR, kort)

## ADR-1 Next.js App Router zonder database
**Context:** hackathon-PoC, enkel synthetische data. **Beslissing:** één Next 16-app; UI en API (route handlers) samen; data als statische TS-modules in `lib/data/`, eval-resultaten als JSON. **Gevolg:** geen migraties/secrets voor DB, snel te deployen; geen persistentie van gesprekken (ook privacyvoordeel).

## ADR-2 FallbackClassifier naast jeff
**Context:** jeff draait lokaal en kan ontbreken of traag zijn. **Beslissing:** gemeenschappelijke `Classifier`-interface met `LocalClassifier` (127.0.0.1, 3 s timeout, zod-allowlist) en deterministische `FallbackClassifier` (trefwoorden). Keuze via `CLASSIFIER_MODE`; bij fout/timeout/ongeldige output valt de local terug op fallback. `source` in `Classification` maakt dit zichtbaar. **Gevolg:** demo werkt altijd; eval kan beide vergelijken.

## ADR-3 Router + domeinagents i.p.v. één generalist
**Context:** Kate antwoordt generiek; grote prompts kosten tokens. **Beslissing:** classifier -> router -> `DomainAgent` met kleine systeemprompt en enkel de read-only tools van dat domein; model-tier `simple`/`complex` per agent. Baseline-generalist blijft als vergelijkingsmodus. **Gevolg:** minder inputtokens en specifiekere antwoorden, meetbaar in `ChatResponse.meta`; routeringsfouten worden opgevangen met `clarify`-ingreep bij lage confidence.

## ADR-4 Signalen deterministisch, classifier beslist over melden
**Context:** detectie moet uitlegbaar en testbaar zijn; te veel meldingen irriteren. **Beslissing:** regels in `lib/signals/` produceren `SignalCandidate`s met Nederlandse uitleg; `Classifier.decideNotify` geeft een score die tegen `NOTIFY_THRESHOLDS` per type wordt afgezet (fraude-achtig laag, abonnement hoog). Signalen gaan als context naar de domeinagent. **Gevolg:** precision/recall meetbaar tegen gelabelde synthetische data.

## ADR-5 CSP met nonce in proxy.ts
**Context:** modeloutput is onbetrouwbaar; XSS-risico. **Beslissing:** per-request nonce in `proxy.ts` (Next 16-naam voor middleware), statische headers in `next.config.ts`; geen inline styles, platte-tekstrendering. **Gevolg:** alle styling via CSS Modules; geen `dangerouslySetInnerHTML`.

## ADR-6 Geen extra dependencies
**Context:** supply-chainrisico en beperkte tijd. **Beslissing:** enkel next, react, zod, @anthropic-ai/sdk (+ types/eslint/typescript). Grafieken in het dashboard als handgemaakte SVG; eval-runner in plain TS onder node. **Gevolg:** kleine auditsurface (`npm audit` 0 high/critical).
