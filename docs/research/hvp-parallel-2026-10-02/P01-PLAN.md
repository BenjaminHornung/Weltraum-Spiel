# P01 — R03/R02 Vertragsfix: Source-Plan und Verify-Gate

## Aktuell: S15/S16 vom Parent angenommen; source-only R02/R03-Interimkandidat

S16 führte nur die fehlenden sechs retained Regressiondateien aus: **33/33 Cases PASS/Exit0**,
keine Skips; OriginalJSON zählt10/10 Suites, sechs tatsächliche Dateien. Voller180s-Cap,
ein direkter managed Node22→Vitest4.1.11-Aufruf, kein Fix/Retry/Setup. Actual firstUTC
`20:46:38.9399064Z`, cutoff `20:51:38.9399064Z`, release `20:51:00.7388099Z` (261.799s),
SHORT zuerst, native scoped PID48656/Kinder0 und managed running0/terminal completed.
HEAD2548/tree9738/index/protected/four blobs/Input17/installed plain metadata vor/nach unverändert.
Raw unter `Coord/P01-evidence-regression6-a68-20261002-01/`, Details im RESULT Abschnitt S16.
Der Parent hat das S16-ORIGINALJSON selbst geparst:6 Dateien,33/33 Cases,0 Skips,OriginalExit0;
native Task/PID48656 und direkte Kinder beendet. S15 Type0+19 Cases und S16 33 Cases sind als
gezieltes **R02/R03-Vertragssubset** angenommen, nicht als P01-Gesamtperformance oder B1-Abnahme.
Freigegeben ist genau **ein lokaler scoped Kandidatencommit** aus2548 auf der eigenen Branch,
mit den exakt5 Pfaden der S16-Lieferkarte. Produkta68/Own8e344/Referenz160/occupiedfb3 bleiben frozen.
Die externe `Coord/P01-R02-R03-CANDIDATE-20261002.md` bindet nach dem Commit SHA/Tree/Parent/5 Blobs.
P01-Gesamtpaket nicht fertig: largest-restkernel/Work-Reduction/Timing, volleGetter-/Host-/Native-/
B1-Gates offen. A0 bleibt alleiniger Integrator; kein Push/PR/mainMerge oder weitere CPUfreigabe.

### Historisch S15: Type PASS, Own17 PASS, Original2 PASS, Regression6 NOT_RUN

FirstActionUTC `2026-10-02T19:52:51.0586737Z` vor Preflight; exec+660/cleanup+720.
Direkte native managed TSC90 → Own17-180 → Original2-90, alle OriginalExit0, keine Fixes/Retry.
Volle Regression6-180-Cap passte nach Original2 nicht mehr; NOT_RUN/null, nicht verkürzt gestartet.
Release `20:03:33.0696469Z`, elapsed642.011s, SHORT zuerst; managed running0/native scoped CIM0.
Source25/Entry10 vor jedem gestarteten Programm und danach identisch; Plainness12/Lockmetadata
mit nativen UTF8-Hashtable-Readern gebunden. Legales `packages['']` ist kein Datenfehler.
Historische S11B3757-Identität akzeptiert, Volltransitive **NOT_FRESHLY_REVALIDATED**.
Own8e344, Sourcea68, occupiedfb3 und Referenz160 frozen. Own466-Archiv und S06/S11/S11B/S11C-
Rohfehler unverändert; S11Cs frühere READY-/Harnesslücke bleibt im historischen RESULT dokumentiert.
Originale unter `Coord/P01-evidence-native-a68-contract-20261002-01/`, Details/19 Casepopulationen
im `P01-RESULT.md`, Abschnitt S15. Fehlendes Runtime-Error-Suite-Feld **NOT_PROVEN**, nicht0.
Post-release Transkriptvergleich FAIL/1 durch null im Metadatenreader; kein Retry, Gleichheit
NOT_PROVEN. Native ursprüngliche Programmexits/Reporteroriginale bleiben davon getrennt.
Kein umfassendes CODE_VERIFIED/PERF_ACCEPTED; damalige Regressionlücke später in S16 geschlossen,
Integration/fullGetter/nativeOwner weiter offen.
Meta hat `P01-TWO-FILE-HANDOFF-2548.md` nach tatsächlichem RELEASED_ACK aktiviert:
P01 besitzt exklusiv `classificationSteps.ts` und `occupiedEntries.ts`. A0/alter Writer
editieren diese Pfade nicht. S16 gewährte genau einen Regression6-Call ohneDependencyCopy; nachRelease
kein CPU-/Setupgrant. Kein weiteresSetup/Run ohne neue expliziteSlotkarte und frischesEvidenceziel.

Autorisiert ausgeführt: normaler `merge --ff-only 2548ce04fb15b164d0c7c802a2dbc7f0afd88b33`
auf der bestehenden Paketbranch im eigenen Worktree. Davor exakter b3-HEAD, tracked/index clean;
vollständiges `ls-files --others` zeigte genau die vier eigenen Drafts und zwei foreign `.opencode/`
Dateien. Keine Überschneidung oder Pfadvorfahrenkollision mit den 20 A0-Änderungen.
Danach HEAD `2548ce04fb15b164d0c7c802a2dbc7f0afd88b33`, Tree
`9738e7b922b432209b176b57020cac687038e2fb`, Parent b3 und beide Übergabeblobs bestätigt.
Kein anderer Branch, Mergecommit, Reset, Rebase, Checkout-Replacement oder WIP-Copy.

Minimaler Produktpatch: nur `classificationSteps.ts`; `occupiedEntries.ts` bleibt unverändert.
Unverändertes b3/f2-Orakel; eigene zwölf Drafts behalten ihre Daten/Assertions, T07 bekommt
unabhängige physikalische Scalar-Erwartungen statt bloßer neuer Helper-Übereinstimmung.
Fünf zusätzliche eigene Vertragsfälle decken R03-Receiver/Species/Throw, custom Species,
R02 genuine Facts/Budgets, Cancellation/Issuer-Rejection und legitime issued Fact-Array-Proxys ab.
Insgesamt17 Fälle, in S15 alle PASS. CAF wurde nach dem engen Observer-Review source-only revidiert.
Genauer Source-Fingerprint und Eigenreview im `P01-RESULT.md`;2548 bleibt Authoring-/Verifybasis.

## Autorität, Bindung und Abschlussgrenze

Zwei exklusive Produktpfade plus eigene vier allowlisted Artefakte. `massProperties.ts`,
`structuralPlan.ts`, `hvpOwnedClassificationSteps.test.ts` und
`hvp-classification-contract-controls.test.ts` bleiben RETAINED/frozen; keine dortige Änderung.
`rigidRecipe`, Issuer, Hashhelfer, Barrels/API/Bootstrap liegen außerhalb P01.
A0s vorgeschlagene `bodyCutSession.ts`/`session.ts` ChildProjection-API ist disjunkt:
ACK_NO_BOUNDARY_CONFLICT erteilt; bestehender fertiger Plan/Caller bleibt erhalten.
Keine Konkurrenzimplementation, keine stillschweigende Integration oder neue Session.

