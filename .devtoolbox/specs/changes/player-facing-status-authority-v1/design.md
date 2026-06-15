# Design: Player-Facing Status Authority v1

## 1. Kernprinzip

Jeder Spieler-Status hat genau einen **Authority Owner** — das System, das die
Wahrheit berechnet und freigibt. Alle UI-Oberflächen (Ship HUD, System Map, Local
Map, Suit HUD, Terminal) sind **Views**: sie lesen vom Authority Owner, berechnen
keine eigene Wahrheit und zeigen Status, Gründe und nächste Aktion.

```text
Authority Service  →  Status Snapshot (Codes + Werte)
                         ↓
View (HUD/Map/Suit/Terminal)
  - übersetzt Codes in Spieler-Texte
  - zeigt Warnchips nach Taxonomy
  - zeigt nächste Aktion
  - zeigt Debug-Werte nur im Debug-Layer
```

Eine View darf niemals:

- eigene ETA-, Fuel- oder Risiko-Berechnung durchführen,
- einen anderen Status überschreiben als der Owner liefert,
- Debug-IDs im Player-Layer anzeigen,
- stille Wahrheiten produzieren, die der Authority Owner nicht kennt.

## 2. Status Ownership Matrix

Legende: **O** = Owner (berechnet Wahrheit), **R** = Read-only View (zeigt nur).

### Navigation Computer

| Status | Owner | Beschreibung |
| --- | --- | --- |
| Route Validity | Navigation Computer / Autopilot Supervisor | Plan ist gültig, nicht invalidiert, nicht expired. |
| ETA | Navigation Computer / RoutePlan | Geschätzte Ankunftszeit aus immutable Plan. |
| Fuel Estimate | Navigation Computer / FuelPolicy + RoutePlan | Verbrauchter Treibstoff und Reserve nach Brake. |
| Brake Reserve | Navigation Computer / RouteValidator | Δv-Reserve nach Bremsung vorhanden. |
| Arrival State | Autopilot Executor / AutopilotTelemetry | Idle / EnRoute / TerminalCapture / Hold / Complete. |
| Authority Warnings | Navigation Computer / RouteValidator | LimitedAuthority / NoAuthority / RCS-insufficient. |
| Plan Invalidated / Needs Replan | Autopilot Supervisor | PlanHash ungültig; kein stilles Replan; sichtbarer NeedsReplan-Status. |

Views, die Navigation-Status lesen: Ship HUD (compact), System Map (route preview),
Navigation Computer Panel (full), Terminal (docked status strip).

### Cargo Service

| Status | Owner | Beschreibung |
| --- | --- | --- |
| Mass / Volume | Cargo Service | Aktuelle und maximale Masse/Volumen pro Container. |
| Transfer Feasibility | Cargo Service | Kann Transfer source→target durchgeführt werden (Kapazität, Containment)? |
| Containment | Cargo Service | Ressource in zulässigem Container (z. B. keine heiße Ressource in Standard-Cargo). |
| Cargo too heavy | Cargo Service + Ship Authority | Masse überschreitet Schifflimit; beeinflusst Flight Authority. |

Views, die Cargo-Status lesen: InventoryCargo Modal, Terminal, Suit HUD (suit mass),
Ship HUD (cargo mass compact), Drone Command (drone cargo).

### Scanner

| Status | Owner | Beschreibung |
| --- | --- | --- |
| Detection Confidence | Scanner Service | Niedrig/Mittel/Hoch — wie zuverlässig ist die Detektion. |
| Local Hazard Observations | Scanner Service | Beobachtete Hazards im Scan-Radius (Dust, Radiation, Hostile, Debris). |
| Observed Ownership Hints | Scanner Service | Faction/Owner-Hinweis mit Confidence (keine garantierte Wahrheit). |

Views, die Scanner-Status lesen: Suit HUD (scanner overlay), Ship HUD (proximity
warning), Local Map/Radar (hazard/owner markers), Surface Interaction Prompt.

Regel: Scanner-Ergebnisse sind **Beobachtungen mit Confidence**, keine garantierte
Wahrheit. Faction/Legal Service ist der Owner für verbindliche Legalität.

### Faction / Legal Service

| Status | Owner | Beschreibung |
| --- | --- | --- |
| License / Permit | Faction/Legal Service | Hat der Spieler die nötige Lizenz für diese Aktion? |
| Action Legality | Faction/Legal Service | Ist die Aktion in dieser Zone/legal für diesen Spieler legal? |
| Enforcement Risk | Faction/Legal Service | Wahrscheinlichkeit/Level von Konsequenzen bei illegaler Aktion. |

Views, die Faction/Legal-Status lesen: Surface Interaction Prompt, Terminal,
InventoryCargo (legal/illegal marker), System Map (zone overlay).

