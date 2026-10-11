# W09 UI-Vertrag — READONLY-Kandidat

2026-10-11, `/root/fp06_domain`. Grundlagen: Handoff4759367…, Normalflowe4402e…, Handlingc959234…/Profil1b981a9…, W09-Karte. **Kein Freeze/Grant/PASS.** W07 Voraussetzung; bestehender HostPort bietet Construction/Lifecycle, keine folgende UI-API.

## Geschlossene Commands

Alle Typen rekursiv readonly/JSON-safe; IDs save-safe, Revisionen sichere nichtnegative Ganzzahlen. `Lot` referenziert Bestand; `expected` ist veröffentlichte Hostbindung, kein Nativebeweis.

```ts
type PanelId = "inventory" | "machine" | "power" | "interaction";
type Ref = { id: string; revision: number };
type Lot = { container: Ref; stackId: string };
type Binding = {
  catalogDigest: string; terrainSourceDigest: string;
  powerSourceProfileDigest: string; terrainRevision: number;
  facilityRevision: number; materialRevision: number;
  netRevision: number; handlingRevision: number;
};
type Envelope = {
  version: "fp06-ui-command-v1"; commandId: string;
  sessionId: string; epoch: number; expected: Binding;
};
type NativeCommand = Envelope & (
  | { kind: "pickup"; profileId: string; sourceLots: Lot[] }
  | { kind: "deposit"; handlingId: string;
      destination: { kind: "ground" }
        | { kind: "container"; target: Ref } }
  | { kind: "return"; handlingId: string; target: Ref }
  | { kind: "build"; preview: Ref; sourceLots: Lot[] }
  | { kind: "select-recipe"; machine: Ref;
      recipe: MaterialRecipeRef }
  | { kind: "start"; machine: Ref; action: "reserve";
      sourceLots: Lot[] }
  | { kind: "start"; machine: Ref;
      action: "manual-work" | "manual-finish"; jobId: string }
  | { kind: "transfer"; source: Lot; quantityUnits: number;
      destination: { kind: "local"; target: Ref }
        | { kind: "ports"; connection: Ref } }
);
```

`MaterialRecipeRef` ist W02{sourceId,version,digest}. Start-reserve benutzt bestätigte Hostauswahl; Rezept bestimmt Mengen, Command bestimmt neue Job-/Batchidentitäten. Select ändert kein laufendes WIP. Manualaktionen verlangen bestehenden REC05-Job, keine automatischen Schritte. Hostpreview bindet Definition/Raster/Orientierung/Kosten/Sourceprofil; keine UI-Actorpose/Masse/Materialcandidate. Belt/Cable/Brace brauchen geprüfte Hostpreviewtypen.

Pickup nutzt ein geschlossenes Handlingprofil; Grounddeposit nur aktuelle Carrierpose plus geprüften Snap. Return ist lokaler Rücktransfer, kein Fernrefund. Transfer-local verlangt echten Zugriff auf beide Owner; Transfer-ports benutzt bestätigte native Verbindung/Portrollen/Normalen/Revisionen. Mengen sind positive ganze mg/piece/mm laut Katalog, Pieces unteilbar; IDs für echte Bulkchildren erzeugt der Host.

## Ein unveränderlicher gemeinsamer ReadView

```ts
type ReadModel = {
  version: "fp06-ui-view-v1"; sessionId: string; epoch: number;
  publicationRevision: number; binding: Binding;
  host: FactoryHostView; clock: FactorySessionView;
  catalog: FactoryCatalog;
  inventory: InventoryRow[]; machines: MachineRow[];
  technologies: { sourceId: string; sourceRefs: string[];
    name: string; requirements: string[];
    implementation: "implemented" | "planned" | "definition-missing";
    reason: string | null }[];
  power: { state: FactoryPowerState;
    grants: FactoryPowerGrant[];
    balance: FactoryPowerSuccess["balance"] | null };
  interaction: { actorId: string; focusedPanel: PanelId | null;
    handling: { id: string; profileId: string;
      phase: "EMPTY" | "CARRYING" | "LOCAL_READY";
      containerId: string | null; revision: number };
    previews: { ref: Ref; definition: MaterialRecipeRef;
      kind: "facility" | "belt" | "cable" | "brace" }[];
    connections: Ref[]; reason: string | null };
};
```

