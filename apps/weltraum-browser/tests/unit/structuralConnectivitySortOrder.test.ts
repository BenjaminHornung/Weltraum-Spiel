import {expect,it} from "vitest";
import {ingestHvpStructuralCells} from "../../src/hestia-prototype/terrain/structuralIngest";
import {
  StructuralConnectivityError,
  compareStructuralCellAddresses,
  deriveStructuralComponentClassification,
  serializeStructuralCellAddress,
  type StructuralObject
} from "../../src/voxel/structural";
import {compareOccupiedEntries,createStructuralOccupiedEntriesCursor} from "../../src/voxel/structural/occupiedEntries";

const wood=[{materialId:1,densityKgPerCubicMeter:512,structuralClass:"wood",destructible:true,tags:null}];
const budgets={maxVisitedCells:32_768,maxComponents:32,maxIndexedFacts:262_144};
// Two components over many 16-cell bricks along x (origins 0..144, where lexical "144" < "16"),
// one of them also crossing a y brick boundary, and a third single-cell component.
const cells=[
  ...Array.from({length:71},(_,x)=>({x,y:0,z:0,materialId:1})),
  ...Array.from({length:70},(_,i)=>({x:90+i,y:0,z:0,materialId:1})),
  {x:100,y:1,z:0,materialId:1},
  ...Array.from({length:20},(_,y)=>({x:150,y:1+y,z:0,materialId:1})),
  {x:40,y:30,z:3,materialId:1}
];

it("orders component cells exactly like the unchanged public comparator across adversarial multi-brick keys",()=>{
  const source=ingestHvpStructuralCells("sort-order-source",cells,wood);
  const classification=deriveStructuralComponentClassification(source,budgets);
  expect(classification.components).toHaveLength(3);
  expect(classification.components.reduce((n,c)=>n+c.occupiedCells.length,0)).toBe(cells.length);
  let lexicalDiffersFromNumeric=false;
  for(const component of classification.components){
    const oracle=[...component.occupiedCells].sort(compareStructuralCellAddresses);
    expect(component.occupiedCells).toEqual(oracle);
    for(let i=1;i<component.occupiedCells.length;i+=1){
      expect(compareStructuralCellAddresses(component.occupiedCells[i-1]!,component.occupiedCells[i]!)).toBeLessThan(0);
      if(component.occupiedCells[i-1]!.brickKey.originQuantum.x>component.occupiedCells[i]!.brickKey.originQuantum.x){
        lexicalDiffersFromNumeric=true;
      }
    }
    expect(component.smallestOccupiedCellKey).toBe(serializeStructuralCellAddress(oracle[0]!));
  }
  // The fixture really exercises the serialized-key (not numeric-origin) ordering.
  expect(lexicalDiffersFromNumeric).toBe(true);
  // Deterministic IDs/hashes for an identical source.
  expect(JSON.stringify(deriveStructuralComponentClassification(source,budgets))).toBe(JSON.stringify(classification));
});

type Cursor=ReturnType<typeof createStructuralOccupiedEntriesCursor>;
const drain=(cursor:Cursor,units:number)=>{
  for(let advances=1;;advances+=1){
    const step=cursor.advance(units);
    if(step.done){return {value:step.value,advances};}
  }
};
/** A non-frozen getter copy of the source that counts each cell/brick read, like a borrowed caller object. */
const counting=(source:StructuralObject,invalidAt?:number)=>{
  const reads={localIndex:0,cells:0};
  let ordinal=0;
  const bricks=source.bricks.map(brick=>{
    const cells=brick.cells.map(cell=>{
      const index=ordinal++;
      return Object.defineProperties({},{
        localIndex:{enumerable:true,get:()=>{reads.localIndex+=1;return index===invalidAt?99_999:cell.localIndex;}},
        state:{enumerable:true,value:cell.state}
      });
    });
    return Object.defineProperty({...brick},"cells",{enumerable:true,get:()=>{reads.cells+=1;return cells;}});
  });
  return {object:{...source,bricks} as unknown as StructuralObject,reads};
};
const failure=(run:()=>unknown)=>{
  try{run();}catch(error){
    const e=error as {name:string;code?:string;path?:string;message:string};
    return {name:e.name,code:e.code,path:e.path,message:e.message};
  }
  return undefined;
};

it("drains the occupied-entry subkernel identically at 1/7/64/257 units, one cell read per unit at most",()=>{
  const source=ingestHvpStructuralCells("sort-order-cursor",cells,wood);
  const reference=drain(createStructuralOccupiedEntriesCursor(source,32_768),Number.MAX_SAFE_INTEGER).value;
  expect(reference).toHaveLength(cells.length);
  // Units: one per brick fetch, one per cell, one final completion.
  const units=source.bricks.length+cells.length+1;
  for(const size of [1,7,64,257]){
    const {value,advances}=drain(createStructuralOccupiedEntriesCursor(source,32_768),size);
    expect(JSON.stringify(value)).toBe(JSON.stringify(reference));
    expect(advances).toBe(Math.ceil(units/size));
  }
  const {object,reads}=counting(source);
  const cursor=createStructuralOccupiedEntriesCursor(object,32_768);
  expect(reads).toEqual({localIndex:0,cells:0});
  let step=cursor.advance(1),before={...reads};
  while(!step.done){
    expect(reads.localIndex-before.localIndex).toBeLessThanOrEqual(1);
    expect(reads.cells-before.cells).toBeLessThanOrEqual(1);
    before={...reads};
    step=cursor.advance(1);
  }
  expect(reads).toEqual({localIndex:cells.length,cells:source.bricks.length});
  expect(JSON.stringify(step.value)).toBe(JSON.stringify(reference));
  // The sorted residual equals the unchanged public comparator order.
  const sorted=[...step.value].sort(compareOccupiedEntries).map(entry=>entry.address);
  expect(sorted).toEqual(sorted.slice().sort(compareStructuralCellAddresses));
  // The public synchronous path over the same borrowed getter object is unchanged.
  expect(JSON.stringify(deriveStructuralComponentClassification(object,budgets)))
    .toBe(JSON.stringify(deriveStructuralComponentClassification(source,budgets)));
});

