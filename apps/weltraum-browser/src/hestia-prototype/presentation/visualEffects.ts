import * as THREE from "three";
import type { ThreeRendererPort } from "../../render/three/backend/threeRenderBackend";

/** One sky draw, native tone mapping, one cached 1024² depth map; no fullscreen targets. */
export const HVP_EFFECT_COST = Object.freeze({ triangles: 528, drawCalls: 1, meshBytes: 13568, cpuBytes: 16384 + 65536 });
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
  const prior = new Map<THREE.Mesh, { geometry: THREE.BufferGeometry; pose: number[]; visible: boolean; frame:number }>();
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
    }
  };
  return {
    setPixelRatio: (value) => renderer.setPixelRatio(value),
    setSize: (width,height,updateStyle) => renderer.setSize(width,height,updateStyle),
    render: (scene,camera) => {
      if (disposed) { return; }
      if (attachedScene !== scene) {
        attachedScene?.remove(sky);
        scene.add(sky);
        attachedScene = scene;
      }
      sky.position.copy(camera.position);
      scene.updateMatrixWorld(true);
      frame += 1;
      let changed = false;
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
        const last = prior.get(object);
        const pose = object.matrixWorld.elements;
        if (last === undefined || last.geometry !== object.geometry || last.visible !== object.visible
          || pose.some((value,index) => value !== last.pose[index])) {
          if (last === undefined) {
            prior.set(object,{ geometry:object.geometry,pose:pose.slice(),visible:object.visible,frame });
          } else {
            last.geometry=object.geometry;
            last.visible=object.visible;
            for(let i=0;i<16;i+=1) { last.pose[i]=pose[i]!; }
          }
          changed = true;
        }
        if (last !== undefined) { last.frame=frame; }
      });
      for (const [node,last] of prior) {
        if (last.frame!==frame) { prior.delete(node); changed = true; }
      }
      // No per-frame shadow redraw in a static view; edits, body poses and removals invalidate it.
      if (changed) { renderer.shadowMap.needsUpdate = true; }
      const started=performance.now();
      renderer.render(scene,camera);
      if (frame % 60 === 0 && canvas.ownerDocument !== undefined) {
        canvas.ownerDocument.body.dataset.hestiaPrototypeFrameDiagnostics=JSON.stringify({
          renderSubmitMs:performance.now()-started,calls:renderer.info.render.calls,triangles:renderer.info.render.triangles,
          geometries:renderer.info.memory.geometries,textures:renderer.info.memory.textures,shadowUpdated:changed,
          shadowMapSize:1024,fullscreenTargets:0
        });
      }
    },
    dispose: () => {
      if (disposed) { return; }
      disposed = true;
      attachedScene?.remove(sky);
      prior.clear();
      skyGeometry.dispose();
      skyMaterial.dispose();
      cloudMap.dispose();
      renderer.dispose();
      onDispose?.(Object.freeze({...renderer.info.memory}));
    }
  };
};
