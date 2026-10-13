import {context} from "@phy02-current/fork";
export * from "@phy02-current/fork";
export {stageEdit} from "@phy02-current/stage";
export function activeContext(){
 const profile=process.env.PHY02_PROFILE,kind=process.env.PHY02_KIND;
 if(profile!=="legacy-impulse-v1"&&profile!=="gyroscopic-v1")throw new Error("Explicit profile required");
 if(kind!=="triangles"&&kind!=="multi-cuboid"&&kind!=="voxels")throw new Error("Explicit representation required");
 return context(profile,kind);
}

