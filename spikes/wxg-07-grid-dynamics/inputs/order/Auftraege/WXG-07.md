# WXG-07: Coarse-Grid-Wetter als endlicher Numerik- und Catch-up-Spike

**Typ:** endlicher Implementierungs-Spike, kein Produktmerge.
**Ausführung:** Codex Cloud bevorzugt; konkrete lokale Restnachweise unten.
**Feste Lesebasis:** `17b1db4201a28e7b607c30707bdc2b75e3484a10`.
**Branchvorschlag:** `agent/wxg-07-2026-10-09` in eigenem Cloudworkspace.
**Scope:** `spikes/wxg-07-grid-dynamics/**` plus eigener Change `.devtoolbox/specs/changes/wxg-07-2026-10-09/**`.
**Registryabdeckung:** WXG-07.
**Abhängigkeiten für den vollen Versuch:** WXG-01-04, PLT-01-02; Teilstarts nur wie unten genannt.

Lies zuerst `Cloud/00_GEMEINSAMER_VERTRAG.md` und die benannten Originalquellen: WX §7.2/8/10/20, REG W-05/W-06/W-08. Kürzel werden in `SOURCE_DOCS.json` auf vollständige Dateien abgebildet. `03_SCHNITTSTELLEN_UND_UEBERNAHME.md` ergänzt diese Karte.




## Frage

Ist ein begrenzter Cube-Sphere-Transportkern stabil, bilanziert und exakt replaybar, einschließlich Offline-Catch-up? Kein Produktdefault und kein Strategieaustausch bei Spielerannäherung.

## Umfang

Starte32² pro Face mit wenigen benannten Kanälen, danach48²/64².96²/128² bleiben Skalierungsdiagnostik bei ausreichendem Budget. Wähle ein konkretes finite-volume-orientiertes, gefiltertes oder subgecyceltes Modell mit deklarierter Physik. Keine vollständige GCM behaupten.

Zellflächen, Tangentialbasen und Faceflüsse gegen geometrische Oracles. Quellen/Senken bilanzieren. dt aus kleinster Zellgröße, Wind, tatsächlich enthaltenem Wellenspektrum und Stabilitätsbereich ableiten.10/30/60 Minuten sind keine automatisch stabilen Werte.

Checkpoint+Tail gegen FullReplay für drei festgelegte Lücken, beispielsweise1h/24h/7Tage als Spiketestwerte. Exakt gleiche kanonische Bytes der gepinnten Implementierung. Vor fertigem Catch-up Pending statt analytischem Ersatzmodell. Objekt-Timewarp ist kein globaler Wetterzeitwechsel.

## Tests und Ergebnis

Konstantes Feld, advectierter Tracer, Face-/Cornerseams, geschlossene Bilanz, Quelle/Senke, negative/NaN-Werte, instabiles dt, beschädigter Checkpoint, Workerreorder und chunkunabhängige Ergebnisse.

Cloud kann die kleinen Numerik-/Replaytests vollständig ausführen. VMkosten sind Diagnose; Referenz-Catch-up-Zeit später lokal. Neue persistierte Wetterdomäne bleibt ein Vorschlag an P12/A0, kein Produktwrite. NO_ADOPTION oder RESEARCH_ONLY bei zu hohen Kosten ist ein legitimer klar begrenzter Abschluss.
