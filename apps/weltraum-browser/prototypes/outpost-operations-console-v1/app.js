const AUTHORITY_NOTICE = "OUTPOST OPERATIONS PROTOTYPE · MOCK SERVICE DATA · NO GAMEPLAY AUTHORITY";

const sections = Object.freeze([
  { id: "pads", title: "Approach and Pad Control", description: "Coordinate approach clearance, landing restrictions, pad occupancy, and local service connections." },
  { id: "cargo", title: "Cargo and Storage", description: "Review mock container capacity, ownership, hazard handling, and local transfer intent." },
  { id: "refuel", title: "Refuel and Consumables", description: "Prepare a local service estimate and simulate delivery without modifying ship resources." },
  { id: "repair", title: "Repair Bay", description: "Inspect mock faults, service blockers, material estimates, and queue position." },
  { id: "market", title: "Market Exchange", description: "Review a small local exchange fixture. Prices and demand are static mock service data." },
  { id: "missions", title: "Mission Board", description: "Evaluate local mock offers and record prototype-only accept or decline intent." },
  { id: "drones", title: "Drone Control", description: "Operate three local drone fixtures without scheduler, navigation, or drone authority." },
  { id: "legal", title: "Legal and Access", description: "Inspect mock permits, fees, restrictions, and their visible service availability effects." }
]);

const scenarioDefinitions = Object.freeze({
  nominal: {
    label: "Nominal service overview",
    section: "pads",
    link: "Local / Stable",
    dock: "Pad A / Connected",
    access: "Permit Valid",
    warning: "Nominal local fixture. Service commands remain prototype-only.",
    level: "notice"
  },
  "pad-conflict": {
    label: "Pad conflict",
    section: "pads",
    link: "Local / Stable",
    dock: "Pad A / Conflict",
    access: "Hold Position",
    warning: "Pad B reservation conflicts with an inbound tug. Release and approach lanes require operator review.",
    level: "warning"
  },
  "refuel-unavailable": {
    label: "Refuel unavailable",
    section: "refuel",
    link: "Local / Stable",
    dock: "Pad A / Connected",
    access: "Fuel Manifold Restricted",
    warning: "Main propellant manifold isolated for pressure inspection. Start service is blocked.",
    level: "blocked"
  },
  "illegal-cargo": {
    label: "Illegal cargo blocks transfer",
    section: "cargo",
    link: "Local / Stable",
    dock: "Pad A / Inspection",
    access: "Transfer Suspended",
    warning: "Restricted biological sample is not covered by the mock docking permit. Transfer is blocked.",
    level: "blocked"
  },
  "repair-queue": {
    label: "Repair queue",
    section: "repair",
    link: "Local / Stable",
    dock: "Pad A / Connected",
    access: "Service Limited",
    warning: "Repair Bay 1 is occupied. Earliest mock service window begins in 01:42:00.",
    level: "warning"
  },
  "mission-accepted": {
    label: "Mission accepted",
    section: "missions",
    link: "Local / Stable",
    dock: "Pad A / Connected",
    access: "Permit Valid",
    warning: "Geological Survey is locally marked Accepted. No mission has been created in the product runtime.",
    level: "notice"
  },
  "drone-link-lost": {
    label: "Drone link lost",
    section: "drones",
    link: "Relay / Degraded",
    dock: "Pad A / Connected",
    access: "Drone Hold",
    warning: "Scout Drone link lost beyond relay mast 03. Commands are local prototype intents only.",
    level: "blocked"
  },
  lockdown: {
    label: "Outpost lockdown",
    section: "legal",
    link: "Local / Restricted",
    dock: "Pad A / Impound Hold",
    access: "Lockdown",
    warning: "Mock security lockdown blocks departure, cargo, refuel, repair, market, and drone launch services.",
    level: "blocked"
  },
  responsive: {
    label: "Responsive layout",
    section: "pads",
    link: "Local / Stable",
    dock: "Pad A / Connected",
    access: "Permit Valid",
    warning: "Responsive review fixture: section tabs, primary action, and status access remain available at 1280 × 720.",
    level: "notice"
  }
});

const pads = Object.freeze([
  { id: "A", state: "Occupied", tone: "ok", ship: "CSV Kestrel / player vessel", class: "Workship 32 m", seal: "Connected" },
  { id: "B", state: "Reserved", tone: "warn", ship: "Inbound tug H-17", class: "Utility tug 18 m", seal: "Standby" },
  { id: "C", state: "Maintenance", tone: "blocked", ship: "No vessel assigned", class: "Pad surface inspection", seal: "Isolated" }
]);

const cargoItems = Object.freeze([
  { id: "coupler", name: "Docking Coupler Set", container: "Outpost Storage", mass: "42 kg", volume: "0.18 m³", owner: "Post 07", hazard: "None", legality: "Permitted", action: "Transfer" },
  { id: "coolant", name: "Thermal Coolant Canister", container: "Ship Cargo", mass: "28 kg", volume: "0.09 m³", owner: "CSV Kestrel", hazard: "Pressurized", legality: "Permitted", action: "Hold to transfer" },
  { id: "survey-core", name: "Sealed Survey Core", container: "Suit Cargo", mass: "6 kg", volume: "0.02 m³", owner: "Aurelia Survey Union", hazard: "Foreign custody", legality: "Permit required", action: "Hold to transfer" }
]);

