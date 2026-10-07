import { describe, expect, it } from "vitest";
import { build } from "vite";
import {startHvpRoute} from "../../src/hvp/hvpRoute";

it("presents a failed deferred bootstrap load through the existing accessible HVP boundary",async()=>{
  const elements:{id:string;textContent:string;attributes:Record<string,string>}[]=[];
  const body={dataset:{hestiaPrototypeState:"Ready",hestiaPrototypePhysics:"stale"},append:()=>{}};
  const documentPort={body,querySelector:()=>null,createElement:()=>{
    const element={id:"",textContent:"",attributes:{} as Record<string,string>,append:()=>{},
      setAttribute(name:string,value:string){this.attributes[name]=value;}};
    elements.push(element);return element;
  }} as unknown as Parameters<typeof startHvpRoute>[0];
  await startHvpRoute(documentPort,async()=>{throw new Error("deferred bootstrap unavailable");});
  expect(body.dataset.hestiaPrototypeState).toBe("Error");
  expect(body.dataset.hestiaPrototypePhysics).toBeUndefined();
  expect(elements.find(element=>element.id==="hvp-failure")?.attributes).toEqual({role:"alert","aria-live":"assertive"});
  expect(elements.find(element=>element.id==="hvp-error-detail")?.textContent).toContain("deferred bootstrap unavailable");
});

describe("HVP route bundle boundary", () => {
  it("keeps the HVP bootstrap and route owners outside the static entry dependency graph", async () => {
    const result = await build({
      logLevel: "silent",
      build: { write: false }
    });
    const outputs = (Array.isArray(result) ? result : [result]).flatMap((item) => {
      if (!("output" in item)) throw new Error("Expected a completed production build, not a watcher");
      return item.output;
    });
    const chunks = outputs.filter((item) => item.type === "chunk");
    const entry = chunks.find((chunk) => chunk.isEntry && chunk.facadeModuleId?.endsWith("/index.html"));
    expect(entry, "production HTML entry").toBeDefined();

    const initialModules = new Set<string>();
    const visited = new Set<string>();
    const visit = (fileName: string): void => {
      if (visited.has(fileName)) return;
      visited.add(fileName);
      const chunk = chunks.find((item) => item.fileName === fileName);
      expect(chunk, `static chunk ${fileName}`).toBeDefined();
      for (const id of chunk!.moduleIds) initialModules.add(id.replaceAll("\\", "/"));
      chunk!.imports.forEach(visit);
    };
    visit(entry!.fileName);

    // WorkerPool shares HVP job contracts with normal PG destruction. The
    // HVP route owners must still remain behind the route's dynamic import.
    for (const owner of [
      "/src/hvp/hvpBootstrap.ts",
      "/src/hestia-prototype/physics/client.ts",
      "/src/hestia-prototype/runtime/neighborController.ts",
      "/src/hestia-prototype/persistence/gameCheckpoint.ts",
      "/src/hestia-prototype/player/input.ts"
    ]) {
      expect([...initialModules].filter((id) => id.endsWith(owner)), owner).toEqual([]);
    }
    const bootstrap = chunks.find((chunk) => chunk.moduleIds.some((id) => id.endsWith("/hvp/hvpBootstrap.ts")));
    expect(bootstrap, "deferred bootstrap chunk").toBeDefined();
    expect(visited.has(bootstrap!.fileName)).toBe(false);
  }, 30_000);
});
