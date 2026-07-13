# Universe Sector Placement und BirthCluster

Stand: 2026-07-13
Status: Verbindliche Docs-only-Planungsgrundlage, keine Runtime-Implementierung

## 1. Zweck und Authority

Dieses Dokument definiert die Grenze, über die ein zunächst privates
Heimatsystem später als `BirthCluster` in eine gemeinsame Galaxie aufgenommen
werden kann. Es definiert keine Galaxiegeneration, kein Netzwerkprotokoll und
keine fertige Allokationsimplementierung.

Die Inhalte von Aurelia und Hestia bleiben in
[Starter-Sonnensystem](../spielkonzept/startsystem.md) und
[Hestia als prozedurale Microvoxelwelt](../spielkonzept/hestia-procedural-voxel-world.md)
kanonisch. Die Trennung von privater Vorlage und veränderlicher Weltinstanz
gehört in
[WorldTemplate und WorldInstance](./world-template-instance-online-offline-transition.md).
Hierarchische Positionen und Frames bleiben in
[Coordinate Spaces And Floating Origin](./coordinate-spaces-and-floating-origin.md)
autorisiert.

## 2. Verbindliche Zielentscheidungen

- Das private Heimatsystem kann später als `BirthCluster` in die gemeinsame
  Galaxie überführt werden.
- Nur Sektoren, die von der Allocation Authority als `uncommitted` oder
  `unobserved` klassifiziert wurden, kommen überhaupt als Kandidaten in Frage.
- Die formale AND-/OR-Auswertung dieser Klassifikationen wird nicht in diesem
  Dokument geraten. Bis das Paket `Birth Cluster Allocation` sie festschreibt,
  entscheidet ausschließlich ein explizites, fail-closed Eligibility-Ergebnis
  der Allocation Authority.
- Unbekannte, veraltete, widersprüchliche oder nicht beweisbare
  Sektorklassifikation ist nicht zulässig und führt zu keiner Platzierung.
- Bereits beobachtete oder festgeschriebene Fakten werden nicht zurückgesetzt,
  um Platz für einen `BirthCluster` zu schaffen.
- Umliegende unentdeckte Systeme bilden nach der Allokation eine temporäre
  Pufferzone.
- Die Pufferzone ist nicht dauerhaft. Nach Freigabe können andere Spieler den
  Cluster und seine Umgebung über normale Discovery-Regeln entdecken.
- Globaler Observation-/Commit-State ist von der persönlichen Discovery jedes
  Spielers getrennt.
- Hidden-Sector-Interest-Management ist eine Authority-/Streaming-Grenze und
  keine zweite Welt oder renderbasierte Geheimhaltung.

## 3. Begriffe

| Begriff | Bedeutung |
| --- | --- |
| `GalaxySector` | Stabil adressierbare Platzierungs- und Authority-Einheit der gemeinsamen Galaxie. |
| Allocation Authority | Einziger Owner für Kandidatenklassifikation, Reservation, Commit und Veröffentlichung. |
| Global Observation State | Autoritativer Beleg, ob ein Sektor in einer Weise beobachtet wurde, die nachträgliche Platzierung einschränkt. |
| Global Commit State | Autoritativer Beleg, ob Inhalt, Identität oder Verlauf eines Sektors bereits festgeschrieben wurde. |
| Player Discovery State | Spielerbezogenes Wissen wie unbekannt, detektiert, besucht oder kartiert; keine Allokationsautorität. |
| `BirthCluster` | Versionierte Gruppe eines Heimatsystems und der für seine Einführung benötigten Platzierungs-/Storybindungen. |
| Temporäre Pufferzone | Zeitlich oder zustandsgebunden reservierte Menge umliegender, noch unentdeckter Systeme. |
| Story Normalization | Versionierter Prozess, der private Vorgeschichte und gemeinsamen Galaxiekontext widerspruchsfrei aufeinander abbildet. |
| Hidden Sector Interest | Server-/Authority-Entscheidung, welche Sektordaten ein Client oder eine Simulation aktuell erhalten und materialisieren darf. |

