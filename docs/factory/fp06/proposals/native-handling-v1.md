# W09: enger zusätzlicher Native-Transportvertrag

Status: PROPOSED / OWNER_REVIEW_REQUIRED. Keine Umsetzung oder Freigabe behauptet.

Die tatsächliche D11-Antwort genehmigt höchstens16 **feste** Facility-Owner. FP06 §8.6, Zeilen473–477, begrenzt diesen ersten Install-/Savevertrag ausdrücklich auf feste Owner; bewegliche Objekte brauchen eigene versionierte Fähigkeiten. FP01 Zeilen415–417 und FP02 Zeilen366/771 erlauben einfache Gestell-/Palettenhandhabung. Sie genehmigen diesen konkreten beweglichen Nativebody nicht bereits. Ein eigener Namensraum allein löst diese Freigabegrenze nicht.

Vorschlag für W09/W10: genau ein wiederverwendbarer, versionierter kinematischer Transportowner in der vorhandenen Native World. Ausschließlich die geschlossenen Jobs im [Profilvorschlag](../reviews/w09-native-cargo-handling-closed-profile-preflight.md): endliche bezahlte BOM-/Material-/Produktlose; höchstens5Collider für Payload und vier Füße. Bestehende 64/32/4096-Gesamtbudgets und höchstens16 Factoryowner einschließlich Cargo und Transportträger bleiben erhalten, auch während Staging. Keine zusätzliche16+1-Kapazität.

Der Host bindet tatsächliche Materialmasse, Sourceprofil, Custody, IDs und gemeinsame Revisionen. Native Bewegung erfolgt ausschließlich über normale Playerinputs. Vor beiden Posecommits werden gesamte Player-/Payload-Sweeps, Hindernisse, volle Bodenauflage und bekannte Coverage geprüft. Kein UI-Teleport oder eigenes Inventar. Ein Hindernis stoppt Bewegung und erhält Fracht. Lokales Depot macht denselben Owner fixed; Aufnahme, Depot, Verbrauch und Rückgabe folgen gemeinsamem Prepare/Commit/Publish/Rollback/Finalize. Unklare Bestätigung führt zu RecoveryHold, keinem freien Refund.

Native Masse und Membership werden fachlich getestet; technische konservative Hüllen/COM/Inertia sind als solche bezeichnet. Der kombinierte W10-Save enthält Profil, Materialcustody, Phase, Pose, IDs, Receipts und Holdzustand vollständig und stellt sie pausiert mit neuen Handles wieder her. Kein Fahrzeug-/Mining-/Fluid-/beweglicher Maschinenbau oder allgemeiner CreateBody-Vertrag; W12–W29 bleiben ausgeschlossen.

Unabhängige Sourceprüfung bestätigt: Die vorhandene fixed-only Freigabe deckt diesen neuen Carrier nicht. Der geschlossene technische Anschlussvorschlag ist prüfbar, tatsächliche Native-Massen-/Route-/Sweep-/Savegates sind NOT_RUN. Bis zur Antwort bleiben ausschließlich mobile Handling- und davon abhängige Schreibteile gesperrt; W07-Abschluss und danach unabhängige gemeinsame Host-/Material-/Power-/UI-Verträge laufen weiter.
