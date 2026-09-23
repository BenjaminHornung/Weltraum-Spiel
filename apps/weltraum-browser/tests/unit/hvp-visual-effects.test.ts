import { describe, expect, it, vi } from "vitest";
import * as THREE from "three";
import { createHvpVisualRenderer, HVP_EFFECT_COST, shadeHvpSurface } from "../../src/hestia-prototype/presentation/visualEffects";

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
    scene.add(mesh,coast);
    port.render(scene,camera);
    expect(mesh.castShadow).toBe(true);
    expect(coast.castShadow).toBe(false);
    expect(coast.receiveShadow).toBe(true);
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
    expect(updates).toEqual([true,false,false,true,true,true,false]);
    expect(renderer.toneMapping).toBe(THREE.ACESFilmicToneMapping);
    expect(shadowMap.autoUpdate).toBe(false);
    scene.remove(coast);
    port.dispose(); port.dispose();
    expect(releaseSky).toHaveBeenCalledTimes(1);
    expect(releaseCloud).toHaveBeenCalledTimes(1);
    expect(dispose).toHaveBeenCalledTimes(1);
    expect(scene.children).toHaveLength(0);
    geometry.dispose(); replacement.dispose(); material.dispose();
  });
});
