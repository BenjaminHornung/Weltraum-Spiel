# Hestia: freigegebene visuelle Referenz

Ownerentscheidung vom 13.10.2026: **APPROVED_VISUAL_REFERENCE**. Das kombinierte Bild, seine Farbwelt und sein harter Voxelstil gefallen dem Owner ausdrücklich. Die Datei ist eine ImageGen-Gestaltungsvorlage. Sie beweist keine bereits implementierte Oberfläche, Runtimegrafik oder abgeschlossene Gameplay-Abnahme.

![Freigegebenes Hestia-Zielbild: Keramik/Petrol, Expeditions-HUD, Minimap rechts oben](../../../../../art/factory/visual-reference/2026-10-13/approved-hud-ceramic-petrol-microvoxel.png)

Das Bild liegt als echtes PNG mit lokalem Git-LFS-Payload im Integrator-Quellstand. Herkunft, Größe und SHA-256 stehen in [REFERENCE.json](REFERENCE.json); der tatsächlich verwendete Prompt steht in [APPROVED_REFERENCE_PROMPT.txt](APPROVED_REFERENCE_PROMPT.txt).

## Bildsprache

- Feine, harte, achsenparallele Microvoxel-Kanten und gestufte Silhouetten. Kalkstein, Pflanzen, Maschinen und Materialien wirken wie Bestandteile derselben Welt.
- Helle warme Kalksteinflächen, türkisblaues Wasser und kräftige blockige Vegetation; industriell gebaute Objekte bleiben funktional erkennbar.
- Maschinen: dunkle tragende Rahmen, warme weiße beziehungsweise keramische Verkleidung, petrolfarbene Funktionsteile und sparsame gelbe Sicherheitsmarkierungen. Sichtbare Ein-/Ausgänge und Arbeitsraum erklären ihre Aufgabe.
- Licht und Materialkontrast machen Form und Funktion lesbar. Die Vorlage definiert keinen zusätzlichen Shader, Rendererwechsel oder Performanceanspruch ohne Messung.
- Der visuelle Microvoxelstil ist kein neues Simulationsraster: 0,25-m-Bauraster und 0,125-m-HVP-Terrainzellen behalten ihre getrennten Verträge.

## GUI

Layout der ursprünglichen Variante 1, Farben der ursprünglichen Variante 2: kompakte kontextbezogene Instrumente unten rechts, kleine Zielanzeige oben links und ruhiger Kompass oben mittig. Die **Minimap sitzt oben rechts** und zeigt Spieler, bekannte Wege, Wrack, eigene Anlagen, Norden und Maßstab. Die zentrale Sicht auf die Welt bleibt frei.

Flächen verwenden warme helle Keramik; Text und industrielle Piktogramme dunkles Anthrazit. Petrol kennzeichnet die primäre Aktion. Gelb unterstützt Bereitschaft oder Warnung, ergänzt durch Text/Icon. Dünne Regeln, wenige abgeschrägte Ecken, klare Schriftgrößen und zweckmäßige Abstände verbinden die Oberflächen. Keine Kachelwand als Standardbildschirm.

Jeder Kontext beantwortet: Was betrachte ich? Was kann ich jetzt tun? Was wird verbraucht? Warum ist eine Aktion blockiert? Ein Hauptbefehl dominiert; Details werden bei Bedarf geöffnet. Menüs zeigen ihren Pausenzustand und eine klare Rückkehr ins Spiel. Vorschau, Istzustand und erwartetes Ergebnis bleiben unterscheidbar.

Die konkrete Umsetzung muss echte Texte, längere Namen, leere/beschäftigte/blockierte Zustände, Fokus, Escape, Eingabesperren, Kontrast, Größenänderung und normale Maus-/Tastaturbedienung prüfen. Screenshotähnlichkeit ersetzt keine Interaktionsprüfung.

## Themes und nächste Screens

Der Owner möchte UI-Presets, eigene UI-Themes sowie gemeinsame Themes für Assets und Maschinen. [THEMES_PLAN.md](THEMES_PLAN.md) hält diese Ausbaustufe fest. [SCREEN_PLAN.md](SCREEN_PLAN.md) überträgt die Referenz auf die vorhandenen Spielabläufe. Neue Bilder bleiben jeweils **OWNER_REVIEW_PENDING**, bis der Owner sie beurteilt.

Aktueller Stand: Referenz gespeichert, Themen- und Screenplanung dokumentiert. Die Themefunktionen sind geplant; Spielcode und bestehende Rezepte, Saves, Materialbuchungen, Collider und Terrain bleiben auf dem bisherigen Implementierungsstand.
