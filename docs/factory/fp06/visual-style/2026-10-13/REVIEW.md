# Hestia – neue Screenrunde

Die gemeinsame Basis ist vom Owner als visuelle Referenz freigegeben: Layout 1, Keramik-/Petrolfarben aus Variante 2, Minimap oben rechts und harter Microvoxelstil. Die drei folgenden Bilder planen **unterschiedliche Screens im selben Stil**. Ihr Status ist jeweils **OWNER_REVIEW_PENDING**.

UI-Presets und gemeinsame Themes für eigene Anlagen sind in [THEMES_PLAN.md](THEMES_PLAN.md) dokumentiert. Das visuelle Zielbild und die drei Screens sind ImageGen-Konzepte; sie sind keine Aufnahmen einer fertig implementierten Oberfläche. Die bestehende Fachlogik bleibt unverändert.

## Freigegebene Basis

![Freigegebene Keramik-/Petrol-Voxelreferenz](../../../../../art/factory/visual-reference/2026-10-13/approved-hud-ceramic-petrol-microvoxel.png)

## Bild 1 – Fracht und Transport

![Bild 1: Fracht und Transport](../../../../../art/factory/visual-reference/2026-10-13/01-fracht-transport.png)

Der 341-kg-Umform-Bausatz ist ausgewählt und noch in der Wrackfracht; der Träger ist leer. Die Aufnahme ist die klare Hauptaktion. Vier relevante Frachtzeilen ersetzen die permanente vollständige Liste. Der angegebene Gesamtbestand gehört zur ganzen Wrackfracht, nicht zur Summe dieser vier Zeilen.

Visuell zu beurteilen: lesbare Frachtwahl, Panelgröße, Paket-/Carrier-Erkennung und freier Blick in die Welt. Das Wrack im Hintergrund ist eine illustrative Silhouette, keine bestätigte native Assetgeometrie. Bei der Implementierung die vorhandenen brauchbaren Modelle verwenden und deren Verträge prüfen.

## Bild 2 – Bauvorschau

![Bild 2: Bauvorschau für Zuschnitt](../../../../../art/factory/visual-reference/2026-10-13/02-bauen.png)

Eine erkennbare Maschine erscheint als Baughost. Bodensupport, Arbeitsraum und vorhandener Bausatz werden zusammen mit den 208 kg Kosten gezeigt. Das Raster bleibt ausdrücklich 0,25 m. Bestätigung und Abbruch sind klar getrennt.

Visuell zu beurteilen: Stärke und Transparenz des Ghosts, Arbeitsraum-Markierung und Größe der Baufläche. Die Bildvorschau ist keine bestandene Native-Support-/Collision-Prüfung. Beim späteren Build alle drei Zustände gültig, blockiert und wartende Bestätigung mit normaler Eingabe prüfen.

## Bild 3 – Strom und Verbindung

![Bild 3: Energieverbindung mit gehaltenem Fortschritt](../../../../../art/factory/visual-reference/2026-10-13/03-energie-verbindung.png)

Ein unterbrochener Auftrag hält 40 % Fortschritt und seine 8 kg Stahl. Die Batterie-, Kabel- und Maschinenbeziehung erklärt die nächste Aktion. 4 kWh ist die Akkukapazität; 1,2 kW ist der unveränderte Nennbedarf des Cutters. Die 8-m-Verbindung ist eine illustrative Vorschau, keine bereits bestandene LOS- oder Kabelprüfung.

Konkrete Abweichungen vom Prompt: Das Bild zeigt die verlangte separate Istzeile **„Zugewiesen 0 W“** nicht. Diese muss vor Implementierung ergänzt werden. Die leuchtende Kabelvorschau ist stärker als geplant und kann wie eine aktive Verbindung wirken; als Vorschau ruhiger und eindeutig darstellen. Der Balken ist keine präzise Messung des 40-%-Labels. Solche Inhalte werden später aus denselben bestätigten Daten gerendert.

## Rückmeldung und nächstes Gate

Für jedes Bild einzeln beurteilen: Passt die Gestaltung? Ist die nächste Aktion klar? Welche Elemente wirken zu groß, zu technisch oder zu dominant? Die drei Bilder müssen nicht gegeneinander gewählt werden. Offene Präferenzen bleiben Ownerentscheidungen.

Erst nach Screenfeedback eine konkrete UI-Implementierung planen und die vorhandenen Input-/Pause-/Save-/Authority-Verträge prüfen. Concept Art darf keine echte Gameplay-, UI-, Save- oder Performanceabnahme ersetzen. Themes sind weiterhin geplant.

## Nachweise

[STYLE_REFERENCE.md](STYLE_REFERENCE.md) enthält die gespeicherte visuelle Richtung. [SCREEN_PLAN.md](SCREEN_PLAN.md) beschreibt die weiteren Screens. [SCREEN_PROMPTS.json](SCREEN_PROMPTS.json) enthält die tatsächlichen Prompts; [SCREEN_RESULTS.json](SCREEN_RESULTS.json) hält Ausgabereihenfolge, originale Dateipfade, Hashes und echte Eingangsreferenzen fest. Die PNGs sind lokal vollständig vorhanden und werden gemäß bestehender Repositoryregel mit Git LFS versioniert.