- Worktree: `C:/IFI_SourceCode/Temp/WeltraumSpiel/.worktrees/Hestia-Parallel-P01-2026-10-02`.
- Branch: `agent/hvp-parallel-p01-classification-2026-10-02`.
- Authoring-/Verifybasis: `2548ce04fb15b164d0c7c802a2dbc7f0afd88b33`; Kandidatenidentität in der externen Karte.
- Historische b3-Basis: `b3c6523a94cd050f5a9a22dc27f4777fcc03363e`.
- Historischer Orakelstand: b3-Drain-Vertrag, mit synchronem f2ee-Kern
  (`f2ee73cfbfa80b6c09d540c784d3ad426ae83a04`) und explizit eingefrorenem b3-Ordertuple-Delta.
- Read-only `ls-remote`: V3-Branch b3; main `25bc7f5bbd2db6317c42193873eadeaf10a092c5`.
  Das beschreibt veröffentlichte Refs, nicht A0s neueren Arbeitsstand.
- Verbindlich vollständig gelesen: `LAUNCH-CONTRACT.md`, aktualisiertes `A0-HANDOFF.md`,
  `01_AGENT_P01_KLASSIFIKATION.md`, `README_PARALLELPLAN.md`, `OWNERSHIP.json`,
  `QUELLE_CHECKPOINT_2026-10-02.md`, `07_PRUEFUMFANG_UND_QUELLEN.md`.
  Repository: `AGENTS.md`, `README.md`, `docs/current-mainline-state.md`, `.agent/PLANS.md`,
  `docs/roadmap/living-master-plan.md`, HVP-ExecPlan, Voxel-Supersession-Index,
  V3-Checkpoint und R00-Source-/Lease-Gate. Historischer Main-Status ist kein aktueller V3-Test.

**Erreicht:** beide Vertragsfixes im Shared-Kernel, Source-Eigenreview, frischer Typecheck und
17 eigene/2 Originalchecks PASS, vom Parent angenommen; S16 Regression6 frisch33/33 PASS.
Der Parent hat auch S16 angenommen und genau den lokalen Fünf-Pfad-Interimcommit freigegeben.
Kein neues Dependency-Setup/Type-/Test-/Build/Profile/Benchmark/Server/Browser/Push/Integration oder
neue Agenten; P05-S17A bleibt ungestört. Kein unabhängiger Review behauptet; keine fremden Gates geschlossen.

## Kleiner Fix, keine weitere Optimierung

1. **R03:** derselbe BFS/Hash-Fachkern; generisch direkte `StructuralComponent[]` statt
   privater Wrapper. Historisches finales Sort → deepFreeze → zwei Filter auf diesem gefrorenen
   Array → Fragment-map auf gefrorenem Detached-Array → Fragment-sort/deepFreeze → Resultatfreeze.
   Native map/filter/Species-Seams bleiben bestehen; keine Umgehung legitimer Getter/Throws.
   Private `{component,cellKeys}` und issued Zellkey-Reuse bleiben ausschließlich im issued Pfad.
2. **R02:** Indexierung yieldet nach64 tatsächlich konsumierten Anchor-/Endpoint-Facts, ohne
   neue vorgezogene Reads auf Fact-Array-length. Der vorhandene Indexzähler liefert privaten
   `factCount`; bei≥64 aktiviert er das bestehende weitere Finalizer-Batching, alternativ >256Cells.
   Auch inaktive Facts zählen, nicht der angefragte Maximalbudgetwert. Sammlung, stabiler vorhandener
   Sort, Projektion und vorhandener Hashcursor/finally verwenden weiterhin denselben Flag. Kleine0-Fact-Source
   behält ihre0 inneren Finalization-Yields. Keine neue Sort-/BFS-/Hasharchitektur.
3. **Review/Verify:** Signaturen, zwei bestehende Labels, Budgets/Errors/Identity-/Präzedenz,
   Quantum.125 und kanonische Ordnung bleiben unverändert. OriginalS06 plus unabhängige eigene
   Checks frisch ausführen erst mit neuem Slot. Größter Restkern muss vor weiterer Optimierung
   separat gemessen werden; Yields sind kein Timing-/Liveness-/Memory-/Worldbeweis.

## b3-Callerkarte (Pfade relativ zu `apps/weltraum-browser/src/`)

| Callsite | Wirkung |
|---|---|
| `voxel/structural/connectivity.ts:15-25` | Öffentliche synchrone API drainiert `structuralComponentClassificationSteps` mit `.next()` bis done; kein Task-Wait. |
| `voxel/structural/connectivity.ts:28-36` | `deriveStructuralComponents` und `deriveStructuralFragments` delegieren an denselben Drain. |
| `voxel/structural/massProperties.ts:333` | `deriveStructuralSingleComponentMassesSteps` delegiert per `yield*`, nach Objektmasse/Callback; anschließend Komponentenmasse. |
| `hestia-prototype/physics/structuralPlan.ts:154` | `finishPlanSteps` klassifiziert post-cut per `yield*`, dann `classification`, Elternmasse, Child-Vorbereitung. |
| `hestia-prototype/physics/rigidRecipe.ts:86` | Nicht-issued Source: generische Klassifikation über `relabeled`; issued Sources über Single-Component-Preparation (`:79-82`). |
| `voxel/structural/physicsTransition.ts:675` | Issued-Preparation delegiert an Single-Component-Massensteps und damit an die Klassifikation. |
| `voxel/structural/commands.ts:379` | `applyStructuralDestructionCommand` klassifiziert das preliminary synchron, **vor** Massederivation (`:384`) und Veröffentlichung. |
| `voxel/structural/massProperties.ts:373` | Generische Komponentenmasse klassifiziert zur kanonischen Claim-Prüfung erneut; Transition nutzt sie pro Body (`physicsTransition.ts:380`). |
| `voxel/structural/regionSave.ts:212` | `expectedFragmentIds` klassifiziert beim Motion-Coverage-Vertrag; Fehler werden in InvalidContract `regionSave/object` übersetzt. |
| `hestia-prototype/persistence/bodyCheckpoint.ts:14` | Save-Vorbereitung klassifiziert Recipe-Source für Fragmentidentitäten. |
| `provingGround/pgTragwerkPlayerSlice.ts:486` | Tragwerk-Player-Slice liest die frische Classification nach Mutation. |

Suche über den gesamten Produkt-`src` ergab keine weiteren direkten Generator-Caller.
`occupiedEntries` ist owner-intern, nicht über den Structural-Barrel freigegeben.

**Wichtiger synchroner Rest trotz innerer Yields:** Box-Plan → `subtractBox` →
`applyStructuralDestructionCommand` → öffentlicher Klassifikations-Drain. Erst nach
Rückkehr yieldet der äußere Plan `destruction`. Mehr Generator-Yields allein verkleinern
diesen Owner-Step nicht. Danach erfolgt die zweite post-cut Classification. Im b3-Compiler
führt `workers/hvpBodyCutJob.ts:117-119` nach Ingest ebenfalls den vollständigen lokalen Cut aus;
dies ist noch nicht die neue owner-first mesh-only Integration. Diese Aussagen gelten nur für b3.

