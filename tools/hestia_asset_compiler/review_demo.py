"""Build a dependency-free visual review of real compiler packages (not gameplay)."""
import argparse
import html
import json
import math
from pathlib import Path

from .geometry import canonicalize_geometry
from .glb import load_glb
from .package import compile_to_directory, verify_package
from .errors import CompilerError

RESEARCH = Path("docs/research/hestia-asset-compiler-spike-2026-10-02")
PROFILES = ("micro-0125-research-v1", "standard-025-v1")


def decoded_cells(directory, manifest):
    cells = set()
    for brick in manifest["bricks"]:
        raw = (directory / brick["path"]).read_bytes()
        bx, by, bz = brick["coordinate"]
        for index, slot in enumerate(raw):
            if slot:
                cells.add((16 * bx + index % 16,
                           16 * by + (index // 16) % 16,
                           16 * bz + index // 256))
    return cells


def visible_faces(cells):
    for x, y, z in sorted(cells, key=lambda p: (sum(p), p)):
        for axis in range(3):
            neighbor = [x, y, z]
            neighbor[axis] += 1
            if tuple(neighbor) not in cells:
                origin = [x, y, z]
                origin[axis] += 1
                other = [a for a in range(3) if a != axis]
                corners = []
                for a, b in ((0, 0), (1, 0), (1, 1), (0, 1)):
                    corner = origin.copy()
                    corner[other[0]] += a
                    corner[other[1]] += b
                    corners.append(corner)
                yield axis, corners


def drawing(cells, h, geometry, source=False):
    def project(p):
        x, y, z = p
        return ((x - z) * math.sqrt(3) / 2, (x + z) / 2 - y)

    world = [tuple(value * h for value in corner)
             for _, corners in visible_faces(cells) for corner in corners]
    projected = [project(p) for p in world]
    low = [min(p[a] for p in projected) for a in range(2)]
    high = [max(p[a] for p in projected) for a in range(2)]
    scale = min(460 / (high[0] - low[0]), 340 / (high[1] - low[1]))

    def point(p):
        u, v = project(p)
        return f"{270 + scale * (u - (low[0] + high[0]) / 2):.3f},{205 + scale * (v - (low[1] + high[1]) / 2):.3f}"

    shapes = []
    if source:
        edges = set()
        for triangle in geometry.triangles:
            vertices = triangle.vertices
            for a, b in ((0, 1), (1, 2), (2, 0)):
                edges.add(tuple(sorted((vertices[a], vertices[b]))))
        for a, b in sorted(edges):
            shapes.append(f'<polyline points="{point(a)} {point(b)}" fill="none" stroke="#334155" stroke-width="2"/>')
    else:
        colors = ("#547da5", "#b4cfdf", "#7a9fbf")
        for axis, corners in visible_faces(cells):
            points = " ".join(point(tuple(v * h for v in p)) for p in corners)
            shapes.append(f'<polygon points="{points}" fill="{colors[axis]}" stroke="#243b53" stroke-width=".6"/>')
    label = "Actual canonical source triangles" if source else "Actual decoded occupied brick cells"
    return f'<svg role="img" aria-label="{label}" viewBox="0 0 540 410">{"".join(shapes)}</svg>'


def page(title, body):
    return f'''<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>{html.escape(title)}</title><link rel="icon" href="data:,"><style>
body{{font:16px system-ui,sans-serif;color:#172b4d;background:#f5f7fa;margin:0}}main{{max-width:1140px;margin:28px auto;padding:0 24px}}h1{{margin-bottom:8px}}nav{{display:flex;gap:24px;flex-wrap:wrap;padding:18px 0}}a{{color:#174d80}}.notice{{border-left:4px solid #af7011;padding:12px;background:#fff6e5}}.plots{{display:grid;grid-template-columns:1fr 1fr;gap:20px}}figure{{margin:0;background:white;border:1px solid #cbd5e1;padding:12px}}figcaption{{font-weight:600}}svg{{width:100%;display:block}}table{{border-collapse:collapse;width:100%;background:white;margin:18px 0}}th,td{{text-align:left;padding:10px;border:1px solid #cbd5e1}}code{{overflow-wrap:anywhere}}.pass{{color:#17633b}}.reject{{color:#9c2f15}}@media(max-width:700px){{.plots{{grid-template-columns:1fr}}}}
</style><main><h1>Hestia asset compiler — visible review</h1><p>Real Blender export → strict compiler → verified research bricks</p>
<nav><a href="index.html">0.125 m / micro</a><a href="standard.html">0.25 m / standard</a><a href="rotation.html">90° TRS support boundary</a><a href="REVIEW_FOR_PLANNER.md">Planner brief</a><a href="data.json">Machine data</a></nav>
<p class="notice">Offline compiler demo. <strong>PRODUCT_INTEGRATED = NO.</strong> This is not the running game. Raster occupancy is not analytic volume or physical mass.</p>{body}</main></html>'''


def build(output):
    # Refuse existing output, including broken links; do not overwrite review evidence.
    if output.exists() or output.is_symlink():
        raise ValueError("review output already exists")
    output.mkdir(parents=True)
    inputs = RESEARCH / "BLENDER_E2E_INPUTS"
    geometry = canonicalize_geometry(load_glb(inputs / "plain-cube.glb"))
    data = {"schema": "hestia.compiler-visible-review.v1", "productIntegrated": False,
            "input": "retained real Blender 5.2.0 / glTF 5.2.39 export", "profiles": []}
    for profile in PROFILES:
        directory = output / "packages" / profile
        directory.parent.mkdir(exist_ok=True)
        compile_to_directory(inputs / "plain-cube.glb", inputs / "plain-cube.hestia-authoring-report.json", profile, directory)
        manifest = verify_package(directory)
        cells = decoded_cells(directory, manifest)
        count = sum(record["cellCount"] for record in manifest["geometricMassInputs"])
        if len(cells) != count:
            raise ValueError("demo requires one non-overlapping owner")
        record = {"profile": profile, "cells": count, "bricks": len(manifest["bricks"]),
                  "cellMeters": manifest["cellMeters"], "treeSha256": manifest["manifestTreeSha256"],
                  "gridBounds": manifest["gridBounds"], "status": "PASS"}
        data["profiles"].append(record)
        body = f'<h2>{html.escape(profile)} <span class="pass">PASS</span></h2><div class="plots"><figure><figcaption>Source: 12 actual world triangles</figcaption>{drawing(cells, record["cellMeters"], geometry, True)}</figure><figure><figcaption>Compiled: {count} occupied cells / {record["bricks"]} bricks</figcaption>{drawing(cells, record["cellMeters"], geometry)}</figure></div><table><tr><th>Cell size</th><td>{record["cellMeters"]} m</td></tr><tr><th>Package tree SHA-256</th><td><code>{record["treeSha256"]}</code></td></tr><tr><th>Source bounds (metres, +Y up)</th><td>{html.escape(str(geometry.bounds))}</td></tr><tr><th>Actual manifest</th><td><a href="packages/{profile}/asset-manifest.json">Open verified manifest</a></td></tr></table><p>All occupied cells are decoded from the actual 4096-byte brick files. Only camera-facing exposed faces are drawn. Both drawings share the same projection and scale. Contact-inclusive surface coverage explains expansion beyond the source.</p>'
        filename = "index.html" if profile == PROFILES[0] else "standard.html"
        (output / filename).write_text(page(profile, body), encoding="utf-8")
    failures = []
    for profile in PROFILES:
        try:
            compile_to_directory(inputs / "rotation-z-90.glb", inputs / "rotation-z-90.hestia-authoring-report.json", profile, output / "packages" / (profile + "-rotation"))
        except CompilerError as error:
            if error.code != "thin.unproven":
                raise
            failures.append({"profile": profile, "status": "EXPECTED_UNSUPPORTED", "code": error.code})
        else:
            raise ValueError("rotation unexpectedly admitted; update review deliberately")
    data["rotation"] = failures
    body = '<h2>Ordinary Blender 90° TRS <span class="reject">EXPECTED UNSUPPORTED</span></h2><p>Real export succeeds. Finite closed geometry is accepted, but the current exact orthogonal thickness/topology proof does not cover the float quaternion residual. No snap, repair or fake success.</p><table><tr><th>Profile</th><th>Actual compile result</th></tr>'
    body += "".join(f'<tr><td>{r["profile"]}</td><td>{r["code"]}; no package published</td></tr>' for r in failures)
    body += '</table><p>Planner decision: specify a justified general proof or authoring interoperability contract. Do not silently change the delivered geometry or product format.</p>'
    (output / "rotation.html").write_text(page("90-degree TRS boundary", body), encoding="utf-8")
    (output / "data.json").write_text(json.dumps(data, sort_keys=True, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"status": "PASS", "profiles": data["profiles"], "rotation": failures}))


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    build(args.output)
