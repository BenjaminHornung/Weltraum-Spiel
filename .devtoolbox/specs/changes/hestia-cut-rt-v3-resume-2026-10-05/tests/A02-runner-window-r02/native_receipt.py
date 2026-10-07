"""This task's pinned whole-file Native commands and immutable receipts; no runtime code."""
from pathlib import Path
from datetime import datetime, timezone, timedelta
import ctypes
import ctypes.wintypes as w
import hashlib
import json
import os
import subprocess
import sys
import time

ROOT = Path(__file__).parent
APP = Path('C:/IFI_SourceCode/Temp/WeltraumSpiel/.worktrees/Hestia-CutV3-Resume-2026-10-05/apps/weltraum-browser')
NODE = 'C:/IFI_SourceCode/Utils/npm-tmp/opencode/node-v22.23.2-win-x64/node.exe'
k = ctypes.WinDLL('kernel32', use_last_error=True)
k.GetCurrentProcess.restype = w.HANDLE
k.OpenProcess.argtypes = [w.DWORD, w.BOOL, w.DWORD]
k.OpenProcess.restype = w.HANDLE
k.CloseHandle.argtypes = [w.HANDLE]
k.GetProcessTimes.argtypes = [w.HANDLE, *[ctypes.POINTER(w.FILETIME)] * 4]

def process(pid):
    ctypes.set_last_error(0)
    handle = k.OpenProcess(0x1000, False, pid)
    if not handle:
        return {'presence': 'ABSENT' if ctypes.get_last_error() == 87 else 'UNKNOWN', 'win32Error': ctypes.get_last_error()}
    created, ended, kernel, user = w.FILETIME(), w.FILETIME(), w.FILETIME(), w.FILETIME()
    try:
        assert k.GetProcessTimes(handle, ctypes.byref(created), ctypes.byref(ended), ctypes.byref(kernel), ctypes.byref(user))
        return {'presence': 'PRESENT', 'creationFileTime': (created.dwHighDateTime << 32) | created.dwLowDateTime}
    finally:
        k.CloseHandle(handle)

def write(folder, name, value):
    with (folder / name).open('x', encoding='utf-8') as stream:
        json.dump(value, stream, indent=2)

if sys.argv[1] == 'release':
    folder = ROOT / sys.argv[2]
    terminal = json.loads((folder / 'native-terminal-original.DATA.json').read_text())
    scope = []
    for row in terminal['scope']:
        observed = process(row['pid'])
        if observed['presence'] == 'PRESENT' and observed['creationFileTime'] != row['creationFileTime']:
            observed['presence'] = 'ORIGINAL_ABSENT_PID_REUSED'
        scope.append({**row, 'observed': observed})
    now = datetime.now(timezone.utc)
    elapsed = (now - datetime.fromisoformat(terminal['firstUtc'])).total_seconds()
    release = (now - datetime.fromisoformat(terminal['terminalUtc'])).total_seconds()
    absent = all(row['observed']['presence'] in ['ABSENT', 'ORIGINAL_ABSENT_PID_REUSED'] for row in scope)
    receipt = {'observedUtc': now.isoformat(), 'scopedReleaseSeconds': release,
        'cleanup60': 'PASS' if absent and release <= 60 else 'FAIL_LATE_OBSERVATION' if absent else 'NOT_PROVEN',
        'scope': scope, 'nativeJobCountsAtTerminal': terminal['jobCountsAfter'],
        'nativeTreeReleased': 'PASS' if absent and terminal['jobCountsAfter']['ActiveProcesses'] == 1 else 'NOT_PROVEN',
        'elapsedSeconds': elapsed, 'admin600': 'PASS' if elapsed <= 600 else 'FAIL',
        'Dwork540': 'PASS' if elapsed <= 540 else 'FAIL', 'earlierTrees': 'UNCHANGED', 'foreignProcesses': 'NOT_TARGETED'}
    write(folder, 'post-return-release-original.DATA.json', receipt)
    print(json.dumps(receipt))
    raise SystemExit(0 if receipt['cleanup60'] == 'PASS' else 92)

