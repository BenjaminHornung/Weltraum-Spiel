# P-PG-F8 — Commitgrenze binden: Klassifikation↔Plan, Ankerrotation, ehrliches Cleanup

Fokusaudit-Folge (Abschnitte 4–6), VOR R4. Kein Render-, Save-, Residency-,
Stadt-, Wirtschafts- oder Orbit-Anteil. Reine Commitpfad-Scheibe:
`src/voxel/structural/physicsCommit.ts` (+ Tests, Evidence). Keine
Renderer/Szenen, keine Manifest-/Lockfile-Änderungen, kein Unity, keine
R4/R5-Themen, keine Allowlist-/Gate-Änderung.

Basis: Branch `feature/pg-tragwerk-slice1` @ `b352efc4120a5cc60b3cf7035c765f0004a5b035`
(F7 + Rollback-Fix, Review ACCEPT). Derselbe Branch/Worktree, NUR lokal, kein Push.
Fixture PG-TRAGWERK-01 und heterogener Schnitt (Stützenzelle (15,4,0) raus,
Trägerzeile x=14..18/y=5 als EIN Fragment, 5 Zellen) unverändert wiederverwendet.
Alle F8-Regressionen laufen mit einfachem zählendem World-Port (solverunabhängig,
kein Rapier, kein Step); F7 bleibt die solvergebundene Rapier-Evidence.

## 1. Klassifikation↔Plan-Bindung (Audit Abschnitt 4)

Audit-Befund: Commit erhält plan, live, classification separat und installiert
Zellen der ungebundenen Klassifikation. Repro A (korrekte Fixture + korrekter
Plan, nur in classification die Fragmentzellen (17,5,0),(18,5,0) durch
(3,8,0),(4,8,0) ersetzt, Planhash unverändert): muss VOR createBody SCHEITERN —
heute erfolgreich (26 Collider, 2 falsche Fragmentcollider). Repro B
(classification.anchoredComponents=[] bei korrektem Plan): muss SCHEITERN —
heute erfolgreich (Parent weg, Rest ohne Anker, Receipt meldet 0 Anker ohne
Widerspruch).

Fix (`physicsCommit.ts`, vor erster Weltmutation, alles mit phase "validate"):
`bindClassificationToPlan()` + `plan.objectId`-Bindung an live; Installation
liest danach nur den gemeinsam validierten, eingefrorenen Prepared-Zustand
(verankerte Zellen + plan-alignierte Fragmentzellen):

- Fragment-/Detached-Anzahl gleich; Plan-Body-Anzahl gleich Klassifikation;
  Plan-IDs eindeutig; jede Klassifikations-Fragment-ID im Plan (und umgekehrt
  jede Detached-Komponente in einem Fragment).
- Fragment↔Component an dieselbe live-Objektversion gebunden (objectId,
  objectRevision, sourceContentHash, Authority-Digest), exakte Zellmengen,
  nachgerechnete fragmentContentHash/fragmentId (P1 aus derive).
- Exakte Partition Union(verankert + Fragmente) == kanonische live-Occupancy:
  keine Doppelbelegung, keine Phantomzellen (getauschte Zellen fallen hier),
  keine Lücke (geleerter Rest fällt hier).
- Belegung gegen `plan.occupancyProof` (verankert/Fragment/total).
- Installationsgeometrie: Voxel-Collider jedes Plan-Bodys exakt aus seinen
  Klassifikationszellen abgeleitet (getauschte Zellen fallen auch bei
  gefälschten Hashes).

`F8-A`/`F8-B` schlugen pre-Fix fehl (kein Wurf, Welt mutiert) und bleiben als
Defektbeleg erhalten; post-Fix Wurf vor createBody, Inventar 1/27 unberührt.

## 2. Ankerrotation (Audit Abschnitt 5)

Audit-Befund: verankerter Rest wird als Body am Ursprung mit Identitätsrotation
erzeugt; Zentren transformiert, Würfelorientierung achsparallel; Port bietet pro
Cuboid keine Rotation. Repro (45°-Rotation um z, Quaternion z≈0,38268343 /
w≈0,92387953): Punkt mit Offset (0,06/0,06/0) vom Zentrum wird als innen
akzeptiert, obwohl lokale x-Koordinate ≈0,0848528 > Halbbreite 0,0625.

Fix: Restbody mit passender Pose + lokalen Offsets installieren (kein
Port-Umbruch nötig): Body trägt Translation/Rotation des Parents, Collider-
Offsets sind body-lokal im Autorframe (Zellmitte − Anker); die Engine rotiert
sie mit dem Body. Weltmitte identisch zu vorher (T + R·(c − A)), Orientierung
jetzt korrekt. Autorpfad unverändert (Pose Null/Identität, Anker Null →
Offsets = Zellmitten, Body am Ursprung).