const fuelServices = Object.freeze([
  { id: "main", name: "Main propellant", available: "18,400 kg", requested: "1,260 kg", capacity: "4,800 kg", fill: 74, estimate: "2,646 cr / 08:40" },
  { id: "rcs", name: "RCS propellant", available: "940 kg", requested: "84 kg", capacity: "320 kg", fill: 62, estimate: "294 cr / 02:10" },
  { id: "oxygen", name: "Suit oxygen", available: "640 L", requested: "38 L", capacity: "90 L", fill: 58, estimate: "18 cr / 00:35" },
  { id: "power", name: "Suit power cell", available: "12 units", requested: "1 unit", capacity: "1 unit", fill: 31, estimate: "74 cr / swap" },
  { id: "coolant", name: "Coolant", available: "480 L", requested: "52 L", capacity: "140 L", fill: 63, estimate: "156 cr / 01:20" }
]);

const repairItems = Object.freeze([
  { name: "Hull inspection", condition: "Inspection due", materials: "Sealant 2 kg", duration: "00:24:00", blocker: "None" },
  { name: "External sensor", condition: "Alignment drift", materials: "Bracket / 1", duration: "00:38:00", blocker: "Calibration rig" },
  { name: "Landing gear", condition: "Nominal", materials: "None", duration: "00:12:00", blocker: "None" },
  { name: "Thermal system", condition: "Coolant leak trace", materials: "Line 3 m", duration: "01:05:00", blocker: "Bay pressure cycle" },
  { name: "Drone repair", condition: "Rotor housing scored", materials: "Housing / 1", duration: "00:46:00", blocker: "Drone must be docked" }
]);

const marketItems = Object.freeze([
  { name: "Industrial sealant", side: "Buy", available: "84 kg", demand: "Stable", legality: "Open", destination: "Ship Cargo", price: "34 cr/kg" },
  { name: "Survey core sleeves", side: "Buy", available: "18", demand: "Low", legality: "Open", destination: "Outpost Storage", price: "92 cr" },
  { name: "Recovered tungsten", side: "Sell", available: "—", demand: "High", legality: "Inspection", destination: "Outpost Intake", price: "61 cr/kg" },
  { name: "Restricted biogel", side: "Sell", available: "—", demand: "None", legality: "Blocked", destination: "No destination", price: "—" }
]);

const missions = Object.freeze([
  { id: "geological", name: "Geological Survey", issuer: "Aurelia Survey Union", objective: "Scan three marked basalt shelves.", site: "Kestrel Ridge / 14 km", risk: "Low", duration: "35–50 min", reward: "Survey credit + service voucher", legality: "Licensed" },
  { id: "relay", name: "Relay Repair", issuer: "Frontier Relay Office", objective: "Replace mast 03 signal coupler.", site: "Relay Mast 03 / 8 km", risk: "Moderate", duration: "40 min", reward: "Repair fee + access priority", legality: "Licensed" },
  { id: "courier", name: "Cargo Courier", issuer: "Post 07 Logistics", objective: "Deliver sealed thermal spares.", site: "Habitat Annex / 22 km", risk: "Low", duration: "55 min", reward: "Courier fee", legality: "Manifest required" },
  { id: "hazard", name: "Hazard Sample", issuer: "Aurelia Materials Lab", objective: "Recover a shielded vent sample.", site: "Sulfur Vent 4B / 31 km", risk: "High", duration: "80–110 min", reward: "Hazard fee + lab standing", legality: "Restricted permit" },
  { id: "salvage", name: "Salvage Recovery", issuer: "Frontier Mutual", objective: "Locate and tag a lost cargo skid.", site: "East Debris Fan / 19 km", risk: "Moderate", duration: "60 min", reward: "Recovery fee + salvage descriptor", legality: "Claim token required" }
]);

const droneFixtures = Object.freeze([
  { id: "scout", name: "Scout Drone", role: "Survey / relay inspection", state: "Docked", assignment: "Unassigned", battery: "96%", link: "Dock link" },
  { id: "mining", name: "Mining Drone", role: "Sample extraction", state: "Active", assignment: "Basalt shelf B", battery: "68%", link: "Relay 02 / stable" },
  { id: "cargo", name: "Cargo Drone", role: "Local freight", state: "Returning", assignment: "Habitat Annex", battery: "43%", link: "Relay 01 / stable" }
]);

const state = {
  section: "pads",
  scenario: "nominal",
  serviceState: "idle",
  missionState: new Map(),
  droneState: new Map(droneFixtures.map((drone) => [drone.id, drone.state])),
  contextOpen: false,
  dialogInvoker: null,
  lastCommand: "No local command issued"
};

const sectionContent = document.querySelector("#section-content");
const contextContent = document.querySelector("#context-content");
const contextColumn = document.querySelector("#context-column");
const contextToggle = document.querySelector("#context-toggle");
const scenarioSelect = document.querySelector("#scenario-select");
const dialog = document.querySelector("#telemetry-dialog");
const dialogContent = document.querySelector("#dialog-content");
const liveRegion = document.querySelector("#live-region");
const alertRegion = document.querySelector("#alert-region");

const escapeHtml = (value) => String(value)
  .replaceAll("&", "&amp;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;")
  .replaceAll("'", "&#039;");

const statusClass = (tone) => `status-label status-${tone}`;

const announce = (message, assertive = false) => {
  const target = assertive ? alertRegion : liveRegion;
  target.textContent = "";
  window.requestAnimationFrame(() => {
    target.textContent = message;
  });
};