## Generator, Yields, Labels und Lebenszyklus

- `structuralComponentClassificationSteps(object, budgetValue)` bleibt ein Generator mit
  String-Yields und `StructuralComponentClassification` als done-Wert. Validierung beginnt beim
  ersten `.next()`, nicht beim Erzeugen. Resume-Werte werden nicht ausgewertet.
- Budget-Reads: `maxVisitedCells`, `maxComponents`, `maxIndexedFacts` in dieser Reihenfolge.
- Extraction: native `for...of` über Bricks und Cells; ein interner Yield nach Brick-Fetch
  **vor** `brick.cells`, einer nach jeder aufgenommenen Zelle. N Zellen/B Bricks benötigen
  N+B+1 Cursor-Units einschließlich Abschluss. Wrapper drainiert jeweils 64 Units;
  `classificationCells` kommt bei nicht fertigem Batch; Sort und Freeze sind danach synchron.
- b3 hat **keinen** Klassifikations-Yield nach der Extraktion: Facts, Index, BFS, Memberordnung,
  Projektion, Hashes und Fragmentfinalisierung liegen im abschließenden `.next()`.
  Leere Extraktion überspringt Facts-/Source-Digest-Arbeit nicht.
- `structuralPlan` liefert danach `classification`; `parentMass`, `childCells`,
  `childRecipe{i}` und der finale Session-Step `removedMass` gehören fremden Ownern.
- `rigidRecipe.ts:46-67`: `transitionHash` → `childHash`, `transitionPayload` →
  `childTransitionPayload`, alle anderen inneren Labels → `childClassificationCells`.
  Neue Restkern-Labels wären daher auf diesem Pfad nicht separat sichtbar. Kein stiller Labelwechsel;
  endliche Labels, Trace-Aggregation und bestehende harte Label-Assertions zuerst mit A0 abstimmen.
- `bodyCutSession` misst Dauer jedes `.next()` und attribuiert das tatsächlich zurückgegebene Label.
  `completePlan` drainiert synchron. `preparePlan` wartet auf echte `host.yieldTask()`-Tasks,
  prüft danach pending/held und `assertCurrent`. Ein Microtask ist kein gleichwertiger Timer-Yield.
- Cursor: maxVisitedCells eager; maxUnits erst nach failed/non-open-Gates. Ungültige Units
  vergiften einen offenen Cursor nicht. Done wird einmal ausgegeben. Fehler sind sticky:
  dieselbe Ursache auch nach Dispose und vor weiterer Budgetvalidierung.
- Generator-return/throw schließt durch `yield*`/`finally` den Cursor und native Iteratoren;
  Dispose ist idempotent und verschluckt Cleanup-Throws. Ein nackter geschlossener Generator
  gibt danach done/undefined zurück — nicht fälschlich den sticky Session-Vertrag darauf anwenden.
- Session-Yield-Rejection speichert das erste Fehlerobjekt, schließt scratch, verhindert Revival
  bei Stage/Retry; Source-Preparation berührt noch keine native World. World/Hold bleiben A0.

## Werte-, Reihenfolge- und Fehlervertrag

- Sechs Nachbarn in Reihenfolge -x,+x,-y,+y,-z,+z; keine diagonale oder Joint-Konnektivität.
  Überschreitungen sicherer Integer werden bei Nachbarbildung übersprungen.
- Ordnung: serialisierter Brick-Key lexikalisch nach UTF-16, dann lokaler Zellindex.
  Negative/digitreiche Origins sind **nicht** numerische Globalordnung. b3 cached Orderkeys;
  das Orakel friert diesen b3-Tuplepfad eigenständig ein. Ein unverändert kopierter f2ee-Comparator
  wäre für Species-Readzahlen keine b3-Baseline (mehr Key-Serialisierungen beim Sortieren).
- Komponenten final nach componentId; Anchored/Detached behalten diese Ordnung.
  Fragmente separat nach fragmentId — nicht indexweise mit Komponenten gleichsetzen.
  `structuralPlan` vergibt Child-IDs `beforeId:r{revision+1}:p{i}` aus der Komponentenordnung.
  Downstream-Mass summiert in bestehender Order; keine Toleranz als Ersatz für identische Werte.
- ID-Bindung enthält Object-ID/Revision, Source-Content-Hash, Adaptive-Authority-Digest,
  kleinsten Zellkey und Komponenten-Content-Hash. Alle Fragment-/Anchor-/Jointfelder mitprüfen.
- maxVisitedCells rejectet vor Zugriff auf localIndex/state der überzähligen Zelle.
  InvalidCoordinate und User-Getter-Throw dürfen diese Präzedenz nicht umkehren.
- Facts-Budget = alle Anchors + beide Endpoints aller Joints, einschließlich inaktiver Air-Facts.
  Anchor consume erfolgt vor dessen Properties. Joint-Expression liest beide Endpoint-Objekte
  vor dem ersten consume; diese Getter-Präzedenz nicht durch inkrementelle Indexierung verändern.
- Facts/Digest kommen vor Komponenten-Gate. Komponente 33 bei Budget 32 rejectet vor ihrem BFS,
  nachdem 32 Komponenten schon finalisiert wurden; kein partieller erfolgreicher Output.
- Connectivity-Fehler: `StructuralConnectivityError`, `BudgetExceeded`, ursprünglicher path/message.
  Boundary-Validierungsfehler bleiben `StructuralValidationError`; beliebige Getter-Throws
  behalten das Originalobjekt. Generische Sparse-/Proxy-/Species-Verträge nicht verengen.
- Borrowed state wird vom bestehenden deepFreeze eingefroren; das ist kein neuer Snapshot der
  vollständigen Source. Neue Yield-Punkte würden neue Fremdmutationsfenster schaffen.

## Potenziell teure Restkerne — statisch, **nicht gemessen**

| Kern / Symbol | Input und Allokations-/Liveness-Risiko |
|---|---|
| `sortedStructuralOccupiedEntrySteps` | N≤32768: ganzer Sort, Array-/Entry-/Adressdaten; kein Yield in Sort/Freeze. |
| `indexFacts` / `factsForMembers` | F=A+2J≤262144: Maps, Listen, Serialisierung, pro-Zelle und pro-Komponente Facts-Sorts/Freeze. Hohe Facts können kleine Cell-Sources dominieren. |
| `byGlobal` / Seed-BFS | N Paararrays aus `.map`, Map/Set, Queue+Members, bis 6N Lookup-Keystrings; `globalQuantumForStructuralCell` validiert/friert Adressen erneut. Kein Beweis, dass BFS dominiert. |
| Membersort / occupiedCells / projectedCells | Summe M=N, pro Component Sort und mehrere Arrays; Zellkey-Serialisierung validiert erneut. |
| Component-/Fragment-Hashes | Payload proportional M + aktiven Facts, Fragmentkeyliste M; `hashAdaptiveCanonical` kanonisiert, serialisiert, TextEncoder, FNV synchron. Großer fremder Hash kann trotz besserem BFS dominieren. |
| `deepFreeze` und Finale | Descriptor-Traversal mit neuem WeakSet pro Aufruf; kein early-return allein für bereits gefrorene Objekte. Wiederholte Traversals sind statisch sichtbar, tatsächliche Kosten offen. |
| Fremde Restkerne | Destruction inklusive sync Classification+Mass; ganzer Child-Ingest; Komponentenmass-/Transition-/Recipearbeit; Removed-Filter/Ingest/Mass. Nur melden, nicht implementieren. |

