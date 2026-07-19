const deepFreeze = (value) => {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    Object.values(value).forEach(deepFreeze);
  }
  return value;
};

const moduleDefinition = (
  id,
  name,
  role,
  fixtures,
  metrics = {},
  details = {},
) => ({
  id,
  name,
  role,
  fixtures,
  legalClass: details.legalClass ?? "Open",
  capabilities: details.capabilities ?? [],
  interfaces: details.interfaces ?? [],
  tags: details.tags ?? [],
  metrics: {
    mass: 0,
    bulk: 0,
    continuousPower: 0,
    pulseEnergy: 0,
    heat: 0,
    dissipation: 0,
    range: 0,
    cycle: 0,
    ammoCharge: 0,
    ...metrics,
  },
});

const FIXTURE_IDS = deepFreeze({
  scanner: "survey-scanner",
  mining: "mining-cutter",
  repair: "repair-tool",
  emp: "emp-breacher",
  sidearm: "ballistic-sidearm",
  laser: "laser-cutter",
});

const WORKBENCH_PANES = Object.freeze([
  { id: "library", label: "Library", headingSelector: "#library-heading" },
  { id: "assembly", label: "Assembly", headingSelector: "#assembly-heading" },
  { id: "inspection", label: "Inspection", headingSelector: "#inspection-heading" },
]);
const SINGLE_PANE_MEDIA_QUERY = "(max-width: 930px)";

const MODULES = deepFreeze([
  moduleDefinition("scanner-frame", "Survey Chassis S1", "Frame", [FIXTURE_IDS.scanner], { mass: 1.1, bulk: 1.3 }),
  moduleDefinition(
    "scanner-array",
    "Wideband Survey Array",
    "Optic/Scanner",
    [FIXTURE_IDS.scanner],
    { mass: 0.45, bulk: 0.4, continuousPower: 18, pulseEnergy: 22, heat: 8, range: 420, cycle: 2.4 },
    { capabilities: ["Material survey", "Range finding"] },
  ),
  moduleDefinition(
    "scanner-control-basic",
    "Isolated Scan Controller",
    "Control",
    [FIXTURE_IDS.scanner],
    { mass: 0.18, bulk: 0.12, continuousPower: 3 },
    { capabilities: ["Manual scan control"] },
  ),
  moduleDefinition(
    "scanner-control-suit",
    "Suit-linked Scan Controller",
    "Control",
    [FIXTURE_IDS.scanner],
    { mass: 0.22, bulk: 0.14, continuousPower: 4 },
    { capabilities: ["Suit telemetry"], interfaces: ["Suit Interface"] },
  ),
  moduleDefinition("scanner-power", "Survey Power Pack", "Power Pack", [FIXTURE_IDS.scanner], { mass: 0.52, bulk: 0.34, pulseEnergy: 90, ammoCharge: 40 }),
  moduleDefinition(
    "scanner-utility",
    "Sample Marker",
    "Utility",
    [FIXTURE_IDS.scanner],
    { mass: 0.12, bulk: 0.1 },
    { capabilities: ["Sample marking"] },
  ),

  moduleDefinition("mining-frame", "Cutter Load Frame", "Frame", [FIXTURE_IDS.mining], { mass: 1.45, bulk: 1.55 }),
  moduleDefinition(
    "mining-head",
    "Dense-rock Cutter Head",
    "Tool Head",
    [FIXTURE_IDS.mining],
    { mass: 0.9, bulk: 0.75, continuousPower: 68, pulseEnergy: 120, heat: 92, range: 1.5, cycle: 3.8 },
    { capabilities: ["Rock cutting", "Sample extraction"], legalClass: "Licensed" },
  ),
  moduleDefinition("mining-power", "Industrial Power Pack", "Power Pack", [FIXTURE_IDS.mining], { mass: 0.72, bulk: 0.52, pulseEnergy: 180, ammoCharge: 28 }, { legalClass: "Licensed" }),
  moduleDefinition("mining-sink-compact", "Compact Thermal Sink", "Thermal Sink", [FIXTURE_IDS.mining], { mass: 0.28, bulk: 0.25, dissipation: 50 }),
  moduleDefinition("mining-sink-heavy", "High-load Thermal Sink", "Thermal Sink", [FIXTURE_IDS.mining], { mass: 0.56, bulk: 0.48, dissipation: 110 }),
  moduleDefinition("mining-control", "Cutter Load Controller", "Control", [FIXTURE_IDS.mining], { mass: 0.2, bulk: 0.15, continuousPower: 3 }, { interfaces: ["Suit Interface"], legalClass: "Licensed" }),
  moduleDefinition("mining-grip", "Braced Work Grip", "Grip/Stock", [FIXTURE_IDS.mining], { mass: 0.38, bulk: 0.3 }),

  moduleDefinition("repair-frame", "Service Tool Frame", "Frame", [FIXTURE_IDS.repair], { mass: 0.95, bulk: 1.05 }),
  moduleDefinition(
    "repair-head",
    "Sealant Applicator",
    "Tool Head",
    [FIXTURE_IDS.repair],
    { mass: 0.4, bulk: 0.32, continuousPower: 14, heat: 12, range: 0.8, cycle: 1.2 },
    { capabilities: ["Hull patching", "Conduit repair"] },
  ),
  moduleDefinition("repair-power", "Service Power Pack", "Power Pack", [FIXTURE_IDS.repair], { mass: 0.44, bulk: 0.3, pulseEnergy: 70, ammoCharge: 30 }),
  moduleDefinition(
    "repair-consumable",
    "Sealant Feed Cartridge",
    "Feed System",
    [FIXTURE_IDS.repair],
    { mass: 0.34, bulk: 0.28, ammoCharge: 12 },
    { tags: ["Consumable"], capabilities: ["Sealant feed"] },
  ),
  moduleDefinition("repair-control", "Service Control Unit", "Control", [FIXTURE_IDS.repair], { mass: 0.16, bulk: 0.12, continuousPower: 2 }, { interfaces: ["Suit Interface"] }),
  moduleDefinition("repair-utility-lamp", "Inspection Lamp", "Utility", [FIXTURE_IDS.repair], { mass: 0.1, bulk: 0.08, continuousPower: 1 }, { capabilities: ["Inspection light"] }),
  moduleDefinition("repair-utility-probe", "Circuit Probe", "Utility", [FIXTURE_IDS.repair], { mass: 0.08, bulk: 0.06 }, { capabilities: ["Circuit testing"] }),

  moduleDefinition("emp-frame", "Shielded Breacher Frame", "Frame", [FIXTURE_IDS.emp], { mass: 1.35, bulk: 1.4 }, { legalClass: "Restricted" }),
  moduleDefinition(
    "emp-delivery",
    "Directed EMP Emitter",
    "Delivery Assembly",
    [FIXTURE_IDS.emp],
    { mass: 0.8, bulk: 0.66, continuousPower: 42, pulseEnergy: 240, heat: 64, range: 18, cycle: 6 },
    { capabilities: ["Electronic disruption"], legalClass: "Restricted" },
  ),
  moduleDefinition("emp-power", "Pulse Capacitor Pack", "Power Pack", [FIXTURE_IDS.emp], { mass: 0.7, bulk: 0.5, pulseEnergy: 260, ammoCharge: 6 }, { legalClass: "Restricted" }),
  moduleDefinition("emp-sink", "Pulse Thermal Sink", "Thermal Sink", [FIXTURE_IDS.emp], { mass: 0.42, bulk: 0.32, dissipation: 78 }, { legalClass: "Restricted" }),
  moduleDefinition("emp-control", "Coded Pulse Controller", "Control", [FIXTURE_IDS.emp], { mass: 0.24, bulk: 0.18, continuousPower: 4 }, { interfaces: ["Suit Interface"], legalClass: "Restricted" }),
  moduleDefinition("emp-transponder", "Restricted Tool Transponder", "Legal Transponder", [FIXTURE_IDS.emp], { mass: 0.14, bulk: 0.08, continuousPower: 1 }, { capabilities: ["License broadcast"], legalClass: "Restricted" }),
  moduleDefinition("emp-grip", "Insulated Shoulder Brace", "Grip/Stock", [FIXTURE_IDS.emp], { mass: 0.5, bulk: 0.42 }, { legalClass: "Restricted" }),

  moduleDefinition("sidearm-frame", "Ballistic Receiver Frame", "Frame", [FIXTURE_IDS.sidearm], { mass: 0.62, bulk: 0.45 }, { legalClass: "Licensed" }),
  moduleDefinition(
    "sidearm-delivery",
    "Kinetic Delivery Assembly",
    "Delivery Assembly",
    [FIXTURE_IDS.sidearm],
    { mass: 0.38, bulk: 0.26, pulseEnergy: 85, heat: 18, range: 45, cycle: 0.35 },
    { capabilities: ["Kinetic discharge"], legalClass: "Licensed" },
  ),
  moduleDefinition("sidearm-magazine", "12-round Magazine", "Magazine", [FIXTURE_IDS.sidearm], { mass: 0.24, bulk: 0.18, ammoCharge: 12 }, { legalClass: "Licensed" }),
  moduleDefinition("sidearm-optic", "Compact Reflex Optic", "Optic/Scanner", [FIXTURE_IDS.sidearm], { mass: 0.08, bulk: 0.05, continuousPower: 1 }, { capabilities: ["Aiming assist"], legalClass: "Licensed" }),
  moduleDefinition("sidearm-control", "Fire Control Link", "Control", [FIXTURE_IDS.sidearm], { mass: 0.09, bulk: 0.06, continuousPower: 1 }, { interfaces: ["Suit Interface"], legalClass: "Licensed" }),
  moduleDefinition("sidearm-safety", "Mechanical Safety Interlock", "Safety", [FIXTURE_IDS.sidearm], { mass: 0.06, bulk: 0.03 }, { capabilities: ["Discharge interlock"], legalClass: "Licensed" }),
  moduleDefinition("sidearm-grip", "Service Grip", "Grip/Stock", [FIXTURE_IDS.sidearm], { mass: 0.2, bulk: 0.16 }, { legalClass: "Licensed" }),

  moduleDefinition("laser-frame", "Laser Cutter Frame", "Frame", [FIXTURE_IDS.laser], { mass: 1.05, bulk: 1.15 }, { legalClass: "Licensed" }),
  moduleDefinition(
    "laser-head",
    "Precision Laser Head",
    "Tool Head",
    [FIXTURE_IDS.laser],
    { mass: 0.54, bulk: 0.4, continuousPower: 46, pulseEnergy: 105, heat: 48, range: 2.5, cycle: 1.8 },
    { capabilities: ["Precision cutting", "Surface scoring"], legalClass: "Licensed" },
  ),
  moduleDefinition("laser-power", "Regulated Power Pack", "Power Pack", [FIXTURE_IDS.laser], { mass: 0.58, bulk: 0.4, pulseEnergy: 130, ammoCharge: 24 }, { legalClass: "Licensed" }),
  moduleDefinition("laser-sink", "Finned Thermal Sink", "Thermal Sink", [FIXTURE_IDS.laser], { mass: 0.36, bulk: 0.3, dissipation: 65 }, { legalClass: "Licensed" }),
  moduleDefinition("laser-control", "Precision Beam Control", "Control", [FIXTURE_IDS.laser], { mass: 0.18, bulk: 0.13, continuousPower: 3 }, { interfaces: ["Suit Interface"], legalClass: "Licensed" }),
  moduleDefinition("laser-safety", "Beam Safety Shutter", "Safety", [FIXTURE_IDS.laser], { mass: 0.1, bulk: 0.06 }, { capabilities: ["Beam interlock"], legalClass: "Licensed" }),
  moduleDefinition("laser-grip", "Two-point Work Grip", "Grip/Stock", [FIXTURE_IDS.laser], { mass: 0.31, bulk: 0.24 }, { legalClass: "Licensed" }),
  moduleDefinition("laser-utility", "Cut Line Projector", "Utility", [FIXTURE_IDS.laser], { mass: 0.09, bulk: 0.07, continuousPower: 1 }, { capabilities: ["Cut line projection"], legalClass: "Licensed" }),
]);

