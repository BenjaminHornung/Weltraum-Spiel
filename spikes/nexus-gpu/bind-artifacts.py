"""Bind the shader build script outputs from this Cargo invocation and the Web module they produced."""
import hashlib
import json
from pathlib import Path
import shutil
import sys


def bind(directory):
    web = directory / "web"
    wasm = web / "nexus_bg.wasm"
    binary = wasm.read_bytes()
    if binary[:8] != b"\x00asm\x01\x00\x00\x00" or not (web / "nexus.js").stat().st_size:
        raise ValueError("Missing browser module or invalid WASM header")
    outputs = {}
    for line in (directory / "cargo-build.jsonl").read_text().splitlines():
        event = json.loads(line)
        if event.get("reason") != "build-script-executed":
            continue
        src = Path(event["out_dir"]) / "shaders-spirv"
        if not src.is_dir():
            continue
        # Cargo's local package IDs have either '#version' or '#name@version'.
        package = event["package_id"].split("#")[0].rstrip("/").split("/")[-1]
        if package.startswith("vortx-"):
            package = "vortx"
        if package in ("nexus_rbd3d", "vortx"):
            outputs[package] = src
    if set(outputs) != {"nexus_rbd3d", "vortx"}:
        raise ValueError(f"Missing shader build outputs: {set(outputs)}")

    def record(path):
        return {"path": path.relative_to(web).as_posix(), "bytes": path.stat().st_size,
                "sha256": hashlib.sha256(path.read_bytes()).hexdigest()}

    shaders = []
    for package, src in sorted(outputs.items()):
        files = sorted(src.rglob("*.spv"))
        if not files:
            raise ValueError(f"No SPIR-V from {package}")
        for path in files:
            data = path.read_bytes()
            if len(data) < 20 or len(data) % 4 or data[:4] != bytes.fromhex("03022307") or data not in binary:
                raise ValueError(f"Invalid or unembedded shader: {path.name}")
            dest = web / "shaders" / package / path.relative_to(src)
            dest.parent.mkdir(parents=True, exist_ok=True)
            shutil.copyfile(path, dest)
            shaders.append(record(dest))
    manifest = {"status": "PASS", "phase": "compiled-web-artifacts", "gpuDispatchMeasured": False,
                "module": record(web / "nexus.js"), "wasm": record(wasm), "shaders": shaders}
    (web / "bindings.json").write_text(json.dumps(manifest, indent=2) + "\n")
    return manifest


if __name__ == "__main__":
    result = bind(Path(sys.argv[1]))
    print(f"Bound {len(result['shaders'])} embedded shaders and {result['wasm']['bytes']} WASM bytes.")
