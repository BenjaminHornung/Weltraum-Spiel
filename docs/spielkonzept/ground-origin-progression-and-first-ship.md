# Spielkonzept: Ground Origin, Progression und erstes Schiff

Stand: 2026-07-13
Status: Verbindliche Docs-only-Planungsgrundlage, keine Runtime-Implementierung

## 1. Verbindliche Produktentscheidung

Der Spieler startet auf Hestia am Boden und besitzt zu diesem Zeitpunkt kein
eigenes Schiff. Das erste eigene Schiff ist ein klarer Progressionsschritt und
schaltet den normalen Space Loop mit Flight, Navigation, Cargo und späteren
interplanetaren Zielen frei.

Dieses Dokument legt bewusst nicht fest:

- welche Quest oder welches Ereignis zum ersten Schiff führt,
- welche Faction beteiligt ist,
- ob das Schiff gekauft, verliehen, geborgen, gebaut oder verdient wird,
- welches konkrete Schiff oder welcher Schiffstyp das erste eigene Schiff ist,
- ob der erste Übergang in den Orbit per Lander, Shuttle, Transfer Pod oder auf
  andere Weise erfolgt.

Diese Entscheidungen gehören in ein späteres Story-/Progressionspaket. Sie
dürfen nicht aus dem aktuell sichtbaren Demo Scout oder einem Assetbestand
abgeleitet werden.

## 2. Authority und Abgrenzung

- [Hestia als prozedurale Microvoxelwelt](./hestia-procedural-voxel-world.md)
  definiert die Startwelt und ihre authored/prozedurale Zusammensetzung.
- [On-Planet First-Person Mode](./on-planet-first-person-mode.md) definiert
  Surface-Interaktion, Suit, Scanner und den späteren Expeditionsloop.
- [Planetary Exploration Loop](./planetary-exploration-loop.md) definiert den
  Rückfluss von Surface-Aktivitäten in Cargo, Wissen, Reputation und Routen.
- [Hard-Sci-Fi Ship Visual Language](./ship-visual-language-hard-sci-fi.md)
  bleibt Authority für die Trennung von orbitalen Hauptschiffen und
  surface-rated Transferfahrzeugen.
- [WorldTemplate und WorldInstance](../architecture/world-template-instance-online-offline-transition.md)
  definieren die persistente Welt- und Spielerinstanz.

Dieses Dokument definiert keine First-Person-Mechanik, kein Ship-Builder-Modell,
keine konkrete Landing-Architektur und keine Hestia-Geografie neu.

## 3. Progressionsphasen

### 3.1 Ground Origin

Zu Beginn gilt:

- der Spieler befindet sich in einer authored Startregion auf Hestia,
- der Spieler besitzt kein `OwnedShipId` und keine aktive Player-Ship-Authority,
- lokale Bewegung, grundlegende Interaktion und ein verständlicher nächster
  Handlungsschritt müssen ohne eigenes Schiff möglich sein,
- Save/Load und Recovery dürfen kein eigenes Schiff voraussetzen,
- die Startregion ist Teil der normalen Hestia-`WorldInstance`, keine
  wegwerfbare Tutorialwelt.

Der sichere lokale Anker kann ein Ort, Service oder Storyzustand sein. Seine
konkrete Form bleibt offen. Ein Schiff darf nicht als unsichtbarer Ersatzanker
angenommen werden.

### 3.2 Lokale Handlungsfähigkeit vor dem Schiff

Der Pre-Ship-Loop muss mindestens beweisen, dass der Spieler:

1. sich in der Startregion orientieren kann,
2. einen lokalen Ort oder Kontakt erkennt,
3. eine einfache Surface-Interaktion ausführt,
4. eine verständliche Zustandsänderung in Semantic State erzeugt,
5. Fortschritt speichern und nach Laden wieder aufnehmen kann,
6. das Ziel „Zugang zum ersten eigenen Schiff“ nachvollziehen kann.