phase, binding, mode, *files = sys.argv[1:]
assert '/' not in phase and '\\' not in phase and '..' not in phase
assert mode in ['type', 'tests']
assert not files if mode == 'type' else files and all(f.startswith('tests/unit/') and f.endswith('.test.ts') and '..' not in f for f in files)
bindings = json.loads((ROOT / binding).read_text())
def check():
    for row in bindings:
        data = (APP / row['appRelative']).read_bytes()
        assert len(data) == row['bytes'] and hashlib.sha256(data).hexdigest() == row['sha256'], row['appRelative']
check()
class PBI(ctypes.Structure):
    _fields_ = [('ExitStatus', w.LONG), ('Peb', ctypes.c_void_p), ('Affinity', ctypes.c_size_t),
        ('BasePriority', w.LONG), ('Unique', ctypes.c_size_t), ('Parent', ctypes.c_size_t)]
n = ctypes.WinDLL('ntdll')
n.NtQueryInformationProcess.argtypes = [w.HANDLE, w.ULONG, ctypes.c_void_p, w.ULONG, ctypes.POINTER(w.ULONG)]
n.NtQueryInformationProcess.restype = w.LONG
info, length = PBI(), w.ULONG()
assert n.NtQueryInformationProcess(k.GetCurrentProcess(), 0, ctypes.byref(info), ctypes.sizeof(info), ctypes.byref(length)) == 0
parent = int(info.Parent)
scope = [{'role': 'caller', 'pid': parent, **process(parent)}, {'role': 'wrapper', 'pid': os.getpid(), **process(os.getpid())}]
first = datetime(1601, 1, 1, tzinfo=timezone.utc) + timedelta(microseconds=scope[0]['creationFileTime'] // 10)
plan_file = ROOT / (phase + '.plan.json')
plan = json.loads(plan_file.read_text(encoding='utf-8-sig')) if plan_file.exists() else {}
cap = plan.get('nativeCapSeconds', 60 if mode == 'type' else 180)
assert isinstance(cap, int) and 1 <= cap <= 3600
if mode == 'type':
    assert cap == 60
if 'tests/unit/hvp-body-plan-owner.test.ts' in files:
    assert cap == 180
folder = ROOT / phase
folder.mkdir()
write(folder, 'FIRST-original.DATA.json', {'firstUtc': first.isoformat(), 'adminSeconds': 600, 'DworkSeconds': 540,
    'finalSeconds': 60, 'cleanupSeconds': 60, 'legacyAdministrativeChecklist': 'SUPERSEDED_BY_RESTART_BETRIEB_SECTION_9',
    'capSecondsIncludingWrapper': cap, 'capScope': 'OWNER180_PRESERVED' if 'tests/unit/hvp-body-plan-owner.test.ts' in files else 'DECLARED_COMMAND_WINDOW_NOT_TEST_DEADLINE',
    'wholeFiles': files, 'modeInjection': 'TEST_LOCAL_A02_TRACE' if os.environ.get('WELTRAUM_A02_TRACE') == '1' else 'NONE',
    'cpuProfile': os.environ.get('WELTRAUM_A02_CPU_PROFILE') == '1',
    'selectorsBailDeadlineChange': 'NONE', 'testTimeout': 'DEFAULT5000_AND_ORIGINAL_EXPLICIT_DECLARATIONS_UNCHANGED',
    'helperSha256': hashlib.sha256(Path(__file__).read_bytes()).hexdigest()})
write(folder, 'bindings-before-original.DATA.json', bindings)
class Accounting(ctypes.Structure):
    _fields_ = [(key, ctypes.c_longlong) for key in ['TotalUserTime', 'TotalKernelTime', 'ThisPeriodTotalUserTime', 'ThisPeriodTotalKernelTime']] + [(key, w.DWORD) for key in ['TotalPageFaultCount', 'TotalProcesses', 'ActiveProcesses', 'TotalTerminatedProcesses']]
k.CreateJobObjectW.argtypes = [ctypes.c_void_p, w.LPCWSTR]
k.CreateJobObjectW.restype = w.HANDLE
k.AssignProcessToJobObject.argtypes = [w.HANDLE, w.HANDLE]
k.AssignProcessToJobObject.restype = w.BOOL
k.QueryInformationJobObject.argtypes = [w.HANDLE, w.INT, ctypes.c_void_p, w.DWORD, ctypes.POINTER(w.DWORD)]
k.QueryInformationJobObject.restype = w.BOOL
job = k.CreateJobObjectW(None, None)
assert job and k.AssignProcessToJobObject(job, k.GetCurrentProcess())
def counts():
    value, length = Accounting(), w.DWORD()
    assert k.QueryInformationJobObject(job, 1, ctypes.byref(value), ctypes.sizeof(value), ctypes.byref(length))
    return {key: getattr(value, key) for key in ['TotalProcesses', 'ActiveProcesses', 'TotalTerminatedProcesses']}
assert counts()['TotalProcesses'] == counts()['ActiveProcesses'] == 1
argv = [NODE, str(APP / 'node_modules/typescript/bin/tsc'), '-p', 'tsconfig.json', '--noEmit'] if mode == 'type' else [NODE,
    str(APP / 'node_modules/vitest/vitest.mjs'), 'run', *files, '--maxWorkers=1', '--no-file-parallelism',
    '--reporter=default', '--reporter=json', '--outputFile=' + str(folder / 'original-vitest.json')]
if os.environ.get('WELTRAUM_A02_CPU_PROFILE') == '1':
    argv[1:1] = ['--cpu-prof', '--cpu-prof-dir=' + str(folder)]
    os.environ['WELTRAUM_A02_CPU_PROFILE_DIR'] = str(folder)
start, clock = datetime.now(timezone.utc), time.perf_counter()
with (folder / 'native-original.stdout.txt').open('xb') as out, (folder / 'native-original.stderr.txt').open('xb') as err:
    proc = subprocess.Popen(argv, cwd=APP, stdout=out, stderr=err)
    scope.append({'role': 'native', 'pid': proc.pid, **process(proc.pid)})
    write(folder, 'native-start-original.DATA.json', {'startUtc': start.isoformat(), 'cwd': str(APP), 'argv': argv,
        'scope': scope, 'nativeInvocations': 1, 'job': 'Unnamed job assigned to this wrapper before launch; default inherited, no breakaway or limits'})
    outcome = 'KNOWN'
    try:
        code = proc.wait(timeout=max(1, cap - (datetime.now(timezone.utc) - first).total_seconds()))
    except subprocess.TimeoutExpired:
        outcome = 'UNKNOWN_NATIVE_TIMEOUT_STOP'
        proc.kill()
        code = proc.wait(timeout=60)
now = datetime.now(timezone.utc)
elapsed = (now - first).total_seconds()
receipt = {'firstUtc': first.isoformat(), 'terminalUtc': now.isoformat(), 'nativeExitCode': code,
    'NativeOutcome': outcome, 'nativeSeconds': time.perf_counter() - clock, 'wrapperThroughShortSeconds': elapsed,
    'nativeCapIncludingWrapper': 'PASS' if elapsed < cap else 'FAIL', 'scope': scope, 'jobCountsAfter': counts(),
    'stdoutBytes': (folder / 'native-original.stdout.txt').stat().st_size, 'stderrBytes': (folder / 'native-original.stderr.txt').stat().st_size}
write(folder, 'native-terminal-original.DATA.json', receipt)
write(folder, 'SHORT-native-emitted-original.DATA.json', receipt)
print(json.dumps(receipt), flush=True)
check()
write(folder, 'bindings-after-original.DATA.json', bindings)
if (folder / 'original-vitest.json').exists():
    result = json.loads((folder / 'original-vitest.json').read_text())
    write(folder, 'counts-original.DATA.json', {key: result.get(key) for key in ['success', 'numTotalTests', 'numPassedTests', 'numFailedTests', 'numPendingTests']})
raise SystemExit(code if outcome == 'KNOWN' else 91)
