using System;
using System.Collections.Generic;
using System.ComponentModel;
using System.Globalization;
using System.IO;
using System.Runtime.InteropServices;
using System.Text;

namespace Hestia.M5.Native24Source
{
 public static partial class Native24Family
 {
  public static int SuperviseHarmlessQualification(string handoffLine){((RootRuntimeVerifier)externalRootRuntimeVerifier).SetEntryFrame(handoffLine);var admitted=AdmitFixedEntry(ActivationRole.Controller,null);activationProof=admitted;return RunFutureQualificationSuite(admitted);}
  public static int ObserveHarmlessQualification(string requestPath,string handoffLine){((RootRuntimeVerifier)externalRootRuntimeVerifier).SetEntryFrame(handoffLine);var admitted=AdmitFixedEntry(ActivationRole.Observer,requestPath);activationProof=admitted;return FutureFixedRoleBody(ControlRole.Observer,requestPath,admitted);}
  public static int RunHarmlessSupervisor(string requestPath,string handoffLine){((RootRuntimeVerifier)externalRootRuntimeVerifier).SetEntryFrame(handoffLine);var admitted=AdmitFixedEntry(ActivationRole.Supervisor,requestPath);activationProof=admitted;return FutureFixedRoleBody(ControlRole.Supervisor,requestPath,admitted);}
  private const string PowerShellPath=@"C:\IFI_SourceCode\Utils\PowerShell\pwsh.exe";
  private const string PowerShellSha256="db6dd81183fe57d22e03b911ec9a30a2fd7c40542e97743615355a6fb44f458f";
  private const uint QualificationCrashExit=0xE71B;
  private const uint ProcessQueryInformation=0x0400;
  private enum QualificationScenario{Nominal,UnexpectedMember,IpcCancel,Watchdog,PrematureRootExit,SupervisorCrash}
  private enum ControlRole{Observer,Canary,Supervisor}
  private enum TransferState{DuplicatedLocal,PreparePublishedQuarantined,Prepared,Committed,AbortRequested,Retired}
  private enum Cause{Nominal,UnexpectedMember,IpcCancel,Watchdog,PrematureRootExit,SupervisorCrash,Unknown}
  private sealed class SuiteClock{
   public readonly string Token,NativeOrigin,Pins;
   public readonly ulong Issued,WorkEnd,OverallEnd;
   public readonly long UtcIssued,UtcEnd;
   public SuiteClock(string token,string origin,string pins,ulong issued,long utc){Token=token;NativeOrigin=origin;Pins=pins;Issued=issued;WorkEnd=checked(issued+48000);OverallEnd=checked(issued+60000);UtcIssued=utc;UtcEnd=checked(utc+60000);}
  }
  private sealed class ControlActor{
   public ControlRole Role;public BoundProcess Owner;public System.IO.Pipes.AnonymousPipeServerStream AdmissionPipe;public OwnedHandle Out,Err,Job;public bool Verified,Terminal,Closed;public uint ExitCode;
  }
  private sealed class Transfer{
   public string Key,Role;public int Ordinal;public uint Pid,Parent;public long Created;
   public IntPtr Remote;public TransferState State;
   public bool PublicationAttempted,ReclaimAttempted,AbortSent;
  }
  private sealed class QualificationContext{
   public SuiteClock Suite;public BoundRun Run;public ControlActor Observer,Canary,Supervisor;
   public OwnedHandle ObserverTarget,CanaryQuery;public bool ObserverCreatorVerified,CanarySeparateJobVerified;
   public uint CreatorPid,ChildPid;public int Ordinal;public BoundProcess Grandchild;public bool Armed,FinalZero,FamilyRetired,CrashLiveProof,UnexpectedEvidence,ForceObserverRetirement;
   public readonly Dictionary<uint,string> Roles=new Dictionary<uint,string>();
   public readonly Dictionary<string,Transfer> Transfers=new Dictionary<string,Transfer>(StringComparer.Ordinal);
  }
  private sealed class Observed{
   public Transfer Record;public OwnedHandle Handle;public bool Prepared,Committed,Retired,PreparedAck,CommitAck,RetiredAck;
  }
  private static QualificationContext qualification;
  private static bool suiteClockCaptured;
  [DllImport("kernel32.dll",SetLastError=true)] private static extern bool TerminateProcess(IntPtr process,uint code);
  [DllImport("kernel32.dll",SetLastError=true)] private static extern bool DuplicateHandle(IntPtr sourceProcess,IntPtr sourceHandle,IntPtr targetProcess,out IntPtr targetHandle,uint desiredAccess,bool inherit,uint options);
  private static string ScenarioName(QualificationScenario s){
   switch(s){case QualificationScenario.Nominal:return "nominal";case QualificationScenario.UnexpectedMember:return "unexpected-member";case QualificationScenario.IpcCancel:return "ipc-cancel";case QualificationScenario.Watchdog:return "watchdog";case QualificationScenario.PrematureRootExit:return "premature-root-exit";case QualificationScenario.SupervisorCrash:return "supervisor-crash";default:throw new InvalidOperationException("fixed scenario required");}
  }
  private static QualificationScenario Scenario(string name){
   foreach(QualificationScenario s in new[]{QualificationScenario.Nominal,QualificationScenario.UnexpectedMember,QualificationScenario.IpcCancel,QualificationScenario.Watchdog,QualificationScenario.PrematureRootExit,QualificationScenario.SupervisorCrash})if(ScenarioName(s)==name)return s;
   throw new InvalidOperationException("fixed scenario required");
  }
  private static string QualificationOutputRoot(string token,QualificationScenario s){Guid.ParseExact(token,"D");return Path.Combine(QualificationRunsRoot,token,ScenarioName(s));}
  private static ulong RemainingQualificationWork(int ordinal){Require(ordinal>=0&&ordinal<6,"fixed lane ordinal");return checked((ulong)(6-ordinal)*6000UL);}
  private static SuiteClock CaptureOriginalSuiteClock(VerifiedRootRuntimeProof admitted){
   Require(!suiteClockCaptured&&Object.ReferenceEquals(admitted,activationProof),"suite end cannot reset");suiteClockCaptured=true;
   externalRootRuntimeVerifier.VerifyCurrentPhase(admitted,"before-suite-startup");
   var e=admitted.ExpectedRoot;
   var suite=new SuiteClock(RequiredRootField(e,"suiteToken"),RequiredRootField(e,"nativeOrigin"),ExpectedPackagePinsSha256(admitted),checked((ulong)Canonical(RequiredRootField(e,"issued"))),Canonical(RequiredRootField(e,"utcIssued")));
   Require(suite.WorkEnd==(ulong)Canonical(RequiredRootField(e,"workEnd"))&&suite.OverallEnd==(ulong)Canonical(RequiredRootField(e,"overallEnd"))&&suite.UtcEnd==Canonical(RequiredRootField(e,"utcEnd")),"HOLD_ORIGINAL_END_REQUIRED");
   return suite;
  }
  private static BoundRun MakeRun(SuiteClock suite,QualificationScenario s,string nodeOrigin){return new BoundRun(suite.Token,suite.NativeOrigin,nodeOrigin,suite.Pins,suite.Issued,suite.WorkEnd,suite.OverallEnd,suite.UtcIssued,suite.UtcEnd,s);}
  private static void ValidateQualificationRun(BoundRun run){
   QualificationContext q=qualification;Require(q!=null&&Object.ReferenceEquals(q.Run,run),"exact prepared case required");AssertAdmittedRun(run);
   Require(run.Issued==q.Suite.Issued&&run.WorkDeadline==q.Suite.WorkEnd&&run.OverallEnd==q.Suite.OverallEnd&&run.IssuedUtcMs==q.Suite.UtcIssued&&run.OverallUtcMs==q.Suite.UtcEnd,"suite end drift/reset");
   Require(run.WorkDeadline-run.Issued==48000&&run.OverallEnd-run.Issued==60000&&run.OverallEnd-run.WorkDeadline==12000,"fixed suite60/48/12");
   Require(run.OutputRoot==QualificationOutputRoot(run.BatchToken,run.Scenario),"fixed output mismatch");
  }
  private static void RequireQualificationReserve(BoundRun run,int ordinal){
   ValidateQualificationRun(run);ulong now=GetTickCount64(),reserve=RemainingQualificationWork(ordinal);
   Require(run.WorkDeadline>=now&&run.WorkDeadline-now>=reserve&&run.OverallEnd>=now&&run.OverallEnd-now>=reserve+12000,"QUALIFICATION_RESERVE_MISSING_STOP_REMAINING_NOT_RUN");
   Require(DateTimeOffset.UtcNow.ToUnixTimeMilliseconds()<run.OverallUtcMs,"suite UTC expired");
  }
  private static string QPath(BoundRun run,string name){return Path.Combine(run.OutputRoot,"observer",name);}
  private static string ReadSmall(string path){
   EnsureNoReparse(path,SourceRoot);using(FileStream f=new FileStream(path,FileMode.Open,FileAccess.Read,FileShare.Read|FileShare.Delete)){Require(f.Length<=16384,"bounded protocol");using(StreamReader r=new StreamReader(f,Encoding.UTF8))return r.ReadToEnd();}
  }
  private static bool ExistsKnown(string path){
   uint a=GetFileAttributesW(path);if(a!=0xffffffff)return true;
   int e=Marshal.GetLastWin32Error();if(e==2||e==3)return false;throw new Win32Exception(e,"protocol existence uncertain");
  }
  private static bool ProvedAbsent(string path){
   uint a=GetFileAttributesW(path);if(a!=0xffffffff)return false;
   int e=Marshal.GetLastWin32Error();if(e==2||e==3)return true;return false;
  }
  private static void PublishOnce(string path,string text){
   if(ExistsKnown(path)){Require(ReadSmall(path)==text+"\n","exclusive protocol replay mismatch");return;}Publish(path,text);
  }
  private static void AwaitExact(string path,string exact,BoundRun run,bool cleanup){
   ulong end=cleanup?run.OverallEnd:run.WorkDeadline;
   while(GetTickCount64()<end&&DateTimeOffset.UtcNow.ToUnixTimeMilliseconds()<run.OverallUtcMs){
    if(ExistsKnown(path)){Require(ReadSmall(path)==exact+"\n","bound ACK mismatch");return;}RootSubjectClient.PumpAll();System.Threading.Thread.Sleep(10);
   }throw new TimeoutException("same suite end: ACK missing");
  }
  private static void ResumeOwned(ControlActor actor){
   Require(actor!=null&&actor.Verified,"verified creator before resume");
   BoundRun run=qualification.Run;string request=Path.Combine(run.OutputRoot,actor.Role==ControlRole.Canary?"canary.case.json":actor.Role.ToString().ToLowerInvariant()+".control.tsv");
   WriteChildAdmission(actor.AdmissionPipe,actor.Owner,actor.Role==ControlRole.Canary?"canary":actor.Role.ToString(),request,run);actor.AdmissionPipe=null;
   RootSubjectClient.ProbeHeld(actor.Owner);
   uint prior=ResumeThread(actor.Owner.Thread.Value);
   if(prior==0xffffffff){int e=Marshal.GetLastWin32Error();throw new Win32Exception(e,"control ResumeThread");}
   Require(prior==1,"exactly one suspended resume");actor.Owner.Thread.CloseChecked();
  }
  private static void VerifyControl(ControlActor actor,uint parent){
   BoundProcess p=actor.Owner;SetNotInheritable(p.Process.Value);SetNotInheritable(p.Thread.Value);VerifyArchitecture(p.Process.Value);
   string expected=actor.Role==ControlRole.Canary?NodePath:PowerShellPath;
   Require(String.Equals(ImagePath(p.Process.Value),Full(expected),StringComparison.OrdinalIgnoreCase),"fixed control image");
   Require(ParentProcessId(p.Process.Value)==parent,"control creator parent");
   p.ParentPid=parent;p.CreatedFileTime=CreationTime(p.Process.Value);Require(p.CreatedFileTime>0,"control creation time");
   if(actor.Role==ControlRole.Canary){bool member;Win32(IsProcessInJob(p.Process.Value,actor.Job.Value,out member),"separate Canary Job");Require(member,"Canary membership");p.InOwnedJob=true;VerifyMemberSet(actor.Job.Value,new[]{p});}
   actor.Verified=true;
  }
  // Private fixed-role creator adapted from r05 LaunchSupervisor/atomic Job root; no executable/argv callback.
  private static ControlActor StartFixedControl(QualificationContext q,ControlRole role){
   BoundRun run=q.Run;ValidateQualificationRun(run);VerifyPins(run);var a=new ControlActor{Role=role};ProcAttributes attrs=null;OwnedHandle input=null;OwnedHandle relayOutput=null;PrivateChannel channel=null;IntPtr env=IntPtr.Zero;ProcessInformation pi=new ProcessInformation();Exception failure=null;
   if(role==ControlRole.Observer)q.Observer=a;else if(role==ControlRole.Canary)q.Canary=a;else q.Supervisor=a;
   try{
    string roleName=role.ToString().ToLowerInvariant();
    a.Out=OpenOutput(Path.Combine(run.OutputRoot,roleName+".stdout.bin"));a.Err=OpenOutput(Path.Combine(run.OutputRoot,roleName+".stderr.bin"));
    a.AdmissionPipe=CreateAdmissionInput(out input);channel=new PrivateChannel{Input=a.AdmissionPipe,Output=CreateRelayOutput(out relayOutput),Log=a.Out};
    Win32(SetHandleInformation(input.Value,1,1),"control stdin inherit");Win32(SetHandleInformation(a.Out.Value,1,1),"control stdout inherit");Win32(SetHandleInformation(a.Err.Value,1,1),"control stderr inherit");
    if(role==ControlRole.Canary)a.Job=CreateConfiguredJob();
    attrs=new ProcAttributes(role==ControlRole.Canary?2:1);attrs.AddHandles(new[]{input.Value,relayOutput.Value,a.Err.Value});if(a.Job!=null)attrs.AddJob(a.Job.Value);
    StartupInfoEx startup=new StartupInfoEx();startup.StartupInfo.cb=(uint)Marshal.SizeOf(typeof(StartupInfoEx));startup.StartupInfo.dwFlags=StartfUseStdHandles;startup.StartupInfo.hStdInput=input.Value;startup.StartupInfo.hStdOutput=relayOutput.Value;startup.StartupInfo.hStdError=a.Err.Value;startup.lpAttributeList=attrs.List;
    string request=Path.Combine(run.OutputRoot,roleName+".control.tsv");
    string executable=role==ControlRole.Canary?NodePath:PowerShellPath;
    Require(HashFile(executable)==(role==ControlRole.Canary?NodeSha256:PowerShellSha256),"fixed control executable SHA");
    string command=role==ControlRole.Canary?Quote(NodePath)+" "+Quote(Path.Combine(SourceRoot,"harmless-fixture.mjs"))+" "+Quote(Path.Combine(run.OutputRoot,"canary.case.json")):
     Quote(PowerShellPath)+" -NoProfile -NonInteractive -File "+Quote(Path.Combine(SourceRoot,role==ControlRole.Observer?"observe.ps1":"supervise.ps1"))+" -RequestPath "+Quote(request);
    byte[] block=EnvironmentBlock(role==ControlRole.Canary);env=Marshal.AllocHGlobal(block.Length);Marshal.Copy(block,0,env,block.Length);
    Win32(CreateProcessW(executable,new StringBuilder(command),IntPtr.Zero,IntPtr.Zero,true,CreateSuspended|ExtendedStartupInfoPresent|CreateUnicodeEnvironment|CreateNoWindow,env,SourceRoot,ref startup,out pi),"CreateProcessW(fixed qualification control)");
    a.Owner=new BoundProcess{Process=new OwnedHandle(pi.hProcess),Thread=new OwnedHandle(pi.hThread),Pid=pi.dwProcessId};
    a.Owner.RootChannel=channel;RootSubjectClient.Attach(a.Owner);channel.Output.DisposeLocalCopyOfClientHandle();
    VerifyControl(a,ProcessId(GetCurrentProcess()));return a;
   }catch(Exception e){failure=e;throw;}
   finally{
    try{if(attrs!=null)attrs.Dispose();}catch(Exception e){CaptureCleanupFailure(ref failure,e);}
    try{if(relayOutput!=null)relayOutput.CloseChecked();}catch(Exception e){CaptureCleanupFailure(ref failure,e);}
    try{if(env!=IntPtr.Zero)Marshal.FreeHGlobal(env);}catch(Exception e){CaptureCleanupFailure(ref failure,e);}
    try{if(input!=null)input.CloseChecked();}catch(Exception e){CaptureCleanupFailure(ref failure,e);}
    try{if(channel!=null&&(a.Owner==null||!Object.ReferenceEquals(a.Owner.RootChannel,channel)))channel.Dispose();}catch(Exception e){CaptureCleanupFailure(ref failure,e);}
    try{if(a.Out!=null)SetNotInheritable(a.Out.Value);}catch(Exception e){CaptureCleanupFailure(ref failure,e);}
    try{if(a.Err!=null)SetNotInheritable(a.Err.Value);}catch(Exception e){CaptureCleanupFailure(ref failure,e);}
    if(failure!=null&&a.Owner==null&&pi.hProcess!=IntPtr.Zero)a.Owner=new BoundProcess{Process=new OwnedHandle(pi.hProcess),Thread=pi.hThread==IntPtr.Zero?null:new OwnedHandle(pi.hThread),Pid=pi.dwProcessId};
    if(failure!=null)throw new InvalidOperationException("HOLD_CONTROL_CREATION_OR_RELEASE",failure);
   }
  }
  private static void RetireOwnedControl(ControlActor actor,BoundRun run,bool force){
   if(actor==null)return;Exception failure=null;
   if(actor.AdmissionPipe!=null){try{actor.AdmissionPipe.Dispose();actor.AdmissionPipe=null;}catch(Exception e){CaptureCleanupFailure(ref failure,e);}}
   if(actor.Owner!=null){
    try{uint state=WaitForSingleObject(actor.Owner.Process.Value,0);if(state==WaitFailed){int e=Marshal.GetLastWin32Error();throw new Win32Exception(e,"control wait");}
     if(actor.Role==ControlRole.Canary)Require(state==WaitTimeout,"Canary must survive until exact owned retirement");
     if(state==WaitTimeout&&force){if(actor.Job!=null)Win32(TerminateJobObject(actor.Job.Value,ExpectedJobExitCode),"own Canary Job retirement");else Win32(TerminateProcess(actor.Owner.Process.Value,QualificationCrashExit),"exact own control creator retirement");}
     WaitExited(actor.Owner.Process.Value,run.OverallEnd);
     actor.Terminal=true;Win32(GetExitCodeProcess(actor.Owner.Process.Value,out actor.ExitCode),"exact control exit receipt");
     if(actor.Role==ControlRole.Observer&&!force)Require(actor.ExitCode==0,"Observer failure after retirement ACK");
    }catch(Exception e){CaptureCleanupFailure(ref failure,e);}
    try{actor.Owner.CloseChecked();}catch(Exception e){CaptureCleanupFailure(ref failure,e);}
   }
   if(actor.Job!=null){
    try{Require(QueryAccounting(actor.Job.Value).ActiveProcesses==0&&QueryMembers(actor.Job.Value,0).Length==0,"Canary Job zero");}catch(Exception e){CaptureCleanupFailure(ref failure,e);}
    try{actor.Job.CloseChecked();}catch(Exception e){CaptureCleanupFailure(ref failure,e);}
   }
   try{if(actor.Out!=null)actor.Out.CloseChecked();}catch(Exception e){CaptureCleanupFailure(ref failure,e);}
   try{if(actor.Err!=null)actor.Err.CloseChecked();}catch(Exception e){CaptureCleanupFailure(ref failure,e);}
   actor.Closed=actor.Owner!=null&&actor.Owner.Process.IsClosed&&(actor.Out==null||actor.Out.IsClosed)&&(actor.Err==null||actor.Err.IsClosed)&&(actor.Job==null||actor.Job.IsClosed);
   if(failure!=null)throw new InvalidOperationException("HOLD_UNCERTAIN_CONTROL_RETIREMENT",failure);
  }
  private static IntPtr DuplicateTo(OwnedHandle source,ControlActor target,uint rights){
   Require(target!=null&&target.Verified,"exact verified own target");IntPtr value;
   Win32(DuplicateHandle(GetCurrentProcess(),source.Value,target.Owner.Process.Value,out value,rights,false,0),"fixed control handle duplication");Require(value!=IntPtr.Zero&&value!=new IntPtr(-1),"invalid control duplicate");return value;
  }
  private static string ControlRequest(QualificationContext q,ControlRole role,long observerHandle,long canaryHandle){
   BoundRun r=q.Run;return String.Join("\t",new[]{ "QUAL_CONTROL",role.ToString(),r.BatchToken,ScenarioName(r.Scenario),r.PinsSha256,r.NativeOrigin,r.NodeOrigin,
    r.Issued.ToString(CultureInfo.InvariantCulture),r.WorkDeadline.ToString(CultureInfo.InvariantCulture),r.OverallEnd.ToString(CultureInfo.InvariantCulture),
    r.IssuedUtcMs.ToString(CultureInfo.InvariantCulture),r.OverallUtcMs.ToString(CultureInfo.InvariantCulture),q.CreatorPid.ToString(CultureInfo.InvariantCulture),
    observerHandle.ToString(CultureInfo.InvariantCulture),canaryHandle.ToString(CultureInfo.InvariantCulture),
    q.Observer==null?"0":q.Observer.Owner.Pid.ToString(CultureInfo.InvariantCulture),q.Observer==null?"0":q.Observer.Owner.CreatedFileTime.ToString(CultureInfo.InvariantCulture),
    q.Canary==null?"0":q.Canary.Owner.Pid.ToString(CultureInfo.InvariantCulture),q.Canary==null?"0":q.Canary.Owner.CreatedFileTime.ToString(CultureInfo.InvariantCulture)});
  }
  private static long Canonical(string text){long n;Require(Int64.TryParse(text,NumberStyles.None,CultureInfo.InvariantCulture,out n)&&n>=0&&text==n.ToString(CultureInfo.InvariantCulture),"canonical nonnegative control number");return n;}
  private static QualificationContext ReadFixedControl(ControlRole expected,string requestPath){
   string full=Full(requestPath);Require(full.StartsWith(Full(QualificationRunsRoot)+Path.DirectorySeparatorChar,StringComparison.OrdinalIgnoreCase),"fixed qualification control root");
   string[] p=ReadSmall(full).TrimEnd('\n').Split('\t');Require(p.Length==19&&p[0]=="QUAL_CONTROL"&&p[1]==expected.ToString(),"fixed control role packet");
   QualificationScenario scenario=Scenario(p[3]);Guid.ParseExact(p[2],"D");Guid.ParseExact(p[5],"D");Guid.ParseExact(p[6],"D");
   var suite=new SuiteClock(p[2],p[5],p[4],checked((ulong)Canonical(p[7])),Canonical(p[10]));
   Require(suite.WorkEnd==(ulong)Canonical(p[8])&&suite.OverallEnd==(ulong)Canonical(p[9])&&suite.UtcEnd==Canonical(p[11]),"immutable suite end");
   var q=new QualificationContext{Suite=suite,Run=MakeRun(suite,scenario,p[6]),CreatorPid=checked((uint)Canonical(p[12]))};
   Require(full==Full(Path.Combine(q.Run.OutputRoot,expected.ToString().ToLowerInvariant()+".control.tsv")),"exact role control path");
   Require(ParentProcessId(GetCurrentProcess())==q.CreatorPid,"actual controller parent");
   if(expected==ControlRole.Supervisor){
    q.ObserverTarget=new OwnedHandle(new IntPtr(Canonical(p[13])));q.CanaryQuery=new OwnedHandle(new IntPtr(Canonical(p[14])));
    SetNotInheritable(q.ObserverTarget.Value);SetNotInheritable(q.CanaryQuery.Value);
    Require(ProcessId(q.ObserverTarget.Value)==(uint)Canonical(p[15])&&CreationTime(q.ObserverTarget.Value)==Canonical(p[16])&&ParentProcessId(q.ObserverTarget.Value)==q.CreatorPid,"exact Observer creator tuple");
    Require(String.Equals(ImagePath(q.ObserverTarget.Value),Full(PowerShellPath),StringComparison.OrdinalIgnoreCase),"Observer image");
    Require(ProcessId(q.CanaryQuery.Value)==(uint)Canonical(p[17])&&CreationTime(q.CanaryQuery.Value)==Canonical(p[18]),"exact Canary creator tuple");VerifyNodeProcess(q.CanaryQuery.Value,q.CreatorPid);
    q.ObserverCreatorVerified=true;q.CanarySeparateJobVerified=true;
   }
   qualification=q;ValidateQualificationRun(q.Run);return q;
  }
  private static string CaseJson(BoundRun run,string role){return "{\"scenario\":\""+ScenarioName(run.Scenario)+"\",\"role\":\""+role+"\",\"outputRoot\":\""+run.OutputRoot.Replace("\\","\\\\")+"\",\"token\":\""+run.BatchToken+"\",\"nodeOrigin\":\""+run.NodeOrigin+"\",\"utcEnd\":"+run.OverallUtcMs.ToString(CultureInfo.InvariantCulture)+",\"ordinal\":0}";}

