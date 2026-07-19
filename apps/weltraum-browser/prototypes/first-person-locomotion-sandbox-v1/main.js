import {
  COURSE_NUMERIC_CONSTANTS,
  DEFAULT_COURSE_MODEL,
  getCourseRenderDescriptors
} from "./course-model.js";
import {
  LOCOMOTION_NUMERIC_CONSTANTS,
  LOCOMOTION_PRESETS,
  createLocomotionModel,
  isFiniteLocomotionTelemetry,
  normalizeLocomotionIntent
} from "./locomotion-model.js";
import {
  CAMERA_PRESENTATION_FIXTURES,
  SCENE_PRESENTATION_FIXTURES,
  createProvingGroundScene,
  getCourseRegionLabels
} from "./scene.js";

export const INTERACTION_UX_FIXTURES = Object.freeze({
  automationPressDurationMilliseconds: 180,
  maximumVisibleContactRows: 6
});

const API_NAMESPACE = "WeltraumFirstPersonLocomotionSandboxV1";
const CONTROL_NAMES = Object.freeze([
  "forward",
  "left",
  "backward",
  "right",
  "sprint",
  "crouch",
  "jump"
]);
const CONTROL_LABELS = Object.freeze({
  forward: "W",
  left: "A",
  backward: "S",
  right: "D",
  sprint: "Shift",
  crouch: "Ctrl/C",
  jump: "Space"
});
const KEY_CONTROLS = Object.freeze({
  KeyW: "forward",
  KeyA: "left",
  KeyS: "backward",
  KeyD: "right",
  ShiftLeft: "sprint",
  ShiftRight: "sprint",
  ControlLeft: "crouch",
  ControlRight: "crouch",
  KeyC: "crouch",
  Space: "jump"
});

const required = (selector) => {
  const element = document.querySelector(selector);
  if (!element) throw new Error(`Missing required sandbox element: ${selector}`);
  return element;
};

const setTextIfChanged = (element, text) => {
  if (element.textContent !== text) element.textContent = text;
};

const cloneHealth = (health) => ({
  runtimeErrors: health.runtimeErrors,
  consoleErrors: health.consoleErrors,
  failedRequests: health.failedRequests,
  nonFiniteSamples: health.nonFiniteSamples
});

const health = {
  runtimeErrors: 0,
  consoleErrors: 0,
  failedRequests: 0,
  nonFiniteSamples: 0
};
let renderHealth = () => {};

const updateHealth = (key) => {
  health[key] += 1;
  renderHealth();
};

const originalConsoleError = console.error.bind(console);
console.error = (...args) => {
  updateHealth("consoleErrors");
  originalConsoleError(...args);
};

window.addEventListener("error", (event) => {
  const target = event.target;
  const failedResource = target instanceof Element
    && ["IMG", "LINK", "SCRIPT", "SOURCE"].includes(target.tagName);
  updateHealth(failedResource ? "failedRequests" : "runtimeErrors");
}, true);
window.addEventListener("unhandledrejection", () => updateHealth("runtimeErrors"));

const originalFetch = window.fetch.bind(window);
window.fetch = async (...args) => {
  try {
    const response = await originalFetch(...args);
    if (!response.ok) updateHealth("failedRequests");
    return response;
  } catch (error) {
    updateHealth("failedRequests");
    throw error;
  }
};

