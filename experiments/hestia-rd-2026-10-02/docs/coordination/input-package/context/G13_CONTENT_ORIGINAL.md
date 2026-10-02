# G13 - Content Data, Modding, Versioning, Hot Reload und Saves

## Abschlussbericht und Content Package Contract v1

| Feld | Wert |
|---|---|
| Datum | 2026-08-12 |
| Arbeitspaket | G13 |
| Ergebnisstatus | `REQUIRES_OWNER_DECISION` |
| Charakter | Architektur- und Forschungsentwurf, keine Implementierung |
| Technische Referenz | `BenjaminHornung/hestia-voxel-kernel-lab@d95992df05952ac4be6221ca1809c1c9e3c0ac9d` |
| Hauptspiel-Auditbasis | `BenjaminHornung/Weltraum-Spiel@15f3550bd604856b25d40a7ac700ec4d5106b89e` |

## 1. Kurzurteil

Die empfohlene Architektur ist ein engine-neutraler, deklarativer `Content Package Contract v1` mit folgenden Kerneigenschaften:

- Core Code besitzt Interpreter, Schemata, Resolver, Migrationen, Registry, Autoritätswechsel und Sicherheitsregeln.
- Content-Pakete enthalten Daten und große binäre Payloads, aber in v1 keinen beliebigen JavaScript-, TypeScript-, HTML-, WGSL- oder nativen Code.
- Veröffentlichte Paketversionen sind unveränderlich. Releases, laufende Welten und Server binden einen exakt aufgelösten `content-lock.json`. Saves protokollieren diesen vollständigen Lock und binden zusätzlich den simulationsrelevanten `authorityLockDigest`.
- Stabile, namespaced IDs sind die fachliche Identität. Dateipfade, Anzeigenamen, Arraypositionen, Palette-Slots und GPU-Instanzindizes sind es nicht.
- Autoritative Daten, Authoring-Quellen und abgeleitete Artefakte bleiben getrennt. GLB, Meshes, Collider, AO, Instanzpuffer und Caches sind niemals alleinige Spiel- oder Save-Wahrheit.
- Hot Reload baut ein vollständiges, unveränderliches Kandidaten-Loadset und aktiviert es erst nach allen Prüfungen atomar an einem sicheren Punkt.
- Saves protokollieren das exakte ausgelieferte Paketset und pinnen Authority, Simulationsvertrag, Generatorbytes, Materialregistry, Koordinatenvertrag und Edit-Journal. Rein präsentationsbezogene Artefakte dürfen wechseln, ohne Weltsemantik zu behaupten. Ein neuer Generator oder ein veröffentlichtes Paket mit gleicher Version und anderem Hash darf niemals still substituiert werden.
- Mods starten als additive, deklarative Datenpakete. Arbiträre Overrides und ausführbare Mods werden in v1 nicht freigegeben.
- Fehlerhafte, widerrufene oder rechteunklare empfangene beziehungsweise veröffentlichte Pakete werden mit ihren Bytes und Diagnosen quarantänisiert, nicht still repariert oder ersetzt. Fehlerhafte lokale Drafts bleiben dagegen editierbare, abgelehnte Kandidaten.

Der Entwurf ist konkret genug für einen kleinen Registry-Spike mit synthetischen Daten. Er ist noch nicht freigabefähig, weil Mod-Code-Umfang, Namespace-Hoheit, Save-Supportfenster und die Rechtebasis einer möglichen Übernahme aus dem Voxel-Lab Ownerentscheidungen benötigen.

## 2. Evidenz, Grenzen und Begriffe

### 2.1 Aussageklassen

- **Projektfakt:** in einer bereitgestellten Projektquelle als bestehender Stand oder angenommener Vertrag dokumentiert.
- **Extern bestätigter Fakt:** durch eine verlinkte Primärquelle oder Spezifikation bestätigt.
- **Inferenz:** logische Folge aus mehreren Fakten, aber kein bereits akzeptierter Projektvertrag.
- **Empfehlung:** G13-Entscheidungsvorschlag.
- **Offen:** nicht ausreichend belegt oder nur durch den Owner entscheidbar.

### 2.2 Wichtige Grenzen

- Es wurden keine Repositories verändert, keine Builds, Tests oder Benchmarks ausgeführt und keine Implementierung begonnen.
- Aussagen über private Repository-Snapshots stammen aus den bereitgestellten Auditberichten. Ihre Live-Remote-Metadaten waren nicht unabhängig abrufbar.
- Die beiden bereitgestellten Destruction-Berichte sind byteidentisch und zählen als eine Quelle, nicht als unabhängige Bestätigung.
- Das untersuchte Voxel-Lab hatte am Prüfcommit keine erkennbare `LICENSE`. Dritte können daraus keine Wiederverwendungs- oder Distributionsrechte ableiten. Ist der Projekt-Owner selbst Rechteinhaber, kann er interne oder proprietäre Nutzung gesondert autorisieren, muss aber Rechte an Drittbeiträgen und die gewünschte Vertriebsgrundlage ausdrücklich dokumentieren.
- Der bestehende `SaveGame V1` des Hauptspiels enthielt am Auditstand weder Voxelregionen noch Voxel-Edit-Journale. Dieser Bericht beschreibt daher einen neuen Vertrag, keinen bereits vorhandenen Save-Pfad.
- Die Projektquellen liefern Primitive für IDs, Hashes, Assetverträge, Worker-Revisionsschutz und Persistenz. Eine allgemeine Content Registry, Mod-Sandbox und Migrationsengine existiert am untersuchten Stand nicht nachgewiesen.

### 2.3 Normative Sprache

In den v1-Abschnitten bedeuten `MUSS`, `DARF NICHT`, `SOLL` und `DARF` normative Anforderungen. Wo eine Ownerentscheidung aussteht, ist die Regel ausdrücklich als Vorschlag markiert.

> **Vertragsstatus:** Alle `MUSS`-Regeln der Abschnitte 3 bis 17 gehören zum vorgeschlagenen G13-Vertrag. Sie sind kein Nachweis einer bestehenden oder bereits akzeptierten Implementierung. Ihre Verbindlichkeit beginnt erst nach Ownerfreigabe und einem separaten Implementierungsgate.

## 3. Entscheidungsmatrix

| Thema | Empfehlung für v1 | Verworfene oder vertagte Alternative | Begründung | Status |
|---|---|---|---|---|
| Core versus Content | Core interpretiert, Content bleibt deklarativ | Beliebiger Code im Paket | Kleine Vertrauensoberfläche, deterministische Migration, spätere Serverprüfung | Vorgeschlagen |
| Paketidentität | Namespaced ID, SemVer und SHA-256 | Dateiname oder Version allein | Version beschreibt Absicht, Digest die exakten Bytes | Vorgeschlagen |
| Veröffentlichung | Unveränderliche Releases | Paket unter gleicher Version überschreiben | Reproduzierbare Saves und Caches | Vorgeschlagen |
| Abhängigkeiten | Bereiche beim Authoring, exakter Lock zur Laufzeit | Laufzeitauflösung bei jedem Start | Verhindert Drift und unerklärbare Save-Unterschiede | Vorgeschlagen |
| Mehrfachversionen | Genau eine Version je `packageId` im Loadset | Side-by-side-Versionen | Kleiner Resolver und eindeutige Referenzen | Vorgeschlagen |
| Konflikte | Duplicate ID und konkurrierende Writes sind Hard Fail | `last file wins` | Reihenfolge darf keine versteckte Semantik sein | Vorgeschlagen |
| Overrides | In v1 nur additive Inhalte und explizite Extension Points | Allgemeines Patchen von Core-Inhalten | Patchsemantik und Save-Auswirkung brauchen eigenen Vertrag | Ownerentscheidung |
| Hot Reload | Kandidat validieren, an Safe Point atomar tauschen | Live-Objekte einzeln mutieren | Kein teilweise aktualisierter Weltzustand | Vorgeschlagen |
| Save-Kompatibilität | Voller exakter Lock im Normalfall, sonst identische Authority oder zertifizierte Migration | Automatisch auf neueste Pakete aktualisieren | Generatoren, Wirtschaft und Missionen können Semantik ändern; rein kosmetische Bytes nicht | Ownerentscheidung |
| Generatoren | ABI-Version plus Implementierungsdigest pinnen | Nur Seed und Versionsstring speichern | Gleicher String garantiert nicht gleiche Welt | Vorgeschlagen |
| Mod-Scope | Daten-only in v1 | JavaScript im Origin | Worker ist keine Sicherheitsgrenze | Ownerentscheidung |
| Executable Mods | Späterer Capability-Wasm-Spike | Ungeregeltes JS oder `eval` | Hostimports, Ressourcenbudgets und Serverpolicy fehlen | `REQUIRES_SPIKE` |
| Format | JSON für Verträge, Binär für große Payloads | Alles JSON oder alles binär | Diffbarkeit ohne Größen- und Ladeprobleme | Vorgeschlagen |
| Integrität | Domänensepariertes SHA-256 | Nicht kryptografische Fixture-Hashes | Paket-, Save- und Provenienzintegrität | Vorgeschlagen |
| Authentizität | Signierter offizieller Katalog, Algorithmusprofil als Folgegate | Digest als Identitätsbeweis behandeln | Hash allein beweist keinen Herausgeber | Ownerentscheidung |
| Browser-Speicher | Content-addressed Blobs plus atomarer IndexedDB-Zeiger | CacheStorage als Autorität | Browsercache ist evictable und nicht die Aktivierungstransaktion | Vorgeschlagen |
| Multiplayer | Server besitzt Simulations-Lockset | Client bestimmt Mods oder Semantik | Reproduzierbarkeit und Betrugsschutz | Vorgeschlagen |
| Schlechte Pakete | Quarantäne mit unveränderten Bytes und Diagnosen | Stille Reparatur oder Ersatz | Forensik, Rollback und Save-Recovery | Vorgeschlagen |

## 4. Architekturgrenze

### 4.1 Core Code

Core Code MUSS enthalten:

- gebündelte, versionierte Schemata und die geschlossene Typregistry
- Parser, kanonische Serialisierung und Digestbildung
- Dependency Resolver und Lockfile-Erzeugung
- unveränderliche Content Registry und atomare Aktivierung
- Referenz-, Semantik-, Budget-, Lizenz- und Provenienzprüfer
- vertrauenswürdige, deterministische Migrationshandler
- die versionierten Interpreter für Missionen, NPCs, Fraktionen, Wirtschaft, Städte und Systeme
- Command- und Eventsemantik für persistente Änderungen
- Cache-, Rollback- und Quarantänelogik
- später die serverautorisierte Validierung derselben Verträge

Core Code DARF NICHT von Rendererobjekten, GPU-Indizes oder Cache-Adressen als fachlicher Identität abhängen.

### 4.2 Content-Pakete

Content-Pakete DÜRFEN in v1 enthalten:

- deklarative JSON-Entitäten
- HVOX oder andere ausdrücklich registrierte Autoritätsformate
- Texturen, Audio und GLB-2.0-Vorschauen als gekennzeichnete Payloads
- Lokalisierung
- Provenienz-, Lizenz- und Reviewdaten
- vorab erzeugte Indizes und Renderprodukte, wenn `role: derived` gesetzt ist

Content-Pakete DÜRFEN in v1 NICHT enthalten oder aktivieren:

