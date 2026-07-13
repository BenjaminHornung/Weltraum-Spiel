# UI-Spec: Ship Builder (Hangar) v0 — verbindliche Umsetzungsanleitung

Diese Datei ist die **massgebliche** UI-Beschreibung. Bei Unklarheit gilt: so bauen wie hier beschrieben, nicht improvisieren. Stack: uGUI + TextMeshPro, gleiche Mechanik wie `PrototypePlayerHud` (Canvas + benannte Elemente + `FindHudComponent`-Bindung + ViewModel-Snapshots). Alle Farben/Schriftgroessen kommen aus `PrototypeUiStyle`-Tokens — KEINE hartkodierten Hexwerte oder Fontgroessen in Widget-Code.

## 0. Design-Tokens (in PrototypeUiStyle ergaenzen, falls nicht vorhanden)

| Token | Verwendung | Richtwert (dark Sci-Fi, konsistent zum HUD) |
| --- | --- | --- |
| `PanelBackground` | Panel-Flaechen | dunkles Blaugrau, ~85 % Deckkraft |
| `PanelBorder` | 1px-Rahmen | entsaettigtes Cyan |
| `TextPrimary` / `TextSecondary` | Werte / Labels | hell / 60 % hell |
| `Accent` | Auswahl, aktive Toggles | Cyan |
| `Ok` / `Warn` / `Error` | Validierung, Ghost | Gruen / Amber / Rot |
| `GhostValid` / `GhostInvalid` | Geist-Material | Ok bzw. Error mit ~35 % Alpha |
| Typo `Display/Headline/Body/Caption/Micro` | s. HUD-Typografie-Slice | 28/20/16/13/11 px @1080p, skaliert mit CanvasScaler |

Canvas: `CanvasScaler` ScaleWithScreenSize, Referenz 1920x1080, matchWidthOrHeight 0.5. Minimal unterstuetzte Aufloesung 1280x720.

## 1. Bildschirm-Layout (Zonen, Anker, Groessen)

```
+------------------------------------------------------------------------------+
| [1] TopBar (volle Breite, Hoehe 48)                                          |
+----------------+---------------------------------------------+--------------+
| [2] Palette    |  [3] 3D-Viewport (Rest)                     | [4] InfoPanel|
| Breite 280     |   - Grid-Ebene, Schiff, Ghost, Gizmos       | Breite 340   |
| links, volle   |   - keine UI-Elemente ausser [5]            | rechts,      |
| Resthoehe      |                                             | volle Rest-  |
|                |                                             | hoehe        |
+----------------+---------------------------------------------+--------------+
| [5] HintBar (volle Breite, Hoehe 32, ueber unterem Rand im Viewport-Bereich) |
+------------------------------------------------------------------------------+
```

Anker-Vorgaben (RectTransform):

- **TopBar**: anchorMin (0,1), anchorMax (1,1), pivot (0.5,1), Hoehe 48, Offsets 0.
- **Palette**: anchorMin (0,0), anchorMax (0,1), Breite 280, oben 48 Abstand (unter TopBar), unten 32 (ueber HintBar).
- **InfoPanel**: anchorMin (1,0), anchorMax (1,1), Breite 340, gleiche vertikale Abstaende.
- **HintBar**: anchorMin (0,0), anchorMax (1,0), Hoehe 32.
- Alle Panels: Hintergrund `PanelBackground`, 1px-Border `PanelBorder`, Innen-Padding 12, Element-Abstand (VerticalLayoutGroup spacing) 8.

Bei Breite < 1600: Palette 240, InfoPanel 300. Panels duerfen den Viewport nie vollstaendig verdecken (Viewport-Mindestbreite 480 — durch obige Werte bei 1280 erfuellt: 1280-240-300=740).

## 2. Komponenten-Namenskonvention (Pflicht, fuer Bindung + Tests)

Praefix `ShipBuilder`. Vollstaendige Liste der bindbaren Elemente; Tests pruefen Existenz analog `HasCompleteHudBindings`:

