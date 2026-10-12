import { createFp02Fixture } from "../catalog/fp02Catalog";
import { createResourceContainerDefinition, createResourceContainerSnapshot,createResourceContainerState } from "../../resources/containers";
import { createFactoryMaterialView,prepareFactoryMaterialStep,commitFactoryMaterialStep } from "../material/reservations";
import { createFactoryConstruction, type FactoryConstruction } from "../construction/buildStep";
import { bindFactoryDomainSession,createFactoryMaterialAuthority,createFactoryCommandHistory,reconcileDryFactoryInstallations,readDryFactorySupply,readDryFactoryBeltPort,adoptDryFactoryBelt,prepareDryFactoryStep,commitDryFactoryStep,type DryFactoryState } from "./dryFactorySlice";
import type {BeltInstalledPort} from "../conveyor/beltPorts";
import type {FactoryPowerLink,FactoryPowerSuccess} from "../power/factoryPower";
import {admitFactoryRecipe,type ProductionHostFacts,type ProductionStart} from "../production/recipeAdmission";
import type {ProductionCommand} from "../production/productionStep";
import { createFactoryHandling } from "./cargoHandling";
import { readCargoHandlingProfile,FACTORY_CLOSED_CABLE_JOBS } from "../construction/cargoHandlingProfile";
import { factoryMaterialBytes } from "../construction/placement";
import { validateFactoryAmount } from "../material/quantity";
import { canonicalJson } from "../../resources/serialization";
import { isSaveSafeResourceId } from "../../resources/ids";
import type { FactoryUiPort,FactoryUiReadModel,FactoryUiCommand,FactoryUiReceipt,FactoryUiPanel,FactoryUiInventory,FactoryUiBinding } from "./hostPort";
import type { FactoryCatalog } from "../contracts";
import type { FactoryHostPort, FactoryHostExtensionHandle, FactoryHostView } from "./hostPort";

export interface FactorySessionView {
  readonly sessionId: string; readonly epoch: number; readonly catalogDigest: string;
  readonly nativeTick: number; readonly remainderTicks: number; readonly steps: number;
  readonly elapsedMs: number; readonly state: "Ready" | "WaitingForHost" | "RecoveryHold" | "Disposed";
}
export interface FactorySessionHandle extends FactoryHostExtensionHandle {
  readonly construction?:FactoryConstruction;
  readonly ui:FactoryUiPort;
  readonly domainSession:ReturnType<typeof bindFactoryDomainSession>;
  read(): FactorySessionView;
  subscribe(listener: (view: FactorySessionView) => void): () => void;
}
const mountedHosts = new WeakSet<FactoryHostPort>();

