# W09 Band-/Netzrevision — unabhängiger Sourcecheck

Read-only 2026-10-11T22:41:08.267025–22:46:47.645020 UTC. Tatsächlicher HEAD in beidenReads: `aa2e5d7c335453fc555a98ccd35e9f564c596e93` plus mutable WIP. Keine Tests, Builds, Browser-/Native-/CPUjobs und keine W08-/Produktwrites. V2-Sourcefrage ist kein Writegrant dieser Prüfung.

**Enger Spec-/Sourcequality-Verdict: tragfähig.** Kein konkreter Reset-/Nestedbinding-Gegenpfad in der gelesenen Reconciliation gefunden. Der tatsächlich durchlaufene poweredPacket→neueNetzrevision→weitere54-Step-Transportweg ist noch nicht nachgewiesen; daher kein Runtime-/W09-PASS.

## Tatsächliche Vertragsgrenze

W08 `beltReference.ts:34–39` hält Bandbindung, kompletteInstallation, Tick, Credit, Packetcursor, Paket und letztenStep. `beltPorts.ts:15–23` enthält **keine Netzrevision in der geschachteltenInstallation oder ihrenPorts**: dort sind die unveränderliche Installationsrevision, Catalog-/Sourceprofil, Source-/Target-Device/Port/Geometrie, vier bezahlteModule, Drive, Power-/Custody-/Job-IDs gebunden. Eine neue Stromnetzrevision ändert daher die äußereBeltBinding; Ports oder Installation müssen hierfür nicht künstlich neu erstellt werden.

`reconcileDryFactoryInstallations:60–96` prüft zuvor bezahlte vollständigeOwner-BOMs/Profile. Bei Netrev++ werden Domain-/Power-/Machine-/Beltbindungen gemeinsam erneuert. Bereits vorhandeneBänder werden ausschließlich als `{...belt,binding}` übernommen: **Credit,Packet,Position,Packetcursor,Tick,Revision,LastStep und beide komplettenPort-DTOS bleiben erhalten**, einschließlich Injectionreceipt und NativeLotRefs. Batterie/SOC wird mit `battery??=` ausschließlich erstmals initialisiert und danach übernommen. Die gemeinsameDomain-lastStep und Machine-lastSteps werden als abgeleiteteReplaycaches invalidiert; die Band-lastStep bleibt korrekt erhalten. W08 `:104` benötigt bei Bandrevision>0 weiterhin dessen Tickcursor — ein pauschalesNullsetzen wäre falsch.

`adoptDryFactoryBelt:16–31` erzeugt nur eine neue, bereits bezahlte NativeLine: kompletteViermodul-/Drive-Pieceidentitäten, Ownerprofile/Masse/Pose/Richtung, dedizierteNativeCustody10kg/1Slot und vollständigeSource-/Targetbindung. Initialcredit0/packetnull/cursor0 gilt nur für die neueLine. Bereits vorhandeneLines werden perArrayübernahme erhalten. DuplicateLine/Sourceport/Targetport und vorhandeneBandcustody rejecten. VorAdoption wird die gesamteLine gegen den unverändertenW08-Port-/Lotvertrag validiert. `readDryFactoryBeltPort:35–39` bindet tatsächlichenSourceprofile und vollständigePortgeometrie mit ausdrücklich versioniertem Native-/W08-Yawadapter.

## Fresh Grant, Replay und gemeinsamePublication

`prepareDryFactoryStep` benutzt den neuenDomainbinding auch für den tatsächlichenW03-Allocator und alleBandinputs. W08 `beltReference:135–159` verlangt vollständig kanonisch identische Power-/Input-/Linebindung, dieselbenIntervalle, die echteReceiptcanonicalBytes/Signatur und exakt gebundenenConsumer/Drive/Job/Port. Ein alterGrant aus dem vorigenNetz kann damit keine Arbeit oder Credit erzeugen. JedeLine bekommt weiterhin genau100ms; Credit/Moves entstehen erst nach tatsächlicherAllokation.

