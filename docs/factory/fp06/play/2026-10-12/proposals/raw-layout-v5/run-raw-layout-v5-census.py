import datetime, gzip, hashlib, json, pathlib, subprocess, time

base = pathlib.Path('/workspace/.cloud-setup/fp06-play-2026-10-12/PLAY-01')
script = base / 'raw-layout-v5-readonly-census.mjs'
cwd = '/workspace/Weltraum-Spiel/.worktrees/fp06-integrator-2026-10-11/apps/weltraum-browser'
node = '/workspace/.cloud-setup/toolchain/node_modules/node/bin/node'
start = datetime.datetime.now(datetime.timezone.utc)
run = base / ('raw-layout-v5-proposal-census-' + start.strftime('%Y%m%dT%H%M%SZ'))
run.mkdir()
out = run / 'census-output'
argv = [node, str(script), str(out)]
script_bytes = script.read_bytes()
wrapper_bytes = pathlib.Path(__file__).read_bytes()
t0 = time.perf_counter()
proc = subprocess.run(argv, cwd=cwd, stdout=subprocess.PIPE, stderr=subprocess.STDOUT)
elapsed = time.perf_counter() - t0
end = datetime.datetime.now(datetime.timezone.utc)
raw = proc.stdout
raw_path = run / '01-readonly-v4-to-proposed-v5-census.raw.log.gz'
raw_path.write_bytes(gzip.compress(raw, mtime=0))
receipt = {
 'schema': 'hestia.play.bound-readonly-command/v1', 'argv': argv, 'cwd': cwd,
 'startUtc': start.isoformat(), 'endUtc': end.isoformat(), 'elapsedSeconds': elapsed,
 'exitCode': proc.returncode, 'rawBytes': len(raw), 'rawSha256': hashlib.sha256(raw).hexdigest(),
 'rawGzipPath': raw_path.name,
 'script': {'path': str(script), 'bytes': len(script_bytes), 'sha256': hashlib.sha256(script_bytes).hexdigest()},
 'wrapper': {'path': str(pathlib.Path(__file__).resolve()), 'bytes': len(wrapper_bytes), 'sha256': hashlib.sha256(wrapper_bytes).hexdigest()},
 'cpuLease': 'Root-authorized single unpublished-copy census, coordinated with Cell and Integrator before start',
 'scope': 'Readonly actual V4 source constructor/copy, exactly 192 new columns; external evidence only; no World/Native/Test/Build/Browser/Profile'
}
(run / '01-readonly-v4-to-proposed-v5-census.command.json').write_text(json.dumps(receipt, indent=2)+'\n')
print(json.dumps({'run':str(run), **receipt}))
print(raw.decode('utf-8', errors='replace'))
raise SystemExit(proc.returncode)
