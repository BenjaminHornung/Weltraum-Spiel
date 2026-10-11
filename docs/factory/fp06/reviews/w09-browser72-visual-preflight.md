# W09 browser 72 — read-only visual preflight

Stand 2026-10-11 21:36 UTC. Ein bestehendes 1280×720-PNG einzeln in Originalauflösung angesehen; keine Browseraktion, Tests, Builds oder Produkt-/Evidenceänderungen. Dies ist eine Bedienvorprüfung, keine menschliche Art-Abnahme.

## Tatsächliche Bildbindung

Integrator-WT `/workspace/Weltraum-Spiel/.worktrees/fp06-integrator-2026-10-11`, HEAD `aeb6680044eb455a10d0bba6e67979c153fd248f` plus damaliger WIP. Ownrun `apps/weltraum-browser/evidence/factory/w09/2026-10-11T200540.207510Z`.

Bild `browser-heavy-route-72/playwright-output/factory-dry-flow-W09-norma-76321-ith-the-actual341kg-carrier-chromium/test-failed-1.png`: **276183 B, SHA256 `bb2835f4ed57e33a1838fb4d4439a4196b05f2327acd6c0a5ad03bb5ee10855d`**. Der vorhandene After-Receipt nennt exakt diese Bytes/Hash. Before bezeichnet `NORMAL_UI_HEAVY_ROUTE_ONLY`, `noHooks:true`; After meldet `sourceMismatches:[]`, **5 PASS / 1 FAIL / 10 NOT_RUN**, Route „Native blocked before west corridor“. Das Bild erklärt die Bewegungsursache nicht.

Command-Receipt SHA256 `96ae7a3a07aa2b3beee0afae7ac22c45dac24436d04a2b5eda9dbb8d576b8ec1` (547 B), Before `115ee4120f2a53ec3e33390bec2a6f941f38b6ba00c43a1848c4f5b8baca2fb7` (6595 B), After `c1f86f0848ce8e1ed00c61e66030ac89a86eb1247be05a02bf6910c1a4eb34af` (5444 B). Kein vollständiger Raw-/Paketreview dieses Laufs.

## Konkrete Bedienbefunde

1. **Aktiver Transport erhält falschen zentralen Handlungskontext.** Rechts stehen „Transportgut: 341 kg“, „Hier ablegen“ und „Zurück zur Fracht“. Unten fordert der dominante HVP-Hinweis zugleich zum Annähern an einen gelösten Körper, zum F-Stoß und zum Voxel-Schneiden auf. „Kein Treffer“ ist ein Impulszielstatus, kein Factory-Transportbefund. Dieser Unterschied ist im Bild nicht erkennbar. Für den normalen Cargoablauf sollten aus bestätigten Host-Fakten passende Transport-/Ablage-/Spielhinweise erscheinen, ohne neue Interaktionsauthority. Source: `src/hvp/hvpHud.ts:10`, `:22`, `:138`, `:253`; Factory-Kontextaufnahme in `src/hvp/hvpBootstrap.ts` und `src/factory/factoryEntry.ts` nur bei enger Root-Admission.

2. **Notwendiger Wechsel zwischen Lagerbedienung und Bewegung ist verschüttet.** Das rechte Panel bedeckt rund 27 % der Bildbreite und ist bereits weit gescrollt. Titel, Pause/Fortsetzen und Bauzustand stehen außerhalb des sichtbaren Bereichs; die lange vollständige Bestandliste kommt vor aktiven Transportkontrollen. „Hier ablegen“ ist hier sichtbar, eine sichtbare Rückkehr ins Spiel fehlt in diesem Ausschnitt. Source: `factoryEntry.ts:19`, `:22`, `:73–75`; `ui/cargoPanel.ts:163`, `:174–200`. Kleine funktionale Aufnahme: dauerhaft erreichbarer bestätigter Transportstatus und Spiel-/Fokuswechsel, Detailbestand separat scrollbar/aufklappbar; bestehende fokussierte Nodes erhalten. Keine aktuelle Focus-Fehlfunktion bewiesen: `cargoPanel.ts:43–49` und Host `setPanelFocus` stoppen Bewegung tatsächlich. W09/W11 müssen den normalen Fokuswechsel, neutralisierte gehaltene Tasten und anschließenden Resume mit echten Gesten belegen.

3. **Transport ist als Bestand lesbar, als Weltkörper nur eingeschränkt beurteilt.** Der große graue Vordergrundkörper verdeckt nahen Boden; Füße, Auflage und Ablageziel sind aus diesem Blick nicht erkennbar. Das PNG allein bindet einzelne Pixel nicht an eine Native Owner-ID. Daher kein Geometrie-/Support-/Posefehler behauptet. Erforderlicher weiterer visueller Nachweis: normaler Perspektivwechsel/Seitensicht während Carry und nach Deposit, mit bestätigter Native Pose und bezahlt erhaltenen Materialien. Falls dabei ein tatsächlicher Sicht-/Posefehler entsteht: `factoryAssets.ts:129–137` und Carrierprojektion in `hvpBootstrap.ts:2228` prüfen; keine UI-Positionskorrektur oder unbezahlte Geometrie.

## Quellenstand und Urteil

Vier aktuelle Dateien wurden 21:35:46–21:36:42 UTC unverändert gelesen und stimmen mit Before72 überein: `factoryEntry.ts` 10993 B / `d110bbe6877d5796660cde4630ace45f04bef4457feebe149c00749d8bf6db8a`; `cargoPanel.ts` 15555 B / `6d7b7b565927e811dca394e67dccda51d9fe5fd6294e98611ecbcd1e042d6f78`; `hvpBootstrap.ts` 171696 B / `1678e35ee9d2b7d6a5fe1492f04b5b43b6b51ae9c061f7f025e4b660d97560ff`; `factoryAssets.ts` 12189 B / `c80339580cc87b038c8a82e2d9e10981f8c125dc40b2a174248616d55daa487c`. `hvpHud.ts` aktuell 22610 B / `2e89c73b3749ec7d539ff3656cc233cc22eb774947f4bc19ab67d0e85ef3f699`; nicht separat im Before72 gebunden.

**Bedienvorprüfung: konkrete Kontext-/Steuerungserreichbarkeitsbefunde offen.** Keine Zielästhetik erfunden. Keine neue Write-Lease, kein Native-/W09-/W11-/Package-PASS. Source-C1/P1/C2 bleiben bis tatsächlichen Oracles offen. Human Owner Art acceptance: **NOT_RUN**.
