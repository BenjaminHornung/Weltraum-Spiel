import * as THREE from "three";

export const PRESENTATION_UX_FIXTURE_NOTICE = "UX fixture — not final balance";

export const CAMERA_PRESENTATION_FIXTURES = Object.freeze({
  baseFovDegrees: 72,
  fovKickMaximumDegrees: 5,
  fovResponsePerSecond: 9,
  standingEyeHeightRatio: 0.92,
  crouchedEyeHeightRatio: 0.88,
  bobAmplitudeMetres: 0.045,
  bobHorizontalRatio: 0.45,
  bobFrequencyHzAtFullSpeed: 1.85,
  mouseSensitivityRadiansPerPixel: 0.0022,
  pitchLimitDegrees: 85,
  initialPitchDegrees: -4,
  nearClipMetres: 0.05,
  farClipMetres: 140
});

export const SCENE_PRESENTATION_FIXTURES = Object.freeze({
  maxPixelRatio: 2,
  floorThicknessMetres: 0.08,
  surfaceOverlayOffsetMetres: 0.012,
  labelVerticalOffsetMetres: 0.62,
  labelHeightMetres: 0.42,
  labelMinimumWidthMetres: 2.5,
  labelWidthPerCharacterMetres: 0.105,
  unevenSegmentsX: 24,
  unevenSegmentsZ: 32,
  startMarkerRadiusMetres: 0.52,
  startDirectionLengthMetres: 1.45,
  supportMarkerRadiusMetres: 0.22,
  hemisphereLightIntensity: 1.25,
  directionalLightIntensity: 2.1
});

const CAMERA = CAMERA_PRESENTATION_FIXTURES;
const SCENE = SCENE_PRESENTATION_FIXTURES;
const degreesToRadians = (degrees) => degrees * Math.PI / 180;
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

const PALETTE = Object.freeze({
  background: 0x121416,
  floor: 0x292c2c,
  floorLine: 0x555850,
  ramp: 0x665b4b,
  stairs: 0x5d625b,
  blocked: 0x73534b,
  tunnel: 0x4d5555,
  platform: 0x6c6755,
  slippery: 0x4b665e,
  uneven: 0x5c5549,
  start: 0xd69a52,
  label: "#e9e3d9",
  labelBackground: "rgba(17, 19, 20, 0.9)",
  labelBorder: "#77756e"
});

const makeMaterial = (color, options = {}) => new THREE.MeshStandardMaterial({
  color,
  roughness: options.roughness ?? 0.88,
  metalness: options.metalness ?? 0.02,
  side: options.side ?? THREE.FrontSide,
  transparent: options.transparent ?? false,
  opacity: options.opacity ?? 1
});

const makeBox = (width, height, depth, material, position) => {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), material);
  mesh.position.set(position.x, position.y, position.z);
  mesh.receiveShadow = true;
  mesh.castShadow = true;
  return mesh;
};

const createRampGeometry = (width, depth, rise) => {
  const halfWidth = width / 2;
  const halfDepth = depth / 2;
  const bottomY = -SCENE.floorThicknessMetres;
  const positions = new Float32Array([
    -halfWidth, bottomY, -halfDepth,
    halfWidth, bottomY, -halfDepth,
    halfWidth, bottomY, halfDepth,
    -halfWidth, bottomY, halfDepth,
    -halfWidth, 0, -halfDepth,
    halfWidth, 0, -halfDepth,
    halfWidth, rise, halfDepth,
    -halfWidth, rise, halfDepth
  ]);
  const indices = [
    0, 2, 1, 0, 3, 2,
    0, 1, 5, 0, 5, 4,
    1, 2, 6, 1, 6, 5,
    2, 3, 7, 2, 7, 6,
    3, 0, 4, 3, 4, 7,
    4, 5, 6, 4, 6, 7
  ];
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
};