const slot = (id, label, role, acceptedRoles = [role]) => ({ id, label, role, acceptedRoles });

const FIXTURES = deepFreeze([
  {
    id: FIXTURE_IDS.scanner,
    name: "Survey Scanner",
    category: "Survey device",
    description: "Portable wideband survey rig for suit-assisted field inspection.",
    baseLegalClass: "Open",
    slots: [
      slot("frame", "Load Frame", "Frame"),
      slot("sensor", "Sensor Bay", "Optic/Scanner"),
      slot("control", "Control Bus", "Control"),
      slot("power", "Power Bay", "Power Pack"),
      slot("utility", "Utility Rail", "Utility"),
    ],
    initial: { frame: "scanner-frame", sensor: "scanner-array", control: null, power: "scanner-power", utility: "scanner-utility" },
  },
  {
    id: FIXTURE_IDS.mining,
    name: "Mining Cutter",
    category: "Extraction tool",
    description: "High-load contact cutter configured above its compact sink budget.",
    baseLegalClass: "Licensed",
    slots: [
      slot("frame", "Load Frame", "Frame"),
      slot("head", "Cutter Head", "Tool Head"),
      slot("power", "Power Bay", "Power Pack"),
      slot("thermal", "Thermal Bay", "Thermal Sink"),
      slot("control", "Control Bus", "Control"),
      slot("grip", "Work Grip", "Grip/Stock"),
    ],
    initial: { frame: "mining-frame", head: "mining-head", power: "mining-power", thermal: "mining-sink-compact", control: "mining-control", grip: "mining-grip" },
  },
  {
    id: FIXTURE_IDS.repair,
    name: "Repair Tool",
    category: "Service tool",
    description: "Field repair applicator with an intentionally empty consumable feed.",
    baseLegalClass: "Open",
    slots: [
      slot("frame", "Service Frame", "Frame"),
      slot("head", "Applicator", "Tool Head"),
      slot("power", "Power Bay", "Power Pack"),
      slot("feed", "Consumable Feed", "Feed System"),
      slot("control", "Control Bus", "Control"),
      slot("utility-a", "Utility Rail A", "Utility"),
      slot("utility-b", "Utility Rail B", "Utility"),
    ],
    initial: { frame: "repair-frame", head: "repair-head", power: "repair-power", feed: null, control: "repair-control", "utility-a": "repair-utility-lamp", "utility-b": null },
  },
  {
    id: FIXTURE_IDS.emp,
    name: "EMP Breacher",
    category: "Restricted breaching tool",
    description: "Restricted pulse equipment missing its mock license transponder.",
    baseLegalClass: "Restricted",
    slots: [
      slot("frame", "Shielded Frame", "Frame"),
      slot("delivery", "Emitter Assembly", "Delivery Assembly"),
      slot("power", "Pulse Power Bay", "Power Pack"),
      slot("thermal", "Thermal Bay", "Thermal Sink"),
      slot("control", "Control Bus", "Control"),
      slot("transponder", "License Port", "Legal Transponder"),
      slot("grip", "Brace", "Grip/Stock"),
    ],
    initial: { frame: "emp-frame", delivery: "emp-delivery", power: "emp-power", thermal: "emp-sink", control: "emp-control", transponder: null, grip: "emp-grip" },
  },
  {
    id: FIXTURE_IDS.sidearm,
    name: "Ballistic Sidearm",
    category: "Licensed defensive equipment",
    description: "Incomplete sidearm fixture with safety and magazine removed.",
    baseLegalClass: "Licensed",
    slots: [
      slot("frame", "Receiver Frame", "Frame"),
      slot("delivery", "Delivery Assembly", "Delivery Assembly"),
      slot("magazine", "Magazine Well", "Magazine"),
      slot("optic", "Optic Rail", "Optic/Scanner"),
      slot("control", "Control Link", "Control"),
      slot("safety", "Safety Interlock", "Safety"),
      slot("grip", "Grip", "Grip/Stock"),
    ],
    initial: { frame: "sidearm-frame", delivery: "sidearm-delivery", magazine: null, optic: "sidearm-optic", control: "sidearm-control", safety: null, grip: "sidearm-grip" },
  },
  {
    id: FIXTURE_IDS.laser,
    name: "Laser Cutter",
    category: "Precision cutting tool",
    description: "Complete regulated cutter fixture used as the Ready reference build.",
    baseLegalClass: "Licensed",
    slots: [
      slot("frame", "Load Frame", "Frame"),
      slot("head", "Laser Head", "Tool Head"),
      slot("power", "Power Bay", "Power Pack"),
      slot("thermal", "Thermal Bay", "Thermal Sink"),
      slot("control", "Control Bus", "Control"),
      slot("safety", "Beam Interlock", "Safety"),
      slot("grip", "Work Grip", "Grip/Stock"),
      slot("utility", "Utility Rail", "Utility"),
    ],
    initial: { frame: "laser-frame", head: "laser-head", power: "laser-power", thermal: "laser-sink", control: "laser-control", safety: "laser-safety", grip: "laser-grip", utility: "laser-utility" },
  },
]);

const clone = (value) => JSON.parse(JSON.stringify(value));

// Future seam: replace this local reader with Equipment Core snapshot/view-model input.
// The prototype intentionally defines no core DTO, endpoint, event, or gameplay contract.
const prototypeSnapshotInput = Object.freeze({
  readCatalogSnapshot: () => ({ fixtures: FIXTURES, modules: MODULES }),
  readInitialDrafts: () => Object.fromEntries(FIXTURES.map((fixture) => [fixture.id, clone(fixture.initial)])),
});
let snapshotInput = prototypeSnapshotInput;
let renderedCatalogView = null;

