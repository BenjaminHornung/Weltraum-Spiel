# Hestia Evidence, Conflict and Migration Register

**Version:** 1.0  
**Stand:** 2026-08-12  
**Auditierter GitHub-Stand:** `BenjaminHornung/Weltraum-Spiel@15f3550bd604856b25d40a7ac700ec4d5106b89e`  
**Zweck:** Prüfbare Herkunft, Normativität, Konfliktauflösung und Migration der Hestia-Designsprache  
**Begleitdokumente:** [Hestia Visual Design Language](./01_Hestia_Visual_Design_Language_v1.md) und [Hestia Worldgen & Editor Authoring Specification](./02_Hestia_Worldgen_Editor_Authoring_Spec_v1.md)

## 1. Verbindliche Kurzentscheidung

> **Hestia ist keine Low-Poly-Welt. Hestia ist eine hochdetaillierte, kleinteilig blockartige Voxel- und Microvoxelwelt.**

Die zwanzig am 12. August 2026 im Auftrag bereitgestellten Konzeptbilder sind für sichtbare Form, Oberflächenwirkung, Detailmaßstab, Vegetationsmorphologie, Hydrologie, Licht und Atmosphäre die aktuelle Owner Source of Truth. Frühere Texte, Runtime-Prototypen oder Screenshots, die glattes Low-Poly-Terrain, Surface Nets, facettierte Heightfields, primitive Vegetation oder grobe Dioramen als Zielbild beschreiben, sind in dieser Frage überholt.

Diese Entscheidung ändert keine nachgewiesene Runtimefunktion rückwirkend. Sie trennt ausdrücklich:

- **Design Target:** Wie Hestia aussehen muss.
- **Runtime Evidence:** Was ein konkreter Build tatsächlich implementiert.
- **Technical Contract:** Welche Autoritäts-, Raster-, Persistenz- oder Meshinggrenzen gelten.
- **Research Proposal:** Was untersucht oder empfohlen, aber noch nicht angenommen wurde.
- **Historical/Rejected:** Was als Lern- oder Negativbeleg erhalten bleibt.

## 2. Normative Sprache und Statusklassen

Die drei Dokumente verwenden `MUST`, `MUST NOT`, `SHOULD`, `SHOULD NOT` und `MAY` im üblichen normativen Sinn.

| Status | Bedeutung |
|---|---|
| `USER-SOURCE-OF-TRUTH` | Explizite aktuelle Ownerentscheidung oder aktuelle Konzeptbilder. Für das sichtbare Ziel verbindlich. |
| `CANONICAL` | Bestehende Projektentscheidung oder belastbarer committed Contract. |
| `ACCEPTED-PROFILE` | Für einen benannten Scope akzeptiert, nicht automatisch universell. |
| `IMPLEMENTATION-PENDING` | Als Ziel oder Entscheidung beschrieben, aber noch nicht als Produktfunktion bewiesen. |
| `PROPOSED-RESEARCH-BASELINE` | Detaillierte Empfehlung aus Forschung. Vor Produktion zu entscheiden oder durch Spike zu beweisen. |
| `VISUAL-PENDING` | Geschmackliche oder visuelle Zahl benötigt Ownergate. |
| `OPEN` | Noch nicht entschieden. Das Dokument darf keine Entscheidung vortäuschen. |
| `RUNTIME-EVIDENCE` | Nachweis eines Builds, nicht automatisch visuelle Norm. |
| `REJECTED/HISTORICAL` | Darf für Provenienz und Negativbeispiele erhalten bleiben, nicht als Ziel verwendet werden. |
| `CONFLICT` | Quellen widersprechen sich. Die hier dokumentierte Resolution ist anzuwenden. |

## 3. Untersuchungsumfang und Vollständigkeit

### 3.1 ChatGPT-Projektkorpus

Der vollständige Projektordner wurde rekursiv inventarisiert und materialisiert:

| Kategorie | Instanzen | Deduplizierter Umfang |
|---|---:|---:|
| Gesamte Projektobjekte | 460 | durch vollständiges Verzeichnislisting belegt |
| Reguläre `.md`-/`.txt`-/`.json`-Dateien | 271 | 177 unterschiedliche Textpayloads |
| PNG | 145 | 127 unterschiedliche Dateihashes, 103 pixelverschiedene dekodierbare Bilder |
| ZIP | 37 | 24 unterschiedliche gültige Payloads; lokal lagen 35 vollständige Materialisierungen und zwei unvollständige Downloads, die über vollständige Dubletten abgedeckt waren |
| Sonstige Dateinamen/Formate | 7 | fünf Dateien mit dem Suffix `.md eingefügt`, eine GZ- und eine weitere Metadatendatei |