const createIntentController = () => {
  const digitalSources = new Map(CONTROL_NAMES.map((control) => [control, new Set()]));
  const externalIntents = new Map();
  const subscribers = new Set();

  const notify = () => {
    const snapshot = getSnapshot();
    for (const subscriber of subscribers) subscriber(snapshot);
  };

  const assertControl = (control) => {
    if (!digitalSources.has(control)) throw new RangeError(`Unknown input control: ${control}`);
  };

  const setDigital = (control, active, source) => {
    assertControl(control);
    const sources = digitalSources.get(control);
    const hadSource = sources.has(source);
    if (active) sources.add(source);
    else sources.delete(source);
    if (hadSource !== sources.has(source)) notify();
    return getIntent();
  };

  const setExternal = (source, intent) => {
    externalIntents.set(source, normalizeLocomotionIntent(intent));
    notify();
    return getIntent();
  };

  const clearExternal = (source) => {
    if (externalIntents.delete(source)) notify();
    return getIntent();
  };

  const clearSource = (source) => {
    let changed = false;
    for (const sources of digitalSources.values()) changed = sources.delete(source) || changed;
    changed = externalIntents.delete(source) || changed;
    if (changed) notify();
  };

  const clearSourcePrefix = (prefix) => {
    let changed = false;
    for (const sources of digitalSources.values()) {
      for (const source of [...sources]) {
        if (source.startsWith(prefix)) changed = sources.delete(source) || changed;
      }
    }
    for (const source of [...externalIntents.keys()]) {
      if (source.startsWith(prefix)) changed = externalIntents.delete(source) || changed;
    }
    if (changed) notify();
  };

  const clearAll = () => {
    let changed = externalIntents.size > 0;
    externalIntents.clear();
    for (const sources of digitalSources.values()) {
      changed = sources.size > 0 || changed;
      sources.clear();
    }
    if (changed) notify();
  };

  function getIntent() {
    let moveX = Number(digitalSources.get("right").size > 0) - Number(digitalSources.get("left").size > 0);
    let moveZ = Number(digitalSources.get("forward").size > 0) - Number(digitalSources.get("backward").size > 0);
    let sprint = digitalSources.get("sprint").size > 0;
    let crouch = digitalSources.get("crouch").size > 0;
    let jump = digitalSources.get("jump").size > 0;
    for (const intent of externalIntents.values()) {
      moveX += intent.moveX;
      moveZ += intent.moveZ;
      sprint = sprint || intent.sprint;
      crouch = crouch || intent.crouch;
      jump = jump || intent.jump;
    }
    return normalizeLocomotionIntent({ moveX, moveZ, sprint, crouch, jump });
  }

  function getSnapshot() {
    const activeControls = CONTROL_NAMES.filter((control) => digitalSources.get(control).size > 0);
    return {
      intent: getIntent(),
      activeControls,
      externalSources: [...externalIntents.keys()],
      sourceIsActive: (control, source) => digitalSources.get(control)?.has(source) === true
    };
  }

  return Object.freeze({
    setDigital,
    setExternal,
    clearExternal,
    clearSource,
    clearSourcePrefix,
    clearAll,
    getIntent,
    getSnapshot,
    subscribe: (subscriber) => {
      subscribers.add(subscriber);
      subscriber(getSnapshot());
      return () => subscribers.delete(subscriber);
    }
  });
};

const canvas = required("#proving-ground");
const pointerLockButton = required('[data-testid="pointer-lock-engage"]');
const pointerLockStatus = required('[data-testid="pointer-lock-status"]');
const viewportPointerState = required('[data-testid="viewport-pointer-state"]');
const viewportPointerAction = required('[data-testid="viewport-pointer-action"]');
const viewportStatus = required('[data-testid="viewport-status"]');
const automationControl = required('[data-testid="automation-control"]');
const automationState = required('[data-testid="automation-state"]');
const activePreset = required('[data-testid="active-preset"]');
const activeCamera = required('[data-testid="active-camera"]');
const activeInput = required('[data-testid="active-input"]');
const browserHealth = required('[data-testid="browser-health"]');
const contactList = required('[data-testid="contact-list"]');
const cameraFixtureList = required('[data-testid="camera-fixtures"]');
const courseRegionIndex = required('[data-testid="course-region-index"]');
const cameraEffectiveState = required('[data-testid="camera-effective-state"]');
const headBobButton = required('[data-testid="toggle-head-bob"]');
const fovKickButton = required('[data-testid="toggle-fov-kick"]');