const createCatalogView = (snapshot) => ({
  fixtures: snapshot.fixtures,
  modules: snapshot.modules,
  fixtureById: new Map(snapshot.fixtures.map((fixture) => [fixture.id, fixture])),
  moduleById: new Map(snapshot.modules.map((module) => [module.id, module])),
});

const validateCatalogSnapshot = (snapshot) => {
  if (!snapshot || !Array.isArray(snapshot.fixtures) || !Array.isArray(snapshot.modules)) {
    throw new TypeError("Catalog snapshot must provide fixtures and modules arrays.");
  }
  if (snapshot.fixtures.length === 0) {
    throw new TypeError("Catalog snapshot must provide at least one fixture.");
  }

  const fixtureIds = new Set();
  snapshot.fixtures.forEach((fixture) => {
    if (
      !fixture
      || typeof fixture.id !== "string"
      || !fixture.id
      || typeof fixture.name !== "string"
      || typeof fixture.category !== "string"
      || typeof fixture.description !== "string"
      || !Object.prototype.hasOwnProperty.call(legalRank, fixture.baseLegalClass)
      || !Array.isArray(fixture.slots)
    ) {
      throw new TypeError("Every catalog fixture must provide renderable identity, presentation, legality, and slots.");
    }
    if (fixtureIds.has(fixture.id)) throw new TypeError(`Duplicate fixture id: ${fixture.id}.`);
    fixtureIds.add(fixture.id);

    const slotIds = new Set();
    fixture.slots.forEach((entry) => {
      if (
        !entry
        || typeof entry.id !== "string"
        || !entry.id
        || typeof entry.label !== "string"
        || typeof entry.role !== "string"
        || !Array.isArray(entry.acceptedRoles)
        || entry.acceptedRoles.some((role) => typeof role !== "string")
      ) {
        throw new TypeError(`Fixture ${fixture.id} contains an invalid slot.`);
      }
      if (slotIds.has(entry.id)) throw new TypeError(`Duplicate slot id ${entry.id} in fixture ${fixture.id}.`);
      slotIds.add(entry.id);
    });
  });

  const moduleIds = new Set();
  const metricKeys = [
    "mass",
    "bulk",
    "continuousPower",
    "pulseEnergy",
    "heat",
    "dissipation",
    "range",
    "cycle",
    "ammoCharge",
  ];
  snapshot.modules.forEach((module) => {
    if (
      !module
      || typeof module.id !== "string"
      || !module.id
      || typeof module.name !== "string"
      || typeof module.role !== "string"
      || !Array.isArray(module.fixtures)
      || module.fixtures.some((fixtureId) => !fixtureIds.has(fixtureId))
      || !Object.prototype.hasOwnProperty.call(legalRank, module.legalClass)
      || !Array.isArray(module.capabilities)
      || !Array.isArray(module.interfaces)
      || !Array.isArray(module.tags)
      || !module.metrics
      || metricKeys.some((key) => !Number.isFinite(module.metrics[key]))
    ) {
      throw new TypeError("Every catalog module must provide renderable identity, applicability, legality, details, and metrics.");
    }
    if (moduleIds.has(module.id)) throw new TypeError(`Duplicate module id: ${module.id}.`);
    moduleIds.add(module.id);
  });

  return createCatalogView(snapshot);
};

const validateInitialDrafts = (drafts, catalog) => {
  if (!drafts || typeof drafts !== "object" || Array.isArray(drafts)) {
    throw new TypeError("Initial drafts must provide a fixture-keyed object.");
  }

  catalog.fixtures.forEach((fixture) => {
    const draft = drafts[fixture.id];
    if (!draft || typeof draft !== "object" || Array.isArray(draft)) {
      throw new TypeError(`Initial drafts must provide a draft for fixture ${fixture.id}.`);
    }
    fixture.slots.forEach((entry) => {
      if (!Object.prototype.hasOwnProperty.call(draft, entry.id)) {
        throw new TypeError(`Draft ${fixture.id} is missing slot ${entry.id}.`);
      }
      const moduleId = draft[entry.id];
      if (moduleId === null) return;
      const module = catalog.moduleById.get(moduleId);
      if (!module || !moduleFitsSlot(module, fixture, entry)) {
        throw new TypeError(`Draft ${fixture.id} has an invalid module in slot ${entry.id}.`);
      }
    });
  });

  return clone(drafts);
};

const getCatalogView = () => renderedCatalogView;

const state = {
  activePane: "assembly",
  selectedFixtureId: FIXTURE_IDS.scanner,
  selectedModuleId: null,
  selectedSlotId: null,
  moveSourceSlotId: null,
  builds: prototypeSnapshotInput.readInitialDrafts(),
  past: [],
  future: [],
  compareOpen: false,
  compareFixtureId: FIXTURE_IDS.laser,
  filters: { search: "", role: "all", compatibility: "all", legal: "all" },
  announcement: "Select a module or assembly slot to begin.",
  drag: null,
  compareInitiatorSelector: null,
  replaceInitiatorSelector: null,
  moveInitiatorSelector: null,
  renderedDiagnosticSignature: null,
};

const legalRank = { Open: 0, Licensed: 1, Restricted: 2 };
const metricDefinitions = [
  ["mass", "Mass", "kg", 2],
  ["bulk", "Bulk", "bu", 2],
  ["continuousPower", "Continuous Power", "W", 0],
  ["pulseEnergy", "Pulse Energy", "J", 0],
  ["heat", "Heat", "HU", 0],
  ["dissipation", "Dissipation", "HU", 0],
  ["range", "Range", "m", 1],
  ["cycle", "Cycle", "s", 2],
  ["ammoCharge", "Ammo / Charge", "units", 0],
];

const formatMetric = (value, unit, digits) => `${Number(value).toFixed(digits)} ${unit}`;
const moduleFitsSlot = (module, fixture, targetSlot) =>
  Boolean(module && targetSlot && module.fixtures.includes(fixture.id) && targetSlot.acceptedRoles.includes(module.role));

const installedModulesFor = (fixture, build, catalog) =>
  fixture.slots.map((entry) => catalog.moduleById.get(build[entry.id])).filter(Boolean);

const diagnostic = (id, severity, targetSlotId, message, suggestedFix) => ({
  id,
  severity,
  targetSlotId,
  message,
  suggestedFix,
});

const deriveBuildViewModel = (fixtureId, catalog, builds = state.builds) => {
  const fixture = catalog.fixtureById.get(fixtureId);
  const build = builds[fixtureId];
  const installedModules = installedModulesFor(fixture, build, catalog);
  const metrics = Object.fromEntries(metricDefinitions.map(([key]) => [key, 0]));

  installedModules.forEach((module) => {
    Object.entries(module.metrics).forEach(([key, value]) => {
      if (key === "range") metrics[key] = Math.max(metrics[key], value);
      else if (key === "cycle") metrics[key] = metrics[key] === 0 ? value : Math.min(metrics[key], value);
      else metrics[key] += value;
    });
  });

  const capabilities = [...new Set(installedModules.flatMap((module) => module.capabilities))].sort();
  const interfaces = [...new Set(installedModules.flatMap((module) => module.interfaces))].sort();
  const legalClass = installedModules.reduce(
    (highest, module) => legalRank[module.legalClass] > legalRank[highest] ? module.legalClass : highest,
    fixture.baseLegalClass,
  );
  const diagnostics = [];

  if (fixture.id === FIXTURE_IDS.scanner && !interfaces.includes("Suit Interface")) {
    diagnostics.push(diagnostic(
      "scanner-suit-interface",
      "blocked",
      "control",
      "Survey Scanner has no Suit Interface on its control bus.",
      "Install the Suit-linked Scan Controller in the Control slot.",
    ));
  }

  if (fixture.id === FIXTURE_IDS.mining && metrics.heat > metrics.dissipation) {
    diagnostics.push(diagnostic(
      "mining-thermal-budget",
      "limited",
      "thermal",
      `Cutter heat ${metrics.heat} HU exceeds the displayed ${metrics.dissipation} HU dissipation budget.`,
      "Replace the compact sink with the High-load Thermal Sink.",
    ));
  }

  if (fixture.id === FIXTURE_IDS.repair && !installedModules.some((module) => module.tags.includes("Consumable"))) {
    diagnostics.push(diagnostic(
      "repair-missing-consumable",
      "blocked",
      "feed",
      "Repair Tool is missing its Consumable in the feed slot.",
      "Install the Sealant Feed Cartridge in Consumable Feed.",
    ));
  }

  if (fixture.id === FIXTURE_IDS.emp && !build.transponder) {
    diagnostics.push(diagnostic(
      "emp-restricted-transponder",
      "limited",
      "transponder",
      "EMP Breacher is Restricted and has no mock legal transponder.",
      "Install the Restricted Tool Transponder before licensed field use.",
    ));
  }

  if (fixture.id === FIXTURE_IDS.sidearm && !build.safety) {
    diagnostics.push(diagnostic(
      "sidearm-missing-safety",
      "blocked",
      "safety",
      "Ballistic Sidearm is missing its Safety interlock.",
      "Install the Mechanical Safety Interlock in the Safety slot.",
    ));
  }

  if (fixture.id === FIXTURE_IDS.sidearm && !build.magazine) {
    diagnostics.push(diagnostic(
      "sidearm-missing-magazine",
      "blocked",
      "magazine",
      "Ballistic Sidearm is missing its Magazine.",
      "Install the 12-round Magazine in the Magazine Well.",
    ));
  }

  const readiness = diagnostics.some((item) => item.severity === "blocked")
    ? "Blocked"
    : diagnostics.length > 0
      ? "Limited"
      : "Ready";

  return {
    fixture,
    build,
    installedModules,
    slots: fixture.slots.map((entry) => ({ ...entry, module: catalog.moduleById.get(build[entry.id]) ?? null })),
    metrics,
    capabilities,
    interfaces,
    legalClass,
    diagnostics,
    readiness,
  };
};

