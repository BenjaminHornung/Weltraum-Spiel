"""Vendor the exact checksum-bound native geometry dependency for a bounded fix."""
import hashlib
import json
from pathlib import Path, PurePosixPath
import tarfile
import tomllib
ROOT = Path(__file__).resolve().parent.parent
DEST = ROOT / "upstream/parry3d"
assert not DEST.exists()
lock = tomllib.loads((ROOT / "upstream/candidate-rust/Cargo.lock").read_text())
entry = next(row for row in lock["package"] if row["name"] == "parry3d")
assert entry["version"] == "0.31.1"
archives = list((ROOT / ".cargo-home/registry/cache").glob("*/parry3d-0.31.1.crate"))
assert len(archives) == 1
archive = archives[0]
assert hashlib.sha256(archive.read_bytes()).hexdigest() == entry["checksum"]
files = []
with tarfile.open(archive, "r:gz") as bundle:
    for item in bundle:
        if not item.isfile():
            continue
        parts = PurePosixPath(item.name).parts
        assert parts[0] == "parry3d-0.31.1" and ".." not in parts
        assert item.size <= 4 * 1024 * 1024
        relative = PurePosixPath(*parts[1:])
        target = DEST.joinpath(*relative.parts).resolve()
        assert target.is_relative_to(DEST.resolve())
        data = bundle.extractfile(item).read()
        target.parent.mkdir(parents=True, exist_ok=True)
        with target.open("xb") as output:
            output.write(data)
        files.append({"path": "upstream/parry3d/" + str(relative), "sha256": hashlib.sha256(data).hexdigest()})
profile = {"crate": "parry3d", "version": "0.31.1", "source": "https://crates.io/api/v1/crates/parry3d/0.31.1/download",
    "originalArchiveSha256": entry["checksum"], "files": sorted(files, key=lambda row: row["path"])}
with (ROOT / "upstream/parry-provenance.json").open("x", encoding="utf-8") as output:
    json.dump(profile, output, indent=2)
    output.write("\n")
print(json.dumps({"crate": profile["crate"], "version": profile["version"], "archiveSha256": entry["checksum"], "files": len(files)}))