`Aurelia-System` bleibt ein Arbeits- beziehungsweise Anzeigename. Technische
Identität verwendet stabile IDs und darf nicht aus Anzeigenamen, Dateipfaden
oder Positionen abgeleitet werden.

## 4. Fail-closed Eligibility Gate

Ein Sektor wird nicht durch einen Client, Renderer, lokalen Cache oder eine
einzelne Spieler-Discovery als geeignet erklärt. Die Allocation Authority muss
ein versioniertes Ergebnis liefern, das mindestens enthält:

- stabile Sector-ID,
- Klassifikationsrevision und Erfassungszeit beziehungsweise Epoch,
- Commit- und Observation-Evidence oder referenzierbare Gründe,
- explizites `eligible` oder strukturiertes Rejection-Ergebnis,
- Reservation-/Lease-Status,
- erwartete Cluster-, Template- und Instance-Identitäten,
- Ablauf- oder Revalidation-Bedingungen.

Bis `Birth Cluster Allocation` die formale Kombination von `uncommitted` und
`unobserved` festschreibt, gilt:

```text
Kein explizites aktuelles Eligibility-Ergebnis
  -> keine Reservation
  -> keine Platzierung
  -> keine Story- oder WorldInstance-Mutation
```

Damit wird weder eine OR- noch eine AND-Semantik vorweggenommen. Die
Kandidatenbegriffe begrenzen den Suchraum; die explizite Authority-Entscheidung
ist das einzige Platzierungsgate.

## 5. Geplanter Allokationsablauf

1. Eine private `WorldInstance` beantragt einen Import als `BirthCluster`.
2. Template-, Instance-, Schema-, Generator- und Storyversionen werden
   validiert.
3. Die Allocation Authority ermittelt Kandidatensektoren und liefert für jeden
   ein fail-closed Eligibility-Ergebnis.
4. Ein geeigneter Sektor wird atomar reserviert; parallele Allokationen dürfen
   dieselbe Reservation nicht gewinnen.
5. `Story Normalization` erzeugt einen prüfbaren Normalisierungsplan, ohne
   private Fakten still zu löschen.
6. Das Cluster wird mit stabilen IDs und einem expliziten Placement-/Frame-
   Binding importiert.
7. Die umliegende temporäre Pufferzone wird als Authority-State angelegt.
8. Erst nach vollständiger Validierung wird das Cluster veröffentlicht.
9. Puffer- und Hidden-Interest-Regeln werden später kontrolliert freigegeben;
   danach greift normale Discovery.

Fehlschlag vor Veröffentlichung lässt die private `WorldInstance` unverändert
und erzeugt keinen teilweise sichtbaren Cluster.

## 6. Temporäre Pufferzone

Die Pufferzone soll verhindern, dass gleichzeitig generierte oder bereits
bekannte Nachbarschaft den frisch importierten Heimatsystemkontext unmittelbar
widersprüchlich macht. Sie ist keine permanente Exklusivzone.

Ein Pufferdatensatz braucht mindestens:

- stabile Buffer-ID und zugehörige `BirthCluster`-ID,
- betroffene Sector-IDs oder eine versionierte Auswahlregel,
- Beginn, Revision und Freigabezustand,
- Begründung und Owner,
- Revalidation bei neuer Observation oder neuem Commit,
- explizite Release-Bedingungen.

Offen bleiben Form, Radius, Dauer und Freigabeereignis. Diese Werte dürfen nicht
aus Renderdistanz oder LOD abgeleitet werden.

## 7. Observation, Discovery und Story Normalization

Globale Observation und persönliche Discovery beantworten verschiedene Fragen:

- Global Observation: Darf die Allocation Authority hier noch neue kanonische
  Inhalte platzieren?
- Player Discovery: Was weiß dieser Spieler über bereits existierenden Inhalt?

Andere Spieler dürfen den veröffentlichten `BirthCluster` später normal
entdecken. Die Freigabe erzeugt keine rückwirkende Kenntnis und entfernt keine
bereits erworbenen Discovery-Fakten.

`Story Normalization` muss private und gemeinsame Zeitlinie, Factions,
Benennungen, Entdeckungen und Storyflags versioniert abgleichen. Sie darf keine
neuen kanonischen Hestia- oder Aurelia-Fakten erfinden. Konkrete
Normalisierungsregeln bleiben dem Paket `Story Normalization` vorbehalten.

