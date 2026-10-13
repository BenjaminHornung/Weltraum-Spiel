"""Install only pinned wasm std data into this spike's private sysroot."""
import hashlib, json, pathlib, shutil, subprocess, tarfile, tomllib, urllib.request
root = pathlib.Path(__file__).resolve().parents[1]
toolchain = pathlib.Path("C:/IFI_SourceCode/Utils/Rust/rustup-home/toolchains/stable-x86_64-pc-windows-msvc")
manifest = tomllib.loads((toolchain/"lib/rustlib/multirust-channel-manifest.toml").read_text())
target = manifest["pkg"]["rust-std"]["target"]["wasm32-unknown-unknown"]
archive = root/".runtime/rust-std.tar.xz"
archive.parent.mkdir(parents=True,exist_ok=True)
if not archive.exists():
    with urllib.request.urlopen(target["xz_url"], timeout=60) as response, archive.open("wb") as output:
        shutil.copyfileobj(response,output)
assert hashlib.sha256(archive.read_bytes()).hexdigest()==target["xz_hash"], "Rust target archive digest mismatch"
sysroot=root/".runtime/sysroot"
with tarfile.open(archive) as bundle:
    for member in bundle.getmembers():
        marker="/rust-std-wasm32-unknown-unknown/"
        if member.isfile() and marker in member.name:
            rel=member.name.split(marker,1)[1]
            assert not pathlib.PurePosixPath(rel).is_absolute() and ".." not in pathlib.PurePosixPath(rel).parts
            destination=sysroot/rel
            destination.parent.mkdir(parents=True,exist_ok=True)
            with bundle.extractfile(member) as data, destination.open("wb") as output: shutil.copyfileobj(data,output)
binding={"compilerVersion":"rustc 1.97.1 (8bab26f4f 2026-07-14)","target":"wasm32-unknown-unknown","url":target["xz_url"],
    "archiveSha256":target["xz_hash"],"toolchain":str(toolchain),"sysroot":".runtime/sysroot",
    "files":[{"path":p.relative_to(sysroot).as_posix(),"sha256":hashlib.sha256(p.read_bytes()).hexdigest(),"bytes":p.stat().st_size} for p in sorted(sysroot.rglob("*")) if p.is_file()]}
assert subprocess.check_output([str(toolchain/"bin/rustc.exe"),"--version"],text=True).strip()==binding["compilerVersion"]
binding["executables"]=[]
for p in [toolchain/"bin/rustc.exe",toolchain/"lib/rustlib/x86_64-pc-windows-msvc/bin/rust-lld.exe",
    pathlib.Path("C:/IFI_SourceCode/Utils/npm-tmp/opencode/node-v22.23.2-win-x64/node.exe"),pathlib.Path("C:/IFI_SourceCode/Utils/Python/cpython-3.12.13-windows-x86_64-none/python.exe")]:
    binding["executables"].append({"path":str(p),"bytes":p.stat().st_size,"sha256":hashlib.sha256(p.read_bytes()).hexdigest()})
binding["licenses"]=[]
with tarfile.open(archive) as bundle:
    for member in bundle.getmembers():
        name=pathlib.PurePosixPath(member.name).name
        if member.isfile() and name in ["LICENSE-APACHE","LICENSE-MIT","COPYRIGHT"]:
            destination=root/"licenses"/name
            destination.parent.mkdir(exist_ok=True)
            destination.write_bytes(bundle.extractfile(member).read())
            binding["licenses"].append({"path":"licenses/"+name,"bytes":destination.stat().st_size,"sha256":hashlib.sha256(destination.read_bytes()).hexdigest()})
(root/"toolchain-binding.json").write_text(json.dumps(binding,indent=2)+"\n",encoding="utf-8")
print(json.dumps({"status":"PASS","targetFiles":len(binding["files"])}))