const normalizeCompareFixtureId = (catalog) => {
  const candidates = catalog.fixtures.filter((fixture) => fixture.id !== state.selectedFixtureId);
  if (!candidates.some((fixture) => fixture.id === state.compareFixtureId)) {
    state.compareFixtureId = candidates[0]?.id ?? null;
  }
};

const deriveAppViewModel = (catalog) => {
  normalizeCompareFixtureId(catalog);
  return {
    current: deriveBuildViewModel(state.selectedFixtureId, catalog),
    comparison: state.compareOpen && state.compareFixtureId
      ? deriveBuildViewModel(state.compareFixtureId, catalog)
      : null,
    selectedModule: catalog.moduleById.get(state.selectedModuleId) ?? null,
    history: { canUndo: state.past.length > 0, canRedo: state.future.length > 0 },
  };
};

const announce = (message) => {
  state.announcement = message;
};

const slotFocusSelector = (fixtureId, slotId) =>
  `#slot-${CSS.escape(fixtureId)}-${CSS.escape(slotId)} .slot-select`;

const moduleFocusSelector = (moduleId) =>
  `[data-select-module="${CSS.escape(moduleId)}"]`;

const fixtureFocusSelector = (fixtureId) =>
  `[data-fixture-id="${CSS.escape(fixtureId)}"]`;

const selectionFocusSelectors = () => [
  state.selectedSlotId ? slotFocusSelector(state.selectedFixtureId, state.selectedSlotId) : null,
  state.selectedModuleId ? moduleFocusSelector(state.selectedModuleId) : null,
];

const scheduleFocus = (...selectors) => {
  requestAnimationFrame(() => {
    const target = selectors
      .filter(Boolean)
      .map((selector) => document.querySelector(selector))
      .find(Boolean);
    target?.focus();
  });
};

const renderPaneControls = () => {
  document.querySelector(".workbench-grid").dataset.activePane = state.activePane;
  document.querySelectorAll("[data-pane-control]").forEach((control) => {
    const isActive = control.dataset.paneControl === state.activePane;
    control.setAttribute("aria-selected", String(isActive));
    control.tabIndex = isActive ? 0 : -1;
  });
};

const activatePane = (paneId, focusSelector = null) => {
  const pane = WORKBENCH_PANES.find((entry) => entry.id === paneId);
  if (!pane) return;
  state.activePane = pane.id;
  announce(`${pane.label} pane opened.`);
  render();
  scheduleFocus(focusSelector ?? pane.headingSelector);
};

const activateAssemblyForCrossPaneTarget = () => {
  if (window.matchMedia(SINGLE_PANE_MEDIA_QUERY).matches) state.activePane = "assembly";
};

const selectedReplaceTarget = () => {
  const catalog = getCatalogView();
  const fixture = catalog.fixtureById.get(state.selectedFixtureId);
  const targetSlot = fixture?.slots.find((entry) => entry.id === state.selectedSlotId);
  const installedModuleId = targetSlot ? state.builds[state.selectedFixtureId][targetSlot.id] : null;
  const candidate = catalog.moduleById.get(state.selectedModuleId);
  return installedModuleId
    && candidate
    && installedModuleId !== candidate.id
    && moduleFitsSlot(candidate, fixture, targetSlot)
    ? targetSlot
    : null;
};

const commitMutation = (label, mutate) => {
  const before = clone(state.builds);
  const next = clone(state.builds);
  mutate(next);
  state.past.push({ label, builds: before });
  state.future = [];
  state.builds = next;
  state.moveSourceSlotId = null;
  state.moveInitiatorSelector = null;
  state.replaceInitiatorSelector = null;
  announce(`${label}. Stored in local prototype history.`);
  return true;
};

const getCommandContext = (fixtureId, slotId, moduleId) => {
  const catalog = getCatalogView();
  const fixture = catalog.fixtureById.get(fixtureId);
  const targetSlot = fixture?.slots.find((entry) => entry.id === slotId);
  const module = catalog.moduleById.get(moduleId);
  return { fixture, targetSlot, module };
};

const installCommand = ({ fixtureId, slotId, moduleId }) => {
  const { fixture, targetSlot, module } = getCommandContext(fixtureId, slotId, moduleId);
  if (!fixture || !targetSlot || !module || !moduleFitsSlot(module, fixture, targetSlot)) {
    announce("Install rejected: module and target slot are not compatible in this mock catalog.");
    return false;
  }
  if (state.builds[fixtureId][slotId]) {
    announce("Install rejected: target is occupied. Use Replace.");
    return false;
  }
  return commitMutation(`Installed ${module.name} in ${targetSlot.label}`, (next) => {
    next[fixtureId][slotId] = moduleId;
  });
};

const removeCommand = ({ fixtureId, slotId }) => {
  const catalog = getCatalogView();
  const fixture = catalog.fixtureById.get(fixtureId);
  const targetSlot = fixture?.slots.find((entry) => entry.id === slotId);
  const moduleId = targetSlot ? state.builds[fixtureId][slotId] : null;
  const module = catalog.moduleById.get(moduleId);
  if (!fixture || !targetSlot || !module) {
    announce("Remove rejected: the selected slot is already empty.");
    return false;
  }
  state.selectedModuleId = module.id;
  return commitMutation(`Removed ${module.name} from ${targetSlot.label}`, (next) => {
    next[fixtureId][slotId] = null;
  });
};

const replaceCommand = ({ fixtureId, slotId, moduleId }) => {
  const { fixture, targetSlot, module } = getCommandContext(fixtureId, slotId, moduleId);
  const currentModuleId = fixture && targetSlot ? state.builds[fixtureId][slotId] : null;
  if (!fixture || !targetSlot || !module || !moduleFitsSlot(module, fixture, targetSlot)) {
    announce("Replace rejected: module and target slot are not compatible in this mock catalog.");
    return false;
  }
  if (!currentModuleId) {
    announce("Replace rejected: target is empty. Use Install.");
    return false;
  }
  if (currentModuleId === moduleId) {
    announce("Replace rejected: that module is already installed.");
    return false;
  }
  const currentModule = getCatalogView().moduleById.get(currentModuleId);
  return commitMutation(`Replaced ${currentModule.name} with ${module.name}`, (next) => {
    next[fixtureId][slotId] = moduleId;
  });
};

const moveCommand = ({ fixtureId, fromSlotId, toSlotId }) => {
  const catalog = getCatalogView();
  const fixture = catalog.fixtureById.get(fixtureId);
  const fromSlot = fixture?.slots.find((entry) => entry.id === fromSlotId);
  const toSlot = fixture?.slots.find((entry) => entry.id === toSlotId);
  const moduleId = fromSlot ? state.builds[fixtureId][fromSlotId] : null;
  const module = catalog.moduleById.get(moduleId);
  if (!fixture || !fromSlot || !toSlot || !module || fromSlotId === toSlotId) {
    announce("Move rejected: choose a different occupied source and compatible target.");
    return false;
  }
  if (state.builds[fixtureId][toSlotId] || !moduleFitsSlot(module, fixture, toSlot)) {
    announce("Move rejected: target must be an empty compatible slot.");
    return false;
  }
  return commitMutation(`Moved ${module.name} to ${toSlot.label}`, (next) => {
    next[fixtureId][fromSlotId] = null;
    next[fixtureId][toSlotId] = moduleId;
  });
};

const undoCommand = () => {
  const previous = state.past.pop();
  if (!previous) {
    announce("Undo unavailable: local prototype history is empty.");
    return false;
  }
  state.future.push({ label: previous.label, builds: clone(state.builds) });
  state.builds = clone(previous.builds);
  state.moveSourceSlotId = null;
  state.moveInitiatorSelector = null;
  state.replaceInitiatorSelector = null;
  announce(`Undid: ${previous.label}.`);
  return true;
};

