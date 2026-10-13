"""Extract official SDK import libraries only; never run an installer."""
import base64
import hashlib
import io
import json
import sys
from pathlib import Path, PurePosixPath
import urllib.request
import zipfile

ROOT = Path(__file__).resolve().parent.parent
mode = sys.argv[1] if len(sys.argv) == 2 else "base"
assert mode in {"base", "onecore"}
DEST = ROOT / ".native-toolchain-0.2.129" / ("sdk-required" if mode == "base" else "sdk-onecore")
assert not DEST.exists()
NAME, VERSION = "microsoft.windows.sdk.cpp.x64", "10.0.28000.2705"
required = {"onecore.lib"} if mode == "onecore" else {
    "kernel32.lib", "ntdll.lib", "userenv.lib", "ws2_32.lib", "dbghelp.lib", "ucrt.lib"}


def fetch(url):
    assert url.startswith("https://api.nuget.org/")
    with urllib.request.urlopen(url, timeout=60) as response:
        result = response.read(128 * 1024 * 1024 + 1)
    assert len(result) <= 128 * 1024 * 1024
    return result


registration = json.loads(fetch(f"https://api.nuget.org/v3/registration5-semver1/{NAME}/{VERSION}.json"))
catalog = json.loads(fetch(registration["catalogEntry"]))
assert catalog["id"].lower() == NAME and catalog["version"] == VERSION
archive = fetch(registration["packageContent"])
assert catalog["packageHashAlgorithm"] == "SHA512"
assert base64.b64encode(hashlib.sha512(archive).digest()).decode() == catalog["packageHash"]
files = []
with zipfile.ZipFile(io.BytesIO(archive)) as bundle:
    for entry in bundle.infolist():
        parts = PurePosixPath(entry.filename)
        assert not parts.is_absolute() and ".." not in parts.parts
        if entry.is_dir() or parts.name.lower() not in required:
            continue
        assert entry.file_size <= (192 if mode == "onecore" else 16) * 1024 * 1024
        data = bundle.read(entry)
        target = DEST.joinpath(*parts.parts).resolve()
        assert target.is_relative_to(DEST.resolve())
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(data)
        files.append({"path": str(target.relative_to(ROOT)).replace("\\", "/"), "sha256": hashlib.sha256(data).hexdigest()})
assert required <= {Path(row["path"]).name.lower() for row in files}
profile = {"id": NAME, "version": VERSION, "url": registration["packageContent"],
    "archiveSha256": hashlib.sha256(archive).hexdigest(), "trustedCatalogSha512": catalog["packageHash"],
    "archiveBytes": len(archive), "files": files}
profile_name = "msvc-sdk-onecore.json" if mode == "onecore" else "msvc-sdk-libs.json"
with (ROOT / "upstream" / profile_name).open("x", encoding="utf-8") as output:
    json.dump(profile, output, indent=2)
    output.write("\n")
print(json.dumps({key: value for key, value in profile.items() if key != "files"}))
print(f"Extracted {len(files)} import libraries")
