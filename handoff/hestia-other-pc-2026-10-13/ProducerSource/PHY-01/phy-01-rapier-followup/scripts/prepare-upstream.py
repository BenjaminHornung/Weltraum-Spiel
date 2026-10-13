"""Fetch the exact npm source revision; extract only the native/binding closure."""
import hashlib
import io
import json
from pathlib import Path, PurePosixPath
import urllib.request
import zipfile

PIN = "b716d375efc0201003f0cd9ef7168eee0b62c177"
ROOT = Path(__file__).resolve().parent.parent
assert ROOT.name == "phy-01-rapier-followup" and str(ROOT).startswith("C:\\IFI_SourceCode\\")
DEST = ROOT / "upstream" / "source"
assert not DEST.exists(), "Never overwrite an existing source population"


def fetch(url):
    with urllib.request.urlopen(url, timeout=60) as response:
        assert response.status == 200
        data = response.read(256 * 1024 * 1024 + 1)
    assert len(data) <= 256 * 1024 * 1024
    return data


metadata_bytes = fetch("https://registry.npmjs.org/@dimforge%2Frapier3d-compat/0.21.0")
metadata = json.loads(metadata_bytes)
assert metadata["version"] == "0.21.0" and metadata["gitHead"] == PIN
url = f"https://codeload.github.com/dimforge/rapier/zip/{PIN}"
archive = fetch(url)
cache = ROOT / ".upstream-cache"
cache.mkdir(exist_ok=True)
(cache / f"rapier-{PIN}.zip").write_bytes(archive)
selected = []
with zipfile.ZipFile(io.BytesIO(archive)) as bundle:
    for entry in bundle.infolist():
        if entry.is_dir():
            continue
        relative = PurePosixPath(entry.filename)
        assert relative.parts[0] == f"rapier-{PIN}"
        relative = PurePosixPath(*relative.parts[1:])
        assert not relative.is_absolute() and ".." not in relative.parts
        name = str(relative)
        include = name in {"Cargo.toml", "Cargo.lock", "README.md", "LICENSE"} or name.startswith((
            "src/", "crates/rapier3d/", "bindings/typescript/src/", "bindings/typescript/src.ts/",
            "bindings/typescript/builds/prepare_builds/templates/")) or name in {
                "bindings/typescript/Cargo.lock", "bindings/typescript/Cargo.toml"}
        if not include:
            continue
        assert entry.file_size <= 4 * 1024 * 1024
        assert (entry.external_attr >> 16) & 0o170000 != 0o120000, "No symlinks"
        data = bundle.read(entry)
        target = DEST.joinpath(*relative.parts).resolve()
        assert target.is_relative_to(DEST.resolve())
        target.parent.mkdir(parents=True, exist_ok=True)
        with target.open("xb") as output:
            output.write(data)
        selected.append({"path": name, "bytes": len(data), "sha256": hashlib.sha256(data).hexdigest()})
assert any(row["path"] == "bindings/typescript/src/geometry/broad_phase.rs" for row in selected)
provenance = {"package": metadata["name"], "version": metadata["version"], "gitHead": PIN,
    "npmIntegrity": metadata["dist"]["integrity"], "archiveUrl": url,
    "archiveBytes": len(archive), "archiveSha256": hashlib.sha256(archive).hexdigest(),
    "npmMetadataSha256": hashlib.sha256(metadata_bytes).hexdigest(), "files": sorted(selected, key=lambda row: row["path"])}
with (ROOT / "upstream" / "source-provenance.json").open("x", encoding="utf-8") as output:
    json.dump(provenance, output, indent=2)
    output.write("\n")
with (ROOT / "upstream" / "npm-0.21.0.json").open("xb") as output:
    output.write(metadata_bytes)
print(json.dumps({key: value for key, value in provenance.items() if key != "files"}))
print(f"Extracted {len(selected)} pinned source files")