Strukturanzahlen sind **keine** gemessenen Peak-Bytes. GC, WASM/GPU und Aggregate-Retention sind
nicht null und nicht aus JS-Heapdeltas abzuleiten. Keine neue BFS/UnionFind/WASM/GPU-Lösung,
kein Cache, keine zusätzliche Abstraktion, kein Qualitäts-/Cap-/Timeoutwechsel vor Befund.

## Historisches Orakel und eigene Testentwürfe

`tests/reference/hvp-parallel-p01-classification-reference.ts` friert den **b3-Drain-Vertrag**
unabhängig ein: synchroner f2ee-Classifier, Blob `339fe39223fe998e51e0a8fda69860f174b822a3`,
mit genau dem b3-Extraction-/Ordertuple-Delta aus Blob `ef7895b197160b68af98a6ef4b4cfcd8320cdf9f`.
b3 Classification-Blob: `dfb9cbf5258b79c40e41307e134cc2cdc0980488`.
Adaptionen: Imports/Exportnamen, Braces, native synchrone Loops statt Cursor-Suspension,
lokale historische Hash-Payloads und unveränderter f2ee-FNV-Kern. Kein Import neuer
Production-Classification-, Extraction-, Comparator- oder Hash-Cursor-Helfer.
Diese genaue Basis vermeidet künstliche Species-Fehler durch einen älteren f2ee-Sortpfad;
sie ist ausdrücklich keine Beobachtung/Abbildung des unveröffentlichten neuen A0-WIP.

Gemeinsame **unveränderte Boundary-Primitive**, durch read-only f2ee→b3 Diff geprüft:
Structural canonical `452536ccebe0a1be2a6c01b00ab5b97282908356`, coordinates
`09f006c519ef195431f60f5e19e9f9642bcd550f`, validation
`0242406b5acba871b8c592f96bc7ff53b384eb19`, types
`1d6e2fbfd38a88bf41ced06c76a8ce75dd550a27`; Adaptive canonical
`daa39024f8474a64d2a0658bb9678aefb57cdbeb`, validation
`54f39f44b0256fc37c7b97a66fd06dbaa2bd74d6`.
`structuralAddressForBrickCell` blieb unverändert; `model.ts` änderte nur issued-Provenance.
FNV wurde in b3 inkrementell ausgegliedert, deshalb nutzt das Orakel den alten eigenen Kern.
Das Orakel ist classifier-/hash-kernunabhängig, **kein** unabhängig neu implementierter Validator
oder Ingest. Soll A0 andere gemeinsame Primitive ändern, diese Abhängigkeit neu pinnen, nicht
heimlich aktualisieren. Fehlertests vergleichen name/code/path/message; Orakelklasse ist absichtlich
testlokal, die Produktklasse darf dadurch nicht ersetzt werden.

`tests/unit/hvp-parallel-p01-classification.test.ts`: ursprünglich12 statisch geschriebene,
damals **nicht ausgeführte** b3-Entwürfe; jetzt17 Fälle, erstmals in S15 PASS. T01/T02: vollständige Deep-/Hashparität, x/y/z-negative Brick-Seams, Diagonalen,
lexikalisch adversarielle Origins, Reverse-Reihenfolge, aktive/inaktive Anchors/Joints.
T03: Empty/Singleton inkl. Empty-Source-Digest-Fehler, 32768 signierte Dense-Zellen/acht Bricks,
32767-Budget, Komponenten32/33. T04/T05: Facts3/2 mit Air-Endpunkten, konkurrierendes Component-Gate,
lazy Budgetgetter/Fehlerpräzedenz, localIndex-Throw gegen Budget, sticky Cursor bei Units1/7/64/257,
Proxy-Readtrace, Sparse-Failure und Array-Species-Reads mit `finally`-Restore.
T06: return/throw an jedem beobachteten b3-Yield, Iterator-close einmal, kein späterer done-Erfolg.
T07: unveränderter historischer Elbow-Hash; fünf deklarierte.125m-Zellen mit Dichten512/1500
liefern unabhängig berechnete Masse/COM/Bounds/Tensor. Aktuelle Mass-/Recipehelpers sind
Actuals, keine unabhängigen Expected-Classifier. Axes/Collider-Routenübereinstimmung ist nur
ergänzend, ausdrücklich kein historisches Vollrecipe-Orakel. Kein nativer World-Import.

Neue R03-Fälle vergleichen alle beobachteten Array-Constructor-/Species-Seams, Receiver-Freeze/
First-Own-Keys und jeden ordinalen Throw-Präfix mit dem unveränderten Orakel; globaler Descriptor-
Restore vor Assertions. Custom Species muss weiterhin Arrays erzeugen, einschließlich gleicher
Freeze-Ergebnisse. Neue R02-Fälle rekonstruieren echte issued Sources mit1Cell/0Facts,
1Cell/65Joints/130Endpoints,1Cell/65Anchors und257Cells/65Joints, exakt64 Endpoint-Facts
sowie130 komplett inaktive Endpoint-Facts; volle Felder/JSON/Budgeterrors
gegen historische Klassifikation,10000-Advanceguard, ursprüngliche Produkt-Fehlerklasse.
Return/Throw bei frühem Fact-Yield sowie mittlerem/letztem Yield schließen den Generator ohne
Revival; neuer Lauf auf unverändertem Source ergibt wieder historische Daten. Clone/Proxy
bleiben unissued. Diese direkten Cancelchecks beweisen keine native Host-/World-Recovery.

Enger issued-Observer-Nachtrag: `model.ts:211-212` mappt die Plain-Data-Copy per nativeSpecies;
`:234-235` Freeze und`:253` WeakSet beseitigen mögliche Array-Proxy-get-Traps nicht.
`adaptive/validation.ts:115-157` kopiert Daten-Deskriptoren,`:203-209` friert sie ein;
nachfolgendeModel-Maps sind dadurch nicht Species-frei. Canonical`:64-73` und Structural-Content-
Projection`:67-79` erlauben weiterhin nativeMaps, keine NoSpecies-Garantie. Statisch gestützter
legitimer Pfad im damaligen Source-Review; der darauf basierende Case wurde in S15 PASS.