  private static string TransferText(Transfer t,BoundRun r){return String.Join("\t",new[]{"QUAL_TRANSFER",r.BatchToken,ScenarioName(r.Scenario),t.Ordinal.ToString(CultureInfo.InvariantCulture),t.Role,t.Pid.ToString(CultureInfo.InvariantCulture),t.Parent.ToString(CultureInfo.InvariantCulture),t.Created.ToString(CultureInfo.InvariantCulture),t.Remote.ToInt64().ToString(CultureInfo.InvariantCulture)});}
  private static string TransferKey(BoundRun r,int ordinal,string role,uint pid,long created){return r.BatchToken+"."+ScenarioName(r.Scenario)+"."+ordinal+"."+role+"."+pid+"."+created;}
  private static IntPtr ObserverTarget(QualificationContext q){Require(q.ObserverCreatorVerified,"Observer creator not verified");return q.Observer!=null?q.Observer.Owner.Process.Value:q.ObserverTarget.Value;}
  private static void ReclaimBeforePrepare(QualificationContext q,Transfer t,string path){
   Require(t.State==TransferState.DuplicatedLocal&&!t.ReclaimAttempted&&ProvedAbsent(path),"remote reclaim prohibited after publication or uncertainty");
   IntPtr remote=t.Remote,ignored;
   t.ReclaimAttempted=true; // CLOSE_SOURCE consumes the source even when the API returns failure.
   t.Remote=IntPtr.Zero;
   try{
    bool ok=DuplicateHandle(ObserverTarget(q),remote,IntPtr.Zero,out ignored,0,false,0x00000001);
    if(!ok){int error=Marshal.GetLastWin32Error();throw new Win32Exception(error,"HOLD_CLOSE_SOURCE_UNCERTAIN_NO_SECOND_CLOSE");}
    t.State=TransferState.Retired;
   }catch{q.ForceObserverRetirement=true;throw;}
  }
  private static void ObserveOwned(BoundProcess p,string role,int ordinal,BoundRun run){
   QualificationContext q=qualification;ValidateQualificationRun(run);
   var t=new Transfer{Key=TransferKey(run,ordinal,role,p.Pid,p.CreatedFileTime),Role=role,Ordinal=ordinal,Pid=p.Pid,Parent=p.ParentPid,Created=p.CreatedFileTime,State=TransferState.DuplicatedLocal};
   string prepare=QPath(run,t.Key+".prepare");Exception primary=null;
   try{
    Win32(DuplicateHandle(GetCurrentProcess(),p.Process.Value,ObserverTarget(q),out t.Remote,ProcessQueryInformation|ProcessQueryLimitedInformation|Synchronize,false,0),"Observer process-only transfer");
    Require(t.Remote!=IntPtr.Zero&&t.Remote!=new IntPtr(-1),"remote process handle missing");
    q.Transfers.Add(t.Key,t);t.PublicationAttempted=true;
    Publish(prepare,TransferText(t,run));t.State=TransferState.PreparePublishedQuarantined;
    AwaitExact(QPath(run,t.Key+".prepared.ack"),t.Key,run,false);t.State=TransferState.Prepared;
    PublishOnce(QPath(run,t.Key+".commit"),t.Key);t.State=TransferState.Committed;
    AwaitExact(QPath(run,t.Key+".commit.ack"),t.Key,run,false);
   }catch(Exception e){primary=e;
    if(t.Remote!=IntPtr.Zero){
     if(t.State==TransferState.DuplicatedLocal&&ProvedAbsent(prepare)){
      try{ReclaimBeforePrepare(q,t,prepare);}catch(Exception cleanup){primary=new AggregateException(primary,cleanup);}
     }else{
      t.State=TransferState.AbortRequested;
      try{t.AbortSent=true;PublishOnce(QPath(run,t.Key+".abort"),t.Key);AwaitExact(QPath(run,t.Key+".retired.ack"),t.Key,run,true);t.State=TransferState.Retired;}
      catch(Exception cleanup){q.ForceObserverRetirement=true;primary=new AggregateException(primary,cleanup);}
     }
    }
    throw new InvalidOperationException("HOLD_TRANSFER_STOP",primary);
   }
  }
  private static void RequireLive(OwnedHandle p){Require(WaitForSingleObject(p.Value,0)==WaitTimeout,"observed handle not live");}
  private static void RequireTerminal(OwnedHandle p){Require(WaitForSingleObject(p.Value,0)==WaitObject0,"observed handle not terminal");}
  private static string CommandObserver(string command,int ordinal,BoundRun run,bool cleanup){
   string key=run.BatchToken+"."+ScenarioName(run.Scenario)+"."+ordinal+"."+command+"."+Guid.NewGuid().ToString("D");
   Publish(QPath(run,key+".command"),String.Join("\t",new[]{"QUAL_COMMAND",key,run.BatchToken,ScenarioName(run.Scenario),ordinal.ToString(CultureInfo.InvariantCulture),command}));
   AwaitExact(QPath(run,key+".command.ack"),key,run,cleanup);return key;
  }
  private static Observed FindRole(Dictionary<string,Observed> records,string role,int ordinal){
   foreach(Observed o in records.Values)if(o.Record.Role==role&&o.Record.Ordinal==ordinal&&o.Committed&&!o.Retired)return o;
   throw new InvalidOperationException("missing committed observed "+role);
  }
  private static void RetireObserved(Observed o,BoundRun run){
   if(!o.Retired){o.Handle.CloseChecked();Require(o.Handle.IsClosed,"remote close uncertain");o.Retired=true;}
   if(!o.RetiredAck){PublishOnce(QPath(run,o.Record.Key+".retired.ack"),o.Record.Key);o.RetiredAck=true;}
  }
  private static void VerifyTransferred(Observed o,QualificationContext q,Dictionary<string,Observed> records){
   Transfer t=o.Record;SetNotInheritable(o.Handle.Value);VerifyArchitecture(o.Handle.Value);
   Require(ProcessId(o.Handle.Value)==t.Pid&&CreationTime(o.Handle.Value)==t.Created&&ParentProcessId(o.Handle.Value)==t.Parent,"transferred exact tuple mismatch");
   if(t.Role=="supervisor"){Require(t.Parent==q.CreatorPid&&String.Equals(ImagePath(o.Handle.Value),Full(PowerShellPath),StringComparison.OrdinalIgnoreCase),"own Supervisor tuple");}
   else {
    VerifyNodeProcess(o.Handle.Value,t.Parent);
    if(t.Role=="canary")Require(t.Parent==q.CreatorPid,"own Canary creator");
    else if(t.Role=="root")Require(t.Parent==FindRole(records,"supervisor",-1).Record.Pid,"Root must be owned by exact Supervisor");
    else if(t.Role=="child"||t.Role=="sibling")Require(t.Parent==FindRole(records,"root",-1).Record.Pid,"owned Root child");
    else if(t.Role=="grandchild")Require(t.Parent==FindRole(records,"child",t.Ordinal).Record.Pid,"owned Child grandchild");
    else throw new InvalidOperationException("fixed observed role required");
   }
   RequireLive(o.Handle);o.Prepared=true;
  }
  private static void ObserverPump(QualificationContext q){
   var records=new Dictionary<string,Observed>(StringComparer.Ordinal);var commands=new HashSet<string>(StringComparer.Ordinal);bool stop=false;Exception failure=null;
   Publish(QPath(q.Run,"observer.ready.tsv"),q.Run.BatchToken+"\t"+ProcessId(GetCurrentProcess())+"\t"+CreationTime(GetCurrentProcess()));
   try{
    while(!stop&&GetTickCount64()<q.Run.OverallEnd&&DateTimeOffset.UtcNow.ToUnixTimeMilliseconds()<q.Run.OverallUtcMs){
     foreach(string file in Directory.GetFiles(QPath(q.Run,""),"*.prepare")){
      string key=Path.GetFileName(file).Substring(0,Path.GetFileName(file).Length-8);
      Observed o;
      if(!records.TryGetValue(key,out o)){
       string[] a=ReadSmall(file).TrimEnd('\n').Split('\t');Require(a.Length==9&&a[0]=="QUAL_TRANSFER"&&a[1]==q.Run.BatchToken&&a[2]==ScenarioName(q.Run.Scenario),"fixed PREPARE");
       int ordinal=checked((int)Int64.Parse(a[3],CultureInfo.InvariantCulture));Require(ordinal>=-1&&ordinal<6,"fixed observed ordinal");
       var t=new Transfer{Key=key,Role=a[4],Ordinal=ordinal,Pid=checked((uint)Canonical(a[5])),Parent=checked((uint)Canonical(a[6])),Created=Canonical(a[7]),Remote=new IntPtr(Canonical(a[8]))};
       Require(key==TransferKey(q.Run,ordinal,t.Role,t.Pid,t.Created),"PREPARE key mismatch");
       o=new Observed{Record=t,Handle=new OwnedHandle(t.Remote)};
       try{records.Add(key,o);}catch(Exception insertion){try{o.Handle.CloseChecked();}catch(Exception close){throw new AggregateException(insertion,close);}throw;}
      }
      if(ExistsKnown(QPath(q.Run,key+".abort"))){Require(ReadSmall(QPath(q.Run,key+".abort"))==key+"\n","ABORT binding");RetireObserved(o,q.Run);continue;}
      if(o.Retired)continue;
      if(!o.Prepared)VerifyTransferred(o,q,records);
      if(!o.PreparedAck){PublishOnce(QPath(q.Run,key+".prepared.ack"),key);o.PreparedAck=true;}
      if(ExistsKnown(QPath(q.Run,key+".commit"))){Require(ReadSmall(QPath(q.Run,key+".commit"))==key+"\n","COMMIT binding");o.Committed=true;if(!o.CommitAck){PublishOnce(QPath(q.Run,key+".commit.ack"),key);o.CommitAck=true;}}
     }
     foreach(string file in Directory.GetFiles(QPath(q.Run,""),"*.command")){
      string[] a=ReadSmall(file).TrimEnd('\n').Split('\t');Require(a.Length==6&&a[0]=="QUAL_COMMAND"&&a[2]==q.Run.BatchToken&&a[3]==ScenarioName(q.Run.Scenario),"fixed Observer command");
      string key=a[1];Require(Path.GetFileName(file)==key+".command","command key");if(commands.Contains(key))continue;
      int ordinal=Int32.Parse(a[4],CultureInfo.InvariantCulture);string command=a[5];
      Observed canary=FindRole(records,"canary",-1);
      if(command!="RETIRE_ALL")RequireLive(canary.Handle);
      if(command=="LIVE_ARMED"){
       RequireLive(FindRole(records,"supervisor",-1).Handle);RequireLive(FindRole(records,"root",-1).Handle);
       RequireLive(FindRole(records,"child",ordinal).Handle);RequireLive(FindRole(records,"grandchild",ordinal).Handle);
      }else if(command=="LIVE_UNEXPECTED"){
       RequireLive(FindRole(records,"root",-1).Handle);RequireLive(FindRole(records,"child",ordinal).Handle);
       RequireLive(FindRole(records,"sibling",ordinal).Handle);RequireTerminal(FindRole(records,"grandchild",ordinal).Handle);
      }else if(command=="RETIRE_LANE"){
       RequireLive(FindRole(records,"root",-1).Handle);
       foreach(Observed o in records.Values)if(o.Record.Ordinal==ordinal&&!o.Retired){Require(o.Committed,"uncommitted lane record");RequireTerminal(o.Handle);RetireObserved(o,q.Run);}
      }else if(command=="RETIRE_FAMILY"||command=="CRASH"||command=="RETIRE_ALL"){
       foreach(Observed o in records.Values)if(!o.Retired&&(command=="RETIRE_ALL"||o.Record.Role!="canary"&&(command=="CRASH"||o.Record.Role!="supervisor"))){Require(o.Committed,"uncommitted retirement record");RequireTerminal(o.Handle);RetireObserved(o,q.Run);}
       if(command=="RETIRE_ALL")stop=true;
      }else throw new InvalidOperationException("fixed Observer command required");
      PublishOnce(QPath(q.Run,key+".command.ack"),key);commands.Add(key);
     }
     RootSubjectClient.PumpAll();System.Threading.Thread.Sleep(10);
    }
    Require(stop,"Observer same overall end reached without retirement");
   }catch(Exception e){failure=e;}
   finally{
    foreach(Observed o in records.Values)try{RetireObserved(o,q.Run);}catch(Exception e){CaptureCleanupFailure(ref failure,e);}
   }
   if(failure!=null)throw new InvalidOperationException("HOLD_OBSERVER_RETIREMENT",failure);
  }