- JavaScript, TypeScript, WebAssembly, HTML, Shadercode oder native Bibliotheken
- eigene Validatoren, JSON-Schema-Vokabulare oder Migrationscode
- externe Laufzeit-URLs, die Paketbytes oder Semantik nachladen
- Dateisystem-, Netzwerk-, DOM-, Prozess- oder Credentialzugriff

### 4.3 Autoritätsschichten

| Rolle | Bedeutung | Darf allein einen Save rekonstruieren? | Beispiel |
|---|---|---:|---|
| `canonical` | fachliche oder spielmechanische Wahrheit | Ja, zusammen mit exakt gebundenen Verträgen | Mission, Material-ID, HVOX-Zellen, Fraktionsregel |
| `source` | Authoring-Eingabe und Lineage | Nein | Blenderdatei, VOX-Quelldatei, Prompt-Hash |
| `derived` | lösch- und reproduzierbares Produkt | Nein | GLB, Mesh, Collider, AO, GPU-Instanzdaten |
| `provenance` | Herkunft, Review und Rechte | Nein, aber Release-Gate | `provenance.json` |
| `license` | Lizenz- und Noticepflichten | Nein, aber Release-Gate | SPDX-Dokument, Lizenztext |

Der Assetpfad bleibt gerichtet:

```text
authoring source -> normalisierte Autorität -> Asset/HVOX-Vertrag -> abgeleitete Produkte
```

Ein abgeleitetes Produkt MUSS `derivedFrom` mit den kanonischen Digests und der Algorithmusversion angeben. Telemetrie, Laufzeiten und lokale Speicherorte DÜRFEN NICHT in kanonische Content-Digests eingehen.

## 5. Content Package Contract v1

### 5.1 Logische Paketarten

| `packageKind` | Inhalt und Grenze |
|---|---|
| `assets` | Stabile Assetdefinitionen, Autoritätsvolumen, Anker, Proxys und Reviewdaten |
| `missions` | Ziele, Zustände, Übergänge, Bedingungen und Belohnungsreferenzen, keine freien Scripts |
| `npcs` | Archetypen, Rollen, Dialogreferenzen, Zeitpläne und erlaubte Verhalten-Graphknoten |
| `factions` | Beziehungen, Gesetze, Reputation, Eigentum und Zugriffspolitik |
| `economy` | Items, Rezepte, Märkte, Preiseingaben, Produktions- und Verbrauchsregeln |
| `cities` | Siedlungen, Zonen, Dienste, Bauvorlagen und stabile Standortreferenzen |
| `systems` | Himmelskörper, Routen, Systemmetadaten und Referenzen auf Generatorprofile |
| `materials` | Globale Materialidentitäten und getrennte visuelle, physische und destruktive Profile |
| `localization` | Lokalisierte Texte, niemals die stabile fachliche ID |
| `generator-config` | Parameter für einen im Core registrierten Generator, kein Generatorcode |
| `bundle` | Reines Metapaket mit Dependencies, ohne eigene fachliche Exporte |

Ein Paket SOLL genau eine primäre Paketart haben. Domänenübergreifende Inhalte werden über Dependencies verbunden, nicht in einem unprüfbaren Megapaket gesammelt.

### 5.2 Logische Struktur

```text
package-manifest.json
content/<domain>/<stable-slug>.json
assets/<stable-slug>/...
meta/provenance.json
meta/licenses.spdx.json
meta/license-texts/...
integrity/package.sha256
signatures/...                 erst in einem später gepinnten Signed-Envelope-Profil
```

Der Vertrag ist vom Archivcontainer unabhängig. Ein späteres `.hpack` darf ein deterministisches Archiv sein, aber Archivformat, Kompression und Signaturprofil sind nicht Teil des ersten Registry-Spikes.

### 5.3 Beispielmanifest

Das folgende Objekt ist ein normativer Formvorschlag, keine bereits veröffentlichte Datei:

```json
{
  "$schema": "urn:weltraum:schema:content-package-manifest:1",
  "format": "weltraum-content-package",
  "packageFormatVersion": 1,
  "packageId": "hestia.core:wetland-assets",
  "namespace": "hestia.core",
  "packageVersion": "1.4.0",
  "packageKind": "assets",
  "impactClass": "simulation",
  "contentApiRange": {
    "minInclusive": "1.0.0",
    "maxExclusive": "2.0.0"
  },
  "dependencies": [
    {
      "packageId": "hestia.core:materials",
      "versionRange": {
        "minInclusive": "1.2.0",
        "maxExclusive": "2.0.0"
      },
      "optional": false
    }
  ],
  "conflicts": [],
  "requestedCapabilities": [
    "content.define.asset"
  ],
  "exports": [
    {
      "entryId": "hestia.core:asset/wetland-alder-mature-a",
      "kind": "asset",
      "schemaId": "urn:weltraum:schema:asset:1",
      "schemaVersion": 1,
      "contentRevision": 3,
      "path": "content/assets/wetland-alder-mature-a.json"
    }
  ],
  "files": [
    {
      "path": "content/assets/wetland-alder-mature-a.json",
      "role": "canonical",
      "mediaType": "application/json",
      "byteLength": 1842,
      "sha256": "sha256:0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef"
    },
    {
      "path": "assets/wetland-alder-mature-a/proxy/lod0.glb",
      "role": "derived",
      "mediaType": "model/gltf-binary",
      "byteLength": 48128,
      "sha256": "sha256:abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789",
      "derivedFrom": [
        {
          "entryId": "hestia.core:asset/wetland-alder-mature-a",
          "contentRevision": 3,
          "canonicalPayloadSha256": "sha256:3333333333333333333333333333333333333333333333333333333333333333"
        }
      ],
      "derivationId": "hestia.core:gltf-preview-pipeline/1"
    },
    {
      "path": "meta/provenance.json",
      "role": "provenance",
      "mediaType": "application/json",
      "byteLength": 912,
      "sha256": "sha256:1111111111111111111111111111111111111111111111111111111111111111"
    },
    {
      "path": "meta/licenses.spdx.json",
      "role": "license",
      "mediaType": "application/spdx3+json",
      "byteLength": 2064,
      "sha256": "sha256:2222222222222222222222222222222222222222222222222222222222222222"
    }
  ],
  "provenancePath": "meta/provenance.json",
  "licenseManifest": {
    "path": "meta/licenses.spdx.json",
    "spdxSpecificationVersion": "3.0.1",
    "spdxLicenseListVersion": "3.28.0",
    "profiles": ["Core", "Software"],
    "validationProfileId": "urn:weltraum:spdx-validation-profile:1"
  }
}
```

Die Beispielhashes sind Platzhalter und keine Evidenzbytes.

### 5.4 Geschlossene Manifeste

- Das äußere Schema MUSS auf JSON Schema Draft 2020-12 basieren und `additionalProperties: false` verwenden.
- `schemaId` MUSS auf ein im Core gebündeltes, über einen `schemaSetDigest` gebundenes Schema zeigen. Untrusted Pakete dürfen keine entfernten Schemata nachladen.
- Unbekannte Versionen, Rollen, Paketarten, Impactklassen und Capabilities sind Hard Fail.
- Fehlende Information wird durch ein diskriminiertes Statusobjekt dargestellt, nicht durch `0`, leeren String oder mehrdeutiges `null`.
- Projekteigene Vertrags-JSON-Payloads in einem Release werden nach RFC 8785 kanonisiert. Authoring-Quellen dürfen lesbar formatiert sein. Eingebettete standardeigene JSON-Serialisierungen wie SPDX JSON-LD folgen ihrem gepinnten Validierungs- und Serialisierungsprofil; ihr exakter ausgelieferter Byteinhalt bleibt durch den Paketdigest gebunden.

### 5.5 Pfadvertrag

Jeder Paketpfad MUSS:

- relativ und POSIX-artig sein
- nur `a-z`, `0-9`, `.`, `_`, `-` und `/` enthalten
- höchstens 512 UTF-8-Bytes lang sein
- aus nicht leeren Segmenten bestehen

Pfade mit führendem Slash, Backslash, Doppelpunkt, NUL, Großbuchstaben, `.`- oder `..`-Segment, abschließendem Slash, Symlink oder Spezialdatei werden abgelehnt. Es findet keine stille Unicode-, Groß-/Kleinschreibungs- oder Separatornormalisierung statt.

### 5.6 Vollständiger Paketdigest und Authority-Digest

Der Paketdigest lautet:

```text
sha256:<64 lowercase hex>
```

Der vollständige `packageDigest` wird mit der Domäne `weltraum-content-package-sha256-v1\0` über folgende logische Dateien gebildet:

1. die kanonischen Bytes von `package-manifest.json`
2. jede exakt im Manifest gelistete Payload

Das exakte Framing lautet:

```text
utf8("weltraum-content-package-sha256-v1") || 0x00
u32be(fileCount)
for each logical file sorted by unsigned UTF-8 path bytes:
  u32be(pathUtf8Length)
  pathUtf8
  u64be(contentByteLength)
  contentBytes
```

`package-manifest.json` nimmt dabei als normaler logischer Pfad teil; `fileCount` ist daher `1 + manifest.files.length`. Im unsigned v1-Profil ist ausschließlich `integrity/package.sha256` als äußere Envelope-Datei zulässig und vom eigenen Digest ausgenommen. Ein späteres versioniertes Signed-Envelope-Profil darf exakt aufgezählte detached Signaturdateien zusätzlich erlauben; auch sie bleiben außerhalb des Paketdigest. Jede andere unbekannte Envelope-Datei, jede nicht manifestierte Payload, fehlende Datei, Längenabweichung oder Digestabweichung ist Hard Fail. Gate G13.1 muss dafür Golden Vectors inklusive Nullbyte, Endianness und leerer beziehungsweise einzelner Payloadmenge festlegen.

Zusätzlich berechnet der Validator einen `authorityDigest` mit der Domäne `weltraum-content-authority-sha256-v1\0`. Sein kanonischer Deskriptor enthält:

- `packageId`, Paketart, effektive Impactklasse und deklarative Capabilities
- alle Exportdeskriptoren mit ID, Kind, Schema, Contentrevision und Pfad
- ausschließlich Payloads der Rolle `canonical`
- für JSON deren RFC-8785-Bytes
- für ein registriertes Autoritätsformat dessen normativ decoded Digest
- andernfalls den exakten Payload-Byte-Digest

`source`, `derived`, `provenance`, `license`, Paketversion, Signaturen und Transportmetadaten gehen nicht in den `authorityDigest` ein. Sie bleiben vollständig durch den `packageDigest` geschützt. Damit kann eine neue, unveränderliche Paketversion nur Provenienz oder Derived-Produkte verbessern, ohne bestehende Saves semantisch umzudeuten. Dieselbe Paketversion mit einem anderen `packageDigest` bleibt trotzdem Korruption oder unzulässiges Überschreiben.

Ein decoded Digest ist nur zulässig, wenn das registrierte Format Decodierung, Reihenfolge, Zahlenrepräsentation und Fehlerfälle normativ definiert. Für HVOX kann damit der Hash der logisch dekodierten Zellfolge über eine reine Container- oder Kompressionsänderung stabil bleiben. Der Byte-Digest schützt weiterhin die konkret ausgelieferte Datei.

### 5.7 Versionsachsen

