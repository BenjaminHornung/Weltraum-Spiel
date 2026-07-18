"""Owned process containers for Windows Job Objects and POSIX sessions."""

import os
import signal
import subprocess
import time


class PosixProcessGroup:
    def __init__(self, process):
        self.process = process
        self.group_id = process.pid

    @property
    def metadata(self):
        return {
            "kind": "posix-session",
            "root_pid": self.process.pid,
            "process_group_id": self.group_id,
        }

    def terminate(self, grace=2.0):
        if not self._exists():
            return "already-exited"
        try:
            os.killpg(self.group_id, signal.SIGTERM)
        except ProcessLookupError:
            return "already-exited"
        deadline = time.monotonic() + grace
        while self._exists() and time.monotonic() < deadline:
            time.sleep(0.02)
        if self._exists():
            try:
                os.killpg(self.group_id, signal.SIGKILL)
            except ProcessLookupError:
                pass
            self._wait_for_exit(grace)
            action = "sigkill"
        else:
            action = "sigterm"
        try:
            self.process.wait(timeout=grace)
        except (subprocess.TimeoutExpired, ChildProcessError):
            pass
        return action

    def close(self):
        self.terminate()

    def _exists(self):
        try:
            os.killpg(self.group_id, 0)
            return True
        except ProcessLookupError:
            return False
        except PermissionError:
            return True

    def _wait_for_exit(self, grace):
        deadline = time.monotonic() + grace
        while self._exists() and time.monotonic() < deadline:
            time.sleep(0.02)


class WindowsJob:
    """A kill-on-close Job Object containing only this attempt's descendants."""

    def __init__(self, process):
        import ctypes
        from ctypes import wintypes

        class BasicLimitInformation(ctypes.Structure):
            _fields_ = [
                ("PerProcessUserTimeLimit", ctypes.c_longlong),
                ("PerJobUserTimeLimit", ctypes.c_longlong),
                ("LimitFlags", wintypes.DWORD),
                ("MinimumWorkingSetSize", ctypes.c_size_t),
                ("MaximumWorkingSetSize", ctypes.c_size_t),
                ("ActiveProcessLimit", wintypes.DWORD),
                ("Affinity", ctypes.c_size_t),
                ("PriorityClass", wintypes.DWORD),
                ("SchedulingClass", wintypes.DWORD),
            ]

        class IoCounters(ctypes.Structure):
            _fields_ = [
                ("ReadOperationCount", ctypes.c_ulonglong),
                ("WriteOperationCount", ctypes.c_ulonglong),
                ("OtherOperationCount", ctypes.c_ulonglong),
                ("ReadTransferCount", ctypes.c_ulonglong),
                ("WriteTransferCount", ctypes.c_ulonglong),
                ("OtherTransferCount", ctypes.c_ulonglong),
            ]

        class ExtendedLimitInformation(ctypes.Structure):
            _fields_ = [
                ("BasicLimitInformation", BasicLimitInformation),
                ("IoInfo", IoCounters),
                ("ProcessMemoryLimit", ctypes.c_size_t),
                ("JobMemoryLimit", ctypes.c_size_t),
                ("PeakProcessMemoryUsed", ctypes.c_size_t),
                ("PeakJobMemoryUsed", ctypes.c_size_t),
            ]

        kernel32 = ctypes.WinDLL("kernel32", use_last_error=True)
        kernel32.CreateJobObjectW.argtypes = [ctypes.c_void_p, wintypes.LPCWSTR]
        kernel32.CreateJobObjectW.restype = wintypes.HANDLE
        kernel32.SetInformationJobObject.argtypes = [
            wintypes.HANDLE,
            ctypes.c_int,
            ctypes.c_void_p,
            wintypes.DWORD,
        ]
        kernel32.SetInformationJobObject.restype = wintypes.BOOL
        kernel32.AssignProcessToJobObject.argtypes = [wintypes.HANDLE, wintypes.HANDLE]
        kernel32.AssignProcessToJobObject.restype = wintypes.BOOL
        kernel32.TerminateJobObject.argtypes = [wintypes.HANDLE, wintypes.UINT]
        kernel32.TerminateJobObject.restype = wintypes.BOOL
        kernel32.CloseHandle.argtypes = [wintypes.HANDLE]
        kernel32.CloseHandle.restype = wintypes.BOOL

        self.process = process
        self._kernel32 = kernel32
        self._handle = kernel32.CreateJobObjectW(None, None)
        if not self._handle:
            raise ctypes.WinError(ctypes.get_last_error())
        try:
            information = ExtendedLimitInformation()
            information.BasicLimitInformation.LimitFlags = 0x00002000
            if not kernel32.SetInformationJobObject(
                self._handle, 9, ctypes.byref(information), ctypes.sizeof(information)
            ):
                raise ctypes.WinError(ctypes.get_last_error())
            if not kernel32.AssignProcessToJobObject(self._handle, wintypes.HANDLE(process._handle)):
                raise ctypes.WinError(ctypes.get_last_error())
        except BaseException:
            self.close()
            raise

    @property
    def metadata(self):
        return {
            "kind": "windows-job-object",
            "root_pid": self.process.pid,
            "kill_on_close": True,
        }

    def terminate(self, grace=2.0):
        if self._handle is None:
            return "already-closed"
        import ctypes

        if not self._kernel32.TerminateJobObject(self._handle, 1):
            raise ctypes.WinError(ctypes.get_last_error())
        try:
            self.process.wait(timeout=grace)
        except subprocess.TimeoutExpired:
            pass
        return "terminate-job"

    def close(self):
        if self._handle is not None:
            import ctypes

            handle = self._handle
            if self._kernel32.CloseHandle(handle):
                self._handle = None
                return
            first_error = ctypes.WinError(ctypes.get_last_error())
            termination_error = None
            try:
                self.terminate()
            except BaseException as error:
                termination_error = error
            if self._kernel32.CloseHandle(handle):
                self._handle = None
            if termination_error is not None:
                raise OSError(
                    f"CloseHandle failed and owned Job termination also failed: {termination_error}"
                ) from first_error
            raise first_error


