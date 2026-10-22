using System;
using System.Collections;
using System.Collections.Generic;
using System.ComponentModel;
using System.Globalization;
using System.IO;
using System.Runtime.InteropServices;
using System.Security.Cryptography;
using System.Text;

namespace Hestia.M5.Native24Source
{
    internal sealed class OwnedHandle : IDisposable
    {
        private IntPtr value;
        private bool closeAttempted;
        public OwnedHandle(IntPtr handle) { if (handle == IntPtr.Zero || handle == new IntPtr(-1)) throw new InvalidOperationException("invalid owned handle"); value = handle; }
        public IntPtr Value { get { if (value == IntPtr.Zero) throw new ObjectDisposedException("OwnedHandle"); if (closeAttempted) throw new InvalidOperationException("uncertain previous close"); return value; } }
        public bool IsClosed { get { return value == IntPtr.Zero; } }
        public void CloseChecked() {
            if (value == IntPtr.Zero) return;
            if (closeAttempted) throw new InvalidOperationException("CloseHandle was already attempted with uncertain result");
            closeAttempted = true;
            if (!Native24Family.CloseHandle(value)) { int error = Marshal.GetLastWin32Error(); throw new Win32Exception(error, "CloseHandle failed"); }
            value = IntPtr.Zero;
        }
        public void Dispose() { CloseChecked(); }
    }

    public static partial class Native24Family
    {
        public static int SuperviseNative24()
        {
            throw new InvalidOperationException("SOURCE_ONLY_NATIVE24_NO_RUNTIME_GRANT");
        }

        private const string SourceRoot = @"C:\IFI_SourceCode\Temp\WeltraumSpiel\.worktrees\Hestia-A0-BenniPC-2026-10-13\.a0-runtime\benni-pc-native24-harmless-qualification-source-r03";
        private const string NodePath = @"C:\IFI_SourceCode\Temp\WeltraumSpiel\artifacts\hestia-other-pc-restored\Tooling\PortableNode\node.exe";
        private const string NodeSha256 = "0d0f5e39f9f3d9587bc19f73eab3c2c9c4903fd02d6dbf9c853dd81b3d95fad4";
        private const string QualificationRunsRoot = SourceRoot + @"\qualification-runs";
        private const ulong CleanupReserveMs = 12000;
        private const uint InvalidFileAttributes = 0xffffffff, FileAttributeReparsePoint = 0x400;
        private const uint HandleFlagInherit = 1, JobObjectExtendedLimitInformation = 9, JobObjectBasicAccountingInformation = 1, JobObjectBasicProcessIdList = 3;
        private const uint JobLimitActiveProcess = 8, JobLimitKillOnClose = 0x2000, CreateSuspended = 4, CreateUnicodeEnvironment = 0x400;
        private const uint ExtendedStartupInfoPresent = 0x80000, CreateNoWindow = 0x08000000, StartfUseStdHandles = 0x100;
        private const uint ProcThreadAttributeHandleList = 0x00020002, ProcThreadAttributeJobList = 0x0002000D, ErrorInsufficientBuffer = 122;
        private const uint WaitObject0 = 0, WaitTimeout = 0x102, WaitFailed = 0xffffffff, ExpectedJobExitCode = 0xE71A;
        private const uint ProcessQueryLimitedInformation = 0x1000, Synchronize = 0x00100000;
        private sealed class BoundProcess
        {
            public OwnedHandle Process, Thread;
            public uint Pid, ParentPid;
            public long CreatedFileTime;
            public bool InOwnedJob;
            public void CloseChecked() {
                Exception failure = null;
                if (Thread != null) try { Thread.CloseChecked(); } catch (Exception e) { CaptureCleanupFailure(ref failure, e); }
                if (Process != null) try { Process.CloseChecked(); } catch (Exception e) { CaptureCleanupFailure(ref failure, e); }
                if (failure != null) throw failure;
            }
        }
        // No instance exists and no public route constructs this unissued private binding.
        private sealed class BoundRun
        {
            public readonly string BatchToken, NativeOrigin, NodeOrigin, PinsSha256;
            public readonly QualificationScenario Scenario;
            public readonly string OutputRoot;
            public readonly ulong Issued, WorkDeadline, OverallEnd;
            public readonly long IssuedUtcMs, OverallUtcMs;
            public BoundRun(string batchToken, string nativeOrigin, string nodeOrigin, string pinsSha256,
                ulong issued, ulong workDeadline, ulong overallEnd, long issuedUtcMs, long overallUtcMs, QualificationScenario scenario) {
                BatchToken = batchToken; NativeOrigin = nativeOrigin; NodeOrigin = nodeOrigin; PinsSha256 = pinsSha256;
                Issued = issued; WorkDeadline = workDeadline; OverallEnd = overallEnd; IssuedUtcMs = issuedUtcMs; OverallUtcMs = overallUtcMs;
                Scenario = scenario; OutputRoot = QualificationOutputRoot(batchToken, scenario);
            }
        }

        [StructLayout(LayoutKind.Sequential)]
        public struct BasicLimitInformation
        {
            public long PerProcessUserTimeLimit;
            public long PerJobUserTimeLimit;
            public uint LimitFlags;
            public UIntPtr MinimumWorkingSetSize;
            public UIntPtr MaximumWorkingSetSize;
            public uint ActiveProcessLimit;
            public UIntPtr Affinity;
            public uint PriorityClass;
            public uint SchedulingClass;
        }

        [StructLayout(LayoutKind.Sequential)]
        public struct IoCounters
        {
            public ulong ReadOperationCount;
            public ulong WriteOperationCount;
            public ulong OtherOperationCount;
            public ulong ReadTransferCount;
            public ulong WriteTransferCount;
            public ulong OtherTransferCount;
        }

        [StructLayout(LayoutKind.Sequential)]
        public struct ExtendedLimitInformation
        {
            public BasicLimitInformation BasicLimitInformation;
            public IoCounters IoInfo;
            public UIntPtr ProcessMemoryLimit;
            public UIntPtr JobMemoryLimit;
            public UIntPtr PeakProcessMemoryUsed;
            public UIntPtr PeakJobMemoryUsed;
        }

        [StructLayout(LayoutKind.Sequential)]
        public struct BasicAccountingInformation
        {
            public long TotalUserTime;
            public long TotalKernelTime;
            public long ThisPeriodTotalUserTime;
            public long ThisPeriodTotalKernelTime;
            public uint TotalPageFaultCount;
            public uint TotalProcesses;
            public uint ActiveProcesses;
            public uint TotalTerminatedProcesses;
        }

