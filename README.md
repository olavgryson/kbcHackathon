# Kate+ — proof of concept (hackathon KBC × SD Worx)

Kate+ toont hoe een digitale bankassistent specifiek in plaats van algemeen kan antwoorden:

1. **Lokaal classificatiemodel per beurt** ([jeff](https://github.com/firelex/jeff)) bepaalt `domain`, `generic_risk`, `frustration`, `scam_signal` en `needs_human`. Zonder lokaal model neemt een deterministische `FallbackClassifier` over.
2. **Router → domeinagents** met een kleine systeemprompt en alleen read-only tools (Haiku 4.5 voor eenvoudige domeinen, Sonnet 5.5 voor kredieten, beleggen en fraude).
3. **Proactieve signalen**: deterministische regels op synthetische transacties (duurder abonnement, dubbele betaling, ongebruikelijke kost, nieuwe begunstigde + nieuw toestel). De classifier beslist of iets gemeld wordt.
4. **Live ingrijpen**: veiligheidswaarschuwing, overdrachtskaart naar een medewerker, verduidelijkende vraag.
5. **Vergelijkingsmodus**: Baseline (één generalist) tegenover Kate+, met inputtokens en latentie per antwoord.
6. **Dashboard** met routeringsaccuraatheid per taal, tokenbesparing, ingrepen en precision/recall van de signalen.

Alle data is synthetisch (persona "Sofie"). Er is geen login en geen koppeling met KBC.

Architectuur: [`docs/architecture.html`](docs/architecture.html) · Flow van één chatbeurt: [`docs/chat-flow.html`](docs/chat-flow.html) · Beslissingen: [`docs/decisions.md`](docs/decisions.md) · Security: [`SECURITY.md`](SECURITY.md)

## Setup

Vereist: Node.js ≥ 22.15 (getest met 24).

```bash
npm ci
npx next telemetry disable   # Next.js-telemetrie uit
cp .env.example .env.local   # vul ANTHROPIC_API_KEY in
npm run dev                  # http://localhost:3000
```

Productie-build: `npm run build && npm start -- -H 127.0.0.1` (zonder `-H` luistert Next op alle netwerkinterfaces; op een gedeeld netwerk dus altijd op loopback binden). Kwaliteit: `npm run lint`, `npm run typecheck`, `npm audit`.

Zonder `ANTHROPIC_API_KEY` draait de app in **demo-modus**: deterministische antwoorden op basis van dezelfde tools en signalen, met geschatte inputtokens. De chip onder elk antwoord toont dan "demo".

## Omgevingsvariabelen

| Variabele | Standaard | Uitleg |
|---|---|---|
| `ANTHROPIC_API_KEY` | – | Alleen server-side, alleen in `.env.local`. Nooit met `NEXT_PUBLIC_`-prefix. |
| `CLASSIFIER_MODE` | `fallback` | `local` = jeff op 127.0.0.1, `fallback` = deterministische regels. |
| `LOCAL_CLASSIFIER_URL` | `http://127.0.0.1:8765` | Alleen loopback-hosts worden geaccepteerd. Timeout 3 s, daarna fallback. |
| `LOCAL_CLASSIFIER_API_KEY` | – | Optioneel, als jeff-serve met `JEFF_API_KEY` draait. |
| `ROUTER_CONFIDENCE_THRESHOLD` | `0.6` | Onder deze confidence stelt Kate+ een verduidelijkende vraag. |
| `MODEL_SIMPLE` | `claude-haiku-4-5-20251001` | Eenvoudige domeinen. |
| `MODEL_COMPLEX` | `claude-sonnet-5-5` | Kredieten, sparen/beleggen, fraude/app-beveiliging en de baseline. |

## Lokaal classificatiemodel (jeff)

Volgens de [jeff-README](https://github.com/firelex/jeff), in een aparte map buiten dit project:

```bash
git clone https://github.com/firelex/jeff && cd jeff
uv sync --no-default-groups --extra mac          # Apple silicon (CPU: zonder --extra; NVIDIA: --extra cuda)
uv run --no-default-groups hf download mstrasser/Jeff-Qwen3.5-0.8B --local-dir checkpoints/jeff-0.8b

# Bind alleen op loopback (JEFF_HOST is standaard 127.0.0.1; expliciet zetten schaadt niet)
JEFF_HOST=127.0.0.1 JEFF_BACKEND=mlx JEFF_CHECKPOINT=checkpoints/jeff-0.8b PORT=8765 \
  uv run --no-default-groups --extra mac jeff-serve
```

Zet daarna in `.env.local`: `CLASSIFIER_MODE=local`. De app roept `POST /v1/systemone` aan met één `choice`-vraag (domein) en vier `noul`-vragen. Faalt de call (niet bereikbaar, timeout, ongeldig antwoord), dan valt ze per beurt terug op de `FallbackClassifier`. De meta-chip toont welke bron gebruikt werd.

## Evaluatie

```bash
npm run eval             # classifier over eval/dataset.json → eval/results.json
npm run eval -- --live   # optioneel: steekproef met echte usage.input_tokens (vereist API-key)
```

Het dashboard (`/dashboard`) leest `eval/results.json` server-side.

## Demoscript (3 minuten)

1. **Baseline**: zet de toggle op *Baseline* en vraag "Waarom staat mijn rekening lager dan normaal?" → algemeen antwoord.
2. **Kate+**: zelfde vraag in *Kate+* → specifiek antwoord met het duurdere StreamFlix-abonnement (€13,49 → €15,99), de dubbele betaling bij Brasserie De Markt (2× €64,80) en de energiefactuur (€248 tegenover ~€95). De chip toont domein *Betalingen* en minder inputtokens. Tip: zet *Vergelijkingsmodus* aan om beide naast elkaar te zien.
3. **Meldingen**: het meldingenpaneel toont de proactieve meldingen; klap "Waarom zie ik dit?" open.
4. **Sms**: klik op het voorbeeld "Uw KBC-app vervalt vandaag, klik hier om te verlengen" → *Controleer sms* → phishingoordeel met uitleg.
5. **Oplichting live**: typ "Iemand van de bank belde, ik moet mijn spaargeld naar een veilige rekening overzetten" → rode veiligheidswaarschuwing en een overdrachtskaart.
6. **Dashboard**: open `/dashboard` → accuraatheid per taal, confusion matrix, tokenbesparing, ingrepen en precision/recall van de signalen.

## Structuur

```
app/            pagina's en route handlers (/api/chat, /api/notifications, /api/sms)
components/     client UI (CSS Modules, platte tekst)
lib/contracts/  types + zod-schema's (gedeeld)
lib/classifier/ LocalJeffClassifier + FallbackClassifier
lib/agents/     router, domeinagents, baseline, read-only tools
lib/signals/    deterministische detectieregels
lib/data/       synthetische data (server-only)
eval/           gelabelde dataset + evalscript
docs/           architectuur (Archify), beslissingen
proxy.ts        CSP-nonce, rate limit (Next 16 "middleware")
```

Archify (voor de diagrammen) is dev-tooling, geïnstalleerd als agent skill (`npx skills add tt-a1i/archify -g`) en geen dependency van de app.
