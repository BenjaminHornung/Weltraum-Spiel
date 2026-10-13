"""Verify frozen producers before copying the minimum unchanged TS control closure."""
import hashlib, json, pathlib, re, shutil, subprocess, sys

SPIKE = pathlib.Path(__file__).resolve().parents[1]
ROOT = SPIKE.parents[1]
MAIN = ROOT.parents[1]
WORKTREES = MAIN / ".worktrees"
def sha(p): return hashlib.sha256(p.read_bytes()).hexdigest()
def checked(p, digest, size=None):
    assert p.is_file() and sha(p) == digest, f"Binding mismatch: {p}"
    assert size is None or p.stat().st_size == size, f"Size mismatch: {p}"
    return p
def read(p): return json.loads(p.read_text(encoding="utf-8-sig"))
def write(p, data):
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(json.dumps(data, indent=2)+"\n", encoding="utf-8")

git = pathlib.Path("C:/IFI_SourceCode/Utils/opencode-migration/runtime/git/cmd/git.exe")
def git_read(*args):
    return subprocess.check_output([str(git), "-C", str(ROOT), *args], text=True).strip()
assert git_read("rev-parse", "HEAD") == "17b1db4201a28e7b607c30707bdc2b75e3484a10"
assert git_read("branch", "--show-current") == "feature/gfx-05-2026-10-09"
g00 = WORKTREES / "Hestia-Upscaling-S1-G00-2026-10-09/spikes/upscaling-s1-g00"
gseal=read(checked(g00/"delivery-seal.json", "2c567f41dd5172c180fe7103b8515487cdd36b8c0e092b662be6d7c5146fbbce", 58538))
for entry in gseal["files"]:
    checked(g00.parents[1]/entry["path"],entry["sha256"],entry["bytes"])
b = read(g00/"evidence/a0-frozen-r03/a0-r01-binding.json")
h = b["helper"]
checked(pathlib.Path(h["python"]), h["pythonSha256"])
checked(pathlib.Path(h["path"]), h["sha256"], 8374)
assert h["originalLocator"].startswith(b["a0Root"])
result = subprocess.run([h["python"], *h["args"]], cwd=ROOT, capture_output=True, text=True)
assert result.returncode == 0, result.stderr
for entry in b["entryBindings"]:
    checked(pathlib.Path(b["a0Root"])/entry["path"], entry["sha256"], entry["bytes"])

plt = WORKTREES/"Hestia-Spike-PLT-01-02-2026-10-09"
ps = plt/"spikes/plt-01-02-numerics"
checked(ps/"receipt.json", "5842f1c2b781c1ce65a347ec45c28da0717215537ebd45ee100b3a255429555a", 13793)
seal = read(checked(ps/".runtime/final-seal/scope-seal.json", "b4c0daf90e5c91e4f6811e47b08f32dcfc39b2e932b1e9f34fc53c4009586c6d", 21203))
for entry in seal["changedFiles"]:
    checked(plt/entry["path"], entry["digest"].removeprefix("sha256:"), entry["bytes"])
checked(ps/"NumericsProfile.json", "c7652cc948a0f213a8a29ff75bdb0a76ede71344c315f924fcc541e6f7ead551", 1386)
rt = WORKTREES/"Hestia-Spike-RT-01-2026-10-09"
rs = rt/"spikes/rt-01-oracle"
checked(rs/"receipt.json", "7ec2c677895d7a4d356814c94787824d61fad827dde99cff1d0f2e8c87d297c4", 7225)
rseal = read(checked(rs/"binding-manifest.json", "c1d7e4684eda0002b5ebe7d8187583ce4fc6fc33d8de637108abd73a1e21026c", 39776))
for entry in rseal["files"]:
    if entry.get("normalization"):
        assert entry["path"] == "spikes/rt-01-oracle/receipt.json"
        # The producer uses JS number formatting; Python JSON is not its byte serializer.
        data = subprocess.check_output(["C:/IFI_SourceCode/Utils/npm-tmp/opencode/node-v22.23.2-win-x64/node.exe",
            "-e", "const fs=require('node:fs');const r=JSON.parse(fs.readFileSync(process.argv[1],'utf8'));r.source.dirtyTreeSha256=null;r.source.bindingManifestSha256=null;process.stdout.write(JSON.stringify(r)+'\\n');",
            str(rt/entry["path"])])
        assert len(data)==entry["byteLength"] and hashlib.sha256(data).hexdigest()==entry["sha256"], "RT normalized receipt mismatch"
    else:
        checked(rt/entry["path"], entry["sha256"], entry["byteLength"])

source = pathlib.Path(b["sourceRoot"])/"apps/weltraum-browser/src"
copied = []
def copy(rel):
    p = source/rel
    if any(e["path"] == rel.as_posix() for e in copied): return
    assert p.is_file(), f"Missing real source: {p}"
    target = SPIKE/"oracle"/rel
    target.parent.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(p, target)
    copied.append({"path":rel.as_posix(), "bytes":p.stat().st_size, "sha256":sha(p), "changed":False})
    for spec in re.findall(r'(?:from\s*|import\s*)["\x27](\.[^"\x27]+)["\x27]', p.read_text(encoding="utf-8")):
        base = rel.parent/spec
        dep = base.with_suffix(".ts") if (source/base.with_suffix(".ts")).is_file() else base/"index.ts"
        copy(pathlib.Path(__import__("os").path.normpath(str(dep))))