## 8. Hidden Sector Interest Management

Hidden Sector Interest Management entscheidet, welche Daten für Simulation,
Netzwerk und Streaming aktuell relevant oder sichtbar sind. Es muss:

- server-/authority-owned sein,
- stabile Sector-/Cluster-IDs verwenden,
- Player Discovery und Zugriffsrechte berücksichtigen, ohne sie zu ersetzen,
- unbekannte oder nicht autorisierte Sektordaten nicht vorzeitig materialisieren,
- Revalidation bei Bewegung, Route, Beobachtung und Buffer-Freigabe auslösen,
- keine semantische Wahrheit aus Three.js-Culling oder Kamera-Sichtbarkeit
  ableiten.

Der konkrete Relevanzalgorithmus, Datenschutz und Anti-Leak-Nachweis gehören in
das spätere Paket `Hidden Sector Interest Management`.

## 9. Stable IDs und Platzierungsbindung

Template-, Instance-, System-, Body-, Hotspot- und Entity-IDs bleiben beim
Import stabil. Eine galaxieweite Position oder Sector-ID wird als neue Bindung
ergänzt und ersetzt keine interne Identität.

Bei einer Kollision gilt fail closed:

- keine stillen ID-Umbenennungen,
- kein Überschreiben einer vorhandenen Instanz,
- kein Ableiten neuer IDs aus Anzeigenamen,
- explizites Remapping nur über einen versionierten, prüfbaren Migrationsplan.

## 10. Aktuelle Foundation auf main

Vorhanden sind Stable-ID-, Snapshot-, Frame-, Chunk-/Residency- und
rendererunabhängige World-Presentation-Grundlagen. Nicht vorhanden sind
Galaxiesektoren, Allocation Authority, `BirthCluster`, globale Observation-/
Commit-States, Bufferzonen, Story Normalization oder Hidden-Sector-Interest-
Management. Der Status bleibt im
[Living Master Plan](../roadmap/living-master-plan.md) offen beziehungsweise
Research.

Die
[Browser Mainline Architecture](../browser-mainline/browser-architecture.md)
belegt nur die Trennung von World Truth und Rendererprojektion. Sie ist kein
Beleg für galaktische Allokation.

## 11. Research-Unterstützung und -Abwesenheit

Die vier abgeschlossenen Research-Audits untersuchen Voxelruntime, Planet-LOD,
Meshing/Assets und WebGL-Tooling. Keiner von ihnen beweist eine belastbare
BirthCluster-Allokation, Story-Normalisierung oder Online-Authority. Die hier
festgelegte Richtung ist eine Produktarchitekturentscheidung; externe
Referenzen dürfen nur spätere Teilprototypen unterstützen.

## 12. Spätere Evidence

- parallele Reservationen können denselben Sektor nicht doppelt committen,
- stale, unknown oder widersprüchliche Eligibility wird sichtbar abgelehnt,
- Importfehler hinterlassen weder Clusterfragment noch Bufferfragment,
- stabile IDs und interne Frames überstehen die neue Galaxy-Platzierung,
- Global Observation und Player Discovery verändern einander nicht implizit,
- Buffer-Freigabe macht den Cluster normal entdeckbar,
- Hidden-Interest-Filter ändern keine World Truth und leaken keine verborgenen
  Sektordaten über Telemetrie oder Renderdaten.

## 13. Offene Entscheidungen

- formale AND-/OR-Semantik für `uncommitted` und `unobserved`,
- Quelle und Unwiderruflichkeit globaler Observation-/Commit-Evidence,
- Reservation-/Lease-Protokoll und Concurrency-Modell,
- Form, Größe, Dauer und Release-Bedingungen der Pufferzone,
- genaue Story-Normalisierungsregeln,
- Zeitpunkt, ab dem andere Spieler den Cluster entdecken können,
- Interest-Management-, Privacy- und Anti-Leak-Vertrag.

Diese Entscheidungen werden in `Birth Cluster Allocation`,
`Story Normalization` und `Hidden Sector Interest Management` geschlossen,
nicht durch implizite Clientlogik.