Der neue einzelne Case verlangt echte vollständige Reconstruction unter rücksetzbarem
Species-Constructor (Proxy über normalemArray, ohne gefälschte Lengthwerte), danach echte Issuance,
Proxy-Identität des gespeichertenFactarrays, Frozen-Data-Length-Descriptor sowie Content/Evidencehash
vor Arming. Anchors und Joints separat: Iterator+Length werfen zwei eigene Original-Sentinels;
Iterator muss zuerst gewinnen, bei Iteratorpass darf Length gewinnen; Normalcontrol und Factbudget1
gegen2Facts mit konkurrierendemLength-Sentinel beim nächstenIteratorread (Anchors3/Joints2).
Trace/Fehlerobjekt wird mit unverändertemHistorienforof verglichen, zusätzlich module-exportierter
`deriveStructuralSingleComponentMasses`-Caller: synchronerDrain der module-internenSteps, issued
Selector`:333`, originaler before/afterCallback-Vertrag. Kein öffentlicherBarrel-Massnachweis:
`deriveStructuralComponentMassProperties:373` bleibtGeneric. Species-descriptor-finally,
Trap-disarm-finally, keine rootProxy/fakeClone-Issuance. VollStatefulGetterMatrix bleibt **OPEN**.

**Bewusste offene Testbereiche:** Stateful Getter innerhalb Anchor-/Joint-/State-/Origin-Feldern,
vollständige Proxy Descriptor-Traps und gleichzeitige konkurrierende
Facts-/Digest-Throws nach freigegebenem Snapshot ergänzen. Keine Abdeckung behaupten, die nicht
geschrieben ist. Eigene T06 decken direkte Generator-Throws, nicht Host-Yield-Rejection ab.
Letztere bleibt A0s frische Lane: vorhandene `hvp-body-plan-owner.test.ts:153-195`
(Rollback/Dispose/Yield-Rejection), `:358-375` (Labels/Subspans), weitere Cancellation-/Clock-/Hash-
Fälle dort sowie `v3StructuralRecipeParity.test.ts:73-210`. Bestehende Tests unverändert lassen.

## Mess-/Verifikationsstrategie — ausschließlich nach Slot

1. S15 prüfte17 eigene Checks plus2 unveränderte Originalcontrols gegen gebundenen P01-WIP auf2548,
   mit unverändertem b3-Orakel als Expected, alle PASS; Typecheck PASS, Parent angenommen.
   S16 führte nur exakte6 retained Regressionfiles aus: actual33/33 PASS, voller180s-Cap.
   Private S11B-Dependencies behalten; keine foreign Junction/Package-/Lockwrites/Installation.
2. Separater unabhängiger P05-B3/Candidate-Slot: historische Generic-Beobachtung gegen echte
   immutable b3-Quelle und neuen akzeptierten Kandidaten, nicht die neue Issued-API als b3-Import
   voraussetzen. Die17-Datei enthält diese neue API und ist daher nicht unverändert unter b3 ladbar.
   Keine b3-Produktdatei in neueren Code zurückkopieren, Orakel nicht an Candidate-Helfer koppeln.
   A0 pinnt/verifiziert die spätere Integration selbst frisch; Source authoring ersetzt dies nicht.
3. **Kleinster nächster Messvorschlag, OriginalP01-T08 — nur vorbereitet, NOT_RUN:** zwei vorhandene
   Quellen: typische kleine Owner384/352-Quelle und legale32768-Quelle des eigenen Tests. Gleiche
   Inputs/Digests, Quantum/Budgets, Geräte-/Node-/Lock-/Buildstände für2548 und den Interimkandidaten;
   Setup/Warmup getrennt, AB/BA-Paare mit tatsächlichem n und allen Fehlern erhalten.
   Vorhandenes `bodyCutSession.ts`-Owner-/Planprofil (`observePlan`, `phases`, `max`, Recipe-Subspans)
   nutzen; es misst echte `.next()`-Arbeit, aber sein Sammellabel `classification` trennt keine Kerne.
   Nur in separat freigegebener testlokaler/externer Diagnostik echte Fact-/Index-, BFS-, Sort-,
   Hash/Freeze- und Projection-Arbeit getrennt attribuieren, einschließlich verbleibender fremder
   synchroner Aufrufe. Kein Profilierframework, neue Produktlabels oder Produktpatch jetzt.
   Median/p95/max für Gesamtarbeit und contiguous `.next()` einschließlich terminalem Step ausweisen;
   eigene Batches gegen p95≤4ms/max≤8ms beurteilen. Den64-Step-Tracecap/aggregierte Totals offenlegen:
   kein p95 aus nur dem gekappten Prefix. Instrumentierte Diagnose und uninstrumentierte Timing-
   Population trennen; qualifizierte Vergleichszeiten benötigen RD-/Geräteruhe und eigenen Messslot.
4. Erst danach den **größten gemessenen** Restkern mit Symbol/Inputgröße/Messwert und Live-Scratch
   wählen bzw. fremde Hash-/Freeze-Arbeit an A0 melden. Mehr Yields sind keine Work-Reduction,
   Timer-Gap- oder Latenzverbesserung; Task-Waits/Allokationsproxy separat. Kein Algorithmusentscheid vor Befund.
5. A0/benannter Owner-Slot kalibriert reale Host-Task-Zeit und Parent-Simulation. Erst P06
   normaler BodyBox384 mit erfolgreichem Applied/Render liefert integrierte RT-Evidence.
   Node-Drain ist kein Input→Applied/Render-/Hold-Test. Kein 1400-Populationslauf vor Gates.

Unveränderte Grenzen: contiguous max8ms/p95≤4ms; Input→Applied/Render p95≤250ms,
echter Body-Hold p95≤50ms, keine Prepare-Timer-Gaps>20ms. CPU256MiB, Mesh128MiB,
500000 Triangles, 300 Drawcalls, Prepare96MiB, Output8MiB, Jobs2/Queue32,
optionale Diagnose512KiB. Diese Analyse belegt keine dieser Laufzeitgrenzen.

## Historischer Befehlsplan; S11/S11B/S11C grants und Ergebnisse

S11 autorisierte maximal12min einschließlich frischer privaterPlaincopy≤120s, execCutofft0+11min,
letzte60s Cleanup. Vorbereitungszeit war eingeschlossen. Eigener einmaligerRunner im externen
Coordroot benutzte den bereits gelaufenen S09-WindowsJob-Launcher unverändert, keine neueFramework-
Architektur. Autorisiert waren die vier folgenden Programme mit OriginalDefault+JSON-Reportern,
je einer frischenJSONdatei, gleichen90/180/90/180s-Caps undWorkers1; keinBail/Retry.

DerRunner stoppte schon beimSource-installedMetadata-Lesen, **vor**Destinationmkdir/Copy.
ControllerExit1; alle vierOriginalProgramExits=null/NOT_RUN, keineCollected/SelectedCounts.
KeineVersion-/3757-SHA-/privateDeps-Akzeptanz; vollständigeBefore/After-BindungNOT_PROVEN.
Afterbinding bewahrt trotzdem vollständigeSource-/Test-/Config-/Toolhashes, exaktenWIPdiff,
allePins/6UnchangedRegressionchecks undScope. Setupfehler undOriginalRohstatus bleiben erhalten.
Kein neuerTest-/Fix-/SetupRetry inS11. DanachmechanischeSOURCE-onlyVorbereitung eines eigenenS11B-
Runners: fünfHunks, UTCargv/Rootlabels und mandatory`-X utf8`; OriginalS11helper unverändert.

