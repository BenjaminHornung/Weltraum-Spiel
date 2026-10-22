# Kleine gemeinsame Schnittstellen, keine neue Engine-Abstraktion

Diese Verträge sind **Entwürfe für die Spikes**, nicht die Behauptung implementierter Produkt-APIs. Ein Producer friert seinen tatsächlich testbaren Vertrag ein; Consumer importieren genau diesen Stand oder eine digestgebundene Kopie in ihren eigenen Scope. Keine zwei Schreiber an gemeinsamen Contracts. Vorhandene Types/Ports aus dem Produkt haben Vorrang, soweit sie die fachliche Aufgabe erfüllen.

## 1. Source und abgeleitete Produkte

Ein Snapshot bindet mindestens Domain/World/Session/Epoch/SourceOwner, SourceRevision und Digest, Frame, Weltzellgröße, Materialprofil, Produktalgorithmus und vollständige Coverage. Renderer-Transformgeneration und Sourcegeneration sind getrennt. Unknown ist ein eigenständiger Zustand, nicht Slot0/Air.

Neue Konsumenten bekommen immutable Snapshotprodukte oder transferierte Kopien. Eine öffentliche Oberfläche gibt keine veränderlichen Authorityarrays aus. Keine Source-Gesamtserialisierung pro kosmetischem Frame. Snapshot-Replay im Labor ist als Replay markiert, kein echter neu ausgeführter Gameplay-Cut.

## 2. CollisionRecipeDraft

Drei unterscheidbare Payloads: `triangles`, `multi-cuboid`, `voxels`. Gemeinsame Sourcebindung und kanonische Hestia-Masseneingaben bleiben getrennt von Solver-/Shapehandles. Backendprofile bestimmen, welche Payload wirklich unterstützt wird. Kein allgemeines Pluginregistry für beliebige Solver.

`voxels` bindet Zellmaß, Origin, Voll-/Unknown-Coverage, Belegung, Nachbarschaftsgeneration, Materialzuordnung und Aufbauversion. Die gepinnte API entscheidet die tatsächlichen buffer types. `setVoxel`/`combineVoxelStates`/`propagateVoxelChange` brauchen eigene reale Nachbar-/Contacttests; keine aktiven colliderinternen Mutationen vor dem Hestia-Commit. Frische Kandidatenshapes/Transaktionsrebuild sind im ersten Spike zulässig, Kosten zählen mit.

Kanonalische Masse/COM/Inertia wird einmal aus Hestia-Materialien übernommen, nicht zusätzlich durch automatische Rapier-Dichte verdoppelt. Ein Voxelshape ersetzt nicht Structural Connectivity, Fragmentbesitz oder Physikinstallation.

## 3. Solverprofil und Migration

`SolverProfileRef` bindet Paketname, Version, Buildflavor, WASM-Digest, Schritt-/Integrations-/Kontaktpolicy und Query-Sichtbarkeitsvertrag. Einstellung vor World-Erzeugung, kein automatischer Wechsel einer bestehenden World von SIMD zu anderssemantischem Fallback.

Sourcecodec, Worldsave-Envelope, Solverprofil und Collisionrepräsentation besitzen getrennte Versionsachsen. PHY-03 testet die tatsächlich erreichbaren Kombinationen, insbesondere:

- alte Source + alter Solver: unveränderte Lesbarkeit;
- alte Source + neuer Solver: expliziter Migrator, kanonische Belegung unverändert, native Produkte neu;
- owned-subset-v1 + ausgewählter Solver: erst nach S2-Vertrag;
- neue Landschaftsjournale + neue Weltzellgrößen: spätere M4/M8-Erweiterung desselben Envelopes.

Alte `surfaces[i]`-/Colliderreihenfolgen dürfen nicht als Index in eine beliebig andere Voxelshape übernommen werden. Neue Quellen-/Masseneinheiten dürfen sich nicht aus einer Shapeautomatik ergeben. Legacybytes behalten, in neuen Slot schreiben, CAS/Abort/Reparse nachweisen. Kein stiller Stringtausch `rapier-0.12.0`.

