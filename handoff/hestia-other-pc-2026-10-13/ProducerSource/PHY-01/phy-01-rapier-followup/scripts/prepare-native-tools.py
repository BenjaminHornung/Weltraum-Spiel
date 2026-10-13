"""Prepare an isolated WASM sysroot and a pinned public bindgen CLI."""
import hashlib
import io
import json
from pathlib import Path, PurePosixPath
import tarfile
import tomllib
import urllib.request

ROOT = Path(__file__).resolve().parent.parent
assert str(ROOT).startswith("C:\\IFI_SourceCode\\")
DEST = ROOT / ".native-toolchain-0.2.129"
assert not DEST.exists(), "Do not overwrite an existing toolchain"
INSTALLED = Path(r"C:\IFI_SourceCode\Utils\Rust\rustup-home\toolchains\stable-x86_64-pc-windows-msvc")
manifest_path = INSTALLED / "lib/rustlib/multirust-channel-manifest.toml"
manifest_bytes = manifest_path.read_bytes()
manifest = tomllib.loads(manifest_bytes.decode())
std = manifest["pkg"]["rust-std"]["target"]["wasm32-unknown-unknown"]
assert manifest["date"] == "2026-07-16"
assert std["available"] and "rust-std-1.97.1-wasm32-unknown-unknown" in std["url"]


def fetch(url):
    request = urllib.request.Request(url, headers={"User-Agent": "PHY01-bound-native-build"})
    with urllib.request.urlopen(request, timeout=60) as response:
        data = response.read(128 * 1024 * 1024 + 1)
    assert len(data) <= 128 * 1024 * 1024
    return data


std_bytes = fetch(std["url"])
assert hashlib.sha256(std_bytes).hexdigest() == std["hash"]
DEST.mkdir()
with tarfile.open(fileobj=io.BytesIO(std_bytes), mode="r:gz") as archive:
    count = 0
    for entry in archive:
        if not entry.isfile():
            continue
        parts = PurePosixPath(entry.name).parts
        assert ".." not in parts and not PurePosixPath(entry.name).is_absolute()
        if "lib" not in parts:
            continue
        relative = PurePosixPath(*parts[parts.index("lib"):])
        if not str(relative).startswith("lib/rustlib/wasm32-unknown-unknown/"):
            continue
        target = (DEST / "sysroot").joinpath(*relative.parts).resolve()
        assert target.is_relative_to(DEST.resolve())
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(archive.extractfile(entry).read())
        count += 1
assert count > 10

version = "0.2.129"
release = json.loads(fetch(f"https://api.github.com/repos/wasm-bindgen/wasm-bindgen/releases/tags/{version}"))
asset = next(item for item in release["assets"] if item["name"] == f"wasm-bindgen-{version}-x86_64-pc-windows-msvc.tar.gz")
bindgen_bytes = fetch(asset["browser_download_url"])
bindgen_sha = hashlib.sha256(bindgen_bytes).hexdigest()
if asset.get("digest"):
    assert asset["digest"] == "sha256:" + bindgen_sha
with tarfile.open(fileobj=io.BytesIO(bindgen_bytes), mode="r:gz") as archive:
    cli = next(entry for entry in archive if entry.isfile() and PurePosixPath(entry.name).name == "wasm-bindgen.exe")
    (DEST / "wasm-bindgen.exe").write_bytes(archive.extractfile(cli).read())
provenance = {"rustVersion": "1.97.1", "installedRustRoot": str(INSTALLED),
    "installedManifestSha256": hashlib.sha256(manifest_bytes).hexdigest(),
    "wasmStd": {"url": std["url"], "archiveSha256": std["hash"], "files": count},
    "bindgen": {"version": version, "url": asset["browser_download_url"], "archiveSha256": bindgen_sha,
        "releaseAssetDigest": asset.get("digest"), "binarySha256": hashlib.sha256((DEST / "wasm-bindgen.exe").read_bytes()).hexdigest()},
    "executables": [{"path": str(INSTALLED / "bin" / name),
        "sha256": hashlib.sha256((INSTALLED / "bin" / name).read_bytes()).hexdigest()} for name in ("rustc.exe", "cargo.exe")]}
with (ROOT / "upstream/native-toolchain-0.2.129.json").open("x", encoding="utf-8") as output:
    json.dump(provenance, output, indent=2)
    output.write("\n")
print(json.dumps(provenance))
