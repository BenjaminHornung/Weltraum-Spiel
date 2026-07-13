# ExecPlan: Browser Mainline Repository Cleanup v1

## Ziel

Der aktive Branch enthält nach dem Cleanup die Browser-/Three.js-/TypeScript-
Mainline unter `apps/weltraum-browser`, aber kein aktives Unity-Projekt mehr.
Unity bleibt über den unveränderten Tag und Archiv-Branch auf dem
Ausgangscommit referenzierbar; noch wertvolle Quellen und Verhaltensintents
werden neutral unter `art/` und `docs/legacy-unity/` konserviert.

## Kontext

- Ausgangscommit: `8383487f89f6eb6e63140def564052ac86de259a`
- Vor finaler PR-Verifikation synchronisierter `main`: `bb8ef8378295c1788866d376ded059563229183b`
- Cleanup-Branch: `cleanup/browser-mainline-repository-v1`
- Archiv-Tag: `unity-legacy-final-2026-07`
- Archiv-Branch: `archive/unity-legacy-final-2026-07`
- Produkt-Mainline: `apps/weltraum-browser`
- Audit: `docs/repo-cleanup/unity-cleanup-audit.md`
- Ergebnis: `docs/repo-cleanup/unity-cleanup-result.md`
- DevToolbox-Inventar: `docs/repo-cleanup/devtoolbox-change-inventory.json`

Vier LFS-Payloads waren bereits auf `origin/main` nicht verfügbar. Alle
registrierten Worktrees enthalten nur Pointer und GitHub LFS antwortet jeweils
mit HTTP 404. Die unveränderten Archiv-Refs bewahren diesen historischen
Ausgangszustand; die kaputten Pointer werden im aktiven Cleanup-Branch entfernt
und als vorbestehender Datenintegritätsverlust dokumentiert.

## Nicht-Ziele

- Keine Änderung an Browser-Gameplay, Physics, Planner, Executor, Flight
  Controller, Renderer-Truth oder UI-Verhalten.
- Keine Dependency- oder Lockfile-Änderung. Ein aus dem synchronisierten `main`
  übernommener, fehlender E2E-Gruppeneintrag darf als reine CI-Zuordnung
  korrigiert werden.
- Kein History Rewrite, Force Push oder LFS-History-Migration.
- Keine stillen Task-Abschlüsse oder Checkbox-Änderungen.
- Kein Ersatz historischer Evidence durch nachgestellte oder anders gehashte
  Dateien.

## Architekturentscheidung

- Browser-Core und Simulation bleiben Gameplay-Truth; Three.js rendert
  Snapshots.
- Planner erzeugt einen stabilen `planHash`; der Executor führt ausschließlich
  den gelockten Plan aus und replanned nie still.
- Kein Target-, Waypoint- oder Position-Snap und kein Velocity-Zero-Shortcut.
- `TestBridge` bleibt ausschließlich über `?testBridge=1` erreichbar.
- Demo Scout GLB und `ProceduralFallback` bleiben unverändert verfügbar.
- Unity-Code wird nicht portiert; nur Verhalten, Zustände, Failure Cases,
  Acceptance-Ideen und verwertbare Art-Quellen werden konserviert.

## Implementierungsphasen

1. Archiv-Refs und vollständiges Before-Inventar verifizieren.
2. LFS-Risiken, eingehende Referenzen, Evidence und `.devtoolbox` klassifizieren.
3. Art-Quellen und fünf kompakte Legacy-Intent-Dokumente extrahieren.
4. Dokument-/Evidence-Moves ausführen und Referenzen aktualisieren.
5. `Assets`, `Packages`, `ProjectSettings`, Unity-Projektdateien und das
   Strategiepaket entfernen.
6. README, AGENTS, PLANS, Ignore-/Attribute-Regeln und Statusdokumente auf die
   Browser-Mainline umstellen.
7. Links, Dateisignaturen, LFS-Zustand, Unit Tests, Build und drei Playwright-
   Gruppen frisch verifizieren.
8. Diff reviewen, Ergebnisdokumentation finalisieren und einen einzelnen PR
   erstellen.

## Tests und Evidence

Aus `apps/weltraum-browser`:

```text
npm ci
npm run test
npm run build
npm run test:e2e:core
npm run test:e2e:live
npm run test:e2e:ui
npm run test:e2e
```

Zusätzlich:

```text
git diff --check
git status --short
git lfs ls-files
```

Die CI-Gruppenmitgliedschaft, GLB-/PNG-Signaturen, normale Route ohne
`TestBridge`, relative Markdown-Links und verbliebene Unity-Pfadreferenzen
werden separat geprüft.

## Risiken

- Nicht abrufbare historische LFS-Objekte können normale Checkouts blockieren.
- Unity-Art-Quellen oder Marker-Metadaten könnten bei zu grober Löschung
  verloren gehen.
- Dokument- und Spec-Links können nach Moves veralten.
- `.devtoolbox` enthält gemischte Plattformzustände und darf nicht heuristisch
  geschlossen werden.
- LFS-Filter können Binärdateien versehentlich nur als Pointer hinterlassen.

## Rollback / Safe Stop

- Keine Löschung ohne vorherige Keep/Move/Archive/Delete-Klassifizierung.
- Stop bei einer neuen Browser-Runtime-/CI-Abhängigkeit auf Unity-Pfade.
- Stop bei einem weiteren nicht klassifizierten oder unverfügbaren LFS-Objekt.
- Stop, wenn ein Browser-Gate nach reinen Cleanup-Moves fehlschlägt und eine
  Produktverhaltensänderung erforderlich wäre.
- Keine reduzierten Tests, gelockerten Assertions oder erhöhten Timeouts als
  Workaround.

## Fortschrittslog

- [x] Ausgangscommit und Remote-Mainline verifiziert.
- [x] Archiv-Tag und Archiv-Branch erstellt, gepusht und SHA-verifiziert.
- [x] Vorbestehenden LFS-404 reproduziert und lokale Recovery-Quellen geprüft.
- [x] Vollständiges Audit und `.devtoolbox`-Inventar abschließen.
- [x] Art-/Intent-Extraktion abschließen.
- [x] Unity-Strukturen entfernen und Dokumentation umstellen.
- [x] Vollständige Browser- und Repository-Verifikation ausführen.
- [x] Review und Ergebnisdokumentation abschließen.

## Definition of Done

Die Definition of Done entspricht dem Auftrag: keine aktiven Unity-
Projektstrukturen, neutrale verwertbare Quellen, browserzentrierte Guidance,
geordnete Specs/Evidence, unverändertes Browser-Produktverhalten, vollständig
grüne Browser-Gates und nachvollziehbare Before/After-Dokumentation.