Regel: Legalität ist autoritativ vom Faction/Legal Service. Scanner-Ownership-Hints
sind nur Hinweise und dürfen Legalität nicht selbst festlegen.

### Ship Authority / Flight Assist

| Status | Owner | Beschreibung |
| --- | --- | --- |
| Flight Authority (RCS/SAS/Thruster) | Ship Authority / Flight Assist | Hat das Schiff ausreichend Steuerautorität? |
| Autopilot State | Autopilot Executor / Telemetry | Idle / Planning / Ready / Executing / Blocked / Canceled / Invalidated. |
| Manual Override | Ship Authority | Wurde der Autopilot manuell übersteuert? |

Views: Ship HUD (compact), Navigation Computer Panel (full), System Map (route
status strip).

### Suit / Vitals Service

| Status | Owner | Beschreibung |
| --- | --- | --- |
| Health / Suit Integrity | Suit/Vitals Service | Suit-Integrität, Sauerstoff, Energie, Temperatur/Strahlung/Druck. |
| Tool Status | Suit/Vitals Service | Aktives Tool, Tier, Readiness. |
| Ship Beacon | Suit/Vitals Service | Position und Status des gelandeten Schiffs. |

Views: Suit HUD (full), Ship HUD (nur wenn pilotiert), Drone Command (compact).

## 3. Warning Chip Taxonomy

Warnchips sind sofort erkennbare, aktionsfähige Risiken. Jeder Chip hat genau
einen **Owner-Service**, der ihn auslöst, eine **Severity** und eine
**Spieleraktion**.

| Chip-Code | Owner | Severity | Spieleraktion |
| --- | --- | --- | --- |
| `NAV_FUEL_INSUFFICIENT` | Navigation Computer | Critical | Refuel oder Route kürzen. |
| `NAV_NO_AUTHORITY` | Navigation Computer / Ship Authority | Critical | RCS/Thruster prüfen, Schiff reparieren. |
| `NAV_NO_BRAKE_RESERVE` | Navigation Computer | Critical | Route kürzen oder Geschwindigkeit reduzieren. |
| `NAV_PLAN_INVALIDATED` | Autopilot Supervisor | High | Neuen Plan erstellen (Replan). |
| `NAV_UNSAFE_TARGET` | Navigation Computer | High | Ziel prüfen (Planet/Clearance). |
| `NAV_LIMITED_AUTHORITY` | Navigation Computer | Medium | Vorsichtig manövrieren, Authority beobachten. |
| `CARGO_TOO_HEAVY` | Cargo Service | High | Masse reduzieren (Cargo transfer/abwerfen). |
| `CARGO_TRANSFER_BLOCKED` | Cargo Service | Medium | Kapazität/Containment prüfen. |
| `CARGO_CONTAINMENT_VIOLATION` | Cargo Service | High | Ressource in zulässigen Container umladen. |
| `SCAN_HAZARD_LOCAL` | Scanner Service | Medium/High | Hazard meiden. |
| `SCAN_CONFIDENCE_LOW` | Scanner Service | Low | Näher scannen oder vorsichtig sein. |
| `LEGAL_NO_LICENSE` | Faction/Legal Service | High | Lizenz erwerben. |
| `LEGAL_ILLEGAL_ACTION` | Faction/Legal Service | Critical | Aktion abbrechen oder Konsequenz akzeptieren. |
| `LEGAL_ENFORCEMENT_RISK` | Faction/Legal Service | Medium | Risiko akzeptieren oder abbrechen. |
| `SHIP_AUTOFIRE_BLOCKED` | Ship Authority | Low/Medium | Ziel in Arc bringen, Cooldown abwarten. |
| `SUIT_OXYGEN_LOW` | Suit/Vitals Service | Critical | Zum Schiff/Outpost zurückkehren. |
| `SUIT_HAZARD_EXPOSURE` | Suit/Vitals Service | High | Gefahrenzone verlassen. |
| `SUIT_INTEGRITY_CRITICAL` | Suit/Vitals Service | Critical | Reparatur suchen. |

Severity-Regeln:

```text
Critical = Aktion blockiert oder unmittelbare Gefahr; sofort sichtbar.
High     = Aktion riskant oder eingeschränkt; prominent sichtbar.
Medium   = Warnung, Aktion möglich aber mit Risiko.
Low      = Hinweis, keine Blockade.
```

Eine View darf Warnchips nur aus dem Authority-Snapshot rendern, nie selbst
berechnen. Eine View darf die Severity nicht verändern.

## 4. Failure Reason Taxonomy

Wenn eine Aktion blockiert wird, zeigt die UI einen Failure-Reason-Code, den
Player-Text und die nächste Aktion. Codes kommen vom Authority Owner.