const redoCommand = () => {
  const next = state.future.pop();
  if (!next) {
    announce("Redo unavailable: no local branch is available.");
    return false;
  }
  state.past.push({ label: next.label, builds: clone(state.builds) });
  state.builds = clone(next.builds);
  state.moveSourceSlotId = null;
  state.moveInitiatorSelector = null;
  state.replaceInitiatorSelector = null;
  announce(`Redid: ${next.label}.`);
  return true;
};

// Future seam: UI intents enter through this adapter. It can later forward commands
// without changing rendering or claiming the unpublished Equipment Core contract.
const commandIntentAdapter = Object.freeze({
  install: installCommand,
  remove: removeCommand,
  replace: replaceCommand,
  move: moveCommand,
  undo: undoCommand,
  redo: redoCommand,
});

const escapeHtml = (value) => String(value)
  .replaceAll("&", "&amp;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;")
  .replaceAll("'", "&#039;");

const dragDropStateForSlot = (slotId) => {
  if (!state.drag) return { kind: "inactive", allowed: false, cue: "" };
  const catalog = getCatalogView();
  const fixture = catalog.fixtureById.get(state.selectedFixtureId);
  const targetSlot = fixture?.slots.find((entry) => entry.id === slotId);
  const targetModuleId = targetSlot ? state.builds[state.selectedFixtureId][slotId] : null;
  const draggedModule = catalog.moduleById.get(state.drag.moduleId);

  if (!fixture || !targetSlot || !draggedModule) {
    return { kind: "invalid", allowed: false, cue: "Drop unavailable: target data is missing." };
  }
  if (state.drag.type === "installed") {
    if (state.drag.fromSlotId === slotId) {
      return { kind: "invalid", allowed: false, cue: "Drop unavailable: choose a different slot." };
    }
    if (targetModuleId) {
      return { kind: "invalid", allowed: false, cue: "Drop unavailable: installed modules move only to empty slots." };
    }
    if (!moduleFitsSlot(draggedModule, fixture, targetSlot)) {
      return { kind: "invalid", allowed: false, cue: "Drop unavailable: this slot is incompatible." };
    }
    return { kind: "move", allowed: true, cue: `Drop to move ${draggedModule.name} here.` };
  }
  if (!moduleFitsSlot(draggedModule, fixture, targetSlot)) {
    return { kind: "invalid", allowed: false, cue: "Drop unavailable: this slot is incompatible." };
  }
  if (targetModuleId === draggedModule.id) {
    return { kind: "invalid", allowed: false, cue: "Drop unavailable: that module is already installed here." };
  }
  return targetModuleId
    ? { kind: "replace", allowed: true, cue: `Drop to replace the installed module with ${draggedModule.name}.` }
    : { kind: "install", allowed: true, cue: `Drop to install ${draggedModule.name} here.` };
};

const applyDragCues = () => {
  document.querySelectorAll(".assembly-slot").forEach((slotElement) => {
    const slotId = slotElement.dataset.slotId;
    const dropState = dragDropStateForSlot(slotId);
    const selectButton = slotElement.querySelector(".slot-select");
    slotElement.dataset.dropState = dropState.kind;
    slotElement.classList.toggle("is-move-target", dropState.allowed);
    selectButton?.setAttribute("aria-dropeffect", dropState.allowed
      ? state.drag?.type === "installed" ? "move" : "copy"
      : "none");
    if (selectButton) {
      selectButton.dataset.dropCue = dropState.cue;
      selectButton.setAttribute(
        "aria-label",
        dropState.cue ? `${selectButton.dataset.baseAriaLabel}. ${dropState.cue}` : selectButton.dataset.baseAriaLabel,
      );
    }
  });
  document.querySelectorAll("[aria-grabbed]").forEach((element) => {
    const isDraggedModule = state.drag?.type === "available" && element.dataset.dragModule === state.drag.moduleId;
    const isDraggedSlot = state.drag?.type === "installed" && element.dataset.dragInstalledSlot === state.drag.fromSlotId;
    element.setAttribute("aria-grabbed", String(Boolean(isDraggedModule || isDraggedSlot)));
  });
};

const clearDragState = () => {
  const initiatingSelector = state.drag?.initiatingSelector ?? null;
  state.drag = null;
  applyDragCues();
  return initiatingSelector;
};

const compatibleTargetFor = (module, viewModel) => {
  if (!module) return null;
  const selectedSlot = viewModel.current.slots.find((entry) => entry.id === state.selectedSlotId);
  if (selectedSlot && moduleFitsSlot(module, viewModel.current.fixture, selectedSlot)) return selectedSlot;
  return viewModel.current.slots.find((entry) => !entry.module && moduleFitsSlot(module, viewModel.current.fixture, entry)) ?? null;
};

const renderFixtures = (catalog) => {
  document.querySelector("#fixture-selectors").innerHTML = catalog.fixtures.map((fixture) => `
    <button
      type="button"
      class="fixture-button"
      data-fixture-id="${fixture.id}"
      data-testid="fixture-selector-${fixture.id}"
      aria-current="${fixture.id === state.selectedFixtureId}"
    >
      ${escapeHtml(fixture.name)}
      <span class="fixture-category">${escapeHtml(fixture.category)}</span>
    </button>
  `).join("");
};

const renderFilters = (catalog) => {
  const roleSelect = document.querySelector("#category-filter");
  const roles = [...new Set(catalog.modules.map((module) => module.role))].sort();
  roleSelect.replaceChildren(new Option("Any role", "all"), ...roles.map((role) => new Option(role, role)));
  document.querySelector("#module-search").value = state.filters.search;
  roleSelect.value = state.filters.role;
  document.querySelector("#compatibility-filter").value = state.filters.compatibility;
  document.querySelector("#legal-filter").value = state.filters.legal;
};

const renderPalette = (viewModel, catalog) => {
  const fixture = viewModel.current.fixture;
  const query = state.filters.search.trim().toLowerCase();
  const modules = catalog.modules.filter((module) => {
    const searchable = [module.name, module.role, ...module.capabilities, ...module.interfaces, ...module.tags].join(" ").toLowerCase();
    const compatible = module.fixtures.includes(fixture.id);
    return (!query || searchable.includes(query))
      && (state.filters.role === "all" || module.role === state.filters.role)
      && (state.filters.compatibility === "all" || compatible)
      && (state.filters.legal === "all" || module.legalClass === state.filters.legal);
  });

  document.querySelector("#palette-count").textContent = `${modules.length} modules`;
  document.querySelector("#module-palette").innerHTML = modules.length === 0
    ? '<li class="module-item">No modules match these filters.</li>'
    : modules.map((module) => {
      const target = compatibleTargetFor(module, viewModel);
      const action = target?.module ? "Replace" : "Install";
      const actionDisabled = !target || (target.module?.id === module.id);
      return `
        <li class="module-item ${module.id === state.selectedModuleId ? "is-selected" : ""}" data-role="${escapeHtml(module.role)}">
          <button
            type="button"
            class="module-select"
            data-select-module="${module.id}"
            data-drag-module="${module.id}"
            data-testid="module-select-${module.id}"
            aria-pressed="${module.id === state.selectedModuleId}"
            aria-grabbed="${state.drag?.type === "available" && state.drag.moduleId === module.id}"
            aria-describedby="drag-instructions"
            draggable="true"
          >
            <span class="module-name">${escapeHtml(module.name)}</span>
            <span class="module-meta">${escapeHtml(module.role)} · ${escapeHtml(module.legalClass)}</span>
          </button>
          <button
            type="button"
            class="module-action"
            data-module-action="${action.toLowerCase()}"
            data-module-id="${module.id}"
            data-slot-id="${target?.id ?? ""}"
            data-testid="module-action-${module.id}"
            ${actionDisabled ? "disabled" : ""}
          >${action}</button>
        </li>
      `;
    }).join("");
};

