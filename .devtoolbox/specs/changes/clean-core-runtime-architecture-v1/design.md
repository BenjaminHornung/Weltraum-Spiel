# Design: Clean-Core Runtime Architecture v1

## Source Draft

Ausgangspunkt ist `weltraum_refactor_strategy_package/spec_drafts/clean-core-runtime-architecture-v1.md`.

## Architecture Direction

Neue Produktarbeit soll spaeter unter `Assets/_Weltraum` entstehen. Der
bestehende Prototype bleibt Legacy und Referenz, wird aber nicht opportunistisch
weiter ausgebaut. Uebergaenge muessen explizit als Adapter, Testbruecken oder
Migrationen beschrieben werden.

## Boundaries

- Core-Logik soll ohne Scene-Abhaengigkeit testbar sein.
- Unity-Wiring gehoert in Composition/Bootstrap-Schichten, nicht in Domain-Code.
- Scenes enthalten Wiring und Presentation, keine dauerhafte Business-Logik.
- Prototype-Code darf nur geaendert werden, wenn ein spaeterer Task das
  ausdruecklich verlangt.

## This Setup Slice

Dieser Auftrag legt nur Dokumente und Spec-Scaffolds an. Folder Skeleton,
Assembly Definitions und Runtime-Tests bleiben bewusst offene Folgetasks, damit
kein Runtime-Refactor ohne eigene Spec und Evidence startet.
