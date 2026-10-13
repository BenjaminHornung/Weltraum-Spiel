import {installOwnedGenericOverride,withOwnedOverrideBinding,replaceOwnedObjectCallback,requireSynchronousCallback} from '../dist/src/upscaler-compatibility.js';
import type {Object3D} from 'three';
import type {OverrideLease} from '../dist/src/upscaler-compatibility.js';
import type {TemporalFrameOwnerInputProposal} from '../dist/src/owner-input.UNAPPLIED.js';
import type {WebGPURenderer,NodeMaterial} from 'three/webgpu';

// Declaration consumer only. These functions are neither called nor emitted.
export function consume(renderer:WebGPURenderer,owned:ReadonlySet<NodeMaterial>,source:NodeMaterial,target:NodeMaterial):OverrideLease {
  withOwnedOverrideBinding(source,target,()=>target.maskNode);
  return installOwnedGenericOverride(renderer,owned);
}
export type FrameOwnerGap=TemporalFrameOwnerInputProposal['disposition'];
export function callbackConsumer(object:Object3D,callback:Object3D['onBeforeRender']):boolean {
  requireSynchronousCallback(callback);
  return replaceOwnedObjectCallback(object,'onBeforeRender',callback)();
}