| Name | Typ | Zweck |
| --- | --- | --- |
| `ShipBuilderRoot` | RectTransform | Gesamter Builder-Canvas-Ast |
| `ShipBuilderTopBar`, `ShipBuilderPalettePanel`, `ShipBuilderInfoPanel`, `ShipBuilderHintBar` | RectTransform | Zonen |
| `ShipBuilderBlueprintNameInput` | TMP_InputField | Blueprint-Name |
| `ShipBuilderDirtyChip` | TMP_Text | "Nicht gespeichert" |
| `ShipBuilderNewButton`, `ShipBuilderLoadButton`, `ShipBuilderSaveButton`, `ShipBuilderTestFlyButton`, `ShipBuilderExitButton` | Button (+`...Text` TMP_Text) | TopBar-Aktionen |
| `ShipBuilderCategoryTabBar` | RectTransform | Kategorie-Tabs |
| `ShipBuilderCategoryTab_<Cockpit|Hull|FuelTank|MainThruster|RcsBlock|Gun|Cargo|Utility>` | Button | Tabs |
| `ShipBuilderPaletteList` | RectTransform (ScrollRect-Content) | Modulkarten-Liste |
| `ShipBuilderPaletteCard_<definitionId>` | Button | Modulkarte |
| `ShipBuilderMirrorToggle`, `ShipBuilderGridLevelLabel` | Button/TMP_Text | Mirror-X, Hoehen-Level |
| `ShipBuilderStatsBlock` | RectTransform | Kennzahlen |
| `ShipBuilderStat_<DryMass|Fuel|TotalMass|Thrust|Accel|DeltaV|Rcs|Com>` | TMP_Text | je Zeile Wert |
| `ShipBuilderValidationList` | RectTransform (ScrollRect-Content) | Fehler/Warnungen |
| `ShipBuilderValidationRow_<n>` | Button | klickbare Meldung |
| `ShipBuilderSelectionBlock` | RectTransform | Auswahl-Inspektor |
| `ShipBuilderSelectionTitle`, `ShipBuilderSelectionInfo` | TMP_Text | Auswahl-Daten |
| `ShipBuilderSelectionDeleteButton`, `ShipBuilderSelectionDuplicateButton`, `ShipBuilderSelectionRotateButton` | Button | Auswahl-Aktionen |
| `ShipBuilderHintText` | TMP_Text | Kontext-Hinweise |
| `ShipBuilderLoadOverlay`, `ShipBuilderLoadList`, `ShipBuilderLoadRow_<n>`, `ShipBuilderLoadCloseButton` | div. | Lade-Dialog |
| `ShipBuilderConfirmOverlay`, `ShipBuilderConfirmText`, `ShipBuilderConfirmSaveButton`, `ShipBuilderConfirmDiscardButton`, `ShipBuilderConfirmCancelButton` | div. | Verwerfen-Dialog |

## 3. TopBar (Zone 1)

Links nach rechts, horizontale LayoutGroup, spacing 12:

1. Titel `HANGAR` (Headline, TextSecondary).
2. `ShipBuilderBlueprintNameInput`: Breite 320, Body-Typo; Eingabe setzt Blueprint-DisplayName; ungueltige Dateinamenzeichen werden beim Speichern sanitisiert (Anzeige unveraendert).
3. `ShipBuilderDirtyChip`: Text `● Nicht gespeichert`, Farbe Warn; nur sichtbar bei IsDirty.
4. Spacer (flexible).
5. Buttons in dieser Reihenfolge, Hoehe 32, Padding 16 horizontal: `Neu`, `Laden`, `Speichern`, `Testflug`, `Verlassen`.

Button-Zustaende (gilt fuer ALLE Buttons im Builder, nutzt den Button-State-Slice des HUD-Reviews):

- Normal: PanelBackground +10 % hell, Text TextPrimary.
- Hover: +Accent-Border.
- Pressed: Accent-Hintergrund 30 %.
- Disabled: 40 % Alpha, Untertext mit Grund (s. u.).
- `Testflug` disabled, wenn Validierung Errors hat → unter dem Button-Text Micro-Zeile mit erstem Fehler (z. B. `Kein Cockpit`). Genau so umsetzen: Button bleibt sichtbar, wird nicht versteckt.
- `Speichern` disabled, wenn !IsDirty.

## 4. Viewport (Zone 3)

Kein uGUI ausser HintBar. 3D-Inhalt:

- **Grid:** XZ-Linienraster 0,25 m (duenn, 25 % Alpha) mit Hauptlinien je 1 m (50 % Alpha), Ausdehnung 12x12 m, zentriert auf Ursprung; Y-Position = aktueller Hoehen-Level. Farbe PanelBorder.
- **Hoehen-Level-Anzeige:** `ShipBuilderGridLevelLabel` klein in der HintBar: `Ebene Y = +0.50 m`.
- **Module:** platzierte Instanzen als Boxen ueber den bestehenden Primitive-Visual-Pfad; Kategorie-Faerbung wie `PrototypeModuleColorPalette`.
- **Ghost:** Box in `GhostValid`/`GhostInvalid`; folgt Maus-Raycast auf Grid-Ebene, snapped.
- **Auswahl-Highlight:** Outline oder Emission-Pulse in Accent (einfachste robuste Variante: zweite, minimal groessere Wireframe-Box).
- **COM-Gizmo:** kleine Kugel (0,12 m) in Warn-Farbe an COM-Position + vertikale Hilfslinie zum Grid.
- **Schubachsen-Gizmo:** Linie von gemittelter Thruster-Position in +Z-Schubrichtung durch das Schiff, Ok-Farbe; bei Schub-Versatz-Warnung Warn-Farbe.
- **Kamera:** Orbit RMB-Drag (Yaw/Pitch, Pitch clamp 5..85°), Pan MMB-Drag, Zoom Mausrad (Distanz 3..40 m), `F` framed Auswahl bzw. Schiffs-AABB. Start: 30° Pitch, 12 m Distanz, Blick auf Ursprung.

