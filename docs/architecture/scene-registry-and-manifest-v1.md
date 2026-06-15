# Scene Registry and Manifest v1

## Ziel

Dieses Dokument definiert eine bindende Scene-Manifest-Struktur für den Clean-Core-Produktbereich. Es ergänzt `docs/architecture/scene-management-v1.md` und `docs/architecture/clean-core-runtime-architecture.md`, damit neue Scenes konsistent beschrieben, geprüft und später automatisiert validiert werden können.

## Bezug

- `docs/architecture/scene-management-v1.md`
- `docs/architecture/clean-core-runtime-architecture.md`
- `Assets/_Weltraum/Scenes/SCENE_MANIFEST_TEMPLATE.md`

## Scene-Typen

Es gelten genau diese fünf Scene-Typen:

- `Product`
- `VerticalSlice`
- `TestRange`
- `UIShowroom`
- `Archive`

Zuordnung zu den bestehenden Ordnern unter `Assets/_Weltraum/Scenes/`:

- `Product` -> `Product/`
- `VerticalSlice` -> `VerticalSlices/`
- `TestRange` -> `TestRanges/`
- `UIShowroom` -> `UIShowroom/`
- `Archive` -> `Archive/`

## Manifest-Pflichtfelder

Jede Scene bekommt ein Markdown-Manifest mit diesen 15 Pflichtfeldern:

1. **Scene name** – stabiler, eindeutiger Name der Scene.
2. **Scene type** – einer der fünf erlaubten Typen.
3. **Purpose** – Zweck der Scene in einem Satz.
4. **Owner systems** – zuständige Runtime- oder UI-Systeme.
5. **Allowed runtime roots** – welche Root-Objekte/Services in der Scene zulässig sind.
6. **Required prefabs** – benötigte Prefabs und ihre Rolle.
7. **Required services** – Services, die für die Scene vorhanden sein müssen.
8. **Input mode** – erwarteter Eingabemodus oder Moduswechsel.
9. **Camera policy** – Kameraregeln, Default-Kamera und Ausnahmen.
10. **UI policy** – erlaubte UI-Zustände und Player/Debug-Abgrenzung.
11. **Test category** – meist identisch mit dem Scene-Typ und in den fünf Kategorien geführt. In der Regel identisch mit dem Scene-Typ; nur abweichen, wenn die Scene als Testgrenze für eine andere Kategorie dient.
12. **Screenshot evidence requirements** – welche Bilder oder Evidenzen notwendig sind.
13. **Scene validation checklist** – konkrete Prüfpunkte für die Scene.
14. **Known limits** – bekannte Einschränkungen oder bewusste Abweichungen.
15. **Exit criteria** – wann die Scene als fertig gilt.

## Validierungsregeln

Die folgenden Regeln sind bindend:

> Die ersten sechs Regeln entsprechen 1:1 den in der Manifest-Vorlage reproduzierten core Scene-Regeln aus AGENTS.md. Die zusätzlichen Regeln (EventSystem, null-critical fields, Prototype-Adapter, Debug-Only-UI, Console-Errors) sind ebenso bindend und werden in der Scene Validation Checklist der Vorlage operationalisiert.

- Scenes enthalten Wiring, keine Geschäftslogik.
- Genau eine aktive MainCamera, außer dokumentiert.
- Keine Missing Scripts.
- Keine Produktlogik als Scene-only Script.
- Scene-Änderungen brauchen Validation und Screenshot/Evidence.
- TestRange Scenes müssen headless/automatisierbar sein, wenn möglich.
- Genau ein EventSystem.
- Keine null-critical serialized fields.
- Keine Prototype-Abhängigkeit ohne Adapter.
- Keine Debug-Only UI im Player Basic Preset.
- Szenen laden ohne Console Errors.

## Manifest-Ablage

Das Manifest liegt neben der Scene als Markdown-Datei:

`Assets/_Weltraum/Scenes/<Category>/<SceneName>.manifest.md`

Die Datei beschreibt die Scene unabhängig von späterer Automatisierung und kann bereits vor der Einführung von Runtime-Tools verwendet werden.

## Umgang mit Legacy Scenes

Bestehende oder alte Scenes bleiben zunächst dokumentiert, aber sie sind kein Vorbild für neue Clean-Core-Scenes. Neue Arbeit soll sich am Template und an den Clean-Core-Regeln orientieren. Legacy Scenes dürfen nur über dokumentierte Adapter oder Archivierungsregeln weitergeführt werden.

## Scope dieses Slices

Dieses Slice ist ausschließlich für Dokumentation und Template gedacht.

- keine `.unity` Scene
- kein Prefab
- kein Runtime-Code
- keine Prototype-Erweiterung

## Weiterarbeit

Sobald eine erste echte Clean-Core Scene entsteht, kann Phase 3 des Clean-Core-Workflows dieses Template als verbindliche Basis verwenden. Danach lassen sich Validatoren, Build-Listen und Evidence-Flows schrittweise ergänzen.
