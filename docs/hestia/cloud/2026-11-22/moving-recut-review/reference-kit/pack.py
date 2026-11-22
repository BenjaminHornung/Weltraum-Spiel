"""After npm ci and npm run build, package the dist and the checked-in browser probes."""
import hashlib
import json
from pathlib import Path
import subprocess
import sys
from zipfile import ZIP_DEFLATED, ZipFile

here = Path(__file__).resolve().parent
repo = Path(subprocess.check_output(["git", "-C", str(here), "rev-parse", "--show-toplevel"], text=True).strip())
app = repo / "apps/weltraum-browser"
output = Path(sys.argv[1]).resolve()
probe_names = ["cut-work.mjs", "cut-browser-trace.mjs", "cut-publication.mjs",
               "physics-placement-player.mjs", "cut-moving-player.mjs", "cut-moving-thread-cpu.mjs"]
files = {}
for relative in ["dist", "node_modules/playwright", "node_modules/playwright-core"]:
    directory = app / relative
    if not directory.is_dir():
        raise SystemExit(f"Missing {directory}")
    for source in sorted(directory.rglob("*")):
        if source.is_file():
            files[source.relative_to(app).as_posix()] = source
if "dist/index.html" not in files or not any(name.startswith("dist/assets/physicsWorker-") and name.endswith(".js") for name in files):
    raise SystemExit("Missing production build")
for name in probe_names:
    files["probe/" + name] = app / "tests/performance" / name

def ref(name):
    return subprocess.check_output(["git", "-C", str(repo), "rev-parse", name], text=True).strip()

manifest = {
    "repository": "BenjaminHornung/Weltraum-Spiel",
    "commit": ref("HEAD"),
    "tree": ref("HEAD^{tree}"),
    "playwright": json.loads((app / "node_modules/playwright/package.json").read_text())["version"],
    "files": {name: hashlib.sha256(source.read_bytes()).hexdigest() for name, source in files.items()},
}
with ZipFile(output, "x", ZIP_DEFLATED, compresslevel=5) as archive:
    for name, source in files.items():
        archive.write(source, "Hestia-Referenzlauf/" + name)
    for name in ["run.mjs", "Messen.cmd", "LIESMICH.md"]:
        archive.write(here / name, "Hestia-Referenzlauf/" + name)
    archive.writestr("Hestia-Referenzlauf/manifest.json", json.dumps(manifest, ensure_ascii=False, indent=2) + "\n")
with ZipFile(output) as archive:
    if (bad := archive.testzip()) is not None:
        raise SystemExit(f"Archive check failed on {bad}")
print(hashlib.sha256(output.read_bytes()).hexdigest(), output)