## 5. Palette (Zone 2)

1. **Tabs** (`ShipBuilderCategoryTabBar`): 2 Reihen x 4 Tabs, Hoehe je 28, Caption-Typo, Label deutsch: `Cockpit, Huelle, Tank, Antrieb, RCS, Waffe, Cargo, Utility`. Aktiver Tab: Accent-Unterstrich + TextPrimary; inaktiv TextSecondary. Default: Huelle.
2. **Modulkarten-Liste** (ScrollRect, vertikal): pro Definition der aktiven Kategorie eine Karte, Hoehe 64, volle Breite:
   - Zeile 1: DisplayName (Body, TextPrimary).
   - Zeile 2 (Caption, TextSecondary): kategoriespezifische Kennzahl — Cockpit/Huelle/Cargo/Utility: `800 kg`; Tank: `400 kg | 300 kg Fuel`; Antrieb: `700 kg | 45 kN`; RCS: `80 kg | 6.5 kN`; Waffe: `250 kg | 1500 m/s`.
   - Linker Farbbalken 4px in Kategoriefarbe.
   - Klick: aktiviert Ghost-Platzierung dieser Definition; Karte zeigt Accent-Border solange Ghost aktiv.
3. **Footer der Palette** (unten angepinnt): `ShipBuilderMirrorToggle` (`Spiegeln X: AUS/EIN`, Toggle-Stil wie Buttons, EIN = Accent) + Caption-Hinweis `Q/E Ebene  R drehen  M spiegeln`.

Quelldaten der Palette: Union aller Definitionen aus `PrototypeShipBlueprintCatalog.BuiltInBlueprints()` (dedupliziert per DefinitionId). Keine eigene neue Part-Liste in v0.

## 6. InfoPanel (Zone 4) — von oben nach unten

### 6.1 Kennzahlen (`ShipBuilderStatsBlock`)

Tabelle Label links (Caption, TextSecondary) / Wert rechts (Body, TextPrimary, rechtsbuendig), Zeilen exakt:

```
Trockenmasse      4 030 kg
Treibstoff          300 kg
Startmasse        4 330 kg
Schub              45.0 kN
Beschl. voll/leer  10.4 / 11.2 m/s2
Delta-v            5 169 m/s
RCS                4 Pods | 9.0 kN
Schwerpunkt        z +0.12 m | Versatz 0.05 m
```

Formatierung: Tausender-Trennzeichen schmal, eine Nachkommastelle bei kN/m/s². Werte aktualisieren nach jedem Edit (nicht pro Frame). Bei Error-Validierung: Delta-v/Beschl. zeigen `--`.

### 6.2 Validierung (`ShipBuilderValidationList`)

- Kopfzeile: `Pruefung` + Status-Chip rechts: `OK` (Ok-Farbe) / `2 Warnungen` (Warn) / `1 Fehler` (Error).
- Liste (max. Hoehe 180, scrollbar): pro Meldung eine Zeile, Icon `✕` (Error) oder `!` (Warn) in Statusfarbe + Text (Caption). Texte deutsch und handlungsleitend, Mapping:
  - "Blueprint requires at least one cockpit module." → `Cockpit fehlt`
  - "...fuel capacity..." → `Tank fehlt`
  - "...main thruster..." → `Hauptantrieb fehlt`
  - "...RCS block..." → `RCS fehlt`
  - "...gun module..." → `Waffe fehlt`
  - Spatial (design.md §4): `Module ueberlappen stark: <A> / <B>`, `Modul schwebt frei: <A>`, `Schub laeuft nicht durch den Schwerpunkt`, `RCS deckt Richtung <+X/−X/+Y/−Y> nicht ab`, `Cockpit liegt weit hinten`
- **Klick auf Zeile mit Modulbezug** selektiert das betroffene Modul und framed es (`F`-Verhalten). Zeilen ohne Modulbezug nicht klickbar (kein Hover-Effekt).

### 6.3 Auswahl-Inspektor (`ShipBuilderSelectionBlock`)

Nur sichtbar bei Auswahl, sonst eingeklappt mit Platzhalter `Kein Modul ausgewaehlt` (Caption, TextSecondary):

- Titel: DisplayName + InstanceId (Caption darunter).
- Info-Zeilen: `Position x/y/z` (snapped Werte), `Rotation 0/90/180/270°`, Kennzahl wie Palette-Karte.
- Buttons nebeneinander, Hoehe 28: `Drehen (R)`, `Duplizieren (Ctrl+D)`, `Loeschen (Entf)` — Loeschen in Error-Farbe-Border.