const diagnostic = Object.freeze({
  speed: required('[data-testid="diagnostic-speed"]'),
  grounded: required('[data-testid="diagnostic-grounded"]'),
  slope: required('[data-testid="diagnostic-slope"]'),
  traction: required('[data-testid="diagnostic-traction"]'),
  verticalVelocity: required('[data-testid="diagnostic-vertical-velocity"]'),
  backlog: required('[data-testid="diagnostic-backlog"]'),
  frameTime: required('[data-testid="diagnostic-frame-time"]'),
  cameraMode: required('[data-testid="diagnostic-camera-mode"]'),
  contactCount: required('[data-testid="diagnostic-contact-count"]'),
  position: required('[data-testid="diagnostic-position"]'),
  stance: required('[data-testid="diagnostic-stance"]'),
  support: required('[data-testid="diagnostic-support"]'),
  tick: required('[data-testid="diagnostic-tick"]')
});

renderHealth = () => {
  const values = [
    health.runtimeErrors,
    health.consoleErrors,
    health.failedRequests,
    health.nonFiniteSamples
  ];
  browserHealth.value = values.join("/");
  setTextIfChanged(browserHealth, browserHealth.value);
  browserHealth.dataset.state = values.some((value) => value > 0) ? "error" : "healthy";
};
renderHealth();

const courseDescriptors = getCourseRenderDescriptors();
const model = createLocomotionModel({ course: DEFAULT_COURSE_MODEL });
const intentController = createIntentController();
const sceneView = createProvingGroundScene({ canvas, courseDescriptors });

const reducedMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
const presentation = {
  headBobEnabled: true,
  fovKickEnabled: true,
  reducedMotion: reducedMotionQuery.matches
};
const getEffectivePresentationState = () => ({
  headBobEnabled: presentation.headBobEnabled,
  fovKickEnabled: presentation.fovKickEnabled,
  reducedMotion: presentation.reducedMotion,
  headBobEffective: presentation.headBobEnabled && !presentation.reducedMotion,
  fovKickEffective: presentation.fovKickEnabled && !presentation.reducedMotion
});
let manualStepMode = false;
let lastFrameTimeMilliseconds = performance.now();
let lastFrameMilliseconds = 0;
let latestTelemetry = model.getTelemetry();
const automationTimers = new Map();
let previousAutomationControl = automationControl.value;
let pointerState = "inactive";
let lastViewportStatusKey = "initial";

const humanizeFixtureName = (name) => name
  .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
  .replace(/^./, (character) => character.toUpperCase());

const cameraFixtureUnit = (name) => {
  if (name.includes("Degrees")) return "°";
  if (name.includes("Metres")) return " m";
  if (name.includes("Hz")) return " Hz";
  if (name.includes("PerSecond")) return " /s";
  if (name.includes("PerPixel")) return " rad/px";
  return "";
};

for (const [name, value] of Object.entries(CAMERA_PRESENTATION_FIXTURES)) {
  const row = document.createElement("div");
  const term = document.createElement("dt");
  const definition = document.createElement("dd");
  term.textContent = humanizeFixtureName(name);
  definition.textContent = `${value}${cameraFixtureUnit(name)}`;
  row.append(term, definition);
  cameraFixtureList.append(row);
}

for (const region of getCourseRegionLabels(courseDescriptors)) {
  const item = document.createElement("li");
  item.dataset.regionId = region.id;
  item.textContent = region.label;
  item.title = region.id;
  courseRegionIndex.append(item);
}

const formatNumber = (value, digits = 2) => Number.isFinite(value) ? value.toFixed(digits) : "non-finite";

const renderContacts = (contacts) => {
  contactList.replaceChildren();
  for (const contact of contacts.slice(0, INTERACTION_UX_FIXTURES.maximumVisibleContactRows)) {
    const item = document.createElement("li");
    item.textContent = `${contact.kind} · ${contact.surfaceId}`;
    contactList.append(item);
  }
};

