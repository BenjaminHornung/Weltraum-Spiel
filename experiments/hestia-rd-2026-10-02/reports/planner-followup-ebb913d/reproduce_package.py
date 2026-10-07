"""Verify the pinned original ZIP before fresh regular-directory extraction."""
import hashlib
import json
import pathlib
import stat
import sys
import zipfile

ZIP_SHA = "87cddafc768dd24bbde7bf5a260dfeb1d184d66d600e967f09a22971034e4a4a"
MANIFEST_SHA = "254a797d75646c8f390832483dfabb05bb291c0bd84ace1c33e55f5156ddc170"


def reproduce(archive, destination):
    assert archive.stat().st_size == 68078891, "Original ZIP length differs"
    actual = hashlib.file_digest(archive.open("rb"), "sha256").hexdigest()
    assert actual == ZIP_SHA, "Original ZIP hash differs"
    assert not destination.exists(), "Preserve prior extraction; choose a new destination"
    with zipfile.ZipFile(archive) as package:
        names = set()
        members = package.infolist()
        for entry in members:
            name = entry.filename
            path = pathlib.PurePosixPath(name)
            assert name and "\\" not in name and not path.is_absolute(), name
            assert all(p not in (".", "..") and ":" not in p and p.rstrip(" .") == p
                       for p in path.parts), name
            assert not stat.S_ISLNK(entry.external_attr >> 16), name
            assert name.casefold() not in names, "Case-insensitive member collision"
            names.add(name.casefold())
            assert destination.resolve() in (destination / name).resolve().parents, name
        manifest = package.read("MANIFEST.json")
        assert hashlib.sha256(manifest).hexdigest() == MANIFEST_SHA, "Manifest hash differs"
        assert package.testzip() is None, "ZIP CRC failure"
        destination.mkdir(parents=True)
        package.extractall(destination)
    return {"archiveSha256": actual, "archiveBytes": archive.stat().st_size,
            "manifestSha256": MANIFEST_SHA, "members": len(members),
            "safePaths": True, "crc": "PASS", "freshRegularDirectory": str(destination),
            "productIntegrated": False}


if __name__ == "__main__":
    result = reproduce(pathlib.Path(sys.argv[1]), pathlib.Path(sys.argv[2]))
    pathlib.Path(sys.argv[3]).write_text(json.dumps(result, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(result))