## 4. Bedarfsgesteuerte Produkte

`purpose = render | collision | render-and-collision` gehört zur Job-/Resultatidentität. Ein collision-only-Resultat kann keine render-and-collision-Anfrage erfüllen. Gleiche bekannte Source-/Halogrenzen für alle benötigten Produkte. Das erlaubt das Weglassen **nachgewiesen ungenutzter** Renderarbeit, nicht das Überspringen der Prüfung eines tatsächlich konsumierten Produkts.

Der Anfangseingriff ist nur der konkret dokumentierte Eastfall. Erst ein späterer belegter Konsument kann die allgemeine Option verwenden. Kein neuer Selector-Hotpath für jede denkbare Kombination.

## 5. Settings-/Ressourcenport

GFX-01/02 produziert einen Erweiterungskandidaten für bestehende Settings (Desired/Confirmed, Capability und Effective getrennt). `rayTracing` und `weatherQuality` sind additive Dimensionen, `effectsQuality` bleibt fachlich unverändert. A0 S3 besitzt die gemeinsame Ressourcenadmission; GFX liefert Capability-/Policywerte, keine zweite RAM-/GPUbudgetautorität.

Referenzmessungen frieren effektive Qualität ein. Stabile Eingaben führen zum gleichen Controllerergebnis; fehlender Timer oder Hintergrundtab verändern keine Quality aufgrund falscher Nullen. Ein Render-LOD verändert weder physikalische Kollisionsgeometrie noch Source-/Saveidentität.

## 6. Zeit, Planet und Wetter

Der existierende Universe-SimulationTick ist die Zeitbasis. Im bereitgestellten Code liegt die Taktdefinition unter `src/persistence/time.ts`; vor Implementierung ganz lesen. Wetter-W1-Profil verweist auf Modellversion, Profile/Geografie/Klima-Digests, Atmosphäre-Epoch und Eventcursor. Snapshotidentität muss die **tatsächlichen Input-/Zustandsbindungen** enthalten, nicht nur `(body,tick,revision)` ohne wechselbare Profildigests.

Physik-/Atmosphärenprofile sind neue versionierte Referenzen, kein unkontrollierter In-place-Write von `AtmosphereDefinition`. `airless` liefert explizites NoAtmosphere. Pending/UnknownCoverage/Unsupported sind keine numerischen 0-Felder. Gasriesen haben Druckkoordinaten ohne impliziten Boden. Planetare RNG-/Zeitevolution ignoriert Kamera, Renderqualität, Workeranfragefolge und Objekt-Timewarp.

## 7. Optische Komposition

Atmosphere-/Ray-/Wetness-/Waterdaten sind Presentation. Verpflichtendes Block-AO bleibt Bestandteil des ausgewählten Primärmeshingprofils. Zusätzliche Beleuchtung darf später eintreffen, aber nur mit gültiger History/Revision oder sichtbarem Basisfallback.

Ein Canvas/Renderloop im integrierten Vergleich, lineares HDR und genau ein Tonemapping. `depthWrite:false`-Wasser erfordert explizite Front-/Back-/Depthstrategie. Camera cutout ist nicht echte Luft für Physik oder GPU-Occupancy. Ein PBR-/Windshader ist keine neue Materialdichte.

## 8. Fluid-Authority

FLD-01 trennt Meer/Fluss, geschlossenes Höhlenvolumen, Rohrnetz/Tank und lokale Luft-Wakes. Menge/Fluss/Drainquellen gehören einem fachlichen Resolver. Salva/Nexus/Partikel visualisieren oder simulieren einen abgegrenzten Teil; ein Bild wird nicht rückwärts zur Wassermengenautorität.

Kleine Labresolver dürfen eine neue eigene Testsandboxwahrheit besitzen, greifen aber nicht auf HVP-Saves zu. Kein GPU-F2-Zustand wird zum Gameplaywind, solange der deterministische Wirkungs-/Checkpointvertrag fehlt.