S11B wurde separat grantet: max12min ab tatsächlicherersterUTC vorjedemPreflight, exec+660s,
Cleanup+720s; Copy≤120s. FirstAction`2026-10-02T18:36:20.4894211Z` wurde unverändert übergeben,
nicht beiControllerstart18:36:58 neu gesetzt. RunnerSHA256
`1c94bb791d1c5f72d9af8e0cc2b8fc3ea9d62dac4bc65a8890c180010c9341c1` vor/nach identisch;
S11OriginalSHA`b9bd2f5cfb73a6db3599d40782f2e27564d0d46878dab1eda0f087a2559be98b` ebenso.
Setup3757Plainfiles/Source-DestSHA/InstalledMetadata und Node22.23.2 erfolgreich gebunden.
Typecheck18:37:13.003791Z→18:37:15.149450Z, OriginalExit1/vierTS2352 imOwnDraft;
danach alle dreiVitestprogrammeNOT_RUN/null. KeineOriginalTestJSON vorhanden, fehlende
RuntimeErrorSuitezahl **NOT_PROVEN**, nicht0. KeineTest-/Helper-/Produktreparatur oderRetry.
SLOT_RELEASED18:39:18.860061Z zuerstkurz, danachDokumentation; task`bg_murb1mi4_2a` terminalfailed,
ownWindowsJobPIDsleer/gezielteNativeCIM0 Exit0. PrivateplainDependencies behalten, keineForeigncleanup.
FreshEvidence/Originalstdout+stderr und vollständigeBefore/Afterbindung sieheRESULT.

Der eigeneTestdraft wurde separat minimal korrigiert und neu auf8e344 gepinnt (exakteOwn466-Byte-
Archive undtypedDiff in`Coord/P01-s11c-authoring-20261002-01/`). **Keine** bestätigte Produktursache
ausTS2352 ableiten. S11C konnte mangels separat aufrufbarerBindingutility keineProgramme starten.
Vor einemfrischenGrant muss die erlaubteNoCopy-Binding-/Directcall-Vorbereitung tatsächlich
aufrufbar sein, ohneS11B-Setup-Replay/fragileCode-Extraktion. Keine neueUtility inS11C authoriert.
Der nachfolgende types-first Befehlsplan ist historisch/vorbereitet, keine weitereRun-Freigabe:

Maximal10min total: Type90s → eigene Oraclechecks180s → beide RETAINED Originalcontrols90s →
Regression180s →60s Release/Cleanup. Sequential, Workers1, keine Fileparallelität/Retry/Bail.
Voraussetzung: expliziter neuer Meta-Slot nachS11Release, fixierte Basis+WIP-Blobs+Test-/Orakelhash,
eigene pinned Dependencies im P01-Appdir. S11B hat3757privateverifiedPlainfiles behalten; Setup
nicht erneutkopieren/überschreiben. Ein spätererSlot muss vorhandeneIdentity neu read-only binden.
Keine Copies/Install jetzt. Fehlend heißt NO_START, nicht implizite
Installation. Keine Watcher/Builds/Bench/Profile/Browser/Server. Bei Failure Originale behalten,
kein automatischer Retry/Fixrun außerhalb Slot; bei Deadline task-owned Prozess sauber stoppen.

Executable jeweils exakt `C:/IFI_SourceCode/Utils/npm-tmp/opencode/node-v22.23.2-win-x64/node.exe`;
Working Directory exakt
`C:/IFI_SourceCode/Temp/WeltraumSpiel/.worktrees/Hestia-Parallel-P01-2026-10-02/apps/weltraum-browser`.
Folgende Argumente sind der historische Befehlsplan:1 inS11B aufOwn466 FAIL; inS11C alleNOT_RUN.
Später S15:1–3 aufOwn8e344 erstmals PASS;4 in S16 PASS/33Cases. Exact native payloads in
`Coord/P01-NATIVE-READY.md`, tatsächliche Outputs/Exits/Capgrenze im RESULT:

1. App-local `node_modules/typescript/bin/tsc -p tsconfig.json --noEmit`.
2. App-local `node_modules/vitest/vitest.mjs run tests/unit/hvp-parallel-p01-classification.test.ts --maxWorkers=1 --no-file-parallelism`.
3. App-local `node_modules/vitest/vitest.mjs run tests/unit/hvp-classification-contract-controls.test.ts --maxWorkers=1 --no-file-parallelism`.
4. App-local `node_modules/vitest/vitest.mjs run tests/unit/hvpOwnedClassificationSteps.test.ts tests/unit/structuralConnectivitySortOrder.test.ts tests/unit/structuralMicrovoxelConnectivity.test.ts tests/unit/structuralMicrovoxelCommands.test.ts tests/unit/structuralMicrovoxelMassProperties.test.ts tests/unit/v3StructuralRecipeParity.test.ts --maxWorkers=1 --no-file-parallelism`.

Alle Scriptpfade vor Run absolut unter diesem Appdir auflösen/binden. Original Exits/stdout/stderr
und JSON in einem neuen genehmigten Evidenceziel erhalten; S06 Originale nie überschreiben.
RET.original2Controls werden weder geändert noch als Orakel importiert; ihre Ausführung plus
unabhängiger b3-Vergleich ist erforderlich. Owner/Host-Regression im getrennten A0-Slot:
`hvp-body-plan-owner.test.ts` volle Datei oder vorab gebundener Cancel/Yield/Generic-vs-Owned-Selector,
danach Structural/Save-Integration passend zum A0-ChildProjection-Snapshot. Nicht alle Owner-Tests
unter diesem10min-Paket als stilles Fullsuite-/Native-Livenessgate dazunehmen.

## Historisches read-only Delta b3 → 2548ce04 (vor Aktivierung; keine aktuellen WIP-Zeilen)

Quellen: vollständig gelesene `A0-candidate-20261002/ROOTCAUSE-AND-SLOT.md` und
`CANDIDATE.json`; read-only Git `show`, `diff`, `ls-tree` im eigenen b3-Worktree.
Commit/Parent/Tree und die 20-Pfad-Inventarliste wurden mit Git korreliert. Die zwei
Produktdateien und ihr vollständiger Diff wurden gelesen, dazu die vollständigen zwei
Caller-Diffs und `hvp-classification-contract-controls.test.ts`. Kein Anspruch auf Review
aller übrigen 20-Datei-Änderungen, R01-Fixfreigabe oder unabhängige Laufzeitverifikation.