const recordCommand = (message, assertive = false) => {
  state.lastCommand = message;
  announce(message, assertive);
  renderContext();
};

const headerTemplate = (section) => `
  <header class="workspace-header">
    <div>
      <h1>${section.title}</h1>
      <p>${section.description}</p>
    </div>
    <span class="mock-stamp">Local mock service view</span>
  </header>
`;

const renderPads = () => {
  const isConflict = state.scenario === "pad-conflict";
  const isLockdown = state.scenario === "lockdown";
  const renderedPads = pads.map((pad) => {
    const conflictPad = isConflict && pad.id === "B";
    const padState = conflictPad ? "Reservation Conflict" : pad.state;
    const tone = conflictPad ? "blocked" : pad.tone;
    const ship = conflictPad ? "Inbound tug H-17 + medevac request" : pad.ship;
    return `
      <article class="pad-bay" data-pad="${pad.id}">
        <header>
          <strong>Pad ${pad.id}</strong>
          <span class="${statusClass(tone)}">${padState}</span>
        </header>
        <div class="bay-body">
          <p class="ship-name">${ship}</p>
          <dl class="data-list">
            <div><dt>Fixture</dt><dd>${pad.class}</dd></div>
            <div><dt>Service seal</dt><dd>${pad.seal}</dd></div>
            <div><dt>Lane</dt><dd>${pad.id === "A" ? "A-07 / clear" : pad.id === "B" ? "B-04 / controlled" : "C / isolated"}</dd></div>
          </dl>
        </div>
      </article>
    `;
  }).join("");

  return `
    <div class="operation-stack">
      ${isConflict ? `<div class="warning-strip" data-testid="pad-conflict-warning"><strong>Conflict:</strong> Pad B has two incompatible local reservations. Keep approach lane B-04 closed.</div>` : ""}
      ${isLockdown ? `<div class="blocked-reason"><strong>Mock impound hold:</strong> Outpost lockdown prevents pad release.</div>` : ""}
      <section class="operation-panel" aria-labelledby="pad-status-heading">
        <header><h2 id="pad-status-heading">Pad allocation</h2><span>Mock cycle AFSP07-042</span></header>
        <div class="panel-body pad-grid">${renderedPads}</div>
      </section>
      <section class="operation-panel" aria-labelledby="approach-heading">
        <header><h2 id="approach-heading">Approach and connection checklist</h2><span>Pad A / CSV Kestrel</span></header>
        <div class="panel-body">
          <dl class="data-list">
            <div><dt>Approach clearance</dt><dd>${isConflict ? "HOLD / traffic conflict" : "CLEARED / lane A-07"}</dd></div>
            <div><dt>Service connection</dt><dd>Power + data / connected</dd></div>
            <div><dt>Cargo port alignment</dt><dd>Aligned / tolerance 4 mm</dd></div>
            <div><dt>Landing restrictions</dt><dd>Mass ≤ 220 t · no hot RCS inside 35 m</dd></div>
            <div><dt>Impound / legal warning</dt><dd>${isLockdown ? "ACTIVE MOCK HOLD" : "None / mock legal fixture"}</dd></div>
          </dl>
          <div class="action-row">
            <button type="button" class="primary-action" data-action="request-clearance" ${isConflict || isLockdown ? "disabled" : ""}>Confirm approach clearance</button>
            <button type="button" data-action="release-pad" ${isLockdown ? "disabled" : ""}>Release Pad A</button>
            <button type="button" data-action="open-pad-detail">Open connection detail</button>
          </div>
        </div>
      </section>
    </div>
  `;
};

