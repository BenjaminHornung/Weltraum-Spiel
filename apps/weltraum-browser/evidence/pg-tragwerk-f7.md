# P-PG-F7 — Physik-/Besitzgrenze stabilisieren (Drehimpuls, Parentpose, Commitfunktion)

Kein Render-, Save-, Residency-, Stadt-, Wirtschafts- oder Orbit-Anteil.
Reine Übergangs-/Besitzpfad-Scheibe auf dem stabilen R3-Vertrag
(deriveStructuralPhysicsTransition, exakte Partitionsbindung) plus neuem
wiederverwendbarem Commitpfad. Keine Produktlogik ausser
`src/voxel/structural/physicsCommit.ts` (+ Export), daher
JSON-/Markdown-Evidence ohne Screenshots (AGENTS.md Evidence-Regeln).

Basis: Branch `feature/pg-tragwerk-slice1` @ `b534a529ac93a010da38223db9f83dca702fe846`,
derselbe Branch/Worktree, NUR lokal, kein Push. Fixture PG-TRAGWERK-01 und
heterogener Schnitt (Stützenzelle (15,4,0) raus, Trägerzeile x=14..18/y=5 als
EIN Fragment aus 2x Stahl 7800 + 3x Träger 2700, 46,2890625 kg) unverändert
wiederverwendet. R4/R5-Verträge nur verwendet, nicht umgebaut.

## 1. Drehimpulsantwort (Audit Abschnitt 2)

Audit-Befund: heterogene Fixture (Ixx kanonisch 0,12054443359375), installiert
gelesen 2,7220325469970703, Impuls J = 0,12054443359375 -> erwartet Δω = 1,
beobachtet 0,04428. Steiner-Rückrechnung (R3) ersetzt keinen Bewegungsnachweis.

Ursachenklärung (eigene isolierte Proben, Schwerelosigkeit, keine Dämpfung,
kein Kontakt, kein Sleep, genau ein Step, Winkelimpuls via
applyImpulseAtPoint um den COM):

- Dichtepfad (ein Cuboid pro Zelle mit Materialdichte, R3-Installationspfad):
  Reader (2,7220325 / 1,4212886 / 1,4212886), Dynamik Ixx_eff = 2,7220324
  (J/ωx), Iyy/Izz exakt (ωy = -1, ωz = +1 auf den Impuls). Beobachtet
  ωx = 0,04428471624851227 = exakt die Audit-Zahl 0,04428. Effektive
  x-Trägheit = Iy+Iz-Ix; nur die Streuachse ist betroffen, kurze Achsen sind
  exakt. Reader UND Dynamik stimmen überein — kein reiner Reader-Artefakt,
  die Compound-Aggregation des Dichtepfads installiert auf der Streuachse
  eine um 2·Σm·dx² überhöhte Trägheit.
- Failing-first: `T1` schlug vor dem Fix mit `0,04428 statt 1` fehl und bleibt
  als Defektbeleg erhalten (effektive Ixx ≈ 2,7220325, relativ 1e-6).

Passender Pfad (belegt): explizite kanonische Masseneigenschaften pro Body —
erster Collider trägt (Masse, COM, Haupträgheiten) deklariert am Body-COM
(Offset null -> Aggregationspfad trivial, immun gegen den Dichte-Shift),
Rest-Colliders masselos (`setMass(0)`), Kontaktgeometrie weiter Voxel-Cuboids
(exakt). `T1b` prüft Masse/COM/Tensor/Drehimpuls GEMEINSAM: Solver-Masse
relativ 1e-6, localCom ~ 0, Reader == kanonisch (alle 3, 1e-6),
J = Ixx -> Δωx = 1 (1e-3), Querachsen ~ 0, linear Δvz = Jz/m.
`T2b` weist zusätzlich nach, dass der Tensor mit dem Body rotiert (90° um Y:
Body-x liegt auf Welt -z, J um Welt-z -> Δωz = 1 auf 0,12054443359375;
Initialspin bleibt erhalten, Superposition exakt).

## 2. Parentpose + Vor-Schnitt-COM (Audit Abschnitt 3)

Bisherige Installationspose war die Autorpose (R3-Residuum). Commit übernimmt
jetzt Translation T und Rotation R des bewegten Parents plus tatsächlichen
Vor-Schnitt-COM A (aus dem Vor-Schnitt-Objekt, unabhängig vom
Nach-Schnitt-COM des Plans — Test weist A != C_post nach):

- W(p) = T + R·(p - A), Kind-COM W(c), Kind-Rotation = R.
- v_kind im Weltraum nach Parenttransformation: v = v_p + ω × (W(c) - T).
  (Bezugspunkt ist der Parent-Body-Ursprung = abgebildeter Vor-Schnitt-COM,
  nicht der Nach-Schnitt-COM der Plan-Splitregel.)
- Collider-Offsets sind body-lokal im Autorframe (Boxmitte - COM); die Engine
  rotiert sie mit dem Body. Welt-Offsets wären unter R != Identität falsch
  (eigener Zwischenbefund beim Fix: Fragment fiel frei).
- Herkunftslabel: Live-Pose verlangt `parentMotionSource "live-parent-body"`
  und Vor-Schnitt-COM, sonst Reject; Receipt meldet
  `childPoseSource "author" | "live-parent-pose"`.
- `T2` (Parent läuft 20 Steps, Pose/Motion live gelesen, unabhängiges Orakel:
  eigene Quaternion-/Kreuzprodukt-Arithmetik im Test): Translation/Rotation/
  Linvel/Angvel je 1e-6/1e-9 am Orakel, Receipt Bodies 1 -> 2, Collider
  27 -> 26, Fragment 5 echte Collider, verankert 21, verankerter Spot-Check
  (Stütze (15,3,0) auf W(Zellmitte)), Solver-Masse 1e-6, Fragment fällt eine
  Zelle auf den Stumpf und schläft, Inventar stabil.
