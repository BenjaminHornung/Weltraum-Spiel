import type { Vec3 } from '../../contracts/fixture';
import { array, canonicalJson, finite, freezeJson, id, integer, keys, requireValue, unique, vector } from '../../contracts/validation';

export type TreeShape = 'young' | 'umbrella' | 'buttress';
type Cell = readonly [number, number, number];
export interface PlantRecipe {
  readonly shape: TreeShape; readonly seed: number; readonly quantumMeters: 0.125;
  readonly wood: readonly { readonly id: string; readonly cell: Cell; readonly massKg: 1 }[];
  readonly decor: readonly { readonly id: string; readonly supportId: string; readonly cells: readonly Cell[]; readonly stiffness: number; readonly massKg: 0 }[];
  readonly emptyArchCells: readonly Cell[];
  readonly bounds: { readonly min: Vec3; readonly max: Vec3 };
}
export interface HabitatSite { readonly id: string; readonly positionMeters: Vec3; readonly slope01: number; readonly water: boolean; readonly clearing: boolean; }
export interface PlantParameters { readonly shape: TreeShape|'mixed'; readonly heightCells: number; readonly crownRadiusCells: number; readonly rootScale01: number; }
export interface PatchParameters { readonly seed: number; readonly density01: number; readonly maxSlope01: number; readonly candidates: readonly HabitatSite[]; readonly plant?: PlantParameters; }
export interface PatchRecipe {
  readonly schema: 'hestia-rd-patch-v1'; readonly art: 'PROVISIONAL'; readonly productIntegrated: false;
  readonly parameters: PatchParameters;
  readonly plants: readonly { readonly id: string; readonly ownerId: string; readonly positionMeters: Vec3; readonly recipe: PlantRecipe }[];
  readonly undergrowth: readonly { readonly id: string; readonly type: 'reed' | 'accent'; readonly positionMeters: Vec3; readonly cells: readonly Cell[]; readonly supportId: string; readonly massKg: 0 }[];
  readonly bounds: { readonly min: Vec3; readonly max: Vec3 };
}
const shapes: readonly TreeShape[] = ['young', 'umbrella', 'buttress'];
const lexical=(a:string,b:string)=>a<b?-1:a>b?1:0;
function seeded(seed: number, key: string): number {
  let value = seed >>> 0;
  for (let index = 0; index < key.length; index += 1) value = Math.imul(value ^ key.charCodeAt(index), 16777619) >>> 0;
  value ^= value >>> 16; value = Math.imul(value, 2246822507) >>> 0; return (value >>> 0) / 0x100000000;
}
function bounds(cells: readonly Cell[], position: Vec3 = [0,0,0]) {
  return { min: [0,1,2].map((axis) => position[axis] + Math.min(...cells.map((cell) => cell[axis])) * 0.125) as unknown as Vec3,
    max: [0,1,2].map((axis) => position[axis] + (Math.max(...cells.map((cell) => cell[axis])) + 1) * 0.125) as unknown as Vec3 };
}

/** Connected authored wood paths and separate block clusters; synthetic lab content, pending visual owner. */
export function buildPlantRecipe(shape: TreeShape, seed: number, parameters?: PlantParameters): PlantRecipe {
  requireValue(shapes.includes(shape), 'Unknown plant shape'); integer(seed); requireValue(seed <= 0xffffffff, 'Seed exceeds uint32');
  if(parameters)validatePlantParameters(parameters);
  const wood = new Map<string, Cell>();
  const add = (p: Cell) => { wood.set(p.join(','), p); };
  function path(points: readonly Cell[]) {
    let p = [...points[0]] as [number,number,number]; add([...p]);
    for (const target of points.slice(1)) for (const axis of [1,0,2]) {
      while (p[axis] !== target[axis]) { p[axis] += Math.sign(target[axis] - p[axis]); add([...p]); }
    }
  }
  const height = parameters?.heightCells ?? (shape === 'young' ? 24 : shape === 'umbrella' ? 34 : 30);
  const lean = shape === 'young' ? 1 : shape === 'umbrella' ? 3 : -2;
  path([[0,0,0],[0,6,0],[lean,14,1],[lean+1,height,2]]);
  const feet: Cell[] = shape === 'buttress' ? [[-14,0,-8],[11,0,-7],[16,0,12],[-10,0,14]]
    : shape === 'umbrella' ? [[-8,0,-5],[7,0,-4],[9,0,6],[-6,0,9]] : [[-4,0,-3],[4,0,-2],[5,0,4],[-3,0,5]];
  const scaledFeet:Cell[]=feet.map((foot)=>[Math.round(foot[0]*(parameters?.rootScale01??1)),foot[1],Math.round(foot[2]*(parameters?.rootScale01??1))]);
  for (const foot of scaledFeet) path([[0,6,0],[Math.trunc(foot[0]/2),6,Math.trunc(foot[2]/2)],[foot[0],2,foot[2]],foot]);
  const reach = shape === 'young' ? 5 : shape === 'umbrella' ? 13 : 9;
  const tips: Cell[] = [[lean-reach,height-2,-5],[lean+reach,height-1,4],[lean-3,height+2,reach],[lean+5,height,-reach],[lean+reach-3,height+1,-8]];
  const decor = tips.map((tip, index) => {
    path([[lean+1,height,2],[tip[0],height,2],tip]);
    const cells: Cell[] = []; const radius = parameters?.crownRadiusCells ?? (shape === 'young' ? 3 : shape === 'umbrella' ? 6 : 5);
    for (let x=-radius;x<=radius;x++) for(let z=-radius;z<=radius;z++) for(let y=0;y<3;y++) {
      if ((x*x+z*z)/(radius*radius) + y*y/12 <= 1 && !(x===radius && z>0)) cells.push([tip[0]+x,tip[1]+y+1,tip[2]+z]);
    }
    return { id: `decor:${shape}:${index}`, supportId: `wood/${tip.join('/')}`, cells, stiffness: 0.65 + seeded(seed, `lobe:${index}`) * 0.3, massKg: 0 as const };
  });
  // The descending root passes its midpoint at y=2; the actual free arch cell is directly below it.
  const emptyArchCells: Cell[] = scaledFeet.map((foot) => [Math.trunc(foot[0]/2),1,Math.trunc(foot[2]/2)] as Cell).filter((cell) => !wood.has(cell.join(',')));
  const cells = [...wood.values(), ...decor.flatMap((d) => d.cells)];
  return freezeJson({ shape, seed, quantumMeters: 0.125, wood: [...wood.values()].sort((a,b)=>lexical(a.join(','),b.join(','))).map((cell)=>({id:`wood/${cell.join('/')}`,cell,massKg:1 as const})),
    decor, emptyArchCells, bounds: bounds(cells) });
}