const getCameraModeText = () => {
  const effective = getEffectivePresentationState();
  const lockText = document.pointerLockElement === canvas ? "pointer locked" : "pointer free";
  const bobText = effective.headBobEnabled
    ? effective.headBobEffective ? "bob on" : "bob suppressed"
    : "bob off";
  const fovText = effective.fovKickEnabled
    ? effective.fovKickEffective ? "FOV kick on" : "FOV kick suppressed"
    : "FOV kick off";
  return `First-person · ${lockText} · ${bobText} · ${fovText}`;
};

const updateViewportStatus = (key, message) => {
  if (lastViewportStatusKey === key) return;
  lastViewportStatusKey = key;
  setTextIfChanged(viewportStatus, message);
};

const renderTelemetry = (telemetry, frameMilliseconds) => {
  latestTelemetry = telemetry;
  if (!telemetry.finite || !isFiniteLocomotionTelemetry(telemetry)) updateHealth("nonFiniteSamples");
  const cameraMode = getCameraModeText();
  diagnostic.speed.textContent = `${formatNumber(telemetry.horizontalSpeed)} m/s`;
  diagnostic.grounded.textContent = telemetry.grounded ? "Yes" : "No";
  diagnostic.slope.textContent = `${formatNumber(telemetry.slopeDegrees)}°`;
  diagnostic.traction.textContent = formatNumber(telemetry.traction);
  diagnostic.verticalVelocity.textContent = `${formatNumber(telemetry.verticalVelocity)} m/s`;
  diagnostic.backlog.textContent = `${formatNumber(telemetry.fixedStepBacklogSteps)} steps`;
  diagnostic.frameTime.textContent = `${formatNumber(frameMilliseconds)} ms`;
  diagnostic.cameraMode.textContent = cameraMode;
  diagnostic.contactCount.textContent = String(telemetry.contactCount);
  diagnostic.position.textContent = [telemetry.position.x, telemetry.position.y, telemetry.position.z]
    .map((value) => formatNumber(value))
    .join(" / ");
  diagnostic.stance.textContent = telemetry.standingBlocked
    ? "Crouched · stand blocked"
    : telemetry.crouched ? "Crouched" : "Standing";
  diagnostic.support.textContent = telemetry.supportSurfaceId;
  diagnostic.tick.textContent = String(telemetry.tick);
  activePreset.textContent = telemetry.presetName;
  activeCamera.textContent = cameraMode;
  renderContacts(telemetry.contacts);

  if (telemetry.standingBlocked) {
    updateViewportStatus(
      `standing-blocked:${telemetry.supportSurfaceId}`,
      "Stand blocked by tunnel clearance; crouch remains authoritative."
    );
  } else if (telemetry.jumpedThisStep) {
    updateViewportStatus(`jump:${telemetry.tick}`, "Jump impulse accepted by the fixed-step solver.");
  } else if (telemetry.landedThisStep) {
    updateViewportStatus(`landed:${telemetry.tick}`, `Landed on ${telemetry.supportSurfaceId}.`);
  }
};

const renderPresetButtons = () => {
  for (const button of document.querySelectorAll("[data-preset]")) {
    button.setAttribute("aria-pressed", String(button.dataset.preset === model.getPresetName()));
  }
};

const renderToggleButton = (button, enabled, effective) => {
  button.setAttribute("aria-pressed", String(enabled));
  button.dataset.effective = String(effective);
  button.textContent = enabled ? "On" : "Off";
};

const renderPresentationState = () => {
  const effective = getEffectivePresentationState();
  renderToggleButton(headBobButton, effective.headBobEnabled, effective.headBobEffective);
  renderToggleButton(fovKickButton, effective.fovKickEnabled, effective.fovKickEffective);
  const reason = effective.reducedMotion ? " · reduced motion suppresses enabled effects" : "";
  setTextIfChanged(
    cameraEffectiveState,
    `Effective: Head Bob ${effective.headBobEffective ? "on" : "off"} · FOV Kick ${effective.fovKickEffective ? "on" : "off"}${reason}`
  );
};

