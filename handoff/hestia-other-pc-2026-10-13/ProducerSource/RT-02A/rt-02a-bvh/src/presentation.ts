import type { createDepthCameraPort, MaterialData } from '../imports/gfx/src/port.js';
type DepthPort=ReturnType<typeof createDepthCameraPort>;
/** Borrow valid host depth only during this synchronous callback; retain copied metadata only. */
export function consumePresentation(port:DepthPort,current:DepthPort,backend:'WebGL2'|'WebGPU',materials:readonly MaterialData[],consume:(depth:DepthPort['depth'])=>unknown){
  if(port.epoch!==current.epoch||port.depth!==current.depth||JSON.stringify(port.sourceBinding)!==JSON.stringify(current.sourceBinding))throw new Error('Stale borrowed presentation');
  if(materials.some(m=>!m.id||!m.role||m.colorLinearRgb.length!==3||!m.colorLinearRgb.every(Number.isFinite)))throw new Error('Invalid material view');
  const metadata=structuredClone({epoch:port.epoch,sourceBinding:port.sourceBinding,projection:port.projection,view:port.view,materials,clipRange:backend==='WebGPU'?[0,1]:[-1,1]});
  const result=consume(port.depth);if(result&&typeof (result as any).then==='function')throw new Error('Borrow callback must be synchronous');
  const freeze=(value:any):any=>{if(value&&typeof value==='object'){Object.values(value).forEach(freeze);Object.freeze(value);}return value;};return freeze(metadata);
}
