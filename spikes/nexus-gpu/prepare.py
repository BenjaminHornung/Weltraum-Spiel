"""Materialize immutable sources for the Linux PHY-04 build in a separate directory."""
import argparse
import hashlib
import io
import json
import os
from pathlib import Path
import subprocess
import tarfile
import tempfile

HERE = Path(__file__).resolve().parent
BINDINGS = HERE / "SourceBindings.json"


def git(repo, *args):
    return subprocess.check_output(["git", "-C", repo, *args])


def bind_tree(output, repo, pin):
    commit = pin["commit"]
    actual = git(repo, "rev-parse", commit + "^{tree}").decode().strip()
    if actual != pin["tree"]:
        raise ValueError(f"tree mismatch for {repo}: {actual}")
    entries = {}
    for row in git(repo, "ls-tree", "-rz", commit).split(b"\0"):
        if row:
            meta, path = row.split(b"\t", 1)
            mode, kind, blob = meta.decode().split()
            if mode not in ("100644", "100755") or kind != "blob":
                raise ValueError(f"unsupported source type {meta!r}")
            entries[os.fsdecode(path)] = (mode, blob)
    if not output.exists():
        output.parent.mkdir(parents=True, exist_ok=True)
        with tempfile.TemporaryDirectory(dir=output.parent) as temp:
            stage = Path(temp) / "tree"
            stage.mkdir()
            with tarfile.open(fileobj=io.BytesIO(git(repo, "archive", commit))) as archive:
                archive.extractall(stage, filter="data")
            verify_files(stage, entries)
            stage.rename(output)
    else:
        verify_files(output, entries)
    return len(entries)


def verify_files(root, entries):
    seen = set()
    for path in root.rglob("*"):
        name = path.relative_to(root).as_posix()
        if path.is_symlink():
            raise ValueError(f"unexpected source symlink: {name}")
        if path.is_dir():
            continue
        if name not in entries:
            raise ValueError(f"unbound source file: {name}")
        mode, expected = entries[name]
        data = path.read_bytes()
        blob = hashlib.sha1(b"blob " + str(len(data)).encode() + b"\0" + data).hexdigest()
        if blob != expected or bool(path.stat().st_mode & 0o111) != (mode == "100755"):
            raise ValueError(f"modified upstream input: {name}")
        seen.add(name)
    if seen != entries.keys():
        raise ValueError(f"missing source files: {sorted(entries.keys() - seen)[:3]}")


def prepare(build, cache):
    pins = json.loads(BINDINGS.read_text())
    build.mkdir(parents=True, exist_ok=True)
    counts = {}
    for name, pin in pins["upstream"].items():
        if cache:
            repo = cache / name
        else:
            repo = build / "git" / name
            if not repo.exists():
                repo.parent.mkdir(parents=True, exist_ok=True)
                subprocess.run(["git", "init", "--bare", "-q", repo], check=True)
            if subprocess.run(["git", "-C", repo, "cat-file", "-e", pin["commit"]], capture_output=True).returncode:
                git(repo, "fetch", "--depth=1", pin["url"], pin["commit"])
        target = build / "upstream/source" / (name + "-" + pin["commit"])
        counts[name] = bind_tree(target, repo, pin)
    source = HERE.parents[1] / pins["harness"]
    for name, expected in pins["harnessSha256"].items():
        data = (source / name).read_bytes()
        if hashlib.sha256(data).hexdigest() != expected:
            raise ValueError(f"harness hash mismatch: {name}")
        target = build / "harness" / name
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(data)
    patch = HERE / "browser-target.patch"
    overlay = pins["browserOverlay"]
    if hashlib.sha256(patch.read_bytes()).hexdigest() != overlay["patchSha256"]:
        raise ValueError("browser overlay hash mismatch")
    subprocess.run(["git", "apply", "--no-index", patch], cwd=build / "harness", check=True)
    for name, expected in overlay["harnessSha256"].items():
        if hashlib.sha256((build / "harness" / name).read_bytes()).hexdigest() != expected:
            raise ValueError(f"patched browser harness mismatch: {name}")
    return {"schema": pins["schema"], "gitBlobsVerified": counts, "browserOverlay": overlay,
            "harnessSha256": pins["harnessSha256"], "upstream": pins["upstream"]}


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("directory", type=Path)
    parser.add_argument("--git-cache", type=Path, help="Read verified Git objects from existing nexus/khal/vortx clones")
    args = parser.parse_args()
    print(json.dumps(prepare(args.directory.resolve(), args.git_cache), indent=2))
