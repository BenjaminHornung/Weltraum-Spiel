export function readBoundRow(row:unknown){
  let path:unknown,bytes:unknown,sha256:unknown;
  if(Array.isArray(row)){
    if(row.length!==4)throw new Error("Unsupported compiler tuple");
    [path,bytes,sha256]=row;
  }else if(row!==null&&typeof row==="object"){
    ({path,bytes,sha256}=row as Record<string,unknown>);
  }else throw new Error("Unsupported compiler row");
  if(typeof path!=="string"||!path.trim())throw new Error("Physical file path must be a nonempty string");
  if(typeof bytes!=="number"||!Number.isSafeInteger(bytes)||bytes<0)throw new Error("Invalid byte count");
  if(typeof sha256!=="string"||!/^[a-f0-9]{64}$/.test(sha256))throw new Error("Invalid SHA256");
  return {path,bytes,sha256};
}