        [StructLayout(LayoutKind.Sequential)]
        public struct SecurityAttributes
        {
            public uint Length;
            public IntPtr SecurityDescriptor;
            public int InheritHandle;
        }

        [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
        public struct StartupInfo
        {
            public uint cb;
            public string lpReserved;
            public string lpDesktop;
            public string lpTitle;
            public uint dwX;
            public uint dwY;
            public uint dwXSize;
            public uint dwYSize;
            public uint dwXCountChars;
            public uint dwYCountChars;
            public uint dwFillAttribute;
            public uint dwFlags;
            public ushort wShowWindow;
            public ushort cbReserved2;
            public IntPtr lpReserved2;
            public IntPtr hStdInput;
            public IntPtr hStdOutput;
            public IntPtr hStdError;
        }

        [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
        public struct StartupInfoEx
        {
            public StartupInfo StartupInfo;
            public IntPtr lpAttributeList;
        }

        [StructLayout(LayoutKind.Sequential)]
        public struct ProcessInformation
        {
            public IntPtr hProcess;
            public IntPtr hThread;
            public uint dwProcessId;
            public uint dwThreadId;
        }

        [StructLayout(LayoutKind.Sequential)]
        public struct ProcessBasicInformation
        {
            public int ExitStatus;
            public IntPtr PebBaseAddress;
            public UIntPtr AffinityMask;
            public int BasePriority;
            public UIntPtr UniqueProcessId;
            public UIntPtr InheritedFromUniqueProcessId;
        }


        private sealed class ProcAttributes : IDisposable
        {
            private IntPtr list;
            private readonly List<IntPtr> values = new List<IntPtr>();

            public IntPtr List { get { return list; } }

            public ProcAttributes(int count)
            {
                IntPtr required = IntPtr.Zero;
                bool first = InitializeProcThreadAttributeList(IntPtr.Zero, count, 0, ref required);
                int error = first ? 0 : Marshal.GetLastWin32Error();
                Require(!first && error == ErrorInsufficientBuffer && required.ToInt64() > 0, "InitializeProcThreadAttributeList size probe failed");
                list = Marshal.AllocHGlobal(required);
                bool initialized = false;
                try
                {
                    IntPtr actual = required;
                    Win32(InitializeProcThreadAttributeList(list, count, 0, ref actual), "InitializeProcThreadAttributeList");
                    initialized = true;
                    Require(actual == required, "attribute-list size changed during initialization");
                }
                catch
                {
                    if (initialized) DeleteProcThreadAttributeList(list);
                    Marshal.FreeHGlobal(list);
                    list = IntPtr.Zero;
                    throw;
                }
            }

            private IntPtr Retain(byte[] bytes)
            {
                IntPtr value = Marshal.AllocHGlobal(bytes.Length);
                Marshal.Copy(bytes, 0, value, bytes.Length);
                values.Add(value);
                return value;
            }

            public void AddHandles(IntPtr[] handles)
            {
                IntPtr buffer = Marshal.AllocHGlobal(handles.Length * IntPtr.Size);
                values.Add(buffer);
                for (int i = 0; i < handles.Length; i++) Marshal.WriteIntPtr(buffer, i * IntPtr.Size, handles[i]);
                Win32(UpdateProcThreadAttribute(list, 0, new UIntPtr(ProcThreadAttributeHandleList), buffer, new UIntPtr((uint)(handles.Length * IntPtr.Size)), IntPtr.Zero, IntPtr.Zero), "UpdateProcThreadAttribute(HANDLE_LIST)");
            }

            public void AddJob(IntPtr job)
            {
                byte[] bytes = new byte[IntPtr.Size];
                byte[] raw = BitConverter.GetBytes(job.ToInt64());
                Buffer.BlockCopy(raw, 0, bytes, 0, IntPtr.Size);
                IntPtr value = Retain(bytes);
                Win32(UpdateProcThreadAttribute(list, 0, new UIntPtr(ProcThreadAttributeJobList), value, new UIntPtr((uint)IntPtr.Size), IntPtr.Zero, IntPtr.Zero), "UpdateProcThreadAttribute(JOB_LIST)");
            }

            public void Dispose()
            {
                if (list == IntPtr.Zero) return;
                DeleteProcThreadAttributeList(list);
                for (int i = values.Count - 1; i >= 0; i--) Marshal.FreeHGlobal(values[i]);
                values.Clear();
                Marshal.FreeHGlobal(list);
                list = IntPtr.Zero;
            }
        }

        [StructLayout(LayoutKind.Sequential)]
        private struct FileTime
        {
            public uint Low;
            public uint High;
        }

        [DllImport("kernel32.dll", SetLastError = true, CharSet = CharSet.Unicode)]
        private static extern IntPtr CreateJobObjectW(IntPtr jobAttributes, string name);
        [DllImport("kernel32.dll", SetLastError = true)]
        private static extern bool SetInformationJobObject(IntPtr job, uint infoClass, ref ExtendedLimitInformation info, uint length);
        [DllImport("kernel32.dll", SetLastError = true)]
        private static extern bool QueryInformationJobObject(IntPtr job, uint infoClass, IntPtr info, uint length, out uint returnLength);
        [DllImport("kernel32.dll", SetLastError = true)]
        private static extern bool QueryInformationJobObject(IntPtr job, uint infoClass, out BasicAccountingInformation info, uint length, out uint returnLength);

        [DllImport("kernel32.dll", SetLastError = true)]
        private static extern bool IsProcessInJob(IntPtr process, IntPtr job, out bool result);
        [DllImport("kernel32.dll", SetLastError = true)]
        private static extern bool TerminateJobObject(IntPtr job, uint exitCode);

        [DllImport("kernel32.dll", SetLastError = true)]
        private static extern uint ResumeThread(IntPtr thread);
        [DllImport("kernel32.dll", SetLastError = true)]
        private static extern uint WaitForSingleObject(IntPtr handle, uint milliseconds);
        [DllImport("kernel32.dll", SetLastError = true)]
        private static extern bool GetExitCodeProcess(IntPtr process, out uint exitCode);
        [DllImport("kernel32.dll", SetLastError = true)]
        internal static extern bool CloseHandle(IntPtr handle);
        [DllImport("kernel32.dll", SetLastError = true)]
        private static extern bool SetHandleInformation(IntPtr handle, uint mask, uint flags);
        [DllImport("kernel32.dll", SetLastError = true)]
        private static extern bool GetHandleInformation(IntPtr handle, out uint flags);

        [DllImport("kernel32.dll", SetLastError = true)]
        private static extern uint GetProcessId(IntPtr process);
        [DllImport("kernel32.dll", SetLastError = true)]
        private static extern bool GetProcessTimes(IntPtr process, out FileTime creation, out FileTime exit, out FileTime kernel, out FileTime user);
        [DllImport("kernel32.dll", SetLastError = true, CharSet = CharSet.Unicode)]
        private static extern bool QueryFullProcessImageNameW(IntPtr process, uint flags, StringBuilder image, ref uint size);
        [DllImport("kernel32.dll", SetLastError = true)]
        private static extern bool IsWow64Process2(IntPtr process, out ushort processMachine, out ushort nativeMachine);
        [DllImport("kernel32.dll", SetLastError = true)]
        private static extern bool InitializeProcThreadAttributeList(IntPtr list, int count, uint flags, ref IntPtr size);
        [DllImport("kernel32.dll", SetLastError = true)]
        private static extern bool UpdateProcThreadAttribute(IntPtr list, uint flags, UIntPtr attribute, IntPtr value, UIntPtr size, IntPtr previous, IntPtr returnSize);
        [DllImport("kernel32.dll")]
        private static extern void DeleteProcThreadAttributeList(IntPtr list);

        [DllImport("kernel32.dll", SetLastError = true, CharSet = CharSet.Unicode)]
        private static extern IntPtr CreateFileW(string name, uint access, uint shareMode, IntPtr security, uint creationDisposition, uint flags, IntPtr template);

        [DllImport("kernel32.dll", SetLastError = true, CharSet = CharSet.Unicode)]
        private static extern uint GetFileAttributesW(string path);

        [DllImport("kernel32.dll", SetLastError = true)]
        private static extern ulong GetTickCount64();
        [DllImport("ntdll.dll")]
        private static extern int NtQueryInformationProcess(IntPtr process, int infoClass, out ProcessBasicInformation info, int length, out int returnLength);
        [DllImport("kernel32.dll", SetLastError = true, CharSet = CharSet.Unicode)]
        private static extern bool CreateProcessW(string application, StringBuilder commandLine, IntPtr processAttributes, IntPtr threadAttributes, bool inheritHandles, uint creationFlags, IntPtr environment, string currentDirectory, ref StartupInfoEx startupInfo, out ProcessInformation processInformation);

        internal static void Win32(bool success, string api)
        {
            if (!success)
            {
                int error = Marshal.GetLastWin32Error();
                throw new Win32Exception(error, api + " failed");
            }
        }

        private static void CloseRawChecked(IntPtr handle, string api)
        {
            if (handle == IntPtr.Zero) return;
            if (!CloseHandle(handle))
            {
                int error = Marshal.GetLastWin32Error();
                throw new Win32Exception(error, api + " failed");
            }
        }

        private static void CaptureCleanupFailure(ref Exception first, Exception next)
        {
            if (next == null) return;
            first = first == null ? next : new AggregateException(first, next);
        }

        private static void CloseRawOnce(ref IntPtr handle, string api, ref Exception failure)
        {
            if (handle == IntPtr.Zero) return;
            IntPtr closing = handle;
            handle = IntPtr.Zero;
            try { CloseRawChecked(closing, api); }
            catch (Exception e) { CaptureCleanupFailure(ref failure, e); }
        }

        private static void Require(bool condition, string reason)
        {
            if (!condition) throw new InvalidOperationException(reason);
        }

        private static string Full(string path) { return Path.GetFullPath(path).TrimEnd(Path.DirectorySeparatorChar, Path.AltDirectorySeparatorChar); }

        private static void EnsureNoReparse(string path, string requiredRoot)
        {
            string full = Full(path);
            string root = Full(requiredRoot);
            Require(full.Equals(root, StringComparison.OrdinalIgnoreCase) || full.StartsWith(root + Path.DirectorySeparatorChar, StringComparison.OrdinalIgnoreCase), "path escaped the fixed source root");
            string volume = Path.GetPathRoot(full);
            Require(!String.IsNullOrEmpty(volume), "absolute path required");
            string current = volume;
            string remainder = full.Substring(volume.Length);
            string[] parts = remainder.Split(new char[] { Path.DirectorySeparatorChar, Path.AltDirectorySeparatorChar }, StringSplitOptions.RemoveEmptyEntries);
            for (int i = 0; i < parts.Length; i++)
            {
                current = Path.Combine(current, parts[i]);
                uint attributes = GetFileAttributesW(current);
                if (attributes == InvalidFileAttributes)
                {
                    int error = Marshal.GetLastWin32Error();
                    throw new Win32Exception(error, "GetFileAttributesW failed for a required path component");
                }
                Require((attributes & FileAttributeReparsePoint) == 0, "reparse point in source or run ancestry");
            }
        }

        private static string HashFile(string path)
        {
            using (FileStream stream = new FileStream(path, FileMode.Open, FileAccess.Read, FileShare.Read))
            using (SHA256 sha = SHA256.Create())
            {
                byte[] hash = sha.ComputeHash(stream);
                StringBuilder text = new StringBuilder(hash.Length * 2);
                for (int i = 0; i < hash.Length; i++) text.Append(hash[i].ToString("x2", CultureInfo.InvariantCulture));
                return text.ToString();
            }
        }

        private static IntPtr GetCurrentProcess()
        {
            return new IntPtr(-1);
        }

        private static void VerifyArchitecture(IntPtr process)
        {
            ushort processMachine, nativeMachine;
            Win32(IsWow64Process2(process, out processMachine, out nativeMachine), "IsWow64Process2");
            Require(processMachine == 0 && nativeMachine == 0x8664, "native x64 Windows process required");
        }

        private static uint ProcessId(IntPtr process)
        {
            uint pid = GetProcessId(process);
            if (pid == 0)
            {
                int error = Marshal.GetLastWin32Error();
                throw new Win32Exception(error, "GetProcessId failed");
            }
            return pid;
        }

        private static long CreationTime(IntPtr process)
        {
            FileTime creation, exit, kernel, user;
            Win32(GetProcessTimes(process, out creation, out exit, out kernel, out user), "GetProcessTimes");
            return unchecked((long)(((ulong)creation.High << 32) | creation.Low));
        }

        private static string ImagePath(IntPtr process)
        {
            StringBuilder path = new StringBuilder(32768);
            uint size = (uint)path.Capacity;
            Win32(QueryFullProcessImageNameW(process, 0, path, ref size), "QueryFullProcessImageNameW");
            return Full(path.ToString());
        }

        private static uint ParentProcessId(IntPtr process)
        {
            ProcessBasicInformation info;
            int returned;
            int status = NtQueryInformationProcess(process, 0, out info, Marshal.SizeOf(typeof(ProcessBasicInformation)), out returned);
            Require(status == 0, "NtQueryInformationProcess(ProcessBasicInformation) failed: 0x" + status.ToString("x8", CultureInfo.InvariantCulture));
            Require(returned == Marshal.SizeOf(typeof(ProcessBasicInformation)), "PROCESS_BASIC_INFORMATION size mismatch");
            return unchecked((uint)info.InheritedFromUniqueProcessId.ToUInt64());
        }

        private static void VerifyNodeProcess(IntPtr process, uint expectedParent)
        {
            VerifyArchitecture(process);
            Require(String.Equals(ImagePath(process), Full(NodePath), StringComparison.OrdinalIgnoreCase), "fixture image path mismatch");
            Require(ParentProcessId(process) == expectedParent, "fixture parent process mismatch");
            Require(CreationTime(process) > 0, "fixture creation time invalid");
        }

        private static void SetNotInheritable(IntPtr handle)
        {
            Win32(SetHandleInformation(handle, HandleFlagInherit, 0), "SetHandleInformation(clear inherit)");
            uint flags;
            Win32(GetHandleInformation(handle, out flags), "GetHandleInformation");
            Require((flags & HandleFlagInherit) == 0, "unexpected inheritable handle");
        }

        private static OwnedHandle CreateConfiguredJob()
        {
            IntPtr raw = CreateJobObjectW(IntPtr.Zero, null);
            if (raw == IntPtr.Zero || raw == new IntPtr(-1))
            {
                int error = Marshal.GetLastWin32Error();
                throw new Win32Exception(error, "CreateJobObjectW(unnamed) failed");
            }
            OwnedHandle job = new OwnedHandle(raw);
            try
            {
                SetNotInheritable(job.Value);
                ExtendedLimitInformation limits = new ExtendedLimitInformation();
                limits.BasicLimitInformation.LimitFlags = JobLimitKillOnClose | JobLimitActiveProcess;
                limits.BasicLimitInformation.ActiveProcessLimit = 3;
                Win32(SetInformationJobObject(job.Value, JobObjectExtendedLimitInformation, ref limits, (uint)Marshal.SizeOf(typeof(ExtendedLimitInformation))), "SetInformationJobObject");
                ExtendedLimitInformation actual;
                uint returned;
                IntPtr buffer = Marshal.AllocHGlobal(Marshal.SizeOf(typeof(ExtendedLimitInformation)));
                try
                {
                    Win32(QueryInformationJobObject(job.Value, JobObjectExtendedLimitInformation, buffer, (uint)Marshal.SizeOf(typeof(ExtendedLimitInformation)), out returned), "QueryInformationJobObject(ExtendedLimitInformation)");
                    Require(returned == Marshal.SizeOf(typeof(ExtendedLimitInformation)), "job extended information size mismatch");
                    actual = (ExtendedLimitInformation)Marshal.PtrToStructure(buffer, typeof(ExtendedLimitInformation));
                }
                finally { Marshal.FreeHGlobal(buffer); }
                Require(actual.BasicLimitInformation.LimitFlags == (JobLimitKillOnClose | JobLimitActiveProcess), "job flags include breakaway or omit kill-on-close");
                Require(actual.BasicLimitInformation.ActiveProcessLimit == 3, "job active-process bound mismatch");
                return job;
            }
            catch { job.Dispose(); throw; }
        }

        private static BasicAccountingInformation QueryAccounting(IntPtr job)
        {
            BasicAccountingInformation info;
            uint returned;
            Win32(QueryInformationJobObject(job, JobObjectBasicAccountingInformation, out info, (uint)Marshal.SizeOf(typeof(BasicAccountingInformation)), out returned), "QueryInformationJobObject(BasicAccountingInformation)");
            Require(returned == Marshal.SizeOf(typeof(BasicAccountingInformation)), "job accounting size mismatch");
            return info;
        }

        private sealed class MembershipMismatchException : InvalidOperationException
        {
            public readonly uint Expected;
            public readonly uint Assigned;
            public readonly uint Count;
            public readonly uint[] Ids;
            public MembershipMismatchException(uint expected, uint assigned, uint count, uint[] ids, string message) : base(message)
            {
                Expected = expected; Assigned = assigned; Count = count; Ids = (uint[])ids.Clone();
            }
        }

        private static uint[] QueryMembers(IntPtr job, uint expected)
        {
            int size = 8 + 3 * IntPtr.Size;
            IntPtr buffer = Marshal.AllocHGlobal(size);
            try
            {
                for (int i = 0; i < size; i++) Marshal.WriteByte(buffer, i, 0);
                uint returned;
                Win32(QueryInformationJobObject(job, JobObjectBasicProcessIdList, buffer, (uint)size, out returned), "QueryInformationJobObject(BasicProcessIdList)");
                Require(returned >= 8, "job PID-list header truncated");
                uint assigned = unchecked((uint)Marshal.ReadInt32(buffer, 0));
                uint count = unchecked((uint)Marshal.ReadInt32(buffer, 4));
                Require(count <= 3, "job PID-list count exceeds its fixed buffer");
                Require(returned >= 8 + count * IntPtr.Size, "job PID-list body truncated");
                uint[] ids = new uint[(int)count];
                for (int i = 0; i < count; i++) ids[i] = unchecked((uint)Marshal.ReadInt64(buffer, 8 + i * IntPtr.Size));
                if (assigned != expected || count != expected) throw new MembershipMismatchException(expected, assigned, count, ids, "exact job member count mismatch: expected=" + expected.ToString(CultureInfo.InvariantCulture) +
                    ",assigned=" + assigned.ToString(CultureInfo.InvariantCulture) + ",count=" + count.ToString(CultureInfo.InvariantCulture) +
                    ",pids=[" + String.Join(",", ids) + "],accountingActiveProcesses=" + QueryAccounting(job).ActiveProcesses.ToString(CultureInfo.InvariantCulture) +
                    ",monotonicTick=" + GetTickCount64().ToString(CultureInfo.InvariantCulture));
                return ids;
            }
            finally { Marshal.FreeHGlobal(buffer); }
        }

        private static void VerifyMemberSet(IntPtr job, IList<BoundProcess> processes)
        {
            uint[] ids = QueryMembers(job, (uint)processes.Count);
            for (int i = 0; i < processes.Count; i++)
            {
                bool found = false;
                for (int j = 0; j < ids.Length; j++) if (ids[j] == processes[i].Pid) found = true;
                if (!found) throw new MembershipMismatchException((uint)processes.Count, (uint)ids.Length, (uint)ids.Length, ids, "owned job contains an unexpected or missing process id");
            }
            BasicAccountingInformation accounting = QueryAccounting(job);
            Require(accounting.ActiveProcesses == processes.Count, "job active process count mismatch");
        }

        private static byte[] EnvironmentBlock(bool node)
        {
            IDictionary current = Environment.GetEnvironmentVariables();
            string[] allow = node
                ? new string[] { "SystemRoot", "WINDIR", "SystemDrive", "PATH", "TEMP", "TMP" }
                : new string[] { "SystemRoot", "WINDIR", "SystemDrive", "PATH", "TEMP", "TMP", "USERPROFILE", "HOMEDRIVE", "HOMEPATH" };
            List<string> entries = new List<string>();
            for (int i = 0; i < allow.Length; i++)
            {
                object value = current[allow[i]];
                if (value != null) entries.Add(allow[i] + "=" + value.ToString());
            }
            entries.Sort(StringComparer.OrdinalIgnoreCase);
            string block = String.Join("\0", entries.ToArray()) + "\0\0";
            return Encoding.Unicode.GetBytes(block);
        }

        private static string Quote(string value)
        {
            if (value.IndexOf('"') >= 0) throw new InvalidOperationException("quote in fixed command argument");
            return "\"" + value + "\"";
        }

        private static void WaitExited(IntPtr process, ulong deadline)
        {
            while (GetTickCount64() < deadline)
            {
                ulong now = GetTickCount64();
                if (now >= deadline) break;
                uint state = WaitForSingleObject(process, (uint)Math.Min(50UL, deadline - now));
                if (state == WaitObject0) return;
                if (state == WaitFailed) { int error = Marshal.GetLastWin32Error(); throw new Win32Exception(error, "WaitForSingleObject(process exit) failed"); }
                Require(state == WaitTimeout, "unexpected process wait status");
            }
            throw new TimeoutException("owned process exit deadline expired");
        }

        [DllImport("kernel32.dll", SetLastError = true)]
        private static extern IntPtr OpenProcess(uint access, bool inherit, uint pid);

        private static void VerifyPins(BoundRun run)
        {
            string manifest = Path.Combine(SourceRoot, "QUAL_SOURCE_PINS.tsv");
            EnsureNoReparse(manifest, SourceRoot);
            Require(!String.IsNullOrEmpty(run.PinsSha256) && HashFile(manifest) == run.PinsSha256, "trusted fixed source manifest required");
            string[] rows = File.ReadAllLines(manifest, Encoding.UTF8);
            Require(rows.Length >= 1256, "original1250 plus fixed adapter pins required");
            int originals = 0;
            foreach (string row in rows) {
                string[] p = row.Split('\t');
                Require(p.Length == 4 && p[0].Length > 0 && p[3].Length == 64, "source pin shape");
                Require(p[1].StartsWith(@"C:\IFI_SourceCode\", StringComparison.OrdinalIgnoreCase), "non-CIFI pin");
                EnsureNoReparse(p[1], @"C:\IFI_SourceCode");
                long bytes = Int64.Parse(p[2], CultureInfo.InvariantCulture);
                Require(new FileInfo(p[1]).Length == bytes && HashFile(p[1]) == p[3], "source/tool/argv binding drift");
                if (p[0].StartsWith("ORIGINAL:", StringComparison.Ordinal)) originals++;
            }
            Require(originals == 1250 && HashFile(NodePath) == NodeSha256, "original roles or Node pin mismatch");
        }

        private static OwnedHandle OpenOutput(string path)
        {
            EnsureNoReparse(Path.GetDirectoryName(path), SourceRoot);
            IntPtr raw = CreateFileW(path, 0x40000000, 1, IntPtr.Zero, 1, 0x80, IntPtr.Zero);
            if (raw == IntPtr.Zero || raw == new IntPtr(-1)) { int error = Marshal.GetLastWin32Error(); throw new Win32Exception(error, "CreateFileW(exclusive root stream)"); }
            var result = new OwnedHandle(raw);
            try { SetNotInheritable(result.Value); return result; } catch { result.CloseChecked(); throw; }
        }

        private static BoundProcess CreateFixedRoot(BoundRun run, IntPtr job, OwnedHandle stdout, OwnedHandle stderr, ulong cleanupEnd, ref BoundProcess publishedRoot)
        {
            // Only these three stream handles are inherited; the unnamed Job is never shared.
            OwnedHandle stdin = null;
            ProcAttributes attributes = null;
            IntPtr environment = IntPtr.Zero;
            ProcessInformation pi = new ProcessInformation();
            BoundProcess root = null;
            bool created = false;
            Exception cleanupFailure = null;
            Exception originalFailure = null;
            try {
                IntPtr raw = CreateFileW("NUL", 0x80000000, 3, IntPtr.Zero, 3, 0x80, IntPtr.Zero);
                if (raw == IntPtr.Zero || raw == new IntPtr(-1)) { int e = Marshal.GetLastWin32Error(); throw new Win32Exception(e, "CreateFileW(NUL stdin) failed"); }
                stdin = new OwnedHandle(raw);
                Win32(SetHandleInformation(stdin.Value, HandleFlagInherit, HandleFlagInherit), "stdin inherit");
                Win32(SetHandleInformation(stdout.Value, HandleFlagInherit, HandleFlagInherit), "stdout inherit");
                Win32(SetHandleInformation(stderr.Value, HandleFlagInherit, HandleFlagInherit), "stderr inherit");
                attributes = new ProcAttributes(2);
                attributes.AddJob(job);
                attributes.AddHandles(new IntPtr[] { stdin.Value, stdout.Value, stderr.Value });
                StartupInfoEx startup = new StartupInfoEx();
                startup.StartupInfo.cb = (uint)Marshal.SizeOf(typeof(StartupInfoEx));
                startup.StartupInfo.dwFlags = StartfUseStdHandles;
                startup.StartupInfo.hStdInput = stdin.Value; startup.StartupInfo.hStdOutput = stdout.Value; startup.StartupInfo.hStdError = stderr.Value;
                startup.lpAttributeList = attributes.List;
                byte[] bytes = EnvironmentBlock(true);
                environment = Marshal.AllocHGlobal(bytes.Length); Marshal.Copy(bytes, 0, environment, bytes.Length);
                string command = Quote(NodePath) + " " + Quote(Path.Combine(SourceRoot, "harmless-fixture.mjs")) + " " + Quote(Path.Combine(run.OutputRoot, "case.request.json"));
                Win32(CreateProcessW(NodePath, new StringBuilder(command), IntPtr.Zero, IntPtr.Zero, true,
                    CreateSuspended | ExtendedStartupInfoPresent | CreateUnicodeEnvironment | CreateNoWindow,
                    environment, SourceRoot, ref startup, out pi), "CreateProcessW(fixed Native24 atomic Job root)");
                created = true;
                root = new BoundProcess();
                root.Process = new OwnedHandle(pi.hProcess); root.Thread = new OwnedHandle(pi.hThread); root.Pid = pi.dwProcessId;
                publishedRoot = root;
                SetNotInheritable(root.Process.Value); SetNotInheritable(root.Thread.Value);
                root.ParentPid = ProcessId(GetCurrentProcess()); VerifyNodeProcess(root.Process.Value, root.ParentPid);
                root.CreatedFileTime = CreationTime(root.Process.Value);
                bool member;
                Win32(IsProcessInJob(root.Process.Value, job, out member), "exact root Job membership before resume");
                Require(member, "root not atomically contained");
                root.InOwnedJob = true;
                VerifyMemberSet(job, new BoundProcess[] { root });
                return root;
            } catch (Exception primary) {
                originalFailure = primary;
                if (created) {
                    try {
                        Win32(TerminateJobObject(job, ExpectedJobExitCode), "failed root creation retirement");
                        WaitExited(pi.hProcess, cleanupEnd);
                        Require(QueryAccounting(job).ActiveProcesses == 0, "HOLD_UNCERTAIN_RETIREMENT");
                    } catch (Exception e) { CaptureCleanupFailure(ref cleanupFailure, e); }
                    if (cleanupFailure == null) {
                        if (root != null) root.CloseChecked();
                        else { CloseRawChecked(pi.hThread, "failed root thread"); CloseRawChecked(pi.hProcess, "failed root process"); }
                    }
                }
                if (cleanupFailure != null) throw new AggregateException("HOLD_UNCERTAIN_RETIREMENT: creator handles retained", primary, cleanupFailure);
                throw;
            } finally {
                if (attributes != null) attributes.Dispose();
                if (environment != IntPtr.Zero) Marshal.FreeHGlobal(environment);
                if (stdin != null) try { stdin.CloseChecked(); } catch (Exception e) { CaptureCleanupFailure(ref cleanupFailure, e); }
                try { SetNotInheritable(stdout.Value); SetNotInheritable(stderr.Value); } catch (Exception e) { CaptureCleanupFailure(ref cleanupFailure, e); }
                if (cleanupFailure != null) throw new AggregateException("HOLD_UNCERTAIN_RETIREMENT: creation resource cleanup", originalFailure ?? new InvalidOperationException("creation cleanup failed"), cleanupFailure);
            }
        }

        private static string ProtocolPath(BoundRun run, int ordinal, string kind) { return Path.Combine(run.OutputRoot, "bridge", ordinal.ToString(CultureInfo.InvariantCulture) + "." + kind + ".tsv"); }
        private static void Publish(string path, string value)
        {
            EnsureNoReparse(Path.GetDirectoryName(path), SourceRoot);
            byte[] bytes = Encoding.UTF8.GetBytes(value + "\n");
            Require(bytes.Length <= 4096, "bounded protocol message");
            string pending = path + ".pending";
            using (FileStream file = new FileStream(pending, FileMode.CreateNew, FileAccess.Write, FileShare.None, 4096, FileOptions.WriteThrough)) {
                file.Write(bytes, 0, bytes.Length); file.Flush(true);
            }
            File.Move(pending, path);
        }
        private static string[] ReadRequest(string path, string action, int ordinal, BoundRun run)
        {
            EnsureNoReparse(path, SourceRoot);
            using (FileStream file = new FileStream(path, FileMode.Open, FileAccess.Read, FileShare.Read | FileShare.Delete)) {
                Require(file.Length <= 4096, "bounded protocol input");
                using (StreamReader reader = new StreamReader(file, Encoding.UTF8)) {
                    string[] p = reader.ReadToEnd().TrimEnd('\n').Split('\t');
                    Require(p.Length == 16 && p[0] == "N24" && p[1] == action && p[2] == run.BatchToken
                        && p[3] == ordinal.ToString(CultureInfo.InvariantCulture) && p[4].Length == 36, "protocol token/order");
                    Guid.ParseExact(p[4], "D");
                    Require(p[5] == run.NodeOrigin && p[5].Length > 0, "independent Node origin absent/drift");
                    const long MaxSafe = 9007199254740991;
                    long Safe(long value) { Require(value >= -MaxSafe && value <= MaxSafe, "unsafe signed Clock intermediate"); return value; }
                    long Field(int index) {
                        long value;
                        Require(Int64.TryParse(p[index], NumberStyles.None, CultureInfo.InvariantCulture, out value)
                            && value >= 0 && value <= MaxSafe && p[index] == value.ToString(CultureInfo.InvariantCulture), "canonical safe Clock integer required");
                        return value;
                    }
                    long issued = Field(6), now = Field(7), work = Field(8), overall = Field(9);
                    long utcIssued = Field(10), utcNow = Field(11), issuedUpper = Field(14), nowUpper = Field(15);
                    checked {
                        long issueUtcHigh = Safe(utcIssued + 1), nowUtcHigh = Safe(utcNow + 1);
                        long issueLow = Safe(utcIssued - issuedUpper), issueHigh = Safe(issueUtcHigh - issued);
                        long nowLow = Safe(utcNow - nowUpper), nowHigh = Safe(nowUtcHigh - now);
                        Require(issued <= issuedUpper && now <= nowUpper && issued <= now && issuedUpper <= nowUpper
                            && utcIssued <= utcNow, "backward or inverted Clock endpoints");
                        Require(Math.Max(issueLow, nowLow) < Math.Min(issueHigh, nowHigh), "disjoint Clock offset intervals");
                        long utcEnd = Safe(run.OverallUtcMs), remainingUtc = Safe(utcEnd - issueUtcHigh);
                        long conservativeEnd = Safe(issued + remainingUtc);
                        Require(remainingUtc > 0 && work > nowUpper && Safe(work + 12000) <= overall
                            && overall <= conservativeEnd && Safe(overall - issued) <= 60000 && utcNow < utcEnd, "Node-local duration/reserve");
                        if (action == "LANE_START") Require(Safe(work - nowUpper) >= (long)RemainingQualificationWork(ordinal) && Safe(overall - nowUpper) >= (long)(RemainingQualificationWork(ordinal) + CleanupReserveMs), "Node upper-bound full start reserve");
                    }
                    Require(p[12] == "1" && p[13] == "1", "terminal/complete-stream evidence missing");
                    return p;
                }
            }
        }
        private static void CaptureOwnedDescendants(IntPtr job, BoundProcess root, List<BoundProcess> lane, BoundRun run)
        {
            var candidates = new List<BoundProcess>();
            Exception primary = null, cleanupFailure = null;
            try {
                uint count = QueryAccounting(job).ActiveProcesses;
                Require(count >= 1 && count <= 3, "UNQUALIFIED topology changed");
                uint[] ids = QueryMembers(job, count);
                foreach (uint id in ids) {
                    if (id == root.Pid || lane.Exists(p => p.Pid == id)) continue;
                    IntPtr raw = OpenProcess(0x0400 | ProcessQueryLimitedInformation | Synchronize, false, id);
                    if (raw == IntPtr.Zero) { int error = Marshal.GetLastWin32Error(); throw new Win32Exception(error, "OpenProcess(exact owned Job member) failed"); }
                    var process = new BoundProcess(); process.Process = new OwnedHandle(raw); process.Pid = id;
                    candidates.Add(process);
                    SetNotInheritable(process.Process.Value);
                    bool member; Win32(IsProcessInJob(process.Process.Value, job, out member), "owned descendant membership");
                    Require(member, "membership changed while capturing owned descendant");
                    process.InOwnedJob = true; process.ParentPid = ParentProcessId(process.Process.Value);
                    process.CreatedFileTime = CreationTime(process.Process.Value);
                    VerifyNodeProcess(process.Process.Value, process.ParentPid);
                    Require(process.CreatedFileTime >= root.CreatedFileTime, "descendant creation identity predates root");
                }
                var all = new List<BoundProcess>(lane); all.AddRange(candidates);
                QualificationCaptureProof(job, root, lane, candidates, run);
                Require(all.Count <= 2, "extra/replaced descendant is not a qualified topology");
                Require(all.FindAll(p => p.ParentPid == root.Pid).Count <= 1, "multiple DiagnosticChild roots violate the fixed topology");
                foreach (BoundProcess p in all) {
                    Require(p.InOwnedJob && CreationTime(p.Process.Value) == p.CreatedFileTime, "owned descendant identity drift");
                    Require(p.ParentPid == root.Pid || all.Exists(parent => parent.Pid == p.ParentPid && parent.ParentPid == root.Pid), "unknown owned topology");
                }
                lane.AddRange(candidates);
                candidates.Clear();
            } catch (Exception e) { primary = e; throw; }
            finally {
                foreach (BoundProcess candidate in candidates) try { candidate.CloseChecked(); } catch (Exception e) { CaptureCleanupFailure(ref cleanupFailure, e); }
                if (cleanupFailure != null) throw new AggregateException("HOLD: candidate validation and checked close", primary ?? new InvalidOperationException("candidate close failed"), cleanupFailure);
            }
        }
        private static string[] AwaitRequest(IntPtr job, BoundProcess root, List<BoundProcess> lane, BoundRun run, int ordinal, string action)
        {
            string path = ProtocolPath(run, ordinal, action == "LANE_START" ? "start.request" : "retire.request");
            while (GetTickCount64() < run.WorkDeadline) {
                Require(DateTimeOffset.UtcNow.ToUnixTimeMilliseconds() < run.OverallUtcMs, "UTC operation expired");
                uint state = WaitForSingleObject(root.Process.Value, 0);
                if (state == WaitFailed) { int e = Marshal.GetLastWin32Error(); throw new Win32Exception(e, "root wait"); }
                Require(state == WaitTimeout, "root terminal before lane protocol completion");
                if (action == "LANE_START") VerifyMemberSet(job, new BoundProcess[] { root });
                else CaptureOwnedDescendants(job, root, lane, run);
                if (File.Exists(path)) return ReadRequest(path, action, ordinal, run);
                System.Threading.Thread.Sleep(10);
            }
            throw new TimeoutException("Native work deadline; stop further lanes");
        }
        private static void RootOnlyReceipt(IntPtr job, BoundProcess root, BoundRun run, int ordinal, string token, string action)
        {
            VerifyNodeProcess(root.Process.Value, root.ParentPid);
            Require(CreationTime(root.Process.Value) == root.CreatedFileTime, "root creation identity changed");
            VerifyMemberSet(job, new BoundProcess[] { root });
            ulong receiptNow = GetTickCount64();
            if (action == "LANE_START") Require(run.WorkDeadline >= receiptNow && run.WorkDeadline - receiptNow >= RemainingQualificationWork(ordinal)
                && run.OverallEnd >= receiptNow && run.OverallEnd - receiptNow >= RemainingQualificationWork(ordinal) + CleanupReserveMs, "full child and cleanup reserve required before start receipt");
            uint expectedTotal = (uint)(1 + 2 * (action == "LANE_START" ? ordinal : ordinal + 1));
            BasicAccountingInformation boundary = QueryAccounting(job);
            Require(boundary.ActiveProcesses == 1 && boundary.TotalProcesses == expectedTotal, "late or replaced process at exact receipt boundary");
            Publish(ProtocolPath(run, ordinal, action == "LANE_START" ? "start.receipt" : "retire.receipt"),
                String.Join("\t", new string[] { "N24", action, run.BatchToken, ordinal.ToString(CultureInfo.InvariantCulture), token,
                    root.Pid.ToString(CultureInfo.InvariantCulture), root.CreatedFileTime.ToString(CultureInfo.InvariantCulture), "1",
                    run.NativeOrigin, receiptNow.ToString(CultureInfo.InvariantCulture),
                    run.WorkDeadline.ToString(CultureInfo.InvariantCulture), run.OverallEnd.ToString(CultureInfo.InvariantCulture), boundary.TotalProcesses.ToString(CultureInfo.InvariantCulture) }));
        }

        // Intentionally private and unreachable from the unconditional public entry veto.
        private static int SuperviseFixedBatch(BoundRun run)
        {
            Require(run != null && !String.IsNullOrEmpty(run.NativeOrigin) && !String.IsNullOrEmpty(run.NodeOrigin), "origins UNISSUED");
            Guid.ParseExact(run.BatchToken, "D");
            ValidateQualificationRun(run);
            ulong now = GetTickCount64();
            Require(now >= run.Issued && run.WorkDeadline > now && run.WorkDeadline <= UInt64.MaxValue - CleanupReserveMs
                && run.WorkDeadline + CleanupReserveMs <= run.OverallEnd && run.OverallEnd - run.Issued <= 60000, "native work+cleanup exceeds overall");
            Require(run.OverallUtcMs > DateTimeOffset.UtcNow.ToUnixTimeMilliseconds() && run.OverallUtcMs - run.IssuedUtcMs <= 60000, "bounded UTC operation");
            VerifyPins(run);
            EnsureNoReparse(run.OutputRoot, SourceRoot); // A future separately issued exclusive custody claim must create this fixed destination.
            Require(!File.Exists(Path.Combine(run.OutputRoot, "supervisor.claim")), "output already claimed");
            Publish(Path.Combine(run.OutputRoot, "supervisor.claim"), run.BatchToken);
            OwnedHandle job = null, stdout = null, stderr = null;
            BoundProcess root = null;
            var lane = new List<BoundProcess>();
            Exception primary = null, cleanupFailure = null;
            bool wholeZero = false;
            int result = 2;
            try {
                job = CreateConfiguredJob();
                stdout = OpenOutput(Path.Combine(run.OutputRoot, "root.stdout.bin")); stderr = OpenOutput(Path.Combine(run.OutputRoot, "root.stderr.bin"));
                CreateFixedRoot(run, job.Value, stdout, stderr, run.OverallEnd, ref root);
                Publish(Path.Combine(run.OutputRoot, "bridge", "root.identity.tsv"), String.Join("\t", new string[] { run.BatchToken,
                    root.Pid.ToString(CultureInfo.InvariantCulture), root.CreatedFileTime.ToString(CultureInfo.InvariantCulture), run.NativeOrigin,
                    run.Issued.ToString(CultureInfo.InvariantCulture), run.WorkDeadline.ToString(CultureInfo.InvariantCulture), run.OverallEnd.ToString(CultureInfo.InvariantCulture) }));
                VerifyMemberSet(job.Value, new BoundProcess[] { root });
                QualificationRootProof(job.Value, root, run);
                uint previous = ResumeThread(root.Thread.Value);
                if (previous == 0xffffffff) { int e = Marshal.GetLastWin32Error(); throw new Win32Exception(e, "ResumeThread"); }
                Require(previous == 1, "root must resume exactly once after membership verification");
                root.Thread.CloseChecked();
                var used = new HashSet<string>(StringComparer.Ordinal);
                for (int ordinal = 0; ordinal < 6; ordinal++) {
                    VerifyPins(run);
                    RequireQualificationReserve(run, ordinal);
                    Require(QueryAccounting(job.Value).TotalProcesses == (uint)(1 + 2 * ordinal), "unobserved or extra prior Job member");
                    string[] start = AwaitRequest(job.Value, root, lane, run, ordinal, "LANE_START");
                    Require(used.Add(start[4]), "replayed lane token");
                    RootOnlyReceipt(job.Value, root, run, ordinal, start[4], "LANE_START");
                    string[] retired = AwaitRequest(job.Value, root, lane, run, ordinal, "LANE_RETIRE");
                    Require(retired[4] == start[4], "retirement token mismatch");
                    Require(lane.Count == 2 && QueryAccounting(job.Value).TotalProcesses == (uint)(1 + 2 * (ordinal + 1)), "unknown or unobserved descendant identity; topology UNQUALIFIED");
                    foreach (BoundProcess child in lane) {
                        Require(child.InOwnedJob, "owned membership receipt missing");
                        WaitExited(child.Process.Value, run.WorkDeadline);
                        uint exit; Win32(GetExitCodeProcess(child.Process.Value, out exit), "owned descendant terminal");
                        child.CloseChecked(); Require(child.Process.IsClosed, "owned descendant close uncertain");
                    }
                    lane.Clear();
                    RootOnlyReceipt(job.Value, root, run, ordinal, start[4], "LANE_RETIRE");
                    QualificationRetirementProof(job.Value, root, run, ordinal, false);
                }
                WaitExited(root.Process.Value, run.WorkDeadline);
                uint code; Win32(GetExitCodeProcess(root.Process.Value, out code), "root terminal");
                Require(code == 0 || code == 1, "root terminal not qualified");
                BasicAccountingInformation finalAccounting = QueryAccounting(job.Value);
                Require(finalAccounting.TotalProcesses == 13 && finalAccounting.ActiveProcesses == 0 && QueryMembers(job.Value, 0).Length == 0, "final exact13 and Whole-Job-zero missing");
                wholeZero = true;
                QualificationRetirementProof(job.Value, root, run, 6, true);
                root.CloseChecked(); stdout.CloseChecked(); stderr.CloseChecked(); job.CloseChecked();
                Publish(Path.Combine(run.OutputRoot, "BATCH_RETIRE.tsv"), "N24\tBATCH_RETIRE\t" + run.BatchToken + "\t6\tROOT_TERMINAL_HANDLES_CLOSED\tWHOLE_JOB_ZERO");
                result = (int)code;
            } catch (Exception e) { primary = e; result = 2; }
            finally {
                if (job != null && !job.IsClosed) {
                    try {
                        Win32(TerminateJobObject(job.Value, ExpectedJobExitCode), "exact newly owned Job failure retirement");
                        while (GetTickCount64() < run.OverallEnd) {
                            if (QueryAccounting(job.Value).ActiveProcesses == 0 && QueryMembers(job.Value, 0).Length == 0) { wholeZero = true; break; }
                            System.Threading.Thread.Sleep(10);
                        }
                        Require(wholeZero && GetTickCount64() <= run.OverallEnd, "HOLD_UNCERTAIN_RETIREMENT: Whole-Job-zero absent");
                        QualificationRetirementProof(job.Value, root, run, -1, true);
                    } catch (Exception e) { CaptureCleanupFailure(ref cleanupFailure, e); }
                    try { job.CloseChecked(); } catch (Exception e) { CaptureCleanupFailure(ref cleanupFailure, e); }
                }
                foreach (BoundProcess child in lane) {
                    try { Require(child.InOwnedJob, "unknown descendant membership"); WaitExited(child.Process.Value, run.OverallEnd); }
                    catch (Exception e) { CaptureCleanupFailure(ref cleanupFailure, e); }
                    try { child.CloseChecked(); } catch (Exception e) { CaptureCleanupFailure(ref cleanupFailure, e); }
                }
                if (root != null) {
                    try { if (!root.Process.IsClosed) WaitExited(root.Process.Value, run.OverallEnd); }
                    catch (Exception e) { CaptureCleanupFailure(ref cleanupFailure, e); }
                    try { root.CloseChecked(); } catch (Exception e) { CaptureCleanupFailure(ref cleanupFailure, e); }
                }
                if (stdout != null) try { stdout.CloseChecked(); } catch (Exception e) { CaptureCleanupFailure(ref cleanupFailure, e); }
                if (stderr != null) try { stderr.CloseChecked(); } catch (Exception e) { CaptureCleanupFailure(ref cleanupFailure, e); }
                if (cleanupFailure != null) throw new AggregateException("HOLD_UNCERTAIN_RETIREMENT", primary ?? new InvalidOperationException("retirement failure"), cleanupFailure);
            }
            if (primary != null) throw new InvalidOperationException("HOLD: stop remaining lanes", primary);
            return result;
        }
    }
}