const renderAssembly = (viewModel, catalog) => {
  const { fixture, slots } = viewModel.current;
  document.querySelector("#fixture-description").textContent = fixture.description;
  document.querySelector("#build-reference").textContent = `LOCAL / ${fixture.id}`;
  document.querySelector("#assembly-heading").textContent = `${fixture.name} Assembly`;
  const selectedSlot = slots.find((entry) => entry.id === state.selectedSlotId);
  const moveModuleId = state.moveSourceSlotId ? viewModel.current.build[state.moveSourceSlotId] : null;
  const moveModule = catalog.moduleById.get(moveModuleId);
  document.querySelector("#selected-slot-state").textContent = state.moveSourceSlotId
    ? `Move ${moveModule?.name ?? "module"}: choose a compatible empty slot`
    : selectedSlot
      ? `Selected: ${selectedSlot.label}`
      : "No slot selected";

  document.querySelector("#assembly-slots").innerHTML = slots.map((entry, index) => {
    const selectedModule = viewModel.selectedModule;
    const canInstallSelected = !entry.module && moduleFitsSlot(selectedModule, fixture, entry);
    const canMoveHere = Boolean(moveModule && !entry.module && moduleFitsSlot(moveModule, fixture, entry));
    const isMoveSource = state.moveSourceSlotId === entry.id;
    const baseAriaLabel = `${entry.label}, ${entry.role}. ${entry.module ? `${entry.module.name} installed` : "Empty"}`;
    const dropState = dragDropStateForSlot(entry.id);
    return `
      <li
        class="assembly-slot ${state.selectedSlotId === entry.id ? "is-selected" : ""} ${canMoveHere || dropState.allowed ? "is-move-target" : ""}"
        id="slot-${fixture.id}-${entry.id}"
        data-slot-id="${entry.id}"
        data-drop-state="${dropState.kind}"
        data-testid="assembly-slot-${entry.id}"
      >
        <button
          type="button"
          class="slot-select"
          data-select-slot="${entry.id}"
          ${entry.module ? `data-drag-installed-slot="${entry.id}" draggable="true"` : "draggable=\"false\""}
          aria-pressed="${state.selectedSlotId === entry.id}"
          aria-grabbed="${Boolean(entry.module && state.drag?.type === "installed" && state.drag.fromSlotId === entry.id)}"
          aria-dropeffect="${dropState.allowed ? state.drag?.type === "installed" ? "move" : "copy" : "none"}"
          aria-describedby="drag-instructions"
          aria-label="${escapeHtml(dropState.cue ? `${baseAriaLabel}. ${dropState.cue}` : baseAriaLabel)}"
          data-base-aria-label="${escapeHtml(baseAriaLabel)}"
          data-drop-cue="${escapeHtml(dropState.cue)}"
        >
          <span class="slot-label">
            <span>${escapeHtml(entry.label)} · ${escapeHtml(entry.role)}</span>
            <span class="slot-index">S${String(index + 1).padStart(2, "0")}</span>
          </span>
          ${entry.module
            ? `<span class="slot-module-name">${escapeHtml(entry.module.name)}</span><span class="slot-meta">${escapeHtml(entry.module.role)} · ${entry.module.metrics.mass.toFixed(2)} kg</span>`
            : '<em class="slot-empty">EMPTY — compatible module required</em>'}
        </button>
        <div class="slot-actions">
          ${entry.module ? `<button type="button" data-remove-slot="${entry.id}" data-testid="remove-${entry.id}">Remove</button>` : ""}
          ${entry.module ? `<button type="button" data-start-move="${entry.id}" data-testid="move-${entry.id}" ${isMoveSource ? "disabled" : ""}>${isMoveSource ? "Moving…" : "Move"}</button>` : ""}
          ${canInstallSelected ? `<button type="button" data-install-selected="${entry.id}" data-testid="install-${entry.id}">Install selected</button>` : ""}
          ${canMoveHere ? `<button type="button" data-move-target="${entry.id}" data-testid="move-target-${entry.id}">Move here</button>` : ""}
        </div>
      </li>
    `;
  }).join("");
};

const renderInspection = (viewModel) => {
  const current = viewModel.current;
  document.querySelector("#inspection-build-name").textContent = current.fixture.name;
  const readiness = document.querySelector("#readiness-state");
  readiness.textContent = current.readiness;
  readiness.dataset.readiness = current.readiness;

  document.querySelector("#metric-list").innerHTML = metricDefinitions.map(([key, label, unit, digits]) => `
    <div class="metric-row" data-testid="metric-${key}">
      <dt>${label}</dt>
      <dd>${formatMetric(current.metrics[key], unit, digits)}</dd>
    </div>
  `).join("");

  document.querySelector("#capability-list").innerHTML = `
    <div class="detail-row"><dt>Capabilities</dt><dd>${escapeHtml(current.capabilities.join(", ") || "None")}</dd></div>
    <div class="detail-row"><dt>Suit Interfaces</dt><dd>${escapeHtml(current.interfaces.join(", ") || "None")}</dd></div>
    <div class="detail-row"><dt>Legal Class</dt><dd>${escapeHtml(current.legalClass)} (mock)</dd></div>
  `;

  const diagnosticList = document.querySelector("#diagnostic-list");
  const hasBlockingDiagnostic = current.diagnostics.some((item) => item.severity === "blocked");
  const diagnosticSignature = JSON.stringify(current.diagnostics.map((item) => [
    item.id,
    item.severity,
    item.targetSlotId,
    item.message,
    item.suggestedFix,
  ]));
  diagnosticList.setAttribute("aria-live", hasBlockingDiagnostic ? "assertive" : "off");
  if (hasBlockingDiagnostic) diagnosticList.setAttribute("role", "alert");
  else diagnosticList.removeAttribute("role");
  if (state.renderedDiagnosticSignature !== diagnosticSignature) {
    diagnosticList.innerHTML = current.diagnostics.length === 0
      ? '<li class="diagnostic-clear" data-testid="diagnostic-clear">Ready — no blocking or limiting mock diagnostic.</li>'
      : current.diagnostics.map((item) => `
        <li>
          <button
            type="button"
            class="diagnostic-button"
            data-diagnostic-slot="${item.targetSlotId ?? ""}"
            data-severity="${item.severity}"
            data-testid="diagnostic-${item.id}"
          >
            <span class="diagnostic-title">${item.severity === "blocked" ? "Blocked" : "Limited"}: ${escapeHtml(item.message)}</span>
            <span class="diagnostic-fix" data-testid="suggested-fix">Suggested Fix: ${escapeHtml(item.suggestedFix)}</span>
          </button>
        </li>
      `).join("");
    state.renderedDiagnosticSignature = diagnosticSignature;
  }
};

const comparisonValue = (viewModel, key) => {
  if (key === "capabilities") return viewModel.capabilities.join(", ") || "None";
  if (key === "interfaces") return viewModel.interfaces.join(", ") || "None";
  if (key === "legalClass") return viewModel.legalClass;
  if (key === "readiness") return viewModel.readiness;
  return viewModel.metrics[key];
};

const renderCompare = (viewModel, catalog) => {
  const controls = document.querySelector("#compare-controls");
  const panel = document.querySelector("#compare-panel");
  const button = document.querySelector('[data-command="toggle-compare"]');
  controls.hidden = !state.compareOpen;
  panel.hidden = !state.compareOpen;
  button.textContent = state.compareOpen ? "Exit compare" : "Compare";
  button.setAttribute("aria-expanded", String(state.compareOpen));

  const select = document.querySelector("#compare-fixture");
  select.innerHTML = catalog.fixtures.filter((fixture) => fixture.id !== state.selectedFixtureId)
    .map((fixture) => `<option value="${fixture.id}">${escapeHtml(fixture.name)}</option>`)
    .join("");
  select.value = state.compareFixtureId;

  if (!viewModel.comparison) return;
  const current = viewModel.current;
  const candidate = viewModel.comparison;
  const rows = [
    ...metricDefinitions.map(([key, label, unit, digits]) => ({
      label,
      current: formatMetric(current.metrics[key], unit, digits),
      candidate: formatMetric(candidate.metrics[key], unit, digits),
      changed: current.metrics[key] !== candidate.metrics[key],
    })),
    ...[
      ["capabilities", "Capabilities"],
      ["interfaces", "Suit Interfaces"],
      ["legalClass", "Legal Class"],
      ["readiness", "Readiness"],
    ].map(([key, label]) => ({
      label,
      current: comparisonValue(current, key),
      candidate: comparisonValue(candidate, key),
      changed: comparisonValue(current, key) !== comparisonValue(candidate, key),
    })),
  ];
  const currentModules = new Set(current.installedModules.map((module) => module.name));
  const candidateModules = new Set(candidate.installedModules.map((module) => module.name));
  const removed = [...currentModules].filter((name) => !candidateModules.has(name));
  const added = [...candidateModules].filter((name) => !currentModules.has(name));

  panel.innerHTML = `
    <table class="compare-table">
      <thead><tr><th>Field</th><th>${escapeHtml(current.fixture.name)}</th><th>${escapeHtml(candidate.fixture.name)}</th></tr></thead>
      <tbody>
        ${rows.map((row) => `<tr class="${row.changed ? "compare-delta" : ""}"><th>${row.label}</th><td>${escapeHtml(row.current)}</td><td>${escapeHtml(row.candidate)}</td></tr>`).join("")}
        <tr class="compare-delta"><th>Module differences</th><td>${escapeHtml(removed.join(", ") || "None removed")}</td><td>${escapeHtml(added.join(", ") || "None added")}</td></tr>
      </tbody>
    </table>
  `;
};

const renderHistory = (viewModel) => {
  document.querySelector('[data-command="undo"]').disabled = !viewModel.history.canUndo;
  document.querySelector('[data-command="redo"]').disabled = !viewModel.history.canRedo;
  document.querySelector("#history-state").textContent = `${state.past.length} undo · ${state.future.length} redo`;
  document.querySelector("#action-feedback").textContent = state.announcement;
  document.querySelector("#history-log").innerHTML = state.past.slice(-4).reverse()
    .map((entry) => `<li>${escapeHtml(entry.label)}</li>`)
    .join("");
};