const renderCargo = () => {
  const illegal = state.scenario === "illegal-cargo" || state.scenario === "lockdown";
  const rows = cargoItems.map((item) => {
    const hold = item.hazard !== "None";
    return `
      <tr>
        <td><strong>${item.name}</strong><br><span class="data-label">${item.container}</span></td>
        <td class="value-mono">${item.mass}<br>${item.volume}</td>
        <td>${item.owner}</td>
        <td>${item.hazard}</td>
        <td>${item.legality}</td>
        <td>${hold
          ? `<button type="button" class="table-action hold-action" data-action="hold-transfer" data-item="${item.id}" data-requires-hold="true">${item.action}</button>`
          : `<button type="button" class="table-action" data-action="transfer" data-item="${item.id}">${item.action}</button>`}
        </td>
      </tr>
    `;
  }).join("");

  const blockedRow = illegal ? `
    <tr data-testid="illegal-cargo-row">
      <td><strong>Restricted Xeno-Biological Sample</strong><br><span class="data-label">Ship Cargo / sealed locker</span></td>
      <td class="value-mono">11 kg<br>0.04 m³</td>
      <td>Unknown claimant</td>
      <td>Biohazard / restricted</td>
      <td>Illegal under mock permit</td>
      <td><button type="button" class="table-action danger-action" disabled>Transfer blocked</button></td>
    </tr>` : "";

  return `
    <div class="operation-stack">
      ${illegal ? `<div class="blocked-reason" data-testid="cargo-blocked-reason"><strong>Blocked:</strong> Mock permit AF-07-DK does not authorize restricted biological material. Inspection hold must be resolved first.</div>` : `<div class="notice-strip">Transfer commands update this page only. No product Resource/Cargo container is read or written.</div>`}
      <section class="operation-panel" aria-labelledby="container-heading">
        <header><h2 id="container-heading">Container allocation</h2><span>Mass / volume are mock fixture values</span></header>
        <div class="panel-body service-grid">
          <div class="service-line"><div><h3>Outpost Storage</h3><p>Owner: Aurelia Frontier Service Post 07</p></div><div><strong class="value-mono">2,840 / 8,000 kg</strong><div class="meter"><span style="width:35.5%"></span></div><p>18.4 / 48.0 m³</p></div></div>
          <div class="service-line"><div><h3>Ship Cargo</h3><p>Owner: CSV Kestrel / local fixture</p></div><div><strong class="value-mono">1,186 / 2,400 kg</strong><div class="meter"><span style="width:49.4%"></span></div><p>7.8 / 16.0 m³</p></div></div>
          <div class="service-line"><div><h3>Suit Cargo</h3><p>Owner: current operator / local fixture</p></div><div><strong class="value-mono">14 / 36 kg</strong><div class="meter"><span style="width:38.9%"></span></div><p>0.06 / 0.12 m³</p></div></div>
        </div>
      </section>
      <section class="operation-panel" aria-labelledby="transfer-heading">
        <header><h2 id="transfer-heading">Transfer manifest</h2><span>Hold confirmation required for hazard / foreign custody</span></header>
        <div class="panel-body">
          <div class="control-row" aria-label="Transfer controls">
            <label for="transfer-direction"><span class="field-label">Direction</span><select id="transfer-direction"><option>Ship Cargo → Outpost Storage</option><option>Outpost Storage → Ship Cargo</option><option>Suit Cargo → Ship Cargo</option></select></label>
            <label for="transfer-quantity"><span class="field-label">Quantity</span><input id="transfer-quantity" type="number" min="1" max="99" value="1" inputmode="numeric"></label>
          </div>
          <div class="data-table-wrap">
            <table class="data-table">
              <thead><tr><th>Item / source</th><th>Mass / volume</th><th>Ownership</th><th>Hazard</th><th>Legality (mock)</th><th>Local command</th></tr></thead>
              <tbody>${rows}${blockedRow}</tbody>
            </table>
          </div>
        </div>
      </section>
    </div>
  `;
};

const renderRefuel = () => {
  const unavailable = state.scenario === "refuel-unavailable" || state.scenario === "lockdown";
  const serviceRows = fuelServices.map((service) => {
    const blocked = unavailable && service.id === "main";
    return `
      <article class="service-line" data-service="${service.id}">
        <div>
          <h3>${service.name}</h3>
          <p>${blocked ? "Restricted / manifold unavailable" : `Available ${service.available} · requested ${service.requested}`}</p>
          <div class="meter" aria-label="${service.name} mock current capacity ${service.fill} percent"><span style="width:${service.fill}%"></span></div>
        </div>
        <dl class="data-list">
          <div><dt>Capacity</dt><dd>${service.capacity}</dd></div>
          <div><dt>Mock estimate</dt><dd>${blocked ? "Unavailable" : service.estimate}</dd></div>
        </dl>
      </article>
    `;
  }).join("");

  const isRunning = state.serviceState === "running";
  const isComplete = state.serviceState === "complete";
  return `
    <div class="operation-stack">
      ${unavailable ? `<div class="blocked-reason" data-testid="refuel-unavailable-reason"><strong>Unavailable:</strong> Main propellant manifold is isolated in this mock scenario.</div>` : `<div class="notice-strip">Estimate AFSP07-FUEL-018 is static fixture data, not an economy or ship-resource quote.</div>`}
      <section class="operation-panel" aria-labelledby="service-lines-heading">
        <header><h2 id="service-lines-heading">Service lines</h2><span>${state.serviceState.toUpperCase()} / local simulation</span></header>
        <div class="panel-body service-grid">${serviceRows}</div>
      </section>
      <section class="operation-panel" aria-labelledby="fuel-order-heading">
        <header><h2 id="fuel-order-heading">Local service order</h2><span>Mock estimate total 3,188 cr · 12:45</span></header>
        <div class="panel-body">
          <dl class="data-list">
            <div><dt>Connection</dt><dd>Pad A service umbilical / sealed</dd></div>
            <div><dt>Requested</dt><dd>Main + RCS + suit O₂ + cell + coolant</dd></div>
            <div><dt>Simulation state</dt><dd data-testid="refuel-state">${isComplete ? "Complete (local only)" : isRunning ? "Running (local only)" : "Ready (local only)"}</dd></div>
          </dl>
          <div class="action-row">
            <button type="button" class="primary-action" data-action="start-refuel" ${unavailable || isRunning || isComplete ? "disabled" : ""}>Start local simulation</button>
            <button type="button" data-action="cancel-refuel" ${!isRunning ? "disabled" : ""}>Cancel</button>
            <button type="button" data-action="complete-refuel" ${!isRunning ? "disabled" : ""}>Complete simulation</button>
          </div>
        </div>
      </section>
    </div>
  `;
};