## 7. HintBar (Zone 5)

Eine Zeile, drei Segmente:

- Links: `ShipBuilderGridLevelLabel` (`Ebene Y = +0.50 m`).
- Mitte: `ShipBuilderHintText` — kontextabhaengig, exakt diese Texte:
  - Kein Ghost, keine Auswahl: `Modul links waehlen | RMB Kamera | F fokussieren`
  - Ghost aktiv: `Klick platzieren | R drehen | Q/E Ebene | Esc abbrechen`
  - Auswahl aktiv: `Ziehen verschieben | R drehen | Entf loeschen | Ctrl+Z rueckgaengig`
- Rechts: Modul-Zaehler `9 Module`.

## 8. Dialoge (Overlays, zentriert, 480 breit, modal mit 50 % Schwarz-Backdrop)

### 8.1 Laden (`ShipBuilderLoadOverlay`)

- Titel `Blueprint laden` (Headline).
- Liste: pro Eintrag Zeile 40 hoch: Name (Body) + rechts Caption `Built-in` (TextSecondary) oder Moduldatum; beschaedigte Dateien: Error-Farbe, Suffix `beschaedigt`, nicht klickbar.
- Klick auf Built-in: laedt **Kopie** (`<id>-copy-<n>`), Hinweis-Chip kurz `Als Kopie geladen`.
- Klick auf Spieler-Blueprint: laedt direkt; bei IsDirty vorher Dialog 8.2.
- `Schliessen`-Button unten rechts.

### 8.2 Verwerfen-Bestaetigung (`ShipBuilderConfirmOverlay`)

Text: `"<Name>" hat ungespeicherte Aenderungen.` Buttons: `Speichern` (Accent), `Verwerfen` (Error-Border), `Abbrechen`. Ausgeloest von: Laden bei dirty, Neu bei dirty, Verlassen bei dirty.

## 9. Eingaben (vollstaendige Tabelle)

| Eingabe | Kontext | Aktion |
| --- | --- | --- |
| LMB auf Palette-Karte | immer | Ghost aktivieren |
| LMB im Viewport | Ghost aktiv | platzieren (Mirror beachtet) |
| LMB im Viewport auf Modul | kein Ghost | selektieren |
| LMB-Drag auf selektiertem Modul | Auswahl | verschieben (snapped, Ebene) |
| LMB ins Leere | kein Ghost | Auswahl aufheben |
| RMB / Esc | Ghost aktiv | Ghost abbrechen |
| RMB-Drag | sonst | Kamera-Orbit |
| MMB-Drag | immer | Kamera-Pan |
| Mausrad | immer | Zoom |
| R | Ghost oder Auswahl | Yaw +90° |
| T | Ghost oder Auswahl | Pitch +90° |
| Q / E | immer | Ebene −/+ 0,25 m |
| M | immer | Mirror-X togglen |
| F | immer | Auswahl/Schiff framen |
| Entf | Auswahl | loeschen |
| Ctrl+D | Auswahl | duplizieren (als Ghost) |
| Ctrl+Z | immer | Undo |
| Ctrl+S | immer | Speichern |
| F8 / Esc (ohne Ghost/Dialog) | immer | Verlassen-Flow |

Eingaben via InputSystem-Polling wie im restlichen Prototyp; waehrend `ShipBuilderBlueprintNameInput` fokussiert ist, sind alle Einzeltasten-Shortcuts deaktiviert.

## 10. Abnahme & Screenshot-Matrix

Aufloesungen: 1280x720, 1920x1080, 2560x1080. Zustaende je Aufloesung:

1. Leerer neuer Blueprint (Pflichtfehler-Liste sichtbar, Testflug disabled mit Grund).
2. Scout-Kopie geladen (Stats gefuellt, OK-Chip).
3. Ghost-Platzierung aktiv (gruen) und ueber besetzter Zelle (rot).
4. Auswahl aktiv mit Inspektor + Highlight + COM-/Schub-Gizmo sichtbar.
5. Warnungs-Zustand (Schub-Versatz provoziert) mit klickbarer Warnzeile.
6. Lade-Dialog offen, Verwerfen-Dialog offen.

Abnahme-Kriterien (zusaetzlich zu design.md §8-Tests):

- Keine ueberlappenden Panels/Texte in allen drei Aufloesungen (Layout-Tests analog Player-HUD).
- Jeder in §2 genannte Name existiert und ist gebunden (Bindings-Test).
- Tab-Wechsel, Karte→Ghost→Platzieren→Undo→Speichern→Laden-Roundtrip manuell im Protokoll dokumentiert.
- Alle sichtbaren Texte deutsch, alle Farben/Groessen via Tokens.