```ts
type InventoryRow = {
  snapshot: ResourceContainerSnapshot; nativeOwner: Ref;
  role: "cargo" | "handling" | "depot" | "storage" | "installed"
    | "input" | "output" | "offcut" | "wip";
  access: { open: boolean; reachable: boolean; reason: string | null };
  claims: MaterialOutput[];
};
type MachineRow = {
  machine: Ref; definition: MaterialRecipeRef;
  selectedRecipe: MaterialRecipeRef | null; status: ProductionStatus;
  job: ProductionJob | null; grant: FactoryPowerGrant | null;
  containers: { installed: string; input: string; output: string;
    offcut: string; wip: string };
  capabilities: { select: boolean; reserve: boolean;
    manualWork: boolean; manualFinish: boolean };
  reason: string | null;
};
```

Snapshots bewahren Nativecontents/owner/condition/mission/extensions/Lineage. Claims sind Kapazität, Capabilities Hinweise. Referenztypen aus accepted W02/W03/W04/W06; keine UI-Bilanzen/Progresscounter. Normalflow wählt produzierte Lose.

## Hostadoption und vier Panels

Host prüft geschlossenes Keyset/Bytes und Session/Epoch; bereits angenommene ID+Bytes liefern zuerst historische Receipts, bevor aktuelle Revisionen geprüft werden. Neue Commands prüfen sämtliche Source-/Revisionsbindungen und frische Rechte/Nativeactor-/Support-/LOS-/Service-/Tool-/Ownerfakten. Er bereitet W02/W03/W04/W08 gegen genau eine Materialauthority vor und publiziert atomar. Geänderte Bytes gleicher ID rejecten. Transportunsicherheit bleibt Pending/RecoveryHold; kein neues Command-ID zum Umgehen. Antwort={commandId,status:Pending|Committed|NoOp|Rejected|RecoveryHold,publicationRevision,reason}. Read-only Receiptlookup löst verlorene Antworten.

- **Inventory:** native Lose/Claims/Lineage, endliche Kapazität, Pickup/Deposit/Return/Transfer; keine Fernbestandsentnahme.
- **Machine:** Recipe/Start/Montage/Finish, echte WIP/Arbeit/Grants/Blockaden, separate Hauptoutput-/Kassettencontainer.
- **Power:** echte Netz-/Batterie-/Allocation-/Balanceprojektion; keine synthetische Wetter- oder Gratisladefunktion.
- **Interaction:** Hostpreview/Build, Carrier/Fokus/Fehler; normales Nativeinput bewegt Carrier/Capsule. Sourcegebundenes vollständiges Zielverzeichnis zeigt Implementierungsdefizite/Anforderungen ohne Forschungslocks.

Kartenpfade bleiben cargoPanel.ts/machinePanel.ts/powerPanel.ts/technologyView.ts; Interaction ist logische Grenze, kein fünfter Dateigrant. Integratorport: read/subscribe/submit/readReceipt/setPanelFocus. Hostguard neutralisiert gehaltene Gameplay-/Buildintents bei Fokus; Schließen erzeugt keinen Nachlauf. Panels besitzen keine Worker/World-/Physics-/Savezugriffe, Inputcontroller oder Uhr. Sechs bestätigte60Hz-Ticks ergeben genau einen100ms-Factoryschritt; Nachfrage vor neuen Bandzustellungen, ganze Powerreceipts, frische Produktlineage, Stromausfall/volle Kassetten erhalten Jobs. Normal laufende Carry-/WAIT_POWER-Zustände blockieren die Nativeuhr nicht pauschal.

Erst W07PASS/W04/W08-Aufnahme/Integratorfreeze erlauben NEWUIworktree und Panelgrants+UITest. Jetzt nur Quellenreads: Tests/Build/Browser/Nativejobs **NOT_RUN**.
