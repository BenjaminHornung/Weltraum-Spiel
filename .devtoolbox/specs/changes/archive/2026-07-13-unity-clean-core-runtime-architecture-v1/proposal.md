# Proposal: Clean-Core Runtime Architecture v1

## Problem

Weltraum-Spiel besitzt einen gewachsenen Prototype-Runtime-Bereich unter
`Assets/Scripts/Prototype`. Dieser Bereich bleibt wichtig als Referenz,
Testdatenquelle und Legacy-Beweis, darf aber nicht der Ort fuer die naechste
Produktarchitektur werden.

Ohne klare Clean-Core-Grenzen riskieren kuenftige Features, Prototype-Code,
Scene-Wiring, UI, Autopilot, Datenvertraege und Tests weiter zu vermischen.

## Outcome

Dieser Change plant eine saubere Produktarchitektur unter `Assets/_Weltraum`
und dokumentiert die Regeln, nach denen spaetere Agents Runtime-Code,
Assembly-Grenzen, Scene-Manifeste und Legacy-Adapter schneiden sollen.

## Scope

In scope:

- Zielstruktur fuer `Assets/_Weltraum`
- Assembly- und Namespace-Regeln
- Legacy-Boundary fuer `Assets/Scripts/Prototype`
- Scene-Manifest-Vorlage als Konzept
- Agent-Regeln ueber `AGENTS.md` und `.agent/PLANS.md`
- DevToolbox-Plan fuer spaetere Umsetzung

Out of scope fuer diesen Setup-Task:

- Runtime-Code
- Unity Scenes
- Prefabs
- ScriptableObjects oder andere Unity Assets
- Autopilot-Neuimplementierung
- UI-Redesign

## Success Criteria

- Die Strategie- und Architekturdocs sind im Repo auffindbar.
- Der DevToolbox-Change besitzt `proposal.md`, `design.md`, `tasks.md` und
  `specs/clean-core-runtime-architecture/spec.md`.
- Offene Umsetzungstasks sind als offen markiert.
- Es wurden keine Runtime-, Scene-, Prefab- oder Prototype-Dateien geaendert.