Alle 177 unterschiedlichen Textpayloads wurden vollständig byteweise gelesen. Exakte Dubletten wurden über SHA-256 zusammengeführt, statt denselben Inhalt unter mehreren Suffixen erneut als unabhängige Quelle zu zählen. Alle 24 unterschiedlichen gültigen Archive wurden inventarisiert. Für Hestia relevante Referenzarchive wurden entpackt und inklusive Readmes, Prompts, Manifeste, Metriken, Ziel- und Negativbildern geprüft.

Drei PNG-Instanzen waren im materialisierten Snapshot nicht vollständig dekodierbar:

- `P01_03_validation_blocked.png`
- `image-gen-5(1).png`
- `image-gen-5(2).png`

Sie besitzen keine stärkere Art-Direction-Rolle und blockieren die Designentscheidung nicht. Die Projekttexte und ZIP-Inhalte wurden davon unabhängig vollständig verarbeitet.

### 3.2 Zusätzlich bereitgestellte lokale Projektquellen

Alle 16 Dateien unter `project_sources/` wurden vollständig gelesen:

- 14.470 Zeilen
- 96.379 Wörter
- 892.443 Bytes

| Nr. | Datei | SHA-256 | Einordnung |
|---:|---|---|---|
| 01 | `WELTRAUM_PROJECT_INSTRUCTIONS_ADDENDUM` | `923f7c89fa0e891c2a6efca8f056293fdf449a4e944083127a5449c6f9a50390` | kanonische Projektanweisung |
| 02 | `WELTRAUM_PROJECT_MEMORY` | `009e1f413dba67c34a85959b29e0fd190691ea3b808ee5e2b07ad18657539c4c` | lebendes Projektgedächtnis |
| 03 | `WELTRAUM_RESEARCH_REGISTER` | `cf419b538caf24fa4a8d29711c0fbf13f260cd074725c5800f065d2c0477732d` | Registersnapshot, teils statusveraltet |
| 04 | Benchmark Methodology Audit | `905e3bdf8b35b1191b72082618673ac9b941a9c39d336911ec9cecb8f79f27ec` | Research, keine ausgeführten Benchmarks |
| 05 | Destruction/Connectivity/Physics | `79ccccb489e01a1d2858979a3983f4b6073fee48e5c876ae256bb653b0b363f0` | Research Baseline |
| 06 | WP04 Block AO/Palette | `b4c4ca8ad3678c5608f56c983efbfb0a95474570bb97dc6455d7bef943bdaa68` | Research-GO, keine Implementierung |
| 07 | Integration Boundary Audit | `8d493a1d7ed6f6b362bb6594cc459cce22c1eec8c874a4e51ec6b32644a8797d` | Read-only Audit |
| 08 | Planet Scale/LOD/Persistence | `aaecbcbe150085d0e65bdf2d81cf51fd5b08f9fc24430286e23c86ef9f20df74` | Research Baseline |
| 09 | WebGPU Engine Bake-off | `20ce821394f775c9689589e95e023c750fea03f04ef3d5c30c774361ef3e52ef` | Empfehlung, keine Engineentscheidung |
| 10 | OSS/License Audit | `88c171023dfdf97446f8d719e2720236a2cb22722f838b3ef05bcda37bc4a9a0` | Audit und Do-not-copy-Register |
| 11 | BR01 Provenance Contracts | `b72290be9cb258158a31e6e032acb8eec0f984c30bd55ae882c3d2723529405d` | bereit für spätere Implementierung |
| 12 | BR02 Browser Telemetry | `2499e5b047da5748e847892131a778a44a32bb41f412b73e0c09c5584ea6b9fd` | bereit für spätere Implementierung |
| 13 | C06 License Decision Brief | `9d1e5f903d90a2d4e84cc1c5428f98326dfd951b97e618599270ab820e283378` | Ownerentscheidung offen |
| 14 | BR04 Aggregator | `289903f6a47beed477bdb10d60d1d67d93b7e73164f29ae90271e0cc18c0aacc` | zusätzliche Forschung nötig |
| 15 | BR03 Playwright/CDP Runner | `9f8c7af1b14dad02f92523b222f11cd095c5fcb7befab2289ad801bd50799590` | bereit für spätere Implementierung |
| 16 | WP04 Review Protocol | `182717df6ddc450506a9c16c07c09e4eed637483fb3d770bef5597d7a2a261e8` | Reviewprotokoll, kein WP04-Pass |