const renderRepair = () => {
  const queued = state.scenario === "repair-queue" || state.scenario === "lockdown";
  const rows = repairItems.map((item, index) => `
    <tr>
      <td><strong>${item.name}</strong></td>
      <td>${item.condition}</td>
      <td class="value-mono">${item.materials}</td>
      <td class="value-mono">${item.duration}</td>
      <td>${queued && index < 2 ? "Bay queue" : item.blocker}</td>
      <td><button type="button" class="table-action" data-action="queue-repair" data-item="${index}" ${queued || item.blocker !== "None" ? "disabled" : ""}>Queue local repair</button></td>
    </tr>`).join("");
  return `
    <div class="operation-stack">
      ${queued ? `<div class="warning-strip" data-testid="repair-queue-warning"><strong>Queue:</strong> Bay 1 occupied by CV Lagrange. Mock position 3 · estimate 01:42:00.</div>` : `<div class="notice-strip">Inspection and repair results are local fixture data. No ship damage or materials are changed.</div>`}
      <section class="operation-panel" aria-labelledby="repair-table-heading">
        <header><h2 id="repair-table-heading">Inspection worksheet</h2><span>Estimate AFSP07-RPR-092</span></header>
        <div class="panel-body">
          <div class="data-table-wrap">
            <table class="data-table">
              <thead><tr><th>System</th><th>Mock finding</th><th>Materials</th><th>Duration</th><th>Blocker</th><th>Local command</th></tr></thead>
              <tbody>${rows}</tbody>
            </table>
          </div>
        </div>
      </section>
      <section class="operation-panel" aria-labelledby="queue-heading">
        <header><h2 id="queue-heading">Service queue</h2><span>${queued ? "Position 3" : "Bay 2 available"}</span></header>
        <div class="panel-body">
          <dl class="data-list">
            <div><dt>Bay 1</dt><dd>CV Lagrange / thermal service / 00:48 remaining</dd></div>
            <div><dt>Bay 2</dt><dd>${queued ? "Pressure inspection / unavailable" : "Available / light service"}</dd></div>
            <div><dt>Your estimate</dt><dd>${queued ? "01:42:00 until intake" : "Intake available now"}</dd></div>
          </dl>
        </div>
      </section>
    </div>
  `;
};

const renderMarket = () => {
  const lockdown = state.scenario === "lockdown";
  const rows = marketItems.map((item) => `
    <tr>
      <td><strong>${item.name}</strong></td><td>${item.side}</td><td class="value-mono">${item.available}</td><td>${item.demand}</td><td>${item.legality}</td><td>${item.destination}</td><td class="value-mono">${item.price}</td>
      <td><button type="button" class="table-action" data-action="market-order" ${lockdown || item.legality === "Blocked" ? "disabled" : ""}>Review ${item.side.toLowerCase()}</button></td>
    </tr>`).join("");
  return `
    <div class="operation-stack">
      ${lockdown ? `<div class="blocked-reason"><strong>Exchange closed:</strong> Mock lockdown suspends all market commands.</div>` : `<div class="notice-strip">Local static exchange fixture. No global price movement, stock simulation, or dynamic economy is claimed.</div>`}
      <section class="operation-panel" aria-labelledby="exchange-heading">
        <header><h2 id="exchange-heading">Post 07 exchange sheet</h2><span>Mock quote cycle 07-114</span></header>
        <div class="panel-body">
          <div class="data-table-wrap">
            <table class="data-table">
              <thead><tr><th>Commodity</th><th>Side</th><th>Available</th><th>Demand</th><th>Legality (mock)</th><th>Destination</th><th>Fixture price</th><th>Local command</th></tr></thead>
              <tbody>${rows}</tbody>
            </table>
          </div>
        </div>
      </section>
    </div>
  `;
};

const renderMissions = () => {
  if (state.scenario === "mission-accepted" && !state.missionState.has("geological")) {
    state.missionState.set("geological", "Accepted");
  }
  const cards = missions.map((mission) => {
    const missionStatus = state.missionState.get(mission.id) || "Available";
    return `
      <article class="mission-card" data-mission="${mission.id}">
        <div>
          <h3>${mission.name}</h3>
          <p>${mission.issuer}<br>${mission.objective}<br><strong>${mission.site}</strong></p>
        </div>
        <div class="mission-meta">
          <div><strong>${mission.risk}</strong><span>Risk</span></div>
          <div><strong>${mission.duration}</strong><span>Duration</span></div>
          <div><strong>${mission.legality}</strong><span>Mock legality</span></div>
          <div><strong>${mission.reward}</strong><span>Reward descriptor</span></div>
          <div><strong>${missionStatus}</strong><span>Local state</span></div>
        </div>
        <div class="action-row">
          <button type="button" class="primary-action" data-action="accept-mission" data-item="${mission.id}" ${missionStatus !== "Available" ? "disabled" : ""}>Accept locally</button>
          <button type="button" data-action="decline-mission" data-item="${mission.id}" ${missionStatus !== "Available" ? "disabled" : ""}>Decline</button>
        </div>
      </article>
    `;
  }).join("");
  return `
    <div class="operation-stack">
      <div class="notice-strip">All mission cards are UX fixtures. Accept and decline only change local page state.</div>
      <section class="operation-panel" aria-labelledby="mission-board-heading">
        <header><h2 id="mission-board-heading">Local offers</h2><span>5 mock cards · no mission authority</span></header>
        <div class="panel-body mission-list">${cards}</div>
      </section>
    </div>
  `;
};

const getDroneState = (drone) => {
  if (state.scenario === "drone-link-lost" && drone.id === "scout") return "Link Lost";
  if (state.scenario === "drone-link-lost" && drone.id === "mining") return "Needs Attention";
  if (state.scenario === "lockdown" && drone.id !== "cargo") return "Assigned";
  return state.droneState.get(drone.id) || drone.state;
};