- Zwischenbefund dokumentiert: horizontal driftender Parent (0,2 m/s) rutscht
  seitlich vom 1-Zellen-Stumpf (Kontaktpaare 2 -> 1 -> 0, freier Fall) — kein
  Commit-Fehler, sondern Szenario-Physik (Verwechslungsgefahr beseitigt,
  Parent läuft jetzt rein vertikal + Gier).

## 3. Commitfunktion (Audit Abschnitt 3)

Neu, wiederverwendbar, solver-neutral (`src/voxel/structural/physicsCommit.ts`,
Welt als Port-Interface ohne Step-Methode — Commit kann strukturell nicht
steppen; kein Rapier-Import im Produktcode, Adapter testseitig):

- Validierung VOR Weltberührung: Installed-Status (kein Debris-Fallback),
  Revisions-/Hash-Bindung Plan vs. live, Plan-Integrität (contentHash
  nachgerechnet), Label-Konsistenz, Einheitsquaternion, diagonale Tensoren
  (Nebendiagonalen > 1e-9 fail-closed — Grenze des Explizit-Pfads).
- Create-first-Reihenfolge: verankert-statisch + Fragment-dynamisch erstellen
  und per ECHTEN Zählern verifizieren, DANN Parent entfernen, kein Step
  dazwischen (weder Doppelbelegung noch Lücke beobachtbar).
- Fehler NACH Mutationsbeginn: erstellte Bodies werden abgeräumt, CommitFailed
  mit Phase (`create`/`remove`) und `worldRestored`-Flag. Da der Parent erst
  zuletzt entfernt wird, steht die Welt bei Create-Fehlern exakt wie vorher.
- `T3` (injizierter Fehler beim 3. Collider-Add, d.h. nach 1 Body + 1 Collider):
  `CommitFailed`/`create`/`worldRestored:true`, Bodies/Collider 1/27 wie
  vorher, Parent lesbar. R3 deckte nur Ablehnung VOR Weltberührung ab.
- `T4` (Autorpose ohne Parentpose): Bodies 1 -> 2, Collider 27 -> 26,
  Label `author`/`explicit`; Live-Pose mit `explicit`-Plan wird rejected
  (Herkunftslabel stimmt).

## 4. Colliderzählung (Audit Abschnitt 3)

Receipt meldet echte, am Body gelesene Zähler (`bodyColliderCount`), keine
Listenlängen: Fragment 5 Voxel-Cuboids (nicht Greedy-Länge 1 — ersetzt die
R3-Zeile 528-Klasse), verankert 21. `T4`-Vergleich installiert beide Varianten
und zählt echt: Voxel 5, Greedy 1, gleiche Masse (1e-6). R3-Testdatei bleibt
eingefroren; dieser Nachweis supersediert sie.

## Quelle und Kennzahlen

- Neu: `src/voxel/structural/physicsCommit.ts` (+ Export in `index.ts`),
  `tests/unit/rapierStructuralCommitPort.ts` (testseitiger Rapier-Adapter),
  `tests/unit/structuralPgTragwerkF7.test.ts` (6 Tests: T1, T1b, T2, T2b, T3, T4).
- Kein Src-Diff ausser Commitfunktion; derive/Verträge unverändert (R4/R5 nur verwendet).
- Basis-SHA: `b534a529ac93a010da38223db9f83dca702fe846`
- F7-Datei: 6/6 PASS. Vollsuite: 144 Dateien / 1376 Tests PASS. `tsc --noEmit` sauber.
- Live-Zyklen: 20 Pre-Steps, Swap bei 0 Interim-Steps (Commit steppt strukturell nie),
  Bodies 1 -> 2, Collider 27 -> 26 (kein Ground-Body in F7-Welten).
- Solver: @dimforge/rapier3d-compat 0.12.0 (transitiv, lockfile-pin,
  kein Manifest-Eingriff; fail-closed bei Wegfall).
- Kein Push (Paketvorgabe).

## Befund -> Fix -> Test-Mapping

| Auditbefund (Abschnitte 2/3) | Fix/Umsetzung | Test |
|---|---|---|
| Drehimpuls 0,04428 statt 1 (Ixx 2,722 statt 0,1205) | Ursache im Installationspfad belegt (Dichte-Aggregation); explizite kanonische Masse am Body-COM | T1 (Defektbeleg, pre-fix FAIL) + T1b (Δω=1, Masse/COM/Tensor gemeinsam) |
| Tensor nur per Steiner-Rückrechnung | Bewegungsnachweis: Impuls -> Δω, auch unter 90°-Rotation | T1b + T2b |
| Parentpose/COM nicht übernommen | W(p)=T+R·(p-A), v_kind im Weltraum, Label-Guard | T2 (unabh. Orakel, A != C_post) + T4 (Label-Reject) |
| Keine Commitfunktion mit Fehlerbehandlung nach Mutationsbeginn | `commitStructuralPhysicsTransition` (create-first, Rollback, Phasen-Fehler) | T3 (injizierter Post-Mutations-Fehler, Welt restauriert) |
| Zähler meldet Greedy-Listenlänge | Echte Body-Zähler im Receipt | T4 (5 vs 1, gleiche Masse) |
| Zähler/Step-Differenz genügt nicht | Port ohne Step-Methode + Inventar-Assertions (Bodies/Collider vorher/nachher + pro Body) | T2/T4 (1 -> 2, 27 -> 26, 21/5) |