const createUnevenGeometry = (descriptor) => {
  const xSegments = SCENE.unevenSegmentsX;
  const zSegments = SCENE.unevenSegmentsZ;
  const width = descriptor.maxX - descriptor.minX;
  const depth = descriptor.maxZ - descriptor.minZ;
  const vertices = [];
  const indices = [];

  for (let zIndex = 0; zIndex <= zSegments; zIndex += 1) {
    const z = descriptor.minZ + depth * zIndex / zSegments;
    const localZ = z - descriptor.minZ;
    for (let xIndex = 0; xIndex <= xSegments; xIndex += 1) {
      const x = descriptor.minX + width * xIndex / xSegments;
      const y = descriptor.baseHeight
        + descriptor.xAmplitude * Math.sin(x * descriptor.xFrequency)
        + descriptor.zAmplitude * Math.sin(localZ * descriptor.zFrequency)
        + descriptor.crossAmplitude * Math.sin((x + localZ) * descriptor.crossFrequency);
      vertices.push(x, y, z);
    }
  }

  for (let zIndex = 0; zIndex < zSegments; zIndex += 1) {
    for (let xIndex = 0; xIndex < xSegments; xIndex += 1) {
      const row = xSegments + 1;
      const a = zIndex * row + xIndex;
      const b = a + 1;
      const c = a + row;
      const d = c + 1;
      indices.push(a, c, b, b, c, d);
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
};

const makeLabel = (text) => {
  const canvas = document.createElement("canvas");
  canvas.width = 1024;
  canvas.height = 144;
  const context = canvas.getContext("2d");
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = PALETTE.labelBackground;
  context.strokeStyle = PALETTE.labelBorder;
  context.lineWidth = 5;
  context.fillRect(4, 4, canvas.width - 8, canvas.height - 8);
  context.strokeRect(4, 4, canvas.width - 8, canvas.height - 8);
  context.fillStyle = PALETTE.label;
  context.font = '600 54px "Rajdhani Local", sans-serif';
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillText(text, canvas.width / 2, canvas.height / 2 + 2);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.minFilter = THREE.LinearFilter;
  const material = new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: true });
  const sprite = new THREE.Sprite(material);
  const width = Math.max(
    SCENE.labelMinimumWidthMetres,
    text.length * SCENE.labelWidthPerCharacterMetres
  );
  sprite.scale.set(width, SCENE.labelHeightMetres, 1);
  sprite.userData.disposeLabel = () => {
    texture.dispose();
    material.dispose();
  };
  return sprite;
};

const addLabel = (group, text, position) => {
  const label = makeLabel(text);
  label.position.set(position.x, position.y, position.z);
  group.add(label);
};

export const getCourseRegionLabels = (course) => {
  const regions = [
    { id: course.start.id, label: "Named start / reset" },
    { id: course.floor.id, label: "Flat ground" },
    ...course.ramps.map((ramp, index) => ({
      id: ramp.id,
      label: `R${index + 1} · ${ramp.degrees}° ramp · ${ramp.degrees > 35 ? "blocked" : ramp.degrees === 35 ? "slope limit" : "walkable"}`
    })),
    ...course.stairs.map((stairs, index) => ({
      id: stairs.id,
      label: `S${index + 1} · ${stairs.stepRise.toFixed(2)} m × ${stairs.stepCount} · ${stairs.id === "stairs-blocked" ? "blocked" : "passable"}`
    })),
    { id: course.tunnel.id, label: `Crouch tunnel · ${course.tunnel.ceilingY.toFixed(2)} m clearance` },
    { id: course.narrowPlatform.id, label: `Narrow platform · ${(course.narrowPlatform.maxX - course.narrowPlatform.minX).toFixed(2)} m wide` },
    { id: course.slipperyPatch.id, label: `Slippery patch · traction ${course.slipperyPatch.traction.toFixed(2)}` },
    { id: course.unevenRock.id, label: "Uneven rock surface · analytic" }
  ];
  return regions.map((region, index) => ({
    ...region,
    label: `${String(index + 1).padStart(2, "0")} · ${region.label}`
  }));
};

