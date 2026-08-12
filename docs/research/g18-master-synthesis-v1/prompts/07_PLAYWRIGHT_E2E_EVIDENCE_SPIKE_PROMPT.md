# Folgeprompt 07: Playwright-E2E- und Evidence-Spike

## Zweck

Pruefe G17s browserseitige Nachweisgrenze an einer kleinen echten Fixture. Der Spike validiert den Workflow, nicht das Produkt und nicht die Prototyp-Screenshots.

## Autoritative Eingaben

- akzeptierter Validator-Spike aus Folgeprompt 06
- akzeptierte Topologie-ADR aus Folgeprompt 03
- G17 und die BR01-/BR02-/BR03-/BR04-Berichte in den eingefrorenen Fassungen
- `TECHNICAL_READINESS_CROSSWALK.md`

## Entry Gate

Beginne nur, wenn eine isolierte Browser-Fixture mit build-only Bootstrap existiert, Browser- und Runner-Versionen gepinnt sind und alle Claims als neu zu messende Spike-Evidence behandelt werden.

## Fixierter Scope

- Eine reale kleine UI fuer Preview, Validate, Commit und Undo gegen den synthetischen Kernel.
- Playwright/CDP-Runner, Idle Oracle, semantische Assertions und ein versiegeltes read-only E2E Receipt.
- Ein absichtlich fehlgeschlagener CAS-Fall und ein erfolgreicher Undo-Fall.

## Auftrag

1. Starte die Fixture ausschliesslich ueber den dokumentierten Bootstrap.
2. Verwende Zustands- und Netzwerk-Idle-Signale statt fester Sleeps.
3. Pruefe zuerst semantische DOM-/Receipt-Aussagen und nur ergänzend Pixel-Evidence.
4. Versiegle Runner-, Browser-, Build-, Fixture- und Contract-Digests im E2E Receipt.
5. Dokumentiere jede nicht reproduzierbare Beobachtung als Unsicherheit.

## Verbotener Scope

- Keine hardcodierten Commit-Erfolge, keine Prototype-UX als Produktfunktion, keine extern gehostete Demo als alleiniger Beleg.
- Keine Produktrepo-Integration, kein Screenshot-Refresh anderer Projekte und keine Performance-Behauptung ohne Benchmarkvertrag.

## Exit Gate

Erfolgreich nur, wenn ein sauberer Lauf und ein kontrollierter Fehlerlauf reproduzierbar sind, keine festen Sleeps verwendet werden, das E2E Receipt vom Commit Receipt getrennt ist und der Evidence-Index alle Versionen und Artefakte adressiert.

## Stop Gate

Stoppen, wenn die Fixture nur Mock-Text statt echter Kernel-Antworten anzeigt, ein Runner-Retry den Fehler verdeckt, Browseridentitaet fehlt oder Pixelvergleich die einzige Assertion ist.

## Handoff

Nur nach unabhaengigem Evidence-`ACCEPT` `08_MISSION_COMPILER_VALIDATOR_SPIKE_PROMPT.md` starten.