| Achse | Bedeutung | Darf still gekoppelt werden? |
|---|---|---:|
| `packageFormatVersion` | Manifest- und Containervertrag | Nein |
| `packageVersion` | SemVer des veröffentlichten fachlichen Pakets | Nein |
| `schemaId` und `schemaVersion` | Form und Semantik eines Entitätstyps | Nein |
| `contentRevision` | Semantische Revision einer stabilen Entität innerhalb der Paketlinie | Nein |
| `contentApiRange` | kompatible Core-Interpreteroberfläche | Nein |
| `resolverVersion` | genaue Auflösungs- und Sortiersemantik | Nein |
| `generatorVersion` und `generatorDigest` | ABI-Bezeichnung und exakte Generatorimplementierung | Nein |
| `derivationId` | Exporter, Mesher, Collider- oder Renderalgorithmus | Nein |
| `contentEpoch` | atomarer Registrywechsel in einer laufenden Sitzung | Nein |
| `worldRevision` | persistente Änderung des Weltzustands | Nein |

SemVer 2.0.0 beschreibt Autorenabsicht. Ein Save verlässt sich trotzdem niemals nur auf Versionsbereiche. Eine veröffentlichte Kombination aus `packageId` und `packageVersion` MUSS unveränderlich sein. Gleiche Version mit anderem Digest bedeutet Korruption oder unzulässiges Überschreiben.

### 5.8 Impactklassen

| `impactClass` | Erlaubte Wirkung | Save- und Serverrelevanz |
|---|---|---|
| `editor-only` | Authoring-Quellen, Reviewbelege und Werkzeugeingaben | nicht in einem Runtime-Loadset |
| `cosmetic` | Darstellung ohne Einfluss auf IDs, Kollision, Mission, Wirtschaft, Zeit, Zufall oder Regeln | optional und separat allowlistbar |
| `simulation` | fachliche Definitionen und Autorität, die Spielzustand beeinflussen | Teil des `authorityLockDigest` |
| `generator` | Basiswelt, Koordinaten-, Materialisierungs- oder Spawnsemantik | Teil des `authorityLockDigest`, strengste Migration |

Die Klasse ist kein ungeprüftes Publisher-Versprechen. Schemata, Capabilities, Payloadrollen und die nicht optionalen Dependency-Closure bestimmen eine minimale effektive Klasse. Der Validator darf nur nach oben stufen und lehnt eine zu niedrige Deklaration ab. Ein `assets`-Paket kann daher kosmetisch oder simulationsrelevant sein. Ein HVOX-Volumen mit Kollisions- oder Materialautorität ist nicht kosmetisch.

Minimale v1-Zuordnung:

| Inhalt oder Wirkung | Minimale effektive Klasse |
|---|---|
| reine Lokalisierung, Textur, Audio oder Renderproxy ohne regelrelevante Metadaten | `cosmetic` |
| Mission, NPC, Fraktion, Item, Rezept, Markt, Stadt, System, Gesetz oder Service | `simulation` |
| Material mit Kollision, Masse, Reibung, Destruction oder Gameplaytags | `simulation` |
| Asset mit autoritativen Zellen, Collider-, Anker-, Portal-, Massen- oder Interaktionsdaten | `simulation` |
| Generatorprofil, Koordinaten-, Spawn-, Materialisierungs- oder Edge-Ownership-Regel | `generator` |
| `bundle` | höchste Klasse seiner nicht optionalen und aktivierten optionalen Dependency-Closure |

Ein kosmetisches Paket DARF keine simulationsrelevanten Exporte oder Capabilities anfordern und DARF kein Pflichtprovider für Simulation sein. Paketart, Exportkind und Capability müssen zur geschlossenen `contentTypeRegistryVersion` passen. Eine Abweichung ist Hard Fail.

## 6. ID- und Namespace-Regeln

### 6.1 Formate

```text
PackageId: <namespace>:<package-slug>
EntryId:   <namespace>:<kind>/<local-slug>
```

Beispiele:

```text
hestia.core:materials
hestia.game:missions
hestia.core:material/basalt
hestia.game:mission/first-beacon
org.example.biomes:asset/sulfur-marsh-reed
```

### 6.2 Normative Regeln

- Namespace-Segment: `[a-z](?:[a-z0-9-]{0,30}[a-z0-9])?`, höchstens 32 Zeichen, kein abschließender Bindestrich.
- Namespace: zwei bis acht mit Punkt getrennte Segmente, insgesamt höchstens 127 Zeichen.
- Slug: `[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?`, höchstens 64 Zeichen.
- Kind stammt aus der geschlossenen, versionierten Content-Type-Registry und erfüllt dieselbe Sluggrammatik. v1 reserviert mindestens `asset`, `mission`, `npc`, `faction`, `item`, `recipe`, `market`, `city`, `system`, `material`, `localization`, `generator-profile`, `dialogue`, `schedule`, `law`, `route`, `body`, `building` und `service`.
- `PackageId` ist höchstens 192 Zeichen, `EntryId` höchstens 257 Zeichen. Parser akzeptieren genau die oben angegebene Grammatik, keine Unicode- oder Case-Normalisierung.
- Ein Namespace SOLL DNS-artig sein. Offizielle Präfixe werden zentral reserviert. Community-Publisher weisen Domain- oder Registrybesitz nach.
- `PackageId` und `EntryId` sind nach einer Veröffentlichung unveränderlich und dürfen nach Entfernung niemals für andere Semantik wiederverwendet werden.
- Anzeigenamen, Übersetzungen, Ordner und Dateinamen DÜRFEN sich ändern, ohne die ID zu ändern.
- Umbenennungen erfolgen über eine versionierte Alias- oder Migrationsregel. Aliase zeigen direkt auf eine terminale ID; Aliasverkettungen, Zyklen, Selbstaliase und Kollisionen mit Tombstones sind Hard Fail. Entfernte IDs erhalten Tombstones, solange unterstützte Saves sie referenzieren.
- Eine Definition verweist immer mit vollständiger `EntryId`, nie mit relativem Slug oder Arrayindex.
- Lokale `Uint8`-Materialslots, Tabellenindizes und GPU-Instanzindizes sind kompilierte Darstellungen. Wenn ein Save Slotbytes enthält, MUSS er die exakte Palette und deren Digest binden.
- Laufzeitinstanzen verwenden ein separates, opakes Instanz-ID-Schema. UUIDv7 ist für neu erzeugte Instanzen und Events geeignet; deterministisch generierte Instanzen benötigen stattdessen eine versionierte Ableitung aus Generator, Ort und Spawnregel.

### 6.3 Namespace-Governance

Empfohlene Policy:

- `hestia.core.*` oder ein vom Owner festgelegtes offizielles Präfix: nur signierte First-Party-Releases.
- verifizierte Publisher: gebundener Reverse-DNS-Namespace.
- lokale, unveröffentlichte Mods: ein Namespace nach dem Muster `local.<installation-slug>`, wobei `<installation-slug>` die obige Segmentgrammatik erfüllt; nicht ohne explizite ID-Migration veröffentlichbar.
- Namespaces sind nicht übertragbar, ohne eine signierte Registry-Migration und sichtbare Provenienzänderung.

Die endgültigen offiziellen Präfixe sind eine Ownerentscheidung.

## 7. Schemas und Migrationen

### 7.1 Schema-System

- Der Core bündelt alle aktivierbaren v1-Schemata und bindet sie in einem `schemaSetDigest`.
- Syntaxprüfung und semantische Prüfung sind getrennte Stufen.
- JSON Schema prüft Form und Grundtypen. Core-Validatoren prüfen referenzielle Integrität, Graphzyklen, Eindeutigkeit, Budgets, Fachinvarianten, Save-Auswirkungen und Autoritätsgrenzen.
- Unbekannte Schemaversionen sind Hard Fail. Vorwärtskompatibilität wird nicht durch Ignorieren unbekannter Felder vorgetäuscht.
- Erweiterbarkeit erfolgt durch neue Schemaversionen oder ausdrücklich definierte namespaced Extension Points.

### 7.2 Vier Migrationsklassen

| Klasse | Beispiel | Ausführung |
|---|---|---|
| Entitätsschema | Mission v1 nach v2 | deterministischer Core-Migrator |
| ID und Referenz | alte Material-ID auf neue ID | deklarative Mappingregel plus Referenzscan |
| Save und Paketset | Save mit Lock A auf Lock B | atomare Save-Kopie, vollständige Nachvalidierung |
| Generator und Welt | Generator A plus Edits auf gebackene Basis B | eigener, beweispflichtiger Weltmigrationspfad |

### 7.3 Migrationsvertrag

Jede Migration MUSS angeben:

- stabile `migrationId` und `migrationContractVersion`
- eine endliche Menge exakter Source-Authority-Lock-Digests oder eine geschlossene, versionierte Source-Vertragsprädikats-ID
- exakten Target-Authority-Lock-Digest und Ziel-Schemaset
- betroffene ID-Räume und erwartete Referenzänderungen
- `lossiness: lossless | lossy` und bei `lossy` eine nicht delegierbare, protokollierte Benutzerzustimmung
- `migratorCodeDigest` für Core-Code oder `operationsDigest` für eine deklarative Migration
- deterministische ID-Ableitung und ein vollständiges Old-to-New-Mappingprotokoll
- Ressourcenlimits, CAS-Preconditions und Algorithmusversionen
- Preflight-, Dry-Run- und Abbruchdiagnosen
- erwartete Ausgabedigest oder eine reproduzierbare Digestregel

Migrationen laufen nie in-place:

1. Eingabe unverändert öffnen.
2. Ausgabe in einem neuen, unveränderlichen Objekt erzeugen.
3. Ziel vollständig validieren.
4. Ausgabe und Migrationsprotokoll committen.
5. Erst danach den aktiven Zeiger atomar wechseln.

Bei Fehler bleibt das Original aktiv. Ein Down-Migrator ist nicht automatisch geschuldet. Beliebiger Migrationscode aus einem Mod-Paket ist in v1 verboten. Komplexe Handler sind Core-Code und benötigen Review, Pin und eigene Tests.

Eine verlustreiche Migration läuft niemals automatisch, im Hintergrund oder als Folge eines Hot Reloads. Die protokollierte Zustimmung bindet Source, Target, angezeigte Verluste und Migrationsdigest.

### 7.4 Backward-Compatibility-Politik

Empfehlung:

- Exakte Reproduzierbarkeit ist die Basisgarantie.
- Eine neue Core-Version lädt einen alten Save nur mit exakt verfügbarem Lockset oder einer ausdrücklich zertifizierten Migrationskette.
- Keine automatische Auswahl des neuesten kompatibel aussehenden Pakets.
- Unterstützte Migrationskanten bilden einen gerichteten Graphen. Jede tatsächlich verwendete Kante wird im Save protokolliert.
- Die Aufbewahrungsdauer alter Pakete und Generatoren ist eine Ownerentscheidung und muss vor Produktrelease als Supportfenster dokumentiert werden.

## 8. Dependencies, Lockfile, Load Order und Konflikte

### 8.1 Resolververtrag