### 3.3 GitHub-Repository

| Feld | Verifizierter Wert |
|---|---|
| Repository | `BenjaminHornung/Weltraum-Spiel` |
| Default Branch | `main` |
| Auditierter HEAD | `15f3550bd604856b25d40a7ac700ec4d5106b89e` |
| Tree SHA | `c324f8c2ab9ca23c6a3d6b2d1ec06b88f0c23982` |
| Rekursiver Tree | 3.670 Einträge, `truncated:false` |
| Grobe Verteilung | `.devtoolbox` 2.468, `apps` 788, `docs` 257, `art` 45, `tools` 37, `.github` 16 |
| Bilder | 408 |
| Textdokumente | ungefähr 1.322 Markdown/MDX/TXT, viele historische Change-/Evidence-Artefakte |

Der komplette Tree wurde inventarisiert. Aktive Hestia-, Worldgen-, Architektur-, Tool-, Research-, Code-, Test- und Evidencebereiche wurden inhaltlich geprüft. Historische `.devtoolbox/archive/**`- und `docs/legacy-unity/**`-Bestände wurden katalogisiert und gezielt auf Hestia, Low Poly, Surface Nets, Voxel und Worldgen durchsucht. Sie werden nicht als gegenwärtige Authority verwendet.

Der auditierte Commit ist ein Lesestand, kein dauerhafter Freeze. Jede spätere Aktualisierung dieses Registers MUST den neuen Remote-SHA und relevante Diffs binden.

## 4. Quellenhierarchie

Für die drei neuen Dokumente gilt folgende Reihenfolge:

1. **Explizite aktuelle Nutzerentscheidung und die zwanzig aktuellen Anhänge** für sichtbare Form, Detailmaßstab und Atmosphäre.
2. **Hestia-Weltkanon in `startsystem.md`** für Planetologie, Biosphäre und globale Motivlogik.
3. **Aktuelle committed Authority-, Asset- und Structural-Contracts** für technische Grenzen.
4. **Sechs `target-*`-Bilder der Hestia-V2-Pakete** als bestätigende Visual Targets.
5. **GitHub-Hestia-Konzeptbilder 23, 30, 36, 38 und 40** für Motiv, Gameplaymaßstab und regionale Mood-Varianten.
6. **Settlement-, Exploration-, City- und Asset-Research** für Funktions-, Daten- und Prozessregeln.
7. **Technische Surface-Lab-Screenshots** als Runtime Evidence.
8. **b9, d880, Gate A, frühe Dioramen, Unity und Low-Poly-Artefakte** als Negativ- oder Legacybelege.

Für Implementierungswahrheit gilt weiterhin die projektinterne Evidence-Hierarchie:

1. aktueller GitHub-Remote-SHA und committed Code;
2. Golden Contracts, Tests und reproduzierbare Evidence;
3. akzeptierter unabhängiger Review und Integrationsbericht;
4. Project Memory und Decision Log;
5. abgeschlossene Research-Berichte;
6. laufende Research-Empfehlungen;
7. Chat;
8. historische Prototypdokumente und alte Screenshots.

Die beiden Hierarchien widersprechen sich nicht. Ein Konzeptbild kann das verbindliche Designziel definieren, ohne zu beweisen, dass ein Build dieses Ziel implementiert.

## 5. Aktuelle Anhänge, Hashregister

Alle Dateien sind 1672 × 941 Pixel, außer den drei 1536 × 1024 Konzepttafeln. Vier Paare sind byteidentische Dubletten.

