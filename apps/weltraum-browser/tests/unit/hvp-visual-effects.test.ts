import { describe, expect, it, vi } from "vitest";
import * as THREE from "three";
import { createHvpVisualRenderer, HVP_EFFECT_COST, shadeHvpSurface } from "../../src/hestia-prototype/presentation/visualEffects";
import { createHvpLookProfile } from "../../src/hestia-prototype/presentation/look";
import { createFactoryAssetProjection, getFactoryAssetSource, readFactoryAssetDefinition } from "../../src/factory/presentation/factoryAssets";
import { ThreeMaterialFactory } from "../../src/render/three/backend/threeMaterialFactory";
import { createMaterialProfile, materialProfileId } from "../../src/presentation";

describe("HVP visual effects", () => {
  it("patches the installed water shader without moving source geometry or changing opacity", () => {
    const material = new THREE.MeshLambertMaterial({ opacity:0.55, transparent:true, depthWrite:false });
    shadeHvpSurface(material,true);
    const shader = { vertexShader:THREE.ShaderLib.lambert.vertexShader,fragmentShader:THREE.ShaderLib.lambert.fragmentShader,uniforms:{} };
    material.onBeforeCompile(shader as Parameters<THREE.Material["onBeforeCompile"]>[0],{} as THREE.WebGLRenderer);
    expect(shader.fragmentShader).toContain("float fresnel");
    expect(shader.fragmentShader).toContain("float glint");
    expect(shader.vertexShader).toContain("#include <begin_vertex>");
    expect(shader.vertexShader).not.toMatch(/transformed\s*[+*\-]?=/);
    expect(material.opacity).toBe(0.55);
    expect(material.depthWrite).toBe(false);
    expect(material.forceSinglePass).toBe(true);
    material.dispose();
  });

  it("selects the Factory light floor from profile identity regardless of coast traversal order", () => {
    const coastProfile = createHvpLookProfile("readable").materials[0]!.materialProfile;
    const source = getFactoryAssetSource("B09"), definition = readFactoryAssetDefinition(source.definitionId);
    if (!definition) throw new Error("Expected the existing B09 Factory material definition");
    const factoryProjection = createFactoryAssetProjection({ sourceId: definition.sourceId, version: definition.version,
      digest: definition.digest, instanceId: "hvp-visual-effects-test" }, source);
    const factoryProfile = factoryProjection.parts.flatMap(part => part.materialProfiles).find(profile => profile.id === "fp06_ex_struct");
    if (!factoryProfile) throw new Error("Expected the existing Factory EX-STRUCT material profile");
    const vertexColorProfile = createMaterialProfile({ id: materialProfileId("fp06_vertex_color"), kind: "BasicLit",
      baseColor: { r: 1, g: 1, b: 1 }, opacity: 1, doubleSided: false, wireframe: false, depthWrite: true });

    const materials = new ThreeMaterialFactory();
    const coastLease = materials.acquire([coastProfile]), factoryLease = materials.acquire([factoryProfile]);
    const vertexColorLease = materials.acquire([vertexColorProfile], { vertexColors: true });
    const coastMaterial = coastLease.materials[0]!, factoryMaterial = factoryLease.materials[0]!, vertexColorMaterial = vertexColorLease.materials[0]!;
    const geometry = new THREE.BoxGeometry();
    try {
      expect(coastMaterial.name).toBe(coastProfile.id);
      expect(factoryMaterial.name).toBe(factoryProfile.id);
      expect(vertexColorMaterial.name).toBe(vertexColorProfile.id);
      expect(coastMaterial).not.toBe(factoryMaterial);
      expect(factoryMaterial).not.toBe(vertexColorMaterial);
      expect(materials.allocations).toBe(3);

      for (const factoryFirst of [false, true]) {
        const shadowMap = { enabled: false, type: THREE.BasicShadowMap, autoUpdate: true, needsUpdate: false };
        const renderer = { shadowMap, setSize: vi.fn(), setPixelRatio: vi.fn(), dispose: vi.fn(), render: vi.fn() } as unknown as THREE.WebGLRenderer;
        const port = createHvpVisualRenderer({} as HTMLCanvasElement, {}, () => renderer);
        const coast = new THREE.Mesh(geometry, [coastMaterial]); coast.name = "representation:hvp:terrain";
        const factory = new THREE.Mesh(geometry, [factoryMaterial]); factory.name = "representation:factory-play:test:body";
        const vertexColorFactory = new THREE.Mesh(geometry, [vertexColorMaterial]); vertexColorFactory.name = "representation:factory-play:test:vertex-color";
        const scene = new THREE.Scene();
        scene.add(...(factoryFirst ? [factory, coast, vertexColorFactory] : [coast, vertexColorFactory, factory]));
        try {
          port.render(scene, new THREE.PerspectiveCamera());
          const compile = (material: THREE.Material) => {
            const shader = { vertexShader: THREE.ShaderLib.lambert.vertexShader, fragmentShader: THREE.ShaderLib.lambert.fragmentShader, uniforms: {} };
            material.onBeforeCompile(shader as Parameters<THREE.Material["onBeforeCompile"]>[0], renderer);
            return shader.fragmentShader;
          };
          const coastShader = compile(coastMaterial), factoryShader = compile(factoryMaterial), vertexColorShader = compile(vertexColorMaterial);
          expect(coastShader).toContain("float strata");
          expect(coastShader).not.toContain("outgoingLight = max(outgoingLight, diffuseColor.rgb * 0.35)");
          expect(factoryShader).not.toContain("float strata");
          expect(factoryShader).toContain("outgoingLight = max(outgoingLight, diffuseColor.rgb * 0.35)");
          expect(vertexColorShader).not.toContain("float strata");
          expect(vertexColorShader).toContain("outgoingLight = max(outgoingLight, diffuseColor.rgb * 0.35)");
          expect(coastMaterial.customProgramCacheKey()).toContain(":opaque");
          expect(factoryMaterial.customProgramCacheKey()).toContain(":factory-light-floor");
        } finally {
          port.dispose();
        }
      }
    } finally {
      coastLease.release();
      factoryLease.release();
      vertexColorLease.release();
      geometry.dispose();
    }
    expect(materials.allocations).toBe(3);
    expect(materials.disposals).toBe(3);
  });

  it("updates shadows only after geometry, owner pose, visibility or removal changes and disposes owned sky", () => {
    const shadowMap = { enabled:false,type:THREE.BasicShadowMap,autoUpdate:true,needsUpdate:false };
    const updates: boolean[] = [];
    const dispose = vi.fn();
    const renderer = { shadowMap,setSize:vi.fn(),setPixelRatio:vi.fn(),dispose,
      render:()=>{ updates.push(shadowMap.needsUpdate); shadowMap.needsUpdate=false; }
    } as unknown as THREE.WebGLRenderer;
    const port = createHvpVisualRenderer({} as HTMLCanvasElement,{},()=>renderer);
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera();
    const geometry = new THREE.BoxGeometry();
    const material = new THREE.MeshLambertMaterial();
    const mesh = new THREE.Mesh(geometry,material);
    const coast = new THREE.Mesh(geometry,material);
    coast.name = "representation:hvp:terrain";
    const cargoClosed = new THREE.Mesh(geometry,material);
    cargoClosed.name = "representation:factory-play:fp02_wreck_owner:closed:play_wreck_cargo_v2:cargo_access";
    const cargoOpen = new THREE.Mesh(geometry,material);
    cargoOpen.name = "representation:factory-play:fp02_wreck_owner:open:play_wreck_cargo_open_v2:cargo_access";
    const factoryNeighbor = new THREE.Mesh(geometry,material);
    factoryNeighbor.name = "representation:factory-play:factory_battery_owner:play_battery_v1:body";
    scene.add(mesh,coast,cargoClosed,cargoOpen,factoryNeighbor);
    port.render(scene,camera);
    expect(mesh.castShadow).toBe(true);
    expect(mesh.receiveShadow).toBe(true);
    expect(coast.castShadow).toBe(false);
    expect(coast.receiveShadow).toBe(true);
    expect(cargoClosed.castShadow).toBe(true);
    expect(cargoClosed.receiveShadow).toBe(false);
    expect(cargoOpen.castShadow).toBe(true);
    expect(cargoOpen.receiveShadow).toBe(false);
    expect(factoryNeighbor.castShadow).toBe(true);
    expect(factoryNeighbor.receiveShadow).toBe(true);
    const sky = scene.getObjectByName("hvp-presentation-sky") as THREE.Mesh;
    const bytes = Object.values(sky.geometry.attributes).reduce((n,a)=>n+a.array.byteLength,0) + sky.geometry.index!.array.byteLength;
    expect(bytes).toBe(HVP_EFFECT_COST.meshBytes);
    expect(sky.geometry.index!.count/3).toBe(HVP_EFFECT_COST.triangles);
    const releaseSky=vi.spyOn(sky.geometry,"dispose");
    const releaseCloud=vi.spyOn((sky.material as THREE.ShaderMaterial).uniforms.cloudMap!.value as THREE.Texture,"dispose");
    port.render(scene,camera);
    camera.position.z=20;
    port.render(scene,camera);
    const replacement=geometry.clone();
    mesh.geometry=replacement;
    port.render(scene,camera);
    mesh.position.x=3;
    port.render(scene,camera);
    mesh.visible=false;
    port.render(scene,camera);
    scene.remove(mesh);
    port.render(scene,camera);
    expect(updates).toEqual([true,false,false,true,true,true,true]);
    expect(renderer.toneMapping).toBe(THREE.ACESFilmicToneMapping);
    expect(shadowMap.autoUpdate).toBe(false);
    scene.remove(coast,cargoClosed,cargoOpen,factoryNeighbor);
    port.dispose(); port.dispose();
    expect(releaseSky).toHaveBeenCalledTimes(1);
    expect(releaseCloud).toHaveBeenCalledTimes(1);
    expect(dispose).toHaveBeenCalledTimes(1);
    expect(scene.children).toHaveLength(0);
    geometry.dispose(); replacement.dispose(); material.dispose();
  });
});