const renderDrones = () => {
  const linkLost = state.scenario === "drone-link-lost";
  const lockdown = state.scenario === "lockdown";
  const rows = droneFixtures.map((drone) => {
    const droneState = getDroneState(drone);
    const warning = droneState === "Link Lost" || droneState === "Needs Attention";
    return `
      <article class="drone-row" data-drone="${drone.id}">
        <div><h3>${drone.name}</h3><p>${drone.role}<br>${drone.assignment}</p></div>
        <dl class="data-list">
          <div><dt>State</dt><dd class="${statusClass(warning ? "blocked" : droneState === "Active" ? "ok" : "neutral")}">${droneState}</dd></div>
          <div><dt>Battery</dt><dd>${drone.battery}</dd></div>
          <div><dt>Link</dt><dd>${linkLost && drone.id === "scout" ? "LOST / last relay 03" : drone.link}</dd></div>
        </dl>
        <div class="action-row">
          <button type="button" data-action="assign-drone" data-item="${drone.id}" ${lockdown ? "disabled" : ""}>Assign</button>
          <button type="button" data-action="launch-drone" data-item="${drone.id}" ${lockdown || warning ? "disabled" : ""}>Launch</button>
          <button type="button" data-action="recall-drone" data-item="${drone.id}" ${warning ? "disabled" : ""}>Recall</button>
          <button type="button" data-action="pause-drone" data-item="${drone.id}">Pause</button>
          <button type="button" data-action="open-drone-telemetry" data-item="${drone.id}">Open telemetry</button>
          ${warning ? `<button type="button" class="danger-action" data-action="ack-drone-warning" data-item="${drone.id}">Acknowledge warning</button>` : ""}
        </div>
      </article>
    `;
  }).join("");
  return `
    <div class="operation-stack">
      ${linkLost ? `<div class="blocked-reason" data-testid="drone-link-lost-warning"><strong>Link lost:</strong> Scout Drone last reported at relay mast 03. Launch and recall are unavailable.</div>` : `<div class="notice-strip">Drone commands mutate local fixture state only. No scheduler, navigation, or drone authority is connected.</div>`}
      <section class="operation-panel" aria-labelledby="drone-roster-heading">
        <header><h2 id="drone-roster-heading">Drone roster</h2><span>3 fixtures · local commands</span></header>
        <div class="panel-body drone-list">${rows}</div>
      </section>
    </div>
  `;
};

const renderLegal = () => {
  const lockdown = state.scenario === "lockdown";
  const illegal = state.scenario === "illegal-cargo";
  return `
    <div class="operation-stack">
      ${lockdown ? `<div class="blocked-reason" data-testid="lockdown-warning"><strong>Mock lockdown:</strong> Site security fixture AFSP07-L4 applies an impound hold and suspends all outbound services.</div>` : illegal ? `<div class="warning-strip"><strong>Inspection hold:</strong> Restricted goods require a mock permit review.</div>` : `<div class="notice-strip">All legal, faction, fee, inspection, and access states are explicitly mock service data.</div>`}
      <section class="operation-panel" aria-labelledby="legal-register-heading">
        <header><h2 id="legal-register-heading">Access register</h2><span>Mock jurisdiction / Aurelia Frontier</span></header>
        <div class="panel-body">
          <dl class="data-list">
            <div><dt>Docking permit</dt><dd>${lockdown ? "Suspended by mock lockdown" : "AF-07-DK / valid 18 h"}</dd></div>
            <div><dt>Cargo inspection</dt><dd>${illegal ? "Required / restricted sample" : lockdown ? "Mandatory hold" : "Routine / passed"}</dd></div>
            <div><dt>Restricted goods</dt><dd>${illegal ? "Xeno-biological sample / blocked" : "None declared"}</dd></div>
            <div><dt>Outstanding fee</dt><dd>${lockdown ? "420 cr fixture fee" : "0 cr / mock ledger"}</dd></div>
            <div><dt>Impound risk</dt><dd>${lockdown ? "HIGH / mock hold active" : illegal ? "Elevated until inspection" : "Low"}</dd></div>
            <div><dt>Faction access</dt><dd>${lockdown ? "Frontier services suspended" : "Aurelia Civil / Tier 2 fixture"}</dd></div>
          </dl>
        </div>
      </section>
      <section class="operation-panel" aria-labelledby="availability-heading">
        <header><h2 id="availability-heading">Service availability effects</h2><span>Projection of mock access state</span></header>
        <div class="panel-body">
          <table class="data-table">
            <thead><tr><th>Service</th><th>Availability</th><th>Mock reason</th></tr></thead>
            <tbody>
              <tr><td>Pad release</td><td>${lockdown ? "Blocked" : "Available"}</td><td>${lockdown ? "Impound hold" : "Permit valid"}</td></tr>
              <tr><td>Cargo transfer</td><td>${illegal || lockdown ? "Blocked" : "Available"}</td><td>${illegal ? "Restricted goods" : lockdown ? "Lockdown" : "Inspection passed"}</td></tr>
              <tr><td>Refuel / repair</td><td>${lockdown ? "Blocked" : "Available"}</td><td>${lockdown ? "Lockdown" : "Service access valid"}</td></tr>
              <tr><td>Market / missions</td><td>${lockdown ? "Read only" : "Available"}</td><td>${lockdown ? "Command suspension" : "Local fixture access"}</td></tr>
              <tr><td>Drone launch</td><td>${lockdown ? "Blocked" : "Available"}</td><td>${lockdown ? "Airspace closure" : "Local permit fixture"}</td></tr>
            </tbody>
          </table>
        </div>
      </section>
    </div>
  `;
};

