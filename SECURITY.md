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

_Wordt na elke fase bijgewerkt door de security-reviewer._

- [ ] 1. Secrets
- [ ] 2. Server-only
- [ ] 3. Inputvalidatie
- [ ] 4. Output als platte tekst
- [ ] 5. Classifier-output wordt nooit vertrouwd
- [ ] 6. Tools read-only en server-bepaald
- [ ] 7. Prompt-injectie
- [x] 8. Security headers + CSP met nonce (fase 0)
- [x] 9. Rate limiting (fase 0, demo-niveau)
- [ ] 10. Foutafhandeling
- [ ] 11. Lokaal model
- [ ] 12. Veilige code
- [ ] 13. Supply chain
- [ ] 14. Archify

## Bekende beperkingen

- Rate limit is in-memory en per proces (demo-niveau); `X-Forwarded-For` is client-controleerbaar zonder vertrouwde reverse proxy.
- Geen authenticatie: bewust, want de app gebruikt uitsluitend synthetische data van één demopersona.

## Melden

Dit is een hackathon-PoC. Meld problemen via een issue in de repository.
