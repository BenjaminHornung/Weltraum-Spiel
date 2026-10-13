# Die vorhandenen Screens in der freigegebenen Bildsprache

Diese Planung nutzt die vorhandenen Factoryabläufe des lokalen Integratorstands `b0871cfe851a6d519f40e56dc885a980a113e095`. Grundlage sind echte bestehende Fracht-/Bauaufnahmen, die vorhandenen UI-Dateien und das vom Owner freigegebene kombinierte ImageGen-Bild. Die alten Aufnahmen sind Funktionsreferenzen; die neue Bildsprache kommt aus [STYLE_REFERENCE.md](STYLE_REFERENCE.md).

## Erste Bildrunde: drei unterschiedliche Spielzustände

| Screen | Spielerziel und Hauptaktion | Relevante Information und Rückmeldung |
| --- | --- | --- |
| 1: Fracht und Transport | Einen vorhandenen Umform-Bausatz mit dem Carrier aufnehmen | Endliche Wrackfracht, ausgewähltes Paket 341 kg, Standort und Transportzustand; Auswahl und Aufnahme unterscheiden |
| 2: Bauen | Den Cutter im gültigen lokalen Bereich platzieren | Erkennbare Bauvorschau, Bodensupport, Arbeitsraum, 0,25-m-Raster; 208 kg Bausatz vorhanden und beim Bestätigen bezahlt; Abbrechen erhält Material |
| 3: Energie und Verbindung | Eine unterbrochene Maschine lokal mit einer Batterie verbinden | Fehlender Strom, 0 W zugewiesen gegenüber 1,2 kW Nennbedarf; reserviertes Material und Fortschritt bleiben erhalten; Kabelbedarf und endlicher Bestand |

Jedes Bild enthält dieselben Keramikflächen, Petrolaktionen, Voxelwelt und Minimap rechts oben. Der Screen erklärt eine konkrete Handlung; er präsentiert keine komplette Debugliste. Die drei Konzepte sind keine alternativen Themes, sondern Bestandteile derselben Gestaltung. Alle drei: **OWNER_REVIEW_PENDING**.

Die gezeigten Zustände sind illustrative Fixtures. Ein Bild beweist keine reale Native-Platzierung, Kabel-LOS oder simulierte Produktion. Die bisherigen Golden-Rezepte bleiben unverändert; beispielsweise benötigt REC-01 weiterhin 8 kg Stahl und erzeugt nach 30 s mit tatsächlicher Stromversorgung 7,5 kg Halbzeug und 0,5 kg Verschnitt bei 1,2 kW Nennleistung.

## Weitere vorhandene Screens

| Screen | Gestaltung und vollständiger Weg |
| --- | --- |
| Start / Fortsetzen | Kurze klare Spielauswahl vor derselben Welt; bestätigte Save-Metadaten, Ladevorgang und Fehlerzustand; eigener Einstieg in Play |
| Laufender HUD / Onboarding | Ein nächstes sinnvolles Ziel, kontextbezogene Interaktion, minimales permanentes HUD; Rückmeldung nach tatsächlichem Fortschritt |
| Maschinen | Kompaktes Instrument unten rechts; Rezept als Materialfluss, Nenn-/Istwerte getrennt, ein Startbefehl; WAIT_POWER, voller Ausgang und Abschluss jeweils erklärbar |
| Lager und Bänder | Gerichteter Fluss und Kapazität, tatsächlich vorhandene Mengen, blockierter Ausgang und nächste mögliche Aktion; keine unendlichen Förderanzeigen |
| Lokale Karte | Größere Ansicht aus derselben Minimap; Spieler, bekannte Wege, Wrack und eigene Anlagen; eindeutiger Maßstab und Rückkehr ins Spiel |
| Technikübersicht | Bestehende Produktionskette und ihre Abhängigkeiten lesbar darstellen; keine zusätzliche Forschungssperre |
| Pause / Hilfe | Ruhiger fokussierter Menübereich, bestätigtes Pausieren, eindeutiges Fortsetzen und tatsächliche Steuerung |
| Save / Load | Bestätigter Checkpoint, klare Erfolgs-/Fehlerrückmeldung; Laden stellt Material, Energie, WIP und Nativezustand wieder her |
| UI-/Anlagen-Themes | Gemeinsames Preset auswählen, Vorschau in echten Zuständen, zurücksetzen und später eigene Themes speichern; gemeinsame Anwendung auf Anlagen |

Weitere Bildrunden folgen dem Ownerfeedback. Neue Designbilder überschreiben keine freigegebenen Referenzen. Für die Implementierung bleiben fachliche, Eingabe-, Save-, visuelle und Performancegates getrennt.

## Bildnachweise

Die freigegebene Basis besitzt vollständigen Prompt und SHA-256. Die neue Runde wird mit den tatsächlichen drei Prompts, Referenzen, Ausgabereihenfolge und Datei-Hashes gespeichert. Die Ausgabereihenfolge definiert die Bildnummern für das anschließende Ownerfeedback.
