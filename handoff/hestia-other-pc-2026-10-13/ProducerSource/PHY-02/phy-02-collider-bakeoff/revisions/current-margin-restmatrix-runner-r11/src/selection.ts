import catalog from "../inputs/case-catalog.json" with {type:"json"};
import type {Profile,Kind,Descriptor} from "./case-types";
export const fullCatalog=catalog.fullMatrix192 as Descriptor[];
export function selectCase(profile:Profile,kind:Kind,group:string,title:string):Descriptor{
 const selected=fullCatalog.filter(c=>c.profile===profile&&c.kind===kind&&c.group===group&&c.title===title);
 if(selected.length!==1)throw new Error("Unbound/duplicate case selection");return selected[0];
}

