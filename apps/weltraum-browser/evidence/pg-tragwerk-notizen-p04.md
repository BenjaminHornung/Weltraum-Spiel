# P-PROD-P04 — Reviewnotizen in Tests und präzise Claims überführen

Reine Test-/Evidence-/Claim-Scheibe auf dem stabilen F7/F8/R4/R5b-Vertrag.
Kein Render-, Save-, Residency-, Stadt-, Wirtschafts- oder Orbit-Anteil.
Kein Transaktionsframework-Umbau, keine Spieler-UI, keine Worker-/Hardware-Themen.
Strikt struktureller Proving-Ground-Slice — keine Normal-Gameplay-Aussage.

Basis: `origin/main` @ `0fbf4aea1d62c219ca29af51d3b0afd705ecd06e`,
Branch `feature/review-notes-p04`, neuer Worktree (alte Worktrees unangetastet).
Produktdiff: `src/voxel/structural/physicsCommit.ts` (Label-Guard-Symmetrie +
Portvertrag-Kommentar + Mismatched-Binding-Wortlaut). Kein derive-/Vertragsum bau.

## 1. Typisierter Fehler NACH Mutationsbeginn (N03-Lücke)

Befund: T3 injiziert einen plain `Error`, T3b scheitert seit der P-PG-F8-Bindung
VOR Mutationsbeginn (validate-Phase, Titel sachlich überholt) — kein Test übte
den typisierten `fail()`-Pfad NACH Mutationsbeginn aus.

Fix/Umsetzung: `T3c` (F7-Datei) sabotiert `bodyColliderCount` NUR für den
Fragment-Body (verankerter Pfad bleibt ehrlich) und trifft die
Create-Phasenprüfung (`Fragment install incomplete`, `CommitFailed`/`create`,
`worldRestored:true`, verifizierter Rollback, Parent intakt). T3b-Titel und
Header-Kommentar sachlich korrigiert (VOR Mutationsbeginn, validate-Phase).

Test: T3c (PASS, neu) + T3/T3b (PASS, unverändert grün).

## 2. T2b-Linearvelocity-Orakel unter Rotation

Befund: T2b setzte echte 90°-Y-Rotation und nicht-trivialen Spin
ω=(0,1/0,2/0,3), prüfte aber nur installierte Rotation, Inertie-Reader und
Drehimpulsantwort — nie `linvel` gegen `v = v_p + ω × (W(c)−T)`.

Fix/Umsetzung: T2b um Orakelblock erweitert (unabhängige
Quaternion-/Kreuzprodukt-Arithmetik im Test): Receipt-Position +
Receipt-Linvel + installierte `linvel()` je 1e-6 am Orakel; Gegenbeweis, dass
die naive Identitätsrotation (unrotiertes `c−A`) um >1e-3 danebenliegt —
das Orakel ist unter R ≠ Identität nicht-trivial.

Test: T2b (PASS, erweitert).

## 3. Parent-Remove wirft: Verhalten vor/nach Wirkung + Caller-Recovery, ehrliche Cleanup-Flag

Befund: Codepfad (`parent/remove`, Phase `remove`, `worldRestored:false`,
Cleanup-Notiz in der Meldung) war implementiert, aber durch KEINEN Test mit
Parent-Remove-Fehler belegt; Caller-Recovery unbewiesen.

Fix/Umsetzung: `F8-E` (Counting-Port, `failRemoveIds:{1}` = Parent):
Phase `remove`, `worldRestored:false`, Meldung pinnt
`Parent removal failed` + `created bodies rolled back, parent untouched`,
Parent weiter gezählt (1/27), Erstellte abgeräumt. Präzisierung
(Robustness-Review): den Rollback führt der Commit selbst aus
(`removeCreated`); der Caller beobachtet nur `worldRestored:false` — also ein
recovery-fähiger Weltzustand, kein Caller-Code in diesem Slice. INCOMPLETE-Variante
(`failRemoveIds:{1,2}`): Meldung pinnt `INCOMPLETE (1 remove failure`,
residueller Body belegt die unvollständige Wiederherstellung — die
Cleanup-Nebenfehler (removeCreated wirft) sind ehrlich im Flag, keine sichere
Wiederaufnahme wird behauptet.

Test: F8-E (PASS, neu, zwei Varianten).

## 4. Reentrancy: enger Nachweis + expliziter Portvertrag

Umsetzung (eng begrenzt, keine Engine-Änderung): `F8-F` (Counting-Port) belegt,
dass ein Doppel-Commit mit demselben (bereits entfernten) Parent-Handle erneut
erfolgreich läuft und dupliziert (2→4 Bodies) — KEIN fail-closed Guard.
Portvertrag in `physicsCommit.ts` dokumentiert: Handles sind single-use und
müssen live sein; Doppel-Commit/stale-Handle-Wiederverwendung ist eine
Caller-Vertragsverletzung. Scopegrenze: keine Backend-Matrix (nur
Counting-Port), kein Verhalten über den Commitvertrag hinaus.

Test: F8-F (PASS, neu, Nachweis) + Vertragskommentar (Produkt, docs-only).

## 5. Label-Guard-Symmetrie

Befund: Guard war einseitig (Live-Pose + `explicit`-Plan → Reject, T4).
Autoren-Aufruf (keine Parentpose) + `live-parent-body`-Plan lief still an der
Autorpose mit live-Label im Receipt.