- Authoring-Manifeste deklarieren SemVer-Bereiche als explizite `minInclusive`-, optionale `maxExclusive`- und `allowPrerelease`-Felder. Prereleases sind standardmäßig ausgeschlossen; bei `allowPrerelease: true` muss der Bereich eine konkrete Prerelease-Untergrenze nennen.
- Der v1-Resolver wählt genau eine Version je `packageId`.
- Der Abhängigkeitsgraph MUSS azyklisch sein.
- Alle nicht optionalen Dependencies müssen vorhanden sein und ihre Bereiche erfüllen.
- Jede optionale Dependency besitzt genau eine stabile `featureId`. Aktivierte Rootfeatures sind Resolverinput; transitive Features müssen durch eine gebundene Kante ausgelöst werden.
- Ein Konfliktobjekt bindet `packageId`, Versionsbereich und stabilen `reasonCode`.
- Roots, Featureauswahl, Publisherpins und jede Auswahlpräferenz unter mehreren Lösungen sind explizite Resolverinputs.
- Abhängigkeiten werden zuerst aktiviert. Eindeutige Ties werden nach rohen UTF-8-Bytes der `packageId` sortiert. `activationOrder` wird daraus berechnet und beim Laden neu verifiziert, nicht blind vertraut.

### 8.2 `content-lock.json`

Der vollständige Lock MUSS mindestens enthalten:

```text
lockFormatVersion
resolverVersion
contentApiVersion
schemaSetDigest
contentTypeRegistryVersion
roots[] {
  packageId
  requestedVersionRange
  enabledFeatures[]
}
packages[] {
  packageId
  packageVersion
  packageDigest
  authorityDigest
  declaredImpactClass
  effectiveImpactClass
  enabledFeatures[]
}
resolvedDependencies[] {
  fromPackageId
  toPackageId
  declaredVersionRange
  optional
  featureId optional
}
activationOrder[]
```

`packages[]`, Roots, Features und Kanten haben jeweils normative UTF-8-Sortierungen. Der `contentLockDigest` wird mit `weltraum-content-lock-sha256-v1\0` über die kanonischen Lockbytes gebildet und außerhalb des eigenen Hashinputs gespeichert. Er bindet die exakten ausgelieferten Pakete einschließlich Source-, Derived-, Provenienz- und Lizenzbytes.

Aus dem validierten Lock und dem Aktivierungsrecord wird zusätzlich ein kanonischer Authority-Lock abgeleitet:

```text
authorityLockFormatVersion
simulationContractDigest
schemaSetDigest
contentTypeRegistryVersion
packages[] {
  packageId
  authorityDigest
  effectiveImpactClass: simulation | generator
  grantedCapabilities[]
}
resolvedAuthorityDependencies[]
```

Der `authorityLockDigest` verwendet `weltraum-content-authority-lock-sha256-v1\0`. Saves, Welt-Events und Multiplayer-Server binden diesen Digest als Semantikvertrag. Der Policyprofildigest bleibt im Aktivierungsrecord; nur sein effektives Ergebnis, Paketmenge und Grants, geht in den Authority-Lock ein. Ein optionaler `presentationLockDigest` kann die tatsächlich aktive kosmetische Auswahl binden, ohne Weltsemantik zu behaupten.

Der veränderliche Katalog gehört nicht in den Authority-Lock. Ein separater, unveränderlicher Resolution Record bindet `catalogDigest`, Roots, Feature- und Publisherauswahl, Resolverversion, Auswahlpräferenzen, `contentLockDigest` und Ergebnis. Sein `resolutionRecordDigest` dient Audit und Reproduktion, nicht als Spielsemantik.

Jeder Release und jedes aktive Loadset besitzt den vollen Content Lock. Ein Save bettet ihn für Reproduktion ein, entscheidet Normal-Load und Migration jedoch anhand von `authorityLockDigest`, `simulationContractDigest` und den nachfolgend definierten Verträgen.

### 8.3 Konfliktregeln für v1

- Zwei Exporte derselben `EntryId` sind Hard Fail.
- Fehlende oder mehrdeutige Referenzen sind Hard Fail.
- Paketdeklarationen können inkompatible Paket-IDs oder Bereiche in `conflicts` nennen. Ein betroffenes Loadset wird nicht aktiviert.
- Es gibt kein implizites `last file wins`.
- Der empfohlene v1-Modumfang ist additiv. Änderungen an First-Party-Definitionen erfolgen über ausdrücklich bereitgestellte Extension Points, nicht über allgemeines JSON-Patching.
- Kann der Resolver mehrere gültige Loadsets bilden, muss der Benutzer oder Publisher wählen. Die Wahl wird als exakter Lock persistiert.

Ein späterer Patchvertrag braucht Target-Digest, JSON-Pointer, Operation, Precondition-Digest, deterministische Reihenfolge, Mehrfachwrite-Konflikt und Save-Impact. Er ist ein separates Gate und nicht Teil des ersten Spikes.

## 9. Hot-Reload-Architektur im Developer Mode

### 9.1 Transaktion

1. Der Devserver meldet nur Workspace-ID, Paket-ID, Working-Revision und Kandidatendigest.
2. Ein Loader erzeugt unter neuer `loaderGeneration` und `loadsetRevision` ein isoliertes `working-candidate`-Loadset. Eine Draft-SemVer darf dabei unverändert bleiben; der Kandidatendigest identifiziert jeden Editstand.
3. Archiv-, Pfad-, Größen-, Digest-, Parse-, Schema-, Referenz-, Dependency-, Semantik-, Lizenz- und Policyprüfungen laufen vollständig.
4. Reverse Dependencies werden bestimmt und mitvalidiert.
5. Erforderliche Derived-Artefakte werden unter Kandidatenschlüsseln gebaut. Sie verändern die aktive Registry nicht.
6. Der Main Thread prüft Identität, Generation, `contentEpoch`, Lockdigest und Ergebnisstruktur erneut.
7. Die Aktivierung wartet auf einen typgerechten Safe Point. Simulationsrelevante Änderungen in einer aktiven Welt sind in v1 grundsätzlich `restart-required` oder `migration-required`.
8. Ein einziger Zeigerwechsel veröffentlicht die neue unveränderliche Registry und erhöht `contentEpoch`.
9. Consumer erhalten ein versioniertes `registryChanged`-Ereignis. Stale Worker-Ergebnisse werden verworfen.
10. Bei jedem Fehler bleibt das letzte gültige Loadset aktiv. Ein lokaler Working Candidate erhält `rejected` samt Diagnosen und kann weiter editiert werden. Nur empfangene, installierte oder veröffentlichte Artefakte mit Integritäts-, Security- oder Policyfehlern gehen in Quarantäne.

Vite-HMR kann im Developer Mode als Transport dienen, aber der Content-Reload-Vertrag bleibt bundlerunabhängig und hängt nicht von `FileSystemObserver` ab.

### 9.2 Erforderliche Kandidatenidentität

```text
requestId
workspaceId
workingRevision
loaderGeneration
contentEpoch
loadsetRevision
packageId
packageVersion
packageDigest
resolverVersion
schemaSetDigest
contentLockDigest
authorityLockDigest
```

Erlaubte Terminalzustände umfassen `adopted`, `restart-required`, `migration-required`, `superseded`, `stale-content-epoch`, `old-loader-generation`, `digest-mismatch`, `schema-invalid`, `semantic-invalid`, `dependency-invalid`, `policy-rejected`, `draft-rejected`, `quarantined`, `cancelled` und `timeout`.

### 9.3 Safe-Point-Matrix

| Änderung | Developer-Verhalten |
|---|---|
| Nur Derived-Proxy oder kosmetische Darstellung, gleicher `authorityDigest` | Swap an Framegrenze, Cache neu aufbauen |
| Neue Definition in einem schemaexplizit isolierten Registrysegment ohne Enumeration-, Spawn-, Zufalls- oder andere Consumerwirkung | atomarer Registry-Swap nach belegter Isolation |
| Sonstige neue simulationsrelevante Definition | Sessionneustart oder vollständige Welttransaktion |
| Aktive Mission, NPC-, Fraktions- oder Wirtschaftsdaten | `migration-required`; kein bloßer Tickgrenzen-Swap |
| ID-Entfernung, Typwechsel oder Dependency-Entfernung | keine Live-Aktivierung ohne explizite Migration |
| Physische Materialsemantik | Migration oder Sessionneustart, niemals nur Palette neu binden |
| Generator, Koordinatenvertrag oder Edge Ownership | neue Welt oder zertifizierte Weltmigration |
| Core API, Schema-Set oder Resolversemantik | Runtime-Neustart |

Hot Reload ist ein Authoring-Werkzeug, keine Begründung für mutable Produktionspakete. Eine Save-Operation MUSS vollständig an eine Registryepoch gebunden sein und darf keinen Registrywechsel überspannen.

Runtime-Handles und persistente Instanzen tragen `contentEpoch` oder Rootdigest. Cross-Epoch-Zugriffe sind Hard Fail. Eine spätere simulationsrelevante Live-Adoption braucht eine atomare Welttransaktion mit altem und neuem Root, Event-Writer-Pause, Dry Run, vollständiger Zustandsmigration, Nachvalidierung und Rollback. Dieser Pfad ist nicht Teil von v1.

## 10. Saves, Generatoren und persistente Edits

### 10.1 Save-Manifest

```text
saveSchemaVersion
saveRevision
coreBuildId
simulationContractDigest
contentLockDigest
embeddedContentLock
authorityLockDigest
presentationLockDigest optional
schemaSetDigest
worldManifestDigest
worldRevision
checkpointWorldRevision
eventHeadDigest
eventSequence
eventCount
generatorBindings[] {
  generatorId
  generatorVersion
  generatorDigest
  pipelineVersion
  stageVersions[]
  seed
  coordinateSchemaVersion
}
materialRegistryDigest
paletteBindings[]
editJournalSchemaVersion
editJournalDigest
latestCheckpointDigest
migrationHistory[]
stableEntityReferences[]
tombstonePolicyVersion
```

`simulationContractDigest` bindet die Core-Semantik von Missionen, NPCs, Wirtschaft, Physik, Zufall, Eventoperationen und Persistenz, nicht nur eine allgemeine Buildbezeichnung. Der eingebettete volle Content Lock belegt die erwarteten Artefakte. Er ersetzt nicht zwingend die Paketbytes. Ein späterer Portable-Save-Modus kann erforderliche Paketbytes beilegen, soweit deren Rechte- und Vertriebsgrundlage dies erlaubt.

### 10.2 Weltzustandsmodell

```text
Weltzustand bei Revision N
= exakte Generatorbasis oder kompatibler Checkpoint
+ alle überlappenden, total geordneten Events nach dem Checkpoint
```

- Generatoren werden mit ABI-Version und exaktem Implementierungsdigest gebunden.
- Globale Freeze-per-World ist die sichere v1-Policy. Gemischte Generatorgenerationen benötigen einen Seam- und Migrationsspike.
- Ein deterministisches primitives Event trägt Operations- und Quantisierungsversion.
- Eine zustandsabhängige Operation wie komplexe Fraktur speichert als Replay-Autorität die finalen, sortierten `ResolvedDelta`-Daten. Der ursprüngliche Befehl bleibt Provenienz.
- Events sind unveränderlich, total geordnet und hashverkettet. Checkpoints verkürzen Replay, ändern aber nicht die Semantik.
- Unbekannte oder nicht geladene Coverage ist nicht `Air`. Loader und Save unterscheiden mindestens `known-empty`, `unloaded`, `missing` und `invalid`.

Jeder autoritative Eventbatch bindet mindestens:

```text
eventBatchSchemaVersion
previousWorldRevision
resultWorldRevision
previousEventHeadDigest
resultEventHeadDigest
firstSequence
eventCount
authorityLockDigest
simulationContractDigest
payloadDigest
```