W08 `commitFactoryBeltStep:238–249` bindet kompletteBaseLine/Inputbytes und NoOp-Materialzustand. Nach Graphrevision ist ein historischesPreparedproposal nicht einfach dieselbeBaseLine; es muss stale rejecten. Die gesicherteInjectionreceipt bleibt historischeProvenienz; Ziel-/Sourcecontainerrevisionen dürfen steigen, nicht rückwärts gehen (`:122–132`). ErhalteneHistory ist somit keine zweiteQuantitätsauthority.

`factorySession` koppelt neueLine-Adoption an die bereits vorhandeneConstruction-stageAdoption: CandidateMaterial/Domain/Graph werden vorPublikation berechnet, ohneawait gemeinsam veröffentlicht; Rollback stellt vorherigeDomain und LastPower zurück. Beim Kabelanschluss wird Netrev++ über dieselbeReconciliation erzeugt; seineMaterial-/Graph-/NativeReleasepublication besitzt ebenfalls keinawait dazwischen, LastPower wird aufundefined gesetzt. Es wird damit kein alterW03-Grant als aktuelleAllokation ausgegeben. Die vollständigeScene-/Fehlerrollbackprüfung bleibt eigenesW09-Gate.

## Evidencegrenze und geeignetes verbleibendes Orakel

124 `exact-cable6500-native-release-green`: tatsächlicher1PASS/32skip, Start22:40:15.766185–Ende22:40:17.743360 UTC, Wrapper1,977545173s/Vitest1,61s. Raw-SHA `073125aef368589bd0c68c22b856a91fd6ac9502ffcac221fa61b919fdceec73`; dekomprimierteBytes/Receipt unabhängig gebunden. Whole6500mm/33500mmRest/1,625kgDepot,NativeRelease/InstalledCableLedger/Netrev1/Replay/2984,4kg werden in der ausdrücklich NativeStub-Hostfixture geprüft. Dieser Fall enthält keinen bereits arbeitendenBandpacket-Zustand.

VorhandenerDrySlice-Test prüft vollständigebezahlteInitialadoption und0Credit, nicht ein laufendesPacket beim Netzübergang. Ein fokussiertes späteresW09-Orakel sollte mit echterNativeResources-Custody/Injectionreceipt und tatsächlichemW03-Grant ein Band bis zu positivemCredit/Packetposition fortschreiten lassen, eine zusätzlichebezahlteKabel-/Graphrevision übernehmen, den komplettenPacket-/Installation-/Port-/Tickzustand identisch erhalten sehen, altenGrant/Preparedproposal stale rejecten und mit neuemGrant weitertransportieren. Kein gespiegeltesMengenschatteninventar, kein W08-Write und kein absichtlich erfundenerRED notwendig, wenn die bestehendeImplementation diesesOrakel schon erfüllt.

## Sourcebytebindung

Start/Ende identisch: DrySlice `b54e9b07a020e69bc99a1fb2d4f8681e8354a1ffe788d24bea5b2e07349aa61e`; unverändertesW08 BeltReference `45fb7e4d0bb618a07d215ab923db4521c1bd46203428b49760e5140f402be211`, BeltPorts `54c2bdd48838f869db887d72b19f4169487070ba194e301340b12179f6a7cfa9`; Drytest `dbad8657b62d47b44749feefb70cce30ebcd36ff820ac44995038ee95b367eb0`.

Mutable: FactorySession `ee5fce899d208ddb374eea1f1c1408017e44542740cbf34247029707bd36c911`→`a4f5be980449af2983ce9ed4314a9ec0108ef7bbe400d64e63491db3e4e15410`; Hosttest `c49c2047fa859912e1b4875afb12487c249f5517364f7060a309a91c0a80c995`→`fcd732ff314906b4b86bc79ea4ddf806d9a98b7c2cb7dcf273410447e18cc3fc`. Keine vollständigeversiegeltePhase behauptet. PureReconcile-/W08-Vertragsbefund ist an die stabilenBytes oben gebunden; weitereRuntime-/Browsergates bleiben offen.
