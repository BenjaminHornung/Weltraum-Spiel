# B: Restprogramm und neue Ausführungsreihenfolge

## B00: Recovery, Vollständigkeit und funktionierender Launcher

Alle eigenen Altwriter/Nachkommen kontrolliert ablösen, besonders RD13-WIP sichern. Gepushten Stand16a5d29… und lokale neuere Blattstände getrennt erfassen; nur gültige, reviewte Deltas übernehmen. Originale52-Paketdateien und eingefrorene Quelldaten nicht umschreiben.

Prüfe die vorhandenen Run-/Build-/Testbefehle. Das Labor-package.json enthält PowerShell-Syntax und absolute C:-Programmpfade. Verwende entweder die tatsächlich dafür konfigurierte Shell oder explizite vorhandene Binärdatei plus Argumente. Ein neuer Codex-Default-Shell darf diese Befehle nicht still falsch auswerten. Keine globale npm-/PowerShell-/Paseo-Reform. Minimaler eigener Launcher nur bei belegter Notwendigkeit, HEAD-owned und getestet.

Bestandstest: Typecheck, Unitpopulation, Build, Scopeguard, eine echte Kontrollszene. Keine qualifizierte GPU-Serie während A seine Nativeprüfung ausführt. Erstelle genau einen aktuellen Statusindex mit Quelle und jeweils letzter gültiger Phase, statt historische HANDOFF.md-Überschriften zu überschreiben.

## B01: Medien-/Oracle-Lücken konkret schließen

RD01: sieben Redditreferenzen, sechs Konzeptziele und fünf gemeldete PNG-LFS-Pointer getrennt auflösen. LFS-Payloads anhand OID/Größe und erfolgreicher Bilddecodierung prüfen. Pointertext ist kein Bild. 44 erfolgreich übertragene LFS-Objekte beweisen nicht, dass alle benötigten Medien verfügbar sind.

Vorhandene Originalkonzepte aus Paket/Repo/autorisiertem Inputbereich verwenden. Fehlende Redditvideos nicht imaginieren. Zugriffsversuche begrenzen, schriftliche Entwickleraussage nicht als Filmsichtung ausgeben. Fehlende Medien sperren deren stilistische Abnahme, nicht unabhängige synthetische Techniktests.

RD11 REN12 nach 02_ORACLE_KORREKTUR reparieren. RD12 verbleibende vier Fälle anhand tatsächlicher Fehlertypen klassifizieren: Capability nicht vorhanden, Oracle unzureichend, Produktfehler des Adapters oder Umgebungsfehler. Native Buffer-/Depth-Nachweis nicht durch CPU-Fakes ersetzen. Ggf. explizit nicht adoptieren.

RD13 aktuelle Nativeprüfung auswerten oder auf gebundenem neuen Build ausführen. Kein Verlust laufender Blattarbeit. Festhalten, was Ray-/Greedyvergleich tatsächlich zeigt; gleiche Quelle, Kamera, Qualität, Änderungen/Uploads und Depthkomposition. Keine „null Dreiecke“-Gewinnerlogik.

## B02: Kontrollpfad zuerst lebendig machen

Nach verifizierten RD00–03/RD10 können folgende Schienen unabhängig vorbereitet werden. Ihre shared-contract Änderungen werden nur durch HEAD aktiviert:

- RD20 Pflanzen/Habitat → RD21 Wind → RD23 Lebenszyklus.
- RD30 gemeinsamer Wetterinput → RD31 Regenabschattung.
- RD14 Material/Licht → gemeinsam mit RD30/RD31 RD32 Nässe/Wasser.
- RD15 Kameraverdeckung.

Dies ist eine Priorisierung innerhalb des Original-DAG, kein Überspringen von Abhängigkeiten. Eine synthetische frühe Kombination ist Arbeitsdemo, noch kein RD51-Abnahmebeleg.

### RD20: Pflanzen/Habitat

Vorhandene Fixtures und semantische Holz-/Dekortrennung wiederverwenden. Wenige charakteristische Wurzel-/Kronen-/Bodenbewuchsvarianten, Cluster und Freiflächen statt flächigem Zufallsstreuen. Gleicher Seed und gleiche Parameter liefern dieselbe Source. Ganze Pflanzenpopulation und Bounds prüfen; keine neue Produktvegetation. Bei fehlenden Bildern technisch nachvollziehbare PROVISIONAL-Artprofile, keine Konzepttreue erfinden.

### RD21: Wind

Erste Variante: kompakte blocktreue starre Dekorcluster mit Windphase/Steifigkeit, zweite begrenzte Vertexvariante nur für Dekor als Gegenprobe. Stämme nicht kosmetisch von ihrer festen Kollision wegbiegen. Ein gemeinsamer Simulations-/Präsentationszeitinput, Pause/Seek/Reset reproduzierbar. Keine per-Frame-Bufferneubauten oder Vertexobjektflut; vorab allozierte Zustände und gemessene Änderungsupdates.

### RD23: Attachment/LOD/Source

Bewegte Pflanze → geänderter eingefrorener Source → abgetrennter Owner → neue Pose → LOD-Wechsel → Reload. Entfernte Dekoration darf nicht durch den nächsten Windframe wiederkehren. Bounds/Schatten, Ownerframe, origin shift, stale Ergebnisse, dispose/remount prüfen. Das bleibt Snapshot-Replay, nicht echter A0-Cutbeweis.

### RD30/RD31: Wetter und Regen