Die obigen Felder sind ein semantischer Zielvertrag. Exaktes Event-, Checkpoint-, Kompressions- und Binärformat samt deterministischem Profil und Golden Vectors ist noch `REQUIRES_SPIKE` und muss vor Gate G13.4 festgelegt werden.

### 10.3 Materialidentität

```text
stabile Identität: hestia.core:material/basalt
lokaler Slot:       Uint8 0..255
```

Der WP04-Slot ist eine lokale kompilierte Darstellung. Jede gespeicherte Slotfolge bindet eine unveränderliche Palette aus stabilen IDs samt Digest. Visuelle/AO-, physische, destruktive, Audio- und Gameplayprofile sind getrennte Schemalagen unter derselben stabilen Material-ID. Eine Slotumlegung benötigt explizite Migration.

### 10.4 Save- und Content-Kompatibilitätsmatrix

| Zustand | Modus | Normatives Verhalten |
|---|---|---|
| Exakter `contentLockDigest`, `authorityLockDigest` und `simulationContractDigest` vorhanden | Normal | direkt laden |
| Voller Content Lock abweichend, aber Authority- und Simulationsvertrag identisch und alle neuen Artefakte bestehen die Installationspolicy | Normal | Autorität laden, Derived-Caches regenerieren, neue Präsentationswahl protokollieren |
| Optionales, nachweislich kosmetisches Paket fehlt | Degraded | Placeholder erlaubt, Warnung persistieren |
| Gameplay-, Mission-, NPC-, Fraktions-, Wirtschafts-, Stadt-, System-, Material- oder Generatorpaket fehlt | Blockiert | kein normaler Load |
| Veröffentlichte gleiche Paketversion, anderer `packageDigest` | Quarantäne | als Korruption oder ungetrackte Mutation behandeln; Draft-Kandidaten sind ausgenommen |
| Zertifizierte vollständige Aufwärtsmigration vorhanden | Migration | neue Save-Kopie erzeugen, Original behalten |
| Migration teilweise fehlgeschlagen | Blockiert | atomarer Abort, kein Teilstand |
| Generatorversion oder Implementierungsdigest fehlt | Blockiert | alten Generator bereitstellen, backen oder explizit migrieren |
| Material-ID oder physische Semantik geändert | Migration | gespeicherte Referenzen und betroffene Zustände migrieren |
| Mod entfernt, Save referenziert Mod-IDs | Recovery | fehlende IDs zeigen, nichts automatisch löschen |
| Neueres Save-Schema in älterem Build | Blockiert | außer ein nachweislich verlustfreier Down-Migrator existiert |
| `simulationContractDigest` weicht ab | Blockiert oder Migration | nur mit zertifizierter Core-Kompatibilität oder atomarer Save-Migration laden |
| Edit-Journal-Digest oder Hashkette weicht ab | Quarantäne | CAS-Konflikt, keine Teilanwendung oder stiller Retry |
| Load Order oder Featuremenge geändert | Migration oder neue Branch | niemals denselben Save still neu interpretieren |

## 11. Modding-Policy und Sicherheit

### 11.1 Optionen

| Option | Inhalt | Vorteil | Risiko und Aufwand | Urteil |
|---|---|---|---|---|
| A: additive Datenmods | neue Definitionen, Referenzen und freigegebene Extension Points | prüfbar, portabel, serverfähig | weniger Ausdrucksmacht | **Empfehlung für v1** |
| B: deklarative Ausdrucks- oder Graph-DSL | begrenzte, total definierte Operationen | mehr Verhalten ohne allgemeinen Code | Interpreter, Budget- und Determinismusvertrag nötig | späterer Spike |
| C: Capability-Wasm | Module mit expliziten Hostimports | kontrollierbarer als JS | Fuel, Speicher, Abbruch, Determinismus, ABI und Serverpolicy nötig | späterer Security-Spike |
| D: JavaScript im Spiel-Origin | beliebige Web-APIs | maximale Flexibilität | Worker schützt nicht vor Originzugriff, Exfiltration oder DoS | `NO_GO` für untrusted Mods |

### 11.2 Capabilities in v1

Mögliche deklarative Capabilities:

```text
content.define.asset
content.define.mission
content.define.npc
content.define.faction
content.define.economy
content.define.city
content.define.system
content.define.material
content.define.localization
presentation.cosmetic
```

Eine angeforderte Capability ist keine Erlaubnis. Das Manifest enthält ausschließlich `requestedCapabilities`. Die Installationspolicy gleicht Publisher-Trust, Paketart, effektive Impactklasse und Anfrage ab. Der unveränderliche Aktivierungsrecord enthält:

```text
activationRecordVersion
registryRootDigest
policyProfileDigest
packages[] {
  packageId
  packageDigest
  authorityDigest
  grantedCapabilities[]
}
grantedCapabilitiesDigest
```

Server berechnen Grants selbst. Ein Paket-, Client- oder Save-Lock kann Berechtigungen niemals erweitern. Eine Grantänderung erzeugt einen neuen Aktivierungsroot und, wenn sie Authority sichtbar macht oder entfernt, einen neuen `authorityLockDigest` mit Save-Impact. `content.patch.*`, Netzwerk, Dateisystem, DOM, Credentials, Prozesszugriff und ausführbarer Code fehlen in v1 bewusst.

### 11.3 Load Order und Benutzerentscheidung

- Der Resolver bestimmt eine kanonische technische Reihenfolge.
- Semantische Konflikte werden nicht durch Reihenfolge gelöst.
- Bei alternativen kompatiblen Loadsets wählt der Benutzer oder Server explizit. Die Wahl wird im Lock festgeschrieben.
- Eine spätere Deaktivierung eines Mods erzeugt eine Save-Kompatibilitätsprüfung und gegebenenfalls einen neuen Weltbranch.
- Multiplayer-Server verteilen oder erlauben einen exakten Mod-Lock. Clients können ihn nicht überschreiben.

### 11.4 Intake- und Ressourcenpolicy

Vor Parse oder Decoderausführung gelten harte Grenzen für:

- komprimierte und entpackte Gesamtgröße
- Datei-, Verzeichnis- und Verschachtelungszahl
- Kompressionsverhältnis und verschachtelte Archive
- JSON-Tiefe, Properties, Arrays, Stringlänge und Referenzzahl
- Bild-, Audio-, GLB- und Volumendimensionen
- CPU-Zeit, Arbeitsspeicher und temporären Speicher

Abgelehnt werden absolute und Traversalpfade, Symlinks, Spezialdateien, normalisierte Pfadkollisionen, doppelte JSON-Keys, unsichere Ganzzahlen, unbekannte Medien, externe URIs und Decoderergebnisse außerhalb deklarierter Limits. Archive werden in einen isolierten Kandidatenbereich entpackt. Hash und Struktur werden vor Aktivierung erneut geprüft.

Ein Dedicated Worker verbessert Responsiveness und Fehlerisolation, ist aber keine Sicherheitsgrenze. CSP ist Defense in Depth. Signaturen ersetzen weder Schema-, Semantik- noch Ressourcenprüfung.

### 11.5 Integrität und Authentizität

- SHA-256 ist Pflicht für Paket-, Lock-, Save-, Snapshot- und Provenienzidentität.
- Ein Digest belegt Inhalt, aber nicht den Herausgeber.
- Offizielle Distribution SOLL einen signierten, widerrufbaren Katalog verwenden, der Paket-ID, Version und Digest bindet.
- Lokale unsigned Mods können nach ausdrücklicher Benutzerfreigabe installiert werden, aber niemals als official oder server-trusted gelten.
- Das genaue Signaturprofil, Browsermatrix, Key-Rotation und Revocation-Verhalten sind ein eigener Security-Spike.

## 12. Provenienz, Lizenzen und AI-Tagging

### 12.1 Pflichtprovenienz

Jedes Paket MUSS eine Paketprovenienz und jede übernommene oder generierte Datei eine Datei-Lineage besitzen. Mindestfelder:

```text
sourceType: human | ai-assisted | ai-generated | third-party | procedural | unknown
unknownReasonCode conditional
authorOrPublisher
reviewer conditional
toolId
toolVersion
modelId optional
modelVersionOrDigest optional
promptOrSessionHash optional
inputReferences[]
inputRightsStatus
rightsBasis
licenseExpression
sourceRepository optional
sourceCommit optional
sourcePath optional
modificationsMade[]
approvalStatus
approvedBy optional
approvalDate optional
```

Vollständige vertrauliche Prompts werden nicht allgemein verlangt. Ein Prompt- oder Sessionhash ist nur ein datensparsamer Korrelator. Auditierbare Lineage setzt voraus, dass das gebundene Ursprungsartefakt oder ein kontrolliert zugänglicher Nachweis erhalten bleibt. `unknown` braucht `unknownReasonCode`. Lokale Drafts dürfen ausdrücklich `unreviewed` sein; offizielle Releases verlangen menschlichen Reviewer, abgeschlossene Rechteprüfung und den freigegebenen Approvalstatus.

### 12.2 Lizenzmanifest

- SPDX 3.0.1 ist das bevorzugte Vokabular für Software-BOM, Dateien, Herkunft und Lizenzbeziehungen. Der Validator pinnt zusätzlich SPDX License List 3.28.0 und die erlaubten Profile; diese Werte dürfen während einer Validierung nicht still aktualisiert werden.
- SPDX-3-JSON verwendet `application/spdx3+json`, einen versionierten, lokal gebündelten und digestgebundenen JSON-LD-Kontext sowie das festgelegte SPDX-Serialisierungsprofil. Keine Netzauflösung ist erlaubt.
- Jede Drittdatei bindet Upstream-URL, Commit, Pfad, Copyright, SPDX-Ausdruck oder exakten Text, Noticepflicht und Änderungen.
- Lizenztexte und erforderliche Notices werden im Paket mitgeführt.
- Toollizenz und Rechte am erzeugten Output werden getrennt bewertet.
- AI-Tagging ist kein Rechtebeweis. Menschliche Prüfung, Eingaberechte und Vertriebsfreigabe bleiben eigene Gates.
- C2PA- oder IPTC-Metadaten dürfen für Medien als zusätzliche Evidenz erhalten werden, ersetzen aber das Paketmanifest nicht.

Für Drittmaterial bedeutet fehlende Erlaubnis: keine Wiederverwendung oder Distribution. Für First-Party-Material ist auch eine dokumentierte proprietäre Rechtebasis, etwa ein projektspezifischer `LicenseRef-Proprietary` mit erhaltenem Text, zulässig. Die vorgeschlagene Releasepolicy verlangt in jedem Fall eine explizite Rechtebasis, Beitragsprüfung und Provenienz, nicht zwingend eine Open-Source-Lizenz. Beim untersuchten Voxel-Lab-Commit muss der Owner deshalb Rechteinhaberschaft, Drittbeiträge und die gewünschte Vertriebsgrundlage dokumentieren, falls daraus Bytes übernommen werden.

### 12.3 Build- und Publisher-Provenienz

Für offizielle Pakete SOLL zusätzlich eine Attestation den Quell-Fileset-Digest, Build-/Exportworkflow, Runner, Tools und resultierenden Paketdigest binden. SLSA 1.2 und das in-toto Statement-Modell sind geeignete Referenzen. Eine solche Attestation ist eine zusätzliche Vertrauensebene, keine Ersatzvalidierung.

