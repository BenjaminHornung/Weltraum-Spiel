"""Package the visible review, source, original task and raw evidence for a planner."""
import argparse
import hashlib
import json
from pathlib import Path
import zipfile

from .review_demo import RESEARCH

DEMO = RESEARCH / "PLANNER_REVIEW_2026-10-04"
ORIGINAL = Path("C:/IFI_SourceCode/Temp/Hestia-Agent3-Input-2026-10-02/Hestia_Agent3_AssetCompiler_2026-10-02")


def payload():
    files = {}
    required = [DEMO / "index.html", DEMO / "standard.html", DEMO / "rotation.html",
                DEMO / "REVIEW_FOR_PLANNER.md", DEMO / "VISUAL_VERIFICATION.json",
                ORIGINAL / "PACKAGE_MANIFEST.json"]
    required += [DEMO / "screenshots" / name for name in
                 ("01-micro.png", "02-standard.png", "03-rotation-boundary.png", "04-micro-mobile.png")]
    if not all(path.is_file() for path in required):
        raise ValueError("review payload incomplete; collect actual evidence first")

    def include(root, prefix, extensions=None):
        for path in sorted(root.rglob("*")):
            if path.is_file() and "__pycache__" not in path.parts:
                if extensions is None or path.suffix in extensions:
                    files[prefix + path.relative_to(root).as_posix()] = path.read_bytes()

    include(DEMO, "demo/")
    for path in sorted(RESEARCH.iterdir()):
        if path.is_file() and path.suffix in {".md", ".json", ".log", ".py"}:
            files["evidence/" + path.name] = path.read_bytes()
    include(RESEARCH / "BLENDER_E2E_INPUTS", "evidence/BLENDER_E2E_INPUTS/")
    include(Path("tools/hestia_asset_compiler"), "source/tools/hestia_asset_compiler/", {".py", ".json"})
    include(Path("tools/blender"), "source/tools/blender/", {".py", ".json"})
    include(RESEARCH / "BLENDER_E2E_INPUTS", "source/" + RESEARCH.as_posix() + "/BLENDER_E2E_INPUTS/")
    for name in ("schemas/hestia-asset-authoring-v1.schema.json",
                 "docs/tools/hestia-asset-authoring-contract-v1.md",
                 "docs/tools/blender-hestia-asset-authoring-exporter-v1.md",
                 "docs/architecture/voxel-asset-authoring-and-compilation.md"):
        files["source/" + name] = Path(name).read_bytes()
    include(ORIGINAL, "original-task/", {".md", ".json"})
    files["REVIEW_FOR_PLANNER.md"] = (DEMO / "REVIEW_FOR_PLANNER.md").read_bytes()
    files["README.txt"] = b"Start: demo/index.html. Planner brief: REVIEW_FOR_PLANNER.md. Raw metrics: evidence/. Reproduction source checkout: source/. Original authorized task: original-task/. PRODUCT_INTEGRATED=NO.\n"
    return files


def bundle(output):
    files = payload()
    manifest = [{"path": name, "bytes": len(raw), "sha256": hashlib.sha256(raw).hexdigest()}
                for name, raw in sorted(files.items())]
    files["PACKAGE_MANIFEST.json"] = json.dumps({"schema": "hestia.planner-review-bundle.v1", "files": manifest}, sort_keys=True, indent=2).encode() + b"\n"
    with zipfile.ZipFile(output, "x", compression=zipfile.ZIP_DEFLATED) as archive:
        for name, raw in sorted(files.items()):
            info = zipfile.ZipInfo(name, date_time=(2026, 10, 4, 0, 0, 0))
            info.compress_type = zipfile.ZIP_DEFLATED
            archive.writestr(info, raw)
    with zipfile.ZipFile(output) as archive:
        if archive.testzip() is not None:
            raise ValueError("archive CRC failure")
        for entry in manifest:
            raw = archive.read(entry["path"])
            if len(raw) != entry["bytes"] or hashlib.sha256(raw).hexdigest() != entry["sha256"]:
                raise ValueError("archive manifest mismatch")
    print(json.dumps({"status": "PASS", "payloadFiles": len(manifest), "bytes": output.stat().st_size,
                      "sha256": hashlib.sha256(output.read_bytes()).hexdigest(), "path": str(output)}))


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path, required=True)
    bundle(parser.parse_args().output)