| Nr. | Datei | SHA-256 | Klasse |
|---:|---|---|---|
| 1 | `15_37_12 (2)` | `c9a71fc4a1447134d7476b427725d1f31e88128de4085ae13fbc315bac48c999` | City/Urbanismus, semantisch |
| 2 | `15_37_13 (3)` | `803144e17be11a3a624583ac79863b67c0a560456237c892080077a5ed59ae11` | City/Campus, semantisch |
| 3 | `15_37_14 (4)` | `ceb1e3b2ad6ef5fdf97a823208f8c641485e9fffbca090e4f3e74564334f97dc` | Raumhafen, semantisch |
| 4 | `15_37_14 (5)` | `28c9cd30d3a19fe709a79dd92e783699323bfe35703ede62829bdbe57cc3a038` | Industrie/Logistik, semantisch |
| 5 | `15_37_33 (1)` | `60342ebc6b5bd2b258c2a0922de73724411e2392a2995e0b0a14b0cc288282b8` | Gratia City Tafel, semantisch |
| 6 | `15_37_34 (2)` | `78e4859118ee4d8e2b6c2393ea66912ebb1d314ae48f5c7e553e6056a8334968` | Hestia City Tafel, semantisch |
| 7 | `15_37_39` | `b7833ab723a5ba1cbe6d959cc2f104967c938c0808f5361d2cf2917a1fd08283` | Biome/Taxonomie und Voxelziel |
| 8 | `15_37_44 (2)(1)` | `eb537878254c25bbbf0cc0fbe2c95be8e7b62e765ac04bbf3e78c33e71795c8a` | Forested Island Visual Target |
| 9 | `15_37_44 (3)(1)` | `38b6c27d73b2e207e6c8ccbed7bced6a1b955957766586e068bc1250b2c10959` | River Valley Visual Target |
| 10 | `15_37_45 (4)` | `4cb9e920f9ad0ac357ba65d04ef82faa994524fe9c8bb3cf9ed8cff6db9edc2a` | Savanna Valley Visual Target |
| 11 | `15_37_45 (5)(1)` | `170d02e5062e21c66e07113cc35dfcf782202f0a18b84aaba4f028e7a75d3295` | Coastal Savanna Visual Target |
| 12 | `15_38_27 (1)` | `66418506961dc5bd781fc9091760a0b559d862f77a97398c45fb3f9b5b006471` | Lush Valley Visual Target |
| 13 | `15_38_27 (2)` | `eb537878254c25bbbf0cc0fbe2c95be8e7b62e765ac04bbf3e78c33e71795c8a` | Dublette von 8 |
| 14 | `15_38_28 (3)` | `38b6c27d73b2e207e6c8ccbed7bced6a1b955957766586e068bc1250b2c10959` | Dublette von 9 |
| 15 | `15_38_28 (4)` | `4cb9e920f9ad0ac357ba65d04ef82faa994524fe9c8bb3cf9ed8cff6db9edc2a` | Dublette von 10 |
| 16 | `15_38_28 (5)(1)` | `170d02e5062e21c66e07113cc35dfcf782202f0a18b84aaba4f028e7a75d3295` | Dublette von 11 |
| 17 | `15_38_41 (1)(1)` | `1aec508ddb1499a0bb460aa3c0760aaa42289523cca6598c14b255066554850e` | Archipelago Visual Target |
| 18 | `15_38_41 (2)(1)` | `c91d87b6214bd0a0532ab71f50ead3c97ce33fa9af70270b93de30195f988020` | Wetland Roots Visual Target |
| 19 | `15_38_41 (3)(1)` | `667f7e54f09ccc40648709bfaa73e1db5e6a6d7556d109e25a14fa17ed9245e3` | Terraced Coast Visual Target |
| 20 | `15_38_42 (4)(2)` | `000ef11c6766b76c8709ba0d01e2e47315da04dce6d069e82dda4b888030fd27` | Lagoon Channel Visual Target |

**Wichtige Leseregel:** Bilder 1 bis 6 definieren vor allem Stadtfunktion, Maßstab, Dichte, Urbanismus und Infrastruktur. Ihre glatten fotorealistischen Oberflächen sind **kein** Renderziel. Bilder 7 bis 20 definieren die aktuelle blockartige Geometrie- und Renderwirkung. Alle Cityformen MUST in diese Microvoxelgrammatik übersetzt werden. Die Wüstenebene aus Bild 7 ist eine Motiv- und Formreferenz für seltene xerische Insel-, Salz- oder Regenschattenprofile. Sie ersetzt nicht den kanonischen Archipelcharakter und legitimiert keine großen kontinentalen Wüsten auf Hestia.

## 6. Projekt- und GitHub-Bildklassifikation

### 6.1 Primäre GitHub-Hestia-Referenzen

| GitHub-Pfad | SHA-256 des LFS-Payloads | Zulässige Verwendung |
|---|---|---|
| `docs/UI-Screenshots/23-biom-wald-ressourcen-scan.png` | `8499364ff27b4d720824cc6da938d6a3d21447171083741d553a1f99f032c8a8` | Bodenmaßstab, dunkler Feuchtwald, Scan-/Ressourcenlesbarkeit |
| `docs/UI-Screenshots/30-hestia-biom-atlas-regionen.png` | `3cd183cbf358e7be01ec0af0b09ca22d217ddf8a7f59ff3ce3e6446d8def1336` | Biomvariation und Palettenfamilien, nicht exakte In-World-Darstellung |
| `docs/UI-Screenshots/36-hestia-archipel-landschaft-konzept.png` | `f93b0cb630640fbeaa3b40ff1736366785489b2d493dd164b31d2fe503ca17d3` | Archipel-Makrokomposition, Abendprofil, große Schirmbäume. Polygonale Oberflächen verwerfen. |
| `docs/UI-Screenshots/38-hestia-nebelwald-outpost-konzept.png` | `916aa81f7c09e5f6f063fc910543db4ed708a5301ec27d998096de1f65f1fe1d` | Nebelwald-Mood, Outpost, Klippenmaßstab. Low-Poly-Geometrie verwerfen. |
| `docs/UI-Screenshots/40-surface-expedition-ressourcenspur-scanner.png` | `c7355c36ba6557f0aad35eb64b35328bf31df39bec14999efd743f044734d732` | Spielmaßstab, Lichtung, Expedition und Ressourcenspur |