/** Read-only target directory. Source plans do not grant construction, jobs or World ownership. */
const readFactoryTechnologies = (catalog:FactoryCatalog):FactoryUiReadModel["technologies"] => {
  type Row=readonly [id:string,name:string,requirements:string,source:string];
  const available=new Set(["B03","B04","B05","B06","B07","B09","B10","ST-02","fp03.build.B0","REC-01-CUT","REC-02-PROFILE","REC-03-SHEET","REC-05-BRACE"]);
  const rows:Row[]=[
    ["B01","Expeditions-Windanlage","Endliche Windpacks; bestätigter Wind, Rotorfreiraum und elektrischer Anschluss; sichere Luft-/Transportaufnahme offen","FP03 §4.7 / FP01"],
    ["B02","Expeditions-Solararray","Endliche PV-Packs; bestätigte Einstrahlung, freie Fläche und elektrischer Anschluss; Quellbeobachtung offen","FP03 §4.7 / FP01"],
    ["B03","Expeditionsbatterie","Endliche C03-Batterie, bezahlter lokaler Aufbau, tragfähige Auflage und Kabel; Leistung und tatsächlicher Ladezustand begrenzt","FP03 §4.7 / FP01"],
    ["B04","Expeditionsverteiler","Endlicher C04-Verteiler, bezahlter Aufbau und Kabel; leitet Kapazität weiter, erzeugt keinen Strom","FP03 §4.7 / FP01"],
    ["B05","Feldwerkbank","Endliche C05-Werkbank und Werkzeuge, lokales Material und erreichbare Wartungsseite; frühe Handmontage ohne elektrische Arbeit","FP03 §4.7 / FP02 §7"],
    ["B06","Zuschnittstation","Bezahlte C26-Baugruppe mit tatsächlicher BOM, Werkzeug, Input-/Output-/Verschnittplatz und zugeteilter elektrischer Leistung","FP03 §4.7 / FP02 §7"],
    ["B07","Umformwerk","Bezahlte C27-Baugruppe mit tatsächlicher BOM, Umformwerkzeug, Halbzeug, Output-/Verschnittplatz und zugeteilter elektrischer Leistung","FP03 §4.7 / FP02 §7"],
    ["B08","Gesteinsbrecher","Bezahlte C28-Baugruppe und Brechwerkzeug; reale Gesteinsquelle, Packvolumen und Transferfreigabe offen","FP03 §4.7 / FP02 §7"],
    ["B09","Materialcontainer","Endliches C08-Fertigmodul, bezahlter lokaler Aufbau; tatsächliche Kapazität, Last, Anschlüsse und Spielerzugang","FP03 §4.7 / FP02 §7"],
    ["B10","Kleine Förderlinie","Vier endliche C14-Metermodule und ein C23-Antrieb für die geschlossene 4-m-Linie; gültige Ports, Trasse, Strom und begrenzte Fracht","FP03 §4.7 / FP02"],
    ["B11","Bandverteiler / Zusammenführung","Eigene Port- und begrenzte Queue-Semantik; zusätzliche Geräte- und Materialdefinition offen","FP03 §4.7"],
    ["B12","Fundamentfamilie","Sechs endliche C09-Fundamentschuhe und materialbezahlte kleine Stützen; separate Last-/Verbindungsfreigaben erforderlich","FP03 §4.2 / §4.7"],
    ["B13","Biomasse-Zusatzgenerator","Tatsächlicher Brennstoff, Brennstofftransport, Abgas- und Servicefläche; eigener Energieprozess erforderlich","FP03 §4.7 / FP01"],
    ["B14","Montagezelle","Material, passende Werkzeuge, elektrischer Prozess und reale Montagefähigkeit; kein Ersatz der frühen C05-Handmontage","FP03 §4.7 / FP02"],
    ["B15","Automatischer Flachschürfer","Reale Terrainquelle, geeigneter Werkzeugkopf, Stützung, Energie und freie Materialabfuhr","FP03 §4.7 / FP04 M01"],
    ["fp03.build.B0","Einzelbau und Verbindungen","Bekannte Definition, tatsächliche Cargo-/Montageausrüstung, gültige Pose und bezahlte Bauteile","FP03 §2.2 / §12.1"],
    ["fp03.build.B1","Gruppen kopieren und Blueprints speichern","Hashbare Definitionen und lokale Anker; echter Wiederaufbau bezahlt jedes Teil","FP03 §2.2 / §12.1"],
    ["fp03.build.B2","Größere Ghost-Pläne","Bekannte Definitionen und erlaubte Planregion; Ghosts produzieren, tragen und leiten nichts","FP03 §2.2 / §12.1"],
    ["fp03.build.B3","Automatische Bauqueues","Reale Baugeräte, erreichbares Depot, Materialreservierungen, Transport und Energie","FP03 §2.2 / §12.1"],
    ["fp03.build.B4","Automatische Geländeprofile","Bagger, Transport, Verfüllmaterial, Sicherung und Worldberechtigung","FP03 §2.2 / §12.1"],
    ["fp04.surface-miner.small.v1","Kabelgebundener Flachschürfer","Geeignete Profile/Bleche, C15/C16/C17/C22, Werkbank, Verankerung, elektrische Leistung und endlicher Ausgang; Antriebskompatibilität offen","FP04 M01"],
    ["fp04.survey-beacon.local.v1","Lokaler Vermessungsanker","Sensoren, Energie, Messzeit, Reichweite und konkrete Beobachtungsposition; liefert Messdaten statt Erz","FP04 M02"],
    ["fp04.excavator.compact.v1","Kompaktbagger","Material-/Werkzeugprofil, erreichbarer Arbeitsraum, Energie, tragfähiger Untergrund und Transport-/Abladeplatz","FP04 M03"],
    ["fp04.earth-grader.v1","Planier- und Nivelliermaschine","Erdarbeitsziel, lokaler Materialbestand, Energie, zulässiger Bodendruck und Fahrweg","FP04 M04"],
    ["fp04.excavator.large.v1","Schwerer Tagebaubagger","Validierter Auftrag, sichere Böschung, schwere Logistik, Energie und Wartung; Last- und Leistungsprofil offen","FP04 M05"],
    ["fp04.biomass-harvester.v1","Biomasse-Erntegerät","Erreichbare reale Pflanzen, geeignete Werkzeuge, Energie, Holzlager und sichere Route; optional","FP04 M06"],
    ["fp04.crusher-interface.transfer.v1","Mining-Hopper und Förderschleuse","Reale Gesteinslose, endlicher Bunker, gültiger begrenzter Förderausgang und gegebenenfalls Strom","FP04 M07"],
    ["fp04.cargo-rover.small.v1","Autonomer Frachtcrawler","Eigene Fahrmotoren, Batterie, Steuerung, Fahrwerk und Rahmen; reserviertes Los, freie Ladeports und geprüfte Route","FP04 T01"],
    ["fp04.cargo-hauler.bulk.v1","Kipptransporter","Fahrenergie, tatsächliche Nutzlast, tragfähige Route und gültige Quell-/Zielcontainer; Lastmodell offen","FP04 T02"],
    ["fp04.depot.bulk.v1","Schüttgutdepot","Materialkompatible Bulklose, tatsächliche Kapazität, Stützung und reservierbare Band-/Ladeports","FP04 T03"],
    ["fp04.charging-bay.vehicle.v1","Fahrzeugladebucht","Belegbare Netzleistung, freier Ladesteckplatz und kompatible reale Batterie; Ladeverluste","FP04 T04"],
    ["fp04.dispatch-terminal.v1","Auftrags- und Logistikterminal","Energie, gespeicherte Facility-/Route-/Depotreferenzen und validierte Workeraufträge","FP04 T05"],
    ["fp04.conveyor.bulk.upgrade.v1","Schwerlastförderer","Eigene Katalog-ID, stärkere Träger und Antriebe, neue Portklasse sowie Leistungs-/Struktur-/Rampenprüfung","FP04 T06"],
    ["fp04.builder-crawler.v1","Bodenbasierter Kleinbauroboter","Reservierter Bauschritt, erreichbarer realer Teilepack, Energie, Zugang und passende Montage-/Hubpose","FP04 C01"],
    ["fp04.builder-drone.light.v1","Montage- und Inspektionsdrohne","Geprüftes Atmosphären-/Flugprofil, Energie und Reserve, reale Fracht, erlaubter Flugraum und sichere Rückkehr","FP04 C02"],
    ["fp04.gantry-loader.mobile.v1","Mobiler Lastheber","Energie, bestätigte Fundamente, erreichbare Baugruppe, reale Schwerpunkt-/Greifpunkte und geprüfte Tragfähigkeit","FP04 C03"],
    ["fp04.construction-depot.v1","Bau- und Reparaturdepot","Tatsächliche Bauteile, Energie, Bauaufträge, reale Transportrouten und Worker","FP04 C04"],
    ["fp04.repair-bot.v1","Reparatur- und Inspektionseinheit","Genehmigter Reparaturauftrag, reale Ersatzteile und Werkzeuge, Strom, Zugang und sichere Struktur","FP04 C05"],
    ["fp04.energy.E0","Expeditionsenergie","Endliche vorhandene Wind-/PV-Packs und Batterie; bestätigte Quellbedingungen und Leistung","FP04 §10.2"],
    ["fp04.energy.E1","Einmalige Wind-Reassembly","Endliche C24-/C25-Kerne, Profile, Bleche, Fundament, Steuerung und Kabel; keine Serienfertigung","FP04 §10.1–10.3"],
    ["fp04.energy.E2","Eigene Generatorfertigung aus Recycling","Reale Kupfer-, Magnet- und Elektronikbestände sowie geeignete Fertigungsmaschinen und Qualitätsprüfungen","FP04 §10.2–10.6"],
    ["fp04.energy.E3","Geschlossene Rohstoffversorgung","Stahl-/Kupferraffination, Wickeldraht, geeignete Magnetmaterialien, Isolation, Elektronik und Präzisionslager; Rezeptketten offen","FP04 §10.2 / §10.7"],
    ["fp04.energy.E4","Industrielle Energieversorgung","Schwere Erzeugungs-, Speicher- und Netzkomponenten sowie reale Prozess- und Wartungsfähigkeit","FP04 §10.2 / FP05"],
    ["FP04-WIND-FAB-6KW-V0","Selbst gefertigter Windgenerator","Struktur, Rotor, Spule, Magnetstator, Präzisionslager, Steuerung, Kabel und Fundament; Last-/Wind-/Qualitätsprüfung","FP04 §10.4–10.6"],
    ["fp05.water.survey-stake.v1","Proben- und Pegelmessanker","Verankerung, Energie und nachgewiesener Wasserkörper; Qualität, Pegel und Unsicherheit messen","FP05 W01"],
    ["fp05.water.intake-skid.v1","Geschütztes Wasserentnahmemodul","Tatsächliche Worldwasserquelle mit Entnahmepolicy, geeigneter Einlass, Grobsieb und Pumpenanschluss","FP05 W02"],
    ["fp05.water.pump-skid.small.v1","Prozesswasserpumpe","Passendes Flüssigkeitsmedium, gefüllter Einlass, Druck-/Wirkungsgradprofil, Strom und freie Wartungsseite","FP05 W03"],
    ["fp05.pipe.water.standard.v1","Rohrmodule und Kupplungen","Reales Rohrmaterial, kompatible Medium-/Druck-/Temperaturports, Trasse, Support und bilanziertes Rohrvolumen","FP05 W04"],
    ["fp05.valve.isolation.v1","Isolierventil","Zwei kompatible Flüssigkeitsports und gespeicherte Ventilstellung; Grundvariante manuell ohne Strom","FP05 W05"],
    ["fp05.tank.water.10m3.v1","Prozesswassertank","Bilanziertes Speichervolumen, gültige Zu-/Ablaufports, Überlaufprofil und tragfähige Auflage für tatsächliche Füllmasse","FP05 W06"],
    ["fp05.filter.water.basic.v1","Wasserfilter","Geeignete Rohwassermischung, Strom, Filterbestand und freie Prozesswasser-/Abwasser-Ausgänge; keine automatische Trinkwasserfreigabe","FP05 W07"],
    ["fp05.junction.flow-meter.v1","Durchfluss-Messstück","Kompatible Rohrstrecke und Sensorprofil; tatsächlicher Druck, Durchfluss und Medium statt erfundener Nullwerte","FP05 W08"],
    ["fp05.water.recycle.compact.v1","Abwasserrückgewinnung","Deklariertes Abwasser, Strom, Filter-/Behandlungsbestand und kontrollierter Reststoffausgang","FP05 W09"],
    ["fp05.thermal.coolant-skid.v1","Kühlkreislaufträger","Prozesswärme, reale Kühlmittel-Vor-/Rückläufe, Strom und geeignete Umweltwärmesenke","FP05 W10"],
    ["fp05.pipe.support.bridge.v1","Rohrbrücke und Wartungslaufsteg","Bezahltes Tragwerk, Terrainanker und explizit getragene Rohr-/Ventilinstanzen","FP05 W11"],
    ["fp05.ore.wet-concentrator.v1","Nasskonzentrator","Vermessenes geeignetes Erzgemisch, deklariertes Wasserprofil, Energie, Werkzeug und freie Konzentrat-/Abraum-/Abwasserlager","FP05 H01"],
    ["fp05.tailings.thickener.v1","Eindicker und Absetzbecken","Registriertes Nassabraumgemisch, Strom, Service und freie Wasser-/Tailingsausgänge","FP05 H02"],
    ["fp05.tailings.dewater.v1","Filterpresse","Geeignetes Schlammgemisch, Strom, Wartung und freie Wasser-/Filterkuchen-Ausgänge","FP05 H03"],
    ["fp05.scrap.industrial-sorter.v1","Schrott- und Elektroniksortierung","Reale gemischte Schrottlose, Strom, Sortierprofil und getrennte freie Werkstoff-/Gefahrstoffausgänge","FP05 H04"],
    ["fp05.foundry.recycled-metal.electric.v1","Elektrische Recycling-Schmelze","Geeigneter identifizierter metallischer Schrott, ausreichende elektrische Leistung, Wärme-/Emissions-/Schlackensenken; keine Oxiderzreduktion","FP05 H05"],
    ["fp05.foundry.casting-cell.v1","Gieß- und Abkühlzelle","Reale heiße Metallcharge, passendes Formwerkzeug, Energie, Abkühlkapazität und freier Ausgang","FP05 H06"],
    ["fp05.industrial.mill-precision.v1","Präzisionsfräse","Geeignete Metallrohlinge, Schneidwerkzeuge, Messmittel, elektrische Energie und Qualitätsprüfung","FP05 H07"],
    ["fp05.industrial.parts-assembly.v1","Industrie-Reparaturwerkstatt","Halbzeug, reale Elektronik-, Werkzeug-/Dichtungsteile, Strom und Arbeits-/Automationskapazität","FP05 H08"],
    ["fp05.heat.exchanger.moderate.v1","Wärmetauscher","Getrennte geeignete Fluidkreise oder Luftsenke; Wärmeleistung, Durchfluss und Temperaturdifferenz","FP05 H09"],
    ["fp05.industry.power-substation.v1","Industrielles Lastschaltwerk","Kapazitätsgeprüfte reale Netzkomponenten, elektrische Quellen, Schutzstufen und Verbraucher; keine Stromerzeugung","FP05 H10"],
    ["fp05.power.thermalplant.optional.v1","Optionale thermische Energieanlage","Spezifizierter Brennstoff und Oxidator, passendes Arbeits-/Kühlmedium, Generator, Emissions-/Reststoffsenken; vollständige thermische Bilanz offen","FP05 H11"],
    ["fp05.gas.compressor.storage-skid.v1","Gasdruck- und Speichermodul","Genaues Gasprofil, Energie, Wärmesenke, Druck-/Temperatur-/Volumenmodell und Sicherheitsbelege; GAS-G2-REQUIRES_SPIKE","FP05 H12"],
    ["fp05.industry.waste-yard.v1","Abraum- und Reststoffhof","Reale getrennte Bulk-/Gefahrstofflager, tatsächliche Kapazität und Fahrzeug-/Recyclingrouten","FP05 H13"],
    ["fp05.water.storage.mobile-tanker.v1","Flüssigkeitstransportfahrzeug","Realer kompatibler Tank, Belade-/Ablassports, Fahrantrieb, Energie und massengeprüfte Route","FP05 H14"],
    ["fp05.industry.repair-gantry.v1","Großanlagen-Wartungsportal","Reale Reparaturteile, Werkzeuge, begrenzter Lastpfad, Elektroanschluss und Arbeitspolicy","FP05 H15"],
    ["fp05.city.perimeter-gateway.v1","Stadtrandtor","Diagnose, mechanischer Zugang, Strom und validierte Zugangsrechte; narrative Ausgangsdetails offen","FP05 C01 / §8.0"],
    ["fp05.city.substation-alpha.v1","Stadtsektor-Verteilstation","Reale Netzversorgung, kapazitätsgeprüfte Feeder, Messdaten, Schutz- und Zugangsfreigaben","FP05 C02"],
    ["fp05.city.pumpworks.v1","Historisches Pumpwerk","Tatsächliches Rohwasser, Pumpenstrom, erhaltener Zulauf, Filter und Reststoffpfad","FP05 C03"],
    ["fp05.city.industrial-yard.v1","Städtisches Industrieareal","Eigene Anlagen, reale Lager, Energie, Wasser, Recycling und Ersatzteilproduktion","FP05 C04"],
    ["fp05.city.robot-dock-cluster.v1","Robotereinwohner und Ladebuchten","Persistente individuelle Identität, geprüfter Körperzustand, Strom, Daten-/Bootfreigabe und sicherer Dockzugang","FP05 C05"],
    ["fp05.city.archive-core.v1","Archiv und historische KI-Infrastruktur","Strom, geschützter Speicherzugang, gegebenenfalls Kühlung und tatsächlich vorhandene Inhaltsquellen","FP05 C06"],
    ["fp05.city.transport-exchange.v1","Stadt-Frachtterminal","Reale Cargo-Lose, Fahrzeuge, Routen, Kapazität und Lade-/Entladebelege","FP05 C07"],
    ["fp05.city.public-comms.v1","Stadtkommunikation","Physische Strom-/Datenkapazität, Informationszugang und tatsächliche Verbindungsstrecken","FP05 C08"],
    ["fp05.city.service-and-medbay.v1","Roboterreparatur","Reale Ersatzteile, Wartungsrechte, Hardwarediagnose, Lade-/Reparaturkapazität und bestätigter Reparaturbeleg","FP05 C09"],
    ["fp05.city.civic-concourse.v1","Sozialer Stadtplatz","Reale persistente Einwohner, gültige Fakten und Dialoge sowie validierte Rechte-/Auftragscommands","FP05 C10"],
    ["fp05.city.spaceport-apron.v1","Raumhafen und späteres Raumfahrtprogramm","Tragfähige Infrastruktur, Energie, Daten, Fracht-/Treibstoffproduktion, Kühlung, Sicherheitsfreigaben und ein tatsächlich hergestelltes Schiff; Startschiff bleibt flugunfähig","FP05 C11 / §10.1"],
    ["fp05.city.grid-battery-recovery.v1","Stadt-Schwarzstartinsel","Externe Stromquelle, geprüfte/reparierte reale Speicher, Ladezustand, Leistungsgrenzen und Sektor-Feeder","FP05 C12"]
  ];
  const structures:readonly(readonly [string,string])[]=[
    ["Fuß-/Nivelliermodul","Endliche C09-Fertigmodule; Groundkontakt, Lastauflage und geprüfter Hub"],
    ["Kurze Stützstrebe","REC-05-BRACE: 4 kg Profile + 2 kg Blech ergeben 5,8 kg Stütze und 0,2 kg Verschnitt; lokale bezahlte Montage"],
    ["Kleine Deckplatte","Planungs-BOM: 12 kg Profile + 8 kg Blech; Tragfähigkeit und freie Spannweite offen"],
    ["Deckplatte klein","Eigene proportional und fachlich validierte BOM; Tragfähigkeit offen"],
    ["Langer Hauptträger","Geprüfte Struktur-, Material- und Lastdefinition"],["Konsol-/Wandstützelement","Wandanker, Lastauflage und eigene BOM"],["Rampenplatte","Geprüfte Höhen-/Querneigung, sichere Kante, Last- und Materialprofil"],
    ["Arbeitsbühne","Eigene BOM, Tragsockel und passende Absturzsicherung"],["Treppen-/Leitersegment","Kollisionsgeprüfte Tritte, Einstieg/Ausstieg und Materialdefinition"],["Wandsegment","Reale Verankerung, Material und deklarierte Portdurchgänge"],["Tor-/Durchgangsrahmen","Echte Portalfreiheit, strukturelle Anker und Material"],
    ["Dachsegment","Material, Unterträger und gesonderter Schutz-/Umweltvertrag"],["Geländer","Tatsächlich vorhandene Plattformkanten, sichere Wege und Material"],["Bandträger","Definierte Träger/Lastauflagen; in fertigen B10-Modulen enthaltene Träger nicht doppelt bezahlen"],["Kabel-/Leitungsträger","Physische Halterung oder ausdrücklich deklarierte Materialkosten"],["Eck-/Verbindungsstück","Registrierte Verbindung und Materialzuordnung; enthaltenes Teil nicht zugleich separat bezahlen"]
  ];
  structures.forEach(([name,requirements],index)=>rows.push([`ST-${String(index+1).padStart(2,"0")}`,name,requirements,"FP03 §4.2–4.5"]));
  const energy=["Expeditionsenergie","Biomasse-Peak","Einmalige Wind-Reassembly","Eigene Windfertigung","Größere erneuerbare Netze","Optionale thermische Versorgung","Stadt-/Raumhafennetz"];
  const energyNeeds=["Endliche Wind-/PV-Packs und Batterie; Wetter, Speicher und Leistungsgrenzen","Tatsächlicher Brennstoff, Abwärme und Reststoffpfad","Endliche C24-/C25-Kerne; kein zweiter Generator aus denselben Teilen","Reale Generatorbauteile, Präzisionsfertigung und geeigneter Windstandort","Reale Erzeuger, Speicher, Leitungen, Platz, Lastplanung und Netzkapazität","Brennstoff, Oxidator, Emissionen, Arbeits-/Kühlmedium und Service","Gesicherte Quellen, Umspannung und nachgewiesene Ausfallsicherheit"];
  energy.forEach((name,index)=>rows.push([`fp05.energy.P${index}`,name,energyNeeds[index]!,"FP05 §10.2"]));
  for(const recipe of catalog.recipes){
    const quantities=recipe.inputs.map(term=>{const item=catalog.items.find(i=>i.sourceId===term.itemId)!;return `${item.quantityBasis==="mg"?`${term.quantityUnits/1000000} kg`:`${term.quantityUnits} ${item.quantityBasis==="piece"?"Stück":"mm"}`} ${item.displayName}`;}).join(" + ");
    rows.push([recipe.sourceId,recipe.sourceId,`${quantities}; passende bezahlte Maschine/Werkzeuge, lokaler Input und freie Ausgänge${recipe.sourceId==="REC-04-CRUSH"?"; Gesteins-Packvolumen und Quellfreigabe offen":""}`,recipe.sourceRef]);
  }
  return Object.freeze(rows.map(([id,name,requirements,source])=>Object.freeze({id,name,status:available.has(id)?"AVAILABLE" as const:"PLANNED" as const,requirements:Object.freeze([requirements,available.has(id)?"Im Prototyp als technische S0-/Prozessfähigkeit unterstützt; Material, Aufbau und Betrieb werden separat geprüft":"Implementierung fehlt im FP06-Prototyp; Planungsdefinition und weitere Betriebsfreigaben ersetzen keinen baubaren Weltzustand",`Quelle: ${source}`]),reason:available.has(id)?null:"Geplantes Ziel; kein freigegebener Bau- oder Betriebscommand"})));
};


