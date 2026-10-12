import datetime, gzip, hashlib, json, pathlib, subprocess, sys, time

root = pathlib.Path('/workspace/Weltraum-Spiel/.worktrees/fp06-integrator-2026-10-11')
app = root / 'apps/weltraum-browser'
run = pathlib.Path(sys.argv[1])
run.mkdir(parents=True, exist_ok=True)
label = sys.argv[2]
command = sys.argv[3:]
tracked = subprocess.check_output(['git', 'diff', '--name-only'], cwd=root).decode().splitlines()
tracked.extend(name for name in ['apps/weltraum-browser/src/factory/presentation/factoryS1Assets.ts','apps/weltraum-browser/tests/unit/factory/factoryS1Assets.test.ts'] if name not in tracked and (root/name).exists())
sources = []
for name in tracked:
    payload = (root / name).read_bytes()
    sources.append({'path': name, 'bytes': len(payload), 'sha256': hashlib.sha256(payload).hexdigest()})
started = datetime.datetime.now(datetime.timezone.utc).isoformat()
tick = time.monotonic()
process = subprocess.Popen(command, cwd=app, stdout=subprocess.PIPE, stderr=subprocess.STDOUT)
chunks = []
for chunk in iter(process.stdout.readline, b''):
    chunks.append(chunk)
    sys.stdout.buffer.write(chunk)
    sys.stdout.buffer.flush()
exit_code = process.wait()
elapsed = time.monotonic() - tick
ended = datetime.datetime.now(datetime.timezone.utc).isoformat()
raw = b''.join(chunks)
(run / (label + '.log')).write_bytes(raw)
with gzip.open(run / (label + '.raw.log.gz'), 'wb') as f:
    f.write(raw)
receipt = {'command': command, 'cwd': str(app), 'actor': '/root/play_integrator', 'startedAtUtc': started, 'endedAtUtc': ended, 'elapsedSeconds': elapsed, 'exitCode': exit_code, 'rawBytes': len(raw), 'rawSha256': hashlib.sha256(raw).hexdigest(), 'head': subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=root).decode().strip(), 'node': subprocess.check_output(['node', '--version']).decode().strip(), 'npm': subprocess.check_output(['npm', '--version']).decode().strip(), 'nodeExecPath': subprocess.check_output(['node', '-p', 'process.execPath']).decode().strip(), 'sourceBindings': sources}
(run / (label + '.command.json')).write_text(json.dumps(receipt, indent=2) + '\n')
print(json.dumps({k: receipt[k] for k in ['startedAtUtc','endedAtUtc','elapsedSeconds','exitCode','rawBytes','rawSha256']}))
sys.exit(exit_code)