function validatePlantParameters(value:PlantParameters){keys(value,['shape','heightCells','crownRadiusCells','rootScale01']);requireValue(value.shape==='mixed'||shapes.includes(value.shape),'Unknown family');integer(value.heightCells,16);requireValue(value.heightCells<=48,'Height exceeds 48 cells');integer(value.crownRadiusCells,1);requireValue(value.crownRadiusCells<=8,'Crown exceeds 8 cells');finite(value.rootScale01,0.25,1);}
export function buildPatchRecipe(input: unknown): PatchRecipe {
  keys(input, ['seed','density01','maxSlope01','candidates','plant'],['seed','density01','maxSlope01','candidates']); const raw = input as PatchParameters;
  if(raw.plant)validatePlantParameters(raw.plant);
  integer(raw.seed); requireValue(raw.seed<=0xffffffff,'Seed exceeds uint32'); finite(raw.density01,0,1); finite(raw.maxSlope01,0,1);
  array(raw.candidates); requireValue(raw.candidates.length<=64,'Patch exceeds 64 habitat sites');
  for(const site of raw.candidates) {
    keys(site,['id','positionMeters','slope01','water','clearing']); id(site.id); requireValue(site.id.length<=90,'Site ID leaves no room for generated owner/source identities');vector(site.positionMeters); finite(site.slope01,0,1);
    requireValue(typeof site.water==='boolean' && typeof site.clearing==='boolean','Invalid habitat flags');
    requireValue(site.positionMeters.every((v)=>Math.abs(v)<=1000 && Number.isSafeInteger(v/0.125)),'Habitat position must lie on bounded microvoxel lattice');
  }
  unique(raw.candidates.map((site)=>site.id));
  const parameters = JSON.parse(canonicalJson({...raw,candidates:[...raw.candidates].sort((a,b)=>lexical(a.id,b.id))})) as PatchParameters;
  const eligible=parameters.candidates.filter((site)=>!site.clearing && site.slope01<=parameters.maxSlope01 && seeded(parameters.seed,site.id)<parameters.density01);
  const plants=eligible.filter((site)=>!site.water).map((site)=>({id:`plant:${site.id}`,ownerId:`plant:${site.id}`,positionMeters:site.positionMeters,
    recipe:buildPlantRecipe(parameters.plant&&parameters.plant.shape!=='mixed'?parameters.plant.shape:shapes[Math.floor(seeded(parameters.seed,`shape:${site.id}`)*shapes.length)],parameters.seed,parameters.plant)}));
  const undergrowth=eligible.map((site)=>({id:`under:${site.id}`,type:site.water?'reed' as const:'accent' as const,positionMeters:site.positionMeters,
    cells:site.water?[[0,0,0],[0,1,0],[0,2,0],[1,0,0],[1,1,0],[1,2,0],[1,3,0],[2,0,0],[2,1,0]] as Cell[]
      :[[0,0,0],[1,0,0],[-1,0,0],[0,0,1],[0,1,0],[1,1,0],[0,2,0]] as Cell[],supportId:`ground:${site.id}`,massKg:0 as const}));
  const allBounds=[...plants.map((p)=>({min:p.recipe.bounds.min.map((v,i)=>v+p.positionMeters[i]),max:p.recipe.bounds.max.map((v,i)=>v+p.positionMeters[i])})),
    ...undergrowth.map((p)=>bounds(p.cells,p.positionMeters))];
  const patchBounds={min:[0,1,2].map((axis)=>allBounds.length?Math.min(...allBounds.map((b)=>b.min[axis])):0) as unknown as Vec3,
    max:[0,1,2].map((axis)=>allBounds.length?Math.max(...allBounds.map((b)=>b.max[axis])):0) as unknown as Vec3};
  return freezeJson({schema:'hestia-rd-patch-v1',art:'PROVISIONAL',productIntegrated:false,parameters,plants,undergrowth,bounds:patchBounds});
}

/** Import accepts only an exact reproducible lab recipe, never arbitrary generated-cell overrides. */
export function validatePatchRecipe(input: unknown): PatchRecipe {
  keys(input,['schema','art','productIntegrated','parameters','plants','undergrowth','bounds']); const raw=input as PatchRecipe;
  requireValue(raw.schema==='hestia-rd-patch-v1' && raw.art==='PROVISIONAL' && raw.productIntegrated===false,'Unsupported patch version/scope');
  const rebuilt=buildPatchRecipe(raw.parameters); requireValue(canonicalJson(raw)===canonicalJson(rebuilt),'Patch differs from its generator parameters'); return rebuilt;
}