it("keeps empty, budget and competing invalid-cell outcomes identical between the sync path and every unit size",()=>{
  const source=ingestHvpStructuralCells("sort-order-errors",cells,wood);
  const empty=createStructuralOccupiedEntriesCursor({...source,bricks:[]},1).advance(1);
  expect(empty).toEqual({done:true,value:[]});
  const invalidAt=17;
  const cases=[
    {name:"budget N-1",make:()=>source,limit:cells.length-1},
    {name:"invalid cell before its budget",make:()=>counting(source,invalidAt).object,limit:invalidAt+1},
    {name:"budget before the invalid cell",make:()=>counting(source,invalidAt).object,limit:invalidAt}
  ];
  for(const c of cases){
    const expected=failure(()=>deriveStructuralComponentClassification(c.make(),{...budgets,maxVisitedCells:c.limit}));
    expect(expected,c.name).toBeDefined();
    for(const size of [1,7,64,257]){
      const cursor=createStructuralOccupiedEntriesCursor(c.make(),c.limit);
      let thrown:unknown;
      try{drain(cursor,size);}catch(error){thrown=error;}
      expect(failure(()=>{throw thrown;}),`${c.name}/${size}`).toEqual(expected);
      // Sticky original failure object; dispose after failure is a no-op.
      let again:unknown;
      try{cursor.advance(1);}catch(error){again=error;}
      expect(again).toBe(thrown);
      expect(()=>cursor.dispose()).not.toThrow();
    }
  }
  expect(failure(()=>deriveStructuralComponentClassification(source,{...budgets,maxVisitedCells:cells.length-1})))
    .toMatchObject({name:"StructuralConnectivityError",code:"BudgetExceeded",path:"connectivityBudgets/maxVisitedCells"});
  expect(failure(()=>deriveStructuralComponentClassification(counting(source,invalidAt).object,{...budgets,maxVisitedCells:invalidAt})))
    .toMatchObject({name:"StructuralConnectivityError",path:"connectivityBudgets/maxVisitedCells"});
  expect(failure(()=>deriveStructuralComponentClassification(counting(source,invalidAt).object,{...budgets,maxVisitedCells:invalidAt+1})))
    .toMatchObject({name:"StructuralValidationError"});
});

it("rejects invalid, finished and disposed advances and disposes idempotently without touching input or result",()=>{
  const source=ingestHvpStructuralCells("sort-order-lifecycle",cells,wood);
  expect(failure(()=>createStructuralOccupiedEntriesCursor(source,0))).toMatchObject({name:"StructuralValidationError",path:"connectivityBudgets/maxVisitedCells"});
  const cursor=createStructuralOccupiedEntriesCursor(source,32_768);
  for(const units of [0,-1,1.5,Number.NaN,2**53]){
    expect(failure(()=>cursor.advance(units))).toMatchObject({name:"StructuralValidationError",path:"cursor/maxUnits"});
  }
  const {value}=drain(cursor,64);
  const snapshot=JSON.stringify(value);
  expect(failure(()=>cursor.advance(1))).toMatchObject({name:"StructuralValidationError",code:"InvalidContract",path:"cursor"});
  cursor.dispose();cursor.dispose();
  expect(JSON.stringify(value)).toBe(snapshot);
  expect(value).toHaveLength(cells.length);
  // Early dispose closes the borrowed iterator like leaving a for...of, and leaves the input intact.
  let closed=0;
  const brickList=source.bricks;
  const iterable={[Symbol.iterator]:()=>{
    const inner=brickList[Symbol.iterator]();
    return {next:()=>inner.next(),return:()=>{closed+=1;return {done:true as const,value:undefined};}};
  }};
  const partial=createStructuralOccupiedEntriesCursor({...source,bricks:iterable} as unknown as StructuralObject,32_768);
  expect(partial.advance(3)).toEqual({done:false});
  const inputBefore=JSON.stringify(source);
  partial.dispose();partial.dispose();
  expect(closed).toBe(1);
  expect(JSON.stringify(source)).toBe(inputBefore);
  expect(failure(()=>partial.advance(1))).toMatchObject({name:"StructuralValidationError",code:"InvalidContract",path:"cursor"});
});

it("keeps the visited-cell budget rejection unchanged",()=>{
  const source=ingestHvpStructuralCells("sort-order-budget",cells,wood);
  let caught:unknown;
  try{deriveStructuralComponentClassification(source,{...budgets,maxVisitedCells:cells.length-1});}catch(error){caught=error;}
  expect(caught).toBeInstanceOf(StructuralConnectivityError);
  expect(caught).toMatchObject({code:"BudgetExceeded",path:"connectivityBudgets/maxVisitedCells"});
  expect(()=>deriveStructuralComponentClassification(source,{...budgets,maxVisitedCells:cells.length})).not.toThrow();
});
