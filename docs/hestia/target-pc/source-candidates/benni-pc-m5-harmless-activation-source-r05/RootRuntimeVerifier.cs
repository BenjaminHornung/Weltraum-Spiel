using System;
using System.Collections.Generic;
using System.Globalization;
using System.IO;
using System.Text;
using System.Text.Json;
namespace Hestia.M5.Native24Source {
 public static partial class Native24Family {
  private const string RootPackagePath=@"C:\IFI_SourceCode\Temp\WeltraumSpiel\artifacts\hestia-target-pc-2026-10-13\M5_HARMLESS_REVIEWED_PACKAGE.json";
  private const string RootContextPath=@"C:\IFI_SourceCode\Temp\WeltraumSpiel\artifacts\hestia-target-pc-2026-10-13\M5_HARMLESS_RUNTIME_CONTEXT.json";
  private const string RootGrantPath=@"C:\IFI_SourceCode\Temp\WeltraumSpiel\artifacts\hestia-target-pc-2026-10-13\M5_HARMLESS_RUNTIME_GRANT.json";
  private const string RootConsumedPath=@"C:\IFI_SourceCode\Temp\WeltraumSpiel\artifacts\hestia-target-pc-2026-10-13\M5_HARMLESS_CONSUMED";
  private const string CoreLibrarySha="76a49f17e83f613bc8a5b55fc98830b764e7838265aacbdbcc8f46707f80a3c9";
  private static Dictionary<string,string> FlatJson(string json){
   Require(json!=null&&json.Length<=65536,"DATA_HOLD_FRAME_BOUND");
   var result=new Dictionary<string,string>(StringComparer.Ordinal);
   using(var d=JsonDocument.Parse(json)){Require(d.RootElement.ValueKind==JsonValueKind.Object,"DATA_HOLD_OBJECT");foreach(var p in d.RootElement.EnumerateObject()){Require(p.Value.ValueKind==JsonValueKind.String&&!result.ContainsKey(p.Name),"DATA_HOLD_DUPLICATE_OR_NONSTRING");result.Add(p.Name,p.Value.GetString());}}
   return result;
  }
  private static Dictionary<string,string> RootRecord(string path,string schema,string fields){
   EnsureNoReparse(path,@"C:\IFI_SourceCode");var r=FlatJson(File.ReadAllText(path));
   Require(RequiredRootField(r,"schema")==schema&&RequiredRootField(r,"version")=="1","DATA_HOLD_SCHEMA");
   var keys=fields.Split(' ');Require(r.Count==keys.Length,"DATA_HOLD_UNKNOWN_RECORD_FIELDS");foreach(var k in keys)RequiredRootField(r,k);return r;
  }
  private static string Field(IReadOnlyDictionary<string,string> d,string key){return RequiredRootField(d,key);}
  private static void ObserveExpectedProcess(Dictionary<string,string> e,Dictionary<string,string> o,string prefix){
   uint id=checked((uint)Canonical(Field(e,prefix+"ProcessId")));IntPtr raw=OpenProcess(ProcessQueryInformation|ProcessQueryLimitedInformation|Synchronize,false,id);
   var h=new OwnedHandle(raw);try{
    Require(WaitForSingleObject(h.Value,0)==WaitTimeout,"DATA_HOLD_ACTUAL_PROCESS_TERMINAL");
    o[prefix+"ProcessId"]=ProcessId(h.Value).ToString(CultureInfo.InvariantCulture);o[prefix+"Creation"]=CreationTime(h.Value).ToString(CultureInfo.InvariantCulture);o[prefix+"Image"]=ImagePath(h.Value);o[prefix+"ParentPid"]=ParentProcessId(h.Value).ToString(CultureInfo.InvariantCulture);
    foreach(var k in new[]{"ProcessId","Creation","Image","ParentPid"})Require(Field(e,prefix+k)==Field(o,prefix+k),"DATA_HOLD_ACTUAL_"+prefix+k);
   }finally{h.CloseChecked();}
  }
  private sealed class RootRuntimeVerifier : IExternalRootRuntimeVerifier {
   private Dictionary<string,string> frame;
   public bool HasFrame{get{return frame!=null;}}
   public Dictionary<string,string> Snapshot(){Require(frame!=null,"private frame missing");return new Dictionary<string,string>(frame,StringComparer.Ordinal);}
   public void SetEntryFrame(string line){Require(frame==null,"one native frame");frameLine=line;frame=FlatJson(line);ValidateFrame();}
   private string frameLine;
   private bool acknowledged;
   private static readonly HashSet<string> Phases=new HashSet<string>(new[]{"native-pre-effects","native-after-bytes","native-before-ack","before-suite-startup","role-before-body","bound-run"},StringComparer.Ordinal);
   private sealed class RootData {public Dictionary<string,string> Package,Context,Grant,Spent;public string PackageHash,ContextHash,GrantHash,SpentHash;}
   private RootData ReadRootRecords(){
    var p=RootRecord(RootPackagePath,"hestia.m5.package.v1","schema version packageId ownerNative sourceRoot packagePinsSha256 nodeSha256 powerShellSha256 dllSha256 fixtureSha256 coreLibrarySha256 profile scenarios roles");
    var c=RootRecord(RootContextPath,"hestia.m5.context.v1","schema version contextId packageId packageRecordSha256 ownerNative ownerProcessId ownerCreation ownerImage ownerParentPid runnerId runnerProcessId runnerCreation runnerImage runnerParentPid paseoAgent workspace leaseId leaseExpiresUtc capacity outputExclusive outputCustodyId suiteToken nativeOrigin nativeClockDomain nativeClockApi utcClockApi clockMode issued workEnd overallEnd utcIssued utcEnd sourceRoot suiteOutputRoot hostParentPid hostParentCreation hostParentImage hostParentParentPid nodeOrigins bootStamp");
    var g=RootRecord(RootGrantPath,"hestia.m5.grant.v1","schema version grantId contextId contextRecordSha256 packageId scope authorizationClass humanMessageRef humanMessageSha256 retry suiteToken outputCustodyId notBeforeUtc expiresUtc");
    Require(Field(p,"sourceRoot")==SourceRoot&&Field(c,"sourceRoot")==SourceRoot,"DATA_HOLD_FIXED_SOURCE_ROOT");
    Require(Field(p,"ownerNative")=="01a13648-c55b-7250-bf07-34921d70b43b"&&Field(c,"ownerNative")==Field(p,"ownerNative"),"DATA_HOLD_OWNER");
    Require(Field(g,"scope")=="HARMLESS_SIX_ONCE"&&Field(g,"authorizationClass")=="DIRECT_HUMAN_RUNTIME_ONCE"&&Field(g,"retry")=="0","DATA_HOLD_SCOPE");
    Require(Field(g,"humanMessageRef")!="call_f75fff55e3a34653b255fd83365457ca"&&Field(g,"humanMessageRef").IndexOf("r05",StringComparison.OrdinalIgnoreCase)<0&&Field(g,"humanMessageRef").IndexOf("source",StringComparison.OrdinalIgnoreCase)<0&&HashShape(Field(g,"humanMessageSha256")),"DATA_HOLD_NOT_RUNTIME_AUTHORITY");
    Require(Field(p,"profile")=="WINDOWS_PWSH7.6.4_NET10.0.10_GETTICKCOUNT64"&&Environment.OSVersion.Platform==PlatformID.Win32NT&&System.Runtime.InteropServices.RuntimeInformation.FrameworkDescription==".NET 10.0.10"&&HashFile(typeof(object).Assembly.Location)==CoreLibrarySha&&Field(p,"coreLibrarySha256")==CoreLibrarySha,"DATA_HOLD_CLOCK_PROFILE");
    Require(Field(p,"scenarios")=="nominal,unexpected-member,ipc-cancel,watchdog,premature-root-exit,supervisor-crash"&&Field(p,"roles")=="Controller,Observer,Supervisor,root,child,grandchild,sibling,canary","DATA_HOLD_POPULATION");
    string ph=HashFile(RootPackagePath),ch=HashFile(RootContextPath),gh=HashFile(RootGrantPath);
    Require(Field(c,"packageRecordSha256")==ph&&Field(g,"contextRecordSha256")==ch&&Field(c,"packageId")==Field(p,"packageId")&&Field(g,"packageId")==Field(p,"packageId")&&Field(g,"contextId")==Field(c,"contextId"),"DATA_HOLD_INDEPENDENT_ROOT_RECORDS");
    string grant=Guid.ParseExact(Field(g,"grantId"),"D").ToString("D");Require(grant==Field(g,"grantId"),"DATA_HOLD_GRANT_ID");
    string spentPath=Path.Combine(RootConsumedPath,grant+".json");EnsureNoReparse(spentPath,@"C:\IFI_SourceCode");var spent=FlatJson(File.ReadAllText(spentPath));
    Require(Field(spent,"schema")=="hestia.m5.consumed.v1"&&Field(spent,"version")=="1"&&Field(spent,"grantId")==grant&&Field(spent,"contextRecordSha256")==ch&&Field(spent,"packageRecordSha256")==ph&&Field(spent,"grantRecordSha256")==gh,"DATA_HOLD_HOST_CONSUMPTION");
    Require(Field(g,"suiteToken")==Field(c,"suiteToken")&&Field(g,"outputCustodyId")==Field(c,"outputCustodyId"),"DATA_HOLD_GRANT_OUTPUT");
    return new RootData{Package=p,Context=c,Grant=g,Spent=spent,PackageHash=ph,ContextHash=ch,GrantHash=gh,SpentHash=HashFile(spentPath)};
   }
   private void ValidateFrame(){
    const string keys="schema version grantId packageRecordSha256 contextRecordSha256 grantRecordSha256 consumedSha256 hostPid hostCreation hostImage hostParentPid controllerPid controllerCreation subjectPid subjectCreation subjectParentPid subjectImage role requestPath requestSha256 scenario nodeOrigin issued workEnd overallEnd utcIssued utcEnd suiteToken nativeOrigin registrationNonce recordId recordSha256";
    Require(frame.Count==keys.Split(' ').Length,"DATA_HOLD_UNKNOWN_FRAME_FIELDS");foreach(var k in keys.Split(' '))Field(frame,k);
    Require(Field(frame,"schema")=="hestia.m5.handoff.v3"&&Field(frame,"version")=="3","DATA_HOLD_PRIVATE_SCHEMA");
   }
   private void ReadPrivateFrame(){Require(frame!=null,"DATA_HOLD_NATIVE_REQUIRES_EXACT_PS_PRIVATE_FRAME");ValidateFrame();}
   public Dictionary<string,string> AdmitRootHost(string json){
    frameLine=json;frame=FlatJson(json);ValidateFrame();Require(Field(frame,"role")=="RootHost","ROOT_HOST_FIXED_ENTRY");VerifyHostPhase(frame);return Snapshot();
   }
   public void VerifyHostPhase(Dictionary<string,string>state){
    var d=ReadRootRecords();
    foreach(var k in new[]{"issued","workEnd","overallEnd","utcIssued","utcEnd","hostPid","hostCreation","hostImage","hostParentPid"})Require(Field(state,k)==Field(d.Spent,k),"ROOT_HOST_ORIGINAL_CONSUMPTION");
    Require(Field(state,"hostPid")==ProcessId(GetCurrentProcess()).ToString(CultureInfo.InvariantCulture)&&Field(state,"hostCreation")==CreationTime(GetCurrentProcess()).ToString(CultureInfo.InvariantCulture)&&Field(state,"hostImage")==ImagePath(GetCurrentProcess())&&Field(state,"hostParentPid")==ParentProcessId(GetCurrentProcess()).ToString(CultureInfo.InvariantCulture),"ROOT_HOST_ACTUAL_SELF");
    Require(Field(state,"packageRecordSha256")==d.PackageHash&&Field(state,"contextRecordSha256")==d.ContextHash&&Field(state,"grantRecordSha256")==d.GrantHash&&Field(state,"consumedSha256")==d.SpentHash,"ROOT_HOST_FIXED_ROOT_HASHES");
    var e=new Dictionary<string,string>(d.Context,StringComparer.Ordinal);var o=new Dictionary<string,string>(e,StringComparer.Ordinal);ObserveExpectedProcess(e,o,"owner");ObserveExpectedProcess(e,o,"runner");
    Require(GetTickCount64()>=checked((ulong)Canonical(Field(state,"issued")))&&GetTickCount64()<=checked((ulong)Canonical(Field(state,"overallEnd")))&&DateTimeOffset.UtcNow.ToUnixTimeMilliseconds()>=Canonical(Field(state,"utcIssued"))&&DateTimeOffset.UtcNow.ToUnixTimeMilliseconds()<=Canonical(Field(state,"utcEnd")),"ROOT_HOST_LATE_ORIGINAL_CLOCK");
   }
   public void VerifyHostSourceBytes(Dictionary<string,string>state){
    VerifyHostPhase(state);var d=ReadRootRecords();
    foreach(var pair in new[]{new[]{"packagePinsSha256",Path.Combine(SourceRoot,"QUAL_SOURCE_PINS.tsv")},new[]{"nodeSha256",NodePath},new[]{"powerShellSha256",PowerShellPath},new[]{"dllSha256",Path.Combine(SourceRoot,"HarmlessActivation.dll")},new[]{"fixtureSha256",Path.Combine(SourceRoot,"harmless-fixture.mjs")}})Require(HashFile(pair[1])==Field(d.Package,pair[0]),"ROOT_BOUNDARY_SOURCE_TOOL_BYTES");
    var run=new BoundRun(Field(d.Context,"suiteToken"),Field(d.Context,"nativeOrigin"),Field(d.Context,"nodeOrigins").Split(',')[0],Field(d.Package,"packagePinsSha256"),checked((ulong)Canonical(Field(state,"issued"))),checked((ulong)Canonical(Field(state,"workEnd"))),checked((ulong)Canonical(Field(state,"overallEnd"))),Canonical(Field(state,"utcIssued")),Canonical(Field(state,"utcEnd")),QualificationScenario.Nominal);
    VerifyPins(run);VerifyHostPhase(state);
   }
   private void CheckFrame(RootData d){
    Require(Field(frame,"grantId")==Field(d.Grant,"grantId")&&Field(frame,"packageRecordSha256")==d.PackageHash&&Field(frame,"contextRecordSha256")==d.ContextHash&&Field(frame,"grantRecordSha256")==d.GrantHash&&Field(frame,"consumedSha256")==d.SpentHash,"DATA_HOLD_PRIVATE_ROOT_BINDING");
    foreach(var k in new[]{"issued","workEnd","overallEnd","utcIssued","utcEnd","hostPid","hostCreation","hostImage","hostParentPid"})Require(Field(frame,k)==Field(d.Spent,k),"DATA_HOLD_SAME_ORIGINAL_HOST");
    ulong issued=checked((ulong)Canonical(Field(frame,"issued"))),end=checked((ulong)Canonical(Field(frame,"overallEnd")));long utc=Canonical(Field(frame,"utcIssued")),utcEnd=Canonical(Field(frame,"utcEnd"));
    Require(checked(end-issued)==60000&&Canonical(Field(frame,"workEnd"))-(long)issued==48000&&utcEnd-utc==60000,"DATA_HOLD_ORIGINAL_ENDS");
    Require(GetTickCount64()>=issued&&GetTickCount64()<=end&&DateTimeOffset.UtcNow.ToUnixTimeMilliseconds()>=utc&&DateTimeOffset.UtcNow.ToUnixTimeMilliseconds()<=utcEnd,"DATA_HOLD_CURRENT_ORIGINAL_CLOCK");
    Require(Canonical(Field(d.Context,"leaseExpiresUtc"))>=utcEnd&&Canonical(Field(d.Grant,"notBeforeUtc"))<=utc&&Canonical(Field(d.Grant,"expiresUtc"))>=utcEnd,"DATA_HOLD_LEASE_OR_GRANT_EXPIRY");
    IntPtr self=GetCurrentProcess();Require(Field(frame,"subjectPid")==ProcessId(self).ToString(CultureInfo.InvariantCulture)&&Field(frame,"subjectCreation")==CreationTime(self).ToString(CultureInfo.InvariantCulture)&&Field(frame,"subjectParentPid")==ParentProcessId(self).ToString(CultureInfo.InvariantCulture)&&String.Equals(Field(frame,"subjectImage"),ImagePath(self),StringComparison.OrdinalIgnoreCase),"DATA_HOLD_ACTUAL_SUBJECT");
    uint parent=ParentProcessId(self);var h=new OwnedHandle(OpenProcess(ProcessQueryInformation|ProcessQueryLimitedInformation|Synchronize,false,parent));
    try{
     if(Field(frame,"role")=="Controller"){Require(parent==uint.Parse(Field(frame,"hostPid"),CultureInfo.InvariantCulture)&&Field(frame,"controllerPid")==Field(frame,"subjectPid")&&Field(frame,"controllerCreation")==Field(frame,"subjectCreation"),"DATA_HOLD_ONE_CONTROLLER");}
     else{Require(parent==uint.Parse(Field(frame,"controllerPid"),CultureInfo.InvariantCulture)&&CreationTime(h.Value).ToString(CultureInfo.InvariantCulture)==Field(frame,"controllerCreation")&&ParentProcessId(h.Value)==uint.Parse(Field(frame,"hostPid"),CultureInfo.InvariantCulture),"DATA_HOLD_OWN_CONTROL_CREATOR");}
    }finally{h.CloseChecked();}
    var host=new OwnedHandle(OpenProcess(ProcessQueryInformation|ProcessQueryLimitedInformation|Synchronize,false,uint.Parse(Field(frame,"hostPid"),CultureInfo.InvariantCulture)));
    try{Require(WaitForSingleObject(host.Value,0)==WaitTimeout&&CreationTime(host.Value).ToString(CultureInfo.InvariantCulture)==Field(frame,"hostCreation")&&String.Equals(ImagePath(host.Value),PowerShellPath,StringComparison.OrdinalIgnoreCase)&&ParentProcessId(host.Value)==uint.Parse(Field(d.Context,"hostParentPid"),CultureInfo.InvariantCulture),"DATA_HOLD_ACTUAL_ROOT_HOST");}finally{host.CloseChecked();}
    Require(GetTickCount64()<=end&&DateTimeOffset.UtcNow.ToUnixTimeMilliseconds()<=utcEnd,"DATA_HOLD_AFTER_PROCESS_OBSERVATIONS");
   }
   public VerifiedRootRuntimeProof VerifyCurrentFixedEntry(ActivationRole role,string fixedRequestPath){
    ReadPrivateFrame();RootData d=ReadRootRecords();CheckFrame(d);
    Require(Field(frame,"role")==role.ToString()&&Field(frame,"requestPath")==(fixedRequestPath??"NONE"),"DATA_HOLD_FIXED_ENTRY");
    var e=new Dictionary<string,string>(d.Context,StringComparer.Ordinal);
    foreach(var k in new[]{"packagePinsSha256","nodeSha256","powerShellSha256","dllSha256","fixtureSha256"})e[k]=Field(d.Package,k);
    foreach(var k in new[]{"issued","workEnd","overallEnd","utcIssued","utcEnd","subjectPid","subjectCreation","subjectParentPid","subjectImage","role","requestPath","requestSha256"})e[k]=Field(frame,k);
    e["issuer"]="ROOT_INDEPENDENT_RUNTIME_HANDOFF";e["scope"]=Field(d.Grant,"scope");e["mode"]="REAL_RUNTIME";e["authorityState"]=role==ActivationRole.Controller?"HOST_CONSUMED_SAME_CONTROLLER":"ACTIVE_OWN_CONTROLLER";
    var o=new Dictionary<string,string>(e,StringComparer.Ordinal);ObserveExpectedProcess(e,o,"owner");ObserveExpectedProcess(e,o,"runner");
    var proof=new VerifiedRootRuntimeProof(e,o,true,true,true);VerifyCurrentPhase(proof,"native-pre-effects");return proof;
   }
   public void VerifyCurrentPhase(VerifiedRootRuntimeProof proof,string phase){
    Require(Phases.Contains(phase),"DATA_HOLD_UNKNOWN_NATIVE_PHASE");
    var d=ReadRootRecords();CheckFrame(d);
    Require(Field(proof.ExpectedRoot,"suiteToken")==Field(d.Context,"suiteToken")&&Field(proof.ExpectedRoot,"packagePinsSha256")==Field(d.Package,"packagePinsSha256"),"DATA_HOLD_PHASE_ROOT_DRIFT");
    var e=new Dictionary<string,string>(d.Context,StringComparer.Ordinal);var o=new Dictionary<string,string>(e,StringComparer.Ordinal);ObserveExpectedProcess(e,o,"owner");ObserveExpectedProcess(e,o,"runner");
    RootSubjectClient.FreshProbe(frame);
    CheckFrame(d); // Recheck actual identities and original clocks after the fresh held-handle probe.
   }
   public void ConsumeControllerOnce(VerifiedRootRuntimeProof proof){
    Require(!acknowledged&&Field(frame,"role")=="Controller","DATA_HOLD_CONTROLLER_ACK_ONCE");VerifyCurrentPhase(proof,"native-before-ack");
    string hash;using(var sha=System.Security.Cryptography.SHA256.Create()){hash=BitConverter.ToString(sha.ComputeHash(Encoding.UTF8.GetBytes(frameLine))).Replace("-","").ToLowerInvariant();}
    Require(GetTickCount64()>=checked((ulong)Canonical(Field(frame,"issued")))&&GetTickCount64()<=checked((ulong)Canonical(Field(frame,"overallEnd")))&&DateTimeOffset.UtcNow.ToUnixTimeMilliseconds()>=Canonical(Field(frame,"utcIssued"))&&DateTimeOffset.UtcNow.ToUnixTimeMilliseconds()<=Canonical(Field(frame,"utcEnd")),"DATA_HOLD_BEFORE_HELD_HOST_ACK");
    Console.Out.WriteLine(String.Join("\t",new[]{"M5_ACK_V1",Field(frame,"grantId"),Field(frame,"subjectPid"),Field(frame,"subjectCreation"),hash}));Console.Out.Flush();
    var reply=Console.In.ReadLineAsync();Require(reply.Wait(checked((int)Math.Max(0,Canonical(Field(frame,"overallEnd"))-(long)GetTickCount64()))),"DATA_HOLD_ROOT_ACK_TIMEOUT");
    Require(reply.Result==String.Join("\t",new[]{"M5_ACK_OK_V1",Field(frame,"grantId"),Field(frame,"subjectPid"),hash}),"DATA_HOLD_REAL_HELD_HOST_ACK");
    VerifyCurrentPhase(proof,"native-before-ack");acknowledged=true;
   }
   public string VerifiedNodeOrigin(VerifiedRootRuntimeProof proof,QualificationScenario scenario){
    var d=ReadRootRecords();CheckFrame(d);var names=new[]{"nominal","unexpected-member","ipc-cancel","watchdog","premature-root-exit","supervisor-crash"};int index=Array.IndexOf(names,ScenarioName(scenario));var origins=Field(d.Context,"nodeOrigins").Split(',');Require(index>=0&&origins.Length==6,"DATA_HOLD_NODE_ORIGIN_POPULATION");return Guid.ParseExact(origins[index],"D").ToString("D");
   }
   public string ChildFrame(BoundProcess child,string role,string request,BoundRun run){
    Require(activationProof!=null&&(acknowledged||Field(frame,"role")=="Supervisor"),"DATA_HOLD_NO_ADMITTED_CREATOR");
    VerifyCurrentPhase(activationProof,"bound-run");var f=new Dictionary<string,string>(frame,StringComparer.Ordinal);
    f["subjectPid"]=ProcessId(child.Process.Value).ToString(CultureInfo.InvariantCulture);f["subjectCreation"]=CreationTime(child.Process.Value).ToString(CultureInfo.InvariantCulture);f["subjectParentPid"]=ParentProcessId(child.Process.Value).ToString(CultureInfo.InvariantCulture);f["subjectImage"]=ImagePath(child.Process.Value);
    Require(f["subjectParentPid"]==ProcessId(GetCurrentProcess()).ToString(CultureInfo.InvariantCulture),"DATA_HOLD_EXACT_PRIVATE_CREATOR");
    f["role"]=role;f["requestPath"]=request;f["requestSha256"]=HashFile(request);f["scenario"]=ScenarioName(run.Scenario);f["nodeOrigin"]=VerifiedNodeOrigin(activationProof,run.Scenario);
    var registered=RootSubjectClient.RegisterHeld(child,role,request,run);f["registrationNonce"]=Field(registered,"registrationNonce");f["recordId"]=Field(registered,"recordId");f["recordSha256"]=Field(registered,"recordSha256");
    return JsonSerializer.Serialize(f);
   }
  }
  private static System.IO.Pipes.AnonymousPipeServerStream CreateAdmissionInput(out OwnedHandle input){
   var pipe=new System.IO.Pipes.AnonymousPipeServerStream(System.IO.Pipes.PipeDirection.Out,HandleInheritability.Inheritable,65536);
   IntPtr copy;try{Win32(DuplicateHandle(GetCurrentProcess(),pipe.ClientSafePipeHandle.DangerousGetHandle(),GetCurrentProcess(),out copy,0,true,0x00000002),"private stdin duplicate");input=new OwnedHandle(copy);return pipe;}catch{pipe.Dispose();throw;}
  }
  private static void WriteChildAdmission(System.IO.Pipes.AnonymousPipeServerStream pipe,BoundProcess child,string role,string request,BoundRun run){
   string line=((RootRuntimeVerifier)externalRootRuntimeVerifier).ChildFrame(child,role,request,run);
   byte[] bytes=Encoding.UTF8.GetBytes(line+"\n");Require(bytes.Length<=32768,"DATA_HOLD_PRIVATE_PIPE_BOUND");
   ulong now=GetTickCount64();long utcNow=DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();
   Require(now<run.OverallEnd&&utcNow<run.OverallUtcMs,"DATA_HOLD_PRIVATE_PIPE_EXPIRED");
   var write=pipe.WriteAsync(bytes,0,bytes.Length);Require(write.Wait(checked((int)Math.Min(1000UL,run.OverallEnd-now))),"DATA_HOLD_PRIVATE_PIPE_DEADLINE");
   pipe.DisposeLocalCopyOfClientHandle();Require(child.RootChannel!=null&&Object.ReferenceEquals(child.RootChannel.Input,pipe),"sealed creator input retained");

  }
 }
}
