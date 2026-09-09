# P-PG-R4 — Persistenz, Residency und Asynchronitaet verbunden

Kein Render-, Physik-, Schema-Anteil. Reine Test-Scheibe auf dem stabilen
R3-Vertrag (exakte Partitionsbindung, Step-Punkt-Swap, heterogener Transfer;
Commit `bd648e64`, Review ACCEPT) plus Test-Nachtrag aus dem R3-Review-Finding
(low). Keine Produktlogik-Aenderung, daher JSON-/Markdown-Evidence ohne
Screenshots (AGENTS.md Evidence-Regeln).

Basis: Branch `feature/pg-tragwerk-slice1` @ `bd648e64`, derselbe
Branch/Worktree, lokal, kein Push. Fixture PG-TRAGWERK-01 und heterogener
R3-Schnitt (Stuetzenzelle (15,4,0) raus, Traegerzeile x=14..18/y=5 als EIN
Fragment aus 2x Stahl + 3x Traeger, 46,2890625 kg) unveraendert
wiederverwendet.

## R4a — Bewegtes Fragment: Save, echte Freigabe, Reload, weiter simulieren

- Laufende intakte Welt: Parent-Body ueber voller Prae-Schnitt-Occupancy
  (27 Zellen), 20 Pre-Steps. Schnitt ueber Structural-Commandpfad, Plan mit
  live gelesener Parentmotion, Quelle `"live-parent-body"` (R3-Vertrag).
- Swap bei 0 Interim-Steps: Bodies 2 -> 3, Collider 28 -> 27.
- Fragment 2 Steps bewegt (Translation weg von Install-Pose > 0,005 m,
  Speed > 0,05 m/s — faellt schnell, sicher vor Kontakt, sicher in Bewegung).
- SAVE ueber den vorgesehenen Savevertrag (`encodeStructuralObject`).
- ECHTE Freigabe: Owner-Referenz auf null gesetzt, `world.free()`.
  Die Neuinstallation verwendet danach nur Save-Dokument + Motion-Snapshot
  (keine alten Handles — strukturell garantiert, da nichts ueberlebt).
- RELOAD (`decodeStructuralObject`): Belegung identisch (26 Zellen, Loch
  erhalten), Revision/Hashes/Evidence identisch, Masse identisch,
  Klassifikation kanonisch identisch, Replan-`contentHash` identisch
  (gleiche Motion + gleiche Quelle `"live-parent-body"`).
- Neuinstallation in FRISCHER Welt an gespeicherter Pose mit gespeicherten
  Velocities: Inventar identisch (3 Bodies, 27 Collider — kein Doppel, keine
  Luecke), Solver-Masse relativ 1e-6, Pose/Rotation/Linvel/Angvel exakt am
  Snapshot (< 1e-9).
- Weiter simulieren: bewegt sich weiter (> 0,005 m in 3 Steps), faellt auf
  den Stuetzenstumpf, schlaeft (Ruhe-Y 0,4..0,7 m), Inventar stabil.

## R4b — Region evicten und zurueckkehren ohne Res/Doppel (gleiche Welt)

- Zyklus `Ready -> Evicted -> Queued -> Loading -> Ready` ueber
  `transitionResidency`, aber mit TATSAECHLICHEM Evict: Region-Bodies aus der
  laufenden Welt entfernt (Bodies 3 -> 1, Collider 27 -> 1 — nur Ground
  uebrig), Referenzen fallen weg.
- Rueckkehr: Reload aus dem Save, Neuinstallation in DERSELBEN Welt an
  gespeicherter Pose/Velocities.
- Nach Rueckkehr: Bodies 3, Collider 27; Belegung, Fragmente,
  Transitions-`contentHash` identisch; keine Zelle, kein Collider
  wiederauferstanden, keiner verloren, keiner doppelt.
- Region simuliert weiter und kommt zur Ruhe (Sleep), Inventar stabil.

## R4c — Stale Worker-/Proxyresultate nach neuerem Edit + Cancel

- Bindung an Post-Cut-Stand (Revision 1); danach NEUERER Edit
  ((18,5,0) faellt weg -> Revision 2, neuer Content-Hash).
