import * as THREE from "three";
import type { ThreeRendererPort } from "../../render/three/backend/threeRenderBackend";
import { HVP_SHADOW_REVISION_MAX_BYTES, sameHvpShadowRevision, type HvpShadowAtom, type HvpShadowCasterRevision,
  type HvpShadowRevision } from "./shadowRevision";

/** One sky draw, native tone mapping, one cached 1024² depth map; no fullscreen targets. */
export const HVP_EFFECT_COST = Object.freeze({ triangles: 528, drawCalls: 1, meshBytes: 13568,
  cpuBytes: 16384 + 65536 + 2 * HVP_SHADOW_REVISION_MAX_BYTES });
export const HVP_EFFECT_VERSION = "hvp-surface-light-v1";

export const shadeHvpSurface = (material: THREE.Material, water: boolean): void => {
  // A single flat sheet has no front/back transparency ordering to resolve.
  if (water) { material.forceSinglePass = true; }
  material.customProgramCacheKey = () => `${HVP_EFFECT_VERSION}:${water ? "water" : "opaque"}`;
  material.onBeforeCompile = (shader) => {
    shader.vertexShader = `varying vec3 vHvpWorld;\n${shader.vertexShader}`.replace(
      "#include <worldpos_vertex>", "#include <worldpos_vertex>\nvHvpWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;"
    );
    shader.fragmentShader = `varying vec3 vHvpWorld;\n${shader.fragmentShader}`;
    if (water) {
      // Surface-only stationary ripples: no displaced vertices, collision or invented waves.
      shader.fragmentShader = shader.fragmentShader.replace("#include <normal_fragment_maps>", `
        #include <normal_fragment_maps>
        vec2 p = vHvpWorld.xz;
        vec3 ripple = normalize(vec3(0.09*sin(p.x*3.1+p.y*1.7)+0.035*cos(p.y*8.0),
          1.0, 0.08*cos(p.y*3.7-p.x*1.3)+0.03*sin(p.x*7.0)));
        normal = normalize(mat3(viewMatrix) * ripple);
      `).replace("#include <opaque_fragment>", `
        vec3 sight = normalize(cameraPosition-vHvpWorld);
        float fresnel = pow(1.0-clamp(dot(sight,ripple),0.0,1.0),3.0);
        float glint = pow(max(dot(reflect(-normalize(vec3(-28.0,42.0,-18.0)),ripple),sight),0.0),72.0);
        outgoingLight = mix(outgoingLight,vec3(0.23,0.48,0.72),0.48*fresnel)+vec3(0.75,0.69,0.48)*glint;
        #include <opaque_fragment>
      `);
    } else {
      shader.fragmentShader = shader.fragmentShader.replace("#include <color_fragment>", `
        #include <color_fragment>
        float strata = sin(vHvpWorld.x*1.7+vHvpWorld.y*2.3)*cos(vHvpWorld.z*1.4-vHvpWorld.y);
        diffuseColor.rgb *= 0.96 + 0.055*strata;
      `);
    }
  };
  material.needsUpdate = true;
};