| Code | Owner | Player-Text (Beispiel) | Nächste Aktion |
| --- | --- | --- | --- |
| `ROUTE_TARGET_INSIDE_BODY` | Navigation Computer | "Ziel liegt innerhalb eines Planeten/Mondes." | Ziel verschieben. |
| `ROUTE_FUEL_INSUFFICIENT` | Navigation Computer | "Nicht genug Treibstoff für diese Route." | Refuel oder Route kürzen. |
| `ROUTE_NO_BRAKE_RESERVE` | Navigation Computer | "Keine Bremsreserve nach Ankunft." | Route kürzen. |
| `ROUTE_CLEARANCE_VIOLATION` | Navigation Computer | "Route verletzt Clearance um Bauwerk/Zone." | Route anpassen. |
| `ROUTE_NO_AUTHORITY` | Navigation Computer / Ship Authority | "Schiff hat keine Steuerautorität (RCS/Thruster)." | Schiff reparieren. |
| `ROUTE_TIMEWARP_UNSTABLE` | Navigation Computer | "Route ist bei Timewarp nicht deterministisch." | Route vereinfachen. |
| `PLAN_INVALIDATED_OBSTACLE` | Autopilot Supervisor | "Plan ungültig: neues Hindernis erkannt." | Neuen Plan erstellen. |
| `PLAN_INVALIDATED_FUEL` | Autopilot Supervisor | "Plan ungültig: Treibstoff erschöpft." | Refuel, dann Replan. |
| `CARGO_CAPACITY_FULL` | Cargo Service | "Zielcontainer ist voll." | Anderen Container wählen oder ablegen. |
| `CARGO_CONTAINMENT_MISMATCH` | Cargo Service | "Ressource darf nicht in diesen Containertyp." | Zulässigen Container wählen. |
| `CARGO_TOO_HEAVY_FOR_SHIP` | Cargo Service / Ship Authority | "Ladung überschreitet Schifflimit." | Masse reduzieren. |
| `CARGO_TRANSFER_NO_ACCESS` | Cargo Service | "Kein Zugriff auf diesen Container." | Berechtigung/Lizenz prüfen. |
| `LEGAL_NO_PERMIT` | Faction/Legal Service | "Keine Erlaubnis für diese Aktion in dieser Zone." | Lizenz/Permit erwerben. |
| `LEGAL_CONTRABAND` | Faction/Legal Service | "Ressource ist in dieser Zone verboten." | Ressource ablegen oder verlassen. |
| `LEGAL_FACTION_HOSTILE` | Faction/Legal Service | "Fraktion ist feindselig; Aktion riskant." | Risiko akzeptieren oder abbrechen. |
| `SCAN_NO_DETECTION` | Scanner Service | "Keine Detektion in Reichweite." | Näher gehen oder Scanner aufrüsten. |
| `SCAN_CONFIDENCE_TOO_LOW` | Scanner Service | "Detektion zu unsicher für Aktion." | Näher scannen. |
| `SHIP_NO_MUZZLE` | Ship Authority | "Kein funktionierender Lauf." | Schiff reparieren. |
| `SHIP_OUT_OF_ARC` | Ship Authority | "Ziel außerhalb Turm-ARC." | Schiff/Turm ausrichten. |
| `SHIP_COOLDOWN` | Ship Authority | "Waffe im Cooldown." | Warten. |
| `SUIT_OXYGEN_DEPLETED` | Suit/Vitals Service | "Sauerstoff erschöpft." | Sofort zurück zum Schiff. |
| `BUILDER_NOT_SAFE_STATE` | Builder/Mode Authority | "Builder erfordert sicheren/gelandeten Zustand." | Andocken/landen. |

Übersetzungsregel:

```text
Authority Owner → FailureReasonCode + strukturierte Details
View → übersetzt in lokalisierbaren Player-Text + nächste Aktion
```

Eine View erfindet keine neuen Codes. Neue Codes entstehen nur im Authority
Owner und müssen in diese Tabelle eingetragen werden.

## 5. View-Regelwerk

### Was eine View tun darf

- Status-Snapshot vom Authority Owner lesen (Codes + Werte).
- Codes in Player-Texte übersetzen.
- Warnchips nach Taxonomy anzeigen (Severity unverändert).
- Nächste Aktion aus Failure-Reason-Tabelle anzeigen.
- Eigene UI-Zustände verwalten (welches Panel offen, Filter, Sortierung).
- Debug-Werte nur im Debug-Layer anzeigen, niemals im Player-Layer.

### Was eine View nicht tun darf