## 13. JSON, Binärdaten, Git, Diff und Merge

### 13.1 Formatmatrix

| Daten | Normatives Format | Grund |
|---|---|---|
| Manifest, Lock, kleine Entitäten, Provenienz | striktes JSON | lesbar, schematisierbar, diffbar |
| Große Voxelautorität | HVOX oder registriertes Binärformat plus decoded Digest | kompakt, klare Zellordnung |
| Events und Snapshots | **noch offen, `REQUIRES_SPIKE`**; Kandidaten sind ein versionierter Binärcontainer oder ein enges deterministisches CBOR-Profil | exakte Bytes, Kompression und Golden Vectors fehlen noch |
| GLB 2.0 | `derived` | Runtime-Delivery, nicht Gameplay-Autorität |
| Texturen und Audio | Binärpayload mit exakten Digests | etablierte Decoder und Kompression |
| Mesh, Collider, AO, Indizes | `derived` | lösch- und reproduzierbar |

JSON-Zahlen bleiben im interoperablen sicheren Ganzzahlbereich. IDs, 64-Bit-Zähler, Hashes und große Koordinaten werden als validierte Strings oder klar definierte Binärwerte gespeichert. Doppelte Keys, `NaN`, Unendlichkeit und `-0` werden abgelehnt.

### 13.2 Git-freundliches Authoring

- eine fachliche Entität pro Datei
- Dateipfade bleiben stabil, sind aber nicht die ID
- UTF-8, LF und stabile Zwei-Leerzeichen-Formatierung im Authoring
- keine Buildzeitstempel, lokalen Pfade oder zufälligen IDs in kanonischen Quellen
- Objektkeys stabil sortieren; Arrayreihenfolge nur verwenden, wenn sie fachlich relevant ist
- große Binärquellen über Git LFS oder einen content-addressed Objektstore
- Derived-Artefakte nicht von Hand mergen und normalerweise nicht im Source-Baum versionieren
- Publish erzeugt kanonische Release-JSON-Bytes, vollständige Fileliste und Digests
- Release-Lockfiles werden eingecheckt, aber nach Quellmerges neu erzeugt, nicht manuell zusammengeführt

### 13.3 Branching, semantischer Diff und Merge

- Diffprimärschlüssel ist `EntryId`, dann JSON-Pointer, nicht Zeilennummer oder Dateiname.
- Datei-Move bei gleicher ID und gleichem kanonischen Inhalt ist keine Contentänderung.
- Dreiwege-Merge verwendet Base, Ours und Theirs auf Entitäts- und Feldebene.
- Zwei Änderungen desselben skalaren Gameplayfelds sind ein sichtbarer Konflikt.
- Listen werden nach ihrer Schemabedeutung behandelt: Set, ID-Keyed Collection oder bewusst geordnete Sequenz.
- Abgeleitete Binärdaten werden verworfen und neu gebaut, nicht gemergt.
- Nach dem Merge laufen vollständige Referenz-, Lizenz-, Save-Impact- und Dependencyprüfungen; danach wird der Lock neu erzeugt.
- AI- oder Batch-Edits erzeugen denselben versionierten Command- und Diffpfad wie menschliche Edits und benötigen Preview und Freigabe.

## 14. Validierung und Issue Browser

### 14.1 Validierungspipeline

1. Container- und Ressourcenlimits
2. Pfad-, Dateityp- und Duplicate-Key-Prüfung
3. Byte-Digests und Filelist
4. JSON-Parse und kanonische Releasebytes
5. Schemavalidierung
6. Stable-ID- und Namespaceprüfung
7. Referenzielle und fachliche Semantik
8. Dependency-, Feature- und Konfliktauflösung
9. Lizenz-, Provenienz-, AI- und Publisherpolicy
10. Save- und Migrationsimpact
11. Aufbau von Derived-Artefakten
12. unveränderliches Kandidaten-Loadset
13. erneute Revisions- und Identitätsprüfung
14. atomare Adoption

### 14.2 Issue-Vertrag

```text
issueCode
severity: blocker | error | warning | info
phase
packageId
entryId optional
filePath optional
jsonPointer optional
sourceLocation optional
relatedIds[]
responsibilityDomain
messageTemplateId
messageParameters
fixHints[]
deterministicFingerprint
```

Issuecodes sind die stabile Primäridentität. Freitext ist Darstellung. Der `deterministicFingerprint` ist ein domänenseparierter SHA-256 über kanonische Werte von Issuecode, Phase, Paket-ID, Entry-ID, Pfad, JSON-Pointer und sortierten Related-IDs. Die Sortierung erfolgt nach Severityrang, Issuecode und denselben UTF-8-Schlüsseln. Grenzen pro Datei, Paket und Lauf verhindern Diagnose-DoS.

Suppressions sind externe Workspace-Metadaten mit Fingerprint, Grund, verantwortlicher Person oder Domäne und Ablaufdatum. Sie verändern weder Paket noch Issue. Blocker sowie Integritäts-, Security-, Rechte- und Lizenzfehler dürfen nicht unterdrückt oder herabgestuft werden.

Der Issue Browser SOLL bieten:

- Filter nach Paket, Typ, Schweregrad, Phase und Verantwortungsdomäne
- Dependency- und Reverse-Dependency-Sicht
- Duplicate-ID-, Dead-Reference-, Cycle- und Conflict-Sichten
- Save-Impact und Migration-Dry-Run
- Lizenz-, Notice-, Provenienz- und AI-Vollständigkeit
- Ressourcenbudget und Derived-Staleness
- Quick Fixes als sichtbare Commands und Diffs, nie als stille Mutation

Authoring-Issues und Telemetrie bleiben getrennt. Telemetrie erhält nur sanitisierten Code, Phase, Dauer, Counts und Outcome, keine URLs, lokalen Pfade, Prompts, freien Texte oder Stacktraces.

## 15. Distribution, Browsercache und Installation

### 15.1 Distribution

- Der Registry-Katalog ist klein, versioniert und kurz gecacht. Offizielle Kataloge sollen signiert sein.
- Pakete werden über unveränderliche, content-addressed URLs ausgeliefert und können `Cache-Control: immutable` verwenden.
- Der Client lädt Manifest und erwarteten Digest, dann die Payloads, prüft alles und baut erst danach einen Installationskandidaten.
- Delta-Downloads sind später erlaubt, aber das rekonstruierte vollständige Paket muss denselben Paketdigest besitzen.
- Eine Paketversion wird niemals an derselben URL oder unter derselben ID/Version überschrieben.

### 15.2 Browser-Speicherrollen

| Speicher | Rolle | Keine Rolle |
|---|---|---|
| IndexedDB | Katalog, Locksets, Aktivierungsjournal, Quarantäne, atomarer Active-Pointer | großer Streamingblob ohne Bedarf |
| OPFS | große immutable Blobs und regenerierbare Derived-Produkte | einzige Kopie wichtiger Saves |
| CacheStorage | erneut hashgeprüfte Netzwerkantworten | Content-Autorität oder Aktivierungstransaktion |
| Exportdatei oder Cloudbackup | Recovery und Portabilität | Live-Registry |

Browser-Speicher ist quotaabhängig und kann best effort sein. `navigator.storage.persist()` ist eine Anfrage, keine Garantie. Pakete, Generatoren und Locks, die von Saves oder Rollbackslots referenziert werden, dürfen nicht durch gewöhnliches Cache-Pruning gelöscht werden. Fehlender Speicher, blockierte IndexedDB-Upgrades und parallele Tabs sind explizite Zustände.

### 15.3 Installations- und Aktivierungstransaktion

1. Bytes unter temporärer Kandidaten-ID speichern.
2. Digest, Struktur und Policy vollständig prüfen.
3. Immutable Blobs unter ihrem Digest veröffentlichen.
4. Installierten Katalogeintrag schreiben.
5. Kandidaten-Loadset bauen und prüfen.
6. In einer kurzen Transaktion den Active-Pointer `{rootDigest, generation}` nur mit `expectedRootDigest` und erwarteter Generation per Compare-and-Swap wechseln.
7. Bei einem konkurrierenden Writer atomar abbrechen und den Kandidaten gegen den neuen Root neu aufbauen.
8. Alte referenzierte Objekte für Rollback und Saves behalten.

OPFS-Blobs werden vor der CAS-Transaktion immutable gestaged. Verwaiste Blobs dürfen später gesammelt werden. Pruning arbeitet auf einem transaktional erfassten Root-Snapshot aus aktivem Loadset, Saves, Rollbackslots und Quarantäne und löscht nur nicht erreichbare Objekte.

## 16. Vorbereitung auf spätere Server-Authority

- Der Server besitzt `authorityLockDigest`, `simulationContractDigest`, Generatorgraphen, Schemensatz, Capability-Grants, Eventreihenfolge und Simulationszustand.
- Der Handshake überträgt Authority-Lock, Simulationsvertrag, Core-Protokoll und erlaubte optionale kosmetische Pakete.
- Ein Client mit abweichendem simulationsrelevantem Lock wird abgelehnt oder lädt das exakte freigegebene Paketset.
- Clientbefehle referenzieren stabile IDs. Der Server validiert Capability, Existenz, Zustand, Bounds und Regeln erneut.
- Clientvalidierung, Paketsignatur und Provenienz sind keine Autorisierung für einen Spielbefehl.
- Kosmetische Clientpakete bleiben in einer getrennten Allowlist und dürfen Collider, Missionen, Wirtschaft, Materialphysik, Timings, Zufall oder IDs nicht beeinflussen.
- Server-Snapshots und Eventlogs binden denselben Authority-Lock und Simulationsvertrag wie Saves; der volle Artifact-Lock bleibt für Reproduktion und Audit erhalten.
- Migrationen und Modwechsel laufen serverseitig als atomare Weltrevision, nicht als individuelle Cliententscheidung.

Diese Vorbereitung verlangt heute keinen Multiplayer-Code. Der gemeinsame Lock- und ID-Vertrag verhindert lediglich eine spätere inkompatible Sackgasse.

## 17. Rollback, Quarantäne und Widerruf

### 17.1 Paketlebenszyklus

Lokales Authoring und veröffentlichte Artefakte verwenden getrennte Zustände:

```text
working-candidate -> rejected | validated-draft -> published
discovered-release -> staged -> validated -> installed -> active -> retired
                             \-> quarantined <-/
```

Nur `published` aktiviert die Unveränderlichkeit von `packageId + packageVersion`. Ein lokaler Draft darf bei gleicher Draft-Version beliebig viele neue Kandidatendigests erzeugen. `rejected` bleibt editierbar. `quarantined` ist grundsätzlich ein forensischer Aufbewahrungs-, kein Lösch- oder Vertrauenszustand.

### 17.2 Quarantäneinhalt

Quarantäne bewahrt:

- unveränderte empfangene Bytes
- Paket-ID, Version und gemessenen Digest
- Manifest, Provenienz und Lizenzdaten
- alle deterministischen Issues und den Policygrund
- Quelle, Zeitpunkt und Truststatus
- betroffene Saves, Loadsets und Derived-Artefakte

Quarantänisierte Pakete werden nicht ausgeführt, neu aktiviert oder still durch gleichnamige Pakete ersetzt. Eine isolierte Read-only-Recovery darf IDs und Daten anzeigen. Die Reparatur eines veröffentlichten Artefakts erzeugt eine neue Version und einen neuen Digest; ein lokaler abgelehnter Draft erzeugt nur einen neuen Kandidatendigest.