  private static void QualificationRootProof(IntPtr job,BoundProcess root,BoundRun run){
   QualificationContext q=qualification;ValidateQualificationRun(run);
   Require(q.ObserverCreatorVerified&&q.CanarySeparateJobVerified,"actual control creator proofs missing");
   RequireLive(q.CanaryQuery);VerifyMemberSet(job,new[]{root});
   ObserveOwned(root,"root",-1,run);q.Roles.Add(root.Pid,"root");
  }
  private static void PublishControl(BoundRun run,int ordinal,string name){PublishOnce(QPath(run,ordinal+"."+name),run.BatchToken+"\t"+ScenarioName(run.Scenario)+"\t"+ordinal);}
  private static void FixedWatchdog(BoundRun run){
   ulong now=GetTickCount64(),end=checked(now+1500);Require(end<run.WorkDeadline,"watchdog reserve");
   while(GetTickCount64()<end){RequireLive(qualification.CanaryQuery);ulong current=GetTickCount64();if(current>=end)break;ulong remaining=end-current;System.Threading.Thread.Sleep((int)Math.Min(50UL,remaining));}
   throw new TimeoutException("FIXED_QUALIFICATION_WATCHDOG_1500MS");
  }
  private static void QualificationCaptureProof(IntPtr job,BoundProcess root,List<BoundProcess> lane,List<BoundProcess> candidates,BoundRun run){
   QualificationContext q=qualification;ValidateQualificationRun(run);
   var all=new List<BoundProcess>(lane);all.AddRange(candidates);
   if(q.ChildPid==0){
    var direct=all.FindAll(p=>p.ParentPid==root.Pid);
    Require(direct.Count<=1,"unclassified multiple initial children");
    if(direct.Count==1)q.ChildPid=direct[0].Pid;
   }
   var ordered=new List<BoundProcess>(candidates);ordered.Sort((a,b)=>(a.Pid==q.ChildPid?0:a.ParentPid==q.ChildPid?1:2).CompareTo(b.Pid==q.ChildPid?0:b.ParentPid==q.ChildPid?1:2));
   foreach(BoundProcess p in ordered){
    string role=p.Pid==q.ChildPid?"child":p.ParentPid==q.ChildPid?"grandchild":p.ParentPid==root.Pid&&run.Scenario==QualificationScenario.UnexpectedMember?"sibling":null;
    Require(role!=null,"unrecognized verified graph");ObserveOwned(p,role,q.Ordinal,run);q.Roles.Add(p.Pid,role);
    if(role=="grandchild")q.Grandchild=p;
    if(role=="sibling"){
     BasicAccountingInformation accounting=QueryAccounting(job);
     Require(accounting.ActiveProcesses==3&&accounting.TotalProcesses==4&&q.Roles.Count==4,"unexpected member active3/cumulative4/four exact handles");
     RequireLive(root.Process);RequireLive(all.Find(x=>x.Pid==q.ChildPid).Process);RequireTerminal(q.Grandchild.Process);
     CommandObserver("LIVE_UNEXPECTED",q.Ordinal,run,false);q.UnexpectedEvidence=true;
    }
   }
   if(q.Armed||q.ChildPid==0||q.Grandchild==null)return;
   RequireLive(root.Process);RequireLive(all.Find(p=>p.Pid==q.ChildPid).Process);RequireLive(q.Grandchild.Process);RequireLive(q.CanaryQuery);
   CommandObserver("LIVE_ARMED",q.Ordinal,run,false);q.Armed=true;
   PublishControl(run,q.Ordinal,"ARMED.tsv");
   switch(run.Scenario){
    case QualificationScenario.Nominal:PublishControl(run,q.Ordinal,"release");break;
    case QualificationScenario.UnexpectedMember:
     PublishControl(run,q.Ordinal,"grandchild.release");WaitExited(q.Grandchild.Process.Value,run.WorkDeadline);
     RequireLive(root.Process);RequireLive(all.Find(p=>p.Pid==q.ChildPid).Process);
     PublishControl(run,q.Ordinal,"spawn-sibling");break;
    case QualificationScenario.IpcCancel:PublishControl(run,q.Ordinal,"cancel");break;
    case QualificationScenario.Watchdog:FixedWatchdog(run);break;
    case QualificationScenario.PrematureRootExit:PublishControl(run,q.Ordinal,"root-exit");break;
    case QualificationScenario.SupervisorCrash:
     Publish(QPath(run,"crash.armed.tsv"),run.BatchToken+"\t"+ScenarioName(run.Scenario)+"\t"+q.Ordinal);
     while(GetTickCount64()<run.WorkDeadline){RequireLive(q.CanaryQuery);RootSubjectClient.PumpAll();System.Threading.Thread.Sleep(10);}
     throw new TimeoutException("Supervisor crash trigger absent");
   }
  }
  private static void QualificationRetirementProof(IntPtr job,BoundProcess root,BoundRun run,int ordinal,bool whole){
   QualificationContext q=qualification;ValidateQualificationRun(run);RequireLive(q.CanaryQuery);
   if(whole){
    Require(QueryAccounting(job).ActiveProcesses==0&&QueryMembers(job,0).Length==0,"actual owned Job zero required");
    CommandObserver("RETIRE_FAMILY",ordinal,run,true);q.FinalZero=true;q.FamilyRetired=true;
   }else{
    VerifyMemberSet(job,new[]{root});CommandObserver("RETIRE_LANE",ordinal,run,true);
    q.Ordinal=ordinal+1;q.ChildPid=0;q.Grandchild=null;q.Armed=false;
   }
  }
  private static Cause ExpectedCause(QualificationScenario scenario){
   switch(scenario){case QualificationScenario.Nominal:return Cause.Nominal;case QualificationScenario.UnexpectedMember:return Cause.UnexpectedMember;case QualificationScenario.IpcCancel:return Cause.IpcCancel;case QualificationScenario.Watchdog:return Cause.Watchdog;case QualificationScenario.PrematureRootExit:return Cause.PrematureRootExit;case QualificationScenario.SupervisorCrash:return Cause.SupervisorCrash;default:return Cause.Unknown;}
  }
  private static bool ExactFailure(Exception e,string message){
   for(Exception current=e;current!=null;current=current.InnerException){if(current is AggregateException)return false;if(current.Message==message)return true;}return false;
  }
  private static Cause ObservedCause(Exception error,int code,QualificationContext q){
   if(error==null)return code==0&&q.Ordinal==6?Cause.Nominal:Cause.Unknown;
   if(ExactFailure(error,"extra/replaced descendant is not a qualified topology")&&q.UnexpectedEvidence)return Cause.UnexpectedMember;
   if(ExactFailure(error,"terminal/complete-stream evidence missing")&&ExistsKnown(QPath(q.Run,"0.cancel.ack"))&&ReadSmall(QPath(q.Run,"0.cancel.ack"))==q.Run.BatchToken+"\t"+ScenarioName(q.Run.Scenario)+"\t0\n")return Cause.IpcCancel;
   if(ExactFailure(error,"FIXED_QUALIFICATION_WATCHDOG_1500MS"))return Cause.Watchdog;
   if(ExactFailure(error,"root terminal before lane protocol completion"))return Cause.PrematureRootExit;
   return Cause.Unknown;
  }
  private static int FutureFixedSupervisorBody(string requestPath){
   QualificationContext q=ReadFixedControl(ControlRole.Supervisor,requestPath);Exception error=null;int code=2;
   try{code=SuperviseFixedBatch(q.Run);}catch(Exception e){error=e;}
   Cause actual=ObservedCause(error,code,q);bool ready=actual!=Cause.Unknown&&actual==ExpectedCause(q.Run.Scenario)&&q.FinalZero&&q.FamilyRetired&&!q.ForceObserverRetirement;
   Exception close=null;
   try{q.ObserverTarget.CloseChecked();}catch(Exception e){CaptureCleanupFailure(ref close,e);}
   try{q.CanaryQuery.CloseChecked();}catch(Exception e){CaptureCleanupFailure(ref close,e);}
   ready=ready&&close==null;
   Publish(Path.Combine(q.Run.OutputRoot,"case.result.tsv"),q.Run.BatchToken+"\t"+ScenarioName(q.Run.Scenario)+"\t"+actual+"\t"+(ready?"PASS":"HOLD")+"\t"+q.FinalZero+"\t"+q.FamilyRetired);
   return ready?0:2;
  }
  private static int FutureFixedObserverBody(string requestPath){QualificationContext q=ReadFixedControl(ControlRole.Observer,requestPath);ObserverPump(q);return 0;}
  // Closed role body graph; wrappers retain their unconditional veto before reaching these fixed calls.
  private static int FutureFixedRoleBody(ControlRole role,string requestPath,VerifiedRootRuntimeProof admitted){
   Require(Object.ReferenceEquals(admitted,activationProof),"HOLD_FIXED_ROLE_PROOF");externalRootRuntimeVerifier.VerifyCurrentPhase(admitted,"role-before-body");
   if(role==ControlRole.Observer)return FutureFixedObserverBody(requestPath);
   Require(role==ControlRole.Supervisor,"fixed PowerShell role");return FutureFixedSupervisorBody(requestPath);
  }
  private static void CreateCaseDirectories(BoundRun run){
   EnsureNoReparse(SourceRoot,SourceRoot);
   Directory.CreateDirectory(run.OutputRoot);EnsureNoReparse(run.OutputRoot,SourceRoot);
   Publish(Path.Combine(run.OutputRoot,"controller.claim"),run.BatchToken);
   Directory.CreateDirectory(Path.Combine(run.OutputRoot,"bridge"));Directory.CreateDirectory(QPath(run,""));
   Publish(Path.Combine(run.OutputRoot,"case.request.json"),CaseJson(run,"root"));
   Publish(Path.Combine(run.OutputRoot,"canary.case.json"),CaseJson(run,"canary"));
  }
  private static void PublishRoleRequest(QualificationContext q,ControlRole role,long observer,long canary){Publish(Path.Combine(q.Run.OutputRoot,role.ToString().ToLowerInvariant()+".control.tsv"),ControlRequest(q,role,observer,canary));}
  private static bool ReadSupervisorResult(QualificationContext q){
   string[] a=ReadSmall(Path.Combine(q.Run.OutputRoot,"case.result.tsv")).TrimEnd('\n').Split('\t');
   return a.Length==6&&a[0]==q.Run.BatchToken&&a[1]==ScenarioName(q.Run.Scenario)&&a[2]==ExpectedCause(q.Run.Scenario).ToString()&&a[3]=="PASS"&&a[4]=="True"&&a[5]=="True";
  }
  private static bool RunFutureCase(QualificationContext q){
   Exception failure=null;bool outcome=false;qualification=q;
   try{
    RequireQualificationReserve(q.Run,0);CreateCaseDirectories(q.Run);
    StartFixedControl(q,ControlRole.Observer);q.ObserverCreatorVerified=q.Observer.Verified;
    PublishRoleRequest(q,ControlRole.Observer,0,0);ResumeOwned(q.Observer);
    AwaitExact(QPath(q.Run,"observer.ready.tsv"),q.Run.BatchToken+"\t"+q.Observer.Owner.Pid+"\t"+q.Observer.Owner.CreatedFileTime,q.Run,false);
    RequireQualificationReserve(q.Run,0);StartFixedControl(q,ControlRole.Canary);q.CanarySeparateJobVerified=q.Canary.Verified&&q.Canary.Owner.InOwnedJob;
    ResumeOwned(q.Canary);ObserveOwned(q.Canary.Owner,"canary",-1,q.Run);
    RequireQualificationReserve(q.Run,0);StartFixedControl(q,ControlRole.Supervisor);
    IntPtr observer=DuplicateTo(q.Observer.Owner.Process,q.Supervisor,ProcessQueryInformation|ProcessQueryLimitedInformation|Synchronize|0x0040);
    IntPtr canary=DuplicateTo(q.Canary.Owner.Process,q.Supervisor,ProcessQueryInformation|ProcessQueryLimitedInformation|Synchronize);
    PublishRoleRequest(q,ControlRole.Supervisor,observer.ToInt64(),canary.ToInt64());
    ObserveOwned(q.Supervisor.Owner,"supervisor",-1,q.Run);ResumeOwned(q.Supervisor);
    if(q.Run.Scenario==QualificationScenario.SupervisorCrash){
     AwaitExact(QPath(q.Run,"crash.armed.tsv"),q.Run.BatchToken+"\t"+ScenarioName(q.Run.Scenario)+"\t0",q.Run,false);
     CommandObserver("LIVE_ARMED",0,q.Run,false);q.CrashLiveProof=true;RequireLive(q.Canary.Owner.Process);
     Win32(TerminateProcess(q.Supervisor.Owner.Process.Value,QualificationCrashExit),"exact own Supervisor crash");
    }
    WaitExited(q.Supervisor.Owner.Process.Value,q.Run.OverallEnd);
    uint code;Win32(GetExitCodeProcess(q.Supervisor.Owner.Process.Value,out code),"own Supervisor exit");
    if(q.Run.Scenario==QualificationScenario.SupervisorCrash){
     Require(q.CrashLiveProof&&code==QualificationCrashExit,"actual exact Supervisor crash required");
     RequireLive(q.Canary.Owner.Process);CommandObserver("CRASH",0,q.Run,true);outcome=true; // No tested Job handle/accounting exists in Controller.
    }else outcome=code==0&&ReadSupervisorResult(q);
   }catch(Exception e){failure=e;}
   finally{
    try{RetireOwnedControl(q.Supervisor,q.Run,true);}catch(Exception e){CaptureCleanupFailure(ref failure,e);}
    try{RetireOwnedControl(q.Canary,q.Run,true);}catch(Exception e){CaptureCleanupFailure(ref failure,e);}
    try{
     if(q.Observer!=null&&q.Observer.Owner!=null&&!q.ForceObserverRetirement)CommandObserver("RETIRE_ALL",0,q.Run,true);
    }catch(Exception e){q.ForceObserverRetirement=true;CaptureCleanupFailure(ref failure,e);}
    try{RetireOwnedControl(q.Observer,q.Run,q.ForceObserverRetirement||failure!=null);}catch(Exception e){CaptureCleanupFailure(ref failure,e);}
   }
   return outcome&&failure==null&&!q.ForceObserverRetirement&&q.Supervisor.Terminal&&q.Supervisor.Closed&&q.Canary.Terminal&&q.Canary.Closed&&q.Observer.Terminal&&q.Observer.Closed&&GetTickCount64()<=q.Run.OverallEnd&&DateTimeOffset.UtcNow.ToUnixTimeMilliseconds()<=q.Run.OverallUtcMs;
  }
  private static bool SuiteDeadlineHolds(SuiteClock suite,ulong now,long utcNow){
   return now>=suite.Issued&&now<=suite.OverallEnd&&utcNow>=suite.UtcIssued&&utcNow<=suite.UtcEnd;
  }
  private static int RunFutureQualificationSuite(VerifiedRootRuntimeProof admitted){
   SuiteClock suite=CaptureOriginalSuiteClock(admitted);
   var order=new[]{QualificationScenario.Nominal,QualificationScenario.UnexpectedMember,QualificationScenario.IpcCancel,QualificationScenario.Watchdog,QualificationScenario.PrematureRootExit,QualificationScenario.SupervisorCrash};
   bool stopped=false;var results=new StringBuilder();int passed=0;
   foreach(QualificationScenario scenario in order){
    string state="NOT_RUN";
    if(!stopped){
     var q=new QualificationContext{Suite=suite,Run=MakeRun(suite,scenario,externalRootRuntimeVerifier.VerifiedNodeOrigin(admitted,scenario)),CreatorPid=ProcessId(GetCurrentProcess())};
     try{bool ok=RunFutureCase(q);state=ok?"PASS":"HOLD";if(ok)passed++;else stopped=true;}catch{state="HOLD";stopped=true;}
    }
    results.Append(suite.Token).Append('\t').Append(ScenarioName(scenario)).Append('\t').Append(state).Append('\t').Append(suite.OverallEnd).Append('\n');
   }
   RootSubjectClient.CloseProposals();
   qualification=null;
   bool cleanupWithinDeadline=SuiteDeadlineHolds(suite,GetTickCount64(),DateTimeOffset.UtcNow.ToUnixTimeMilliseconds());
   string root=Path.Combine(QualificationRunsRoot,suite.Token);Directory.CreateDirectory(root);
   Publish(Path.Combine(root,"suite.result.tsv"),"QUAL_SUITE_CASE_CANDIDATES\t"+suite.Token+"\t"+suite.OverallEnd+"\t"+suite.UtcEnd+"\n"+results.ToString().TrimEnd('\n'));
   bool publicationWithinDeadline=SuiteDeadlineHolds(suite,GetTickCount64(),DateTimeOffset.UtcNow.ToUnixTimeMilliseconds());
   return passed==6&&cleanupWithinDeadline&&publicationWithinDeadline?0:2;
  }

 }
}
