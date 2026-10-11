import type { FactoryConstruction } from "../construction/buildStep";
import type { FactoryPlacementRequest } from "../construction/placement";
/** Local preview selection only. Confirm delegates all physical/material admission to the Host. */
export const createFactoryBuildTool=(construction:FactoryConstruction)=>{
  let request:FactoryPlacementRequest|null=null;
  let cached:ReturnType<FactoryConstruction["preview"]>|null=null;
  let key="";
  const update=()=>{cached=request?construction.preview(request):null;key=construction.previewKey();};
  return {
    select(value:FactoryPlacementRequest):void{request=Object.freeze({...value,centerMm:Object.freeze([...value.centerMm])});update();},
    move(dx:number,dz:number):void{if(request&&Number.isInteger(dx)&&Number.isInteger(dz))request=Object.freeze({...request,centerMm:Object.freeze([request.centerMm[0]!+dx*250,request.centerMm[1]!,request.centerMm[2]!+dz*250])});update();},
    rotate():void{if(request)request=Object.freeze({...request,quarterTurns:(request.quarterTurns+1)%4});update();},
    cancel():void{request=null;cached=null;},
    read:()=>{if(request&&key!==construction.previewKey())update();return request&&cached?Object.freeze({request,placement:cached}):null;},
    async confirm(){if(!request)return {status:"Rejected" as const,reason:"NO_GHOST",transactionId:"none"};const plan=construction.preview(request);
      if(plan.status!=="Prepared")return {status:"Rejected" as const,reason:plan.reason,transactionId:request.transactionId};const result=await construction.commit(plan);if(result.status==="Committed")request=null;return result;}
  };
};