### 6.2 Bestätigende aktuelle Visual Targets

Die drei Hestia-V2-Referenzpakete enthalten dieselben sechs Zielmotive:

- `target-01-coastal-valley.png`
- `target-02-archipelago-mountain.png`
- `target-03-wetland-roots.png`
- `target-04-terraced-coast.png`
- `target-05-lagoon-channel.png`
- `target-06-forested-island.png`

Sie bestätigen die aktuelle Sprache aus feinen Blockstufen, hellen Kalkterrassen, türkisfarbenem Wasser, Wurzel-/Schirmbäumen, farbigen Pflanzenclustern, Cumulusgruppen und authored Tiefenkomposition.

### 6.3 Sekundäre Biome-Referenzen

| Datei | Behalten | Nicht übernehmen |
|---|---|---|
| `41-hestia-voxel-nebelbruchwald.png` | feuchte Rinnen, Schirmbäume, Nebelprofil | Dioramagrenze, grobes Raster, flache Materialien |
| `42-hestia-voxel-riffterrassen.png` | Lagunenstufen, Korallen-/Fächeridee | grober Blockmaßstab und flaches Licht |
| `43-hestia-voxel-sturmklippen.png` | Basalt, Sturmkanäle, windgerichtete Flora | monotone Ausführung und sichtbare Platte |
| `44-hestia-voxel-sporenmoor.png` | verzweigte Flachwasserarme, Kappen- und Sumpfidee | flache Dioramawirkung |

### 6.4 Runtime Evidence, keine Art Direction

Folgende Klassen dokumentieren technische Zustände:

- `apps/weltraum-browser/evidence/hestia-surface-lab-*.png`
- `.devtoolbox/**/tests/screenshots/**`
- `overview-*`, `ao-level-debug*`, `chunk-seam-ao*`, `concave-corner-ao*`
- Wireframe-, Solid-Cube-, Diagonal- und Checkerboard-Fixtures
- Editor-, Terminal-, Sternkarten- und UI-Prototypbilder

Ein technischer Pass dieser Bilder beweist keinen visuellen Zielpass.

### 6.5 Explizite Negativfamilien

| Familie | Status | Warum verworfen |
|---|---|---|
| b9 | `REJECTED/HISTORICAL` | kleines Debugdiorama, primitive Vegetation, flaches Wasser, leerer Himmel, sichtbare Weltkante |
| d880 | `REJECTED/HISTORICAL` | glattes Low-Poly-/Heightfield-Terrain, beige Leere, primitive Ballbäume, schlechte Spawnkomposition |
| Gate A | `REJECTED/HISTORICAL` | zwar blockig, aber Hochzeitstorten-Terrassen, Lollipop-Bäume, primitive Stäbe, flache Cyanfläche, schlechte Material- und Atmosphärenqualität |

Das Gate-A-Beispiel zeigt, warum „blockig“ allein nicht genügt. Geometriesprache, Material, Hydrologie, Vegetation, Dichte, Komposition und Atmosphäre sind gleichwertige Abnahmedimensionen.

## 7. Konflikt- und Resolution-Matrix

