using System;using System.IO;using System.Text;using System.Text.Json;using System.Collections.Generic;using System.Globalization;using System.Threading.Tasks;
namespace Hestia.M5.Native24Source {public static partial class Native24Family {
 private static class RootSubjectClient {
  private static readonly List<BoundProcess> channels=new List<BoundProcess>();
  private static readonly Dictionary<string,OwnedHandle> proposed=new Dictionary<string,OwnedHandle>(StringComparer.Ordinal);
  private static readonly Dictionary<uint,Dictionary<string,string>> registered=new Dictionary<uint,Dictionary<string,string>>();
  private static RootRuntimeVerifier Verifier{get{return (RootRuntimeVerifier)externalRootRuntimeVerifier;}}
  private static ulong End{get{return checked((ulong)Canonical(Field(Verifier.Snapshot(),"overallEnd")));}}
  public static void Attach(BoundProcess p){Require(p.RootChannel!=null,"private channel required");channels.Add(p);}
  public static Dictionary<string,string> Rpc(string header,Dictionary<string,string>d){
   string line=SubjectProtocol.Encode(header,d);ulong end=End;long before=DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();Require(GetTickCount64()<end,"RPC original end");
   Console.Out.WriteLine(line);Console.Out.Flush();var task=Console.In.ReadLineAsync();
   ulong now=GetTickCount64();Require(now<end,"ROOT_PRIVATE_RPC_END");Require(task.Wait(checked((int)Math.Min(1000UL,end-now))),"ROOT_PRIVATE_RPC_TIMEOUT");
   string actual;var reply=SubjectProtocol.Parse(task.Result,out actual);
   Require(actual==(header==SubjectProtocol.Retire?SubjectProtocol.Closed:SubjectProtocol.Ack),"ROOT_PRIVATE_REPLY_HEADER");
   foreach(var k in SubjectProtocol.RequestFields.Split(' '))if(k!="schema"&&!(Field(d,"mode")=="PRECHECK"&&(k=="creation"||k=="image")))Require(Field(reply,k)==Field(d,k),"ROOT_PRIVATE_REPLY_ECHO:"+k);
   Require(Canonical(Field(reply,"observedUtc"))>=before&&Canonical(Field(reply,"observedUtc"))<=DateTimeOffset.UtcNow.ToUnixTimeMilliseconds()&&Canonical(Field(reply,"observedNative"))>=Canonical(Field(d,"issued"))&&Canonical(Field(reply,"observedNative"))<=Canonical(Field(d,"overallEnd")),"ROOT_PRIVATE_REPLY_ORIGINAL_CLOCK");
   Require(GetTickCount64()<=end&&DateTimeOffset.UtcNow.ToUnixTimeMilliseconds()<=Canonical(Field(d,"utcEnd")),"ROOT_PRIVATE_RPC_LATE");return reply;
  }
  public static Dictionary<string,string> RegisterHeld(BoundProcess p,string role,string request,BoundRun run){
   var f=Verifier.Snapshot();var d=SubjectProtocol.Request(SubjectProtocol.Register,f,role,ScenarioName(run.Scenario),"0",request,HashFile(request));
   IntPtr self=GetCurrentProcess();d["pid"]=p.Pid.ToString(CultureInfo.InvariantCulture);d["creation"]=CreationTime(p.Process.Value).ToString(CultureInfo.InvariantCulture);d["parentPid"]=ParentProcessId(p.Process.Value).ToString(CultureInfo.InvariantCulture);d["image"]=ImagePath(p.Process.Value);
   d["creatorPid"]=ProcessId(self).ToString(CultureInfo.InvariantCulture);d["creatorCreation"]=CreationTime(self).ToString(CultureInfo.InvariantCulture);d["creatorImage"]=ImagePath(self);
   SubjectProtocol.Holder(d);d["sourceHandle"]=p.Process.Value.ToInt64().ToString(CultureInfo.InvariantCulture);
   var reply=Rpc(SubjectProtocol.Register,d);Require(Field(reply,"response")=="REGISTERED","ROOT_CHILD_NOT_REGISTERED");registered[p.Pid]=reply;return reply;
  }
  public static Dictionary<string,string> FreshProbe(Dictionary<string,string>frame){
   string id=Field(frame,"subjectPid")+"-"+Field(frame,"subjectCreation")+"-"+Field(frame,"registrationNonce");
   Require(id==Field(frame,"recordId"),"ROOT_PROBE_DERIVED_ID");
   string path=Path.Combine(RootConsumedPath,Field(frame,"grantId")+".subjects",id+".json");EnsureNoReparse(path,RootConsumedPath);
   Require(HashFile(path)==Field(frame,"recordSha256"),"ROOT_PROBE_IMMUTABLE_RECORD");string ignored;var d=SubjectProtocol.Parse(SubjectProtocol.Register+"\t"+File.ReadAllText(path),out ignored);
   Require(Field(d,"pid")==ProcessId(GetCurrentProcess()).ToString(CultureInfo.InvariantCulture)&&Field(d,"creation")==CreationTime(GetCurrentProcess()).ToString(CultureInfo.InvariantCulture)&&Field(d,"parentPid")==ParentProcessId(GetCurrentProcess()).ToString(CultureInfo.InvariantCulture),"ROOT_PROBE_ACTUAL_SELF_CREATION");
   d["mode"]="PROBE";d["probeNonce"]=Guid.NewGuid().ToString("D");var reply=Rpc(SubjectProtocol.Register,d);
   Require(Field(reply,"response")=="PROBED"&&Field(reply,"recordId")==id&&Field(reply,"recordSha256")==Field(frame,"recordSha256"),"ROOT_PROBE_HELD_RECORD");return reply;
  }
  public static void ProbeHeld(BoundProcess p){
   Dictionary<string,string> held;Require(registered.TryGetValue(p.Pid,out held),"ROOT_PROBE_HELD_REGISTERED");
   var d=new Dictionary<string,string>(StringComparer.Ordinal);foreach(var k in SubjectProtocol.RequestFields.Split(' '))d[k]=Field(held,k);
   Require(WaitForSingleObject(p.Process.Value,0)==WaitTimeout&&CreationTime(p.Process.Value)==Canonical(Field(d,"creation"))&&ProcessId(p.Process.Value)==p.Pid,"ROOT_PROBE_HELD_ACTUAL_CHILD");
   d["mode"]="PROBE";d["probeNonce"]=Guid.NewGuid().ToString("D");var reply=Rpc(SubjectProtocol.Register,d);
   Require(Field(reply,"response")=="PROBED"&&Field(reply,"recordId")==Field(held,"recordId")&&Field(reply,"recordSha256")==Field(held,"recordSha256"),"ROOT_PROBE_HELD_EXACT_ROOT_RECORD");
   ulong now=GetTickCount64();Require(now<End&&DateTimeOffset.UtcNow.ToUnixTimeMilliseconds()<Canonical(Field(d,"utcEnd")),"ROOT_PROBE_HELD_PRE_RESUME_ORIGINAL_CLOCK");
  }
  public static void RetireHeld(BoundProcess p){
   Dictionary<string,string>d;if(!registered.TryGetValue(p.Pid,out d))return;
   var r=new Dictionary<string,string>(d,StringComparer.Ordinal);foreach(var k in SubjectProtocol.AckFields.Split(' '))if(Array.IndexOf(SubjectProtocol.RequestFields.Split(' '),k)<0)r.Remove(k);
   r["schema"]="hestia.m5.subject.retire.v1";r["mode"]="RETIRE";r["probeNonce"]=Guid.NewGuid().ToString("D");
   Require(WaitForSingleObject(p.Process.Value,0)==WaitObject0,"ROOT_RETIRE_EXACT_CREATOR_TERMINAL");
   var reply=Rpc(SubjectProtocol.Retire,r);Require(Field(reply,"response")=="RETIRED","ROOT_RETIRE_ACK");registered.Remove(p.Pid);
  }
  private static Dictionary<string,string> RelayNodeRegistration(Dictionary<string,string>d){
   // Root first observes exact parent/creation/image/OUTER Job; only then may Controller open a query handle.
   var pre=new Dictionary<string,string>(d,StringComparer.Ordinal);pre["mode"]="PRECHECK";pre["sourceHandle"]="0";SubjectProtocol.Holder(pre);
   var seen=Rpc(SubjectProtocol.Register,pre);Require(Field(seen,"response")=="PRECHECKED","ROOT_NODE_PRECHECK");
   var h=new OwnedHandle(OpenProcess(0x00100400,false,uint.Parse(Field(seen,"pid"),CultureInfo.InvariantCulture)));
   try{
    Require(CreationTime(h.Value)==Canonical(Field(seen,"creation"))&&ParentProcessId(h.Value)==uint.Parse(Field(seen,"parentPid"),CultureInfo.InvariantCulture)&&ImagePath(h.Value)==Field(seen,"image"),"ROOT_NODE_EXACT_PROPOSED_CHILD");
    d["creation"]=Field(seen,"creation");d["image"]=Field(seen,"image");SubjectProtocol.Holder(d);d["sourceHandle"]=h.Value.ToInt64().ToString(CultureInfo.InvariantCulture);
    var reply=Rpc(SubjectProtocol.Register,d);Require(Field(reply,"response")=="REGISTERED","ROOT_NODE_REGISTER");
    proposed.Add(Field(reply,"recordId"),h);h=null;return reply;
   }finally{if(h!=null)h.CloseChecked();}
  }
  public static void PumpAll(){
   if(!Verifier.HasFrame)return;
   bool controller=Field(Verifier.Snapshot(),"role")=="Controller";
   foreach(var child in channels.ToArray()){
    if(child.RootChannel==null||child.RootChannel.Closed)continue;child.RootChannel.Pump();
    while(child.RootChannel.Lines.Count>0){
     string line=child.RootChannel.Lines.Dequeue();
     if(!line.StartsWith("M5_SUBJECT_",StringComparison.Ordinal)){if(child.RootChannel.Log!=null){using(var stream=new FileStream(new Microsoft.Win32.SafeHandles.SafeFileHandle(child.RootChannel.Log.Value,false),FileAccess.Write)){byte[] b=Encoding.UTF8.GetBytes(line+"\n");stream.Write(b,0,b.Length);}}continue;}
     string header;var d=SubjectProtocol.Parse(line,out header);Require(header==SubjectProtocol.Register||header==SubjectProtocol.Retire,"PRIVATE_CREATOR_REQUEST_ONLY");
     Dictionary<string,string> reply;
     if(controller&&header==SubjectProtocol.Register&&Field(d,"mode")=="REGISTER"&&Field(d,"sourceHandle")=="0")reply=RelayNodeRegistration(d);
     else{
      if(controller&&header==SubjectProtocol.Register&&Field(d,"mode")=="REGISTER")Require(Field(d,"handleOwnerPid")==child.Pid.ToString(CultureInfo.InvariantCulture)&&Field(d,"handleOwnerCreation")==CreationTime(child.Process.Value).ToString(CultureInfo.InvariantCulture),"SEALED_SOURCE_HOLDER");
      reply=Rpc(header,d);
     }
     child.RootChannel.Send(SubjectProtocol.Encode(header==SubjectProtocol.Retire?SubjectProtocol.Closed:SubjectProtocol.Ack,reply),End);
     if(header==SubjectProtocol.Retire){OwnedHandle owned;if(proposed.TryGetValue(Field(reply,"recordId"),out owned)){owned.CloseChecked();proposed.Remove(Field(reply,"recordId"));}}
    }
   }
  }
  public static void CloseChannel(BoundProcess p){
   if(p.RootChannel==null)return;PrivateChannel channel=p.RootChannel;Exception failure=null;
   try{
    ulong end=End;long utcEnd=Canonical(Field(Verifier.Snapshot(),"utcEnd"));
    Require(p.Process!=null&&WaitForSingleObject(p.Process.Value,0)==WaitObject0,"ROOT_CHANNEL_DRAIN_REQUIRES_ACTUAL_TERMINAL");
    while(true){
     ulong now=GetTickCount64();long utcNow=DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();
     Require(now<end&&utcNow<utcEnd,"ROOT_CHANNEL_DRAIN_ORIGINAL_DEADLINE");
     PumpAll();
     if(channel.Eof&&channel.Lines.Count==0&&!channel.HasPartialFrame)break;
     System.Threading.Thread.Sleep(1);
    }
    Require(GetTickCount64()<end&&DateTimeOffset.UtcNow.ToUnixTimeMilliseconds()<utcEnd,"ROOT_CHANNEL_DRAIN_LATE_ORIGINAL_CLOCK");
    RetireHeld(p);
   }catch(Exception e){failure=e;}
   finally{
    try{channel.Dispose();Require(channel.Closed,"ROOT_CHANNEL_OWNED_CLOSE_UNCERTAIN");}catch(Exception e){CaptureCleanupFailure(ref failure,e);}
    channels.Remove(p);p.RootChannel=null;
   }
   if(failure!=null)throw failure;
  }
  public static void CloseProposals(){Exception failure=null;foreach(var h in proposed.Values)try{h.CloseChecked();}catch(Exception e){CaptureCleanupFailure(ref failure,e);}if(failure!=null)throw failure;proposed.Clear();}
 }
}}
