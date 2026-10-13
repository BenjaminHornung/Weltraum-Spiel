import {
  createDiagnosticTimer
} from "./chunk-5PVRE5K7.mjs";
import {
  disposeOwned
} from "./chunk-KCZT4FE2.mjs";
import {
  buildLut,
  createHistory,
  density,
  skyProfile,
  validateFrame
} from "./chunk-6PZDKU43.mjs";
import {
  createDepthCameraPort
} from "./chunk-3YI7YEKF.mjs";

// src/composer.ts
import * as T from "three";

// shaders/volume.frag.glsl
var volume_frag_default = "precision highp float;\nprecision highp sampler3D;\nin vec2 vUv;\nuniform sampler2D opaqueColor,opaqueDepth,waterColor,waterDepth,skyLut;\nuniform sampler3D cloudAtlas;\nuniform mat4 inverseProjection,cameraWorld;\nuniform vec3 originOffset,sunDirection;\nuniform float radiusMeters,skyHeight,skyScaleHeight,rayleighPerM,miePerM,cloudCoverage,fogPerM,lightning,farLimit,waterOpacity;\nuniform int steps,skyMode,defect;\nout vec4 result;\nvec3 point(float z){vec4 p=inverseProjection*vec4(vUv*2.0-1.0,z*2.0-1.0,1.0);p/=p.w;return (cameraWorld*p).xyz+originOffset;}\nfloat opticalDensity(vec3 p){\n vec3 uv=(p-vec3(-80.0,8.0,-80.0))/vec3(160.0,24.0,160.0);\n float cloud=all(greaterThanEqual(uv,vec3(0.0)))&&all(lessThanEqual(uv,vec3(1.0)))?texture(cloudAtlas,uv).r*cloudCoverage:0.0;\n float fog=p.y>=0.0&&p.y<=8.0?fogPerM*exp(-p.y/5.0):0.0;\n return defect==1?0.0:cloud+fog;\n}\nbool clipSlab(float o,float d,float lo,float hi,inout float a,inout float b){\n if(d==0.0)return o>=lo&&o<=hi;\n float x=(lo-o)/d,y=(hi-o)/d;\n a=max(a,min(x,y));b=min(b,max(x,y));\n return b>a;\n}\nvec4 march(vec3 o,vec3 d,float a,float b){\n if(!clipSlab(o.x,d.x,-80.0,80.0,a,b)||!clipSlab(o.y,d.y,0.0,32.0,a,b)||!clipSlab(o.z,d.z,-80.0,80.0,a,b))return vec4(0.0,0.0,0.0,1.0);\n if(b<=a)return vec4(0.0,0.0,0.0,1.0);\n vec3 L=vec3(0.0);float T=1.0,ds=max(0.0,b-a)/float(steps);\n for(int i=0;i<96;i++){if(i>=steps)break;vec3 p=o+d*(a+(float(i)+0.5)*ds);float sigma=opticalDensity(p);\n  float t=exp(-sigma*ds);\n  // One bounded sun optical-depth integral per voxel is baked into alpha of the immutable atlas.\n  vec3 uv=(p-vec3(-80.0,8.0,-80.0))/vec3(160.0,24.0,160.0);\n  float shadow=all(greaterThanEqual(uv,vec3(0.0)))&&all(lessThanEqual(uv,vec3(1.0)))?texture(cloudAtlas,uv).g:1.0;\n  vec3 source=vec3(0.32,0.43,0.48)*(0.3+0.7*shadow)+vec3(lightning);\n  L+=T*source*(1.0-t);T*=t;\n }\n return vec4(L,T);\n}\nvec3 sky(vec3 o,vec3 d){\n vec3 bodyOrigin=o+vec3(0.0,radiusMeters,0.0);\n float radialDistance=length(bodyOrigin),altitude=max(0.0,radialDistance-radiusMeters),mu=dot(d,normalize(bodyOrigin)),day=smoothstep(-0.08,0.08,sunDirection.y);\n float b=dot(bodyOrigin,d),disc=b*b+(radiusMeters+skyHeight)*(radiusMeters+skyHeight)-dot(bodyOrigin,bodyOrigin);\n if(disc<=0.0)return vec3(0.006,0.008,0.014);\n float start=max(0.0,-b-sqrt(disc)),end=max(0.0,-b+sqrt(disc));\n float groundDisc=b*b+radiusMeters*radiusMeters-dot(bodyOrigin,bodyOrigin);\n if(groundDisc>=0.0){float groundEnter=-b-sqrt(groundDisc);if(groundEnter>=start)end=min(end,groundEnter);}\n float opticalDepth=0.0,ds=(end-start)/32.0;\n for(int i=0;i<32;i++){float s=start+(float(i)+0.5)*ds,h=sqrt((radiusMeters+altitude)*(radiusMeters+altitude)+s*s+2.0*(radiusMeters+altitude)*mu*s)-radiusMeters;opticalDepth+=(rayleighPerM+miePerM)*exp(-max(h,0.0)/skyScaleHeight)*ds;}\n float T=exp(-opticalDepth);\n if(skyMode==1&&rayleighPerM+miePerM>0.0&&mu>=0.0&&altitude<=skyHeight){vec2 size=vec2(textureSize(skyLut,0));T=texture(skyLut,(vec2(mu,altitude/skyHeight)*(size-1.0)+0.5)/size).r;}\n float cosine=dot(d,sunDirection),phase=0.75*(1.0+cosine*cosine);\n return vec3(0.006,0.008,0.014)*T+day*vec3(0.35,0.48,0.65)*phase*(1.0-T)+day*vec3(8.0)*smoothstep(0.9998,1.0,cosine)*T;\n}\nvoid main(){\n vec3 o=cameraWorld[3].xyz+originOffset,d=normalize(point(1.0)-o);\n float raw=texture(opaqueDepth,vUv).r,wd=texture(waterDepth,vUv).r;\n float distance=raw<1.0?min(length(point(raw)-o),farLimit):farLimit;\n vec3 background=raw<1.0?texture(opaqueColor,vUv).rgb:sky(o,d);\n if(skyMode==2)background=texture(opaqueColor,vUv).rgb;\n bool hasWater=wd<1.0;float wDistance=hasWater?length(point(wd)-o):distance;\n hasWater=hasWater&&wDistance<distance;\n float split=hasWater?wDistance:distance;\n if(defect==2)split=hasWater?max(0.0,distance-wDistance):distance;\n vec4 front=march(o,d,0.0,split),back=march(o,d,split,distance);\n vec3 behind=back.rgb+back.a*background;\n vec4 water=texture(waterColor,vUv);\n vec3 middle=hasWater?water.rgb+(1.0-water.a)*behind:behind;\n vec3 color=front.rgb+front.a*middle;\n if(defect==3)color=march(o,d,0.0,distance).rgb+march(o,d,0.0,distance).a*color;\n result=vec4(color,1.0);\n}\n";