| ID | Konflikt | Frühere Aussage | Resolution v1.0 | Migrationsfolge |
|---|---|---|---|---|
| C-001 | Gesamtstil | `README.md`: browser-based low-poly prototype | Hestia ist fine hard-square microvoxel. Globaler README-Text ist für Hestia visuell veraltet. | Terminologie in produktrelevanten Docs später korrigieren, historische Committexte nicht umschreiben. |
| C-002 | Hestia-Dokument | `hestia-procedural-voxel-world.md` nennt Low Poly | Prozedural-/Authority-Inhalt kann bleiben, visuelles Low-Poly-Ziel ist superseded. | Dokument mit Supersession-Hinweis oder gezielter Änderung aktualisieren. |
| C-003 | Surface-Lab-Audit | faceted low-poly, coherent meshed surface | Kein facettierter oder geglätteter Look. Blocktreue Projektion ist nötig. | Alten Audit als historische Runtime-/Fidelity-Quelle markieren. |
| C-004 | Mesher | Surface Lab nutzt Surface Nets | Mesher ist Projektion, kein Stil. Surface Nets darf nicht die sichtbare Hestia-Form bestimmen. | Blocktreuen Pfad benchmarken. Bestehendes Lab darf als Legacy-Fixture bleiben. |
| C-005 | „Blockig“ | frühe Dioramen oder one-cube-per-voxel | Sichtbare Blockgrammatik ist Pflicht, separater Würfel-Drawcall nicht. | Greedy-, instanzierte oder kompilierte Meshes zulässig, wenn Stufen und Materialsemantik erhalten bleiben. |
| C-006 | Auflösung | 0,25 m, 0,50 m, 0,125 m in verschiedenen Quellen | `0,25 m` ist akzeptiertes Lab-/Asset-v1-Profil. `0,125 m` ist im committed Adaptive-Microvoxel-Authority-Modul scopespezifisch akzeptiert, als sichtbares Hero-/Produktprofil jedoch Kandidat. Universelles Produktprofil ist `OPEN`. | Jede Szene, jedes Asset und jeder Bake deklariert ein benanntes Profil. Keine stille Vermischung. |
| C-007 | Brick-/Chunkkante | 32³ Lab, 16³ adaptive, 8³/64³ Research | Kein universeller Designwert. | Runtimevertrag separat entscheiden. Design fordert unsichtbare Chunkgrenzen bei sichtbarem Zellraster. |
| C-008 | Missing = Air | vollständige Golden-Fixture liest außerhalb Air | Gestreamte Welt führt `missingCoverage`/`unknown`. Nur vollständig bekannte lokale Fixtures dürfen Außenraum als Air definieren. | Coveragezustand in Schemas und Validatoren aufnehmen. |
| C-009 | AO | Block-AO 0 bis 3, Darkness 0,60 | Algorithmische Baseline ist belastbar, 0,60 bleibt `VISUAL-PENDING`. | AO-Gate mit festen Bildern, on/off und Ownerentscheidung. |
| C-010 | Palette | WP04 Testpalette 0 bis 4 | Nur Lab-Fixture, keine Hestia-Artpalette. | Material-IDs/Metadatenmodell übernehmen, finale Paletten pro Biom/City versionieren. |
| C-011 | Stadtbild | aktuelle Bilder sind teilweise fotoreal/glatt | Semantik, Dichte, Funktionsverteilung und Silhouette gelten. Oberflächen werden vollständig microvoxelisiert. | City-Golden in echter Voxelgeometrie neu authored. |
| C-012 | Hestia-Farbe | alter Audit dunkel/petrol, aktuelle Ziele hell | Helles sonniges Küstenprofil ist Default-Golden. Nebelwald bleibt regionales Wetter-/Biomprofil. | Mehrere Lighting Profiles, keines ersetzt die Formgrammatik. |
| C-013 | Wasser | altes Presentation Patch | Hydrologie und Wasserkomposition sind Design-MUST, Runtime-Authority ist `OPEN/IMPLEMENTATION-PENDING`. | Hydrologiecontract und Visual Lookdev getrennt gaten. |
| C-014 | Riff-Megacity | Weltkanon nennt biologische Riff-Megacities | Nicht automatisch technologische Stadt. | Biom und Settlement als getrennte Typen führen. |
| C-015 | GLB | intakte Gebäude können authored GLB-LOD nutzen | GLB darf blocksprachiges Derived Product sein, nie aktuelle geometrische Voxel-Authority. | Source Binding und Structural Semantics verpflichtend. |
| C-016 | Planetterrain | Cube-Sphere/Transvoxel/Regular Cells vorgeschlagen | Planet- und LOD-Verfahren bleiben Research. Visual MUST blocktreue Übergänge zeigen, keine Algorithmusbehauptung. | Algorithmusspikes mit visuellen und semantischen Oracles. |
| C-017 | Noise | Noise als Terrainbasis | Noise ist Feldwerkzeug, keine vollständige Art Direction. | Macro-, Hydrologie-, Geologie-, Biom-, Site- und Assetlayer explizit machen. |
| C-018 | Vegetation | Kugeln, Zylinder, Kegel, dodekaedrische Bäume | Primitive Endformen sind verboten. | Assetfamilien mit Wurzeln, Ästen, Kronenlappen, Connectivity und Habitatregeln. |
| C-019 | Renderengine | Three.js-Referenz gegen offene Enginefrage | Visual Language ist engine-neutral. | Rendereradapter beweist dieselbe Geometrie-/Materialsemantik. |
| C-020 | Citygenerator | chunklokale oder noise-getriebene Erzeugung | Städte werden global als Feature-/Plan-Graph geplant, Chunks materialisieren Crops. | Stable owners, stateless stage seeds, seam oracle. |
| C-021 | Undo | Commit-DAG gegen linearen Sessioncursor | Persistierte Historie bleibt append-only; UI kann linear navigieren. Revert/Reapply sind neue Commands. | Konkretes UI-/Persistenzmodell vor Implementierung einfrieren. |
| C-022 | Autorität | Plan, Settlement, HVOX, Voxelstate | Plan ist Autorität für IDs/Rezept/Semantik. Aktuelle Materialbelegung bleibt Voxelauthority. | Domain Roots atomar, keine zweite Geometriewahrheit. |
| C-023 | KI | freie Generierung und Selbstfreigabe | KI darf schemafähige Proposals liefern, nicht committen oder eigene Goldens freigeben. | Exact Prepared Hash plus menschlicher Approval Record. |
| C-024 | Generated text | Konzeptbilder enthalten Pseudotext | Bedeutungslose Bildschrift ist keine Lore. | Signage aus registrierter Taxonomie, stabile IDs und lokalisierbare Texte. |

