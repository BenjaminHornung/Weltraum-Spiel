import {NodeMaterial, type WebGPURenderer} from 'three/webgpu';
import type {Object3D} from 'three';

// Only public fields touched by the r186 generic override branch, plus the three
// missing node inputs. No standard shadow material is registered by this port.
export const overrideRestoreKeys = ['maskNode','opacityNode','alphaTestNode','positionNode','colorNode','depthNode',
  'alphaTest','alphaMap','transparent','side','displacementMap','displacementScale','displacementBias'] as const;
type Snapshot = {key:typeof overrideRestoreKeys[number];value:unknown;descriptor:PropertyDescriptor|undefined}[];

export function requireDefaultOverrideCache(material:NodeMaterial):void {
  if(material.customProgramCacheKey!==NodeMaterial.prototype.customProgramCacheKey)
    throw new Error('Owned generic override requires default NodeMaterial cache identity');
}
function synchronous(result:unknown):void {
  if(result!==null&&(typeof result==='object'||typeof result==='function')&&typeof Reflect.get(result,'then')==='function')
    throw new Error('Override callback must be synchronous');
}
export function requireSynchronousCallback(callback:Function):void {
  const tag=Object.prototype.toString.call(callback);
  if(tag==='[object AsyncFunction]'||tag==='[object AsyncGeneratorFunction]'||tag==='[object GeneratorFunction]')
    throw new Error('Override callback must be synchronous');
}
/** Restore callback identity AND property shape; preserve a later real owner. */
export function replaceOwnedObjectCallback<K extends 'onBeforeRender'|'onAfterRender'>(object:Object3D,key:K,replacement:Object3D[K]):()=>boolean {
  const descriptor=Object.getOwnPropertyDescriptor(object,key);
  if(descriptor&&(descriptor.get||descriptor.set))throw new Error('Accessor callback ownership is unsupported');
  if(!Reflect.set(object,key,replacement))throw new Error(`Cannot bind object callback ${key}`);
  return ()=>{
    if(Reflect.get(object,key)!==replacement)return false;
    if(descriptor)Object.defineProperty(object,key,descriptor);
    else if(!Reflect.deleteProperty(object,key))throw new Error(`Cannot restore callback shape ${key}`);
    return true;
  };
}
function beginBinding(source:NodeMaterial,target:NodeMaterial):()=>void {
  requireDefaultOverrideCache(target);
  const snapshot:Snapshot=overrideRestoreKeys.map(key=>({key,value:Reflect.get(target,key),descriptor:Object.getOwnPropertyDescriptor(target,key)}));
  let restored=false;
  const restore=()=>{
    if(restored)return;restored=true;
    const failures:unknown[]=[];
    for(const {key,value,descriptor} of snapshot){
      try{
        // alphaTest is a public accessor: restore through its setter as well as
        // restoring own-property shape. This does not touch its private backing field.
        if(!Reflect.set(target,key,value))throw new Error(`Cannot restore override ${key}`);
        if(descriptor)Object.defineProperty(target,key,descriptor);
        else if(!Reflect.deleteProperty(target,key))throw new Error(`Cannot restore override shape ${key}`);
      }catch(error){failures.push(error);}
    }
    try{target.needsUpdate=true;}catch(error){failures.push(error);}
    if(failures.length)throw new AggregateError(failures,'Override restore failed; quarantine material');
  };
  try {target.maskNode=source.maskNode;target.opacityNode=source.opacityNode;target.alphaTestNode=source.alphaTestNode;target.needsUpdate=true;}
  catch(error){restore();throw error;}
  return restore;
}

/** CPU object transaction used by the public hook; does not evaluate any node. */
export function withOwnedOverrideBinding<T>(source:NodeMaterial,target:NodeMaterial,consume:()=>T):T {
  requireSynchronousCallback(consume);
  if(!source.allowOverride)return consume();
  const restore=beginBinding(source,target);
  let primary:unknown;
  try{const result=consume();synchronous(result);return result;}catch(error){primary=error;throw error;}
  finally{try{restore();}catch(error){if(primary!==undefined)throw new AggregateError([primary,error],'Consume and restore failed',{cause:primary});throw error;}}
}

type RenderHook=NonNullable<ReturnType<WebGPURenderer['getRenderObjectFunction']>>;
export interface OverrideLease {
  readonly stats: {bindings:number;restores:number;failed:boolean};
  release():boolean;
}
/** Public synchronous hook, scoped to caller-owned generic overrides only. */
export function installOwnedGenericOverride(renderer:WebGPURenderer,owned:ReadonlySet<NodeMaterial>):OverrideLease {
  for(const target of owned)requireDefaultOverrideCache(target);
  const previous=renderer.getRenderObjectFunction();
  const delegate=previous??renderer.renderObject;
  requireSynchronousCallback(delegate);
  const stats={bindings:0,restores:0,failed:false};let active=false,released=false;
  const hook:RenderHook=function(...args){
    if(released||stats.failed)throw new Error('Override lease unavailable; remount renderer');
    if(active){stats.failed=true;throw new Error('Nested generic override render is unsupported');}
    active=true;
    const [object,renderScene]=args;
    const before=object.onBeforeRender,after=object.onAfterRender;
    try{requireSynchronousCallback(before);requireSynchronousCallback(after);}catch(error){active=false;stats.failed=true;throw error;}
    let restore:(()=>void)|null=null;
    const finish=()=>{const release=restore;restore=null;if(release){try{release();stats.restores++;}catch(error){stats.failed=true;throw error;}}};
    const beforeHook:typeof object.onBeforeRender=function(this:typeof object,...event){
      synchronous(before.apply(this,event));
      finish();
      // The existing callback can update source nodes or the override target.
      const target=renderScene.overrideMaterial,source=event[4];
      if(target instanceof NodeMaterial&&owned.has(target)&&source instanceof NodeMaterial&&source.allowOverride){
        restore=beginBinding(source,target);stats.bindings++;
      }
    };
    const afterHook:typeof object.onAfterRender=function(this:typeof object,...event){finish();synchronous(after.apply(this,event));};
    let releaseBefore:(()=>boolean)|null=null,releaseAfter:(()=>boolean)|null=null,primary:unknown;
    try{
      releaseBefore=replaceOwnedObjectCallback(object,'onBeforeRender',beforeHook);
      releaseAfter=replaceOwnedObjectCallback(object,'onAfterRender',afterHook);
      synchronous(delegate.apply(renderer,args));
    }
    catch(error){stats.failed=true;primary=error;throw error;}
    finally{
      const failures:unknown[]=[];
      try{finish();}catch(error){failures.push(error);}
      for(const release of [releaseAfter,releaseBefore])if(release){try{if(!release())stats.failed=true;}catch(error){failures.push(error);}}
      active=false;
      if(failures.length){stats.failed=true;throw new AggregateError(primary===undefined?failures:[primary,...failures],'Override hook cleanup failed',{cause:primary});}
    }
  };
  renderer.setRenderObjectFunction(hook);
  return {stats,release(){
    if(active)throw new Error('Cannot release an active override lease');
    if(released)return false;
    if(renderer.getRenderObjectFunction()!==hook)return false;
    released=true;
    renderer.setRenderObjectFunction(previous);return true;
  }};
}