const render = (catalogView = createCatalogView(snapshotInput.readCatalogSnapshot())) => {
  renderedCatalogView = catalogView;
  const viewModel = deriveAppViewModel(renderedCatalogView);
  renderPaneControls();
  renderFixtures(renderedCatalogView);
  renderFilters(renderedCatalogView);
  renderPalette(viewModel, renderedCatalogView);
  renderAssembly(viewModel, renderedCatalogView);
  renderInspection(viewModel);
  renderCompare(viewModel, renderedCatalogView);
  renderHistory(viewModel);
};

const runMutationAndRender = (command, focusSelectors = [], options = {}) => {
  const succeeded = command();
  if (succeeded && options.activateAssembly) activateAssemblyForCrossPaneTarget();
  render();
  if (succeeded) scheduleFocus(...focusSelectors);
  return succeeded;
};

const cancelTransientInteraction = () => {
  if (state.drag) {
    const initiatingSelector = clearDragState();
    announce("Drag cancelled.");
    render();
    scheduleFocus(initiatingSelector);
    return true;
  }
  if (selectedReplaceTarget()) {
    const initiatingSelector = state.replaceInitiatorSelector;
    state.selectedModuleId = null;
    state.replaceInitiatorSelector = null;
    announce("Replace selection cancelled.");
    render();
    scheduleFocus(initiatingSelector);
    return true;
  }
  if (state.moveSourceSlotId) {
    const initiatingSelector = state.moveInitiatorSelector;
    state.moveSourceSlotId = null;
    state.moveInitiatorSelector = null;
    announce("Move selection cancelled.");
    render();
    scheduleFocus(initiatingSelector);
    return true;
  }
  if (state.compareOpen) {
    const initiatingSelector = state.compareInitiatorSelector ?? '[data-command="toggle-compare"]';
    state.compareOpen = false;
    state.compareInitiatorSelector = null;
    announce("Compare Two Builds closed.");
    render();
    scheduleFocus(initiatingSelector);
    return true;
  }
  return false;
};

document.addEventListener("click", (event) => {
  const target = event.target.closest("button");
  if (!target) return;
  const catalog = getCatalogView();

  if (target.dataset.paneControl) {
    activatePane(target.dataset.paneControl);
    return;
  }

  if (target.dataset.fixtureId) {
    state.selectedFixtureId = target.dataset.fixtureId;
    state.selectedSlotId = null;
    state.selectedModuleId = null;
    state.moveSourceSlotId = null;
    state.replaceInitiatorSelector = null;
    state.moveInitiatorSelector = null;
    announce(`Selected ${catalog.fixtureById.get(state.selectedFixtureId).name}.`);
    render();
    scheduleFocus(fixtureFocusSelector(state.selectedFixtureId));
    return;
  }

  if (target.dataset.selectModule) {
    state.selectedModuleId = target.dataset.selectModule;
    state.moveSourceSlotId = null;
    state.moveInitiatorSelector = null;
    state.replaceInitiatorSelector = selectedReplaceTarget()
      ? moduleFocusSelector(state.selectedModuleId)
      : null;
    announce(`Selected ${catalog.moduleById.get(state.selectedModuleId).name}. Choose a compatible slot or use its action.`);
    render();
    scheduleFocus(moduleFocusSelector(state.selectedModuleId));
    return;
  }

  if (target.dataset.selectSlot) {
    state.selectedSlotId = target.dataset.selectSlot;
    state.moveSourceSlotId = null;
    state.moveInitiatorSelector = null;
    state.replaceInitiatorSelector = selectedReplaceTarget()
      ? slotFocusSelector(state.selectedFixtureId, state.selectedSlotId)
      : null;
    const entry = catalog.fixtureById.get(state.selectedFixtureId).slots.find((item) => item.id === state.selectedSlotId);
    announce(`Selected ${entry.label}.`);
    render();
    scheduleFocus(slotFocusSelector(state.selectedFixtureId, state.selectedSlotId));
    return;
  }

  if (target.dataset.moduleAction) {
    const intent = { fixtureId: state.selectedFixtureId, slotId: target.dataset.slotId, moduleId: target.dataset.moduleId };
    state.selectedModuleId = intent.moduleId;
    state.selectedSlotId = intent.slotId;
    runMutationAndRender(() => target.dataset.moduleAction === "replace"
      ? commandIntentAdapter.replace(intent)
      : commandIntentAdapter.install(intent), [slotFocusSelector(intent.fixtureId, intent.slotId)], { activateAssembly: true });
    return;
  }

  if (target.dataset.installSelected) {
    const slotId = target.dataset.installSelected;
    runMutationAndRender(() => commandIntentAdapter.install({
      fixtureId: state.selectedFixtureId,
      slotId,
      moduleId: state.selectedModuleId,
    }), [slotFocusSelector(state.selectedFixtureId, slotId)]);
    return;
  }

  if (target.dataset.removeSlot) {
    const slotId = target.dataset.removeSlot;
    const moduleId = state.builds[state.selectedFixtureId][slotId];
    runMutationAndRender(
      () => commandIntentAdapter.remove({ fixtureId: state.selectedFixtureId, slotId }),
      [moduleFocusSelector(moduleId), slotFocusSelector(state.selectedFixtureId, slotId)],
    );
    return;
  }

  if (target.dataset.startMove) {
    state.moveSourceSlotId = target.dataset.startMove;
    state.selectedSlotId = state.moveSourceSlotId;
    state.moveInitiatorSelector = `[data-start-move="${CSS.escape(state.moveSourceSlotId)}"]`;
    const moduleId = state.builds[state.selectedFixtureId][state.moveSourceSlotId];
    announce(`Move ${catalog.moduleById.get(moduleId).name}: choose an outlined compatible empty slot.`);
    render();
    return;
  }

  if (target.dataset.moveTarget) {
    const targetSlotId = target.dataset.moveTarget;
    runMutationAndRender(() => commandIntentAdapter.move({
      fixtureId: state.selectedFixtureId,
      fromSlotId: state.moveSourceSlotId,
      toSlotId: targetSlotId,
    }), [slotFocusSelector(state.selectedFixtureId, targetSlotId)]);
    return;
  }

  if (target.dataset.diagnosticSlot) {
    state.selectedSlotId = target.dataset.diagnosticSlot;
    state.moveSourceSlotId = null;
    state.moveInitiatorSelector = null;
    const slot = catalog.fixtureById.get(state.selectedFixtureId).slots.find((entry) => entry.id === state.selectedSlotId);
    announce(`Focused ${slot.label} for the selected diagnostic.`);
    activateAssemblyForCrossPaneTarget();
    render();
    scheduleFocus(slotFocusSelector(state.selectedFixtureId, state.selectedSlotId));
    return;
  }

  if (target.dataset.command === "undo") {
    runMutationAndRender(commandIntentAdapter.undo, selectionFocusSelectors());
    return;
  }

  if (target.dataset.command === "redo") {
    runMutationAndRender(commandIntentAdapter.redo, selectionFocusSelectors());
    return;
  }

  if (target.dataset.command === "cancel-selection") {
    state.selectedSlotId = null;
    state.selectedModuleId = null;
    state.moveSourceSlotId = null;
    state.replaceInitiatorSelector = null;
    state.moveInitiatorSelector = null;
    announce("Selection cleared.");
    render();
    return;
  }

  if (target.dataset.command === "toggle-compare") {
    state.compareOpen = !state.compareOpen;
    state.compareInitiatorSelector = state.compareOpen ? '[data-command="toggle-compare"]' : null;
    announce(state.compareOpen ? "Compare Two Builds opened." : "Compare Two Builds closed.");
    render();
    if (!state.compareOpen) scheduleFocus('[data-command="toggle-compare"]');
  }
});

document.addEventListener("dragstart", (event) => {
  const source = event.target.closest?.("[data-drag-module], [data-drag-installed-slot]");
  if (!source) return;
  const catalog = getCatalogView();

  if (source.dataset.dragModule) {
    const module = catalog.moduleById.get(source.dataset.dragModule);
    state.drag = {
      type: "available",
      moduleId: module.id,
      fromSlotId: null,
      initiatingSelector: moduleFocusSelector(module.id),
      overSlotId: null,
    };
    event.dataTransfer.effectAllowed = "copy";
    event.dataTransfer.setData("text/plain", `available:${module.id}`);
    announce(`Dragging ${module.name}. Compatible empty slots install; compatible occupied slots replace.`);
  } else {
    const fromSlotId = source.dataset.dragInstalledSlot;
    const moduleId = state.builds[state.selectedFixtureId][fromSlotId];
    const module = catalog.moduleById.get(moduleId);
    if (!module) {
      event.preventDefault();
      announce("Drag rejected: the source slot is empty.");
      render();
      return;
    }
    state.drag = {
      type: "installed",
      moduleId,
      fromSlotId,
      initiatingSelector: slotFocusSelector(state.selectedFixtureId, fromSlotId),
      overSlotId: null,
    };
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", `installed:${fromSlotId}:${moduleId}`);
    announce(`Dragging installed ${module.name}. Drop on a compatible empty slot to move it.`);
  }

  document.querySelector("#action-feedback").textContent = state.announcement;
  applyDragCues();
});