## 8. Verbindliches Migrationsregister

### 8.1 Dokumente mit hoher Priorität

| Priorität | Ziel | Maßnahme | Akzeptanz |
|---|---|---|---|
| P0 | `README.md` | Hestia-bezogene Low-Poly-Zielaussage entfernen oder klar scopespezifisch machen. | Kein Leser kann Low Poly als Hestia-Artziel ableiten. |
| P0 | `docs/spielkonzept/hestia-procedural-voxel-world.md` | Visuelle Supersession und Verweis auf VDL ergänzen. | Prozedurale Verträge bleiben, Stilkonflikt ist aufgelöst. |
| P0 | `docs/design-audits/2026-07-14-hestia-surface-lab-visual-target.md` | Als historisch/überholt für Visual Target markieren. | Surface Nets/faceted terrain wird nicht mehr als Ziel gelesen. |
| P0 | Surface-Lab UI/Evidence Docs | Sichtbar `TECHNICAL PROVING GROUND`, `NOT FINAL ART DIRECTION`. | Keine Runtime-Evidence wird zur Art Authority. |
| P1 | `docs/current-mainline-state.md` | Statusgrenze und neue Dokumente verlinken. | Mainline-Status bleibt ehrlich. |
| P1 | `docs/roadmap/living-master-plan.md` | Hero Asset Kit, Hydrologie-, City- und Visual Gates aufnehmen. | Roadmap referenziert serielle visuelle Gates. |
| P1 | Asset-Authoring-Verträge | `visualLanguageVersion`, Scale Profile und Material-/Palettehash ergänzen. | Import kann inkompatible Assets fail-closed abweisen. |
| P1 | City-/Settlement-Research | Gratia City Style Bundle als separate, versionierte Spezifikation ergänzen. | Citylook wird nicht aus Generatornoise abgeleitet. |
| P2 | historische `.devtoolbox`-Changes | Nicht umschreiben, aber im Index als historical/rejected klassifizieren. | Provenienz bleibt erhalten. |
| P2 | Schiffs-/Fahrzeug-Low-Poly-Fallbacks | Separaten Scope-Audit durchführen. | Hestia-Entscheidung wird nicht unbesehen auf fremde technische Proxys übertragen, sichtbare Playerassets folgen aber derselben Blocksprache. |

### 8.2 Code- und Pipelinefolgen

1. Ein neuer Visual Language Identifier MUST in Visual-, Asset-, Worldgen- und Capturemanifeste aufgenommen werden.
2. Ein benanntes Scale Profile MUST jeden produktionsnahen Asset-/Terrain-Bake binden.
3. Ein blocktreuer Renderpfad MUST gegen Surface Nets und grobe Dioramen in festen Kameras verglichen werden.
4. Ein Material-Lookdev-Gate MUST vor weiterer Worldgen-Expansion passieren.
5. Ein Asset-Kit-Gate MUST Signaturbaum, Shore/Cliff, Flora und Materialrollen prüfen.
6. Ein authored Hero-Biome-Gate MUST vor dem Übersetzen in prozedurale Regeln bestehen.
7. Worldgen MUST aus dem freigegebenen Hero-Set messbare Rezepte ableiten, nicht das Zielbild autonom erfinden.
8. Hydrologie, Vegetation, City und Raumhafen benötigen getrennte Goldens und gemeinsame Cross-Domain-Captures.
9. Jede Generator- oder Assetänderung MUST Source Binding, semantischen Diff und Owner- oder Art-Review-Evidence besitzen.

