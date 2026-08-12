# Folgeprompt 05: Content-Package- und Lock-Goldens

## Zweck

Pruefe die Daten-, Versions- und Save-Bindungsregeln aus G13 mit kleinen, deklarativen Goldens. Es wird noch kein Hot Reload und kein Mod-Loader gebaut.

## Autoritative Eingaben

- akzeptierter Command-Kernel-Spike aus Folgeprompt 04
- `X01_CONTRACT_CROSSWALK_V1.md`
- G13 in der eingefrorenen Fassung
- `TOOL_DECISION_LOG.md`

## Entry Gate

Beginne nur, wenn der Owner Namespace-Regel, Override-Policy, Mod-Scope, Supportfenster und Signatur-/Lizenzanforderung entschieden hat. Der kanonische Digest-Algorithmus aus Folgeprompt 04 muss akzeptiert sein.

## Fixierter Scope

- JSON-Schemas und synthetische Fixtures fuer ein deklaratives, datenbasiertes Package.
- Stable namespaced IDs, immutable Version, `packageDigest`, `authorityDigest`, `contentLock`, `authorityLock` und `contentEpoch`.
- Additive Abhaengigkeit, absichtlicher ID-Konflikt, fehlende Lizenzmetadaten und Quarantaene-Fall.

## Auftrag

1. Definiere die kleinste Package- und Lock-Struktur.
2. Erzeuge positive und negative Golden-Faelle.
3. Belege, dass Load-Reihenfolge keinen Last-wins-Override erzeugt.
4. Belege, dass ein Save mit abweichendem Authority Lock nicht still geladen wird.
5. Dokumentiere Provenienz und Lizenzstatus jeder Fixture.

## Verbotener Scope

- Kein JavaScript- oder Wasm-Modcode.
- Kein Hot Reload, Save-Migration, Registry-Service, UI oder Netzwerk.
- Keine realen Spielinhalte oder Prototype-Assets kopieren.

## Exit Gate

Erfolgreich nur, wenn alle Goldens deterministisch denselben Digest erzeugen, Konflikte und fehlende Provenienz in Quarantaene enden und ein Lock-Mismatch einen expliziten Fehler statt stiller Reparatur liefert.

## Stop Gate

Stoppen, wenn der Digest von Dateireihenfolge oder Plattform abhaengt, Overrides ohne Ownerregel noetig werden, eine Fixture nicht eindeutig lizenziert ist oder ein Save ohne passenden Authority Lock weiterlaufen wuerde.

## Handoff

Nur nach Schema-Review `ACCEPT` `06_VALIDATION_ISSUE_QUICKFIX_SPIKE_PROMPT.md` starten.
