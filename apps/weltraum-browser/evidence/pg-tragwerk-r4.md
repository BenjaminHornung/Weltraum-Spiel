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
  (+19 Assertions im Fallback-Test).
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