Fix/Umsetzung (minimal, spiegelt `regionSave.ts`, das live/explicit bereits
symmetrisch bindet): `!useLivePose && plan.parentMotionSource ===
"live-parent-body"` → `InvalidStructuralState`/`validate`/`worldRestored:true`
VOR Weltmutation. Failing-first belegt: T4b rot pre-Fix (kein Wurf), grün
post-Fix.

Test: T4b (PASS, neu); T4/R4-Restore-Pfade (PASS, unverändert — Restore mit
live-Plan trägt stets die Parentpose, explicit-Saves keine).

## 6. Wortlaut

- F8-C: `Punkt-/Kontaktprüfung` → `Punktsonde` (Titel + Kommentar); explizit
  KEIN Solver-Kontakt-Claim (reine installierte-Geometrie-Sonde, kein Step,
  keine Kontaktabfrage). Test: F8-C (PASS, Assert-Logik unverändert).
- T3b-Titel: `NACH Mutationsbeginn` → `VOR Mutationsbeginn (validate-Phase)`
  (sachlich überholt seit P-PG-F8-Bindung; Test assertet selbst
  `phase:validate`). Test: T3b (PASS, umbenannt + kommentiert).
- `stale`- vs. `mismatched`-Namen geprüft: R4c unterscheidet bereits sauber
  (`RejectedStalePlanningEpoch` = alte Epoch nach neuerem Edit vs.
  `RejectedRevisionMismatch` = passende Epoch, alte Input-Revision) — KEINE
  Umbenennung nötig, hier dokumentiert. Produkt-Wortlaut präzisiert:
  Objekt-Id-Fehlbindung meldet jetzt `Mismatched binding` (statt `Stale
  plan`); `Stale plan` bleibt für Revisions-/Hash-Drift reserviert. R5b
  `storedStaleRejected`-Schlüssel UNVERÄNDERT (P03-Evidence, keine
  Doppelarbeit; dort bedeutet "stale" wrong-content-Golden, dokumentiert).
- `observed`-Reste → Kalibrierungssprache: neue P04-Einträge sprechen von
  Kalibrierung (Orakel-/Band-Kalibrierung); bestehende F7-`observed`-Keys und
  R5b-`observedResult` UNVERÄNDERT (P03-Kontext, keine Doppelarbeit, keine
  Reader-Abhängigkeit in `src` gefunden — Summaries sind evidence-only).
- Blank-Snippet-Duplikat beseitigt: beide R5B-Stellen nutzen den einen Helfer
  `renderBlankPng(page)` (test-only, verhaltensgleich).

## 7. Evidence-Abdeckung je Notiz

| Notiz | Test oder begründete Scopegrenze |
|---|---|
| Typisierter Fehler nach Mutationsbeginn | T3c (neu, PASS) |
| T2b-Linvel unter Rotation | T2b-Orakelblock (erweitert, PASS) + naiver Gegenbeweis |
| Parent-Remove + Caller-Recovery + Cleanup-Flag | F8-E inkl. INCOMPLETE-Variante (neu, PASS) |
| Reentrancy | F8-F enger Nachweis (neu, PASS) + Portvertrag; Full-Matrix = Scopegrenze |
| Label-Guard-Symmetrie | Produkt-Guard + T4b (neu, PASS, failing-first) |
| Punkt-/Kontaktwortlaut | F8-C Punktsonde (umbenannt, PASS) |
| T3b-Titel | Korrigiert (VOR Mutationsbeginn) |
| stale-/mismatched-Namen | R4c geprüft-ok (doku), Produkt-Meldung präzisiert, R5b-Keys Scopegrenze (P03) |
| Blank-Duplikat | `renderBlankPng`-Helfer (test-only) |
| observed-Reste | Kalibrierungssprache in P04-Neueinträgen; alte Keys Scopegrenze (P03, keine Doppelarbeit) |

## Quelle und Kennzahlen

- Produkt: `src/voxel/structural/physicsCommit.ts` (Guard + Vertragskommentar + Meldungswortlaut).
- Tests: `tests/unit/structuralPgTragwerkF7.test.ts` (9 Tests: T1, T1b, T2, T2b-erweitert, T3, T3b-umbenannt, T3c-neu, T4, T4b-neu),
  `tests/unit/structuralPgTragwerkF8.test.ts` (6 Tests: F8-A..D unverändert, F8-E-neu, F8-F-neu),
  `tests/e2e/pg-tragwerk-destruction-render.spec.ts` (Blank-Helfer, verhaltensgleich).
- F7-Datei: 9/9 PASS. F8-Datei: 6/6 PASS. `tsc --noEmit` (folgt in Summary).
  Vollsuite + E2E-Spec: siehe Summary-JSON.
- Solver: F7 weiter @dimforge/rapier3d-compat 0.12.0 (transitiv, lockfile-pin,
  kein Manifest-Eingriff); F8 solverunabhängig (Counting-Port).
- Kein E2E-live/ui, keine Hardware-Claims. R5B-PNGs unangetastet (kein
  Re-Recording, kein `WELTRAUM_RECORD_EVIDENCE=1` nötig — Spec-Änderung ist
  verhaltensgleich).
