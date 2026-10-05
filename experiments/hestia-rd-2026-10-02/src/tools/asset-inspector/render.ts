import{Box3,Box3Helper,BoxGeometry,Color,Group,InstancedMesh,Matrix4,Mesh,MeshBasicMaterial,Quaternion,Vector3}from'three';
import{copyFixturePayload,getFixtureDigest,type LabFixtureV1}from'../../contracts/fixture';
import{requireValue,integer}from'../../contracts/validation';
import{createThreeLabHost,ownerPose,type ThreeLabEffectContext}from'../../runner/threeHost';
import{createFrameInput,validateFacts,type LabExperimentContext,type LabPreset}from'../../contracts/experiment';
import{mountThreeEffect as mountMaterial,type MaterialViewMode}from'../../experiments/material-light';
import{mountThreeEffect as mountControl}from'../../experiments/three-control';
export type InspectorView=MaterialViewMode|'bounds';
async function mountInspector(context:ThreeLabEffectContext,_preset:LabPreset){let fixture=context.fixture,disposed=false,owner='all',hidden=false,view:InspectorView='color',slice:InstancedMesh|undefined,sliceSelection:{regionId:string;yCell:number;mode:'occupied'|'coverage'}|null=null;const solid=new Group(),decor=new Group(),overlay=new Group();context.root.add(solid,decor,overlay);
 const child=(root:Group):ThreeLabEffectContext=>({...context,root,get fixture(){return fixture;},ownerPose:id=>ownerPose(fixture,id)});
 let material:Awaited<ReturnType<typeof mountMaterial>>,leaves:Awaited<ReturnType<typeof mountControl>>;const boxes:Box3Helper[]=[];
 try{material=await mountMaterial(child(solid),{id:'basic-lit'});leaves=await mountControl(child(decor),{id:'fixture-control',parameters:{projection:'decor'}});}catch(error){if(material!)await material.dispose();context.root.clear();throw error;}
 function clearBoxes(){for(const b of boxes){b.removeFromParent();b.geometry.dispose();for(const m of Array.isArray(b.material)?b.material:[b.material])m.dispose();}boxes.length=0;}
 function clearSlice(){if(slice){slice.removeFromParent();slice.geometry.dispose();for(const m of Array.isArray(slice.material)?slice.material:[slice.material])m.dispose();slice=undefined;}sliceSelection=null;}
 function select(){for(const root of [solid,decor])root.traverse(o=>{if(o.userData.ownerId)o.visible=true;if(o instanceof Mesh)o.visible=owner==='all'||o.parent?.userData.ownerId===owner;});clearBoxes();
  if(view==='bounds'){context.root.updateMatrixWorld(true);for(const root of [solid,decor])for(const object of fixture.objects){if(owner!=='all'&&owner!==object.ownerId)continue;const node=root.getObjectByName(object.ownerId);if(node&&node.children.length){const box=new Box3Helper(new Box3().setFromObject(node),0xffc665);overlay.add(box);boxes.push(box);}}}
 }
 function active(){context.signal.throwIfAborted();requireValue(!disposed,'Inspector disposed');}
 const effect={setFrame(input:Parameters<typeof material.setFrame>[0]){active();const frame=createFrameInput(input);material.setFrame(frame);leaves.setFrame(frame);},
  async replaceFixture(next:LabFixtureV1){active();await material.replaceFixture(next);await leaves.replaceFixture(next);clearSlice();clearBoxes();fixture=next;owner='all';select();},
  setSelection(nextOwner:string,nextView:InspectorView){active();requireValue(nextOwner==='all'||fixture.objects.some(o=>o.ownerId===nextOwner),'Unknown inspector owner');requireValue(['color','normal','depth','roughness','wetness','bounds'].includes(nextView),'Unknown inspector view');owner=nextOwner;hidden=false;view=nextView;material.setViewMode(view==='bounds'?'color':view);select();},
  setHidden(next:boolean){active();requireValue(typeof next==='boolean','Invalid visibility');hidden=next;for(const root of[solid,decor])root.traverse(o=>{if(o.userData.ownerId&&(owner==='all'||o.userData.ownerId===owner))o.visible=!hidden;});},
  setVoxelSlice(regionId:string,y:number,mode:'occupied'|'coverage'|'off'){active();requireValue(['occupied','coverage','off'].includes(mode),'Unknown voxel overlay');if(mode==='off'){clearSlice();return;}
   const region=fixture.voxelRegions?.find(r=>r.id===regionId);requireValue(region,'Unknown voxel region');integer(y);requireValue(y<region.dimensions[1]&&region.dimensions[0]*region.dimensions[2]<=10_000,'Voxel slice exceeds bounded overlay');
   const occ=copyFixturePayload(fixture,region.occupancyPayload),coverage=copyFixturePayload(fixture,region.knownCoveragePayload);requireValue(occ instanceof Uint8Array&&coverage instanceof Uint8Array,'Invalid source cells');
   const q=fixture.quantumMeters,geometry=new BoxGeometry(q*.96,q*.96,q*.96),mat=new MeshBasicMaterial({vertexColors:true,transparent:mode==='coverage',opacity:mode==='coverage'?.35:1,depthWrite:mode!=='coverage'}),candidate=new InstancedMesh(geometry,mat,region.dimensions[0]*region.dimensions[2]);
   const pose=ownerPose(fixture,region.ownerId)!,rotation=new Quaternion(...pose.rotationXyzw),scale=new Vector3(1,1,1),matrix=new Matrix4();let count=0;
   for(let z=0;z<region.dimensions[2];z++)for(let x=0;x<region.dimensions[0];x++){const offset=x+region.dimensions[0]*(y+region.dimensions[1]*z);if(mode==='occupied'&&!occ[offset])continue;
    const point=new Vector3(region.originMeters[0]+(x+.5)*q,region.originMeters[1]+(y+.5)*q,region.originMeters[2]+(z+.5)*q).applyQuaternion(rotation).add(new Vector3(...pose.originMeters));matrix.compose(point,rotation,scale);candidate.setMatrixAt(count,matrix);candidate.setColorAt(count,new Color(coverage[offset]===0?0xff3344:occ[offset]?0x63cc7a:0x879099));count++;}
   candidate.count=count;candidate.instanceMatrix.needsUpdate=true;if(candidate.instanceColor)candidate.instanceColor.needsUpdate=true;candidate.computeBoundingBox();candidate.computeBoundingSphere();clearSlice();slice=candidate;sliceSelection={regionId,yCell:y,mode};overlay.add(candidate);
  },
  readSelection(){active();return{ownerId:owner,view,hidden,slice:sliceSelection,voxelInstances:slice?.count??0,boundsHelpers:boxes.length,fixtureDigest:getFixtureDigest(fixture),decorNormals:'UNSUPPORTED_DECOR_MATERIAL_NORMAL_VIEW'};},
  readFacts(){active();const m=material.readFacts(),d=leaves.readFacts();return validateFacts({...m,experimentId:'RD-43',variantId:'fixture-inspector',liveResources:{...m.liveResources,decorGeometries:d.liveResources.geometries,voxelOverlays:{status:'measured',value:slice?1:0,unit:'count'},boundsHelpers:{status:'measured',value:boxes.length,unit:'count'}},logicalCosts:{...m.logicalCosts,decorProjectionBytes:d.logicalCosts.projectionBufferBytes},unsupportedFeatures:[...new Set([...m.unsupportedFeatures,...d.unsupportedFeatures,'glb-without-source-is-preview-only','decor-normal-overlay-unqualified'])]});},
  async dispose(){if(!disposed){disposed=true;clearSlice();clearBoxes();await leaves.dispose();await material.dispose();context.root.clear();}}
 };return effect;
}
export async function createInspectorExperiment(context:LabExperimentContext){requireValue(context.fixture.objects.length<=300,'Inspector exceeds 300 owners');const host=await createThreeLabHost(context,[{mount:mountInspector,preset:{id:'fixture-inspector'}}],'RD-43'),effect=()=>host.effectAt<Awaited<ReturnType<typeof mountInspector>>>(0);
 return Object.assign(host,{setSelection(owner:string,view:InspectorView){effect().setSelection(owner,view);host.markPresentationChanged();},setHidden(hidden:boolean){effect().setHidden(hidden);host.markPresentationChanged();},setVoxelSlice(region:string,y:number,mode:'occupied'|'coverage'|'off'){effect().setVoxelSlice(region,y,mode);host.markPresentationChanged();},readSelection(){return effect().readSelection();}});
}