- Altes Resultat (Epoch 3, Revision 1->2) nach dem Edit zugestellt ->
  `RejectedStalePlanningEpoch`; selbst bei passender Epoch bleibt die alte
  Input-Revision stale -> `RejectedRevisionMismatch`.
- Cancel-Pfad: gueltiges Resultat gegen abgebrochene Erwartung ->
  `RejectedCancelled`.
- Adoptions-Modell: nur `Accepted` wuerde adoptiert (Besitz-Transfer) —
  nachweisbar nichts adoptiert (`adopted === null`).
- Nach allen Zustellungen: Authority-Belegung und `contentHash` == Post-Edit-
  Stand, `objectRevision` weiter 2 — alte Resultate aendern weder Authority
  noch neue Revision.
- Stale Proxy (Revision 1) nach dem Edit unterscheidbar; Consumer-Projektion
  bleibt Revision 2 (keine Adoption als Truth).

## R4d — Save-Failpfade fail-closed

- Manipuliertes Dokument (Revision-Hash-Bindung gebrochen) -> fail-closed
  abgewiesen (Revisionsbindung schlaegt an); niemals partiell adoptiert.
- Uebergroesse ueber dem Persistenz-Limit (16 MiB) -> `InvalidContract`.
- Gueltige Projektion, aber nicht-kanonische Key-Reihenfolge ->
  `InvalidContract`.
- Authority unangetastet (Belegung, Hash, Revision) und weiter ableitbar;
  Savevertrag intakt (Re-Encode byte-identisch).

## Debris-Steiner-Testnachtrag (R3-Review-Finding low)

Reine Test-Ergaenzung im Slice4-Fallback-Test, keine Produktlogik-Aenderung:
Single-Member-Sonderfall — Debris-COM == Fragment-COM (9 Nachkommastellen),
alle 6 Tensorkomponenten gegen unabhaengige Steiner-Nachrechnung
`I = I_eigen + m*(|d|^2 E - d d^T)` (12 Nachkommastellen), Folge
Debris-Tensor == Fragment-Eigentensor (d ~ 0, Diagonale 9 Stellen,
Nebendiagonale < 1e-9).

## Quelle und Kennzahlen

- Neu: `tests/unit/structuralPgTragwerkR4.test.ts` (4 Tests).
- Ergaenzt (Test only): `tests/unit/structuralPgTragwerkSlice4.test.ts`
  (14 expects im Fallback-Test: 6 Steiner + 3 COM + 5 Identitaet).
- Kein Src-Diff (R3-Vertrag nur verwendet, nicht umgebaut).
- Basis-SHA: `bd648e6471e46f53bb04f5f491bf4e7333de7f8d`
- R4-Datei: 4/4 PASS. Slice4-Datei: 6/6 PASS (inkl. Steiner-Nachtrag).
  Vollsuite: 142 Dateien / 1363 Tests PASS. `tsc --noEmit` sauber.
- Live-Zyklen: 20 Pre-Steps, Swap bei 0 Interim-Steps, Bodies 2 -> 3,
  Collider 28 -> 27; Reinstall-Inventar 3/27; Evict-Inventar 3/27 -> 1/1 -> 3/27.
- Solver: @dimforge/rapier3d-compat 0.12.0 (transitiv, lockfile-pin,
  kein Manifest-Eingriff; fail-closed bei Wegfall).
- Kein Push (Paketvorgabe).

## Befund -> Fix -> Test-Mapping

