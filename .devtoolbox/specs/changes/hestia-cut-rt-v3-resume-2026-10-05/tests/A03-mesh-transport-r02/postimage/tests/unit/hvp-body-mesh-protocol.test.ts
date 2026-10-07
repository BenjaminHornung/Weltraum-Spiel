import {expect,it} from "vitest";
import {readHvpBodyMeshAdmissionReply,type HvpBodyProjectionRequest} from "../../src/hestia-prototype/physics/physicsProtocol";
import {byteCount,contentRevision} from "../../src/workers/ids";
import {fnv1aBytes,type TransferableBufferBundle} from "../../src/workers/protocol";

const binding:HvpBodyProjectionRequest={beginRequestId:42,sessionId:"protocol-session",epoch:0,commandId:"protocol-cut",ownerId:"protocol-parent",
  sourceId:"protocol-source",sourceDigest:"fnv1a64-v1:0000000000000000",revision:0,issuedTick:7};
const packet=():TransferableBufferBundle=>{
  const buffers=Array.from({length:7},()=>new ArrayBuffer(4));
  return {buffers,ownership:"WorkerToConsumer",revision:contentRevision(0),byteLength:byteCount(28),contentHash:fnv1aBytes(buffers),
    views:buffers.map((_,i)=>({name:`channel-${i}`,kind:"Uint8Array" as const,bufferIndex:i,byteOffset:0,elementCount:4}))};
};
it("returns only same-Begin bounded mesh data; no native/source certificate is introduced",()=>{
  const output=packet(),read=readHvpBodyMeshAdmissionReply({beginRequestId:42,output},binding);
  expect(read.buffers).toEqual(output.buffers);expect(read.byteLength).toBe(28);expect(read.ownership).toBe("WorkerToConsumer");
  expect(read).not.toHaveProperty("sourceProof");
});
it("rejects old Begin, extra authority fields, changed revision, ownership and malformed byte accounting",()=>{
  const output=packet();
  for(const value of [
    {beginRequestId:41,output},
    {beginRequestId:42,output,sourceProof:{}},
    {beginRequestId:42,output:{...output,revision:1}},
    {beginRequestId:42,output:{...output,ownership:"SenderToWorker"}},
    {beginRequestId:42,output:{...output,byteLength:27}},
    {beginRequestId:42,output:{...output,buffers:output.buffers.slice(0,6)}}
  ]){expect(()=>readHvpBodyMeshAdmissionReply(value,binding)).toThrow();}
});