## 9. Offene Entscheidungen

| ID | Entscheidung | Warum offen | Empfohlener nächster Beweis |
|---|---|---|---|
| O-001 | universelles Voxel-zu-Meter-Profil | Quellen belegen mehrere scopespezifische Profile | 0,25/0,125-Heroasset- und First-Person-Vergleich |
| O-002 | finale Chunk-/Brickkante | Design darf Runtimearchitektur nicht erfinden | Scheduler-/LOD-/Persistenzbenchmark nach korrektem Visual Slice |
| O-003 | finale Materialregistry und Paletten | Bilder liefern Familien, keine belastbaren finalen Hexwerte | Materialboard und Ownergate |
| O-004 | finale AO-Stärke | 0,60 nur Startkandidat | feste AO-on/off-Goldens |
| O-005 | Wasser-/Hydrologie-Authority | Look ist klar, Simulationsmodell nicht | isolierter Catchment/Channel/Waterfall-Spike |
| O-006 | Mixed-LOD-Übergang | Fine apron/transition cells nur Research | Close/Mid/Far-Seam-Fixtures ohne Glättung |
| O-007 | Gratia City authored/prozedural-Anteil | Bilder definieren Ziel, Generatorvertrag nur Research | ein kleiner authored Hybrid-District mit fester Seed-Suite |
| O-008 | konkrete Startstadt/Faction | Gameplaykanon lässt sie offen | narrative Ownerentscheidung, getrennt vom Style Bundle |
| O-009 | First-City-Dichte und Startort | dichtes Zentrum, Rand oder Settlement offen | drei annotierte Macroplan-Varianten |
| O-010 | technische Städtezahl und Planetverteilung | Weltkanon trennt Naturbiome und technische Sites | Settlement-/Loreentscheidung |
| O-011 | finale Engine/Renderer | Bake-off nicht entschieden | renderneutrale MeshArtifact-/HVOX-Oracles beibehalten |
| O-012 | Destructible Fluids und großskalige Terrainzerstörung | ungelöste Forschung | separate Research-Gates, nicht durch Art Bible vortäuschen |

## 10. Akzeptanz- und Änderungsprozess

Eine Änderung der VDL gilt nur, wenn sie:

1. eine neue Versionsnummer erhält;
2. die ersetzte Regel und den Grund nennt;
3. betroffene Source-of-Truth-Bilder oder Ownerentscheidungen bindet;
4. Konflikt- und Migrationsregister aktualisiert;
5. Golden Captures mit festem Capture Contract bereitstellt;
6. technische und visuelle Abnahme trennt;
7. von einem benannten Art Owner entschieden wird;
8. keine historische Evidence löscht oder nachträglich als Erfolg umklassifiziert.

Der erzeugende Agent oder Generator MUST sein eigenes visuelles Ergebnis nicht selbst als final freigeben. Metriken MAY Regressionen und Ausreißer markieren, aber sie MUST keinen Art-Pass automatisch erteilen.

## 11. Auditfazit

Die Korpusanalyse liefert eine eindeutige visuelle Richtung und ebenso eindeutige Grenzen:

- **Sicher:** kleine harte quadratische Microvoxels, blocktreue Formen, Macro/Meso/Micro-Komposition, üppige habitatgebundene Vegetation, topologisch lesbares Wasser, helle Küsten- und Archipelmotive, biophile Hard-SF-Städte, engine-neutrale Authority-Trennung.
- **Sicher verworfen:** glattes Low Poly, facettierte Heightfields, Surface-Nets-Look, primitive Ball-/Stabbäume, Noise-only Terrain, Dioramaplatten, flache Cyanwasserflächen, Selbstfreigabe durch Metriken.
- **Noch offen:** universelles Meterprofil, finale Palette, AO-Stärke, Hydrologie-Authority, Planet-LOD-Algorithmus, City-Generatoranteil, konkrete Startstadt und Engineentscheidung.

Die zwei Begleitdokumente machen aus dieser Evidence ein visuelles Regelwerk und einen umsetzbaren Authoring-/Generatorvertrag. Dieses Register bleibt die Stelle, an der jede spätere Abweichung, Entscheidung und Migration nachvollziehbar eingetragen werden muss.
