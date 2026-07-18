(function () {
  "use strict";

  const PRIMARY_STATES = Object.freeze([
    "Exploration",
    "Scanner",
    "InteractionHold",
    "HazardWarning",
    "InventoryDetail",
    "MinimalHud",
  ]);

  const TOOLS = Object.freeze({
    1: Object.freeze({
      name: "Multi-Tool",
      cooldown: "Ready / 12% draw",
      range: "1.8 m",
      condition: "[OK] Nominal",
      resource: "Charge 68%",
      capability: "Inspect / fasten",
      fixtureId: "tool-capability-multi-tool-mt-01",
    }),
    2: Object.freeze({
      name: "Terrain Scanner",
      cooldown: "2.0 s / 18% draw",
      range: "45 m",
      condition: "[OK] Calibrated",
      resource: "Charge 94%",
      capability: "Geologic sweep",
      fixtureId: "tool-capability-terrain-scanner-ts-02",
    }),
    3: Object.freeze({
      name: "Sample Extractor",
      cooldown: "Ready / 15% draw",
      range: "1.2 m",
      condition: "[OK] Sterile",
      resource: "Charge 42%",
      capability: "Fixture sample preview",
      fixtureId: "tool-capability-sample-extractor-se-03",
    }),
    4: Object.freeze({
      name: "Beacon Launcher",
      cooldown: "Ready / 8% draw",
      range: "80 m",
      condition: "[OK] Safe",
      resource: "Ammo 3 mock beacons",
      capability: "Marker preview only",
      fixtureId: "tool-capability-beacon-launcher-bl-04",
    }),
    5: Object.freeze({
      name: "Repair Applicator",
      cooldown: "3.5 s / 24% draw",
      range: "2.0 m",
      condition: "[OK] Nominal",
      resource: "Heat 22%",
      capability: "Repair preview only",
      fixtureId: "tool-capability-repair-applicator-ra-05",
    }),
  });

  const NEXT_ACTIONS = Object.freeze({
    Exploration: "Approach marked shelf",
    Scanner: "Review fixed Tier 2 reveal",
    InteractionHold: "Hold inspection at 64%",
    HazardWarning: "Move to lee side",
    InventoryDetail: "Review read-only sample slot",
    MinimalHud: "Continue toward HES-07",
  });

  const INITIAL_STATE = Object.freeze({
    primaryState: "Exploration",
    activeTool: 1,
    detailPanels: false,
    hazardFrame: "HZ-RESET-00",
  });

  let state = INITIAL_STATE;

  const root = document.querySelector("#world-root");
  const liveStatus = document.querySelector("#live-status");
  const stateOutput = document.querySelector("#primary-state");
  const detailState = document.querySelector("#detail-state");
  const detailToggle = document.querySelector('[data-action="detail-toggle"]');
  const detailRows = Array.from(document.querySelectorAll(".detail-only"));
  const stateReveals = Array.from(document.querySelectorAll("[data-show-state]"));
  const stateButtons = Array.from(document.querySelectorAll("[data-state-target]"));
  const toolButtons = Array.from(document.querySelectorAll("[data-tool-slot]"));

  function reduce(current, action) {
    switch (action.type) {
      case "SELECT_STATE":
        if (!PRIMARY_STATES.includes(action.primaryState)) return current;
        return Object.freeze({ ...current, primaryState: action.primaryState });
      case "TOGGLE_MINIMAL":
        return Object.freeze({
          ...current,
          primaryState: current.primaryState === "MinimalHud" ? "Exploration" : "MinimalHud",
        });
      case "RESET_HAZARD":
        return Object.freeze({
          ...current,
          primaryState: "HazardWarning",
          hazardFrame: "HZ-RESET-00",
        });
      case "ESCAPE":
        return Object.freeze({ ...current, primaryState: "Exploration", detailPanels: false });
      case "TOGGLE_DETAILS":
        return Object.freeze({ ...current, detailPanels: !current.detailPanels });
      case "SELECT_TOOL":
        return TOOLS[action.slot]
          ? Object.freeze({ ...current, activeTool: action.slot })
          : current;
      default:
        return current;
    }
  }

  function statusFor(action, nextState) {
    switch (action.type) {
      case "SELECT_STATE":
        return `${nextState.primaryState} fixture selected.`;
      case "TOGGLE_MINIMAL":
        return `${nextState.primaryState} fixture selected.`;
      case "RESET_HAZARD":
        return `Hazard Scenario reset to ${nextState.hazardFrame}; HazardWarning selected.`;
      case "ESCAPE":
        return "Overlays closed; Exploration fixture selected.";
      case "TOGGLE_DETAILS":
        return `Detail Panels ${nextState.detailPanels ? "expanded" : "collapsed"}.`;
      case "SELECT_TOOL":
        return `Toolbelt slot ${nextState.activeTool}, ${TOOLS[nextState.activeTool].name}, selected.`;
      default:
        return "Prototype fixture ready.";
    }
  }

  function dispatch(action) {
    state = reduce(state, action);
    render(statusFor(action, state));
  }

  function render(statusMessage) {
    const tool = TOOLS[state.activeTool];
    root.dataset.state = state.primaryState;
    root.dataset.details = state.detailPanels ? "expanded" : "collapsed";
    stateOutput.textContent = state.primaryState;
    document.querySelector("#next-action").textContent = NEXT_ACTIONS[state.primaryState];
    document.querySelector("#hazard-level").textContent =
      state.primaryState === "HazardWarning" ? "WARNING · Abrasive gust" : "SAFE · Trace dust";

    stateReveals.forEach((element) => {
      const visibleStates = element.dataset.showState.split(" ");
      element.hidden = !visibleStates.includes(state.primaryState);
    });

    stateButtons.forEach((button) => {
      button.setAttribute(
        "aria-pressed",
        String(button.dataset.stateTarget === state.primaryState),
      );
    });

    detailToggle.setAttribute("aria-pressed", String(state.detailPanels));
    detailState.textContent = state.detailPanels ? "expanded" : "collapsed";
    detailRows.forEach((row) => {
      row.hidden = !state.detailPanels;
    });

    toolButtons.forEach((button) => {
      button.setAttribute(
        "aria-pressed",
        String(Number(button.dataset.toolSlot) === state.activeTool),
      );
    });

    document.querySelector("#active-tool").textContent = tool.name;
    document.querySelector("#tool-cooldown").textContent = tool.cooldown;
    document.querySelector("#capability-tool").textContent = tool.name;
    document.querySelector("#tool-range").textContent = tool.range;
    document.querySelector("#tool-condition").textContent = tool.condition;
    document.querySelector("#tool-resource").textContent = tool.resource;
    document.querySelector("#tool-capability").textContent = tool.capability;
    document.querySelector("#fixture-tool-capability").dataset.fixtureId = tool.fixtureId;
    liveStatus.textContent = statusMessage;
  }

  function actionFromName(actionName) {
    switch (actionName) {
      case "scanner":
        return { type: "SELECT_STATE", primaryState: "Scanner" };
      case "interaction":
        return { type: "SELECT_STATE", primaryState: "InteractionHold" };
      case "inventory":
        return { type: "SELECT_STATE", primaryState: "InventoryDetail" };
      case "minimal-toggle":
        return { type: "TOGGLE_MINIMAL" };
      case "hazard-reset":
        return { type: "RESET_HAZARD" };
      case "escape":
        return { type: "ESCAPE" };
      case "detail-toggle":
        return { type: "TOGGLE_DETAILS" };
      default:
        return null;
    }
  }

  root.addEventListener("click", (event) => {
    const actionButton = event.target.closest("[data-action]");
    if (actionButton) {
      const action = actionFromName(actionButton.dataset.action);
      if (action) dispatch(action);
      return;
    }

    const toolButton = event.target.closest("[data-tool-slot]");
    if (toolButton) {
      dispatch({ type: "SELECT_TOOL", slot: Number(toolButton.dataset.toolSlot) });
    }
  });

  function isEditable(target) {
    return (
      target instanceof HTMLElement &&
      (target.matches("input, textarea, select") || target.isContentEditable)
    );
  }

  document.addEventListener("keydown", (event) => {
    if (event.altKey || event.ctrlKey || event.metaKey || isEditable(event.target)) return;

    if (event.key === "Tab") {
      if (!event.shiftKey && event.target === root) {
        dispatch({ type: "TOGGLE_DETAILS" });
      }
      return;
    }

    const key = event.key.toLowerCase();
    const keyboardActions = {
      q: { type: "SELECT_STATE", primaryState: "Scanner" },
      e: { type: "SELECT_STATE", primaryState: "InteractionHold" },
      i: { type: "SELECT_STATE", primaryState: "InventoryDetail" },
      h: { type: "TOGGLE_MINIMAL" },
      r: { type: "RESET_HAZARD" },
      escape: { type: "ESCAPE" },
    };

    if (keyboardActions[key]) {
      dispatch(keyboardActions[key]);
      return;
    }

    if (/^[1-5]$/.test(event.key)) {
      dispatch({ type: "SELECT_TOOL", slot: Number(event.key) });
    }
  });

  const canvas = document.querySelector("#surface-vista");
  const context = canvas.getContext("2d", { alpha: false });

  function polygon(points, fill) {
    context.beginPath();
    context.moveTo(points[0][0], points[0][1]);
    points.slice(1).forEach(([x, y]) => context.lineTo(x, y));
    context.closePath();
    context.fillStyle = fill;
    context.fill();
  }

  function drawVista() {
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    const scale = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.max(1, Math.floor(width * scale));
    canvas.height = Math.max(1, Math.floor(height * scale));
    context.setTransform(scale, 0, 0, scale, 0, 0);

    context.fillStyle = "#191719";
    context.fillRect(0, 0, width, height);

    context.fillStyle = "#d98a55";
    context.beginPath();
    context.arc(width * 0.78, height * 0.19, Math.max(28, width * 0.027), 0, Math.PI * 2);
    context.fill();

    const stars = [
      [0.08, 0.13], [0.14, 0.21], [0.23, 0.09], [0.31, 0.18], [0.42, 0.12],
      [0.53, 0.22], [0.64, 0.1], [0.71, 0.27], [0.88, 0.12], [0.94, 0.24],
      [0.18, 0.31], [0.37, 0.28], [0.57, 0.34], [0.84, 0.32],
    ];
    context.fillStyle = "#d8c7b5";
    stars.forEach(([x, y], index) => {
      const size = index % 3 === 0 ? 2 : 1;
      context.fillRect(Math.round(width * x), Math.round(height * y), size, size);
    });

    polygon(
      [[0, height * 0.52], [width * 0.1, height * 0.4], [width * 0.2, height * 0.48],
        [width * 0.34, height * 0.35], [width * 0.49, height * 0.5], [width * 0.62, height * 0.39],
        [width * 0.76, height * 0.47], [width * 0.9, height * 0.36], [width, height * 0.48], [width, height], [0, height]],
      "#4a3029",
    );
    polygon(
      [[0, height * 0.6], [width * 0.16, height * 0.51], [width * 0.3, height * 0.57],
        [width * 0.48, height * 0.49], [width * 0.67, height * 0.58], [width * 0.83, height * 0.5],
        [width, height * 0.58], [width, height], [0, height]],
      "#5c4034",
    );
    polygon(
      [[0, height * 0.69], [width * 0.2, height * 0.61], [width * 0.4, height * 0.7],
        [width * 0.61, height * 0.6], [width * 0.79, height * 0.68], [width, height * 0.6],
        [width, height], [0, height]],
      "#2c2928",
    );

    context.fillStyle = "#171819";
    context.fillRect(width * 0.72, height * 0.51, width * 0.05, height * 0.035);
    context.fillRect(width * 0.735, height * 0.47, width * 0.02, height * 0.045);
    context.strokeStyle = "#8c9a94";
    context.lineWidth = 2;
    context.beginPath();
    context.moveTo(width * 0.725, height * 0.545);
    context.lineTo(width * 0.715, height * 0.57);
    context.moveTo(width * 0.765, height * 0.545);
    context.lineTo(width * 0.78, height * 0.57);
    context.stroke();

    context.fillStyle = "#161514";
    [[0.12, 0.72, 0.08, 0.06], [0.57, 0.76, 0.09, 0.05], [0.86, 0.7, 0.07, 0.07]].forEach(
      ([x, y, w, h]) => context.fillRect(width * x, height * y, width * w, height * h),
    );
  }

  canvas.addEventListener("pointerdown", () => root.focus({ preventScroll: true }));
  window.addEventListener("resize", drawVista);

  render("Exploration fixture ready.");
  drawVista();
})();