def create_process_container(process):
    return WindowsJob(process) if os.name == "nt" else PosixProcessGroup(process)


def resume_process(process):
    if os.name != "nt":
        return
    import ctypes
    from ctypes import wintypes

    ntdll = ctypes.WinDLL("ntdll", use_last_error=True)
    ntdll.NtResumeProcess.argtypes = [wintypes.HANDLE]
    ntdll.NtResumeProcess.restype = ctypes.c_long
    status = ntdll.NtResumeProcess(wintypes.HANDLE(process._handle))
    if status != 0:
        raise OSError(f"NtResumeProcess failed with NTSTATUS 0x{status & 0xffffffff:08x}")


def get_process_identity(pid) -> str | None:
    """Return a process-birth token, never PID liveness alone."""
    if not isinstance(pid, int) or isinstance(pid, bool) or pid <= 0:
        return None
    if os.name != "nt":
        try:
            stat = open(f"/proc/{pid}/stat", encoding="utf-8").read()
            fields = stat[stat.rfind(")") + 2 :].split()
            return f"proc-start:{fields[19]}" if len(fields) > 19 else None
        except (OSError, ValueError, IndexError):
            return None

    import ctypes
    from ctypes import wintypes

    kernel32 = ctypes.WinDLL("kernel32", use_last_error=True)
    kernel32.OpenProcess.argtypes = [wintypes.DWORD, wintypes.BOOL, wintypes.DWORD]
    kernel32.OpenProcess.restype = wintypes.HANDLE
    kernel32.GetProcessTimes.argtypes = [
        wintypes.HANDLE,
        ctypes.POINTER(wintypes.FILETIME),
        ctypes.POINTER(wintypes.FILETIME),
        ctypes.POINTER(wintypes.FILETIME),
        ctypes.POINTER(wintypes.FILETIME),
    ]
    kernel32.GetProcessTimes.restype = wintypes.BOOL
    kernel32.CloseHandle.argtypes = [wintypes.HANDLE]
    kernel32.CloseHandle.restype = wintypes.BOOL
    handle = kernel32.OpenProcess(0x1000, False, pid)
    if not handle:
        return None
    creation = wintypes.FILETIME()
    unused = [wintypes.FILETIME() for _ in range(3)]
    try:
        if not kernel32.GetProcessTimes(
            handle, ctypes.byref(creation), *(ctypes.byref(value) for value in unused)
        ):
            return None
        created = (creation.dwHighDateTime << 32) | creation.dwLowDateTime
        return f"win-created:{created}"
    finally:
        if not kernel32.CloseHandle(handle):
            return None


def process_identity_matches(pid, expected_identity) -> bool:
    return (
        process_is_alive(pid)
        and isinstance(expected_identity, str)
        and bool(expected_identity)
        and get_process_identity(pid) == expected_identity
    )


def process_is_alive(pid) -> bool:
    if not isinstance(pid, int) or isinstance(pid, bool) or pid <= 0:
        return False
    if os.name != "nt":
        try:
            stat = open(f"/proc/{pid}/stat", encoding="utf-8").read()
            fields = stat[stat.rfind(")") + 2 :].split()
            if fields and fields[0] == "Z":
                return False
        except FileNotFoundError:
            if os.path.isdir("/proc"):
                return False
        except (OSError, ValueError, IndexError):
            pass
        try:
            os.kill(pid, 0)
            return True
        except ProcessLookupError:
            return False
        except PermissionError:
            return True

    import ctypes
    from ctypes import wintypes

    kernel32 = ctypes.WinDLL("kernel32", use_last_error=True)
    kernel32.OpenProcess.argtypes = [wintypes.DWORD, wintypes.BOOL, wintypes.DWORD]
    kernel32.OpenProcess.restype = wintypes.HANDLE
    kernel32.GetExitCodeProcess.argtypes = [wintypes.HANDLE, ctypes.POINTER(wintypes.DWORD)]
    kernel32.GetExitCodeProcess.restype = wintypes.BOOL
    kernel32.CloseHandle.argtypes = [wintypes.HANDLE]
    kernel32.CloseHandle.restype = wintypes.BOOL
    handle = kernel32.OpenProcess(0x1000, False, pid)
    if not handle:
        return False
    try:
        exit_code = wintypes.DWORD()
        return bool(kernel32.GetExitCodeProcess(handle, ctypes.byref(exit_code))) and exit_code.value == 259
    finally:
        kernel32.CloseHandle(handle)