| Pfad unter `apps/weltraum-browser/src/` | Candidate-Blob / statisches Delta |
|---|---|
| `voxel/structural/classificationSteps.ts` | `0a39d213ed255afd1abc9d339d96ad85266ff213`: shared `classifySteps(...,issued)`; public generic erzwingt false, neue `structuralIssuedComponentClassificationSteps` true. Issued-Facts/Sort/BFS/Projection/Hash-Stepformen; beide Finalizer speichern private `{component,cellKeys}`-Wrapper. |
| `voxel/structural/occupiedEntries.ts` | `fb3ebdaabb46e5a4dd7c9d18d3b89702f57b1562`: generic Factory behält b3-Feld-/Getterfolge; issued Factory speichert globale Koordinaten/Zellkeys. Neuer Issued-Cursor prüft exakte lokale WeakSet-Identität; issued Extraction sortiert nicht erneut, setzt kanonische Issuer-Order voraus. |
| `voxel/structural/massProperties.ts:333` | `480d33b66ef2017e4cc7aa944c769dd1d29c6c71`: Single-Component-Massensteps verwenden jetzt immer den Issued-Classifier. Das erreicht auch öffentliche Recipe-/Preparation-Aufrufe mit issued Source, nicht ausschließlich OwnedHash-Aufrufe. |
| `hestia-prototype/physics/structuralPlan.ts:154` | `0ddd9eab620ed086789ff63cf193987e82e312b4`: ownedHash wählt issued, sonst generic; das äußere `classification`-Boundary bleibt bestehen. |

`connectivity.ts`, `commands.ts`, `physicsTransition.ts`, `rigidRecipe.ts`, `bodyCutSession.ts`
und sämtliche direkt vom eigenen historischen Orakel verwendeten Boundary-Primitive sind
laut scoped Git-Diff unverändert. Die öffentliche sync API drainiert weiterhin den **generic**
Generator, auch bei echter issued Source; Frozen-Clone/Proxy erhalten dadurch nicht issued Trust.
`rigidRecipe` erreicht bei issued Source den geänderten Mass-Caller transitiv; seine relabeled-
Logik macht neue innere `classification`-Yields zu `childClassificationCells`.
Das äußere Plan-Label `classification` kann neben issued inneren gleichnamigen Yields auftreten;
Boundary-/Subspan-Attribution muss deshalb zur tatsächlichen Stepfolge passen.

**DestructionBeforeYield bleibt unverändert:** `commands.ts:379` ist weiterhin ein ganzer
generic Classification-Drain. Dessen Plumbing liegt außerhalb der zwei Pfade bei A0/anderer
retained Lane. Kein zweites V3-System und kein Übergriff als vermeintliche Klassifikationskorrektur.

### R03 — ursprünglicher2548-Bug; S06 FAIL erhalten, S15 Control PASS

Candidate `classificationSteps.ts:491` pusht einen **unfrozen** privaten Wrapper mit den
Own-Keys `component` und `cellKeys` (`null` im generic Pfad). `:501-510` erzeugen daraus
neue `.map`-/`.filter`-/weitere `.map`-Receivers; `:511-550` ersetzen den bisherigen
`detachedComponents.map(...fragment...)` durch einen Push-Loop.
Das b3-Orakel enthält dagegen direkt StructuralComponents, friert deren Array ein,
filtert dieses und mappt detachedComponents zu Fragmenten.

Statische Folge: native ArraySpeciesCreate kann `Array.prototype.constructor` mit dem
Receiver aufrufen, der private Wrapper enthält. Damit bestehen neue Observer-/Throw-/
Mutationspunkte und eine andere Anzahl/Reihenfolge von Species-Seams, selbst falls normale
Deepwerte/Hashes identisch bleiben. Im Candidate ist bereits die erste generic `.map`
über `components` (`:503`) solch eine Seam. Auch das alte Fragment-Receiver-/Species-Verhalten
verschwindet durch den Push-Loop. Outputparität allein beweist diesen Vertrag nicht.

Der authored A0-R03-Control konstruiert legalen Source/control **vor** dem Constructor-Hook,
liest unter dem Hook nur den Data-Descriptor von Array-Index0 und prüft zwei Own-Keys;
bei Wrapper wirft er ein identisches gefrorenes Sentinel-Objekt. Exakter Restore erfolgt
in `finally` **vor** Expect/JSON/logging. Danach vollständige Normalwerte und JSON-Bytes
prüfen. Das ist mit dem unveränderten b3-Orakel korrelierbar; kein Candidate-Helfer muss
in das Orakel übernommen werden. **Damals nicht ausgeführt; später S15 PASS.** Der mögliche
Sentinel wurde anschließend in S06 identisch an`:104:25` beobachtet (Exit1); spätere Resultat-/
JSON-Parität NOT_REACHED. Rohe Originale wurden read-only gelesen und unverändert erhalten.
Das bestehende eigene Species-Readcount-Draft ist kein Receiver-/Descriptor-/Throw-Nachweis.

### R02 — ursprünglicher2548-Bug; S06 FAIL erhalten, S15 Control PASS

Candidate `classificationSteps.ts:309-317` wählt `bounded` ausschließlich nach
`issued && entries.length > 256`. `indexIssuedFactsSteps` zählt pro Anchor/Endpoint eine
Unit, yieldet bei64 jedoch nur mit `bounded=true` (`:149-188`). Facts-Merge/-Sort,
Projection und Hash-Pfad verwenden denselben Flag (`:243-294`, `:393-448`).

| Aus genuinely reconstruct/issued Source | Statische Branch-Erwartung, kein Run |
|---|---|
| 1 Cell, anchors[], 0 Joints | bounded=false, keine inneren Finalization-`classification`-Yields. |
| 1 Cell, anchors[], 65 eindeutige legale Joints, beide Endpoints an dieser Cell | 130 Facts; bounded=false trotz zwei vollständiger64-Fact-Batches. Index/Merge/Sort/Projection/Hash bleiben im finalen `.next()`. |
| 257 Cells, anchors[], dieselben65 Joints | bounded=true; Facts- und weitere Finalizer können `classification` yielden; Output muss alle130 Endpoints behalten. |

65 Joints sind unter Schema-Max4096; Endpoint-Facts=2J, gleiche Cell ist nicht illegal und
keine Berechtigung zur Deduplication/Reduktion. Kein HVP-Anchor-Fake. `reconstructStructuralObjectInternal`
stellt die tatsächliche lokale Issuer-Identität her; Hash/Freeze/Clone/Proxy ersetzen sie nicht.
Der A0-Control drainiert alle drei Generatoren vor der kritischen Assertion, mit10000-Stepguard.
b3s expliziter Generic-Fallback ist ein **bekannt unsliced** Ausgangscontrol, keine Erwartung,
dass b3 plötzlich issued Finalizer hat. Ein tatsächlicher Yield-Control-FAIL wäre kein
gemessener4ms/8ms-Verstoß. 4096-Joint-Timing, Worker-Gaps, Peak-Memory und Spielerpopulation
sind weiterhin nicht ausgeführt/nicht genehmigt; fehlende Yields nicht mit Zeitwerten gleichsetzen.

S06 Original`:136:41` ist`expected 0 to be greater than 0`, nach erreichten genuine130-Fact-
und257-Cell-Positivcontrols. Später S15 auf gleicher frozen Datei PASS. Historischer Rohroot:
`C:/IFI_SourceCode/Utils/opencode-migration/tmp/opencode/hestia-parallel-coordination-20261002/A0-evidence-r01-2548ce04/`;
ProcessJSON, stdout/stderr, RESULT und Handoff-PLAN vollständig read-only geprüft.

### Vollständige transferfähige Generic-Observer-/Errorparity-Prüfliste