const renderInputSnapshot = (snapshot) => {
  const digitalLabels = snapshot.activeControls.map((control) => CONTROL_LABELS[control]);
  const externalLabels = snapshot.externalSources.map(() => "Test API");
  const labels = [...digitalLabels, ...externalLabels];
  activeInput.textContent = labels.length > 0 ? labels.join(" + ") : "Idle";

  const selectedControl = automationControl.value;
  const pressSource = `automation:${selectedControl}:press`;
  const holdSource = `automation:${selectedControl}:hold`;
  const pressActive = snapshot.sourceIsActive(selectedControl, pressSource);
  const holdActive = snapshot.sourceIsActive(selectedControl, holdSource);
  required('[data-testid="automation-press"]').setAttribute("aria-pressed", String(pressActive));
  required('[data-testid="automation-hold"]').setAttribute("aria-pressed", String(holdActive));
  required('[data-testid="automation-release"]').setAttribute("aria-pressed", "false");
  const pressedControls = CONTROL_NAMES.filter((control) =>
    snapshot.sourceIsActive(control, `automation:${control}:press`)
  );
  const heldControls = CONTROL_NAMES.filter((control) =>
    snapshot.sourceIsActive(control, `automation:${control}:hold`)
  );
  const automationMessage = pressedControls.length > 0
    ? `${pressedControls.map((control) => CONTROL_LABELS[control]).join(" + ")} pressed briefly`
    : heldControls.length > 0
      ? `${heldControls.map((control) => CONTROL_LABELS[control]).join(" + ")} held`
      : "Automation idle";
  setTextIfChanged(automationState, automationMessage);
};

intentController.subscribe(renderInputSnapshot);

const clearAutomationTimers = () => {
  for (const timer of automationTimers.values()) window.clearTimeout(timer);
  automationTimers.clear();
};

const releaseAutomationControl = (control) => {
  const timer = automationTimers.get(control);
  if (timer) window.clearTimeout(timer);
  automationTimers.delete(control);
  intentController.setDigital(control, false, `automation:${control}:press`);
  intentController.setDigital(control, false, `automation:${control}:hold`);
};

const resetSandbox = ({ manual = false } = {}) => {
  clearAutomationTimers();
  intentController.clearAll();
  latestTelemetry = model.reset();
  sceneView.resetCamera();
  manualStepMode = manual;
  lastFrameTimeMilliseconds = performance.now();
  renderPresetButtons();
  renderTelemetry(latestTelemetry, lastFrameMilliseconds);
  updateViewportStatus(
    manual ? "manual-reset" : "reset",
    manual
      ? "Manual deterministic stepping at the named start."
      : "Ready at named start. Select Engage pointer lock to look around."
  );
  return latestTelemetry;
};

const resumeRealtime = () => {
  manualStepMode = false;
  lastFrameTimeMilliseconds = performance.now();
  renderTelemetry(model.getTelemetry(), lastFrameMilliseconds);
  updateViewportStatus("realtime", "Real-time simulation resumed.");
};

const beginUserInput = () => {
  if (manualStepMode) resumeRealtime();
};

for (const button of document.querySelectorAll("[data-preset]")) {
  button.addEventListener("click", () => {
    beginUserInput();
    latestTelemetry = model.setPreset(button.dataset.preset, { reset: false });
    renderPresetButtons();
    renderTelemetry(latestTelemetry, lastFrameMilliseconds);
  });
}

for (const button of document.querySelectorAll("[data-toggle]")) {
  button.addEventListener("click", () => {
    beginUserInput();
    if (button.dataset.toggle === "head-bob") {
      presentation.headBobEnabled = !presentation.headBobEnabled;
    } else {
      presentation.fovKickEnabled = !presentation.fovKickEnabled;
    }
    renderPresentationState();
    renderTelemetry(model.getTelemetry(), lastFrameMilliseconds);
  });
}