// shaders/fullscreen.vert.glsl
var fullscreen_vert_default = "out vec2 vUv;\nvoid main(){vUv=uv;gl_Position=vec4(position.xy,0.0,1.0);}\n";

// shaders/output.frag.glsl
var output_frag_default = "uniform sampler2D colorBuffer;\nin vec2 vUv;\nout vec4 result;\nvoid main(){\n vec3 x=texture(colorBuffer,vUv).rgb;\n // One display transform; all preceding targets are linear HDR.\n x=clamp((x*(2.51*x+0.03))/(x*(2.43*x+0.59)+0.14),0.0,1.0);\n result=vec4(mix(12.92*x,1.055*pow(x,vec3(1.0/2.4))-0.055,step(vec3(0.0031308),x)),1.0);\n}\n";

// src/composer.ts
function createVolumePort(renderer, scene, camera, water, initial) {
  let frame = validateFrame(initial), disposed = false, lost = false, epoch = 1, lightningId = null, mode = 0, defect = 0;
  const savedFog = scene.fog, owned = [() => {
    scene.fog = savedFog;
  }];
  scene.fog = null;
  const own = (value) => {
    owned.push(() => value.dispose());
    return value;
  };
  try {
    let active2 = function() {
      if (disposed) throw Error("VOLUME_DISPOSED");
    };
    var active = active2;
    const context = renderer.getContext?.() ?? null;
    let timer = createDiagnosticTimer(context && "beginQuery" in context ? context : null), uploaded = false;
    owned.push(() => timer.dispose());
    const history = own(createHistory()), targets = [];
    const make = (depth = true) => {
      const target = own(new T.WebGLRenderTarget(1, 1, { type: T.HalfFloatType, format: T.RGBAFormat, depthBuffer: depth }));
      if (depth) target.depthTexture = new T.DepthTexture(1, 1, T.UnsignedIntType);
      targets.push(target);
      return target;
    };
    const opaque = make(), waterColor = make(), waterDepth = make(), hdr = make(false);
    const waterScene = new T.Scene(), waterCopy = water.clone(true);
    owned.push(() => waterScene.clear());
    waterScene.add(waterCopy);
    scene.traverse((o) => {
      if (o.isLight) waterScene.add(o.clone());
    });
    const depthMaterial = own(new T.MeshDepthMaterial({ side: T.DoubleSide }));
    depthMaterial.colorWrite = false;
    const fullScene = new T.Scene(), fullCamera = new T.Camera(), geometry = own(new T.PlaneGeometry(2, 2));
    owned.push(() => fullScene.clear());
    const lut = buildLut(skyProfile(frame), 32, 64);
    const skyMap = own(new T.DataTexture(lut.values, lut.width, lut.rows, T.RedFormat, T.FloatType));
    skyMap.minFilter = skyMap.magFilter = T.LinearFilter;
    skyMap.needsUpdate = true;
    const n = 32, atlasData = new Float32Array(n * n * n * 2);
    for (let z = 0; z < n; z++) for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
      const p = [-80 + 160 * (x + 0.5) / n, 8 + 24 * (y + 0.5) / n, -80 + 160 * (z + 0.5) / n], i = ((z * n + y) * n + x) * 2;
      atlasData[i] = density(p, 1);
      let depth = 0;
      for (let s = 0; s < 16; s++) depth += density([p[0] - 0.4 * s * 3, p[1] + 0.8 * s * 3, p[2] - 0.4472135955 * s * 3], 1) * 3;
      atlasData[i + 1] = Math.exp(-depth);
    }
    const atlas = own(new T.Data3DTexture(atlasData, n, n, n));
    atlas.format = T.RGFormat;
    atlas.type = T.FloatType;
    atlas.minFilter = atlas.magFilter = T.LinearFilter;
    atlas.needsUpdate = true;
    const uniforms = {
      opaqueColor: { value: opaque.texture },
      opaqueDepth: { value: opaque.depthTexture },
      waterColor: { value: waterColor.texture },
      waterDepth: { value: waterDepth.depthTexture },
      cloudAtlas: { value: atlas },
      skyLut: { value: skyMap },
      inverseProjection: { value: camera.projectionMatrixInverse },
      cameraWorld: { value: camera.matrixWorld },
      originOffset: { value: new T.Vector3(...frame.originMeters) },
      sunDirection: { value: new T.Vector3(-0.4, 0.8, -0.4472135955) },
      radiusMeters: { value: frame.bodyRadiusMeters },
      skyHeight: { value: 6e4 },
      skyScaleHeight: { value: 8e3 },
      rayleighPerM: { value: 1e-5 },
      miePerM: { value: frame.weatherExtinctionPerM },
      cloudCoverage: { value: frame.authoredCloudCoverage },
      fogPerM: { value: frame.status === "Known" ? 0.025 : 0 },
      lightning: { value: 0 },
      farLimit: { value: 5e5 },
      waterOpacity: { value: 0.56 },
      steps: { value: 64 },
      skyMode: { value: 0 },
      defect: { value: 0 }
    };
    const rainCoverage = { value: frame.authoredCloudCoverage };
    const material = own(new T.ShaderMaterial({ glslVersion: T.GLSL3, vertexShader: fullscreen_vert_default, fragmentShader: volume_frag_default, uniforms, depthTest: false, depthWrite: false, toneMapped: false }));
    const output = own(new T.ShaderMaterial({ glslVersion: T.GLSL3, vertexShader: fullscreen_vert_default, fragmentShader: output_frag_default, uniforms: { colorBuffer: { value: hdr.texture } }, depthTest: false, depthWrite: false, toneMapped: false }));
    const quad = new T.Mesh(geometry, material);
    quad.frustumCulled = false;
    fullScene.add(quad);
    const onLost = (e) => {
      e.preventDefault();
      lost = true;
      uploaded = false;
      try {
        timer.dispose();
      } finally {
        history.contextLost();
      }
    };
    const onRestored = () => {
      const nextTimer = createDiagnosticTimer(context && "beginQuery" in context ? context : null);
      timer = nextTimer;
      epoch++;
      uploaded = false;
      atlas.needsUpdate = true;
      skyMap.needsUpdate = true;
      history.contextLost();
      lost = false;
    };
    renderer.domElement.addEventListener("webglcontextlost", onLost);
    owned.push(() => renderer.domElement.removeEventListener("webglcontextlost", onLost));
    renderer.domElement.addEventListener("webglcontextrestored", onRestored);
    owned.push(() => renderer.domElement.removeEventListener("webglcontextrestored", onRestored));
    return {
      setFrame(input) {
        active2();
        const next = validateFrame(input);
        if (next.atlasEpoch !== frame.atlasEpoch) throw Error("STALE_ATLAS");
        if (next.bodyId !== frame.bodyId || next.bodyRadiusMeters !== frame.bodyRadiusMeters || next.opticsDigest !== frame.opticsDigest || JSON.stringify(next.bodyNormal) !== JSON.stringify(frame.bodyNormal)) throw Error("REBUILD_OPTICS_REQUIRED");
        if (skyProfile(next).sigma !== skyProfile(frame).sigma) {
          skyMap.image.data = buildLut(skyProfile(next), 32, 64).values;
          skyMap.needsUpdate = true;
          uploaded = false;
        }
        frame = next;
      },
      setMode(sky, wrong = 0) {
        active2();
        if (![0, 1, 2, 3].includes(sky) || ![0, 1, 2, 3].includes(wrong)) throw Error("MODE");
        mode = sky;
        defect = wrong;
      },
      lightning(id) {
        active2();
        if (id !== null && (typeof id !== "string" || !id)) throw Error("LIGHTNING");
        lightningId = id;
      },
      resize(w, h) {
        active2();
        if (!Number.isSafeInteger(w) || !Number.isSafeInteger(h) || w <= 0 || h <= 0) throw Error("VOLUME_SIZE");
        for (const target of targets) target.setSize(w, h);
        epoch++;
      },
      render(takram, overlay) {
        active2();
        if (lost) return { status: "CONTEXT_LOST" };
        camera.updateMatrixWorld();
        const binding = frame.binding;
        const state = history.set({
          weather: frame.weatherSnapshotId,
          profile: binding.profile?.digest ?? "bound",
          macro: binding.macroGeography?.digest ?? "NONE",
          model: binding.model?.digest ?? "bound",
          optics: frame.opticsDigest,
          source: frame.sourceRevision,
          atlas: frame.atlasEpoch,
          epoch,
          origin: frame.originMeters,
          height: camera.position.y + frame.originMeters[1],
          lightning: lightningId
        });
        history.acceptAtlas(frame.atlasEpoch);
        const borrowed = createDepthCameraPort(camera, opaque.depthTexture, epoch, { weatherSnapshotId: frame.weatherSnapshotId, ...frame.binding });
        if (borrowed.epoch !== epoch) throw Error("BORROWED_EPOCH");
        const target = renderer.getRenderTarget(), clear = renderer.getClearColor(new T.Color()), alpha = renderer.getClearAlpha(), oldBackground = scene.background, autoClear = renderer.autoClear, waterVisible = water.visible;
        try {
          if (!uploaded) {
            timer.measure("atlas-and-lut-upload", () => {
              renderer.initTexture(atlas);
              renderer.initTexture(skyMap);
            });
            uploaded = true;
          }
          renderer.setClearColor(0, 0);
          water.visible = false;
          scene.background = null;
          timer.measure("opaque-hdr", () => {
            renderer.setRenderTarget(opaque);
            renderer.clear();
            renderer.render(scene, camera);
          });
          uniforms.opaqueColor.value = takram ? timer.measure("takram-cloud-aerial", takram) : opaque.texture;
          water.getWorldPosition(waterCopy.position);
          water.getWorldQuaternion(waterCopy.quaternion);
          water.getWorldScale(waterCopy.scale);
          waterCopy.updateMatrixWorld();
          timer.measure("water-color", () => {
            renderer.setRenderTarget(waterColor);
            renderer.clear();
            renderer.render(waterScene, camera);
          });
          timer.measure("water-depth", () => {
            waterScene.overrideMaterial = depthMaterial;
            renderer.setRenderTarget(waterDepth);
            renderer.clear();
            renderer.render(waterScene, camera);
            waterScene.overrideMaterial = null;
          });
          uniforms.originOffset.value.set(...frame.originMeters);
          uniforms.lightning.value = frame.status === "Known" && lightningId !== null ? 2 : 0;
          uniforms.skyMode.value = takram ? 2 : mode;
          uniforms.cloudCoverage.value = takram || mode === 3 || frame.status === "NoAtmosphere" ? 0 : frame.authoredCloudCoverage;
          rainCoverage.value = frame.status === "NoAtmosphere" ? 0 : frame.authoredCloudCoverage;
          uniforms.fogPerM.value = mode === 3 || frame.status === "NoAtmosphere" ? 0 : 0.025;
          uniforms.miePerM.value = frame.weatherExtinctionPerM;
          uniforms.rayleighPerM.value = frame.status === "NoAtmosphere" ? 0 : 1e-5;
          uniforms.steps.value = mode === 3 ? 16 : 64;
          uniforms.defect.value = defect;
          timer.measure("volumes-water-composite", () => {
            quad.material = material;
            renderer.setRenderTarget(hdr);
            renderer.clear();
            renderer.render(fullScene, fullCamera);
          });
          if (overlay) timer.measure("depth-aware-rain", () => {
            renderer.autoClear = false;
            renderer.render(overlay, camera);
            renderer.autoClear = true;
          });
          timer.measure("tone-map-output", () => {
            quad.material = output;
            renderer.setRenderTarget(target);
            renderer.render(fullScene, fullCamera);
          });
          timer.poll();
          return { status: "RENDERED", history: state, epoch, weatherSnapshotId: frame.weatherSnapshotId, stormIds: frame.stormIds };
        } finally {
          water.visible = waterVisible;
          scene.background = oldBackground;
          renderer.autoClear = autoClear;
          renderer.setClearColor(clear, alpha);
          renderer.setRenderTarget(target);
          waterScene.overrideMaterial = null;
        }
      },
      rainUniforms: { uOpaqueDepth: { value: opaque.depthTexture }, uWaterDepth: { value: waterDepth.depthTexture }, uAtlas: { value: atlas }, uInvProjection: { value: camera.projectionMatrixInverse }, uCameraWorld: { value: camera.matrixWorld }, uViewport: { value: new T.Vector2() }, uCloudCoverage: rainCoverage, uFog: uniforms.fogPerM, uOrigin: uniforms.originOffset },
      diagnostics() {
        return { ownedTargets: disposed ? 0 : targets.length, disposed, lost, epoch, lightningId, atlasUploadPending: !uploaded, actualAdapter: null, gpuTimer: timer.read(), borrowedDepth: "NOT_DISPOSED", historyResources: history.resources, historyResourcesKind: "LOGICAL_METADATA_ONLY_NO_TEMPORAL_BUFFERS", temporalAccumulation: "DISABLED_REACTIVE_VALIDATION_ONLY" };
      },
      dispose() {
        if (disposed) return;
        disposed = true;
        disposeOwned(owned);
      }
    };
  } catch (error) {
    disposed = true;
    try {
      disposeOwned(owned);
    } catch (cleanup) {
      throw new AggregateError([error, cleanup], "VOLUME_INIT_AND_CLEANUP_FAILED", { cause: error });
    }
    throw error;
  }
}
export {
  createVolumePort
};