### 17.3 Rollbackregeln

- Vor Aktivierung wird der Kandidat verworfen, die alte Registry bleibt aktiv.
- Nach Aktivierung, aber vor einem darauf basierenden autoritativen Event oder Save, darf der Active-Pointer auf den letzten validen Root zurückwechseln.
- Sobald ein Event oder Save das neue Paketset referenziert, erfolgt Rollback durch Öffnen des exakten alten Graphen, eine zertifizierte Migration oder kompensierende Events. Geschichte wird nicht unter einem Ersatzpaket neu interpretiert.
- Derived-Artefakte eines verworfenen oder quarantänisierten Roots werden invalidiert.
- Integritätsprüfung erlaubt unveränderte forensische Aufbewahrung, beweist aber keine Aktivierbarkeit oder Vertrauenswürdigkeit. Jede Reaktivierung verlangt erneut vollständige Semantik-, Rechte-, Trust- und Policyprüfung.
- Ein Katalogwiderruf markiert den exakten Digest. Er überschreibt keine historischen Bytes und erzwingt für betroffene Saves einen sichtbaren Recovery- oder Migrationspfad.
- Muss Inhalt aus rechtlichen oder sicherheitsbedingten Gründen gelöscht werden, bleiben soweit zulässig Digest, minimale Metadaten und ein Lösch-Tombstone erhalten. Betroffene Saves wechseln sichtbar in Recovery statt still auf Ersatzbytes.

## 18. Konflikte in den Projektquellen und G13-Auflösung

| Thema | Aussageklasse | Quellenkonflikt oder Lücke | G13-Auflösung |
|---|---|---|---|
| Chunkgröße | akzeptierte Forschungsrichtung plus offene Integration | Assetbericht schlägt HVOX v1 mit 32 vor, Integrationsaudit lässt 32 oder 64 für die Welt offen | ein später registrierter HVOX-Codec darf 32 tragen; Root-Paketvertrag erhebt dies nicht zum globalen Weltgesetz |
| Voxelauflösung | akzeptierte Forschungsrichtung plus offene Authority | 0,25 m ist Integrationsvorschlag, 0,125 m existiert als andere unverdrahtete Authority | Auflösung wird pro Autoritätsdomäne versioniert gebunden; globale Ownership bleibt außerhalb G13 offen |
| Fehlende Daten | Projektfakt und G13-Empfehlung | Lab behandelt nicht materialisiert als Air | Produktvertrag unterscheidet `known-empty`, `unloaded`, `missing`, `invalid` |
| Materialslots | Projektfakt und G13-Inferenz | WP04 verwendet lokale `Uint8`-Slots, große Modsets brauchen globale Identität | Namespaced Material-ID plus paketlokale Palette und Digest |
| Palette versus Physik | Forschungsrichtungen | WP04 enthält Renderfarbe/AO, Destruction-Bericht physische Werte | getrennte Schemalagen unter einer stabilen Material-ID |
| Operation versus Delta | G13-Inferenz | High-Level-Operation kann zustandsabhängig sein | deterministische Primitive replayen, sonst `ResolvedDelta` als Autorität |
| Save V1 | Projektfakt | enthält keine Voxelautorität oder Editjournale | neues Save-Schema und Gate, kein stilles Anhängen an V1 |
| Voxel-Lab-Rechtebasis | Projektfakt plus Ownerentscheidung | keine erkennbare Lizenz am Prüfcommit; Rechteinhaberschaft und Drittbeiträge nicht vollständig dokumentiert | Drittwiederverwendung blockieren; bei First-Party-Nutzung explizite proprietäre oder andere Rechtebasis dokumentieren |
| Schema-URL | Forschungsartefakt | Assetbeispiel nutzte `example.invalid` | gebündelte, dauerhafte URN-Schema-IDs und `schemaSetDigest` |
| glTF | extern bestätigter Fakt plus G13-Empfehlung | 2.1-Kommunikation ist neuer, Registry führt 2.0.1 als aktuelle stabile Spezifikation | v1 pinnt GLB auf glTF 2.0; 2.1 erst nach finalem Tool-/Validatorgate |
| Worker | Projektfakt und G13-Übertragung | gute Isolations- und Revisionsmuster, aber keine Sandbox | für Parsing und Kandidatenbau nutzen, nicht für untrusted Code |
| JCS versus feste JSON-Propertyreihenfolge | Projektquellenkonflikt | BR01 verlangt RFC 8785, BR02 beschreibt feste Einfügereihenfolge | Release- und Bundleexport nach Messung mit dem gemeinsamen JCS-Kanonikalisierer erzeugen |

## 19. Abdeckung der 18 Pflichtfragen

| Nr. | Pflichtfrage | Ergebnisabschnitt |
|---:|---|---|
| 1 | Core code versus content packages | 4 |
| 2 | Stable IDs and namespaces | 6 |
| 3 | Schemas and migrations | 7 |
| 4 | Pakete für Assets, Missionen, NPCs, Factions, Economy, Cities, Systems | 5.1 |
| 5 | Dependency graph and version constraints | 8 |
| 6 | Hot reload in developer mode | 9 |
| 7 | Savegame binding and backward compatibility | 10 |
| 8 | Generator versions and persistent edits | 10.2 |
| 9 | Mods, permissions, load order, conflicts, security | 11 |
| 10 | Content provenance and license manifests | 12 |
| 11 | Binary versus JSON | 13.1 |
| 12 | Git-friendly authoring and derived artifacts | 13.2 |
| 13 | Branching, diff and merge | 13.3 |
| 14 | Validation and issue browser | 14 |
| 15 | Distribution and caching | 15 |
| 16 | AI-generated content tagging | 12.1 |
| 17 | Server authority for later multiplayer | 16 |
| 18 | Rollback and quarantine | 17 |

## 20. Kleine, seriell umsetzbare Folgegates

Die Gates sind zukünftige Arbeiten. Sie autorisieren keine Änderung am Voxel-Lab oder Hauptspiel und müssen die bestehende Integrationsreihenfolge respektieren.

### Gate G13.0 - Ownerentscheid und Lizenz

**Scope:** Mod-Scope, Namespacepräfixe, Save-Supportfenster, Overridepolicy, Signaturgrundsatz und Rechtebasis für tatsächlich übernommene Voxel-Lab-Bytes schriftlich entscheiden.

**Exit:** vom Owner freigegebener Decision-Record; für verwendete Bytes liegt eine dokumentierte Rechtebasis vor oder der Spike bestätigt ausdrücklich `Voxel-Lab bytes used: no`; akzeptierter Spike-Zielort und Commit.

### Gate G13.1 - Vertrag, Schemata und Fixtures

**Scope:** Manifest-, Content-Lock-, Authority-Lock-, Provenienz-, Issue- sowie Material-, Asset- und Missionsschema als Draft 2020-12; Golden-Bytes und getrennte Paket-, Authority-, Content-Lock- und Authority-Lock-Digestvektoren; keine Runtimeintegration.

**Exit:** positive und negative Fixtures für Duplicate Keys, Pfade, Envelope-Ausnahmen, unbekannte Felder, alle Digestklassen, Duplicate IDs, fehlende Referenzen, gefälschte kosmetische Impactklasse und Rechte-/Lizenzstatus.

### Gate G13.2 - Kleiner Registry-Spike

**Scope:** drei Datenpakete, ein Dependency-DAG, ein exakter Resolver, immutable Registry und atomarer Active-Pointer. Kein Archiv, kein Script-Mod, kein Service Worker.

**Exit:** Kein unvollständiger, stale, ungeprüfter oder digestabweichender Kandidat kann den aktiven Contentzustand verändern. Eine Zwei-Writer-Fixture belegt Active-Pointer-CAS; eine zu niedrig deklarierte Impactklasse wird abgelehnt.

### Gate G13.3 - Hot Reload und Issue Browser

**Scope:** Devserver-Signal, Worker-Kandidat, `contentEpoch`, Stale-Verwerfung, Safe Points, Rollback und lokale Issues.

**Exit:** fehlerhafter Reload lässt die alte Registry aktiv; erfolgreiche Aktivierung ist atomar; pro Request existiert genau ein Terminalstatus.

### Gate G13.4 - Save-Bindung und Migration

**Vorbedingung:** Exaktes Event-, Checkpoint-, Kompressions- und Binärprofil mit Golden Vectors wurde in einem eigenen Spike entschieden.

**Scope:** Save bindet Content Lock, Authority Lock, Simulationsvertrag, Generator, Materialregistry, Eventhead und Editjournal; eine deklarative ID-Migration und eine absichtlich fehlschlagende Migration.

**Exit:** exakter Load funktioniert; fehlende autoritative Pakete blockieren; Migration erzeugt eine neue Save-Kopie; Original bleibt bytegleich.

### Gate G13.5 - Packaging, Cache und Quarantäne

**Scope:** deterministischer Container oder explizite Directory-Distribution, Ressourcenlimits, content-addressed Cache, installierter Katalog, Quarantäne und Pruning-Reachability.

**Exit:** Traversal, Bombenlimit, gleiche Version mit anderem Digest und Quota-Fehler sind belegt; Save-referenzierte Pakete werden nicht geprunt.

### Gate G13.6 - Spätere Trust- und Serverprofile

**Scope:** signierter Katalog, Key-Rotation, Revocation, Server-Handshake und kosmetische Allowlist. Capability-Wasm ist ein separates Security-Forschungsstück.

**Exit:** falscher oder widerrufener Digest wird abgelehnt; Server akzeptiert keine simulationsrelevante Lockabweichung.

## 21. Offene Ownerfragen

1. **Mod-Code:** Soll v1 ausschließlich additive Datenmods erlauben? Empfehlung: ja. Andernfalls ist vor dem Registry-Spike ein Capability- und Security-Entscheid nötig.
2. **Namespaces:** Welche offiziellen Präfixe werden reserviert, und wie wird Communitybesitz belegt? Empfehlung: offizielles reserviertes Präfix plus Reverse-DNS für verifizierte Publisher.
3. **Overrides:** Reichen in v1 neue IDs und definierte Extension Points, oder muss Core-Content gepatcht werden? Empfehlung: allgemeine Patches vertagen.
4. **Save-Garantie:** Wie lange müssen alte Paket- und Generatorbytes verfügbar bleiben? Empfehlung: exakter Authority-Lock und Simulationsvertrag als Grundgarantie, voller Artifact-Lock für Reproduktion, zertifizierte Aufwärtsmigrationen für ein explizites Supportfenster.
5. **Offline-Portabilität:** Muss jeder Save ohne Registryserver vollständig rekonstruierbar sein? Empfehlung: vollen Lock und Manifeste immer einbetten; optionaler Portable Export legt durch die dokumentierte Vertriebsgrundlage erlaubte Paketbytes bei.
6. **Authentizität:** Reicht für den ersten internen Spike HTTPS plus Digest, während der offizielle Kanal später einen signierten Katalog erhält? Empfehlung: ja, aber keine öffentliche Distribution vor dem Signaturgate.
7. **Voxel-Lab-Rechtebasis:** Sollen aus dem referenzierten Commit überhaupt Bytes übernommen werden? Falls ja: Ist der Owner alleiniger Rechteinhaber, welche Drittbeiträge existieren und gilt eine proprietäre oder andere Lizenzgrundlage? Dritte dürfen aus dem fehlenden Lizenztext keine Rechte ableiten.
8. **Voxel-Authority:** Welche Authority besitzt global Auflösung, Chunkgröße und Missing-Coverage-Semantik? G13 bleibt formatneutral; Aktivierung voxelbasierter Contentpakete wartet auf diese Architekturentscheidung.