document.addEventListener("dragover", (event) => {
  const slotElement = event.target.closest?.(".assembly-slot");
  if (!state.drag || !slotElement) return;
  event.preventDefault();
  const dropState = dragDropStateForSlot(slotElement.dataset.slotId);
  state.drag.overSlotId = slotElement.dataset.slotId;
  document.querySelectorAll(".assembly-slot[data-drop-active]").forEach((element) => {
    element.removeAttribute("data-drop-active");
  });
  slotElement.dataset.dropActive = "true";
  event.dataTransfer.dropEffect = dropState.allowed
    ? state.drag.type === "installed" ? "move" : "copy"
    : "none";
  document.querySelector("#selected-slot-state").textContent = dropState.cue;
});

document.addEventListener("dragleave", (event) => {
  const slotElement = event.target.closest?.(".assembly-slot");
  if (!state.drag || !slotElement || slotElement.contains(event.relatedTarget)) return;
  slotElement.removeAttribute("data-drop-active");
  if (state.drag.overSlotId === slotElement.dataset.slotId) state.drag.overSlotId = null;
  document.querySelector("#selected-slot-state").textContent = "Drag over an assembly slot to inspect the drop action.";
});

document.addEventListener("drop", (event) => {
  const slotElement = event.target.closest?.(".assembly-slot");
  if (!state.drag || !slotElement) return;
  event.preventDefault();

  const drag = state.drag;
  const fixtureId = state.selectedFixtureId;
  const targetSlotId = slotElement.dataset.slotId;
  const targetOccupied = Boolean(state.builds[fixtureId][targetSlotId]);
  state.drag = null;
  state.selectedSlotId = targetSlotId;

  if (drag.type === "available") {
    state.selectedModuleId = drag.moduleId;
    runMutationAndRender(
      () => targetOccupied
        ? commandIntentAdapter.replace({ fixtureId, slotId: targetSlotId, moduleId: drag.moduleId })
        : commandIntentAdapter.install({ fixtureId, slotId: targetSlotId, moduleId: drag.moduleId }),
      [slotFocusSelector(fixtureId, targetSlotId)],
    );
    return;
  }

  runMutationAndRender(
    () => commandIntentAdapter.move({
      fixtureId,
      fromSlotId: drag.fromSlotId,
      toSlotId: targetSlotId,
    }),
    [slotFocusSelector(fixtureId, targetSlotId)],
  );
});

document.addEventListener("dragend", () => {
  if (!state.drag) return;
  const initiatingSelector = clearDragState();
  announce("Drag cancelled without changing local prototype history.");
  render();
  scheduleFocus(initiatingSelector);
});

const isEditableShortcutTarget = (target) => Boolean(target?.closest?.(
  'input, select, textarea, [contenteditable=""], [contenteditable="true"], [contenteditable="plaintext-only"]',
));

const handlePaneTabKey = (event) => {
  const control = event.target.closest?.('[role="tab"][data-pane-control]');
  if (!control || !["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return false;

  const currentIndex = WORKBENCH_PANES.findIndex((pane) => pane.id === control.dataset.paneControl);
  if (currentIndex < 0) return false;
  const nextIndex = event.key === "Home"
    ? 0
    : event.key === "End"
      ? WORKBENCH_PANES.length - 1
      : (currentIndex + (event.key === "ArrowRight" ? 1 : -1) + WORKBENCH_PANES.length) % WORKBENCH_PANES.length;
  const nextPane = WORKBENCH_PANES[nextIndex];
  event.preventDefault();
  activatePane(nextPane.id, `[data-pane-control="${CSS.escape(nextPane.id)}"]`);
  return true;
};

document.addEventListener("keydown", (event) => {
  if (handlePaneTabKey(event)) return;
  const key = event.key.toLowerCase();
  if (key === "escape" && cancelTransientInteraction()) {
    event.preventDefault();
    return;
  }
  if (isEditableShortcutTarget(event.target)) return;

  if (event.ctrlKey && !event.altKey && key === "z") {
    event.preventDefault();
    runMutationAndRender(
      event.shiftKey ? commandIntentAdapter.redo : commandIntentAdapter.undo,
      selectionFocusSelectors(),
    );
    return;
  }
  if (event.ctrlKey && !event.altKey && key === "y") {
    event.preventDefault();
    runMutationAndRender(commandIntentAdapter.redo, selectionFocusSelectors());
    return;
  }
  if (key === "delete" && !event.ctrlKey && !event.altKey && !event.shiftKey) {
    const slotId = state.selectedSlotId;
    const moduleId = slotId ? state.builds[state.selectedFixtureId][slotId] : null;
    if (!moduleId) return;
    event.preventDefault();
    runMutationAndRender(
      () => commandIntentAdapter.remove({ fixtureId: state.selectedFixtureId, slotId }),
      [moduleFocusSelector(moduleId), slotFocusSelector(state.selectedFixtureId, slotId)],
    );
    return;
  }
});

document.querySelector("#library-filters").addEventListener("input", (event) => {
  const source = event.target;
  if (source.id === "module-search") state.filters.search = source.value;
  if (source.id === "category-filter") state.filters.role = source.value;
  if (source.id === "compatibility-filter") state.filters.compatibility = source.value;
  if (source.id === "legal-filter") state.filters.legal = source.value;
  render();
});

document.querySelector("#compare-fixture").addEventListener("change", (event) => {
  state.compareFixtureId = event.target.value;
  announce(`Comparing with ${getCatalogView().fixtureById.get(state.compareFixtureId).name}.`);
  render();
});

const replaceSnapshotInput = (nextSnapshotInput) => {
  if (
    !nextSnapshotInput
    || typeof nextSnapshotInput.readCatalogSnapshot !== "function"
    || typeof nextSnapshotInput.readInitialDrafts !== "function"
  ) {
    throw new TypeError("Snapshot input must provide readCatalogSnapshot() and readInitialDrafts().");
  }

  const nextCatalogSnapshot = nextSnapshotInput.readCatalogSnapshot();
  const nextInitialDrafts = nextSnapshotInput.readInitialDrafts();
  const nextCatalogView = validateCatalogSnapshot(nextCatalogSnapshot);
  const nextBuilds = validateInitialDrafts(nextInitialDrafts, nextCatalogView);
  const selectedFixtureId = nextCatalogView.fixtureById.has(state.selectedFixtureId)
    ? state.selectedFixtureId
    : nextCatalogView.fixtures[0].id;
  const selectedFixture = nextCatalogView.fixtureById.get(selectedFixtureId);
  const selectedSlotId = selectedFixture.slots.some((entry) => entry.id === state.selectedSlotId)
    ? state.selectedSlotId
    : null;
  const selectedModuleId = nextCatalogView.moduleById.has(state.selectedModuleId)
    && nextCatalogView.moduleById.get(state.selectedModuleId).fixtures.includes(selectedFixtureId)
      ? state.selectedModuleId
      : null;
  const compareCandidates = nextCatalogView.fixtures.filter((fixture) => fixture.id !== selectedFixtureId);
  const compareFixtureId = compareCandidates.some((fixture) => fixture.id === state.compareFixtureId)
    ? state.compareFixtureId
    : compareCandidates[0]?.id ?? null;

  // Commit only after both replacement reads and their cross-references validate.
  snapshotInput = nextSnapshotInput;
  state.builds = nextBuilds;
  state.selectedFixtureId = selectedFixtureId;
  state.selectedSlotId = selectedSlotId;
  state.selectedModuleId = selectedModuleId;
  state.compareFixtureId = compareFixtureId;
  state.compareOpen = false;
  state.past = [];
  state.future = [];
  state.drag = null;
  state.moveSourceSlotId = null;
  state.compareInitiatorSelector = null;
  state.replaceInitiatorSelector = null;
  state.moveInitiatorSelector = null;
  state.renderedDiagnosticSignature = null;
  announce("Snapshot input replaced. Replacement drafts loaded into local prototype state.");
  render(nextCatalogView);
};

// Read-only development seam for future adapters and focused browser acceptance.
window.surfaceEquipmentWorkbenchPrototype = Object.freeze({
  readViewModel: () => clone(deriveAppViewModel(getCatalogView())),
  get snapshotInput() { return snapshotInput; },
  replaceSnapshotInput,
  commandIntents: commandIntentAdapter,
});

render();
