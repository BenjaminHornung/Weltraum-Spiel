"""Verify installed compiler bytes against integrity-pinned npm archives; never execute package code."""
import base64
import hashlib
import json
import pathlib
import sys
import tarfile
import urllib.request

root = pathlib.Path(__file__).resolve().parents[1]
lock = json.loads((root / "package-lock.json").read_text(encoding="utf-8"))
cache = root / ".runtime" / "tool-provenance"
cache.mkdir(parents=True, exist_ok=True)
records = []
archives = []
for package in ("typescript", "@typescript/typescript-win32-x64"):
    entry = lock["packages"]["node_modules/" + package]
    if entry["version"] != "7.0.2" or entry["license"] != "Apache-2.0":
        raise ValueError("COMPILER_PIN")
    data_path = cache / (package.replace("/", "_").replace("@", "") + "-7.0.2.tgz")
    if not data_path.exists():
        with urllib.request.urlopen(entry["resolved"], timeout=30) as response:
            data = response.read()
        data_path.write_bytes(data)
    data = data_path.read_bytes()
    integrity = "sha512-" + base64.b64encode(hashlib.sha512(data).digest()).decode("ascii")
    if integrity != entry["integrity"]:
        raise ValueError("ARCHIVE_INTEGRITY_DRIFT:" + package)
    archives.append({"package": package, "version": "7.0.2", "url": entry["resolved"], "integrity": integrity,
                     "bytes": len(data), "sha256": hashlib.sha256(data).hexdigest()})
    with tarfile.open(data_path, "r:gz") as archive:
        for member in archive.getmembers():
            name = pathlib.PurePosixPath(member.name)
            if not name.parts or name.parts[0] != "package" or ".." in name.parts or name.is_absolute():
                raise ValueError("UNSAFE_ARCHIVE_MEMBER")
            if member.isdir():
                continue
            if not member.isfile():
                raise ValueError("NON_REGULAR_ARCHIVE_MEMBER")
            relative = pathlib.PurePosixPath("node_modules", package, *name.parts[1:])
            installed = root.joinpath(*relative.parts)
            if installed.is_symlink() or not installed.is_file():
                raise ValueError("MISSING_INSTALLED_MEMBER:" + str(relative))
            expected = archive.extractfile(member).read()
            if installed.read_bytes() != expected:
                raise ValueError("INSTALLED_COMPILER_DRIFT:" + str(relative))
            records.append({"path": str(relative), "bytes": len(expected), "sha256": hashlib.sha256(expected).hexdigest()})

node_path = pathlib.Path("C:/IFI_SourceCode/Utils/npm-tmp/opencode/node-v22.23.2-win-x64/node.exe")
node_data = node_path.read_bytes()
output = {"schema": "fluid-tool-bindings/v1", "nodeVersion": "v22.23.2",
          "node": {"path": str(node_path), "bytes": len(node_data), "sha256": hashlib.sha256(node_data).hexdigest()},
          "compilerMembers": sorted(records, key=lambda item: item["path"]), "npmArchives": archives,
          "verification": "Every installed compiler package file equals the decoded integrity-pinned official npm archive member; performed before the repaired compiler execution.",
          "pythonVersion": sys.version.split()[0]}
destination = root / "ToolBindings.json"
text = json.dumps(output, ensure_ascii=False, indent=2) + "\n"
if destination.exists():
    if destination.read_text(encoding="utf-8") != text:
        raise ValueError("FROZEN_TOOL_BINDING_EXISTS_WITH_DIFFERENT_BYTES")
else:
    destination.write_text(text, encoding="utf-8")
print(json.dumps({"status": "PASS", "compilerMembers": len(records), "archives": len(archives), "python": output["pythonVersion"]}))