Gemeinsamer kontrollierter Wetter-/Windinput statt unabhängiger Uhren. Regenabschattung mit mindestens den ursprünglichen Gegenkandidaten vergleichen: Regenrichtungsprojektion und begrenzte gebündelte Sourceabfragen. Gegenfälle: zwei Dächer, Überhang, Höhleneingang, offscreen Schutz, schräger Regen, entfernte Dachzellen, beweglicher Schutzkörper, fehlende Abdeckung. Regen darf nicht durch ein geschlossenes Dach fallen oder beim Öffnen überall neu benetzen.

### RD14/RD32: Material, Licht, Nässe/Wasser

Wenige erkennbare Materialrollen, Öffnung eines schattigen Bereichs, aktualisierte Licht-/Oberflächenwirkung. Gemeinsamer Materialbesitz: Wind-/Nässe-/Verdeckungsbeiträge dürfen nicht gegenseitig onBeforeCompile/TSL ersetzen. Keine universelle Shader-Pluginengine. Nässe benetzt/trocknet auf richtiger Source-/Ownerfläche; gedrehte Fragmente bleiben konsistent. Wasserreaktion kosmetisch, keine erfundene Masse/Reibung/Erosion oder Fluidphysik.

### RD15: Kamera

Push-in gegen lokale Sichtfreistellung vergleichen, Wurzeln/enge Räume/Felswand. Kamera darf Darstellung freistellen, aber keine Worldzellen, Treffer oder Durchgänge verändern. Keine halb abgeschnittenen Artefakte als Erfolg; tatsächliche Szene/Capture und Wahrheitsgrenzen prüfen.

## B03: Benutzbare Werkzeuge an dieselben Module binden

RD40 vorhandene Galerie beibehalten und neue Resultate darin referenzieren, nicht neu bauen.
RD41 Habitat-/Foliagepresetwerkbank: Parameter ändern → echte Vorschau → validiertes reproduzierbares Labpreset exportieren/importieren. Keine zweite Generatorlogik im UI.
RD42 Wetter-Tuner/Scrubber: gleiche Wetter-/Sourcezeitachse, Play/Pause/Seek/Reset, reproduzierbarer Ex-/Import, fehlerhafte/alte Presets verständlich ablehnen.
RD43 Asset-/Attachment-Inspector: Source, Derived-Mesh, Materialien, Support, Ownerframe, Bounds, Budget getrennt zeigen. Nicht aus Render-UUID eine fachliche ID machen. Keine produktive HVOX-/Agent3-Integration, solange diese Grenze nicht separat freigegeben wurde.

Werkzeuge müssen im Produktionsbuild über dokumentierte URLs tatsächlich startbar sein. Den bestehenden Gallery-Download nicht als finales Gesamtarchiv weiterreichen.

## B04: RD50 und RD51 zusammenhängend qualifizieren

RD50 unabhängig und schrittbegleitend: Source-/Scope-/Clock-/Owner-/Lifecyclebeweise und negative Cases. Realer Browserbackendtyp, Fallback, Format/Alpha/MSAA und Grenzen sichtbar halten. Kein GPU-Wert aus CPU-Simulation. Alle unabhängigen Reviewer dürfen direkt und frisch gestartet werden; keine Pflicht zur Wiederbelebung alter SO-Sessions.

RD51 erst mit akzeptierten Abhängigkeiten: EIN Canvas, EIN Renderer, EIN Renderloop. Klare Küste → Brise → Regen → Schutzraum → Dachöffnung → Source-Detach mit Dekor → Pause/Seek → Reload. Exakte Source-/Frame-/Weatherbindings und sichtbare Funktionen bestätigen.

Pflichtgegenfälle: Materialhook-Kollision, alte Wetterdaten, staleOwner, laufender Regen nach Dispose, doppelte RAFs, verschwundene/duplizierte Dekoration, rückwärts Seek. Mindestens die ursprüngliche 100-Wechsel-Lifecyclepopulation, ohne versteckten Full-page-reset als Reinigung. Gesamtressourcen einschließlich gleichzeitiger alter/neuer Produkte messen, nicht isolierte Bestwerte addieren.

## B05: Qualifizierte Vergleiche und RD52-Abschluss

Vergleiche nur fachlich und visuell gleichwertige Varianten. Kontrollgeräte, Browser, Backend, Qualität, DPR, Auflösung, Cold/Warm, Last und Sourcefreeze binden. A hat Vorrang am qualifizierten Messgerät. Synthetische VM-Zahlen bleiben Diagnose.

Alle23 Kernkarten brauchen terminale Ergebnisse. Für Vergleichskandidaten sind ADOPT_CANDIDATE, REJECT und DEFER mit vollständiger Ursache/Evidenz erlaubt. Pflichtfunktionen und Werkzeuge müssen tatsächlich implementiert und gemeinsam benutzbar sein. RD22-Voxelanimationsframes und RD33-Schnee können explizit NOT_STARTED_OPTIONAL bleiben.

Finale Matrix verbindet Effektqualität, Änderungs-/Uploadkosten, CPU/GPU/Speicher, Startup, Fehlermodi, Wartung und Migrationsaufwand. KISS bei Gleichstand. „Three bleibt“ ist ein zulässiges Ergebnis, kein Misserfolg des Programms.

Plannerarchiv: frischer Gesamtbuild, Start-/Stopanleitung, URLs, sichtbare kombinierte Strecke, alle Ergebnisverweise/Quellen/Originalnegative/Rohdaten, Bild-/Clipsidecars, reproduzierbare Presets, Scope-/Privacybeleg, Checksummen und konkrete spätere kleine Übernahmekarten. Externe Referenzmedienrechte nicht durch Kopieren ins öffentliche Archiv umgehen. Menschliche ART-Entscheidung bleibt getrennt.
