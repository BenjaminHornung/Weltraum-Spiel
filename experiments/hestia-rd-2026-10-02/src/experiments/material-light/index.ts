import { BufferAttribute,Material,Mesh,MeshBasicMaterial,MeshDepthMaterial,MeshLambertMaterial,MeshNormalMaterial,MeshStandardMaterial,Plane,Vector3 } from 'three';
import { createFrameInput,validateFacts,type LabExperimentContext,type LabPreset } from '../../contracts/experiment';
import { fixtureRevision,getFixtureDigest,type LabFixtureV1,type Vec3 } from '../../contracts/fixture';
import { canonicalJson,finite,freezeJson,keys,requireValue,sha256,vector } from '../../contracts/validation';
import { createThreeLabHost,labSunDirection,type ThreeLabEffect,type ThreeLabEffectContext,type ThreeLabHost } from '../../runner/threeHost';
import { mountThreeEffect as mountControl } from '../three-control';

export type MaterialViewMode='color'|'normal'|'depth'|'roughness'|'wetness';
export interface ViewCutoutPlane{readonly normal:Vec3;readonly constant:number;}
export interface MaterialSurfaceBinding {readonly fixtureDigest:string;readonly sourceRevision:number;readonly ownerId:string;readonly ownerRevision:number;readonly meshIndex:number;readonly materialId:string;readonly surfaceId:string;readonly sourcePositions:string;readonly vertexCount:number;}
export interface MaterialLightEffect extends ThreeLabEffect {
  readSurfaceBindings():readonly MaterialSurfaceBinding[];
  setSurfaceWetness(binding:MaterialSurfaceBinding,values:Float32Array):void;
  setViewMode(mode:MaterialViewMode):void;
  setViewCutout(planes:readonly ViewCutoutPlane[]):void;
  readMaterialState():{readonly generation:number;readonly viewMode:MaterialViewMode;readonly sunDirectionWorld:ReturnType<typeof labSunDirection>};
}
const views:readonly MaterialViewMode[]=['color','normal','depth','roughness','wetness'];
/** Solid/water owner only. Decor and particle materials are never traversed or hooked. */
export async function mountThreeEffect(context:ThreeLabEffectContext,preset:LabPreset):Promise<MaterialLightEffect> {
  requireValue(preset.id==='basic-lit'||preset.id==='rough-wet','Unknown material variant');
  const parameters=preset.parameters??{};requireValue(Object.keys(parameters).every((k)=>['dryRoughness','wetRoughness','width','height','dpr'].includes(k)),'Unknown material parameter');
  const dryInput=parameters.dryRoughness??0.92,wetInput=parameters.wetRoughness??0.24;finite(dryInput,0,1);finite(wetInput,0,1);
  const dry:number=dryInput,wet:number=wetInput;
  let fixture=context.fixture,disposed=false,generation=0,requestGeneration=0,viewMode:MaterialViewMode='color',frame=context.frame,cutout:Plane[]=[];
  function validateBudget(next:LabFixtureV1){getFixtureDigest(next);let vertices=0;for(const object of next.objects)for(const source of object.meshes){
    const role=next.materials.find((m)=>m.id===source.materialId)!.role;if(!['foliage','accent','reed'].includes(role))vertices+=next.payloads.find((p)=>p.id===source.positions)!.length/3;
  }requireValue(vertices<=2_000_000,'UNSUPPORTED: bounded material surface vertex budget exceeded');}
  validateBudget(fixture);
  async function prepareBindings(next:LabFixtureV1){
    validateBudget(next);const bindings:MaterialSurfaceBinding[]=[];
    for(const object of next.objects)for(const [meshIndex,source] of object.meshes.entries()){
      const declared=next.materials.find((m)=>m.id===source.materialId)!;if(['foliage','accent','reed'].includes(declared.role))continue;
      const surfaceId='surface:'+await sha256(new TextEncoder().encode(canonicalJson([object.ownerId,meshIndex,source.positions,source.indices,source.materialId])));
      context.signal.throwIfAborted();
      bindings.push(freezeJson({fixtureDigest:getFixtureDigest(next),sourceRevision:fixtureRevision(next),ownerId:object.ownerId,ownerRevision:object.sourceRevision,meshIndex,materialId:source.materialId,surfaceId,
        sourcePositions:source.positions,vertexCount:next.payloads.find((p)=>p.id===source.positions)!.length/3}));
    }
    requireValue(new Set(bindings.map((b)=>b.surfaceId)).size===bindings.length,'Surface identity collision');return bindings;
  }
  let prepared=await prepareBindings(fixture);
  const base=await mountControl(context,{id:'fixture-control',parameters:{projection:'solid'}});
  type Surface={binding:MaterialSurfaceBinding;mesh:Mesh;base:MeshLambertMaterial;color:MeshStandardMaterial|MeshLambertMaterial;debug?:Material;wetness:BufferAttribute;water:boolean;time:{value:number};rain:{value:number};wind:{value:number}};
  let surfaces:Surface[]=[];
  function waterNormals(shader:{vertexShader:string;uniforms:Record<string,{value:unknown}>},s:Surface){
    shader.uniforms.uLabTime=s.time;shader.uniforms.uLabRain=s.rain;shader.uniforms.uLabWind=s.wind;
    shader.vertexShader='uniform float uLabTime;uniform float uLabRain;uniform float uLabWind;\n'+shader.vertexShader;
    shader.vertexShader=shader.vertexShader.replace('#include <beginnormal_vertex>',`#include <beginnormal_vertex>
vec2 labTile=floor(position.xz);vec2 labDelta=position.xz-labTile-vec2(0.5);
float labAge=fract(uLabTime*1.5+fract(sin(dot(labTile,vec2(12.9898,78.233)))*43758.5453));
float labRadius=length(labDelta);float labRing=cos((labRadius-labAge)*45.0)*exp(-80.0*(labRadius-labAge)*(labRadius-labAge))*(1.0-labAge)*uLabRain*0.055;
vec2 labSlope=vec2(sin(position.x*8.0+uLabTime*2.0),cos(position.z*7.0+uLabTime*1.7))*(0.015*uLabWind+0.045*uLabRain)+normalize(labDelta+vec2(0.0001))*labRing;
objectNormal=normalize(objectNormal+vec3(labSlope.x,0.0,labSlope.y));`);
  }
  function releaseMaterials(){for(const s of surfaces){s.debug?.dispose();if(s.color!==s.base)s.color.dispose();}surfaces=[];}
  function collect(){
    const meshes:Mesh[]=[],used=new Set<Mesh>();context.root.traverse((o)=>{if(o instanceof Mesh)meshes.push(o);});let vertices=0;
    for(const object of fixture.objects)for(const [meshIndex,source] of object.meshes.entries()){
      const declared=fixture.materials.find((m)=>m.id===source.materialId)!;if(['foliage','accent','reed'].includes(declared.role))continue;
      const mesh=meshes.find((m)=>m.name===`${object.ownerId}:${source.materialId}`&&!used.has(m));requireValue(mesh,'Solid material projection missing');used.add(mesh);
      const original=(mesh.material as MeshLambertMaterial[])[0],count=mesh.geometry.getAttribute('position').count;vertices+=count;requireValue(vertices<=2_000_000,'UNSUPPORTED: bounded material surface vertex budget exceeded');
      const wetness=new BufferAttribute(new Float32Array(count),1);mesh.geometry.setAttribute('labWetness',wetness);
      const binding=prepared.find((b)=>b.ownerId===object.ownerId&&b.meshIndex===meshIndex)!;
      requireValue(binding.vertexCount===count,'Surface vertex binding mismatch');
      mesh.userData.surfaceId=binding.surfaceId;
      const color=preset.id==='basic-lit'?original:new MeshStandardMaterial({color:original.color.clone(),vertexColors:original.vertexColors,opacity:original.opacity,transparent:original.transparent,depthWrite:original.depthWrite,side:original.side,roughness:dry,metalness:0,emissive:original.emissive.clone()});
      const s:Surface={binding,mesh,base:original,color,wetness,water:declared.role==='water-presentation',time:{value:0},rain:{value:0},wind:{value:0}};
      if(color instanceof MeshStandardMaterial){
        color.onBeforeCompile=(shader)=>{
          shader.uniforms.uLabTime=s.time;shader.uniforms.uLabRain=s.rain;shader.uniforms.uLabWind=s.wind;
          shader.vertexShader='attribute float labWetness; varying float vLabWetness; varying vec3 vLabPosition;\n'+shader.vertexShader;
          shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvLabWetness=labWetness;vLabPosition=position;');
          shader.fragmentShader='varying float vLabWetness; varying vec3 vLabPosition; uniform float uLabTime; uniform float uLabRain; uniform float uLabWind;\n'+shader.fragmentShader;
          shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>\ndiffuseColor.rgb*=mix(1.0,0.62,clamp(vLabWetness,0.0,1.0));`);
          shader.fragmentShader=shader.fragmentShader.replace('#include <roughnessmap_fragment>',`#include <roughnessmap_fragment>\nroughnessFactor=mix(${dry.toFixed(8)},${wet.toFixed(8)},clamp(vLabWetness,0.0,1.0));`);
          if(s.water)waterNormals(shader,s);
        };
        color.customProgramCacheKey=()=>`hestia-lab-rough-wet-v1:${s.water?'water':'solid'}:${dry}:${wet}`;
      }
      surfaces.push(s);mesh.material=[color];
    }
  }
  function applyView(){
    for(const s of surfaces){s.debug?.dispose();s.debug=undefined;
      if(viewMode==='normal'){const debug=new MeshNormalMaterial({side:s.base.side});if(s.water){debug.onBeforeCompile=(shader)=>waterNormals(shader,s);debug.customProgramCacheKey=()=> 'hestia-water-normal-view-v1';}s.debug=debug;}
      else if(viewMode==='depth')s.debug=new MeshDepthMaterial({side:s.base.side});
      else if(viewMode==='roughness'||viewMode==='wetness'){
        const debug=new MeshBasicMaterial({side:s.base.side});const mode=viewMode;
        debug.onBeforeCompile=(shader)=>{shader.vertexShader='attribute float labWetness;varying float vLabWetness;\n'+shader.vertexShader;
          shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvLabWetness=labWetness;');
          shader.fragmentShader='varying float vLabWetness;\n'+shader.fragmentShader;
          shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>\ndiffuseColor.rgb=vec3(${mode==='wetness'?'clamp(vLabWetness,0.0,1.0)':`mix(${dry.toFixed(8)},${wet.toFixed(8)},clamp(vLabWetness,0.0,1.0))`});`);};
        debug.customProgramCacheKey=()=>`hestia-lab-material-view:${mode}:${dry}:${wet}`;s.debug=debug;
      }
      s.mesh.material=[s.debug??s.color];
    }
    applyCutout(false);
  }
  function applyCutout(recompile:boolean){for(const s of surfaces)for(const m of[s.color,s.debug])if(m){m.clippingPlanes=!s.water&&cutout.length?cutout:null;m.clipIntersection=!s.water&&cutout.length>0;m.clipShadows=false;if(recompile)m.needsUpdate=true;}}
  function active(){context.signal.throwIfAborted();requireValue(!disposed,'Material effect disposed');}
  try{collect();}catch(error){releaseMaterials();await base.dispose();throw error;}
  return {
    setFrame(input){active();frame=createFrameInput(input);requireValue(frame.sourceRevision===fixtureRevision(fixture),'Stale material frame');base.setFrame(frame);
      for(const s of surfaces){s.time.value=frame.seconds;s.rain.value=frame.weather.rain01;s.wind.value=Math.hypot(...frame.weather.windMps);}},
    async replaceFixture(next){active();const version=++requestGeneration,candidateBindings=await prepareBindings(next);active();requireValue(version===requestGeneration,'Stale material incarnation');await base.replaceFixture(next);active();requireValue(version===requestGeneration,'Stale material publication');releaseMaterials();fixture=next;prepared=candidateBindings;generation++;collect();applyView();},
    readSurfaceBindings(){active();return Object.freeze(surfaces.map((s)=>s.binding));},
    setSurfaceWetness(binding,values){active();const s=surfaces.find((s)=>s.binding.surfaceId===binding.surfaceId);
      requireValue(s&&canonicalJson(s.binding)===canonicalJson(binding),'Stale material surface/owner binding');
      requireValue(values instanceof Float32Array&&values.buffer instanceof ArrayBuffer&&values.length===s.binding.vertexCount&&values.buffer!==s.wetness.array.buffer,'Invalid or aliased wetness buffer');
      requireValue(values.every((v)=>Number.isFinite(v)&&v>=0&&v<=1),'Invalid bounded wetness');
      requireValue(preset.id==='rough-wet'||values.every((v)=>v===0),'UNSUPPORTED: BasicLit control has no wetness channel');
      (s.wetness.array as Float32Array).set(values);s.wetness.needsUpdate=true;},
    setViewMode(mode){active();requireValue(views.includes(mode),'Unknown material view');if(mode===viewMode)return;viewMode=mode;applyView();},
    setViewCutout(planes){active();requireValue(Array.isArray(planes)&&planes.length<=6,'Cutout exceeds six native planes');for(const p of planes){keys(p,['normal','constant']);vector(p.normal);requireValue(Math.abs(Math.hypot(...p.normal)-1)<=1e-6,'Cutout normal must be unit');finite(p.constant);}const recompile=planes.length!==cutout.length;if(recompile)cutout=planes.map(p=>new Plane(new Vector3().fromArray(p.normal),p.constant));else for(let i=0;i<planes.length;i++){cutout[i].normal.fromArray(planes[i].normal);cutout[i].constant=planes[i].constant;}applyCutout(recompile);},
    readMaterialState(){active();return freezeJson({generation,viewMode,sunDirectionWorld:labSunDirection(fixture)});},
    readFacts(){active();const facts=base.readFacts();return validateFacts({...facts,experimentId:'RD-14',variantId:preset.id,
      liveResources:{...facts.liveResources,ownedMaterialVariants:{status:'measured',value:surfaces.reduce((sum,s)=>sum+(s.color===s.base?0:1)+(s.debug?1:0),0),unit:'count'}},
      logicalCosts:{...facts.logicalCosts,wetnessAttributeBytes:{status:'estimated',value:surfaces.reduce((sum,s)=>sum+s.wetness.array.byteLength,0),unit:'byte',reason:'Full private wetness attributes; excludes native allocator/shader memory'}},
      unsupportedFeatures:[...facts.unsupportedFeatures,'native-depth-readback-unsupported','material-art-owner-pending','no-temporal-history-or-probe-gi','water-shader-is-lab-preview-only']});},
    async dispose(){if(!disposed){disposed=true;requestGeneration++;releaseMaterials();await base.dispose();}},
  };
}
export interface MaterialLabHost extends ThreeLabHost {
  readSurfaceBindings:MaterialLightEffect['readSurfaceBindings'];setSurfaceWetness:MaterialLightEffect['setSurfaceWetness'];
  setViewMode:MaterialLightEffect['setViewMode'];readMaterialState:MaterialLightEffect['readMaterialState'];
}
export async function createMaterialLightExperiment(context:LabExperimentContext):Promise<MaterialLabHost>{
  const host=await createThreeLabHost(context,[{mount:mountThreeEffect,preset:context.preset},{mount:mountControl,preset:{id:'fixture-control',parameters:{projection:'decor'}}}],'RD-14'),material=()=>host.effectAt<MaterialLightEffect>(0);
  return Object.assign(host,{readSurfaceBindings(){return material().readSurfaceBindings();},setSurfaceWetness(binding:MaterialSurfaceBinding,values:Float32Array){material().setSurfaceWetness(binding,values);host.markPresentationChanged();},
    setViewMode(mode:MaterialViewMode){material().setViewMode(mode);host.markPresentationChanged();},readMaterialState(){return material().readMaterialState();}});
}
