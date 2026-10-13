import type {StructuralOwnedReserve} from "../voxel/structural/validation";

/** Private fixed-schema wire reader. Dynamic containers stream; native JSON.parse sees one small atom. */
export function* readHvpSupportJsonSteps(bytes:Uint8Array,reserve?:StructuralOwnedReserve):Generator<string,unknown,unknown>{
  reserve?.(32_768);
  // The original full fatal decode rejects any UTF8 fault before JSON syntax; retain that precedence.
  {const check=new TextDecoder("utf-8",{fatal:true});for(let at=0;at<bytes.length;at+=4096){
    check.decode(bytes.subarray(at,Math.min(at+4096,bytes.length)),{stream:true});yield "supportJsonUtf8";
  }check.decode();}
  const decoder=new TextDecoder("utf-8",{fatal:true});let offset=0,text="",index=0,work=0,ended=false;
  const peek=():string=>{
    while(index===text.length&&!ended){
      if(offset<bytes.length){const end=Math.min(offset+4096,bytes.length);text=decoder.decode(bytes.subarray(offset,end),{stream:true});offset=end;}
      else{text=decoder.decode();ended=true;}index=0;
    }
    return text[index]??"";
  };
  const take=()=>{const c=peek();if(c!==""){index+=1;work+=1;}return c;};
  const whitespace=(c:string)=>c===" "||c==="\n"||c==="\r"||c==="\t";
  function* skip():Generator<string,void,unknown>{while(whitespace(peek())){take();if(work>=512){work=0;yield "supportJson";}}}
  function* atom():Generator<string,unknown,unknown>{
    let token="";
    if(peek()==='"'){
      token=take();let escaped=false;
      for(;;){const c=take();if(c===""){throw new SyntaxError("Incomplete support JSON string");}token+=c;
        if(token.length>8192){throw new Error("Support JSON atom BudgetExceeded");}
        if(c==='"'&&!escaped){break;}escaped=c==="\\"&&!escaped;
        if(work>=512){work=0;yield "supportJson";}
      }
    }else{
      while(peek()!==""&&!whitespace(peek())&&!",]}:".includes(peek())){token+=take();if(token.length>128){throw new SyntaxError("Invalid support JSON atom");}}
    }
    reserve?.(64+token.length*2,true);const value=JSON.parse(token) as unknown;yield "supportJson";return value;
  }
  function* value(depth:number):Generator<string,unknown,unknown>{
    if(depth>32){throw new Error("Support JSON depth BudgetExceeded");}
    yield* skip();const c=peek();
    if(c!=="["&&c!=="{"){return yield* atom();}
    take();reserve?.(128);const array=c==="[";const result:unknown[]|Record<string,unknown>=array?[]:{};
    yield "supportJson";yield* skip();
    const close=array?"]":"}";
    if(peek()===close){take();return result;}
    for(;;){
      let key:string|undefined;
      if(!array){if(peek()!=='"'){throw new SyntaxError("Invalid support JSON key");}key=(yield* atom()) as string;
        yield* skip();if(take()!==":"){throw new SyntaxError("Invalid support JSON member");}}
      reserve?.(array?16:96);const child=yield* value(depth+1);
      if(array){(result as unknown[]).push(child);}
      else{Object.defineProperty(result,key!,{value:child,enumerable:true,writable:true,configurable:true});}
      yield "supportJson";yield* skip();const delimiter=take();if(delimiter===close){return result;}
      if(delimiter!==","){throw new SyntaxError("Invalid support JSON delimiter");}yield* skip();
    }
  }
  try{const result=yield* value(0);yield* skip();if(peek()!==""){throw new SyntaxError("Trailing support JSON input");}return result;}
  finally{text="";bytes=new Uint8Array(0);}
}

/** First-party support literals only: same JSON.stringify field order, no full text or unbounded encode. */
export function* encodeHvpSupportJsonSteps(value:unknown,maximumBytes:number):Generator<string,Uint8Array,unknown>{
  const encoder=new TextEncoder(),scratch=new Uint8Array(24_576);let bytes=0;
  function* emit(entry:unknown,depth:number):Generator<string,void,unknown>{
    if(depth>32){throw new Error("Support JSON depth BudgetExceeded");}
    if(entry===null||typeof entry!=="object"){yield JSON.stringify(entry)??"null";return;}
    if(Array.isArray(entry)){yield "[";for(let i=0;i<entry.length;i+=1){if(i!==0){yield ",";}yield* emit(entry[i],depth+1);}yield "]";return;}
    yield "{";let first=true;
    for(const key of Object.keys(entry)){const child=(entry as Record<string,unknown>)[key];if(child===undefined){continue;}
      if(!first){yield ",";}first=false;yield JSON.stringify(key)+":";yield* emit(child,depth+1);}
    yield "}";
  }
  try{
    // First pass bounds exact UTF8 length; no full text, chunk list or output backing exists yet.
    for(const text of emit(value,0)){
      if(text.length>8192){throw new Error("Support JSON atom BudgetExceeded");}
      const encoded=encoder.encodeInto(text,scratch);if(encoded.read!==text.length){throw new Error("Support JSON incomplete atom encode");}
      bytes+=encoded.written;if(bytes>maximumBytes){throw new Error("Support output BudgetExceeded");}yield "supportJsonEncode";
    }
    const result=new Uint8Array(bytes);let offset=0;
    for(const text of emit(value,0)){const encoded=encoder.encodeInto(text,result.subarray(offset));
      if(encoded.read!==text.length){throw new Error("Support JSON input changed during encode");}offset+=encoded.written;yield "supportJsonEncode";}
    if(offset!==bytes){throw new Error("Support JSON input changed during encode");}return result;
  }finally{value=undefined;}
}