const buildCourse = (course) => {
  const group = new THREE.Group();
  group.name = course.id;

  const world = course.floor.bounds;
  const floorWidth = world.maxX - world.minX;
  const floorDepth = world.maxZ - world.minZ;
  const floor = makeBox(
    floorWidth,
    SCENE.floorThicknessMetres,
    floorDepth,
    makeMaterial(PALETTE.floor),
    {
      x: (world.minX + world.maxX) / 2,
      y: course.floor.height - SCENE.floorThicknessMetres / 2,
      z: (world.minZ + world.maxZ) / 2
    }
  );
  floor.name = course.floor.id;
  group.add(floor);

  const boundaryPoints = [
    new THREE.Vector3(world.minX, course.floor.height + SCENE.surfaceOverlayOffsetMetres, world.minZ),
    new THREE.Vector3(world.maxX, course.floor.height + SCENE.surfaceOverlayOffsetMetres, world.minZ),
    new THREE.Vector3(world.maxX, course.floor.height + SCENE.surfaceOverlayOffsetMetres, world.maxZ),
    new THREE.Vector3(world.minX, course.floor.height + SCENE.surfaceOverlayOffsetMetres, world.maxZ)
  ];
  const boundary = new THREE.LineLoop(
    new THREE.BufferGeometry().setFromPoints(boundaryPoints),
    new THREE.LineBasicMaterial({ color: PALETTE.floorLine })
  );
  group.add(boundary);

  addLabel(group, "02 · FLAT GROUND", {
    x: world.minX + 4,
    y: course.floor.height + SCENE.labelVerticalOffsetMetres,
    z: world.minZ + 2
  });

  for (const [rampIndex, ramp] of course.ramps.entries()) {
    const width = ramp.bounds.maxX - ramp.bounds.minX;
    const depth = ramp.bounds.maxZ - ramp.bounds.minZ;
    const rise = Math.tan(degreesToRadians(ramp.degrees)) * depth;
    const material = makeMaterial(ramp.degrees > 35 ? PALETTE.blocked : PALETTE.ramp, { side: THREE.DoubleSide });
    const mesh = new THREE.Mesh(createRampGeometry(width, depth, rise), material);
    mesh.name = ramp.id;
    mesh.position.set(
      (ramp.bounds.minX + ramp.bounds.maxX) / 2,
      ramp.baseY,
      (ramp.bounds.minZ + ramp.bounds.maxZ) / 2
    );
    mesh.receiveShadow = true;
    mesh.castShadow = true;
    group.add(mesh);
    const rampCue = ramp.degrees > 35 ? "BLOCKED" : ramp.degrees === 35 ? "LIMIT" : "WALKABLE";
    addLabel(group, `R${rampIndex + 1} · ${ramp.degrees}° · ${rampCue}`, {
      x: mesh.position.x,
      y: ramp.baseY + rise + SCENE.labelVerticalOffsetMetres,
      z: ramp.bounds.maxZ - 0.25
    });
  }

  for (const [stairsIndex, stairs] of course.stairs.entries()) {
    const width = stairs.maxX - stairs.minX;
    for (let index = 0; index < stairs.stepCount; index += 1) {
      const height = stairs.stepRise * (index + 1);
      const step = makeBox(
        width,
        height,
        stairs.stepDepth,
        makeMaterial(stairs.id === "stairs-blocked" ? PALETTE.blocked : PALETTE.stairs),
        {
          x: (stairs.minX + stairs.maxX) / 2,
          y: height / 2,
          z: stairs.minZ + stairs.stepDepth * (index + 0.5)
        }
      );
      step.name = `${stairs.id}-visual-step-${index + 1}`;
      group.add(step);
    }
    const stairCue = stairs.id === "stairs-blocked" ? "BLOCKED" : "PASSABLE";
    addLabel(group, `S${stairsIndex + 1} · ${stairs.stepRise.toFixed(2)} M × ${stairs.stepCount} · ${stairCue}`, {
      x: (stairs.minX + stairs.maxX) / 2,
      y: stairs.stepRise * stairs.stepCount + SCENE.labelVerticalOffsetMetres,
      z: stairs.maxZ
    });
  }

  const tunnel = course.tunnel;
  const tunnelCeiling = makeBox(
    tunnel.maxX - tunnel.minX,
    tunnel.ceilingThickness,
    tunnel.maxZ - tunnel.minZ,
    makeMaterial(PALETTE.tunnel, { side: THREE.DoubleSide }),
    {
      x: (tunnel.minX + tunnel.maxX) / 2,
      y: tunnel.ceilingY + tunnel.ceilingThickness / 2,
      z: (tunnel.minZ + tunnel.maxZ) / 2
    }
  );
  tunnelCeiling.name = tunnel.id;
  group.add(tunnelCeiling);
  addLabel(group, `C10 · CROUCH · ${tunnel.ceilingY.toFixed(2)} M`, {
    x: tunnelCeiling.position.x,
    y: tunnel.ceilingY + tunnel.ceilingThickness + SCENE.labelVerticalOffsetMetres,
    z: tunnel.minZ + 1
  });

  const platform = course.narrowPlatform;
  const platformMesh = makeBox(
    platform.maxX - platform.minX,
    platform.topY,
    platform.maxZ - platform.minZ,
    makeMaterial(PALETTE.platform),
    {
      x: (platform.minX + platform.maxX) / 2,
      y: platform.topY / 2,
      z: (platform.minZ + platform.maxZ) / 2
    }
  );
  platformMesh.name = platform.id;
  group.add(platformMesh);
  addLabel(group, `C11 · NARROW · ${(platform.maxX - platform.minX).toFixed(2)} M`, {
    x: platformMesh.position.x,
    y: platform.topY + SCENE.labelVerticalOffsetMetres,
    z: platform.minZ + 1
  });

  const slippery = course.slipperyPatch;
  const slipperyMesh = makeBox(
    slippery.maxX - slippery.minX,
    SCENE.surfaceOverlayOffsetMetres,
    slippery.maxZ - slippery.minZ,
    makeMaterial(PALETTE.slippery, { roughness: 0.32 }),
    {
      x: (slippery.minX + slippery.maxX) / 2,
      y: slippery.height + SCENE.surfaceOverlayOffsetMetres / 2,
      z: (slippery.minZ + slippery.maxZ) / 2
    }
  );
  slipperyMesh.name = slippery.id;
  group.add(slipperyMesh);
  addLabel(group, `C12 · SLIPPERY · ${slippery.traction.toFixed(2)} TRACTION`, {
    x: slipperyMesh.position.x,
    y: slippery.height + SCENE.labelVerticalOffsetMetres,
    z: slippery.minZ + 1
  });

  const uneven = course.unevenRock;
  const unevenMesh = new THREE.Mesh(createUnevenGeometry(uneven), makeMaterial(PALETTE.uneven, { side: THREE.DoubleSide }));
  unevenMesh.name = uneven.id;
  unevenMesh.receiveShadow = true;
  unevenMesh.castShadow = true;
  group.add(unevenMesh);
  addLabel(group, "C13 · UNEVEN · ANALYTIC", {
    x: (uneven.minX + uneven.maxX) / 2,
    y: uneven.baseHeight + SCENE.labelVerticalOffsetMetres,
    z: uneven.minZ + 1
  });

  const startGeometry = new THREE.RingGeometry(
    SCENE.startMarkerRadiusMetres * 0.72,
    SCENE.startMarkerRadiusMetres,
    32
  );
  const startMaterial = new THREE.MeshBasicMaterial({ color: PALETTE.start, side: THREE.DoubleSide });
  const startMarker = new THREE.Mesh(startGeometry, startMaterial);
  startMarker.name = course.start.id;
  startMarker.rotation.x = -Math.PI / 2;
  startMarker.position.set(
    course.start.x,
    course.start.y + SCENE.surfaceOverlayOffsetMetres * 2,
    course.start.z
  );
  group.add(startMarker);

  const direction = new THREE.ArrowHelper(
    new THREE.Vector3(Math.sin(course.start.yawRadians), 0, Math.cos(course.start.yawRadians)),
    new THREE.Vector3(course.start.x, course.start.y + SCENE.surfaceOverlayOffsetMetres * 3, course.start.z),
    SCENE.startDirectionLengthMetres,
    PALETTE.start
  );
  group.add(direction);
  addLabel(group, "01 · NAMED START / RESET", {
    x: course.start.x,
    y: course.start.y + SCENE.labelVerticalOffsetMetres,
    z: course.start.z - 0.8
  });

  return group;
};