| Auditbefund (Abschnitt 8 R4) | Fix/Umsetzung | Test |
|---|---|---|
| Fragment bewegen, Zustand speichern | Bewegtes Fragment (Pose/Rotation/Velocities), Save via Savevertrag | R4a (Snapshot-, Save-, Reload-, Fortsetzungs-Assertions) |
| Besitzer/Welt freigeben, neu laden | Owner null + world.free(), Reload nur aus Save+Snapshot | R4a (Freigabe-, Reload-, Inventar-Assertions) |
| Region evicten/zurueckkehren | Echter Body-Evict + Residency-Zyklus + Reinstall | R4b (Evict-Inventar, Rueckkehr-, Sleep-Assertions) |
| Stale Resultate nach neuerem Edit | Zustellung gegen neue Epoch/Revision, Adoption verhindert | R4c (Reject-Kinds, adopted-null, Authority-/Revisions-Beleg) |
| Savevertrag Fail-/Cancelpfade | Tamper/Uebergroesse/nicht-kanonisch + Cancel-Gate | R4d + R4c (InvalidContract-/RejectedCancelled-Belege) |
| Loch + Materialbilanz erhalten | Belegungs-/Massen-/Solver-Vergleiche vor/nach | R4a/R4b (Keys, Masse, Solver-1e-6) |
| Keine Doppel-Bodies/Res-Zellen | Inventar- + Occupancy-Vergleiche | R4a/R4b (Bodies/Collider/Fragmente/Plan-Hash) |
| R3-Finding low: Debris-Tensor ohne Assertion | Steiner-Cross-Check als Testnachtrag | Slice4-Fallback (6 Tensor- + 3 COM- + Identitaets-Assertions) |

---

# P-PG-R4B — Persistenz-Neufassung (Fokusaudit 08.09.2026, Abschnitte 4+5)

Basis: Branch `feature/pg-tragwerk-slice1` @ `e5470be4` (F8-Commitgrenze),
derselbe Branch/Worktree, lokal, kein Push. Vorlaeufer-Stand 145 Dateien /
1381 Tests + tsc gruen.

## Befund 4a — Y-Mittelpunktfehler

`installCuboids` im R4-Test rechnete
`(min.y + min.y) / 2 - center.y` statt `(min.y + max.y) / 2`; alle Collider
0,0625 zu tief installiert (heterogene Fixture: y-Soll 0,6875, installiert
0,625). Pre-Fix-Repro als failing Test belegt (installiert 0,625 vs. 0,6875,
Delta exakt 0,0625). Produktcode (`toMetersBox`, `voxelCuboidForCell`) und
R3-/F7-Helper waren korrekt — nur der R4-Pfad war betroffen.

Fix: Formel auf `(min + max) / 2` auf allen Achsen korrigiert; Helper auf
reines Pre-Cut-Parent-Seeding zurueckgestutzt (`seedIntactParentVoxels`).
Regression R4B-Y: kanonische Collider-Weltpositionen (Solver-Readback
`Collider.translation()`, Welt-Raum) + Plan-Mittelpunkte + Solver-
`RigidBody.localCom()`
gegen handgerechnete kanonische Werte (5,5 * 0,125 = 0,6875; Masse
46,2890625 kg aus 2x Stahl 7800 + 3x Traeger 2700) — ohne denselben
Installer fuer Soll und Ist.

## Befund 4b/5 — Bewegter Zustand nicht im Save, ungebundener Restore

Gespeichert wurde nur `encodeStructuralObject(live)`; Pose/Velocities lebten
separat in `moved` im Speicher, `installRegion(..., moved)` uebernahm sie
ungebunden (gefaelschte Pose still akzeptiert — Pre-Fix-Repro belegt).

Fix (Produkt, minimal):
- Neu `src/voxel/structural/regionSave.ts`: versionierter Container
  `structural-microvoxel-region-save-v1` — Objekt (ueber bestehenden
  Savevertrag eingebettet) + Parent-Motion + Parentpose/PreCut-COM (nur bei
  `live-parent-body`) + Fragment-Motions mit Besitz-/Revisionsbindung
  (fragmentId, objectRevision, sourceContentHash) + `saveHash` ueber alles.
  Leere Motions, Dubletten, Stale-/Fremd-Bindung und Tamper fail-closed;
  Encode selbstverifiziert (fehlgeschlagene Transaktion faellt beim
  Speichern, nicht erst beim Reload).
- `physicsCommit.ts` (additiv, F8-Semantik unveraendert): optionale
  `restoredFragmentMotions` — geschlossen validiert VOR Weltmutation
  (alle Plan-Fragmente exakt einmal, Einheitsquaternionen); ersetzt
  Plan-abgeleitete Pose/Velocities. Fehlt eine Motion, scheitert der Commit
  statt still default weiterzulaufen.
- `types.ts`: `STRUCTURAL_REGION_SAVE_MAX_MOTIONS`; `index.ts`: Export.