/** HVP-owned presentation adapter around the SAME renderer; ordinary routes are untouched. */
export const createHvpVisualRenderer = (
  canvas: HTMLCanvasElement,
  parameters: THREE.WebGLRendererParameters,
  makeRenderer = (options: THREE.WebGLRendererParameters): THREE.WebGLRenderer => new THREE.WebGLRenderer(options),
  onDispose?: (remaining:Readonly<{geometries:number;textures:number}>)=>void
): ThreeRendererPort => {
  const renderer = makeRenderer({ ...parameters, canvas });
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.shadowMap.autoUpdate = false;
  const seenMaterials = new WeakSet<THREE.Material>();
  const surfaceHooks = new WeakSet<THREE.Material["onBeforeCompile"]>();
  const surfaceKeys = new WeakSet<THREE.Material["customProgramCacheKey"]>();
  let prior: HvpShadowRevision | undefined;
  const unsupported = Symbol("untracked shadow state"), budgetExceeded = Symbol("shadow revision budget");
  // Bake a small tile once instead of evaluating multi-octave cloud noise every pixel/frame.
  const cloudPixels = new Uint8Array(256*256);
  const noise = (x:number,y:number,period:number):number => {
    const ix=Math.floor(x),iy=Math.floor(y);
    const hash=(a:number,b:number):number=>{
      const value=Math.sin((a%period)*127.1+(b%period)*311.7)*43758.5453;
      return value-Math.floor(value);
    };
    const fx=x-ix,fy=y-iy;
    const sx=fx*fx*(3-2*fx),sy=fy*fy*(3-2*fy);
    const lower=THREE.MathUtils.lerp(hash(ix,iy),hash(ix+1,iy),sx);
    const upper=THREE.MathUtils.lerp(hash(ix,iy+1),hash(ix+1,iy+1),sx);
    return THREE.MathUtils.lerp(lower,upper,sy);
  };
  for(let y=0;y<256;y+=1) {
    for(let x=0;x<256;x+=1) {
      cloudPixels[y*256+x]=Math.round(255*(0.6*noise(x/32,y/32,8)+0.28*noise(x/16,y/16,16)+0.12*noise(x/8,y/8,32)));
    }
  }
  const cloudMap=new THREE.DataTexture(cloudPixels,256,256,THREE.RedFormat);
  cloudMap.wrapS=cloudMap.wrapT=THREE.RepeatWrapping;
  cloudMap.magFilter=cloudMap.minFilter=THREE.LinearFilter;
  cloudMap.needsUpdate=true;
  const skyGeometry = new THREE.SphereGeometry(600, 24, 12);
  const skyMaterial = new THREE.ShaderMaterial({ side: THREE.BackSide, depthWrite: false, fog: false, toneMapped: false,uniforms:{cloudMap:{value:cloudMap}},
    vertexShader: "varying vec3 direction; void main(){direction=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}",
    fragmentShader: `varying vec3 direction; uniform sampler2D cloudMap;
      void main(){
        vec3 d=normalize(direction);
        vec3 color=mix(vec3(0.5294118,0.7098039,0.8509804),vec3(0.17,0.46,0.76),smoothstep(0.0,0.8,d.y));
        vec2 p=d.xz/max(0.15,d.y)*3.0;
        float field=texture2D(cloudMap,p*0.065).r;
        float cloud=smoothstep(0.5,0.72,field)*smoothstep(0.05,0.22,d.y);
        gl_FragColor=vec4(mix(color,vec3(0.93,0.96,0.94),cloud*0.82),1.0);
      }` });
  const sky = new THREE.Mesh(skyGeometry, skyMaterial);
  sky.name = "hvp-presentation-sky";
  sky.frustumCulled = false;
  let attachedScene: THREE.Scene | undefined;
  let disposed = false;
  let frame = 0;
  const prepareMaterial = (material:THREE.Material,water:boolean):void => {
    if (!seenMaterials.has(material)) {
      shadeHvpSurface(material,water);
      seenMaterials.add(material);
      surfaceHooks.add(material.onBeforeCompile);
      surfaceKeys.add(material.customProgramCacheKey);
    }
  };
  const captureShadow = (scene: THREE.Scene, camera: THREE.Camera) => {
    // Logical primitive/record payload, not a VM heap estimate. Charge temporary
    // light tuples as well as the final flattened tuple before growing arrays.
    let bytes = 128;
    const charge = (amount: number): void => {
      if (amount > HVP_SHADOW_REVISION_MAX_BYTES - bytes) { throw budgetExceeded; }
      bytes += amount;
    };
    const add = (values: HvpShadowAtom[], ...atoms: HvpShadowAtom[]): void => {
      for (const atom of atoms) {
        if (atom !== null && typeof atom !== "string" && typeof atom !== "number" && typeof atom !== "boolean") { throw unsupported; }
        if (typeof atom === "number" && Number.isNaN(atom)) { throw unsupported; }
        charge(16 + (typeof atom === "string" ? atom.length * 2 : 0));
        values.push(atom);
      }
    };
    const planes = (values: HvpShadowAtom[], entries: readonly THREE.Plane[]): void => {
      add(values, entries.length);
      for (const plane of entries) { add(values, plane.normal.x, plane.normal.y, plane.normal.z, plane.constant); }
    };
    const texture = (values: HvpShadowAtom[], value: THREE.Texture | null): void => {
      if (value === null) { add(values, null); return; }
      if (("isVideoTexture" in value && value.isVideoTexture === true) || value.isRenderTargetTexture) { throw unsupported; }
      add(values, value.uuid, value.version, value.source.uuid, value.source.version, value.channel,
        value.wrapS, value.wrapT, value.minFilter, value.magFilter, value.flipY, value.matrixAutoUpdate);
      if (value.matrixAutoUpdate) {
        add(values, value.offset.x, value.offset.y, value.repeat.x, value.repeat.y, value.center.x, value.center.y, value.rotation);
      } else { add(values, ...value.matrix.elements); }
    };
    const attribute = (values: HvpShadowAtom[], value: THREE.BufferAttribute | THREE.InterleavedBufferAttribute | undefined | null): void => {
      if (value === undefined || value === null) { add(values, null); return; }
      if (!(value instanceof THREE.BufferAttribute) || ("isInstancedBufferAttribute" in value && value.isInstancedBufferAttribute === true)) { throw unsupported; }
      add(values, value.id, value.version, value.itemSize, value.count, value.normalized);
    };
    const light: HvpShadowAtom[] = [];
    add(light, renderer.shadowMap.type, camera.layers.mask, renderer.localClippingEnabled ?? false);
    planes(light, renderer.clippingPlanes ?? []);
    const lights: HvpShadowCasterRevision[] = [], casters: HvpShadowCasterRevision[] = [];
    const ids = new Set<string>();
    const record = (id: string): HvpShadowAtom[] => {
      if (ids.has(id)) { throw unsupported; }
      charge(128 + id.length * 2); ids.add(id); return [];
    };
    if (renderer.shadowMap.type !== THREE.PCFShadowMap || scene.onBeforeRender !== THREE.Object3D.prototype.onBeforeRender) { throw unsupported; }
    scene.traverseVisible(object => {
      if (!object.layers.test(camera.layers)) { return; }
      if (object instanceof THREE.Light && object.castShadow) {
        if (!(object instanceof THREE.DirectionalLight)) { throw unsupported; }
        const values = record(object.uuid), shadow = object.shadow;
        add(values, ...object.matrixWorld.elements, ...object.target.matrixWorld.elements,
          ...shadow.camera.projectionMatrix.elements, shadow.camera.up.x, shadow.camera.up.y, shadow.camera.up.z,
          shadow.camera.layers.mask, shadow.bias, shadow.normalBias, shadow.mapSize.x, shadow.mapSize.y, object.castShadow);
        lights.push({ id: object.uuid, values });
      } else if (object.castShadow && (object instanceof THREE.Mesh || object instanceof THREE.Line || object instanceof THREE.Points)) {
        if (!(object instanceof THREE.Mesh) || ("isSkinnedMesh" in object && object.isSkinnedMesh === true)
          || ("isInstancedMesh" in object && object.isInstancedMesh === true)
          || ("isBatchedMesh" in object && object.isBatchedMesh === true) || object.morphTargetInfluences?.length
          || object.customDepthMaterial !== undefined || object.customDistanceMaterial !== undefined
          || object.onBeforeShadow !== THREE.Object3D.prototype.onBeforeShadow || object.onAfterShadow !== THREE.Object3D.prototype.onAfterShadow) { throw unsupported; }
        const geometry = object.geometry, materials = Array.isArray(object.material) ? object.material : [object.material];
        if (!materials.some(material => material.visible)) { return; }
        if ("isInstancedBufferGeometry" in geometry && geometry.isInstancedBufferGeometry === true) { throw unsupported; }
        for (const name in geometry.morphAttributes) { if (geometry.morphAttributes[name]?.length) { throw unsupported; } }
        const values = record(object.uuid);
        add(values, geometry.uuid);
        for (const name of ["position", "uv", "uv1", "uv2", "uv3"]) { attribute(values, geometry.getAttribute(name)); }
        attribute(values, geometry.index);
        add(values, geometry.drawRange.start, geometry.drawRange.count, geometry.groups.length);
        for (const group of geometry.groups) { add(values, group.start, group.count, group.materialIndex ?? null); }
        add(values, ...object.matrixWorld.elements, object.frustumCulled, materials.length);
        for (const material of materials) {
          if (!(material instanceof THREE.MeshBasicMaterial || material instanceof THREE.MeshLambertMaterial)
            || !surfaceHooks.has(material.onBeforeCompile) || !surfaceKeys.has(material.customProgramCacheKey)) { throw unsupported; }
          add(values, material.uuid, material.version, material.visible, material.side, material.shadowSide, material.wireframe,
            material.wireframeLinewidth, material.alphaTest, material.alphaToCoverage, material.opacity, material.transparent);
          texture(values, material.map); texture(values, material.alphaMap);
          add(values, material.clipShadows, material.clipIntersection);
          planes(values, material.clippingPlanes ?? []);
        }
        casters.push({ id: object.uuid, values });
      }
    });
    const compare = (a: HvpShadowCasterRevision, b: HvpShadowCasterRevision) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
    lights.sort(compare); casters.sort(compare);
    for (const entry of lights) { add(light, entry.id, ...entry.values); }
    return { revision: { light, casters } satisfies HvpShadowRevision, bytes };
  };
  return {
    setPixelRatio: (value) => renderer.setPixelRatio(value),
    setSize: (width,height,updateStyle) => renderer.setSize(width,height,updateStyle),
    render: (scene,camera) => {
      if (disposed) { return; }
      const preparationStarted = performance.now();
      if (attachedScene !== scene) {
        attachedScene?.remove(sky);
        scene.add(sky);
        attachedScene = scene;
      }
      sky.position.copy(camera.position);
      scene.updateMatrixWorld(true);
      frame += 1;
      scene.traverse((object) => {
        if (!(object instanceof THREE.Mesh) || object === sky) { return; }
        const water = object.name === "representation:hvp:water" || object.name.startsWith("representation:hvp:water:");
        // Near object shadows only: the coarse coast keeps baked voxel AO and
        // receives shadows, avoiding self-shadow acne and a second full coast pass.
        const coast = object.name === "representation:hvp:terrain" || object.name.startsWith("representation:hvp:terrain:s") || object.name.startsWith("representation:hvp:neighbor:") || object.name === "representation:hvp:join"
          || object.name === "representation:hvp:far";
        object.castShadow = !water && !coast && !object.name.startsWith("representation:hvp:tool:") && !object.name.startsWith("representation:hvp:salvage:");
        object.receiveShadow = !water;
        if (Array.isArray(object.material)) {
          for (const material of object.material) { prepareMaterial(material,water); }
        } else { prepareMaterial(object.material,water); }
      });
      let next: ReturnType<typeof captureShadow> | undefined;
      let shadowCache: "updated" | "reused" | "unsupported" | "budget-exceeded";
      try { next = captureShadow(scene, camera); shadowCache = prior !== undefined && sameHvpShadowRevision(prior, next.revision) ? "reused" : "updated"; }
      catch (error) { next = undefined; shadowCache = error === budgetExceeded ? "budget-exceeded" : "unsupported"; }
      const changed = shadowCache !== "reused";
      if (changed) { renderer.shadowMap.needsUpdate = true; }
      const shadowUpdated = renderer.shadowMap.needsUpdate;
      const started=performance.now();
      renderer.render(scene,camera);
      // A throwing render does not admit the new cache; an unsupported snapshot
      // is never truncated or retained as if it described the complete depth pass.
      prior = next?.revision;
      if (frame % 60 === 0 && canvas.ownerDocument !== undefined) {
        canvas.ownerDocument.body.dataset.hestiaPrototypeFrameDiagnostics=JSON.stringify({
          scenePreparationMs:started-preparationStarted,renderSubmitMs:performance.now()-started,calls:renderer.info.render.calls,triangles:renderer.info.render.triangles,
          geometries:renderer.info.memory.geometries,textures:renderer.info.memory.textures,shadowUpdated,shadowCache,shadowRevisionBytes:next?.bytes??0,
          shadowMapSize:1024,fullscreenTargets:0
        });
      }
    },
    dispose: () => {
      if (disposed) { return; }
      disposed = true;
      attachedScene?.remove(sky);
      attachedScene = undefined;
      prior = undefined;
      skyGeometry.dispose();
      skyMaterial.dispose();
      cloudMap.dispose();
      renderer.dispose();
      onDispose?.(Object.freeze({...renderer.info.memory}));
    }
  };
};