export const createProvingGroundScene = ({ canvas, courseDescriptors }) => {
  if (!(canvas instanceof HTMLCanvasElement)) throw new TypeError("A canvas element is required.");

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, SCENE.maxPixelRatio));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(PALETTE.background);
  scene.fog = new THREE.Fog(PALETTE.background, 58, CAMERA.farClipMetres);

  const camera = new THREE.PerspectiveCamera(
    CAMERA.baseFovDegrees,
    1,
    CAMERA.nearClipMetres,
    CAMERA.farClipMetres
  );
  camera.rotation.order = "YXZ";

  const hemisphere = new THREE.HemisphereLight(0xe2ded2, 0x242725, SCENE.hemisphereLightIntensity);
  scene.add(hemisphere);
  const directional = new THREE.DirectionalLight(0xffe9cf, SCENE.directionalLightIntensity);
  directional.position.set(-10, 24, -8);
  directional.castShadow = true;
  directional.shadow.mapSize.set(2048, 2048);
  directional.shadow.camera.left = -24;
  directional.shadow.camera.right = 24;
  directional.shadow.camera.top = 36;
  directional.shadow.camera.bottom = -16;
  directional.shadow.camera.near = 1;
  directional.shadow.camera.far = 80;
  scene.add(directional);

  const courseGroup = buildCourse(courseDescriptors);
  scene.add(courseGroup);

  const supportMarker = new THREE.Mesh(
    new THREE.RingGeometry(
      SCENE.supportMarkerRadiusMetres * 0.7,
      SCENE.supportMarkerRadiusMetres,
      24
    ),
    new THREE.MeshBasicMaterial({ color: PALETTE.start, side: THREE.DoubleSide, depthTest: false })
  );
  supportMarker.rotation.x = -Math.PI / 2;
  supportMarker.renderOrder = 20;
  scene.add(supportMarker);

  let yawRadians = courseDescriptors.start.yawRadians;
  let pitchRadians = degreesToRadians(CAMERA.initialPitchDegrees);
  let currentFov = CAMERA.baseFovDegrees;
  let currentBobOffset = 0;

  const resize = () => {
    const width = Math.max(1, canvas.clientWidth);
    const height = Math.max(1, canvas.clientHeight);
    const pixelRatio = renderer.getPixelRatio();
    const expectedWidth = Math.floor(width * pixelRatio);
    const expectedHeight = Math.floor(height * pixelRatio);
    if (canvas.width !== expectedWidth || canvas.height !== expectedHeight) {
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
    }
  };

  const resizeObserver = typeof ResizeObserver === "function" ? new ResizeObserver(resize) : null;
  resizeObserver?.observe(canvas);
  window.addEventListener("resize", resize);
  resize();

  const applyLookDelta = (movementX, movementY) => {
    yawRadians -= Number.isFinite(movementX) ? movementX * CAMERA.mouseSensitivityRadiansPerPixel : 0;
    pitchRadians -= Number.isFinite(movementY) ? movementY * CAMERA.mouseSensitivityRadiansPerPixel : 0;
    const pitchLimit = degreesToRadians(CAMERA.pitchLimitDegrees);
    pitchRadians = clamp(pitchRadians, -pitchLimit, pitchLimit);
  };

  const resetCamera = () => {
    yawRadians = courseDescriptors.start.yawRadians;
    pitchRadians = degreesToRadians(CAMERA.initialPitchDegrees);
    currentFov = CAMERA.baseFovDegrees;
    currentBobOffset = 0;
  };

  const render = ({
    telemetry,
    locomotionParameters,
    frameDeltaSeconds,
    headBobEnabled,
    fovKickEnabled,
    reducedMotion
  }) => {
    resize();
    const speedReference = Math.max(0.001, locomotionParameters.sprintSpeed);
    const speedRatio = clamp(telemetry.horizontalSpeed / speedReference, 0, 1);
    const bobAllowed = headBobEnabled && !reducedMotion && telemetry.grounded && speedRatio > 0.01;
    const bobPhase = telemetry.timeSeconds * Math.PI * 2 * CAMERA.bobFrequencyHzAtFullSpeed * speedRatio;
    currentBobOffset = bobAllowed ? Math.sin(bobPhase) * CAMERA.bobAmplitudeMetres * speedRatio : 0;
    const lateralBob = bobAllowed
      ? Math.cos(bobPhase * 0.5) * CAMERA.bobAmplitudeMetres * CAMERA.bobHorizontalRatio * speedRatio
      : 0;

    const eyeHeightRatio = telemetry.crouched
      ? CAMERA.crouchedEyeHeightRatio
      : CAMERA.standingEyeHeightRatio;
    const eyeY = telemetry.position.y + telemetry.bounds.height * eyeHeightRatio + currentBobOffset;
    const rightX = Math.cos(yawRadians);
    const rightZ = -Math.sin(yawRadians);
    camera.position.set(
      telemetry.position.x + rightX * lateralBob,
      eyeY,
      telemetry.position.z + rightZ * lateralBob
    );
    camera.rotation.set(pitchRadians, yawRadians, 0, "YXZ");

    const targetFov = CAMERA.baseFovDegrees
      + (fovKickEnabled && !reducedMotion ? CAMERA.fovKickMaximumDegrees * speedRatio : 0);
    const response = 1 - Math.exp(-CAMERA.fovResponsePerSecond * Math.max(0, frameDeltaSeconds));
    currentFov += (targetFov - currentFov) * response;
    if (Math.abs(camera.fov - currentFov) > 0.0001) {
      camera.fov = currentFov;
      camera.updateProjectionMatrix();
    }

    supportMarker.position.set(
      telemetry.position.x,
      telemetry.position.y + SCENE.surfaceOverlayOffsetMetres * 2,
      telemetry.position.z
    );
    renderer.render(scene, camera);
  };

  const getCameraState = () => ({
    mode: "First-person",
    yawDegrees: yawRadians * 180 / Math.PI,
    pitchDegrees: pitchRadians * 180 / Math.PI,
    fovDegrees: currentFov,
    bobOffsetMetres: currentBobOffset,
    fixtureNotice: PRESENTATION_UX_FIXTURE_NOTICE
  });

  const dispose = () => {
    resizeObserver?.disconnect();
    window.removeEventListener("resize", resize);
    courseGroup.traverse((object) => {
      object.userData.disposeLabel?.();
      object.geometry?.dispose?.();
      if (Array.isArray(object.material)) object.material.forEach((material) => material.dispose());
      else object.material?.dispose?.();
    });
    supportMarker.geometry.dispose();
    supportMarker.material.dispose();
    renderer.dispose();
  };

  return Object.freeze({
    render,
    applyLookDelta,
    resetCamera,
    getCameraState,
    dispose
  });
};
