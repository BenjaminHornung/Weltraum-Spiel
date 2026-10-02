# Ausführungsfolge und sichtbare Zwischenstände

## Interner Ablauf, unabhängig von A0/P01–P06

1. HEAD startet RD-00. SO-01/SO-02/SO-06 dürfen gleichzeitig Quellen, Referenzzugang und Oracles vorbereiten, ohne geteilten Code zu verändern.
2. Nach RD-00 laufen RD-01, RD-02, RD-10, RD-50; nach RD-02 parallel RD-20, RD-30 und RD-03. Der erste sichtbare Kontrollrenderer ist Ergebnis von RD-03, nicht vom letzten Gesamtgate.
3. Nach RD-03: Renderer-/Material-/Kameravergleiche und Foliage-/Regenexperimente nach Karten-DAG. RD-40 liefert die kleine Galerie früh. Die übrigen Tools werden ergänzt, sobald ihre reine Fachlogik nutzbar ist.
4. Nach einzelnem Erfolg: RD-23/RD-32 und die konkreten Workbenches. Wenige ausgewählte Optionen kombinieren, nicht sämtliche Kombinationen ausmultiplizieren.
5. RD-51 führt die lebendige gemeinsame Strecke aus. RD-52 entscheidet, was behalten, weiter untersucht oder verworfen wird. RD-22/RD-33 sind optionale, freizugebende Zusatzversuche, keine Voraussetzung.

## Sichtbare Lieferpunkte

| Lieferpunkt | Wirklich vorhandener Nutzen | Nicht behaupten |
|---|---|---|
| L1 | Kontrollszene, Quell-/Backend-/Kostenanzeige | Konzeptparität oder native Spielphysik |
| L2 | Windvergleich, Regen unter/offenem Dach, erste Rendererwechsel | jeder Effekt sei produktionsfähig |
| L3 | nutzbare Foliage-/Wetter-/Assetwerkzeuge und reproduzierbare Presets | allgemeiner Welt-/Mission-/HVOX-Editor |
| L4 | gemeinsam laufende Wind-/Regen-/Nässe-/Sourcewechselstrecke | echte Cut-RT- oder Produktsave-Abnahme |
| L5 | qualifizierte Auswahl plus kleinste Übernahmekarten | automatischer Enginewechsel oder Merge |

Es gibt 25 Arbeitskarten: 23 Kernpakete und 2 ausdrücklich kapazitätsabhängige Zusatzversuche. Sie sind keine 25 gleichzeitig laufenden Prozesse. Der DAG und das globale Host-/Gerätebudget steuern die tatsächliche Parallelität.

## Produktübergabe später

Der bisherige Agent erhält keine neue Verpflichtung, auf das gesamte RD-Programm zu warten. Ist z.B. ein kleiner Windadapter fertig, kann dessen Integrationsvorschlag unabhängig vom noch laufenden Snow- oder Raymarchvergleich übergeben werden. Die Produktübernahme selbst benötigt eine neue feste Basis, eine enge Dateizuteilung und die vorhandenen funktionalen, visuellen und Performancegates. Ein R&D-Megamerge ist nicht vorgesehen.

## Fortsetzung ohne wiederholte Planung

Jeder terminale Handoff enthält Task-ID, volle Basis-/Kandidaten-SHA, Dependency-Digests, Testergebnisse, offene Punkte und nächsten zugelassenen Schritt. Beim Neustart werden diese Angaben geprüft. Bereits abgeschlossene Arbeit nicht erneut von Grund auf erzeugen. Nach Source-/Contractänderung nur tatsächlich betroffene Kandidaten und Kombinationen neu prüfen.
