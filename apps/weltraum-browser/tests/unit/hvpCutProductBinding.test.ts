import {expect,it,vi} from "vitest";
import * as fs from "node:fs/promises";
import path from "node:path";
import {fileURLToPath} from "node:url";
import {createHash} from "node:crypto";
import {verifyHvpCutProductBinding} from "../performance/hvpCutRtReport";

vi.mock("node:fs/promises",async original=>({...await original<typeof fs>()}));
const sha=(bytes:string|Buffer)=>createHash("sha256").update(bytes).digest("hex");

it.each(["valid","historic-source","source-changed","omitted-source","build-changed","served-changed","redirected","extra-file","receipt-drift","path-escape","wrong-origin"] as const)(
  "binds actual product bytes and explicit Source provenance (%s)",async mode=>{
  const app=path.resolve(fileURLToPath(new URL("../..",import.meta.url))),wt=path.resolve(app,"../.."),prefix=path.relative(wt,app).replaceAll("\\","/");
  const buildRoot=path.join(app,"evidence","synthetic-build"),servedReceiptPath=path.join(wt,".devtoolbox","synthetic-served.json"),sourceBinding=".devtoolbox/synthetic-source.json";
  const sourceBody=Buffer.from("source"),buildBody=Buffer.from("built"),configBody=Buffer.from("config"),sourceName=`${prefix}/src/fixtüré.ts`,sourceHash=sha(sourceBody),buildHash=sha(buildBody);
  const sourceRow={path:mode==="path-escape"?"../secret":sourceName,bytes:sourceBody.length,sha256:sourceHash};
  const configs=["package.json","package-lock.json","tsconfig.json","vite.config.ts"].map(name=>({path:`${prefix}/${name}`,bytes:configBody.length,sha256:sha(configBody)}));
  const sourceRows=[sourceRow,...configs];
  // Golden Python ensure_ascii/sorted-key grammar, including a Unicode filename.
  const sourceManifestHash=sha(`[${[`{"bytes": 6, "path": "${prefix}/src/fixt\\u00fcr\\u00e9.ts", "sha256": "${sourceHash}"}`,
    ...configs.map(r=>`{"bytes": 6, "path": "${r.path}", "sha256": "${r.sha256}"}`)].join(", ")}]`);
  const built=[{path:"fixture.js",bytes:buildBody.length,sha256:buildHash}];
  const buildManifestHash=sha(`[{"bytes": 5, "path": "fixture.js", "sha256": "${buildHash}"}]`);
  const receipt={classification:"NORMAL_PRODUCT_SERVED_BYTE_PROOF_NOT_GAME_QUALIFICATION",normalProduct:true,sourceBinding,sourceManifestHash,
    sourceFiles:sourceRows.length,servedFiles:1,built,buildManifestHash:mode==="receipt-drift"?"0".repeat(64):buildManifestHash};
  const files=new Map<string,Buffer>([
    [servedReceiptPath,Buffer.from(JSON.stringify(receipt))],
    [path.resolve(wt,sourceBinding),Buffer.from(JSON.stringify({source:sourceRows,sourceManifestHash}))],
    [path.resolve(wt,sourceName),mode==="source-changed"||mode==="historic-source"?Buffer.from("mutated"):sourceBody],
    [path.join(buildRoot,"fixture.js"),mode==="build-changed"?Buffer.from("wrong"):buildBody],
    [path.join(buildRoot,"extra.js"),Buffer.from("extra")],
    [path.join(app,"src","omitted.ts"),Buffer.from("omitted")],
    ...configs.map(r=>[path.resolve(wt,r.path),configBody] as [string,Buffer])
  ]);
  vi.spyOn(fs,"readFile").mockImplementation((async file=>{const bytes=files.get(path.resolve(file as string));if(!bytes){throw new Error("Missing model file");}return bytes;}) as typeof fs.readFile);
  vi.spyOn(fs,"realpath").mockImplementation((async file=>path.resolve(file as string)) as typeof fs.realpath);
  vi.spyOn(fs,"lstat").mockImplementation((async()=>({isSymbolicLink:()=>false,isFile:()=>true})) as unknown as typeof fs.lstat);
  vi.spyOn(fs,"readdir").mockImplementation((async(file:string)=>{
    const dir=path.resolve(file as string),names=dir===path.join(app,"public")?[]:dir===path.join(app,"src")
      ?["fixtüré.ts",...(mode==="omitted-source"?["omitted.ts"]:[])]:["fixture.js",...(mode==="extra-file"?["extra.js"]:[])];
    return names.map(name=>({name,isFile:()=>true,isDirectory:()=>false,isSymbolicLink:()=>false}));
  }) as unknown as typeof fs.readdir);
  const request=vi.fn(async(_url:RequestInfo|URL,options?:RequestInit)=>{
    if(mode==="redirected"&&options?.redirect==="error"){throw new Error("Redirect blocked");}
    return new Response(mode==="served-changed"?Buffer.from("wrong"):buildBody);
  });vi.stubGlobal("fetch",request);
  try{
    const pending=verifyHvpCutProductBinding({app,buildRoot,servedReceiptPath,baseUrl:mode==="wrong-origin"?"https://foreign.invalid":"http://127.0.0.1:5289",currentSource:mode!=="historic-source"});
    if(mode==="valid"||mode==="historic-source"){
      expect(await pending).toMatchObject({sourceManifestHash,buildManifestHash,servedFiles:1,
        sourceProvenance:mode==="historic-source"?"HISTORICAL_SOURCE_BINDING":"CURRENT_SOURCE_BYTES_VERIFIED"});
      expect(request).toHaveBeenCalledTimes(1);expect(String(request.mock.calls[0]?.[0])).toBe("http://127.0.0.1:5289/fixture.js");
      expect(request.mock.calls[0]?.[1]?.redirect).toBe("error");
    }else{await expect(pending).rejects.toThrow();}
  }finally{vi.restoreAllMocks();vi.unstubAllGlobals();}
});