Welche konkrete Probe, Ressource, Reparatur, Mission oder soziale Handlung diese
Schritte trägt, bleibt eine Storyentscheidung. Der Loop darf nicht heimlich
Ship Cargo, Ship Autopilot oder ein bereits vorhandenes Spielerschiff benutzen.

### 3.3 Erwerbsbereitschaft

Vor dem Eigentumsübergang müssen explizite Gates erfüllt sein:

- Der zuständige Progressionsowner bestätigt die fachliche Berechtigung.
- Eine gültige, versionierte Schiffdefinition ist verfügbar.
- Die neue Schiffsinstanz besitzt eine stabile ID und validierbaren Zustand.
- Eigentümer, aktives Schiff und eventuelle Zugangsrechte werden explizit
  gesetzt; Sichtbarkeit oder Nähe reichen nicht als Besitznachweis.
- Ein sicherer Übergabe-, Spawn-, Docking- oder Transferkontext ist aufgelöst.
- Player-, Input-, UI- und Save-State können atomar auf den neuen Besitzstand
  wechseln.
- Bei fehlender oder widersprüchlicher Information bleibt der Spieler im
  Pre-Ship-Zustand und erhält einen sichtbaren Grund. Es gibt keinen stillen
  Fallback auf ein Default-Schiff.

Diese Gates beschreiben den Vertrag, nicht die Storyform des Erwerbs.

### 3.4 Erstes eigenes Schiff

Nach erfolgreicher Übergabe gilt:

- das Schiff ist dauerhaft der Spieleridentität beziehungsweise der aktuellen
  `WorldInstance` zugeordnet,
- der Besitz ist gespeichert, bevor irreversible Abreise oder Cargo-Transfer
  beginnt,
- Flight-, Navigation-, Ship-Cargo- und Ship-Status-Commands werden erst jetzt
  als normale Player-Commands freigeschaltet,
- das erste eigene Schiff führt in den bestehenden Space Loop, ohne dessen
  Physik- oder Autopilotverträge zu verändern,
- spätere Rückkehr nach Hestia nutzt denselben Surface-/Space-Handoff wie andere
  Reisen und keine besondere Tutorial-Abkürzung.

„Erstes eigenes Schiff“ bedeutet Eigentums- und Gameplay-Authority. Es bedeutet
nicht automatisch, dass dieses Hauptschiff direkt auf Hestia landet. Der
Zugang zur Oberfläche bleibt mit Surface Transfer Pods, Landern, Shuttles oder
explizit surface-rated Craft vereinbar.

## 4. Reconciliation bestehender Dokumente

| Bestehende Aussage | Verbindliche neue Lesart |
| --- | --- |
| [Starter-Sonnensystem](./startsystem.md) bezeichnet Hestia als wichtigsten Planeten, aber nicht zwingend ersten Landeort. | Für den Produktstart ist diese Progressionsaussage überholt: Der Spieler startet auf Hestia. Die astronomischen und biologischen Hestia-Fakten bleiben unverändert. |
| [Celestial Runtime Data Contract](./celestial-runtime-data-contract.md) nennt `OrbitOnly` oder `LoadingTransition` als frühe Hestia-Prototypoption. | Diese alte Implementierungsstufung ist keine Produkt-Startentscheidung und beweist keinen Ground Origin. |
| [On-Planet First-Person Mode](./on-planet-first-person-mode.md) beginnt mit Landen, Aussteigen und Rückkehr zum Schiff. | Dieser Loop gilt nach Schiffserwerb oder wenn der Spieler mit fremdem/öffentlichem Transport ankommt. Der Pre-Ship-Loop hat keinen eigenen Ship Anchor. |
| [Planetary Exploration Loop](./planetary-exploration-loop.md) führt Ergebnisse zurück in Schiff oder Ship Cargo. | Vor dem ersten Schiff fließen Ergebnisse in lokalen Semantic State und den Erwerbsfortschritt; danach gilt der normale Space-/Cargo-Rückfluss. |
| [Current Prototype State](../current-prototype-state.md) und der Browser-Port zeigen ein funktionsfähiges Schiff. | Das ist Runtime-/Code-Evidence für Flight und Visual Adapter, kein Beleg für Storybesitz, Startort oder Schiffserwerb. |