const runAutomationAction = (action) => {
  beginUserInput();
  const control = automationControl.value;
  const pressSource = `automation:${control}:press`;
  const holdSource = `automation:${control}:hold`;
  if (action === "press") {
    intentController.setDigital(control, false, holdSource);
    const existingTimer = automationTimers.get(control);
    if (existingTimer) window.clearTimeout(existingTimer);
    intentController.setDigital(control, true, pressSource);
    automationTimers.set(control, window.setTimeout(() => {
      intentController.setDigital(control, false, pressSource);
      automationTimers.delete(control);
    }, INTERACTION_UX_FIXTURES.automationPressDurationMilliseconds));
  } else if (action === "hold") {
    const timer = automationTimers.get(control);
    if (timer) window.clearTimeout(timer);
    automationTimers.delete(control);
    intentController.setDigital(control, false, pressSource);
    intentController.setDigital(control, true, holdSource);
  } else {
    releaseAutomationControl(control);
  }
};

for (const button of document.querySelectorAll("[data-action]")) {
  button.addEventListener("click", () => runAutomationAction(button.dataset.action));
}
automationControl.addEventListener("change", () => {
  if (previousAutomationControl !== automationControl.value) {
    releaseAutomationControl(previousAutomationControl);
    previousAutomationControl = automationControl.value;
  }
  renderInputSnapshot(intentController.getSnapshot());
});

required('[data-testid="reset-sandbox"]').addEventListener("click", () => resetSandbox());

const eventTargetsFormControl = (event) => event.target instanceof Element
  && ["BUTTON", "SELECT", "INPUT", "TEXTAREA", "SUMMARY"].includes(event.target.tagName);

document.addEventListener("keydown", (event) => {
  if (event.code === "Escape" && document.pointerLockElement === canvas) {
    document.exitPointerLock();
  }
});

window.addEventListener("keydown", (event) => {
  if (eventTargetsFormControl(event)) return;
  if (event.code === "KeyR" && !event.repeat) {
    event.preventDefault();
    resetSandbox();
    return;
  }
  const control = KEY_CONTROLS[event.code];
  if (!control) return;
  event.preventDefault();
  beginUserInput();
  intentController.setDigital(control, true, `keyboard:${event.code}`);
});

window.addEventListener("keyup", (event) => {
  const control = KEY_CONTROLS[event.code];
  if (!control) return;
  event.preventDefault();
  intentController.setDigital(control, false, `keyboard:${event.code}`);
});

window.addEventListener("blur", () => intentController.clearSourcePrefix("keyboard:"));

const renderPointerState = (state, announcement) => {
  pointerState = state;
  const locked = state === "active";
  pointerLockButton.setAttribute("aria-pressed", String(locked));
  pointerLockButton.toggleAttribute("aria-busy", state === "requesting");
  pointerLockButton.disabled = locked || state === "requesting";
  pointerLockButton.textContent = locked
    ? "Pointer lock active"
    : state === "requesting" ? "Requesting pointer lock…" : "Engage pointer lock";
  setTextIfChanged(pointerLockStatus, announcement);
  setTextIfChanged(
    viewportPointerState,
    locked ? "Pointer locked" : state === "requesting" ? "Pointer request pending" : "Pointer free"
  );
  setTextIfChanged(
    viewportPointerAction,
    locked
      ? "Next: press Escape to release."
      : state === "requesting" ? "Next: wait for Chromium permission." : "Next: use View control to engage pointer lock."
  );
};

renderPointerState("inactive", "Pointer lock inactive");
pointerLockButton.addEventListener("click", async () => {
  if (document.pointerLockElement === canvas) return;
  canvas.focus();
  renderPointerState("requesting", "Requesting pointer lock…");
  try {
    await canvas.requestPointerLock();
    if (document.pointerLockElement !== canvas) {
      renderPointerState("denied", "Pointer lock was not granted. Keyboard and visible controls remain available.");
    }
  } catch {
    renderPointerState("denied", "Pointer lock was not granted. Keyboard and visible controls remain available.");
  }
});