const renderSection = () => {
  const section = sections.find((entry) => entry.id === state.section) || sections[0];
  const renderers = {
    pads: renderPads,
    cargo: renderCargo,
    refuel: renderRefuel,
    repair: renderRepair,
    market: renderMarket,
    missions: renderMissions,
    drones: renderDrones,
    legal: renderLegal
  };
  sectionContent.innerHTML = headerTemplate(section) + renderers[section.id]();
  bindHoldControls();
};

const renderContext = () => {
  const scenario = scenarioDefinitions[state.scenario];
  const warningClass = scenario.level === "blocked" ? "blocked-reason" : scenario.level === "warning" ? "warning-strip" : "notice-strip";
  const currentSection = sections.find((entry) => entry.id === state.section);
  contextContent.innerHTML = `
    <section class="context-section">
      <h2>Scenario</h2>
      <p><strong>${scenario.label}</strong></p>
      <div class="${warningClass}" style="margin-top:10px">${scenario.warning}</div>
    </section>
    <section class="context-section">
      <h2>Current section</h2>
      <dl class="data-list">
        <div><dt>Sector</dt><dd>${String(sections.indexOf(currentSection) + 1).padStart(2, "0")}</dd></div>
        <div><dt>View</dt><dd>${currentSection.title}</dd></div>
        <div><dt>Authority</dt><dd>Mock / local only</dd></div>
      </dl>
    </section>
    <section class="context-section">
      <h2>Last local command</h2>
      <p data-testid="last-command">${escapeHtml(state.lastCommand)}</p>
    </section>
    <section class="context-section">
      <h2>Prototype boundary</h2>
      <p>${AUTHORITY_NOTICE}</p>
    </section>
  `;
};

const updateNavigation = () => {
  document.querySelectorAll("[data-section]").forEach((button) => {
    if (!(button instanceof HTMLButtonElement)) return;
    if (button.dataset.section === state.section) button.setAttribute("aria-current", "page");
    else button.removeAttribute("aria-current");
  });
};

const updateTopStatus = () => {
  const scenario = scenarioDefinitions[state.scenario];
  document.querySelector("#link-status").textContent = scenario.link;
  document.querySelector("#dock-status").textContent = scenario.dock;
  document.querySelector("#access-status").textContent = scenario.access;
};

const render = () => {
  updateTopStatus();
  updateNavigation();
  renderSection();
  renderContext();
  contextColumn.classList.toggle("is-open", state.contextOpen);
  contextToggle.setAttribute("aria-expanded", String(state.contextOpen));
};

const setSection = (sectionId, shouldFocus = false) => {
  if (!sections.some((section) => section.id === sectionId)) return;
  state.section = sectionId;
  render();
  if (shouldFocus) document.querySelector("#operations-workspace").focus();
};

const applyScenario = (scenarioId) => {
  const scenario = scenarioDefinitions[scenarioId];
  if (!scenario) return;
  state.scenario = scenarioId;
  state.section = scenario.section;
  state.serviceState = "idle";
  state.lastCommand = `Loaded scenario: ${scenario.label}`;
  if (scenarioId === "mission-accepted") state.missionState.set("geological", "Accepted");
  render();
  announce(`${scenario.label} loaded. ${scenario.warning}`, scenario.level === "blocked");
};

const openDialog = (title, description, content, invoker) => {
  state.dialogInvoker = invoker instanceof HTMLElement ? invoker : null;
  document.querySelector("#dialog-title").textContent = title;
  document.querySelector("#dialog-description").textContent = description;
  dialogContent.innerHTML = content;
  dialog.showModal();
  document.querySelector("#dialog-close").focus();
};

const closeDialog = () => {
  if (!dialog.open) return;
  dialog.close();
};

dialog.addEventListener("close", () => {
  const invoker = state.dialogInvoker;
  state.dialogInvoker = null;
  if (invoker?.isConnected) invoker.focus();
});

const bindHoldControls = () => {
  document.querySelectorAll("[data-action='hold-transfer']").forEach((button) => {
    if (!(button instanceof HTMLButtonElement)) return;
    let timer = null;
    let progressTimer = null;
    let startedAt = 0;

    const reset = () => {
      if (timer !== null) window.clearTimeout(timer);
      if (progressTimer !== null) window.clearInterval(progressTimer);
      timer = null;
      progressTimer = null;
      startedAt = 0;
      button.style.setProperty("--hold-progress", "0");
      button.textContent = "Hold to transfer";
    };

    const start = (event) => {
      if (button.disabled || timer !== null) return;
      if (event.type === "keydown" && !["Enter", " "].includes(event.key)) return;
      event.preventDefault();
      startedAt = performance.now();
      button.textContent = "Hold… 0%";
      progressTimer = window.setInterval(() => {
        const progress = Math.min(1, (performance.now() - startedAt) / 900);
        button.style.setProperty("--hold-progress", progress.toFixed(3));
        button.textContent = `Hold… ${Math.round(progress * 100)}%`;
      }, 50);
      timer = window.setTimeout(() => {
        const itemId = button.dataset.item;
        reset();
        recordCommand(`Confirmed hazardous / foreign-custody transfer for ${itemId}. Local prototype state only.`);
        button.textContent = "Transfer recorded locally";
      }, 900);
    };

    const cancel = (event) => {
      if (event.type === "keyup" && !["Enter", " "].includes(event.key)) return;
      if (timer !== null && performance.now() - startedAt < 880) {
        reset();
        announce("Hold confirmation cancelled before completion.");
      }
    };

    button.addEventListener("pointerdown", start);
    button.addEventListener("pointerup", cancel);
    button.addEventListener("pointerleave", cancel);
    button.addEventListener("pointercancel", cancel);
    button.addEventListener("keydown", start);
    button.addEventListener("keyup", cancel);
    button.addEventListener("blur", cancel);
  });
};