## 5. Aktuelle Foundation auf main

Die Browser-Mainline besitzt einen spielbaren lokalen Flight Core, Navigation,
HUD und einen Demo-Scout-GLB-Visual-Adapter. Sie besitzt keinen Ground Origin,
keine Hestia-Surface-Runtime, keinen Spielerzustand ohne Schiff und keinen
implementierten Eigentumsübergang. Der aktuelle Stand ist im
[Living Master Plan](../roadmap/living-master-plan.md) festgehalten.

Der
[Browser / Three.js Mainline ADR](../browser-mainline/adr-0001-threejs-mainline.md)
macht Unity- und Demo-Assets zu Referenz/Evidence, nicht zur Quelle der
Produktprogression. Der
[Browser Port Roadmap](../browser-mainline/port-roadmap.md) belegte Demo Scout
bleibt daher ein Visual-/Flight-Adapter, kein kanonisches erstes Storyschiff.

## 6. Research-Unterstützung und -Grenze

Die vier Research-Audits untersuchen Voxelruntime, Planet-LOD, Meshing/Assets und
WebGL-Observability. Sie liefern keine Evidence für Startquest, Faction,
Erwerbsform oder erstes Schiff. Ground Origin und Schiffserwerb sind
Produktentscheidungen und dürfen nicht als Schlussfolgerung aus einer externen
Referenz dargestellt werden.

Technisch relevant ist lediglich die gemeinsame Grenze: Der Startzustand muss
als Semantic State in der `WorldInstance` existieren und unabhängig vom
Renderer rekonstruierbar sein.

## 7. Failure-, Save- und UI-Regeln

- Recovery vor dem ersten Schiff darf nicht „nächstes eigenes Schiff“ als
  Voraussetzung verwenden.
- Ein abgebrochener oder fehlgeschlagener Erwerb erzeugt keinen halben Besitz:
  entweder der persistente Übergang ist vollständig oder er bleibt aus.
- UI zeigt klar `kein eigenes Schiff`, den nächsten zulässigen Schritt und
  blockierte Ship-Commands.
- Ein sichtbares, gelandetes oder zugängliches Schiff ist nicht automatisch
  Eigentum.
- Save/Load rekonstruiert Pre-Ship-Fortschritt, Erwerbsbereitschaft oder den
  vollständig abgeschlossenen Besitzübergang ohne stillen Statuswechsel.
- Story- und Gameplaystatus werden nicht aus Three.js-Objekten, GLB-Namen oder
  Scene-Hierarchien abgeleitet.

## 8. Spätere Evidence

Ein späterer Vertical Slice muss mindestens nachweisen:

- neuer Spielstand beginnt auf Hestia ohne eigenes Schiff,
- normale Flight-/Ship-Commands sind vor Erwerb nicht verfügbar,
- lokaler Fortschritt übersteht Save/Load,
- der Erwerb schlägt bei ungültiger Definition, ID, Übergabeposition oder
  Persistenz sichtbar und ohne Teilzustand fehl,
- erfolgreicher Erwerb setzt stabile Ownership und Active-Ship-State genau
  einmal,
- nach Erwerb nutzt der Spieler denselben Flight-/Navigation-Core wie andere
  Spielstände,
- der Demo Scout wird nicht allein wegen seines vorhandenen Adapters zum ersten
  Storyschiff erklärt.

## 9. Offene Produktentscheidungen

- konkrete Startregion, Siedlung oder Story-Hotspot,
- Pre-Ship-Story und genaue Erwerbsform,
- beteiligte Faction oder unabhängige Quelle,
- konkreter erster Schiffstyp und seine Ausstattung,
- Transfer von Hestia zum Schiff beziehungsweise in den Orbit,
- Recovery-/Failure-Regel vor eigenem Schiff,
- Umfang und Dauer des Pre-Ship-Loops.

Diese Entscheidungen werden später in `Story Normalization` und einem eigenen
Ground-Origin-/First-Ship-Vertical-Slice konkretisiert.