document.addEventListener("pointerlockchange", () => {
  const locked = document.pointerLockElement === canvas;
  if (locked) renderPointerState("active", "Pointer lock active. Press Escape to release.");
  else if (pointerState !== "requesting") {
    renderPointerState(
      "inactive",
      pointerState === "active"
        ? "Pointer lock released. Keyboard and visible controls remain available."
        : "Pointer lock inactive"
    );
  }
  renderTelemetry(model.getTelemetry(), lastFrameMilliseconds);
});

document.addEventListener("pointerlockerror", () => {
  renderPointerState("error", "Pointer lock request failed. Keyboard and visible controls remain available.");
});

document.addEventListener("mousemove", (event) => {
  if (document.pointerLockElement === canvas) sceneView.applyLookDelta(event.movementX, event.movementY);
});

reducedMotionQuery.addEventListener("change", (event) => {
  presentation.reducedMotion = event.matches;
  renderPresentationState();
  renderTelemetry(model.getTelemetry(), lastFrameMilliseconds);
});

const renderFrame = (timestampMilliseconds) => {
  const frameMilliseconds = Math.max(0, timestampMilliseconds - lastFrameTimeMilliseconds);
  lastFrameTimeMilliseconds = timestampMilliseconds;
  lastFrameMilliseconds = frameMilliseconds;
  if (!manualStepMode) {
    latestTelemetry = model.advance(frameMilliseconds / 1000, intentController.getIntent());
  } else {
    latestTelemetry = model.getTelemetry();
  }
  renderTelemetry(latestTelemetry, frameMilliseconds);
  sceneView.render({
    telemetry: latestTelemetry,
    locomotionParameters: model.getParameters(),
    frameDeltaSeconds: frameMilliseconds / 1000,
    headBobEnabled: presentation.headBobEnabled,
    fovKickEnabled: presentation.fovKickEnabled,
    reducedMotion: presentation.reducedMotion
  });
  window.requestAnimationFrame(renderFrame);
};

const testApi = Object.freeze({
  version: 1,
  reset: (options = {}) => {
    if (options.preset !== undefined) model.setPreset(options.preset, { reset: false });
    return resetSandbox({ manual: true });
  },
  setInput: (intent) => {
    manualStepMode = true;
    return intentController.setExternal("test-api", intent);
  },
  clearInput: () => intentController.clearExternal("test-api"),
  step: (count = 1) => {
    manualStepMode = true;
    latestTelemetry = model.step(intentController.getIntent(), count);
    renderTelemetry(latestTelemetry, 0);
    sceneView.render({
      telemetry: latestTelemetry,
      locomotionParameters: model.getParameters(),
      frameDeltaSeconds: 0,
      headBobEnabled: presentation.headBobEnabled,
      fovKickEnabled: presentation.fovKickEnabled,
      reducedMotion: presentation.reducedMotion
    });
    return latestTelemetry;
  },
  resume: resumeRealtime,
  telemetry: () => model.getTelemetry(),
  finite: () => {
    const telemetry = model.getTelemetry();
    return model.isFinite() && isFiniteLocomotionTelemetry(telemetry);
  },
  health: () => cloneHealth(health),
  camera: () => sceneView.getCameraState(),
  presentation: () => getEffectivePresentationState(),
  fixtures: () => ({
    course: COURSE_NUMERIC_CONSTANTS,
    locomotion: LOCOMOTION_NUMERIC_CONSTANTS,
    presets: LOCOMOTION_PRESETS,
    camera: CAMERA_PRESENTATION_FIXTURES,
    scene: SCENE_PRESENTATION_FIXTURES,
    interaction: INTERACTION_UX_FIXTURES,
    notice: "UX fixture — not final balance"
  })
});

Object.defineProperty(window, API_NAMESPACE, {
  configurable: false,
  enumerable: false,
  writable: false,
  value: testApi
});

renderPresetButtons();
renderPresentationState();
renderTelemetry(latestTelemetry, 0);
window.requestAnimationFrame(renderFrame);