document.addEventListener("click", (event) => {
  const target = event.target instanceof Element ? event.target.closest("button") : null;
  if (!(target instanceof HTMLButtonElement)) return;

  if (target.dataset.section) {
    setSection(target.dataset.section);
    return;
  }

  const action = target.dataset.action;
  const item = target.dataset.item;
  if (!action || action === "hold-transfer") return;

  if (action === "request-clearance") recordCommand("Approach clearance confirmed locally for lane A-07.");
  if (action === "release-pad") recordCommand("Release Pad A command recorded locally. No ship or pad authority changed.");
  if (action === "transfer") recordCommand(`Transfer intent recorded locally for ${item}. No cargo container changed.`);
  if (action === "start-refuel") {
    state.serviceState = "running";
    recordCommand("Refuel simulation started locally. No ship resource state changed.");
    renderSection();
  }
  if (action === "cancel-refuel") {
    state.serviceState = "idle";
    recordCommand("Refuel simulation cancelled locally.");
    renderSection();
  }
  if (action === "complete-refuel") {
    state.serviceState = "complete";
    recordCommand("Refuel simulation completed locally. No ship resource state changed.");
    renderSection();
  }
  if (action === "queue-repair") recordCommand(`Repair line ${item} queued in local prototype state.`);
  if (action === "market-order") recordCommand("Market review intent recorded locally. No order or economy state changed.");
  if (action === "accept-mission" || action === "decline-mission") {
    state.missionState.set(item, action === "accept-mission" ? "Accepted" : "Declined");
    recordCommand(`${item} locally marked ${state.missionState.get(item)}. No mission was created.`);
    renderSection();
  }
  if (["assign-drone", "launch-drone", "recall-drone", "pause-drone", "ack-drone-warning"].includes(action)) {
    const nextState = {
      "assign-drone": "Assigned",
      "launch-drone": "Active",
      "recall-drone": "Returning",
      "pause-drone": "Assigned",
      "ack-drone-warning": "Needs Attention"
    }[action];
    state.droneState.set(item, nextState);
    if (action === "ack-drone-warning" && state.scenario === "drone-link-lost") state.scenario = "nominal";
    recordCommand(`${item} locally set to ${nextState}. No drone scheduler state changed.`);
    render();
  }
  if (action === "open-pad-detail") {
    openDialog(
      "Pad A connection detail",
      "Local connection fixture. No ship, pad, cargo, or service authority.",
      `<dl class="data-list"><div><dt>Power</dt><dd>400 V / connected</dd></div><div><dt>Data</dt><dd>Local service link / stable</dd></div><div><dt>Cargo seal</dt><dd>Aligned / closed</dd></div><div><dt>Release interlock</dt><dd>Mock operator confirmation</dd></div></dl>`,
      target
    );
  }
  if (action === "open-drone-telemetry") {
    const drone = droneFixtures.find((entry) => entry.id === item);
    openDialog(
      `${drone.name} telemetry`,
      "Prototype-only telemetry fixture. No scheduler or drone authority.",
      `<dl class="data-list"><div><dt>State</dt><dd>${getDroneState(drone)}</dd></div><div><dt>Battery</dt><dd>${drone.battery}</dd></div><div><dt>Assignment</dt><dd>${drone.assignment}</dd></div><div><dt>Link</dt><dd>${drone.link}</dd></div><div><dt>Authority</dt><dd>Mock / local-only</dd></div></dl>`,
      target
    );
  }
});

scenarioSelect.addEventListener("change", () => applyScenario(scenarioSelect.value));

contextToggle.addEventListener("click", () => {
  state.contextOpen = !state.contextOpen;
  render();
  if (state.contextOpen) document.querySelector("#context-close").focus();
});

document.querySelector("#context-close").addEventListener("click", () => {
  state.contextOpen = false;
  render();
  contextToggle.focus();
});

document.addEventListener("keydown", (event) => {
  const editable = event.target instanceof HTMLElement && (
    event.target.matches("input, select, textarea") || event.target.isContentEditable
  );
  if (event.key === "Escape") {
    if (dialog.open) {
      event.preventDefault();
      closeDialog();
      return;
    }
    if (state.contextOpen) {
      event.preventDefault();
      state.contextOpen = false;
      render();
      contextToggle.focus();
    }
    return;
  }
  if (editable || event.altKey || event.ctrlKey || event.metaKey) return;
  const index = Number.parseInt(event.key, 10) - 1;
  if (index >= 0 && index < sections.length) {
    event.preventDefault();
    setSection(sections[index].id, true);
    announce(`${sections[index].title} opened by keyboard shortcut.`);
  }
});

window.OutpostOperationsPrototypeV1 = Object.freeze({
  authority: AUTHORITY_NOTICE,
  getState: () => Object.freeze({
    section: state.section,
    scenario: state.scenario,
    serviceState: state.serviceState,
    lastCommand: state.lastCommand
  })
});

render();
