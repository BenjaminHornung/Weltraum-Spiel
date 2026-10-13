import {expect,it} from "vitest";
import {readFileSync,existsSync,writeFileSync,mkdirSync} from "node:fs";
import {resolve} from "node:path";
import {prepareHvpCoastSource,materializeHvpCoastSource} from "../snapshot/src/hvp/hvpCoastSource";
import {createHvpTerrainRoot} from "../snapshot/src/hestia-prototype/terrain/cutPlan";
import {collisionSectors} from "../snapshot/src/hestia-prototype/physics/terrainColliders";
import {createHvpPhysicsSession,resolveHvpGravity} from "../snapshot/src/hestia-prototype/physics/session";
import {encodeHvpGame,parseHvpGame} from "../snapshot/src/hestia-prototype/persistence/gameCheckpoint";
import {migrateLegacy,encodeEnvelope,decodeEnvelope,readSave,sha256,canonicalJson} from "../src/capsule";

it("exports and roundtrips an actual authored-coast game save under its unchanged game parser",async()=>{
  const file=resolve("fixtures/legacy-game.json");let bytes:Uint8Array;
  if(existsSync(file)&&process.env.PHY03_EXPORT!=="1"){bytes=new Uint8Array(readFileSync(file));}
  else{
    const root=createHvpTerrainRoot(prepareHvpCoastSource(materializeHvpCoastSource()),"phy03-game",0);
    const session=await createHvpPhysicsSession([...collisionSectors(root.read())],{x:-9,y:8,z:-9},resolveHvpGravity(),
      {spawn:{x:-9,y:2.42,z:-11},coverage:[{minX:-16,maxX:16,minZ:-16,maxZ:16}]});
    try{
      session.pause();const artifact=encodeHvpGame({terrain:root.checkpoint(),plants:[],world:session.checkpoint(),progress:null,
        receipts:{terrain:{version:"hvp-command-receipts-v1",kind:"terrain",entries:[],last:null},
          structural:{version:"hvp-command-receipts-v1",kind:"structural",entries:[],last:null},
          moving:{version:"hvp-command-receipts-v1",kind:"moving",entries:[],last:null}},
        view:{camera:{mode:"Orbit",preset:"C04-WIDE",fov:55,position:{x:-24,y:18,z:-28},target:{x:0,y:1,z:1},quaternion:{x:0,y:0,z:0,w:1}},
          playerYaw:Math.PI,playerPitch:0,thirdPerson:true,waterEnabled:true,aoEnabled:true,
          tool:{mode:2,sequence:0,structureSequence:0,movingSequence:0,edges:1}}});
      bytes=new TextEncoder().encode(canonicalJson(artifact));
      if(process.env.PHY03_EXPORT==="1"){
        mkdirSync("fixtures",{recursive:true});if(existsSync(file)){expect(await sha256(new Uint8Array(readFileSync(file)))).toBe(await sha256(bytes));}
        else{writeFileSync(file,bytes);}
        writeFileSync("fixtures/game-fixture-manifest.json",JSON.stringify({sourceCommit:"17b1db4201a28e7b607c30707bdc2b75e3484a10",
          origin:"hvp-game-save.test.ts beforeAll control recipe; unchanged original generators/codecs",
          path:"fixtures/legacy-game.json",sha256:await sha256(bytes),bytes:bytes.length,personallyIdentifyingData:false},null,2)+"\n");
      }
    }finally{session.dispose();}
  }
  const original=parseHvpGame(bytes),envelope=await migrateLegacy(bytes,"game"),roundtrip=await decodeEnvelope(encodeEnvelope(envelope));
  expect(roundtrip.legacy).toEqual(bytes);expect(parseHvpGame(roundtrip.legacy).checkpoint).toEqual(original.checkpoint);
  expect((await readSave(bytes,"game")).canonical).toEqual(envelope.canonical);
  const foreign={...original.checkpoint,profiles:{...original.checkpoint.profiles,solver:"rapier-0.21.0"}};
  await expect(migrateLegacy(new TextEncoder().encode(JSON.stringify(foreign)),"game")).rejects.toThrow(/schema|profile/i);
  const future={...original.checkpoint,version:"hvp-game-checkpoint-v99"};
  await expect(readSave(new TextEncoder().encode(JSON.stringify(future)),"game")).rejects.toThrow(/schema|profile/i);
},120_000);
