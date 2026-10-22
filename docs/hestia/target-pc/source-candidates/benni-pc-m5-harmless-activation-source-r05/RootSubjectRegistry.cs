using System;using System.IO;using System.Text;using System.Text.Json;using System.Collections.Generic;using System.Globalization;
namespace Hestia.M5.Native24Source {public static partial class Native24Family {
 private sealed class RootSubjectRegistry {
  private sealed class Entry {public Dictionary<string,string> Data;public OwnedHandle Handle;public string RecordId,RecordHash;public bool Closed;public readonly HashSet<string> ProbeNonces=new HashSet<string>(StringComparer.Ordinal);}
  private readonly Dictionary<string,Entry> entries=new Dictionary<string,Entry>(StringComparer.Ordinal);
  private readonly HashSet<string> used=new HashSet<string>(StringComparer.Ordinal);
  private readonly Dictionary<string,Dictionary<string,string>> prechecks=new Dictionary<string,Dictionary<string,string>>(StringComparer.Ordinal);
  private readonly Dictionary<string,string> root;
  private readonly OwnedHandle job;private readonly Action verifyBoundary;
  private readonly List<string> order=new List<string>();
  public bool RegistryZero{get{return entries.Count==0&&prechecks.Count==0;}}
  public RootSubjectRegistry(Dictionary<string,string>f,OwnedHandle j,Action boundary){root=new Dictionary<string,string>(f,StringComparer.Ordinal);job=j;verifyBoundary=boundary;}
  private string Key(Dictionary<string,string>d){return Field(d,"pid")+"-"+Field(d,"creation")+"-"+Field(d,"registrationNonce");}
  private void Clock(){ulong n=GetTickCount64();long u=DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();Require(n>=checked((ulong)Canonical(Field(root,"issued")))&&n<=checked((ulong)Canonical(Field(root,"overallEnd")))&&u>=Canonical(Field(root,"utcIssued"))&&u<=Canonical(Field(root,"utcEnd")),"ROOT_SUBJECT_ORIGINAL_CLOCK");}
  private void Scope(Dictionary<string,string>d){
   verifyBoundary();Clock();foreach(var k in new[]{"grantId","suiteToken","controllerPid","controllerCreation","hostPid","hostCreation","nativeOrigin","issued","workEnd","overallEnd","utcIssued","utcEnd"})Require(Field(d,k)==Field(root,k),"ROOT_SUBJECT_SCOPE:"+k);
   Require(Field(d,"packageHash")==Field(root,"packageRecordSha256")&&Field(d,"contextHash")==Field(root,"contextRecordSha256")&&Field(d,"consumedHash")==Field(root,"consumedSha256"),"ROOT_SUBJECT_EXTERNAL_BYTES");
  }
  private Entry Known(uint pid,string creation){
   foreach(var e in entries.Values)if(!e.Closed&&Field(e.Data,"pid")==pid.ToString(CultureInfo.InvariantCulture)&&Field(e.Data,"creation")==creation){Require(WaitForSingleObject(e.Handle.Value,0)==WaitTimeout,"ROOT_SUBJECT_CREATOR_NOT_LIVE");return e;}
   throw new InvalidOperationException("ROOT_SUBJECT_UNKNOWN_CREATOR_OR_OWNER");
  }
  private void Actual(Dictionary<string,string>d,OwnedHandle h,bool precheck){
   uint pid=ProcessId(h.Value),parent=ParentProcessId(h.Value);long creation=CreationTime(h.Value);string image=ImagePath(h.Value);
   Require(pid==uint.Parse(Field(d,"pid"),CultureInfo.InvariantCulture),"ROOT_SUBJECT_PID");
   Require(precheck||creation==Canonical(Field(d,"creation")),"ROOT_SUBJECT_CREATION");
   Require(parent==uint.Parse(Field(d,"parentPid"),CultureInfo.InvariantCulture)&&String.Equals(image,Full(Field(d,"image")),StringComparison.OrdinalIgnoreCase),"ROOT_SUBJECT_PARENT_IMAGE");
   bool member;Win32(IsProcessInJob(h.Value,job.Value,out member),"Root exact outer job");Require(member,"ROOT_SUBJECT_WRONG_OUTER_JOB");
   Require(WaitForSingleObject(h.Value,0)==WaitTimeout,"ROOT_SUBJECT_NOT_LIVE");
   Entry creator=Known(parent,Field(d,"creatorCreation"));Require(Field(creator.Data,"image")==Field(d,"creatorImage")&&Field(d,"creatorPid")==parent.ToString(CultureInfo.InvariantCulture),"ROOT_SUBJECT_ACTUAL_CREATOR");
   Require((Field(d,"role")=="Observer"||Field(d,"role")=="Supervisor"||Field(d,"role")=="canary")?Field(creator.Data,"role")=="Controller":Field(d,"role")=="root"?Field(creator.Data,"role")=="Supervisor":Field(d,"role")=="child"||Field(d,"role")=="sibling"?Field(creator.Data,"role")=="root":Field(d,"role")=="grandchild"&&Field(creator.Data,"role")=="child","ROOT_SUBJECT_FIXED_TOPOLOGY");
   string scenario=Field(d,"scenario");Scenario(scenario);
   string output=QualificationOutputRoot(Field(root,"suiteToken"),Scenario(scenario)),request=Full(Field(d,"requestPath"));
   Require(Path.GetDirectoryName(request)==Full(output),"ROOT_SUBJECT_FIXED_REQUEST_DIRECTORY");
   Require(Field(d,"requestSha256")==HashFile(request),"ROOT_SUBJECT_REQUEST_BYTES");
   d["creation"]=creation.ToString(CultureInfo.InvariantCulture);d["image"]=image;Clock();
  }
  private Dictionary<string,string> Reply(Dictionary<string,string>d,string response,string id,string hash){
   var r=new Dictionary<string,string>(d,StringComparer.Ordinal);r["schema"]=response=="RETIRED"?"hestia.m5.subject.closed.v1":"hestia.m5.subject.ack.v1";
   r["recordId"]=id;r["recordSha256"]=hash;r["observedNative"]=GetTickCount64().ToString(CultureInfo.InvariantCulture);r["observedUtc"]=DateTimeOffset.UtcNow.ToUnixTimeMilliseconds().ToString(CultureInfo.InvariantCulture);r["registryCount"]=entries.Count.ToString(CultureInfo.InvariantCulture);r["response"]=response;Clock();return r;
  }
  private void ValidateHeldAtBoundary(Dictionary<string,string>d,OwnedHandle h){
   bool member;Win32(IsProcessInJob(h.Value,job.Value,out member),"ROOT_PUBLICATION_EXACT_JOB");
   Require(member&&WaitForSingleObject(h.Value,0)==WaitTimeout&&ProcessId(h.Value)==uint.Parse(Field(d,"pid"),CultureInfo.InvariantCulture)&&CreationTime(h.Value)==Canonical(Field(d,"creation"))&&ParentProcessId(h.Value)==uint.Parse(Field(d,"parentPid"),CultureInfo.InvariantCulture)&&ImagePath(h.Value)==Field(d,"image"),"ROOT_PUBLICATION_LATE_ACTUAL_SUBJECT");
  }
  private string PublishSubject(Dictionary<string,string>d,string id,OwnedHandle subject){
   string dir=Path.Combine(RootConsumedPath,Field(root,"grantId")+".subjects");EnsureNoReparse(RootConsumedPath,@"C:\IFI_SourceCode");Directory.CreateDirectory(dir);EnsureNoReparse(dir,RootConsumedPath);
   string path=Path.Combine(dir,id+".json");byte[] bytes=Encoding.UTF8.GetBytes(JsonSerializer.Serialize(d));verifyBoundary();ValidateHeldAtBoundary(d,subject);Clock();
   using(var s=new FileStream(path,FileMode.CreateNew,FileAccess.Write,FileShare.Read)){s.Write(bytes,0,bytes.Length);s.Flush(true);}
   string hash=HashFile(path);verifyBoundary();ValidateHeldAtBoundary(d,subject);Clock();return hash;
  }
  public Dictionary<string,string> Bootstrap(BoundProcess controller){
   var d=SubjectProtocol.Request(SubjectProtocol.Register,root,"Controller","NONE","0","NONE","NONE");
   d["pid"]=controller.Pid.ToString(CultureInfo.InvariantCulture);d["creation"]=CreationTime(controller.Process.Value).ToString(CultureInfo.InvariantCulture);d["parentPid"]=ProcessId(GetCurrentProcess()).ToString(CultureInfo.InvariantCulture);d["image"]=ImagePath(controller.Process.Value);
   d["creatorPid"]=Field(root,"hostPid");d["creatorCreation"]=Field(root,"hostCreation");d["creatorImage"]=PowerShellPath;SubjectProtocol.Holder(d);d["sourceHandle"]=controller.Process.Value.ToInt64().ToString(CultureInfo.InvariantCulture);
   bool member;Win32(IsProcessInJob(controller.Process.Value,job.Value,out member),"bootstrap exact outer Job");Require(member&&WaitForSingleObject(controller.Process.Value,0)==WaitTimeout,"ROOT_CONTROLLER_CUSTODY");
   IntPtr copy;Win32(DuplicateHandle(GetCurrentProcess(),controller.Process.Value,GetCurrentProcess(),out copy,0x00100400,false,0),"Root duplicates known controller query handle");
   var h=new OwnedHandle(copy);string id=Key(d);try{string hash=PublishSubject(d,id,h);entries.Add(id,new Entry{Data=d,Handle=h,RecordId=id,RecordHash=hash});entries[id].ProbeNonces.Add(Field(d,"probeNonce"));order.Add(id);used.Add(Field(d,"registrationNonce"));return Reply(d,"REGISTERED",id,hash);}catch{h.CloseChecked();throw;}
  }
  public Dictionary<string,string> Handle(string header,Dictionary<string,string>d){
   Scope(d);
   if(header==SubjectProtocol.Retire)return Retire(d);
   Require(header==SubjectProtocol.Register,"ROOT_SUBJECT_REQUEST_HEADER");
   if(Field(d,"mode")=="PROBE")return Probe(d);
   Require(Field(d,"mode")=="REGISTER"||Field(d,"mode")=="PRECHECK","ROOT_SUBJECT_REGISTER_MODE");
   Require(!used.Contains(Field(d,"registrationNonce")),"ROOT_SUBJECT_NONCE_REUSE");
   if(Field(d,"mode")=="PRECHECK"){
    Require(Field(d,"sourceHandle")=="0"&&Field(d,"handleOwnerPid")==Field(root,"controllerPid"),"ROOT_NODE_PRECHECK_OWNER");
    var h=new OwnedHandle(OpenProcess(0x00100400,false,uint.Parse(Field(d,"pid"),CultureInfo.InvariantCulture)));
    try{Actual(d,h,true);Require(!prechecks.ContainsKey(Field(d,"registrationNonce")),"ROOT_PRECHECK_REPLAY");prechecks[Field(d,"registrationNonce")]=new Dictionary<string,string>(d,StringComparer.Ordinal);return Reply(d,"PRECHECKED","NONE","NONE");}finally{h.CloseChecked();}
   }
   Dictionary<string,string> prepared=null;bool nodeProposal=Field(d,"role")=="child"||Field(d,"role")=="grandchild"||Field(d,"role")=="sibling";
   if(nodeProposal){Require(prechecks.TryGetValue(Field(d,"registrationNonce"),out prepared),"ROOT_NODE_MATCHING_PRECHECK_REQUIRED");foreach(var k in new[]{"pid","creation","parentPid","image","creatorPid","creatorCreation","creatorImage","role","scenario","ordinal","requestPath","requestSha256","controllerPid","controllerCreation","grantId","packageHash","contextHash","consumedHash","issued","overallEnd","utcEnd"})Require(Field(prepared,k)==Field(d,k),"ROOT_PRECHECK_EXACT_BINDING:"+k);}
   Entry holder=Known(uint.Parse(Field(d,"handleOwnerPid"),CultureInfo.InvariantCulture),Field(d,"handleOwnerCreation"));
   Require((Field(holder.Data,"role")=="Controller"||Field(holder.Data,"role")=="Supervisor")&&Field(holder.Data,"image")==Field(d,"handleOwnerImage"),"ROOT_SOURCE_PROCESS_HOLDER");
   // This separately owned SOURCE-PROCESS handle includes PROCESS_DUP_HANDLE; SUBJECT gets query/synchronize only.
   var source=new OwnedHandle(OpenProcess(0x00100440,false,uint.Parse(Field(d,"handleOwnerPid"),CultureInfo.InvariantCulture)));
   OwnedHandle owned=null;Exception failure=null;try{
    Require(CreationTime(source.Value)==Canonical(Field(d,"handleOwnerCreation"))&&ImagePath(source.Value)==Field(d,"handleOwnerImage"),"ROOT_SOURCE_PROCESS_IDENTITY");
    long sourceValue=Canonical(Field(d,"sourceHandle"));Require(sourceValue>0,"ROOT_NEVER_ADOPTS_CALLER_ROOT_HANDLE");
    IntPtr target;Win32(DuplicateHandle(source.Value,new IntPtr(sourceValue),GetCurrentProcess(),out target,0x00100400,false,0),"Root subject direction/source holder");
    owned=new OwnedHandle(target);Actual(d,owned,false);
    string id=Key(d);Require(!entries.ContainsKey(id),"ROOT_DUPLICATE_REGISTRATION");string hash=PublishSubject(d,id,owned);
    entries.Add(id,new Entry{Data=new Dictionary<string,string>(d,StringComparer.Ordinal),Handle=owned,RecordId=id,RecordHash=hash});owned=null;entries[id].ProbeNonces.Add(Field(d,"probeNonce"));order.Add(id);used.Add(Field(d,"registrationNonce"));prechecks.Remove(Field(d,"registrationNonce"));Clock();return Reply(d,"REGISTERED",id,hash);
   }catch(Exception e){failure=e;throw;}
   finally{
    try{if(owned!=null)owned.CloseChecked();}catch(Exception e){CaptureCleanupFailure(ref failure,e);}
    try{source.CloseChecked();}catch(Exception e){CaptureCleanupFailure(ref failure,e);}
    if(failure!=null)throw failure;
   }
  }
  private Dictionary<string,string> Probe(Dictionary<string,string>d){
   Entry e;Require(entries.TryGetValue(Key(d),out e)&&!e.Closed,"ROOT_PROBE_UNKNOWN_OR_CLOSED");
   Require(Field(d,"probeNonce")!=Field(e.Data,"probeNonce")&&e.ProbeNonces.Add(Field(d,"probeNonce")),"ROOT_PROBE_FRESH_NONCE_ONCE");
   foreach(var k in new[]{"pid","creation","parentPid","image","role","scenario","ordinal","requestPath","requestSha256","creatorPid","creatorCreation","creatorImage"})Require(Field(d,k)==Field(e.Data,k),"ROOT_PROBE_BINDING:"+k);
   Require(WaitForSingleObject(e.Handle.Value,0)==WaitTimeout&&CreationTime(e.Handle.Value)==Canonical(Field(d,"creation"))&&ProcessId(e.Handle.Value)==uint.Parse(Field(d,"pid"),CultureInfo.InvariantCulture),"ROOT_PROBE_ACTUAL_LIVE_HANDLE");
   bool member;Win32(IsProcessInJob(e.Handle.Value,job.Value,out member),"Root probe exact job");Require(member,"ROOT_PROBE_JOB");e.Data["probeNonce"]=Field(d,"probeNonce");Clock();return Reply(d,"PROBED",e.RecordId,e.RecordHash);
  }
  private Dictionary<string,string> Retire(Dictionary<string,string>d){
   Entry e;Require(entries.TryGetValue(Key(d),out e)&&!e.Closed,"ROOT_DOUBLE_OR_UNKNOWN_RETIRE");
   foreach(var k in new[]{"pid","creation","parentPid","role","scenario","requestSha256"})Require(Field(d,k)==Field(e.Data,k),"ROOT_RETIRE_BINDING");
   Require(WaitForSingleObject(e.Handle.Value,0)==WaitObject0&&CreationTime(e.Handle.Value)==Canonical(Field(d,"creation")),"ROOT_RETIRE_NEEDS_ACTUAL_TERMINAL");e.Handle.CloseChecked();e.Closed=true;entries.Remove(e.RecordId);Clock();
   string dir=Path.Combine(RootConsumedPath,Field(root,"grantId")+".subjects"),path=Path.Combine(dir,e.RecordId+".closed.json");var reply=Reply(d,"RETIRED",e.RecordId,e.RecordHash);verifyBoundary();Clock();using(var s=new FileStream(path,FileMode.CreateNew,FileAccess.Write,FileShare.Read)){byte[] b=Encoding.UTF8.GetBytes(JsonSerializer.Serialize(reply));s.Write(b,0,b.Length);}verifyBoundary();Clock();return reply;
  }
  public void ReleasePendingAfterOuterZero(){Require(QueryAccounting(job.Value).ActiveProcesses==0&&QueryMembers(job.Value,0).Length==0,"ROOT_PENDING_PRECHECK_CLEANUP_NEEDS_OUTER_ZERO");prechecks.Clear();}
  public void CloseTerminalReverse(){
   Exception failure=null;
   for(int i=order.Count-1;i>=0;i--){
    Entry e;if(!entries.TryGetValue(order[i],out e))continue;
    try{Require(WaitForSingleObject(e.Handle.Value,0)==WaitObject0,"ROOT_REGISTRY_SUBJECT_STILL_LIVE");var d=new Dictionary<string,string>(e.Data,StringComparer.Ordinal);d["schema"]="hestia.m5.subject.retire.v1";d["mode"]="RETIRE";d["probeNonce"]=Guid.NewGuid().ToString("D");Retire(d);}catch(Exception error){CaptureCleanupFailure(ref failure,error);}
   }
   try{Require(RegistryZero,"ROOT_REGISTRY_NOT_ZERO");}catch(Exception error){CaptureCleanupFailure(ref failure,error);}
   if(failure!=null)throw failure;
  }
 }
}}