Tests (Datei `structuralPgTragwerkR4.test.ts`, 9 Tests):
- R4a: Live-Phase im Producer-Scope (20 Pre-Steps, Commit-Swap 2->3/28->27,
  2 Steps Bewegung), Voll-Save, `world.free()`; Restore NUR aus
  Artefakt-String (kein live/plan/moved-Zugriff), Pose/Vel exakt < 1e-9 am
  Artefakt, Replan-Hash identisch, weiter simulieren bis Sleep (Ruhe-Y
  0,4..0,7), Inventar stabil.
- R4b: echter Evict (3/27 -> 1/1, Handles genullt), Rueckkehr via
  Artefakt+Commit in derselben Welt (3/27), Residency-Zyklus, Sleep.
- R4B-N1: Motion-Tamper (kanonisch re-serialisiert — nur saveHash faengt
  ihn), Revisions-Tamper, Torn-Write, Limit → fail-closed.
- R4B-N2: leere Motions ungueltig (Encode+Decode); Objekt-Only-Save ohne
  Motions stellt den Bewegungszustand NICHT her (Abstand > 0,005).
- R4B-N3: leere/fremde Motions am Commit VOR Mutation abgewiesen
  (validate, worldRestored:true, Zaehler unveraendert).
- R4B-N4: Encode ohne Motion ungueltig; ein testlokaler fehlgeschlagener
  Write hinterlaesst keinen Slotwert; Torn-Write abgewiesen; gueltiges
  Artefakt laedt. Ein Produktions-Storage-Adapter ist ausserhalb dieses
  Save-Codec-/Installations-Slices.
- R4c/R4d unveraendert (Stale-Niveau gehalten, Save-Failpfade).

## Quelle und Kennzahlen (R4B)

- Neu: `src/voxel/structural/regionSave.ts`; geaendert: `physicsCommit.ts`
  (Override additiv), `types.ts` (1 Konstante), `index.ts` (Export),
  `tests/unit/structuralPgTragwerkR4.test.ts` (Neufassung, `installRegion`
  entfernt), Evidence.
- Basis-SHA: `e5470be4bf91bee33ef08e50426db713538a7b5d`
- R4-Datei: 9/9 PASS. Vollsuite: 145 Dateien / 1386 Tests PASS.
  `tsc --noEmit` sauber.
- Solver: @dimforge/rapier3d-compat 0.12.0 (transitiv, lockfile-pin,
  kein Manifest-Eingriff).
- Kein Push (Paketvorgabe).

## Befund -> Fix -> Test-Mapping (R4B)

| Auditbefund (Abschnitte 4+5) | Fix/Umsetzung | Test |
|---|---|---|
| Y-Mittelpunkt `(min.y+min.y)/2`, Collider 0,0625 zu tief | Formel `(min+max)/2` alle Achsen; Helper auf Parent-Seeding reduziert | R4B-Y (Orakel 0,6875, Plan+Solver-Readback) |
| Reload wiederholt Installationsfehler, keine kanonische Positionspruefung | Restore ueber Commit (Produktpfad), Orakel unabhaengig vom Installer | R4B-Y + R4a/R4b (Weltpositions-/COM-Assertions) |
| Bewegter Zustand nur in `moved` (Memory), Save ohne Motion | Versionierter Region-Save (Identitaet+Pose+v/omega+Bindung+saveHash) | R4a/R4b (Artefakt-Roundtrip, Motion im Artefakt belegt) |
| `owner = null` heisst nicht persistiert; Schummel-Moeglichkeit | Producer/Restore-Schnitt: Restore nimmt nur Artefakt-String | R4a (strukturell), R4B-N2 (ohne Artefakt kein Zustand) |
| Tamper an Bewegungsdaten akzeptiert | saveHash + Bindungspruefung, fail-closed | R4B-N1 (kanonischer Tamper, Revision, Torn-Write) |
| Fehlende Fragmente / leere Motion laufen still weiter | Non-empty-Pflicht (Codec) + geschlossene Commit-Bindung | R4B-N2/N3 (Encode-, Decode-, Commit-Abweisung) |
| Fehlgeschlagene Speichertransaktion | Encode-Selbstverifikation; testlokaler Write-Fehler hinterlaesst keinen Slotwert; Torn-Artefakt abgewiesen | R4B-N4 |
| Wiederaufbau am alten Helferpfad vorbei an F8 | Commit mit Prepared-Bindung + Platzhalter-Parent (Receipt ehrlich) | R4a/R4b (Receipt-, Bindungs-, Inventar-Assertions) |
| Stale/Cancel-Niveau halten | Unveraendert | R4c |
| Save-Failpfade (Objektvertrag) | Unveraendert | R4d |