Diese Matrix ist **Vorbereitung**, keine zusätzliche geschriebene/ausgeführte Testsuite.
Die historische Matrix bleibt die Checkliste; das b3-Orakel bleibt unverändert. Zwölf Drafts
wurden ohne abgeschwächte Assertions um physikalische Expected-Daten und vier Vertragsfälle ergänzt;
weitere offene Controls werden
erst mit klarer Testdatei-/Snapshot-/Slotbindung übertragen oder ergänzt, nicht an Candidate-
Helfer gekoppelt. Gleiche Inputs separat frisch herstellen, Source vor Hooks erstellen;
keine Assertions/Runnerlogs unter gepatchten globalen Descriptors. Alle Ergebnisse/Throws
bewahren, exakte Descriptors auch bei Failure/Cancel im finally restaurieren.

| Prüfbereich | Historische Bindung / erforderliche Positiv- und Negativcontrols |
|---|---|
| Entry-/Call-Gates | Generic Source, genuine issued Source über **öffentlichen** Generic-Drain, deep-frozen Clone und transparent Proxy: gleiche historische Observer-/Output-/Fehlerpflichten. Privater Issued-Cursor rejects Lookalikes/Proxy; Identity-Gate darf nicht rückwirkend öffentliche Eingaben verengen. |
| Generator-Fabrik/Resume | Keine Source-/Budget-Reads bei Factory-Erzeugung; first.next liest Budgets in originaler Reihenfolge. Erlaubte Resume-Werte ignorieren; direct return/throw und nachfolgend done/undefined unterscheiden von sticky Cursor/Session. |
| Budget-Observer | Getter/Proxy auf maxVisitedCells/maxComponents/maxIndexedFacts; invalid erster Wert gewinnt vor Throw in späterem Getter, danach Komponenten- vor Facts-Budgetvalidierung. Keine Vorab-Source-Reads oder neue Fehlerklasse. |
| Native Traversal | object.bricks getter/iterator.next, brick.cells getter/iterator, cell.localIndex und state: b3-Reihenfolge/Anzahl kontrollieren. Source-Getter-Throw, malformed Key/Index und überschrittenes Cell-Budget paaren. Ein überzähliges Cell-Objekt darf nicht vor Budgetgate gelesen werden. |
| Sparse/Custom iterables | Hole in bricks/cells und native engine TypeError/path/message mit b3 vergleichen; lokale Iterator-return einmal bei Fehler/return/throw, Cleanup-Throw überschreibt Primärfehler nicht. Plain borrowed Arrays nicht heimlich zu engeren dense-/issuer-only Inputs machen. |
| Fact-Observer | Anchor-ID/cell-Getter inklusive zweitem cell-Read; Joint endpointA/endpointB **beide** vor erstem consume. Dann jointId/cell/role/zweiter cell-Read; User-Sentinels in jedem Slot mit Facts-Budgetgrenze kombinieren. Inaktive Air-Facts zählen weiterhin. |
| Kanonische State-/Key-Observer | Proxy ownKeys/getOwnPropertyDescriptor/get/GetPrototypeOf auf erlaubten Boundary-Records und State; fehlende/extraneous Keys, undefined, -0, unsichere Integer, Unicode-Surrogate, Cycle versus früher Budget-/Fact-Throw. Keine neue Normalize-/Sanitize-/Forgiveness-Schicht. |
| Generic Finalizer-R03 | Constructor-getter sieht b3-Receiverformen, Frozen-State und Own-Keys; Sentinel beim privaten Wrapper muss im Candidate nicht neu entstehen. Species-getter/Constructor-Throws nach ordinaler Seam, Observeranzahl/Order, custom Species output und früh/spät Mutationsversuch paaren. Anchored-only, detached-only, gemischte und leere Components; alter Fragment-map-Receiver darf nicht verloren gehen. |
| Freeze/Escape | Deepfreeze gleicher öffentlicher Resultate und vorhandene borrowed-state-Freeze-Sideeffects; keine aus Species/constructor escaped mutable privaten Wrapper, Iterator/Scratch oder inkonsistente Arrays. Keine blanket zero-retention-Behauptung ohne Laufzeitnachweis. |
| Fehlerpräzedenz | Invalid budgets → Extraction/CellBudget/InvalidCoordinate/Getter → Facts/FactsBudget → SourceDigest auch bei Empty → ComponentBudget33 → Component/Fragment-Finalizer. User-Throw bleibt dasselbe Objekt, StructuralConnectivityError name/code/path/message und StructuralValidationError/cause bleiben unverändert. Comparator-/Species-Throw am historisch richtigen Zeitpunkt; kein Erfolg/partial truncate bei Fehler. |
| Fehler-Lebenszyklus | Cursor failure vor invalid maxUnits/done/dispose; repeated observation gleiche Ursache, cleanup idempotent. Host-yield-Rejection/owner dispose/cancel mit erster Ursache und kein Stage-revival bleiben A0-Session-Test, nicht durch DirectGenerator-Control ersetzen. |
| Ordnung/IDs/Werte | N=0/1/32768, limitN/N-1; Components32/33; negative x/y/z-Seams, Diagonal- und erlaubte Permutationsfälle. SerialKey/localIndex-Order, componentId-Order, getrennte fragmentId-Order, aktive Facts inkl. A/B-Order und alle Hash/Binding-Felder exakt. Joints verbinden keine Components. |
| Downstream öffentlich | Single-Component-Mass-/Recipe-/Transitioncallbacks before/after Classification; Callback-Throw und ambient Constructor-/Species-Änderung. Candidate massProperties ruft jetzt issued auf, daher public issued Preparation nicht aus Observerprüfung ausnehmen. Exakte floating-point-Summation/COM/Tensor/Collider-/Child-ID-/Save-Parität, keine gelockerte Toleranz. |
| Owned R02 und Shapes | Genuine issuer für 1Cell/0J, 1Cell/65J, 257Cells/65J; no truncation, activeJoints130, Drain aller Controls vor Failassertion, finite Guard. Schema4096 Anchors+4096 Joints ergibt maximal12288 legale Facts, unabhängig vom höheren Connectivitybudget262144. Facts-, String-/Digest- und Sortlast auch bei ≤256Cells als separate Restkosten beobachten, keine Cap-/Deadline-Änderung. |

**Nächster Gate:** Parent-Acceptance S15/S16 und genau ein lokaler scoped Interimcommit sind freigegeben;
CPU/Setup/Profil nach S16 bleiben NOT_GRANTED. P05s unabhängiger b3/candidate Review bleibt separat;
S06 Fehlcommit2548 bleibt unverändertes Gitobjekt. Kein Push/PR/MainMerge/A0-CherryPick oder Integration.
Die externe Kandidatenkarte bindet den lokalen Commit; A0 allein integriert nach separater Prüfung.
InterimR02/R03-Fix ist nicht OriginalPaketDone und kein CODE_VERIFIED/PERF_ACCEPTED-Gesamtsiegel.
Kein Orakel geändert, keine zusätzlichen Heavyjobs/Browser/Agents gestartet. STOP am Mess-/Integrationsgate.
