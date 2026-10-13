# Gemeinsame UI- und Anlagen-Themes

Direkter Ownerwunsch: mehrere UI-Presets, ein Customizer für eigene Designs und Themes für Maschinen beziehungsweise Assets. Die Gestaltung soll über einen gemeinsamen Stil für die Anlagen erfolgen, nicht durch manuelles Anpassen jeder einzelnen Maschine. **Geplant; nicht implementiert.**

## Zusammenhängende Presets

Das erste visuelle Ziel ist die freigegebene Keramik-/Petrolreferenz. Ein benanntes Theme beschreibt Materialrollen und Erscheinung über den gesamten eigenen Maschinenpark: Cutter, Former, Lager, Bänder, Werkbank, Carrier und Energieobjekte. Materialdarstellungen behalten ihre Erkennbarkeit. Die genaue Einbeziehung fremder Wrackteile ist vor einer Implementierung separat zu bestimmen.

UI- und Anlagen-Themes können als zusammenpassendes Preset angeboten und unabhängig voneinander gewählt werden. Andere Presets benötigen eigene visuelle Prüfung; die älteren ImageGen-Varianten sind dadurch nicht automatisch freigegeben. Das Terrain ist durch diesen Wunsch nicht global umgestaltet.

## Customizer

Für die UI: Haupt- und Akzentfarben, Flächen, Text, Schriftgröße, Informationsdichte und geprüfte HUD-/Minimapanker. Für eigene Anlagen: gemeinsame Rahmen-, Verkleidungs-, Funktions- und Markierungsfarben sowie geprüfte Materialoberflächen. Änderungen erhalten eine Vorschau, einen Namen und eine Rücksetzfunktion. Eigene lokale Themes sollen gespeichert und erneut angewendet werden können.

Die Auswahl eines Anlagenthemes betrifft auch neu gebaute eigene Anlagen. Es braucht keine individuelle Themeverwaltung pro Maschine. Sicherheitsmarkierungen, Ein-/Ausgänge, Materialarten und Prozessfeedback bleiben unter allen Themes lesbar und erhalten zusätzlich Text oder Formhinweise.

## Technische Leitplanken für die spätere Umsetzung

- Stabile Theme-ID und versionierte Darstellungstokens; die bestehende UI-Komponentenstruktur bleibt erhalten.
- Semantische Materialrollen gemeinsam zuordnen und Materialien/Texturen cachen oder teilen. Ein Themewechsel darf nicht für jede Maschine unkontrolliert neue Ressourcen oder eigene Update-Loops erzeugen.
- Themes verändern Darstellung. BOM, Masse, Inventar, Ports, elektrische Zuweisung, Jobfortschritt, Physicsowner, Collider und Bauraster bleiben durch ihre bisherigen Autoritäten bestimmt.
- GLB, Blenderquellen und Animation sind keine World Authority. Bewegungen folgen dem bestätigten Prozesszustand.
- Spätere Form-/Meshvarianten brauchen native Quellen, Runtimeprodukte, Versionierung und Prüfung der bestehenden Hüll-, Port- und Colliderverträge. Ein kosmetischer Themewechsel ist keine Freigabe für andere Baugeometrie.
- Darstellungspräferenzen und deren Versionierung bleiben vom material- und energieerhaltenden Worldcheckpoint getrennt. Der konkrete Persistenz-/Import-/Exportvertrag ist vor Codeänderungen festzulegen.

## Reihenfolge und Gate

Zuerst die vorhandenen Abläufe in der freigegebenen Bildsprache planen und vom Owner beurteilen lassen. Den spielbaren W09–W11-Kern samt Save weiter abschließen. Bei der GUI-Umsetzung gemeinsame Tokens und Materialrollen vorbereiten, danach geprüfte Presets und einen begrenzten Customizer umsetzen. Die gewünschte Ausbaustufe erzeugt keine zusätzliche Forschungssperre oder Voraussetzung für den ersten Fabrikkreislauf.

Vor einer Fertigmeldung: normale Eingaben, Fokus/Rückkehr, ungültige oder fehlende Themes, Zurücksetzen, Wiederladen von Präferenzen, alle relevanten Warnzustände und ein realer Browserbuild mit geladenen Assets prüfen. Visual- und Gameplay-Abnahmen getrennt dokumentieren.