`F8-C` prüft Pose (Translation + Quaternion), lokale Offsets (Autorframe) und
die Punktprobe (innen laut installierter Geometrie? muss AUSSEN sein; Orakel
lokal x ≈0,08485): pre-Fix FAIL (Body am Ursprung, Punkt innen), post-Fix PASS.
45° ist keine Würfelsymmetrie (erst 90°), reine Mittelpunktasserts wären blind —
darum Punkt-/Kontaktprüfung. F7-T2-Spot-Check (Stütze (15,3,0) auf W(Zellmitte))
bleibt grün: Mitten sind positionsidentisch.

## 3. Ehrliches Cleanup (Audit Abschnitt 6)

Audit-Befund: `removeCreated()` verschluckt Remove-Fehler, äußerer Catch meldet
worldRestored:true. Repro per Fault-Injection (Parent vorhanden → Commit erzeugt
Restbody → addCollider schlägt fehl → removeBody des neuen Bodys schlägt
ebenfalls fehl): heute worldRestored:true bei Bodies 1→2.

Fix — Cleanup-Erfolg sammeln + verifizieren, Vertrag:

- Create/Add-Fehler: Parent unberührt, erstellte Bodies rollbacken;
  worldRestored:true NUR bei verifiziertem Rückbau (Bodies- UND Colliderzählung
  wieder auf Vorher-Stand), sonst worldRestored:false mit Cleanup-Kontext
  (Remove-Fehlzahl, keine sichere Wiederaufnahme, verbleibende Handles bleiben
  in der Welt sichtbar).
- Parent-Remove-Fehler: konservativ worldRestored:false (Remove-Semantik des
  Ports unbekannt), trotz Rollback-Versuch (Ergebnis steht in der Meldung).
- Fehler NACH erfolgreicher Parententfernung (z.B. Zähl-Reads im Receipt, via
  `parentRemoved`-Flag): Welt nicht restaurierbar → Phase "remove",
  worldRestored:false statt fälschlichem Create-Rollback mit true.

`F8-D` (Counting-Port, Add-Fehler beim 2. Commit-Collider + Remove-Fehler am
neuen Body): pre-Fix FAIL (worldRestored:true bei Bodies 1→2), post-Fix PASS
(worldRestored:false, Restbody belegt die unvollständige Wiederherstellung).

## Quelle und Kennzahlen

- Produktdiff: `src/voxel/structural/physicsCommit.ts` (Bindung + Prepared,
  Ankerpose, Cleanup-Vertrag). Keine derive-/Vertragsum bauten (R4/R5 nur verwendet).
- Neu: `tests/unit/structuralPgTragwerkF8.test.ts` (4 Tests, Counting-Port,
  solverunabhängig: F8-A, F8-B, F8-C, F8-D).
- F8-Datei: 4/4 PASS (alle 4 pre-Fix FAIL belegt). F7-Datei: 7/7 PASS.
  `tsc --noEmit` sauber. Vollsuite: siehe Summary-JSON.
- Inventare: Counting-Port 1/27 → unberührt bei Rejects; Live-Pfad Receipt
  Bodies 1→2, Anker 21, Fragment 5 (unverändert).
- Solver: kein Solver in F8-Tests (Counting-Port); F7 weiter Rapier 0.12.0.
- Kein Push (Paketvorgabe).

## Befund → Fix → Test-Mapping

| Auditbefund (Abschnitte 4–6) | Fix/Umsetzung | Test |
|---|---|---|
| Ungebundene Klassifikation installiert (getauschte Fragmentzellen, Planhash gleich) | `bindClassificationToPlan()` vor Mutation (P1-Bindung, Partition, Occupancy-Proof, Geometrie) + Prepared-Zustand | F8-A (pre-Fix FAIL / post-Fix PASS, Inventar 1/27) |
| Leerer Anker-Rest ohne Widerspruch (Parent weg, 0 Anker) | Vollständige Restbelegung in Bindung (Partition + Occupancy-Proof) | F8-B (pre-Fix FAIL / post-Fix PASS, Welt unberührt) |
| Ankerrotation fehlt (Ursprung/Identität, Punkt (0,06/0,06/0) fälschlich innen) | Restbody mit Parentpose + lokalen Autor-Offsets | F8-C (Pose/Offsets/Punktprobe; pre-Fix FAIL / post-Fix PASS) |
| Cleanup verschluckt Remove-Fehler (worldRestored:true bei 1→2) | Cleanup sammeln + zählenverifizieren; Vertrag Create/Add/Parent/Post-Remove; `parentRemoved`-Flag | F8-D (pre-Fix FAIL / post-Fix PASS, worldRestored:false) |