## 22. Copy-and-paste-Handoff-Prompt für den Registry-Spike

```text
Du bist der einzige autorisierte Write-Agent für einen isolierten G13 Content-Registry-Spike.

Lies zuerst vollständig:
1. WELTRAUM_PROJECT_INSTRUCTIONS_ADDENDUM.md
2. WELTRAUM_PROJECT_MEMORY.md
3. WELTRAUM_RESEARCH_SYNTHESIS_2026-08-12.md
4. WELTRAUM_RESEARCH_DECISION_LOG_2026-08-12.md
5. WELTRAUM_GAMEPLAY_EDITOR_VISION_ADDENDUM_2026-08-12.md
6. G13_Content_Data_Modding_Versioning_Hot_Reload_Abschlussbericht_2026-08-12.md
7. den Owner-Decision-Record aus Gate G13.0

Vorbedingungen:
- Zielrepository und akzeptierter Integrations-SHA: <EINTRAGEN>
- isolierter Write-Pfad: <EINTRAGEN>
- entschiedene offizielle Namespacepräfixe: <EINTRAGEN>
- Mod-v1-Policy: <EINTRAGEN>
- Voxel-Lab bytes used: no
- falls dieser Wert auf yes geändert werden soll, vorher dokumentierte Rechtebasis: <EINTRAGEN>

Implementiere nur Gate G13.1 und G13.2 als kleinen, engine-neutralen Spike:
- Content Package Manifest v1, Content Lock v1, Authority Lock v1, Provenance v1 und Issue v1
- JSON Schema Draft 2020-12, geschlossen und ohne Remote-Schemaauflösung
- RFC-8785-kanonische Releasebytes
- domänenseparierte SHA-256-Paket-, Authority-, Content-Lock- und Authority-Lock-Digests
- stabile namespaced IDs
- genau eine Paketversion je PackageId
- azyklischer Dependency Resolver mit deterministischer Reihenfolge
- drei deklarative Fixturepakete: materials, assets, missions
- immutable Kandidatenregistry und Active-Pointer-CAS mit Rootdigest und Generation
- Duplicate-ID-, Missing-Reference-, Cycle-, Version-, Pfad-, Digest- und Lizenzdiagnosen
- bei jedem Fehler bleibt die letzte gültige Registry aktiv

Nicht implementieren:
- keine Änderungen am Voxel-Lab oder Hauptspiel außerhalb des freigegebenen Pfads
- keine allgemeine Patch- oder Last-Wins-Semantik
- kein JavaScript-, Wasm-, Shader- oder nativer Mod-Code
- kein Service Worker, kein Multiplayer, keine Cloudregistry
- kein neuer Voxel-, Save-, Generator- oder Render-Authority-Pfad
- keine Benchmarkbehauptung ohne ausgeführtes, dokumentiertes Verfahren

Akzeptanzbelege:
1. Golden-Bytes und Digestvektoren für Manifest, Paket, Authority, Content Lock und Authority Lock
2. positive Fixture mit materials -> assets -> missions
3. negative Fixtures für Duplicate Key, Traversalpfad, unbekannte Envelope-Datei, unbekanntes Feld, falsche Digests, Duplicate ID, fehlende Referenz, Dependency Cycle und als kosmetisch unterdeklarierte Simulation
4. Stale-Kandidat kann nach Epochwechsel nicht adoptiert werden
5. fehlgeschlagener Kandidat verändert den Active-Pointer nicht
6. zwei konkurrierende Writer führen zu genau einem CAS-Erfolg; der andere Kandidat wird neu aufgebaut
7. deterministischer JSON-Issue-Report mit stabilen Codes
8. Lizenz- und Provenienzregister aller neuen Abhängigkeiten und Bestätigung, dass keine Voxel-Lab-Bytes verwendet wurden

Liefere einen Abschlussbericht mit exaktem Commit, geänderten Dateien, ausgeführten Befehlen, Testergebnissen, offenen Risiken und dem Status READY_FOR_REVIEW oder BLOCKED. Beginne keine Folgegates.
```

## 23. Quellenregister

### 23.1 Mandat und bereitgestellte Projektquellen

- `G13_content_data_modding_versioning_hot_reload(1).md`, Mandat, Pflichtfragen, Deliverables, Statusvokabular und Read-only-Grenze
- `WELTRAUM_PROJECT_INSTRUCTIONS_ADDENDUM(1).md`
- `WELTRAUM_PROJECT_MEMORY(1).md`
- `WELTRAUM_RESEARCH_REGISTER(1).md`
- `WELTRAUM_RESEARCH_SYNTHESIS_2026-08-12.md`
- `WELTRAUM_RESEARCH_DECISION_LOG_2026-08-12.md`
- `WELTRAUM_GAMEPLAY_EDITOR_VISION_ADDENDUM_2026-08-12.md`
- `03_webgpu_engine_bakeoff_abschlussbericht(2).md`
- `04_voxel_landscape_generation_research_report(1).md`
- `05_destruction_connectivity_physics_research_report(1).md`
- `05_destruction_connectivity_physics_research_report(2).md`, byteidentisches Duplikat
- `06_open_source_github_license_audit_report(2).md`
- `07_benchmark_test_methodology_audit_report(1).md`
- `08_planet_scale_streaming_lod_persistence_research_report(1).md`
- `09_weltraum_integration_boundary_audit_report(1).md`
- `10_asset_pipeline_visual_style_research_report(1).md`
- `WP04_Block_AO_Palette_Research_Abschlussbericht(1).md`
- `wp05_worker_scheduler_abschlussbericht(1).md`
- `BR01_benchmark_contracts_provenance_specification(1).md`
- `BR02_In_Browser_Telemetrie_Abschlussbericht_2026-08-12(1).md`

Das `WELTRAUM_RESEARCH_REGISTER` ist ein früherer Intake-Snapshot und nennt Arbeiten noch als `RUNNING`. Für den späteren Forschungsabschluss und akzeptierte Richtungen haben Synthese und Decision Log Vorrang, soweit sie den Registerstatus ausdrücklich überholen.

### 23.2 Projektpins

- [Hestia Voxel Kernel Lab, Commit `d95992d`](https://github.com/BenjaminHornung/hestia-voxel-kernel-lab/commit/d95992df05952ac4be6221ca1809c1c9e3c0ac9d)
- [Weltraum-Spiel, Auditcommit `15f3550`](https://github.com/BenjaminHornung/Weltraum-Spiel/commit/15f3550bd604856b25d40a7ac700ec4d5106b89e)
- [SaveGame V1 am Auditcommit](https://github.com/BenjaminHornung/Weltraum-Spiel/blob/15f3550bd604856b25d40a7ac700ec4d5106b89e/apps/weltraum-browser/src/persistence/types.ts)
- [SaveRepository am Auditcommit](https://github.com/BenjaminHornung/Weltraum-Spiel/blob/15f3550bd604856b25d40a7ac700ec4d5106b89e/apps/weltraum-browser/src/browser-storage/saveRepository.ts)
- [MeshArtifact am Auditcommit](https://github.com/BenjaminHornung/Weltraum-Spiel/blob/15f3550bd604856b25d40a7ac700ec4d5106b89e/apps/weltraum-browser/src/presentation/meshArtifact.ts)
- [GitHub-Erklärung zu Repositories ohne Lizenz](https://docs.github.com/articles/licensing-a-repository)

### 23.3 Normative Standards und offizielle technische Referenzen

Die beweglichen Registry- und Dokumentationsseiten in diesem Abschnitt wurden am 2026-08-12 geprüft. Wo kein unveränderlicher Release- oder Commitlink verfügbar ist, kann ihr späterer Inhalt abweichen.

- [JSON Schema Draft 2020-12](https://json-schema.org/draft/2020-12)
- [JSON Schema Core](https://json-schema.org/draft/2020-12/json-schema-core)
- [RFC 8785, JSON Canonicalization Scheme](https://www.rfc-editor.org/info/rfc8785)
- [RFC 8259, JSON](https://www.rfc-editor.org/info/rfc8259)
- [Semantic Versioning 2.0.0](https://semver.org/)
- [RFC 8949, CBOR und deterministische Kodierung](https://www.rfc-editor.org/info/rfc8949)
- [RFC 9562, UUIDs](https://www.rfc-editor.org/info/rfc9562)
- [FIPS 180-4, SHA-256](https://csrc.nist.gov/pubs/fips/180-4/upd1/final)
- [SPDX Specification 3.0.1](https://spdx.github.io/spdx-spec/v3.0.1/)
- [SPDX 3.0.1 Serializations](https://spdx.github.io/spdx-spec/v3.0.1/serializations/)
- [SPDX License List](https://spdx.org/licenses/)
- [IANA Media Types](https://www.iana.org/assignments/media-types/)
- [SLSA Specification 1.2](https://slsa.dev/spec/v1.2/)
- [SLSA Build Provenance](https://slsa.dev/spec/v1.2/build-provenance)
- [in-toto Statement v1](https://github.com/in-toto/attestation/blob/main/spec/v1/statement.md)
- [C2PA Specification 2.4](https://spec.c2pa.org/specifications/specifications/2.4/specs/C2PA_Specification.html)
- [IPTC Digital Source Type Vocabulary](https://cv.iptc.org/newscodes/digitalsourcetype/)
- [glTF 2.0 Specification](https://registry.khronos.org/glTF/specs/2.0/glTF-2.0.html)
- [Khronos glTF Registry](https://registry.khronos.org/glTF/)
- [IndexedDB 3.0](https://www.w3.org/TR/IndexedDB/)
- [WHATWG Storage Standard](https://storage.spec.whatwg.org/)
- [Origin Private File System](https://developer.mozilla.org/en-US/docs/Web/API/File_System_API/Origin_private_file_system)
- [CacheStorage](https://developer.mozilla.org/en-US/docs/Web/API/CacheStorage)
- [Web Worker API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API/Using_web_workers)
- [Content Security Policy Level 3](https://www.w3.org/TR/CSP3/)
- [WebAssembly Core 2.0](https://www.w3.org/TR/wasm-core-2/)
- [Vite HMR API](https://vite.dev/guide/api-hmr)
- [RFC 8246, HTTP immutable](https://www.rfc-editor.org/info/rfc8246)

## 24. Schlussstatus

`REQUIRES_OWNER_DECISION`

Begründung: Der Content Package Contract sowie Lock-, Save-, Hot-Reload-, Provenienz-, Quarantäne- und spätere Serververtrag sind als prüfbarer v1-Vorschlag konkret genug für Gate G13.1 und einen kleinen synthetischen Datenregistry-Spike. Öffentliche oder produktive Freigabe ist blockiert, bis der Owner mindestens Mod-Code-Umfang, Namespace-Governance, Save-Supportfenster, Overridepolicy und die Rechtebasis tatsächlich übernommener Voxel-Lab-Bytes entschieden hat. Sekundärer Status `REQUIRES_SPIKE` gilt für Event-/Snapshot-Binärformat, ausführbare Mods, allgemeine Patches, Signaturprofil und gemischte Generatorgenerationen.
