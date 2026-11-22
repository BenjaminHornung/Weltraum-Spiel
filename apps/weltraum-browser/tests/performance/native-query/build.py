"""Build an isolated R05 control or a patched R05 query projection. No product files are written."""
import argparse
import base64
import hashlib
import json
import os
import shutil
import subprocess
from pathlib import Path

HERE = Path(__file__).resolve().parent
APP = HERE.parents[2]
ROOT = APP.parents[1]
VENDOR = APP / "vendor/rapier-phy01-positive-margin-r05"
EXPORT = (ROOT / "handoff/hestia-other-pc-2026-10-13/ProducerSource/PHY-01/phy-01-rapier-followup"
          / "revisions/positive-margin-safe-compile-closure-r03/candidate")
PINNED = {
    "source/src/geometry/broad_phase_bvh/mod.rs": "cdc9b6a89a3e521622f9e7181138b7c19cbfdbda7755c780d07e2050794b1259",
    "source/bindings/typescript/src/geometry/broad_phase.rs": "2097c3892d0d03a24353581e3b645938a11088507d05d8d0f1742868e445210f",
}


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def source_tree(path):
    files = sorted(f for f in path.rglob("*") if f.is_file())
    return {f.relative_to(path).as_posix(): digest(f) for f in files}


def tree_digest(files):
    rows = "\n".join(name + " " + sha for name, sha in sorted(files.items()))
    return hashlib.sha256(rows.encode("utf8")).hexdigest()


def invoke(*args, **kwargs):
    subprocess.run(args, check=True, **kwargs)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("workspace", type=Path, help="External, initially empty qualification directory")
    parser.add_argument("variant", choices=["control", "candidate"])
    parser.add_argument("--prepare-only", action="store_true")
    args = parser.parse_args()
    workspace = args.workspace.resolve()
    if workspace == ROOT or ROOT in workspace.parents:
        raise ValueError("Choose a directory outside the product checkout")
    source = workspace / "source"
    profile = json.loads((VENDOR / "profile.json").read_text())
    pinned = {**PINNED, "candidate-rust/Cargo.lock": profile["cargoLockSha256"]}
    for relative, expected in pinned.items():
        if digest(EXPORT / relative) != expected:
            raise ValueError(f"Historical native input changed: {relative}")
    workspace.mkdir(parents=True, exist_ok=True)
    origins = workspace / "native-source-origin"
    if not source.exists():
        shutil.copytree(EXPORT, source)
        origins.write_text(str(EXPORT))
    elif not origins.exists() or origins.read_text() != str(EXPORT):
        raise ValueError("Existing work directory belongs to another export")
    patch = HERE / "query-copy.patch"
    marker = workspace / "applied-query-patch"
    if args.variant == "candidate" and not marker.exists():
        invoke("git", "apply", "--check", str(patch), cwd=source)
        invoke("git", "apply", str(patch), cwd=source)
        marker.write_text(digest(patch))
    if args.variant == "control" and marker.exists():
        if marker.read_text() != digest(patch):
            raise ValueError("Candidate patch changed since preparation")
        invoke("git", "apply", "-R", str(patch), cwd=source)
        marker.unlink()
    if marker.exists() and marker.read_text() != digest(patch):
        raise ValueError("Prepared patch and requested patch differ")
    original, current = source_tree(EXPORT), source_tree(source)
    changed = {name for name in original.keys() | current.keys() if original.get(name) != current.get(name)}
    if changed != (set(PINNED) if args.variant == "candidate" else set()):
        raise ValueError(f"Unexpected native source changes: {sorted(changed)}")
    if args.prepare_only:
        return
    if digest(source / "candidate-rust/Cargo.lock") != pinned["candidate-rust/Cargo.lock"]:
        raise ValueError("Local Cargo.lock changed")
    if subprocess.check_output(["wasm-bindgen","--version"], text=True).strip() != "wasm-bindgen 0.2.129":
        raise ValueError("Pinned WASM glue generator is wasm-bindgen 0.2.129")
    target = workspace / "target"
    invoke("cargo", "build", "--locked", "--release", "--target", "wasm32-unknown-unknown", "--jobs", "1",
           "--manifest-path", str(source / "candidate-rust/Cargo.toml"), env={**os.environ, "CARGO_TARGET_DIR": str(target)})
    compiled = target / "wasm32-unknown-unknown/release/rapier_wasm3d.wasm"
    generated = workspace / args.variant / "bindgen"
    generated.mkdir(parents=True, exist_ok=True)
    invoke("wasm-bindgen", str(compiled), "--target", "web", "--out-dir", str(generated), "--out-name", "rapier_wasm3d")
    wrapper = workspace / args.variant / "api"
    shutil.copytree(VENDOR / "dist/src", wrapper, dirs_exist_ok=True)
    for file in generated.glob("rapier_wasm3d*"):
        shutil.copyfile(file, wrapper / file.name)
    wasm = wrapper / "rapier_wasm3d_bg.wasm"
    (wrapper / "wasmBytes.js").write_text('export const wasmBase64 = "' + base64.b64encode(wasm.read_bytes()).decode() + '";\n')
    receipt = {"variant":args.variant, "pinnedProductWasmSha256":profile["wasmSha256"], "wasmSha256":digest(wasm),
          "wasmBindgenJsSha256":digest(wrapper/"rapier_wasm3d.js"), "rawWasmSha256":digest(compiled),
          "sourceFileCount":len(current), "exportTreeSha256":tree_digest(original),"compiledTreeSha256":tree_digest(current),
          "sourceFiles":{k:digest(source/k) for k in pinned}, "patchSha256":digest(patch) if marker.exists() else None,
          "rustc":subprocess.check_output(["rustc","--version"],text=True).strip(), "adapter":str(wrapper)}
    (wrapper.parent / "build.json").write_text(json.dumps(receipt,indent=2)+"\n")
    print(json.dumps(receipt))


if __name__ == "__main__":
    main()