- ETA, Fuel, Risk, Legalität oder Containment selbst berechnen.
- Einen anderen Status zeigen als der Owner liefert.
- Severity von Warnchips verändern.
- Debug-IDs (PlanHash, SampleIndex, ResourceId, SocketPath) im Player-Layer zeigen.
- Wahrheit produzieren, die der Authority Owner nicht kennt.
- Aktionen ohne sichtbaren Grund blockieren.

## 6. Multi-Surface-Konsistenz

Wenn mehrere Surfaces denselben Status zeigen, müssen sie übereinstimmen, weil sie
denselben Authority Owner lesen.

Beispiel Fuel:

```text
Navigation Computer → Fuel Estimate (Owner)
Ship HUD            → zeigt denselben Fuel Estimate (Read)
System Map          → zeigt denselben Fuel Estimate in Route Preview (Read)
Terminal            → zeigt denselben Fuel Estimate im Refuel-Service (Read)
```

Wenn sich Fuel ändert, aktualisiert der Authority Owner den Snapshot. Alle Views
reagieren. Keine View berechnet ihren eigenen Fuel-Wert.

Beispiel Legalität:

```text
Faction/Legal Service → Action Legality (Owner)
Surface Interaction   → zeigt Legal/Risk (Read)
Terminal              → zeigt Legal/Risk im Service (Read)
InventoryCargo        → zeigt Legal-Marker (Read)
System Map            → zeigt Zone-Overlay (Read)
```

Scanner-Ownership-Hints dürfen nicht als autoritative Legalität angezeigt werden.
Nur der Faction/Legal Service entscheidet Legalität.

## 7. Debug vs Player UI Grenze

Statusdaten haben zwei Darstellungsebenen:

| Schicht | Inhalt | Sichtbarkeit |
| --- | --- | --- |
| Player-Layer | Spieler-Text, Warnchips, nächste Aktion, lesbare Werte. | Basic-Mode, immer in Player UI. |
| Debug-Layer | PlanHash, SampleIndex, ResourceId, SocketPath, CandidateScores, Rohtelemetry. | Nur in DebugDiagnostics oder aktivem Debug-Preset. |

Regeln:

- Player-Layer darf keine Debug-IDs anzeigen.
- Debug-Layer darf nicht die einzige Spieleroberfläche sein.
- Debug-Overlays müssen als Debug/Prototype/Diagnostic gekennzeichnet sein.
- Debug-Werte dürfen den Player-Layer nicht verfälschen.
- Siehe `docs/ux/debug-vs-player-ui-policy.md` für Function-Key-Policy und
  Diagnostic-Promotion-Regeln.

## 8. Beziehung zu bestehenden Specs

- `autopilot-v2-core-planner-executor-v1`: liefert AutopilotTelemetry-Codes
  (State, FailureReasonCode, WarningCode[]). Dieser Change definiert, wie Views
  diese Codes übersetzen.
- `unified-ui-input-mode-architecture-v1`: definiert Modus-Besitz und
  HUD-Layer-Modell. Dieser Change ergänzt die Status-Owner-Regel pro Layer.
- `player-ui-redesign-foundation-v1`: definiert Informationshierarchie und
  Warnchips. Dieser Change spezifiziert die Owner der Warnchips.
- `resource-cargo-inventory-model-v1`: definiert Cargo-Datenmodell. Dieser
  Change definiert Cargo Service als Status-Owner, nicht das Datenmodell selbst.
- `faction-reputation-legality-rules-v1` (Gruppe D): definiert Faction-Regeln.
  Dieser Change definiert Faction/Legal Service als UI-Status-Owner.

## 9. Nächste ableitbare Runtime-Aufgaben

Aus diesem Dokument direkt ableitbar:

1. **HUD ViewModel-Slice**: Ship HUD liest Navigation-Telemetry, Cargo-Mass,
   Scanner-Warning, Ship-Authority; übersetzt in Warnchips nach Taxonomy.
2. **System Map Status-Slice**: Map liest Route Validity, Fuel Estimate, ETA,
   Legal-Zone; zeigt Route Preview und Authority Warnings.
3. **Suit HUD Slice**: Suit HUD liest Suit/Vitals, Scanner-Hazard,
   Scanner-Confidence; zeigt Hazard-Chips und Interaction Prompts.
4. **Terminal/Legal Slice**: Terminal liest Faction/Legal, Cargo-Transfer;
   zeigt Legal/Risk und Transfer-Feasibility.
5. **Warning-Chip-Component**: gemeinsame UI-Komponente, die
   Chip-Code + Severity + Aktion rendert.

Jede dieser Aufgaben hat klare Eingaben (welcher Authority Owner) und Ausgaben
(welche Codes/Chips/Texte), ohne eigene Wahrheitsberechnung.