/** D05: six confirmed native 60-Hz ticks, never browser time or offline time. */
export const mountFactorySession = async (host: FactoryHostPort, catalog: FactoryCatalog): Promise<FactorySessionHandle> => {
  if (!host.current()) throw new Error("Factory requires a current, undisposed host");
  if (mountedHosts.has(host)) throw new Error("Factory already mounted on this host");
  const initial = host.read();
  if (!initial.confirmed || !["Running", "Paused"].includes(initial.physicsStatus) || !Number.isSafeInteger(initial.nativeTick) || initial.nativeTick < 0) {
    throw new Error("Factory requires a confirmed native tick baseline");
  }
  const fixture=createFp02Fixture("cargo");
  if(fixture.catalog.canonicalJson!==catalog.canonicalJson)throw new Error("Factory initial Cargo catalog binding mismatch");
  const technologies=readFactoryTechnologies(catalog);
  const initialMaterial=createFactoryMaterialView(catalog,[createResourceContainerSnapshot(createResourceContainerDefinition({containerId:fixture.resourceState.containerId,kind:"ShipCargo",maxMassKg:4000,maxVolumeM3:30,maxStackCount:200}),fixture.resourceState,catalog.resources)]);
  const materialAuthority=createFactoryMaterialAuthority(initialMaterial),domainSession=bindFactoryDomainSession(initial.sessionId),history=createFactoryCommandHistory();
  let construction:FactoryConstruction|undefined,commandBusy=false,focusedPanel:FactoryUiPanel|null=null,publicationRevision=0,lastReceipt:FactoryUiReceipt|null=null;
  const binding={sessionId:domainSession.domainSessionId,epoch:initial.epoch,netRevision:0,catalogDigest:catalog.catalogDigest,sourceProfileDigest:"fp01-fixed-net-observation-v1"};
  let domain:DryFactoryState={binding,revision:0,tickEndUs:"0",power:{version:"fp06-factory-power-v1",binding,revision:0,tickEndUs:"0",battery:null,consumers:[]},machines:[],belts:[],lastStep:null};
  const links:(FactoryPowerLink&Readonly<{version:"fp06-paid-native-cable-v1";lengthMm:number;containerId:string;routeMm:readonly(readonly number[])[];sourceProfileDigest:string;targetProfileDigest:string}>)[]=[];let lastPower:FactoryPowerSuccess|undefined;
  const selectedRecipes=new Map<string,import("./hostPort").FactoryUiRecipeRef>(),selectionRevisions=new Map<string,number>(),waitingStarts=new Map<string,ProductionStart>();
  let pendingDomain:Readonly<{uiCommand:FactoryUiCommand;instanceId:string;command:ProductionCommand;result:Promise<import("./hostPort").FactoryUiResult>;resolve:(status:FactoryUiReceipt["status"],reason:string|null)=>void}>|undefined;
  let pendingBelt:Readonly<{id:string;source:BeltInstalledPort;target:BeltInstalledPort}>|undefined;
  const installed=()=>construction?.read().installations??[];
  const recipesFor=(instanceId:string)=>{const installedOwner=installed().find(i=>i.instanceId===instanceId),device=catalog.devices.find(d=>d.sourceId===installedOwner?.definitionSourceId);return device?catalog.recipes.filter(recipe=>recipe.processes.some(p=>p.availability==="first-dry-loop"&&device.capabilities.includes(p.capability))):[];};
  const selectedRecipe=(instanceId:string)=>{const selected=selectedRecipes.get(instanceId),first=recipesFor(instanceId)[0];return selected??(first?{sourceId:first.sourceId,version:first.version,digest:first.digest}:null);};
  const machineUiRevision=(instanceId:string)=>{const revision=(domain.machines.find(m=>m.machineInstanceId===instanceId)?.revision??0)+(selectionRevisions.get(instanceId)??0);if(!Number.isSafeInteger(revision))throw Error("MachineUiRevisionExhausted");return revision;};
  const reconcile=()=>{
    if(construction?.read().state!=="Ready"||host.handling?.read().state!=="Idle")return;
    const logical=installed(),native=host.handling!.read();
    if(logical.some(i=>!native.owners.some(n=>n.instanceId===i.instanceId&&n.profileDigest===i.profileDigest&&n.definitionRef.sourceId===i.definitionSourceId)))throw Error("FactoryNativeInstallationMismatch");
    const old=materialAuthority.read(),next=reconcileDryFactoryInstallations(domain,old,logical);
    if(next.material!==old&&!materialAuthority.adopt(old,next.material))throw Error("FactoryBufferAdoptionMismatch");domain=next.state;
  };
  const factsFor=(instanceId:string,end:string):ProductionHostFacts=>{
    const i=installed().find(i=>i.instanceId===instanceId)!,definition=catalog.devices.find(d=>d.sourceId===i.definitionSourceId)!,native=host.handling!.read(),paid=materialAuthority.read().containers.find(c=>c.state.containerId===i.materialContainerId)!;
    const toolId=definition.sourceId==="B06"?"fp02.tool.cutter_head":definition.sourceId==="B07"?"fp02.tool.forming_die":"fp02.device.field_workbench";
    const tool=paid.state.contents.find(s=>s.resourceId===catalog.items.find(item=>item.sourceId===toolId)!.resourceId)!;
    const proof=native.production?.find(o=>o.instanceId===instanceId),hostView=host.read();
    const bound=!!proof&&proof.profileDigest===i.profileDigest&&proof.sourceDigest===i.sourceDigest&&proof.terrainRevision===hostView.terrain.revision&&proof.facilityRevision===native.revision;
    return {version:"fp06-production-host-facts-v1",binding:domain.binding,confirmed:hostView.confirmed,tickEndUs:end,installation:{instanceId,definitionRef:{sourceId:definition.sourceId,version:definition.version,digest:definition.digest},installationRevision:bound?proof.installationRevision:0,confirmed:bound&&proof.confirmed,supported:bound&&proof.supported,serviceClear:bound&&proof.serviceClear&&proof.sweepClear,installedContainerId:i.materialContainerId,inputContainerId:`input_${instanceId}`,outputContainerId:`output_${instanceId}`,offcutContainerId:`offcut_${instanceId}`,wipContainerId:`wip_${instanceId}`,powerConsumerId:`consumer_${instanceId}`,powerPortId:`power_${instanceId}`,tool:{partId:tool.stackId,sourceItemId:toolId,revision:paid.state.revision,condition:tool.condition===undefined||tool.condition===1?"OK":"damaged"}},interaction:{actorId:"hvp_player",actorRevision:hostView.nativeTick,confirmed:hostView.confirmed,serviceReachable:bound&&proof.accessible,accessibleContainers:(native.sources??[]).filter(s=>s.accessible).flatMap(s=>{const c=materialAuthority.read().containers.find(c=>c.state.containerId===s.containerId);return c?[{containerId:s.containerId,revision:c.state.revision}]:[]})}};
  };
  const advanceDomain=()=>{
    reconcile();
    const native=host.handling?.read(),nativeView=host.read();
    for(const portId of new Set(links.flatMap(link=>[link.fromPortId,link.toPortId]))){
      const proof=native?.powerPorts?.find(p=>p.portId===portId),owner=installed().find(i=>i.instanceId===proof?.instanceId);
      if(!proof?.confirmed||!owner||proof.profileDigest!==owner.profileDigest||proof.sourceDigest!==owner.sourceDigest||proof.terrainRevision!==nativeView.terrain.revision||proof.facilityRevision!==native?.revision)throw Error("NativePowerOwnerUnavailable");
    }
    const old=materialAuthority.read(),end=String(BigInt(domain.tickEndUs)+100000n),supply=readDryFactorySupply(domain,old,installed(),links,end);
    const queued=pendingDomain;
    if(queued&&canonicalJson(queued.uiCommand.expected)!==canonicalJson(uiBinding())){pendingDomain=undefined;queued.resolve("Rejected","StaleQueuedDomainCommand");}
    const activePending=pendingDomain;
    const input={confirmed:true,binding:domain.binding,tickStartUs:domain.tickEndUs,tickEndUs:end,material:old,supply,machines:domain.machines.map(machine=>{const command=activePending?.instanceId===machine.machineInstanceId?activePending.command:waitingStarts.get(machine.machineInstanceId);return {instanceId:machine.machineInstanceId,facts:factsFor(machine.machineInstanceId,end),...(command?{command}:{})};}),belts:domain.belts.map(line=>{const source=old.containers.find(c=>c.state.containerId===line.installation.source.containerId),stack=source?.state.contents[0],item=catalog.items.find(i=>i.resourceId===stack?.resourceId);return {lineId:line.lineId,actorId:"hvp_player",enabled:true,sourceLot:stack&&item?{stackId:stack.stackId,itemId:item.sourceId}:null};})};
    const proposal=prepareDryFactoryStep(domain,input),committed=commitDryFactoryStep(domain,input,proposal);if(committed.status!=="Committed"||proposal.status!=="Prepared")throw Error(committed.status==="Rejected"?committed.reason:"FactoryUnexpectedReplay");
    if(!materialAuthority.adopt(old,committed.material))throw Error("FactoryDomainMaterialCAS");domain=committed.state;lastPower=proposal.power;
    if(activePending?.command.kind==="start")waitingStarts.set(activePending.instanceId,activePending.command);
    for(const machine of domain.machines)if(machine.job)waitingStarts.delete(machine.machineInstanceId);
    if(activePending){pendingDomain=undefined;activePending.resolve("Committed",null);}
  };
  let workHoldReason:string|null=null;
  let notifyUi=()=>{};
  if(host.construction){const native=host.construction;
    construction=createFactoryConstruction({...native,materialAuthority,readPlacementView:()=>({...native.readFacts(),material:materialAuthority.read(),installations:[]}),pause:async()=>{await host.pause();},notify:()=>notifyUi(),prepareAdoption:plan=>{
      if(plan.request.transactionId!==pendingBelt?.id)return undefined;
      const oldDomain=domain,oldPower=lastPower,paired=reconcileDryFactoryInstallations(domain,plan.materialCandidate,[...installed(),plan.installation],domain.binding.netRevision+1),next=adoptDryFactoryBelt(paired.state,paired.material,plan.installation,pendingBelt.source,pendingBelt.target);
      return {material:next.material,publish:()=>{domain=next.state;lastPower=undefined;},rollback:()=>{domain=oldDomain;lastPower=oldPower;}};
    }},initialMaterial);
  }
  const handling=host.handling?createFactoryHandling({native:host.handling,materialAuthority,current:()=>host.current(),pause:async()=>{await host.pause();}}):undefined;
  // Failed catalog/Resources initialization has not acquired this Host's Factory mount.
  mountedHosts.add(host);
  let disposed = false;
  let view: FactorySessionView = Object.freeze({ sessionId: initial.sessionId, epoch: initial.epoch,
    catalogDigest: catalog.catalogDigest, nativeTick: initial.nativeTick, remainderTicks: 0,
    steps: 0, elapsedMs: 0, state: "Ready" });
  const listeners = new Set<(view: FactorySessionView) => void>();
  const publish = (next: FactorySessionView) => {
    view = Object.freeze(next);
    for (const listener of listeners) listener(view);
    notifyUi();
  };
  const observe = (confirmed: FactoryHostView) => {
    if (disposed || !host.current() || view.state === "RecoveryHold") return;
    if (["RecoveryHold", "Disposed"].includes(confirmed.physicsStatus) || confirmed.sessionId !== initial.sessionId || confirmed.epoch !== initial.epoch
      || !Number.isSafeInteger(confirmed.nativeTick) || confirmed.nativeTick < view.nativeTick) {
      const pending=pendingDomain;pendingDomain=undefined;pending?.resolve("RecoveryHold","NativeHostBindingLost");publish({ ...view, state: "RecoveryHold" }); return;
    }
    if (!confirmed.confirmed || !["Running", "Paused"].includes(confirmed.physicsStatus)) {
      if (view.state !== "WaitingForHost") publish({ ...view, state: "WaitingForHost" });
      return;
    }
    // A temporary verified service/support obstruction holds the common work
    // candidate, while the SAME Native world remains available for walking and repair.
    // Held native intervals grant no work, energy or catch-up; existing remainder/WIP survives.
    const facilities=host.handling?.read(),wasWorkHeld=workHoldReason!==null;
    workHoldReason=null;
    for(const machine of domain.machines){
      if(!machine.job||machine.job.phase==="COMPLETED"||machine.job.start.processKind!=="electric")continue;
      const installedOwner=installed().find(i=>i.instanceId===machine.machineInstanceId),proof=facilities?.production?.find(p=>p.instanceId===machine.machineInstanceId);
      if(proof?.confirmed&&proof.profileDigest===installedOwner?.profileDigest&&proof.sourceDigest===installedOwner?.sourceDigest&&proof.terrainRevision===confirmed.terrain.revision&&proof.facilityRevision===facilities?.revision){
        if(!proof.supported)workHoldReason="WAIT_SUPPORT";
        else if(!proof.serviceClear||!proof.sweepClear)workHoldReason="WAIT_SERVICE";
      }
      if(workHoldReason)break;
    }
    if(workHoldReason){publish({...view,state:"WaitingForHost",nativeTick:confirmed.nativeTick});return;}
    // The first observed clearance is a new baseline: a clear snapshot cannot
    // retrospectively confirm eligibility of ticks since the last blocked read.
    if(wasWorkHeld){publish({...view,state:"Ready",nativeTick:confirmed.nativeTick});return;}
    if (confirmed.nativeTick === view.nativeTick) {
      if (view.state === "WaitingForHost") publish({ ...view, state: "Ready" });
      return;
    }
    const ticks = view.remainderTicks + confirmed.nativeTick - view.nativeTick;
    const steps = view.steps + Math.floor(ticks / 6);
    if (!Number.isSafeInteger(ticks) || !Number.isSafeInteger(steps * 100)) {
      publish({ ...view, state: "RecoveryHold" }); return;
    }
    try{for(let step=view.steps;step<steps;step++)advanceDomain();}catch(error){const pending=pendingDomain;pendingDomain=undefined;pending?.resolve("RecoveryHold",String(error));publish({...view,state:"RecoveryHold"});return;}
    publish({ ...view, state: "Ready", nativeTick: confirmed.nativeTick, remainderTicks: ticks % 6, steps, elapsedMs: steps * 100 });
  };
  const uiListeners=new Set<(snapshot:FactoryUiReadModel)=>void>();
  const uiBinding=():FactoryUiBinding=>{const native=host.read(),facilities=host.handling?.read();return {catalogDigest:catalog.catalogDigest,terrainSourceDigest:native.terrain.sourceDigest,powerSourceProfileDigest:"fp01-fixed-net-observation-v1",terrainRevision:native.terrain.revision,facilityRevision:facilities?.revision??host.construction?.readFacts().binding.facilityRevision??0,materialRevision:materialAuthority.read().revision,netRevision:domain.binding.netRevision,handlingRevision:facilities?.revision??0};};
  const readUi=():FactoryUiReadModel=>{
    const native=host.read(),facilities=host.handling?.read(),material=materialAuthority.read(),binding=uiBinding();
    const access=(id:string)=>id===facilities?.cargo?.containerId?facilities.cargo.accessible&&facilities.cargo.opened:id===facilities?.carrier?.containerId?facilities.carrier.phase==="Carrying"||facilities.carrier.accessible===true:facilities?.sources?.some(s=>s.containerId===id&&s.accessible)===true;
    const available=(view.state==="Ready"||workHoldReason!==null)&&native.confirmed&&!commandBusy&&!pendingDomain&&!construction?.busy&&!handling?.busy;
    const profiles=["C26-PACK","C27-PACK","B06-BOM","B07-BOM","BATTERY-PACK","DISTRIBUTOR-PACK","BENCH-PACK","BIN-PACK","BELT4","CABLE40",...Object.keys(FACTORY_CLOSED_CABLE_JOBS),"RAW8","MONTAGE","BRACE"];
    const inventory:FactoryUiInventory[]=material.containers.map(c=>{
      const id=c.state.containerId,accessible=access(id),role=id===facilities?.cargo?.containerId?"cargo":id===facilities?.carrier?.containerId?(facilities.carrier.phase==="Deposited"?"depot":"carrier"):id.startsWith("installed_")?"installed":id.startsWith("input_")?"input":id.startsWith("output_")?"output":id.startsWith("offcut_")?"offcut":id.startsWith("wip_")?"wip":id.startsWith("belt_")?"belt":"depot";
      const contents=c.state.contents.map(stack=>{const item=catalog.items.find(i=>i.resourceId===stack.resourceId)!;return {stackId:stack.stackId,itemId:item.sourceId,name:item.displayName,quantityUnits:stack.quantity,quantityBasis:item.quantityBasis,massMg:validateFactoryAmount(item.sourceId,stack.quantity,catalog).massMg,freshProduction:Boolean(stack.extensions["factory.production"])};});
      const pickupProfiles=profiles.flatMap(id=>{const profile=readCargoHandlingProfile(catalog,id);if(!profile)return [];const lots:import("./hostPort").FactoryUiLotRef[]=[];
        for(const term of profile.terms){const item=catalog.items.find(i=>i.sourceId===term.itemId)!;let left=term.quantityUnits;for(const stack of c.state.contents){if(stack.resourceId!==item.resourceId||!left)continue;const quantityUnits=Math.min(left,stack.quantity);lots.push({containerId:c.state.containerId,containerRevision:c.state.revision,stackId:stack.stackId,quantityUnits});left-=quantityUnits;}if(left)return [];}
        return [{profileId:id,name:id,sourceLots:lots,capability:{enabled:available&&accessible&&!facilities?.carrier&&Boolean(handling),reason:available&&accessible&&!facilities?.carrier?null:"Quelle nicht erreichbar oder Transport belegt"}}];});
      return {id,revision:c.state.revision,ownerId:c.state.ownerId??null,role,accessible,massMg:contents.reduce((n,s)=>n+s.massMg,0),capacityMassMg:Math.round(c.definition.maxMassKg*1000000),capacityVolumeMm3:Math.round(c.definition.maxVolumeM3*1000000000),contents,pickupProfiles};
    });
    const currentTechnologies=Object.freeze(technologies.map(technology=>{
      if(technology.status!=="AVAILABLE")return technology;
      const deficits:string[]=[];
      if(!native.confirmed||disposed)deficits.push("Bestätigter Nativezustand fehlt; Aufbau und Betrieb warten auf die tatsächliche Hostfreigabe");
      const device=catalog.devices.find(d=>d.sourceId===technology.id),recipe=catalog.recipes.find(r=>r.sourceId===technology.id);
      const alreadyBuilt=device&&installed().some(i=>i.definitionSourceId===device.sourceId);
      const terms=alreadyBuilt?[]:recipe?.inputs??device?.bom??[];
      for(const term of terms){
        const item=catalog.items.find(i=>i.sourceId===term.itemId)!;
        const owned=inventory.filter(c=>c.role!=="installed"&&c.role!=="wip").flatMap(c=>c.contents).filter(s=>s.itemId===item.sourceId).reduce((n,s)=>n+s.quantityUnits,0);
        if(owned<term.quantityUnits){const missing=term.quantityUnits-owned;deficits.push(`Im freien Bestand fehlen ${item.quantityBasis==="mg"?`${missing/1000000} kg`:`${missing} ${item.quantityBasis==="piece"?"Stück":"mm"}`} ${item.displayName}`);}
      }
      return deficits.length?Object.freeze({...technology,status:"MISSING_REQUIREMENTS" as const,reason:deficits[0]!,requirements:Object.freeze([...deficits.slice(0,3),...technology.requirements])}):technology;
    }));
    const carrier=facilities?.carrier,validCarrier=carrier&&(carrier.phase==="Carrying"||carrier.phase==="Deposited")?{id:carrier.ownerId,revision:facilities!.revision,profileId:carrier.profileId,phase:carrier.phase,massMg:carrier.massMg}:null;
    const custody=validCarrier&&material.containers.find(c=>c.state.containerId===carrier!.containerId);
    const localDeposits=custody&&custody.state.contents.length?inventory.filter(target=>target.id!==custody.state.containerId&&target.accessible&&facilities?.sources?.some(source=>source.containerId===target.id&&source.accessible&&(target.role==="input"||target.id===`storage_${source.instanceId}`))).map(target=>{
      let ordinal=0;while(material.receipts.some(r=>r.transactionId===`ui_deposit_admission_${ordinal}`))ordinal++;
      // Read-only whole-custody admission; its hypothetical receipt is never adopted.
      const checked=prepareFactoryMaterialStep(material,{kind:"transfer",transactionId:`ui_deposit_admission_${ordinal}`,ownerId:custody.state.ownerId!,actorId:"hvp_player",moves:custody.state.contents.map(stack=>({sourceContainerId:custody.state.containerId,sourceStackId:stack.stackId,targetContainerId:target.id,targetStackId:stack.stackId,itemId:catalog.items.find(item=>item.resourceId===stack.resourceId)!.sourceId,quantityUnits:stack.quantity}))});
      const enabled=available&&access(custody.state.containerId)&&checked.status==="Prepared";
      return {target:{id:target.id,revision:target.revision},capability:{enabled,reason:enabled?null:checked.status==="Rejected"?"Der vollständige Transport passt hier nicht hinein":"Transport nicht erreichbar oder Werkstatt beschäftigt"}};
    }):[];
    const connections:NonNullable<FactoryUiReadModel["connections"]>={power:[],belts:[]};
    const power=facilities?.powerPorts?.filter(p=>p.confirmed&&p.terrainRevision===native.terrain.revision&&p.facilityRevision===facilities.revision&&installed().some(i=>i.instanceId===p.instanceId&&i.profileDigest===p.profileDigest&&i.sourceDigest===p.sourceDigest))??[];
    for(const source of power)for(const target of power){
      if(source.instanceId===target.instanceId||source.role==="PowerConsumer"||target.role==="PowerProducer"||links.some(l=>[l.fromPortId,l.toPortId].includes(source.portId)&&[l.fromPortId,l.toPortId].includes(target.portId)))continue;
      const lengthMm=Math.ceil(source.positionMm.reduce((n,v,i)=>n+Math.abs(target.positionMm[i]!-v),0)/250)*250;if(lengthMm<=0||lengthMm>40000)continue;
      const c=inventory.find(c=>c.accessible&&c.contents.some(s=>s.itemId==="fp02.comp.field_cable"&&s.quantityUnits>=lengthMm)&&(c.id!==carrier?.containerId||(carrier.phase==="Deposited"&&carrier.profileId===`CABLE${lengthMm}`&&c.contents.length===1&&c.contents[0]!.quantityUnits===lengthMm))),lot=c?.contents.find(s=>s.itemId==="fp02.comp.field_cable"&&s.quantityUnits>=lengthMm);
      const enabled=available&&source.accessible&&target.accessible&&!!lot;
      (connections.power as Array<NonNullable<FactoryUiReadModel["connections"]>["power"][number]>).push({id:`${source.portId}_${target.portId}`,sourcePortId:source.portId,targetPortId:target.portId,lengthMm,cableLot:c&&lot?{containerId:c.id,containerRevision:c.revision,stackId:lot.stackId,quantityUnits:lengthMm}:null,capability:{enabled,reason:enabled?null:!source.accessible||!target.accessible?"Beide Anschlüsse müssen erreichbar sein":`Genau ${lengthMm/1000} m Kabel hier ablegen`}});
    }
    const solid=installed().flatMap(owner=>{const proof=facilities?.production?.find(p=>p.instanceId===owner.instanceId);if(!proof?.confirmed||!proof.supported||proof.terrainRevision!==native.terrain.revision||proof.facilityRevision!==facilities?.revision||proof.profileDigest!==owner.profileDigest||proof.sourceDigest!==owner.sourceDigest)return [];return (catalog.devices.find(d=>d.sourceId===owner.definitionSourceId)?.ports??[]).filter(p=>["SolidBatchOut","SolidBatchIn"].includes(p.role)).map(p=>({role:p.role,port:readDryFactoryBeltPort(catalog,owner,p.sourceId,proof.installationRevision)}));});
    for(const source of solid)for(const target of solid){if(source.role!=="SolidBatchOut"||target.role!=="SolidBatchIn"||source.port.instanceId===target.port.instanceId||domain.belts.some(l=>l.installation.source.nativePortId===source.port.nativePortId||l.installation.target.nativePortId===target.port.nativePortId))continue;
      const delta=target.port.centerMm.map((n,i)=>n-source.port.centerMm[i]!);if(canonicalJson(delta)!==canonicalJson(source.port.outwardNormal.map(n=>n*4000))||canonicalJson(target.port.outwardNormal)!==canonicalJson(source.port.outwardNormal.map(n=>n===0?0:-n)))continue;
      const depot=carrier?.phase==="Deposited"&&carrier.profileId==="BELT4"?inventory.find(c=>c.id===carrier.containerId&&c.accessible):undefined,enabled=available&&!!depot;
      (connections.belts as Array<NonNullable<FactoryUiReadModel["connections"]>["belts"][number]>).push({id:`${source.port.nativePortId}_${target.port.nativePortId}`,sourcePortId:source.port.nativePortId,targetPortId:target.port.nativePortId,sourceLots:depot?.contents.map(l=>({containerId:depot.id,containerRevision:depot.revision,stackId:l.stackId,quantityUnits:l.quantityUnits}))??[],capability:{enabled,reason:enabled?null:"Vier Bandmodule und einen Antrieb als Depot hier ablegen"}});
    }
    return Object.freeze<FactoryUiReadModel>({version:"fp06-ui-read-v1",sessionId:initial.sessionId,epoch:initial.epoch,publicationRevision,binding,host:native,factorySteps:view.steps,elapsedMs:view.elapsedMs,state:disposed?"Disposed":view.state==="RecoveryHold"||handling?.recovery?"RecoveryHold":view.state==="Ready"?"Ready":"Waiting",reason:workHoldReason,focusedPanel,inventory,connections,machines:domain.machines.map(machine=>{const i=installed().find(i=>i.instanceId===machine.machineInstanceId)!,device=catalog.devices.find(d=>d.sourceId===i.definitionSourceId)!,recipes=catalog.recipes.filter(recipe=>recipe.processes.some(p=>p.availability==="first-dry-loop"&&device.capabilities.includes(p.capability))),job=machine.job;return {id:i.instanceId,revision:machineUiRevision(i.instanceId),definitionId:device.sourceId,name:device.sourceId,installed:true,status:workHoldReason&&job?.phase!=="COMPLETED"?workHoldReason:machine.status,reason:workHoldReason,selectedRecipe:selectedRecipe(i.instanceId),recipes:recipes.map(recipe=>{const process=recipe.processes.find(p=>p.availability==="first-dry-loop"&&device.capabilities.includes(p.capability))!;return {ref:{sourceId:recipe.sourceId,version:recipe.version,digest:recipe.digest},name:recipe.sourceId,durationMs:process.durationMs,powerWatts:process.powerWatts};}),jobId:job?.phase!=="COMPLETED"?job?.start.jobId??null:null,confirmedWorkMs:job?.start.processKind==="electric"?Number(BigInt(job.workMilliJoule)/BigInt(catalog.recipes.find(r=>r.sourceId===job.recipeRef.sourceId)!.processes.find(p=>p.kind==="electric")!.powerWatts)):0,requiredWorkMs:job?catalog.recipes.find(r=>r.sourceId===job.recipeRef.sourceId)!.processes.find(p=>p.kind===job.start.processKind)!.durationMs:null,allocatedWatts:Number(lastPower?.grants.find(g=>g.deviceInstanceId===i.instanceId)?.allocatedMilliWatt??"0")/1000,inputContainerId:`input_${i.instanceId}`,outputContainerId:`output_${i.instanceId}`,offcutContainerId:`offcut_${i.instanceId}`,wipContainerId:`wip_${i.instanceId}`,installedContainerId:i.materialContainerId,ports:device.ports.map(p=>({id:p.role==="PowerConsumer"?`power_${i.instanceId}`:`port_${i.instanceId}_${p.runtimeId}`,role:p.role,connected:links.some(l=>l.fromPortId===`power_${i.instanceId}`||l.toPortId===`power_${i.instanceId}`)})),actions:{start:{enabled:available&&!waitingStarts.has(i.instanceId)&&(!job||job.phase==="COMPLETED")&&facilities?.production?.some(p=>p.instanceId===i.instanceId&&p.confirmed&&p.supported&&p.serviceClear&&p.sweepClear)===true,reason:waitingStarts.has(i.instanceId)?"Auftrag wartet auf Versorgung":null},manualWork:{enabled:available&&job?.phase==="LAID_OUT",reason:null},manualFinish:{enabled:available&&job?.phase==="ASSEMBLED",reason:null},toggle:{enabled:false,reason:null}}};}),power:{status:links.length?"CONNECTED":"UNCONNECTED",generationWatts:lastPower?Number(BigInt(lastPower.balance.sourceActual.n)/BigInt(lastPower.balance.sourceActual.d))/100:0,allocatedWatts:(lastPower?.grants??[]).reduce((n,g)=>n+Number(g.allocatedMilliWatt)/1000,0),batteryEnergyJ:domain.power.battery?Number(BigInt(domain.power.battery.storedEnergy.n))/Number(BigInt(domain.power.battery.storedEnergy.d))/1000:null,batteryCapacityJ:domain.power.battery?14400000:null,reserveEnergyJ:domain.power.battery?3600000:null,sourceQuality:"unsupported",consumers:(lastPower?.grants??[]).map(g=>({id:g.consumerId,name:g.deviceInstanceId,requestedWatts:Number(g.requiredMilliWatt)/1000,allocatedWatts:Number(g.allocatedMilliWatt)/1000,reason:g.status}))},technologies:currentTechnologies,interaction:{localDeposits,cargoOpened:facilities?.cargo?.opened??false,cargoAccessible:facilities?.cargo?.accessible??false,handling:validCarrier,openCargo:{enabled:available&&Boolean(facilities?.cargo?.accessible),reason:facilities?.cargo?.accessible?null:"Wrackfracht nicht erreichbar"},deposit:{enabled:available&&carrier?.phase==="Carrying",reason:carrier?.phase==="Carrying"?null:"Kein aktiver Transport"},returnCargo:{enabled:available&&Boolean(validCarrier)&&Boolean(facilities?.cargo?.accessible),reason:facilities?.cargo?.accessible?null:"Wrackfracht nicht erreichbar"}},lastReceipt});
  };
  notifyUi=()=>{if(disposed||!host.current())return;try{reconcile();}catch{view=Object.freeze({...view,state:"RecoveryHold"});}publicationRevision++;if(uiListeners.size){const snapshot=readUi();for(const listener of uiListeners)listener(snapshot);}};
  const ui:FactoryUiPort=Object.freeze({read:readUi,subscribe:(listener:(snapshot:FactoryUiReadModel)=>void)=>{if(disposed)throw Error("Factory session disposed");uiListeners.add(listener);return ()=>uiListeners.delete(listener);},readReceipt:history.readReceipt,setPanelFocus:(panel:FactoryUiPanel|null)=>{if(disposed)return;focusedPanel=panel;host.setPanelFocus?.(panel);notifyUi();},submit:async(incoming:FactoryUiCommand):Promise<import("./hostPort").FactoryUiResult>=>{
    const command:FactoryUiCommand=JSON.parse(canonicalJson(incoming));
    const old=history.replay(command);if(old)return old;
    if(pendingDomain?.uiCommand.commandId===command.commandId){
      if(canonicalJson(pendingDomain.uiCommand)===canonicalJson(command))return pendingDomain.result;
      return {status:"Rejected",receipt:{commandId:command.commandId,requestCanonicalJson:canonicalJson(command),status:"Rejected",reason:"IdempotencyConflict",publicationRevision,binding:uiBinding()}};
    }
    const finish=(status:FactoryUiReceipt["status"],reason:string|null)=>{const receipt:FactoryUiReceipt={commandId:command.commandId,requestCanonicalJson:canonicalJson(command),status,reason,publicationRevision:publicationRevision+1,binding:uiBinding()};history.accept(command,receipt);lastReceipt=receipt;notifyUi();return {status,receipt};};
    if(disposed||!host.current()||!isSaveSafeResourceId(command.commandId)||command.sessionId!==initial.sessionId||command.epoch!==initial.epoch||command.version!=="fp06-ui-command-v1")return finish("Rejected","InvalidCommandBinding");
    if(view.state==="RecoveryHold")return finish("RecoveryHold","FactorySessionRecoveryHold");
    if(commandBusy||pendingDomain||construction?.busy||handling?.busy||canonicalJson(command.expected)!==canonicalJson(uiBinding())||!host.read().confirmed)return finish("Rejected","StaleOrBusyCommand");
    commandBusy=true;
    try{
      if(command.kind==="open-cargo"){if(!host.construction)throw Error("NativeCargoUnavailable");await host.construction.openCargo();return finish("Committed",null);}
      if(["pickup","deposit","return","transfer"].includes(command.kind)){if(!handling)throw Error("NativeHandlingUnavailable");const result=await handling.submit(command);return finish(result.status,result.reason);}
      if(command.kind==="connect-belt"){
        if(!construction||!host.handling)throw Error("NativeBeltUnavailable");reconcile();const native=host.handling.read();
        const endpoint=(portId:string,role:string)=>{
          for(const owner of installed())for(const port of catalog.devices.find(d=>d.sourceId===owner.definitionSourceId)?.ports??[]){
            if(port.role!==role||`port_${owner.instanceId}_${port.runtimeId}`!==portId)continue;
            const proof=native.production?.find(p=>p.instanceId===owner.instanceId);
            if(!proof?.confirmed||!proof.supported||!proof.profileDigest||proof.profileDigest!==owner.profileDigest||proof.sourceDigest!==owner.sourceDigest||proof.terrainRevision!==host.read().terrain.revision||proof.facilityRevision!==native.revision)throw Error("NativeBeltEndpointUnavailable");
            return readDryFactoryBeltPort(catalog,owner,port.sourceId,proof.installationRevision);
          }throw Error("NativeBeltPortMissing");
        };
        const source=endpoint(command.sourcePortId,"SolidBatchOut"),target=endpoint(command.targetPortId,"SolidBatchIn"),delta=target.centerMm.map((v,i)=>v-source.centerMm[i]!);
        if(canonicalJson(delta)!==canonicalJson(source.outwardNormal.map(n=>n*4000))||canonicalJson(target.outwardNormal)!==canonicalJson(source.outwardNormal.map(n=>n===0?0:-n)))throw Error("UnsupportedNativeBeltRoute");
        const quarterTurns=source.outwardNormal[0]===1?0:source.outwardNormal[2]===-1?1:source.outwardNormal[0]===-1?2:3,centerMm=source.centerMm.map((v,i)=>(v+target.centerMm[i]!)/2-(i===1?1000:0));
        const plan=construction.preview({transactionId:command.commandId,instanceId:`line_${command.commandId}`,definitionSourceId:"fp06.line.belt_4m",centerMm,quarterTurns});if(plan.status!=="Prepared")throw Error(plan.reason);
        const lots=JSON.parse(plan.materialCandidate.receipts.find(r=>r.transactionId===command.commandId)!.requestCanonicalJson).moves as import("../material/reservations").MaterialMove[];
        const expected=lots.map(move=>({containerId:move.sourceContainerId,containerRevision:materialAuthority.read().containers.find(c=>c.state.containerId===move.sourceContainerId)!.state.revision,stackId:move.sourceStackId,quantityUnits:move.quantityUnits}));
        const ordered=(values:readonly import("./hostPort").FactoryUiLotRef[])=>canonicalJson([...values].sort((a,b)=>a.stackId.localeCompare(b.stackId)));
        if(ordered(expected)!==ordered(command.sourceLots))throw Error("PaidBeltSourceLotsMismatch");
        pendingBelt={id:command.commandId,source,target};try{const result=await construction.commit(plan);return finish(result.status,result.status==="Committed"?null:result.reason);}finally{pendingBelt=undefined;}
      }
      if(command.kind==="connect-power"){
        await host.pause();reconcile();
        if(canonicalJson(command.expected)!==canonicalJson(uiBinding()))throw Error("StaleCableCommandAfterPause");
        const native=host.handling?.read(),source=native?.powerPorts?.find(p=>p.portId===command.sourcePortId),target=native?.powerPorts?.find(p=>p.portId===command.targetPortId);
        const admitted=(p:typeof source)=>p&&p.confirmed&&p.accessible&&p.terrainRevision===host.read().terrain.revision&&p.facilityRevision===native?.revision&&installed().some(i=>i.instanceId===p.instanceId&&i.profileDigest===p.profileDigest&&i.sourceDigest===p.sourceDigest);
        if(!admitted(source)||!admitted(target)||source!.instanceId===target!.instanceId||source!.role==="PowerConsumer"||target!.role==="PowerProducer")throw Error("NativePowerConnectionUnavailable");
        if(links.some(l=>(l.fromPortId===source!.portId&&l.toPortId===target!.portId)||(l.fromPortId===target!.portId&&l.toPortId===source!.portId)))throw Error("PowerPortsAlreadyConnected");
        const a=source!.positionMm,b=target!.positionMm,rawLength=a.reduce((n,value,index)=>n+Math.abs(b[index]!-value),0),lengthMm=Math.ceil(rawLength/250)*250;
        if(!Number.isSafeInteger(lengthMm)||lengthMm<=0||lengthMm>40000||command.cableLot.quantityUnits!==lengthMm)throw Error("CableLengthMismatch");
        const old=materialAuthority.read(),lot=command.cableLot,container=old.containers.find(c=>c.state.containerId===lot.containerId),cable=catalog.items.find(i=>i.sourceId==="fp02.comp.field_cable")!,stack=container?.state.contents.find(s=>s.stackId===lot.stackId);
        if(!container||container.state.revision!==lot.containerRevision||stack?.resourceId!==cable.resourceId||!readUi().inventory.some(i=>i.id===lot.containerId&&i.accessible))throw Error("CableSourceUnavailable");
        const custody=native?.carrier?.containerId===lot.containerId?native.carrier:undefined;
        // This closed job consumes the whole deposited payload. CABLE40 stays
        // indivisible in Native custody; no variable mass or remote held cable.
        if(custody&&(custody.phase!=="Deposited"||!custody.accessible||!Object.hasOwn(FACTORY_CLOSED_CABLE_JOBS,custody.profileId)||FACTORY_CLOSED_CABLE_JOBS[custody.profileId as keyof typeof FACTORY_CLOSED_CABLE_JOBS]!==lengthMm||container.state.contents.length!==1||stack!.quantity!==lengthMm||custody.profileDigest!==readCargoHandlingProfile(catalog,custody.profileId)?.digest))throw Error("CableCustodyUnavailable");
        const amount=validateFactoryAmount(cable.sourceId,lengthMm,catalog),volume=cable.volumeProfile;if(volume.kind==="unknown")throw Error("CableVolumeUnknown");
        const volumeMm3=Number((BigInt(lengthMm)*BigInt(volume.numeratorMm3)+BigInt(volume.denominatorUnits)-1n)/BigInt(volume.denominatorUnits)),containerId=`installed_cable_${command.commandId}`;
        if(old.containers.some(c=>c.state.containerId===containerId))throw Error("CableLedgerAlreadyExists");
        const ledger=createResourceContainerSnapshot(createResourceContainerDefinition({containerId,kind:"OutpostStorage",maxMassKg:amount.massMg/1000000,maxVolumeM3:volumeMm3/1000000000,maxStackCount:1}),createResourceContainerState({containerId,ownerId:container.state.ownerId,contents:[]},catalog.resources),catalog.resources),augmented={...old,containers:[...old.containers,ledger]};
        const plan=prepareFactoryMaterialStep(augmented,{kind:"transfer",transactionId:command.commandId,ownerId:container.state.ownerId!,actorId:"hvp_player",moves:[{sourceContainerId:container.state.containerId,sourceStackId:stack!.stackId,targetContainerId:containerId,targetStackId:`cable_${command.commandId}`,itemId:cable.sourceId,quantityUnits:lengthMm}]});if(plan.status!=="Prepared")throw Error(plan.reason);
        const material=commitFactoryMaterialStep(augmented,plan);if(material.status!=="Committed")throw Error(material.status==="Rejected"?material.reason:"UnexpectedCableReplay");
        const end=String(BigInt(domain.tickEndUs)+100000n),supply=readDryFactorySupply(domain,old,installed(),links,end),from=supply.ports.find(p=>p.portId===source!.portId),to=supply.ports.find(p=>p.portId===target!.portId);if(!from||!to)throw Error("PowerSupplyPortMissing");
        const next=reconcileDryFactoryInstallations(domain,material.view,installed(),domain.binding.netRevision+1);
        const link={version:"fp06-paid-native-cable-v1" as const,linkId:`link_${command.commandId}`,fromPortId:source!.portId,toPortId:target!.portId,active:true,maxMilliWatt:String(BigInt(from.maxMilliWatt)<BigInt(to.maxMilliWatt)?BigInt(from.maxMilliWatt):BigInt(to.maxMilliWatt)),lengthMm,containerId,routeMm:[a,[b[0],a[1],a[2]],[b[0],a[1],b[2]],b],sourceProfileDigest:source!.profileDigest,targetProfileDigest:target!.profileDigest};
        const oldDomain=domain,oldPower=lastPower;let prepared=false,adopted=false,published=false;
        try{
          if(custody){const empty=next.material.containers.find(c=>c.state.containerId===custody.containerId)!;
            await host.handling!.prepare({transactionId:command.commandId,ownerId:custody.ownerId,profileId:custody.profileId,profileDigest:custody.profileDigest,expectedRevision:native!.revision,expectedTerrainRevision:command.expected.terrainRevision,sourceContainerId:custody.containerId,emptyCustodyCanonicalJson:empty.state.canonicalJson,materialBinding:factoryMaterialBytes(next.material)},"release");prepared=true;await host.handling!.commit(command.commandId);
          }
          if(!host.current()||!materialAuthority.adopt(old,next.material))throw Error("CableMaterialCAS");adopted=true;
          // No await: complete material, graph and held Native publication adopt together.
          domain=next.state;lastPower=undefined;links.push(link);
          if(custody){published=true;host.handling!.publish(command.commandId);await host.handling!.finalize(command.commandId);}
        }catch(error){
          if(published||String(error).includes("RecoveryHold")){publish({...view,state:"RecoveryHold"});throw Error(`RecoveryHold: ${String(error)}`);}
          try{if(prepared)await host.handling!.rollback(command.commandId);if(adopted&&!materialAuthority.adopt(next.material,old))throw Error("CableRollbackNotProven");domain=oldDomain;lastPower=oldPower;if(links.at(-1)===link)links.pop();}
          catch(rollback){publish({...view,state:"RecoveryHold"});throw Error(`RecoveryHold: ${String(rollback)}`);}
          throw error;
        }
        return finish("Committed",null);
      }
      if(command.kind==="select-recipe"||command.kind==="start"||command.kind==="manual-work"||command.kind==="manual-finish"){
        reconcile();const machine=domain.machines.find(m=>m.machineInstanceId===command.machine.id);
        if(!machine||command.machine.revision!==machineUiRevision(machine.machineInstanceId))throw Error("StaleMachineCommand");
        const id=machine.machineInstanceId;
        if(command.kind==="select-recipe"){
          if(machine.job&&machine.job.phase!=="COMPLETED"||waitingStarts.has(id))throw Error("ActiveJobRecipeLocked");
          const recipe=recipesFor(id).find(r=>canonicalJson({sourceId:r.sourceId,version:r.version,digest:r.digest})===canonicalJson(command.recipe));if(!recipe)throw Error("RecipeUnavailable");
          selectedRecipes.set(id,command.recipe);selectionRevisions.set(id,(selectionRevisions.get(id)??0)+1);return finish("Committed",null);
        }
        const end=String(BigInt(domain.tickEndUs)+100000n),facts=factsFor(id,end);
        if(!facts.installation.confirmed||!facts.installation.supported||!facts.installation.serviceClear)throw Error("NativeMachineUnavailable");
        let production:ProductionCommand;
        if(command.kind==="start"){
          if(machine.job&&machine.job.phase!=="COMPLETED"||waitingStarts.has(id))throw Error("ActiveJobLocked");
          const selected=selectedRecipe(id),recipe=recipesFor(id).find(r=>r.sourceId===selected?.sourceId);if(!recipe)throw Error("RecipeUnavailable");
          const definition=installed().find(i=>i.instanceId===id)!,device=catalog.devices.find(d=>d.sourceId===definition.definitionSourceId)!,process=recipe.processes.find(p=>p.availability==="first-dry-loop"&&device.capabilities.includes(p.capability))!;
          if(command.sourceLots.length!==recipe.inputs.length)throw Error("RecipeSourceLotsMismatch");
          const sourceLots=recipe.inputs.map(term=>{const item=catalog.items.find(i=>i.sourceId===term.itemId)!,lot=command.sourceLots.find(l=>{const c=materialAuthority.read().containers.find(c=>c.state.containerId===l.containerId);return c?.state.contents.some(s=>s.stackId===l.stackId&&s.resourceId===item.resourceId);}),container=materialAuthority.read().containers.find(c=>c.state.containerId===lot?.containerId);
            if(!lot||!container||lot.containerRevision!==container.state.revision||lot.quantityUnits!==term.quantityUnits)throw Error("RecipeSourceLotsMismatch");return {itemId:term.itemId,containerId:lot.containerId,stackId:lot.stackId};});
          production={kind:"start",commandId:command.commandId,jobId:`job_${command.commandId}`,batchOrdinal:machine.commandReceipts.filter(r=>r.kind==="start").length,ownerId:"fp02_wreck_owner",actorId:"hvp_player",recipeRef:selected!,processKind:process.kind,sourceLots};
          const admission=admitFactoryRecipe(materialAuthority.read(),facts,production);if(!admission.ok&&!['WAIT_INPUT','WAIT_OUTPUT','WAIT_WASTE'].includes(admission.reason))throw Error(admission.reason);
        }else{
          if(!machine.job||machine.job.phase==="COMPLETED"||machine.job.start.jobId!==command.jobId)throw Error("ActiveManualJobMismatch");
          production={kind:command.kind,commandId:command.commandId,jobId:command.jobId,actorId:"hvp_player"};
        }
        let settle!:(result:import("./hostPort").FactoryUiResult)=>void;
        const result=new Promise<import("./hostPort").FactoryUiResult>(resolve=>{settle=resolve;});
        pendingDomain={uiCommand:command,instanceId:id,command:production,result,resolve:(status,reason)=>settle(finish(status,reason))};commandBusy=false;notifyUi();
        return await result;
      }
      return finish("Rejected","UnsupportedCommand");
    }catch(error){const reason=error instanceof Error?error.message:String(error);return finish(reason.includes("RecoveryHold")?"RecoveryHold":"Rejected",reason);}
    finally{commandBusy=false;notifyUi();}
  }});
  let unsubscribe: () => void;
  try { unsubscribe = host.subscribeConfirmed(observe); }
  catch (error) { mountedHosts.delete(host); throw error; }
  return Object.freeze({ ui,domainSession,...(construction?{construction}:{}),read: () => view,
    subscribe: (listener: (view: FactorySessionView) => void) => {
      if (disposed) throw new Error("Factory session disposed");
      listeners.add(listener); return () => { listeners.delete(listener); };
    }, isQuiescent: () => !disposed && view.state !== "RecoveryHold" && !construction?.busy&&!commandBusy&&!handling?.busy,
    // Safe teardown is allowed in terminal recovery; pending publication must finish first.
    canEndSession: () => !disposed && !commandBusy&&(!handling?.busy||handling.recovery)&&(!construction?.busy || construction.read().state==="RecoveryHold"),
    dispose: async () => {
      if (disposed) return;
      if(commandBusy||(handling?.busy&&!handling.recovery)||(construction?.busy&&construction.read().state!=="RecoveryHold"))throw new Error("Factory installation is still pending");
      const pending=pendingDomain;pendingDomain=undefined;pending?.resolve("Rejected","SessionDisposedBeforeAdoption");
      disposed = true;host.construction?.dispose();
      unsubscribe(); listeners.clear();uiListeners.clear();host.setPanelFocus?.(null); mountedHosts.delete(host);
      view = Object.freeze({ ...view, state: "Disposed" });
    } });
};
