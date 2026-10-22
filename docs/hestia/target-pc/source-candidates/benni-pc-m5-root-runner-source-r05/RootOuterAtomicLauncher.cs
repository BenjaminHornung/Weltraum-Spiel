// Source-only R04. Narrow reuse of frozen R05 raw suspended-create, Job attributes and pipe patterns.
using System;
using System.IO;
using System.Text;
using System.Diagnostics;
using System.ComponentModel;
using System.Collections.Generic;
using System.Globalization;
using System.Runtime.InteropServices;
using System.Security.Cryptography;

namespace Hestia.M5.RootOuterR04
{
 public sealed class LaunchResult
 {
  public bool Success, Created, Resumed, Terminal, StdoutEof, StderrEof, JobZero, HandlesClosed, PartialFrame;
  public uint DispatcherPid, ExitCode;
  public long DispatcherCreation, ElapsedMilliseconds;
  public string DispatcherImage, Failure, Stdout, Stderr;
 }
 public static class RootOuterAtomicLauncher
 {
  private const string Base = @"C:\IFI_SourceCode\Temp\WeltraumSpiel\artifacts\hestia-target-pc-2026-10-13";
  private const string PowerShellPath = @"C:\IFI_SourceCode\Utils\PowerShell\pwsh.exe";
  private const string PowerShellSha256 = "db6dd81183fe57d22e03b911ec9a30a2fd7c40542e97743615355a6fb44f458f";
  private const uint KillOnClose = 0x2000, HandleInherit = 1, ExtendedLimits = 9, AccountingClass = 1, MemberListClass = 3;
  private const uint CreateSuspended = 4, ExtendedStartupInfoPresent = 0x80000, CreateUnicodeEnvironment = 0x400, CreateNoWindow = 0x08000000;
  private const uint StartfUseStdHandles = 0x100, HandleListAttribute = 0x20002, JobListAttribute = 0x2000D;
  private const uint WaitObject0 = 0, WaitTimeout = 0x102, ErrorBrokenPipe = 109, AbortExit = 0xE71A;
  private static void Require(bool yes, string reason) { if (!yes) throw new InvalidOperationException(reason); }
  private static void Win32(bool yes, string api) { if (!yes) throw new Win32Exception(Marshal.GetLastWin32Error(), api); }
  private sealed class RawHandle
  {
   public IntPtr Value;
   private bool attempted;
   public bool Closed { get { return Value == IntPtr.Zero; } }
   public void CloseChecked() {
    if (Value == IntPtr.Zero) return;
    Require(!attempted, "uncertain previous CloseHandle");
    attempted = true;
    Win32(CloseHandle(Value), "checked raw CloseHandle");
    Value = IntPtr.Zero;
   }
  }
  // All slots exist before any API can produce an owned handle.
  private sealed class Attributes
  {
   public IntPtr List, Jobs, Handles;
   private bool initialized;
   public void Prepare(IntPtr job, IntPtr[] whitelist) {
    Require(whitelist.Length == 3 && Array.IndexOf(whitelist, job) < 0, "exact three stdio handles, never Job");
    IntPtr needed = IntPtr.Zero;
    bool probe = InitializeProcThreadAttributeList(IntPtr.Zero, 2, 0, ref needed);
    int error = Marshal.GetLastWin32Error();
    Require(!probe && error == 122 && needed.ToInt64() > 0, "attribute size probe");
    List = Marshal.AllocHGlobal(needed);
    Win32(InitializeProcThreadAttributeList(List, 2, 0, ref needed), "attribute initialization");
    initialized = true;
    Jobs = Marshal.AllocHGlobal(IntPtr.Size); Marshal.WriteIntPtr(Jobs, job);
    Win32(UpdateProcThreadAttribute(List, 0, new UIntPtr(JobListAttribute), Jobs, new UIntPtr((uint)IntPtr.Size), IntPtr.Zero, IntPtr.Zero), "atomic JOB_LIST");
    Handles = Marshal.AllocHGlobal(3 * IntPtr.Size);
    for (int i = 0; i < 3; i++) Marshal.WriteIntPtr(Handles, i * IntPtr.Size, whitelist[i]);
    Win32(UpdateProcThreadAttribute(List, 0, new UIntPtr(HandleListAttribute), Handles, new UIntPtr((uint)(3 * IntPtr.Size)), IntPtr.Zero, IntPtr.Zero), "exact HANDLE_LIST");
   }
   public void CloseChecked() {
    try { if (initialized) { DeleteProcThreadAttributeList(List); initialized = false; } }
    finally {
     try { if (Handles != IntPtr.Zero) { Marshal.FreeHGlobal(Handles); Handles = IntPtr.Zero; } }
     finally {
      try { if (Jobs != IntPtr.Zero) { Marshal.FreeHGlobal(Jobs); Jobs = IntPtr.Zero; } }
      finally { if (List != IntPtr.Zero) { Marshal.FreeHGlobal(List); List = IntPtr.Zero; } }
     }
    }
   }
  }
  private sealed class PipeReader
  {
   private readonly RawHandle pipe;
   private readonly Decoder decoder = new UTF8Encoding(false, true).GetDecoder();
   private readonly byte[] bytes = new byte[4096];
   private readonly char[] chars = new char[8192];
   private readonly StringBuilder data = new StringBuilder(), partial = new StringBuilder();
   public bool Eof, Closed;
   public bool PartialFrame { get { return partial.Length != 0; } }
   public string Text { get { return data.ToString(); } }
   public PipeReader(RawHandle handle) { pipe = handle; }
   private void Append(int count) {
    Require(data.Length + count <= 1048576, "bounded channel");
    data.Append(chars, 0, count);
    for (int i = 0; i < count; i++) {
     if (chars[i] == '\n') partial.Clear();
     else { partial.Append(chars[i]); Require(partial.Length <= 65536, "bounded partial frame"); }
    }
   }
   private void End() {
    Append(decoder.GetChars(Array.Empty<byte>(), 0, 0, chars, 0, true));
    Eof = true; Require(!PartialFrame, "partial frame at actual EOF");
   }
   public void Pump() {
    if (Eof) return;
    uint available;
    if (!PeekNamedPipe(pipe.Value, IntPtr.Zero, 0, IntPtr.Zero, out available, IntPtr.Zero)) {
     int error = Marshal.GetLastWin32Error();
     if (error == ErrorBrokenPipe) { End(); return; }
     throw new Win32Exception(error, "nonblocking pipe availability");
    }
    if (available == 0) return;
    uint read;
    bool ok = ReadFile(pipe.Value, bytes, Math.Min(available, (uint)bytes.Length), out read, IntPtr.Zero);
    if (!ok) {
     int error = Marshal.GetLastWin32Error();
     if (error == ErrorBrokenPipe) { End(); return; }
     throw new Win32Exception(error, "bounded available-byte pipe read");
    }
    Require(read > 0, "unexpected zero read without EOF");
    Append(decoder.GetChars(bytes, 0, checked((int)read), chars, 0, false));
   }
   public void CloseChecked() { pipe.CloseChecked(); Closed = pipe.Closed; }
  }
  private sealed class Run
  {
   private readonly long issued, workEnd, overallEnd, utcIssued, utcEnd;
   private readonly Stopwatch originalWatch;
   private readonly string dispatcherHash;
   private readonly RawHandle job = new RawHandle(), process = new RawHandle(), thread = new RawHandle();
   private readonly RawHandle stdinRead = new RawHandle(), stdinWrite = new RawHandle(), stdoutRead = new RawHandle(), stdoutWrite = new RawHandle(), stderrRead = new RawHandle(), stderrWrite = new RawHandle();
   private readonly Attributes attributes = new Attributes();
   private readonly List<Exception> errors = new List<Exception>();
   private readonly LaunchResult result = new LaunchResult();
   private ProcessInformation pi;
   private PipeReader output, errorOutput;
   private IntPtr environment;
   private bool terminationAttempted;
   public Run(long i, long w, long e, long u, long ue, Stopwatch watch, string hash) {
    issued = i; workEnd = w; overallEnd = e; utcIssued = u; utcEnd = ue; originalWatch = watch; dispatcherHash = hash;
   }
   private int Remaining(bool work) {
    long native = (work ? workEnd : overallEnd) - Environment.TickCount64;
    long utc = (work ? checked(utcIssued + 48000) : utcEnd) - DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();
    long elapsed = (work ? 48000 : 60000) - originalWatch.ElapsedMilliseconds;
    return checked((int)Math.Max(0, Math.Min(Math.Min(native, utc), elapsed)));
   }
   private void Clock() {
    Require(originalWatch != null && originalWatch.IsRunning, "original running Stopwatch");
    Require(issued >= 0 && issued <= long.MaxValue - 60000 && utcIssued >= 0 && utcIssued <= long.MaxValue - 60000, "checked clock origins");
    Require(workEnd == issued + 48000 && overallEnd == issued + 60000 && utcEnd == utcIssued + 60000, "unchanged original 48/60");
    Require(Environment.TickCount64 >= issued && DateTimeOffset.UtcNow.ToUnixTimeMilliseconds() >= utcIssued && Remaining(false) > 0, "original native UTC Stopwatch intersection");
   }
   private void Capture(Action action) { try { action(); } catch (Exception e) { errors.Add(e); } }
   private void AbortJob() {
    if (job.Value == IntPtr.Zero || terminationAttempted) return;
    terminationAttempted = true;
    Win32(TerminateJobObject(job.Value, AbortExit), "immediate whole outer Job abort");
   }
   private void ConfigureJob() {
    job.Value = CreateJobObjectW(IntPtr.Zero, null);
    Require(job.Value != IntPtr.Zero && job.Value != new IntPtr(-1), "raw Job acquired");
    NonInheritable(job.Value);
    var limits = new ExtendedLimitInformation(); limits.BasicLimitInformation.LimitFlags = KillOnClose;
    Win32(SetInformationJobObject(job.Value, ExtendedLimits, ref limits, (uint)Marshal.SizeOf<ExtendedLimitInformation>()), "KILL_ON_CLOSE only");
    IntPtr buffer = Marshal.AllocHGlobal(Marshal.SizeOf<ExtendedLimitInformation>());
    try {
     uint returned;
     Win32(QueryInformationJobObject(job.Value, ExtendedLimits, buffer, (uint)Marshal.SizeOf<ExtendedLimitInformation>(), out returned), "actual Job flags");
     Require(returned == Marshal.SizeOf<ExtendedLimitInformation>(), "Job flag byte length");
     var actual = Marshal.PtrToStructure<ExtendedLimitInformation>(buffer);
     Require(actual.BasicLimitInformation.LimitFlags == KillOnClose && actual.BasicLimitInformation.ActiveProcessLimit == 0, "no breakaway/UI/active-limit additions");
    } finally { Marshal.FreeHGlobal(buffer); }
   }
   private void Pipes() {
    var security = new SecurityAttributes { Length = (uint)Marshal.SizeOf<SecurityAttributes>(), InheritHandle = 1 };
    Win32(CreatePipe(out stdinRead.Value, out stdinWrite.Value, ref security, 65536), "raw stdin pipe");
    NonInheritable(stdinWrite.Value); stdinWrite.CloseChecked(); // Child stdin is EOF from birth.
    Win32(CreatePipe(out stdoutRead.Value, out stdoutWrite.Value, ref security, 65536), "raw stdout pipe");
    NonInheritable(stdoutRead.Value);
    Win32(CreatePipe(out stderrRead.Value, out stderrWrite.Value, ref security, 65536), "raw stderr pipe");
    NonInheritable(stderrRead.Value);
   }
   private void Create() {
    attributes.Prepare(job.Value, new[] { stdinRead.Value, stdoutWrite.Value, stderrWrite.Value });
    var startup = new StartupInfoEx();
    startup.StartupInfo.cb = (uint)Marshal.SizeOf<StartupInfoEx>(); startup.StartupInfo.dwFlags = StartfUseStdHandles;
    startup.StartupInfo.hStdInput = stdinRead.Value; startup.StartupInfo.hStdOutput = stdoutWrite.Value; startup.StartupInfo.hStdError = stderrWrite.Value; startup.lpAttributeList = attributes.List;
    byte[] env = FixedEnvironment(); environment = Marshal.AllocHGlobal(env.Length); Marshal.Copy(env, 0, environment, env.Length);
    string command = "\"" + PowerShellPath + "\" -NoProfile -NonInteractive -File \"" + Path.Combine(Base, "root-dispatch.ps1") + "\"";
    Clock(); Require(Remaining(true) > 0, "original work budget before native create");
    bool created = CreateProcessW(PowerShellPath, new StringBuilder(command), IntPtr.Zero, IntPtr.Zero, true,
     CreateSuspended | ExtendedStartupInfoPresent | CreateUnicodeEnvironment | CreateNoWindow, environment, Base, ref startup, out pi);
    int createError = created ? 0 : Marshal.GetLastWin32Error();
    process.Value = pi.hProcess; thread.Value = pi.hThread; result.Created = pi.hProcess != IntPtr.Zero;
    if (!created) throw new Win32Exception(createError, "fixed atomically Job-assigned suspended Dispatcher");
    Require(result.Created && pi.hThread != IntPtr.Zero, "actual raw Process and Thread ownership");
    NonInheritable(process.Value); NonInheritable(thread.Value);
    stdinRead.CloseChecked(); stdoutWrite.CloseChecked(); stderrWrite.CloseChecked(); // No parent-side child copies survive Resume.
    output = new PipeReader(stdoutRead); errorOutput = new PipeReader(stderrRead); // Any wrapping exception remains raw-owned in Job.
    Require(GetProcessId(process.Value) == pi.dwProcessId && ParentPid(process.Value) == (uint)Environment.ProcessId, "actual retained Dispatcher PID/parent");
    result.DispatcherPid = pi.dwProcessId; result.DispatcherCreation = CreationTime(process.Value);
    result.DispatcherImage = ImagePath(process.Value);
    Require(result.DispatcherCreation > 0 && String.Equals(result.DispatcherImage, PowerShellPath, StringComparison.OrdinalIgnoreCase), "actual creation/image");
    bool member; Win32(IsProcessInJob(process.Value, job.Value, out member), "actual atomic membership"); Require(member, "Dispatcher in held outer Job before payload");
    Clock(); Require(Remaining(true) > 0, "original work budget immediately before Resume");
    Require(ResumeThread(thread.Value) == 1, "exactly one suspended Resume"); result.Resumed = true;
    thread.CloseChecked();
   }
   private bool JobZero() {
    BasicAccountingInformation accounting; uint returned;
    Win32(QueryInformationJobObject(job.Value, AccountingClass, out accounting, (uint)Marshal.SizeOf<BasicAccountingInformation>(), out returned), "actual Job accounting");
    Require(returned == Marshal.SizeOf<BasicAccountingInformation>(), "accounting byte length");
    const int capacity = 4096; int size = 8 + capacity * IntPtr.Size;
    IntPtr buffer = Marshal.AllocHGlobal(size);
    try {
     Win32(QueryInformationJobObject(job.Value, MemberListClass, buffer, (uint)size, out returned), "actual Job member list");
     Require(returned >= 8, "member header length");
     uint assigned = unchecked((uint)Marshal.ReadInt32(buffer)), count = unchecked((uint)Marshal.ReadInt32(buffer, 4));
     Require(count <= capacity && returned >= 8 + count * IntPtr.Size, "bounded member list body");
     return accounting.ActiveProcesses == 0 && assigned == 0 && count == 0;
    } finally { Marshal.FreeHGlobal(buffer); }
   }
   private bool Terminal() {
    if (process.Value == IntPtr.Zero) return false;
    uint wait = WaitForSingleObject(process.Value, 0);
    if (wait == WaitObject0) return true;
    Require(wait == WaitTimeout, "valid owned Dispatcher wait"); return false;
   }
   private void Pump() { output.Pump(); errorOutput.Pump(); } // Failure escapes directly to immediate AbortJob.
   private void CloseAll() {
    Capture(() => { if (output != null) output.CloseChecked(); });
    Capture(() => { if (errorOutput != null) errorOutput.CloseChecked(); });
    Capture(() => stdinRead.CloseChecked()); Capture(() => stdinWrite.CloseChecked());
    Capture(() => stdoutRead.CloseChecked()); Capture(() => stdoutWrite.CloseChecked());
    Capture(() => stderrRead.CloseChecked()); Capture(() => stderrWrite.CloseChecked());
    Capture(() => thread.CloseChecked()); Capture(() => process.CloseChecked());
    Capture(() => attributes.CloseChecked());
    Capture(() => { if (environment != IntPtr.Zero) { Marshal.FreeHGlobal(environment); environment = IntPtr.Zero; } });
    Capture(() => job.CloseChecked());
    result.HandlesClosed = job.Closed && process.Closed && thread.Closed && stdinRead.Closed && stdinWrite.Closed &&
     stdoutRead.Closed && stdoutWrite.Closed && stderrRead.Closed && stderrWrite.Closed &&
     (output == null || output.Closed) && (errorOutput == null || errorOutput.Closed) &&
     attributes.List == IntPtr.Zero && attributes.Jobs == IntPtr.Zero && attributes.Handles == IntPtr.Zero && environment == IntPtr.Zero;
   }
   public LaunchResult Execute() {
    try {
     Clock(); Require(HashFile(PowerShellPath) == PowerShellSha256 && dispatcherHash != null && dispatcherHash.Length == 64 &&
      HashFile(Path.Combine(Base, "root-dispatch.ps1")) == dispatcherHash, "fixed command/profile byte pins");
     ConfigureJob(); Pipes(); Create();
     while (Remaining(true) > 0) { Clock(); Pump(); if (Terminal()) { result.Terminal = true; break; } System.Threading.Thread.Sleep(1); }
     Require(result.Terminal, "Dispatcher work cutoff");
     Win32(GetExitCodeProcess(process.Value, out result.ExitCode), "actual Dispatcher exit");
     Require(result.ExitCode == 0, "nonzero Dispatcher exit");
     result.JobZero = JobZero(); Require(result.JobZero, "exit0 with remaining outer Job members");
     while (Remaining(false) > 0 && (!output.Eof || !errorOutput.Eof)) { Pump(); System.Threading.Thread.Sleep(1); }
     Require(output.Eof && errorOutput.Eof && !output.PartialFrame && !errorOutput.PartialFrame, "actual EOF and complete frames");
     Clock();
    } catch (Exception primary) {
     errors.Add(primary);
     Capture(() => AbortJob()); // First failure cleanup action: no further work drain.
    } finally {
     // Raw creation information remains available even if ownership wrapping failed.
     if (process.Value == IntPtr.Zero && pi.hProcess != IntPtr.Zero) process.Value = pi.hProcess;
     if (thread.Value == IntPtr.Zero && pi.hThread != IntPtr.Zero && !result.Resumed) thread.Value = pi.hThread;
     if (errors.Count > 0) Capture(() => AbortJob());
     if (job.Value != IntPtr.Zero) {
      bool queryFailed = false;
      while (Remaining(false) > 0 && !result.JobZero) {
       try { result.JobZero = JobZero(); } catch (Exception e) { if (!queryFailed) errors.Add(e); queryFailed = true; }
       if (!result.JobZero) System.Threading.Thread.Sleep(1);
      }
      if (!result.JobZero) errors.Add(new InvalidOperationException("outer JobZero unproven"));
     }
     if (process.Value != IntPtr.Zero) Capture(() => {
      while (Remaining(false) > 0 && !result.Terminal) { result.Terminal = Terminal(); if (!result.Terminal) System.Threading.Thread.Sleep(1); }
      Require(result.Terminal, "actual terminal before original hard end");
     });
     bool outBroken = false, errBroken = false;
     while (Remaining(false) > 0 && ((output != null && !output.Eof && !outBroken) || (errorOutput != null && !errorOutput.Eof && !errBroken))) {
      if (output != null && !output.Eof && !outBroken) try { output.Pump(); } catch (Exception e) { errors.Add(e); outBroken = true; Capture(() => AbortJob()); }
      if (errorOutput != null && !errorOutput.Eof && !errBroken) try { errorOutput.Pump(); } catch (Exception e) { errors.Add(e); errBroken = true; Capture(() => AbortJob()); }
      if (Remaining(false) > 0) System.Threading.Thread.Sleep(1);
     }
     result.StdoutEof = output != null && output.Eof; result.StderrEof = errorOutput != null && errorOutput.Eof;
     result.PartialFrame = (output != null && output.PartialFrame) || (errorOutput != null && errorOutput.PartialFrame);
     result.Stdout = output == null ? "" : output.Text; result.Stderr = errorOutput == null ? "" : errorOutput.Text;
     CloseAll();
    }
    result.ElapsedMilliseconds = originalWatch.ElapsedMilliseconds;
    result.Success = errors.Count == 0 && result.Created && result.Resumed && result.Terminal && result.ExitCode == 0 &&
     result.StdoutEof && result.StderrEof && !result.PartialFrame && result.JobZero && result.HandlesClosed && Remaining(false) > 0;
    result.Failure = errors.Count == 0 ? null : new AggregateException(errors).ToString();
    return result;
   }
  }
  public static LaunchResult RunDispatcher(long issued, long workEnd, long overallEnd, long utcIssued, long utcEnd, Stopwatch originalWatch, string dispatcherSourceSha256) {
   return new Run(issued, workEnd, overallEnd, utcIssued, utcEnd, originalWatch, dispatcherSourceSha256).Execute();
  }
  private static void NonInheritable(IntPtr h) { Win32(SetHandleInformation(h, HandleInherit, 0), "clear inherit"); uint f; Win32(GetHandleInformation(h, out f), "read inherit"); Require((f & HandleInherit) == 0, "noninheritable owned handle"); }
  private static string HashFile(string p) { using (var s = new FileStream(p, FileMode.Open, FileAccess.Read, FileShare.Read)) using (var h = SHA256.Create()) return Convert.ToHexString(h.ComputeHash(s)).ToLowerInvariant(); }
  private static byte[] FixedEnvironment() {
   string block = @"HOMEDRIVE=C:" + "\0" + @"HOMEPATH=\Users\benni" + "\0" +
    @"PATH=C:\Windows\System32;C:\Windows;C:\IFI_SourceCode\Utils\PowerShell" + "\0" + @"SystemDrive=C:" + "\0" +
    @"SystemRoot=C:\Windows" + "\0" + @"TEMP=C:\Users\benni\AppData\Local\Temp" + "\0" +
    @"TMP=C:\Users\benni\AppData\Local\Temp" + "\0" + @"USERPROFILE=C:\Users\benni" + "\0" + @"WINDIR=C:\Windows" + "\0\0";
   return Encoding.Unicode.GetBytes(block);
  }
  private static long CreationTime(IntPtr p) { FileTime c,e,k,u; Win32(GetProcessTimes(p,out c,out e,out k,out u),"actual creation"); return unchecked((long)(((ulong)c.High<<32)|c.Low)); }
  private static string ImagePath(IntPtr p) { var b=new StringBuilder(32768);uint n=(uint)b.Capacity;Win32(QueryFullProcessImageNameW(p,0,b,ref n),"actual image");return Path.GetFullPath(b.ToString()); }
  private static uint ParentPid(IntPtr p) { ProcessBasicInformation i;int n;Require(NtQueryInformationProcess(p,0,out i,Marshal.SizeOf<ProcessBasicInformation>(),out n)==0&&n==Marshal.SizeOf<ProcessBasicInformation>(),"actual parent query");return checked((uint)i.InheritedFromUniqueProcessId.ToUInt64()); }
  [StructLayout(LayoutKind.Sequential)] private struct SecurityAttributes { public uint Length;public IntPtr SecurityDescriptor;public int InheritHandle; }
  [StructLayout(LayoutKind.Sequential)] private struct StartupInfo { public uint cb;public string lpReserved,lpDesktop,lpTitle;public uint dwX,dwY,dwXSize,dwYSize,dwXCountChars,dwYCountChars,dwFillAttribute,dwFlags;public ushort wShowWindow,cbReserved2;public IntPtr lpReserved2,hStdInput,hStdOutput,hStdError; }
  [StructLayout(LayoutKind.Sequential)] private struct StartupInfoEx { public StartupInfo StartupInfo;public IntPtr lpAttributeList; }
  [StructLayout(LayoutKind.Sequential)] private struct ProcessInformation { public IntPtr hProcess,hThread;public uint dwProcessId,dwThreadId; }
  [StructLayout(LayoutKind.Sequential)] private struct BasicLimitInformation { public long PerProcessUserTimeLimit,PerJobUserTimeLimit;public uint LimitFlags;public UIntPtr MinimumWorkingSetSize,MaximumWorkingSetSize;public uint ActiveProcessLimit;public UIntPtr Affinity;public uint PriorityClass,SchedulingClass; }
  [StructLayout(LayoutKind.Sequential)] private struct IoCounters { public ulong ReadOperationCount,WriteOperationCount,OtherOperationCount,ReadTransferCount,WriteTransferCount,OtherTransferCount; }
  [StructLayout(LayoutKind.Sequential)] private struct ExtendedLimitInformation { public BasicLimitInformation BasicLimitInformation;public IoCounters IoInfo;public UIntPtr ProcessMemoryLimit,JobMemoryLimit,PeakProcessMemoryUsed,PeakJobMemoryUsed; }
  [StructLayout(LayoutKind.Sequential)] private struct BasicAccountingInformation { public long TotalUserTime,TotalKernelTime,ThisPeriodTotalUserTime,ThisPeriodTotalKernelTime;public uint TotalPageFaultCount,TotalProcesses,ActiveProcesses,TotalTerminatedProcesses; }
  [StructLayout(LayoutKind.Sequential)] private struct FileTime { public uint Low,High; }
  [StructLayout(LayoutKind.Sequential)] private struct ProcessBasicInformation { public int ExitStatus;public IntPtr PebBaseAddress;public UIntPtr AffinityMask;public int BasePriority;public UIntPtr UniqueProcessId,InheritedFromUniqueProcessId; }
  [DllImport("kernel32.dll",SetLastError=true,CharSet=CharSet.Unicode)] private static extern IntPtr CreateJobObjectW(IntPtr a,string n);
  [DllImport("kernel32.dll",SetLastError=true)] private static extern bool SetInformationJobObject(IntPtr j,uint c,ref ExtendedLimitInformation i,uint n);
  [DllImport("kernel32.dll",SetLastError=true)] private static extern bool QueryInformationJobObject(IntPtr j,uint c,IntPtr i,uint n,out uint r);
  [DllImport("kernel32.dll",SetLastError=true)] private static extern bool QueryInformationJobObject(IntPtr j,uint c,out BasicAccountingInformation i,uint n,out uint r);
  [DllImport("kernel32.dll",SetLastError=true)] private static extern bool TerminateJobObject(IntPtr j,uint e);
  [DllImport("kernel32.dll",SetLastError=true)] private static extern bool IsProcessInJob(IntPtr p,IntPtr j,out bool m);
  [DllImport("kernel32.dll",SetLastError=true)] private static extern uint ResumeThread(IntPtr t);
  [DllImport("kernel32.dll",SetLastError=true)] private static extern uint WaitForSingleObject(IntPtr h,uint m);
  [DllImport("kernel32.dll",SetLastError=true)] private static extern bool GetExitCodeProcess(IntPtr p,out uint e);
  [DllImport("kernel32.dll",SetLastError=true)] private static extern bool CloseHandle(IntPtr h);
  [DllImport("kernel32.dll",SetLastError=true)] private static extern bool SetHandleInformation(IntPtr h,uint m,uint f);
  [DllImport("kernel32.dll",SetLastError=true)] private static extern bool GetHandleInformation(IntPtr h,out uint f);
  [DllImport("kernel32.dll",SetLastError=true)] private static extern bool CreatePipe(out IntPtr r,out IntPtr w,ref SecurityAttributes a,uint n);
  [DllImport("kernel32.dll",SetLastError=true)] private static extern bool PeekNamedPipe(IntPtr p,IntPtr b,uint n,IntPtr r,out uint a,IntPtr l);
  [DllImport("kernel32.dll",SetLastError=true)] private static extern bool ReadFile(IntPtr p,byte[] b,uint n,out uint r,IntPtr o);
  [DllImport("kernel32.dll",SetLastError=true)] private static extern uint GetProcessId(IntPtr p);
  [DllImport("kernel32.dll",SetLastError=true)] private static extern bool GetProcessTimes(IntPtr p,out FileTime c,out FileTime e,out FileTime k,out FileTime u);
  [DllImport("kernel32.dll",SetLastError=true,CharSet=CharSet.Unicode)] private static extern bool QueryFullProcessImageNameW(IntPtr p,uint f,StringBuilder b,ref uint n);
  [DllImport("kernel32.dll",SetLastError=true)] private static extern bool InitializeProcThreadAttributeList(IntPtr l,int c,uint f,ref IntPtr n);
  [DllImport("kernel32.dll",SetLastError=true)] private static extern bool UpdateProcThreadAttribute(IntPtr l,uint f,UIntPtr a,IntPtr v,UIntPtr n,IntPtr p,IntPtr r);
  [DllImport("kernel32.dll")] private static extern void DeleteProcThreadAttributeList(IntPtr l);
  [DllImport("kernel32.dll",SetLastError=true,CharSet=CharSet.Unicode)] private static extern bool CreateProcessW(string a,StringBuilder c,IntPtr p,IntPtr t,bool inherit,uint flags,IntPtr env,string cwd,ref StartupInfoEx s,out ProcessInformation i);
  [DllImport("ntdll.dll")] private static extern int NtQueryInformationProcess(IntPtr p,int c,out ProcessBasicInformation i,int n,out int r);
 }
}
