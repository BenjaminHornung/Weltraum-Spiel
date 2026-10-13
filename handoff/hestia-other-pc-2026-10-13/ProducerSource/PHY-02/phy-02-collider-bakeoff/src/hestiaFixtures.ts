import type {Fixture,Cell} from "./fixtures.js";
// Source replay, not an executed gameplay cut: fixed HVP_ROCK_ARM roof [6,9) × [2.25,2.75) × [-6.5,-6).
export function rockarm384(cellSize:.125|.25):Fixture{
  const cells:Cell[]=[];
  for(let x=0;x<24;x++)for(let y=0;y<4;y++)for(let z=0;z<4;z++)cells.push([x,y,z]);
  return {id:"rockarm384-source-roof-replay",cellSize,origin:[6,2.25,-6.5],bounds:[24,4,4],cells,
    density:2400,rotation:{x:0,y:0,z:0,w:1}};
}
// Literal moving primitive probe removes a two-cell end slab. Actual HVP pick/command replay awaits PHY-01.
export const moving352=(source:Fixture):Fixture=>({...source,cells:source.cells.filter(c=>c[0]>=2)});
