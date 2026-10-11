# W09 Startsite V2 — exakte zusätzliche Schreibgrenze

Read-only, 2026-10-11, Ownerantwort weiterhin PENDING. Keine Source-, Test- oder Produktänderungen und keine Ausführungsjobs. Vergleichsbasis ist der tatsächliche 25-Pfad-Grant `/workspace/.cloud-setup/fp06-task-briefs/w09-grant.json`, SHA256 `09251f6076eb7a50e0255cb7d2bd04536cf414e7252cbe76fd97cf33487125f9`. Die drei vorgeschlagenen Zusatzmasken sind noch nicht umgesetzt.

**Genau fünf zusätzliche Pfade sind für den geschlossenen V2-Sourcepfad und seine Fachorakel nötig:**

1. `apps/weltraum-browser/src/factory/fixtures/startSite.ts`
2. `apps/weltraum-browser/src/hvp/hvpCoastSource.ts`
3. `apps/weltraum-browser/src/factory/fixtures/cargoSite.ts`
4. `apps/weltraum-browser/tests/unit/factory/startSite.test.ts`
5. `apps/weltraum-browser/tests/unit/factory/cargoSite.test.ts`

`startSite.ts:4–29` enthält die unveränderlichen 15 Masken, den V1-Columnreader, die V1-Materialisierung und den literaltypisierten Receipt mit 4480/70m². Der V2-Sourcepfad benötigt eine eigene explizite Funktion/Receipt für die genehmigten zusätzlichen drei Rechtecke, weiterhin 125mm. V1-Funktion und ursprüngliche 15 Masken müssen weiter dieselben Bytes/Digest erzeugen.

`hvpCoastSource.ts:570–572` bindet den Factoryconstructor ausschließlich an V1/Seed; `:627–632` lässt nur die exakte V1/Seed-Kombination neben CoastV5 zu. Hier liegen der tatsächliche weitere Enum-/Validatorbedarf und der kanonische Bytefold `:513–539`. V2 muss als geschlossene Version mit dem festgelegten Factoryseed ergänzt werden. Beliebige Versionen/Seeds, falscher Registrydigest/Origin/Dimensionen oder falscher Fullbyte-Digest bleiben abgewiesen (`:634–662`). `restoreHvpCoastSource:576–583` bleibt ausschließlich CoastV5 und darf keine Factoryprofile restaurieren.

`cargoSite.ts:30–36` akzeptiert zurzeit nur V1, prüft danach echte Cargoauflage/Body-/Access-/Player-Airslots. V2 muss diese Sourceadmission ebenfalls geschlossen durchlaufen. Die native Cargo-Geometrieversion `fp06-initial-cargo-s0-v1`, Owner, Pose und finite Bestand bleiben unverändert. `:21–28` leitet kanonische Profile aus dem tatsächlichen SourceDigest ab; kein zusätzlicher Native-Scene-Enum ist dafür vorhanden oder nötig.

**Bereits innerhalb der 25 Schreibpfade:** `src/factory/session/hostPort.ts:28` (V1-Literaltyp), `src/hvp/hvpBootstrap.ts:1029–1031` (Factory-only Version/Source/Extension-Bindung) und `src/factory/factoryEntry.ts:94` (konkrete Entry-Source/Columnreader-Auswahl). Ein V2-Snapshot ohne passend gebundenes Factoryprofile/Extension bleibt abgewiesen; normale Entry und V1-Fixtures bleiben erhalten. Auch `tests/unit/hvp-bootstrap.test.ts`, `tests/unit/factory/facilitySession.test.ts`, `tests/unit/hvp-locomotion.test.ts` und `tests/e2e/factory-dry-flow.spec.ts` sind bereits gewährt. Keine weitere E2E-Datei erforderlich.

**Konkrete vorhandene Orakel:** `startSite.test.ts:6–34` prüft V1/Header/125mm, unveränderten Coastdigest, 15-Masken-Diff und geschlossenen Legacyrestore. Neue V2-Orakel dort können den exakt 380-Spalten-/2890-Slot-Zusatzdiff gegen V1, unveränderte ursprüngliche Masken/Restzellen, geschlossene Version/Seed/Frame/Digests und korrekten Columnreader prüfen. `cargoSite.test.ts` besitzt bereits Native-Open/Replays, tatsächliche fehlende Auflage, manipulierte Geometrie/Source-Airchecks; V2-Source/Cargoprofile-Bindung und unveränderte Cargo-Geometrie gehören in denselben vorhandenen Pfad. Normale Pairedfahrt und tatsächlicher Playerexit vor Formerinstallation gehören in den bereits gewährten Native-/Browserpfad; bisher nur Preflight, kein PASS.

**Unverändert auszuführende Regressionen, kein neuer Schreibbedarf:** `tests/unit/hvp-coast-source.test.ts` (V5/Header/Digest/Materialisierung), `tests/unit/hvp-game-save.test.ts`, bestehende Factory-Host-/Savebrowserfälle. Der tatsächliche Legacy-Szenedecoder `src/hestia-prototype/persistence/gameCheckpoint.ts:20,60,106` bindet weiter CoastV5 und `restoreHvpCoastSource`; `sceneReplacement.ts` konsumiert ausschließlich dieses validierte Legacy-DTO. Nicht für W09 öffnen. `physics/session.ts:243–245` lehnt Cargo/Factoryowner im Legacy-Checkpoint weiterhin ab. Ein kompletter Factory-Save-/Scene-Decoder ist noch keine vorhandene V2-Sourceabhängigkeit; W10 bleibt eigenes Paket. Ebenso bleibt `factory/catalog/sourceLock.ts` mit Coast-Materialregistry/125mm-Provenienz unverändert; es enthält keinen Factoryfixture-Versionenum.

## Sourcebytebindung

Stand 21:58:28.835443 UTC; alle fünf zusätzlich nötigen Pfade unverändert seit ihren ersten Reads. Bootstrap ist durch unabhängige erlaubte W09-Arbeit mutable; keine geschlossene Gesamtphase behauptet.

| App-Pfad | SHA256 |
|---|---|
| src/factory/fixtures/startSite.ts | 53725bbf06af6be92ac1b3b3e250ee6548e37bb6abf8500b4cd50e09b1ec1a29 |
| src/hvp/hvpCoastSource.ts | 13128d7ad3151da644ae909af0dbb0e2df0e91066c01f55ee566f7eedc1fdaca |
| src/factory/fixtures/cargoSite.ts | 83fa38b62b88c8f0c7f9351a1d30617b2704d4c04a21bb64fcc5084e8739ef0c |
| tests/unit/factory/startSite.test.ts | 6cc02b9d07b7f3180ce515cc39f093a0d89d8c2487ddfe4bdccd68c99d097b9f |
| tests/unit/factory/cargoSite.test.ts | abe6b53b1e5927b4756823b133e2b704a417a533bb520d94eb1c4a5df5fab86f |

Bereits gewährte Versionsseams: HostPort `e84d17ea0b2f07db1d6e1427b4d7009ffde8f4588daa414b5a0bf206cdf5393a`; Bootstrap `30055d33d9cf2ee877144ebc1e7a39ea30d7dbb78953fba07572992f43585556`; Entry `d110bbe6877d5796660cde4630ace45f04bef4457feebe149c00749d8bf6db8a`. Geschützte Legacyparser: gameCheckpoint `71335a3b25493145e7abb12f02fe6a31f46f7861d9da65b3d741ffef4dde990f`, sceneReplacement `91ffd8be5c64dd090f9761f3a656681c170ce7b4d9ac7a918e05d00f0759518b`.
