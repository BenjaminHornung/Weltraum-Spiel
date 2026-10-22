using System;using System.IO;using System.IO.Pipes;using System.Text;using System.Text.Json;using System.Collections.Generic;using System.Globalization;using System.Runtime.InteropServices;using System.Threading.Tasks;
namespace Hestia.M5.Native24Source {public static partial class Native24Family {
 public static int RunRootHandoffHost(string originalHostState){return new RootHost(originalHostState).Run();}
 private sealed class PrivateChannel : IDisposable {
  public AnonymousPipeServerStream Input,Output;public OwnedHandle Log;
  private readonly byte[] buffer=new byte[4096];private readonly StringBuilder pending=new StringBuilder();private Task<int> read;
  public bool Eof,Closed;public readonly Queue<string> Lines=new Queue<string>();
  public bool HasPartialFrame{get{return pending.Length!=0;}}
  public void Pump(){
   if(Eof)return;if(read==null)read=Output.ReadAsync(buffer,0,buffer.Length);
   while(read.IsCompleted){int n=read.GetAwaiter().GetResult();read=null;if(n==0){Eof=true;Require(pending.Length==0,"PRIVATE_PARTIAL_FINAL_LINE");return;}
    pending.Append(Encoding.UTF8.GetString(buffer,0,n));Require(pending.Length<=65536,"PRIVATE_LINE_BOUND");string s=pending.ToString();int p;while((p=s.IndexOf('\n'))>=0){string line=s.Substring(0,p).TrimEnd('\r');Require(line.Length<=65536,"PRIVATE_FRAME_BOUND");Lines.Enqueue(line);s=s.Substring(p+1);}pending.Clear();pending.Append(s);read=Output.ReadAsync(buffer,0,buffer.Length);
   }
  }
  public void Send(string line,ulong end){Require(line!=null&&line.Length<=65536&&GetTickCount64()<end,"PRIVATE_SEND_BOUND_END");byte[] b=Encoding.UTF8.GetBytes(line+"\n");var write=Input.WriteAsync(b,0,b.Length);ulong now=GetTickCount64();Require(now<end,"PRIVATE_SEND_END");Require(write.Wait(checked((int)Math.Min(1000UL,end-now))),"PRIVATE_SEND_TIMEOUT");}
  public void Dispose(){if(Closed)return;Exception failure=null;try{if(Input!=null)Input.Dispose();}catch(Exception e){failure=e;}try{if(Output!=null)Output.Dispose();}catch(Exception e){CaptureCleanupFailure(ref failure,e);}Closed=failure==null;if(failure!=null)throw failure;}
 }
 private static AnonymousPipeServerStream CreateRelayOutput(out OwnedHandle inherited){
  var pipe=new AnonymousPipeServerStream(PipeDirection.In,HandleInheritability.Inheritable,65536);IntPtr copy;
  try{Win32(DuplicateHandle(GetCurrentProcess(),pipe.ClientSafePipeHandle.DangerousGetHandle(),GetCurrentProcess(),out copy,0,true,2),"sealed child stdout pipe");inherited=new OwnedHandle(copy);return pipe;}catch{pipe.Dispose();throw;}
 }
 private sealed class RootHost {
  private readonly RootRuntimeVerifier verifier=new RootRuntimeVerifier();
  private Dictionary<string,string> state;
  private OwnedHandle job,stdoutClient,stdinClient,stderrClient;
  private BoundProcess controller;
  private PrivateChannel channel,errorChannel;
  private RootSubjectRegistry registry;
  private bool ack,controllerTerminal,jobZero,streamsComplete;
  public RootHost(string json){state=verifier.AdmitRootHost(json);}
  private ulong End{get{return checked((ulong)Canonical(Field(state,"overallEnd")));}}
  private ulong WorkEnd{get{return checked((ulong)Canonical(Field(state,"workEnd")));}}
  private void Clock(){verifier.VerifyHostPhase(state);Require(GetTickCount64()<=End&&DateTimeOffset.UtcNow.ToUnixTimeMilliseconds()<=Canonical(Field(state,"utcEnd")),"ROOT_HOST_ORIGINAL_CLOCK");}
  private OwnedHandle CreateOuterJob(){
   var j=new OwnedHandle(CreateJobObjectW(IntPtr.Zero,null));try{SetNotInheritable(j.Value);var limits=new ExtendedLimitInformation();limits.BasicLimitInformation.LimitFlags=JobLimitKillOnClose;
    Win32(SetInformationJobObject(j.Value,JobObjectExtendedLimitInformation,ref limits,(uint)Marshal.SizeOf(typeof(ExtendedLimitInformation))),"Root outer KILL_ON_JOB_CLOSE no breakaway");IntPtr buffer=Marshal.AllocHGlobal(Marshal.SizeOf(typeof(ExtendedLimitInformation)));try{uint returned;Win32(QueryInformationJobObject(j.Value,JobObjectExtendedLimitInformation,buffer,(uint)Marshal.SizeOf(typeof(ExtendedLimitInformation)),out returned),"Root actual outer flags");var actual=(ExtendedLimitInformation)Marshal.PtrToStructure(buffer,typeof(ExtendedLimitInformation));Require(actual.BasicLimitInformation.LimitFlags==JobLimitKillOnClose,"Root outer flags/breakaway");}finally{Marshal.FreeHGlobal(buffer);}return j;}catch{j.CloseChecked();throw;}
  }
  private void CreateController(){
   ProcAttributes attrs=null;IntPtr env=IntPtr.Zero;var pi=new ProcessInformation();Exception failure=null;
   try{
    channel=new PrivateChannel();channel.Input=CreateAdmissionInput(out stdinClient);channel.Output=CreateRelayOutput(out stdoutClient);
   // Stderr is a separate read-only transport, never a Job handle.
   errorChannel=new PrivateChannel();errorChannel.Output=CreateRelayOutput(out stderrClient);
    attrs=new ProcAttributes(2);attrs.AddJob(job.Value);attrs.AddHandles(new[]{stdinClient.Value,stdoutClient.Value,stderrClient.Value});
    var startup=new StartupInfoEx();startup.StartupInfo.cb=(uint)Marshal.SizeOf(typeof(StartupInfoEx));startup.StartupInfo.dwFlags=StartfUseStdHandles;startup.StartupInfo.hStdInput=stdinClient.Value;startup.StartupInfo.hStdOutput=stdoutClient.Value;startup.StartupInfo.hStdError=stderrClient.Value;startup.lpAttributeList=attrs.List;
    byte[] b=EnvironmentBlock(false);env=Marshal.AllocHGlobal(b.Length);Marshal.Copy(b,0,env,b.Length);
    string command=Quote(PowerShellPath)+" -NoProfile -NonInteractive -File "+Quote(Path.Combine(SourceRoot,"qualify.ps1"));
    Clock();Win32(CreateProcessW(PowerShellPath,new StringBuilder(command),IntPtr.Zero,IntPtr.Zero,true,CreateSuspended|ExtendedStartupInfoPresent|CreateUnicodeEnvironment|CreateNoWindow,env,SourceRoot,ref startup,out pi),"Root fixed suspended controller");
    controller=new BoundProcess{Process=new OwnedHandle(pi.hProcess),Thread=new OwnedHandle(pi.hThread),Pid=pi.dwProcessId};SetNotInheritable(controller.Process.Value);SetNotInheritable(controller.Thread.Value);
    controller.ParentPid=ParentProcessId(controller.Process.Value);controller.CreatedFileTime=CreationTime(controller.Process.Value);
    Require(controller.ParentPid==ProcessId(GetCurrentProcess())&&ImagePath(controller.Process.Value)==Full(PowerShellPath),"Root actual controller tuple");bool member;Win32(IsProcessInJob(controller.Process.Value,job.Value,out member),"Root controller outer membership");Require(member,"Root controller missing outer Job");controller.InOwnedJob=true;VerifyMemberSet(job.Value,new[]{controller});
    state["controllerPid"]=controller.Pid.ToString(CultureInfo.InvariantCulture);state["controllerCreation"]=controller.CreatedFileTime.ToString(CultureInfo.InvariantCulture);
    registry=new RootSubjectRegistry(state,job,()=>verifier.VerifyHostSourceBytes(state));var proof=registry.Bootstrap(controller);
    var frame=new Dictionary<string,string>(state,StringComparer.Ordinal);frame["schema"]="hestia.m5.handoff.v3";frame["role"]="Controller";frame["subjectPid"]=state["controllerPid"];frame["subjectCreation"]=state["controllerCreation"];frame["subjectParentPid"]=state["hostPid"];frame["subjectImage"]=PowerShellPath;frame["requestPath"]="NONE";frame["requestSha256"]="NONE";frame["scenario"]="NONE";frame["nodeOrigin"]="NONE";
    frame["registrationNonce"]=proof["registrationNonce"];frame["recordId"]=proof["recordId"];frame["recordSha256"]=proof["recordSha256"];
    string line=JsonSerializer.Serialize(frame);controllerFrameHash=HashText(line);Clock();channel.Send(line,End);channel.Input.DisposeLocalCopyOfClientHandle();channel.Output.DisposeLocalCopyOfClientHandle();errorChannel.Output.DisposeLocalCopyOfClientHandle();
    var resumeProbe=new Dictionary<string,string>(StringComparer.Ordinal);foreach(var k in SubjectProtocol.RequestFields.Split(' '))resumeProbe[k]=Field(proof,k);resumeProbe["schema"]="hestia.m5.subject.register.v1";resumeProbe["mode"]="PROBE";resumeProbe["probeNonce"]=Guid.NewGuid().ToString("D");registry.Handle(SubjectProtocol.Register,resumeProbe);
    Clock();uint prior=ResumeThread(controller.Thread.Value);Require(prior==1,"Root exactly once controller resume");controller.Thread.CloseChecked();
   }catch(Exception e){failure=e;}
   finally{
    try{if(attrs!=null)attrs.Dispose();}catch(Exception e){CaptureCleanupFailure(ref failure,e);}
    try{if(env!=IntPtr.Zero)Marshal.FreeHGlobal(env);}catch(Exception e){CaptureCleanupFailure(ref failure,e);}
    try{if(stdinClient!=null)stdinClient.CloseChecked();}catch(Exception e){CaptureCleanupFailure(ref failure,e);}
    try{if(stdoutClient!=null)stdoutClient.CloseChecked();}catch(Exception e){CaptureCleanupFailure(ref failure,e);}
    try{if(stderrClient!=null)stderrClient.CloseChecked();}catch(Exception e){CaptureCleanupFailure(ref failure,e);}
    if(failure!=null&&controller==null&&pi.hProcess!=IntPtr.Zero)controller=new BoundProcess{Process=new OwnedHandle(pi.hProcess),Thread=new OwnedHandle(pi.hThread),Pid=pi.dwProcessId};
   }
   if(failure!=null)throw failure;
  }
  private string controllerFrameHash;
  private void HandleLine(string line){
   Clock();
   if(line.StartsWith("M5_ACK_V1\t",StringComparison.Ordinal)){
    var p=line.Split('\t');Require(!ack&&p.Length==5&&p[1]==Field(state,"grantId")&&p[2]==Field(state,"controllerPid")&&p[3]==Field(state,"controllerCreation")&&p[4]==controllerFrameHash,"Root SAME held controller ack once");
    Require(WaitForSingleObject(controller.Process.Value,0)==WaitTimeout,"Root controller not live");Clock();ack=true;channel.Send("M5_ACK_OK_V1\t"+p[1]+"\t"+p[2]+"\t"+p[4],End);Clock();return;
   }
   if(line.StartsWith("M5_SUBJECT_",StringComparison.Ordinal)){
    string header;var request=SubjectProtocol.Parse(line,out header);Require(header==SubjectProtocol.Register||header==SubjectProtocol.Retire,"Root request headers only");
    Require(ack||Field(request,"mode")=="PROBE"&&Field(request,"pid")==Field(state,"controllerPid"),"ROOT_NO_CHILD_BEFORE_SAME_HOST_ACK");
    var response=registry.Handle(header,request);Clock();channel.Send(SubjectProtocol.Encode(header==SubjectProtocol.Retire?SubjectProtocol.Closed:SubjectProtocol.Ack,response),End);Clock();return;
   }
   Require(line.Length<=65536,"Root stdout bound");Console.Out.WriteLine(line);
  }
  private void PumpStreams(){channel.Pump();errorChannel.Pump();while(errorChannel.Lines.Count>0)Console.Error.WriteLine(errorChannel.Lines.Dequeue());}
  public int Run(){
   Exception failure=null;bool handlesClosed=false;uint exitCode=1;
   try{
    Clock();job=CreateOuterJob();CreateController();
    while(GetTickCount64()<WorkEnd){
     PumpStreams();while(channel.Lines.Count>0)HandleLine(channel.Lines.Dequeue());
     uint wait=WaitForSingleObject(controller.Process.Value,0);if(wait==WaitObject0){controllerTerminal=true;break;}Require(wait==WaitTimeout,"Root controller wait");System.Threading.Thread.Sleep(1);
    }
    // Emergency cleanup starts at the ORIGINAL work endpoint, preserving the original 12-second reserve.
    if(!controllerTerminal)throw new TimeoutException("Root work end/controller loss");
    Win32(GetExitCodeProcess(controller.Process.Value,out exitCode),"Root controller exit");Require(exitCode==0&&ack,"Root completed acknowledged controller");
    channel.Pump();while(channel.Lines.Count>0)HandleLine(channel.Lines.Dequeue());streamsComplete=channel.Eof&&errorChannel.Eof;
    jobZero=QueryAccounting(job.Value).ActiveProcesses==0&&QueryMembers(job.Value,0).Length==0;Require(jobZero,"Root descendants remain after controller");
    registry.CloseTerminalReverse();Require(registry.RegistryZero,"Root RegistryZero");Clock();
   }catch(Exception e){failure=e;}
   finally{
    if(job!=null&&!jobZero){try{Win32(TerminateJobObject(job.Value,ExpectedJobExitCode),"Root owned outer crash cleanup");while(GetTickCount64()<End){RootSubjectClient.PumpAll();if(QueryAccounting(job.Value).ActiveProcesses==0&&QueryMembers(job.Value,0).Length==0){jobZero=true;break;}System.Threading.Thread.Sleep(1);}Require(jobZero,"Root actual outer job zero not established");}catch(Exception e){CaptureCleanupFailure(ref failure,e);}}
    if(controller!=null){try{WaitExited(controller.Process.Value,End);controllerTerminal=true;}catch(Exception e){CaptureCleanupFailure(ref failure,e);}}
    if(registry!=null){
     try{if(jobZero)registry.ReleasePendingAfterOuterZero();}catch(Exception e){CaptureCleanupFailure(ref failure,e);}
     try{registry.CloseTerminalReverse();}catch(Exception e){CaptureCleanupFailure(ref failure,e);}
    }
    if(channel!=null&&errorChannel!=null)try{while(GetTickCount64()<End){PumpStreams();if(channel.Eof&&errorChannel.Eof)break;System.Threading.Thread.Sleep(1);}streamsComplete=channel.Eof&&errorChannel.Eof;}catch(Exception e){CaptureCleanupFailure(ref failure,e);}
    if(channel!=null)try{channel.Dispose();Require(channel.Closed,"ROOT_STDOUT_CHANNEL_CLOSE_UNCERTAIN");}catch(Exception e){CaptureCleanupFailure(ref failure,e);}
    if(errorChannel!=null)try{errorChannel.Dispose();Require(errorChannel.Closed,"ROOT_STDERR_CHANNEL_CLOSE_UNCERTAIN");}catch(Exception e){CaptureCleanupFailure(ref failure,e);}
    if(controller!=null)try{controller.CloseChecked();}catch(Exception e){CaptureCleanupFailure(ref failure,e);}
    if(stderrClient!=null)try{stderrClient.CloseChecked();}catch(Exception e){CaptureCleanupFailure(ref failure,e);}
    if(job!=null)try{job.CloseChecked();}catch(Exception e){CaptureCleanupFailure(ref failure,e);}
    handlesClosed=(controller==null||controller.Process.IsClosed&&(controller.Thread==null||controller.Thread.IsClosed))&&(stdinClient==null||stdinClient.IsClosed)&&(stdoutClient==null||stdoutClient.IsClosed)&&(channel==null||channel.Closed)&&(job==null||job.IsClosed)&&(stderrClient==null||stderrClient.IsClosed)&&(errorChannel==null||errorChannel.Closed);
   }
   bool pass=failure==null&&controllerTerminal&&jobZero&&registry!=null&&registry.RegistryZero&&streamsComplete&&handlesClosed&&GetTickCount64()<=End&&DateTimeOffset.UtcNow.ToUnixTimeMilliseconds()<=Canonical(Field(state,"utcEnd"));
   Console.Out.WriteLine(JsonSerializer.Serialize(new{rootHost=true,pass,controllerTerminal,jobZero,registryZero=registry!=null&&registry.RegistryZero,streamsComplete,handlesClosed,failure=failure==null?null:failure.Message}));
   pass=pass&&GetTickCount64()<=End&&DateTimeOffset.UtcNow.ToUnixTimeMilliseconds()<=Canonical(Field(state,"utcEnd"));return pass?0:1;
  }
 }
 private static string HashText(string s){using(var h=System.Security.Cryptography.SHA256.Create())return BitConverter.ToString(h.ComputeHash(Encoding.UTF8.GetBytes(s))).Replace("-","").ToLowerInvariant();}
}}