## P-PG-R4B-FIX — Review-Blocker-Nachtrag

Basis: Paketstart bei `20e161d8bc8f9deef9b511f9bdf40a3731333bdd`, Branch
`feature/pg-tragwerk-slice1`, derselbe Worktree, lokal, kein Push. Die vier
Regressionsfaelle wurden failing-first angelegt. Vor dem Produktfix waren N0
(leere Motions bei einer verankerten Region), N2b (expliziter Restore ohne
Motion-Satz) und N4 (kein echter Write-Versuch im alten Test) rot. Die neue
Y-Regression blieb gegen den bereits korrigierten Helper gruen; ein
kontrollierter Rueckfall auf `(min.y + min.y) / 2` reproduzierte danach rot mit
`0.625` statt `0.6875`. Der Helper wurde vor der Implementierung wieder auf die
kanonische Formel `(min.y + max.y) / 2` zurueckgesetzt.

| Befund | Fix | Test/Evidence |
|---|---|---|
| Voll verankerte Region mit `dynamicBodies.length === 0` wurde pauschal wegen leerer Motions abgewiesen; echte Fragmentabdeckung war nicht gebunden. | `regionSave.ts` leitet die Fragment-IDs aus dem gespeicherten Objekt ab und verlangt exakt diese Menge. `motions: []` ist nur bei null dynamischen Fragmenten gueltig; partielle, doppelte, fremde oder stale Bindungen bleiben fail-closed. | R4B-N0: Save/Decode/Restore einer 27-Collider-verankerten Region mit leerem Satz; R4B-N3/N4: leere/duplizierte/fremde dynamische Sets abgewiesen. |
| Restore ohne Motion-Satz fiel still auf Plan-/Parent-Werte zurueck. | `physicsCommit.ts` trennt Fresh/Restore typisiert. Restore verlangt den vollstaendigen Motion-Satz (auch leer nur fuer zero-dynamic); Fresh bleibt ohne Motions plan-abgeleitet. Unbekannte Runtime-Modi fail-closed vor Weltmutation. | R4B-N2b: Restore ohne Motions `validate`/`worldRestored`; Fresh ohne Motions bleibt gueltig. R4B-N0 und N3 decken zero-dynamic bzw. geschlossene Bindung ab; F7/F8 bleiben gruen. |
| R4B-Y pruefte den Produkt-/Commitpfad, nicht direkt `seedIntactParentVoxels`; ein Helper-Revert konnte unentdeckt bleiben. | Test-only Regression liest die Seed-Collider direkt gegen unabhaengige kanonische Zentren, insbesondere `y = 5.5 * 0.125 = 0.6875`. | R4B-Y-seed; der kontrollierte Helper-Revert fiel mit `0.625` gegen `0.6875`. |
| R4B-N4 war nur ein manueller Throw nach Encode und pruefte keinen Write-/Torn-Pfad. | Testlokaler Storage-Seam (kein Produktionsadapter) zaehlt Write-Versuche, erhaelt das alte Artefakt bei Before-Write-Fehler und hinterlaesst bei Mid-Write-Fehler ein torn Artefakt. | R4B-N4: altes Artefakt bleibt identifizierbar, torn Artefakt wird durch `decodeStructuralRegionSave` fail-closed abgewiesen, gueltiges Artefakt laedt danach wieder. |

Fokussiert: R4-Datei `12/12` PASS, F7/F8/Slice4 `17/17` PASS,
`npx tsc --noEmit` sauber. Vollsuite: `145` Dateien / `1389` Tests PASS.
Keine UI-/Renderer-/Scene-Aenderung und kein Produktions-Storage-Adapter; daher
weiterhin keine Screenshot-Evidence.