copy(pathlib.Path("hvp/hvpCoastMesher.ts"))
copy(pathlib.Path("hestia-prototype/physics/terrainColliders.ts"))
copy(pathlib.Path("hestia-prototype/terrain/cutPlan.ts"))
copy(pathlib.Path("hestia-prototype/terrain/terrainChunkInput.ts"))
# The actual consumer/contract is evidence; importing its whole worker owner is unnecessary.
for rel in ["workers/hvpChunkJob.ts", "hestia-prototype/terrain/terrainChunkInput.ts",
            "hestia-prototype/presentation/look.ts", "hestia-prototype/presentation/visualEffects.ts"]:
    p=source/rel; target=SPIKE/"contracts"/rel; target.parent.mkdir(parents=True,exist_ok=True); shutil.copyfile(p,target)
    copied.append({"path":rel,"bytes":p.stat().st_size,"sha256":sha(p),"changed":False,"contractOnly":True})
worker=source/"workers/hvpChunkJob.ts"
text=worker.read_text(encoding="utf-8")
body=text[text.index("const payloadKeys="):text.index("export const validateHvpEastChunkCollisionPayload=")]
header='// Unchanged r33 validation bodies; isolate them from unrelated legacy physics imports.\nimport {HVP_COAST_REGISTRY_DIGEST} from "../oracle/hvp/hvpCoastSource";\nimport {hvpChunkCoordinates,type HvpChunkPayload} from "../oracle/hestia-prototype/terrain/terrainChunkInput";\nimport {contentRevision} from "../oracle/workers/ids";\n'
port=SPIKE/"src/chunkPayloadPort.ts"
port.write_text(header+body,encoding="utf-8")
write(SPIKE/"port-binding.json",{"original":"workers/hvpChunkJob.ts","originalSha256":sha(worker),
    "bodySha256":hashlib.sha256(body.encode()).hexdigest(),"generatedPort":"src/chunkPayloadPort.ts","generatedSha256":sha(port),
    "lineEndings":"LF normalization of original CRLF text; validation bodies otherwise unchanged",
    "change":"Import-only extraction; exact original payload/buffer validation bodies. Full module's unrelated legacy Rapier0.12 API compile errors preserved in review-fix-build-r01.log."})
# Keep surplus copied legacy type closure as private diagnostic cache, without deleting bytes.
needed={e["path"] for e in copied if not e.get("contractOnly")}
for p in list((SPIKE/"oracle").rglob("*.ts")):
    rel=p.relative_to(SPIKE/"oracle").as_posix()
    if rel not in needed:
        assert sha(p)==sha(source/rel), "Never move changed source"
        destination=(SPIKE/".runtime/legacy-type-closure"/rel).resolve()
        assert destination.is_relative_to(SPIKE.resolve()) and not destination.exists(), "Unsafe cache move"
        destination.parent.mkdir(parents=True,exist_ok=True)
        shutil.move(str(p),str(destination))
write(SPIKE/"source-binding.json", {"classification":"FROZEN_R33_TS_CONTROL","d3InputSha256":"6cda4f268f3442bfc7249768e8ca7798ecf9c9cbe28012f4fae3d95fb3193521",
    "sourceRoot":str(source),"imports":copied,"portsChanged":["src/chunkPayloadPort.ts: import-only extraction of unchanged validation bodies"],"verifier":h,"verificationStdout":result.stdout,
    "producerInventories":{"PLT":len(seal["changedFiles"]),"RT":len(rseal["files"])} })
write(SPIKE/"inputs.json", {"d3":{k:b[k] for k in ["sourceRoot","buildRoot","snapshotRoot","counts","parameters","savedFixture"]},
    "PLTProfile":read(ps/"NumericsProfile.json"),"RTReceipt":read(rs/"receipt.json")})
carrier=pathlib.Path(b["snapshotRoot"])/".devtoolbox/specs/changes/hestia-destruction-program-2026-10-07/tests/D3/normal-pilot-r23/d3-d4-pair-0/candidate.json"
saved=read(carrier)["nativeWake"]["residentEastColdLoad"]["saved"]
assert hashlib.sha256(saved.encode()).hexdigest()=="326b325a7c5f4027316bbe4a9f1f967666e05407620330726d538eb49d9a51a0"
assert json.loads(saved)["player"]["data"]["hestia"]["signature"]=="fnv1a32:a93a402a"
(SPIKE/"fixtures").mkdir(exist_ok=True)
(SPIKE/"fixtures/saved.json").write_bytes(saved.encode())
volume=rt/"spikes/_shared/rt-2026-10-09/v1/voxels/grid-0.125.json"
shutil.copyfile(volume,SPIKE/"fixtures/rt-grid.json")
write(SPIKE/"fixtures/import-binding.json",{"saved":{"carrier":str(carrier),"carrierSha256":sha(carrier),
    "path":"saved.json","sha256":sha(SPIKE/"fixtures/saved.json"),"bytes":len(saved.encode()),"signature":"fnv1a32:a93a402a","extraction":"nativeWake.residentEastColdLoad.saved"},
    "rt":{"original":str(volume),"path":"rt-grid.json","sha256":sha(volume),"bytes":volume.stat().st_size,"provenance":"ANALYTICAL","exterior":"KnownEmpty"},
    "savedPackets":"D3 original 0.5/0.125 packet digests retained in inputs.json; not relabeled as this 32-core extracted chunk",
    "g00FilesVerified":len(gseal["files"])})
print(json.dumps({"status":"PASS","copiedFiles":len(copied),"D3":json.loads(result.stdout),"PLT":len(seal["changedFiles"]),"RT":len(rseal["files"])}))
