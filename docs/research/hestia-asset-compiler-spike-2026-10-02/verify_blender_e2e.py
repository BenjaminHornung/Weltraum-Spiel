"""One bounded real-Blender followup; existing exporter/compiler stay read-only."""

import hashlib
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile

ROOT = Path(__file__).resolve().parents[3]
DOCS = Path(__file__).resolve().parent
TEMP = Path("C:/IFI_SourceCode/Utils/opencode-migration/tmp/opencode/hestia-agent3-2026-10-02-72981f9a")
BLENDER = Path("C:/IFI_SourceCode/Utils/Blender 5.2/blender.exe")
PYTHON = Path("C:/IFI_SourceCode/Utils/Python/cpython-3.12.13-windows-x86_64-none/python.exe")
PROFILES = ("micro-0125-research-v1", "standard-025-v1")
VARIANTS = ("plain-cube", "rotation-z-90")


def digest(raw):
    return hashlib.sha256(raw).hexdigest()


def write_new(path, value):
    with path.open("xb") as stream:
        stream.write((json.dumps(value, indent=2, sort_keys=True, allow_nan=False) + "\n").encode("utf-8"))


def fixtures(output):
    import bpy
    import io_scene_gltf2
    import math

    # Factory startup, only invocation-owned objects/files. Never load user data.
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    collection = bpy.data.collections.new("HestiaE2E")
    bpy.context.scene.collection.children.link(collection)
    for key, value in {"hestia.schema_version": "hestia.asset-authoring.v1",
                       "hestia.asset_id": "blender-e2e-cube", "hestia.asset_revision": 1,
                       "hestia.representation_mode": "StructuralAssembly"}.items():
        collection[key] = value
    bpy.ops.mesh.primitive_cube_add(size=1, location=(0.5, 1, 1.5))
    cube = bpy.context.object
    cube.name = "CubePart"
    for owner in tuple(cube.users_collection):
        owner.objects.unlink(cube)
    collection.objects.link(cube)
    for key, value in {"hestia.part_id": "cube", "hestia.representation_mode": "Solid",
                       "hestia.render_material_id": "cube-material", "hestia.destructible": True,
                       "hestia.collision_policy": "Voxel", "hestia.navigation_policy": "Obstacle",
                       "hestia.thin_feature_policy": "Reject", "hestia.declared_minimum_thickness_m": 1.0}.items():
        cube[key] = value
    material = bpy.data.materials.new("CubeMaterial")
    material.use_nodes = True
    material["hestia.render_material_id"] = "cube-material"
    cube.data.materials.append(material)
    properties = bpy.ops.export_scene.gltf.get_rna_type().properties
    defaults = {}
    for prop in properties:
        if prop.identifier == "rna_type":
            continue
        if getattr(prop, "is_array", False):
            defaults[prop.identifier] = list(prop.default_array)
        elif hasattr(prop, "default"):
            value = prop.default
            defaults[prop.identifier] = sorted(value) if isinstance(value, set) else value
    metadata = {"blenderVersion": bpy.app.version_string,
                "blenderBuildHash": bpy.app.build_hash.decode(),
                "blenderBuildDate": bpy.app.build_date.decode(),
                "blenderPythonVersion": sys.version,
                "gltfExporterVersion": list(io_scene_gltf2.bl_info["version"]),
                "gltfExporterModuleSha256": digest(Path(io_scene_gltf2.__file__).read_bytes()),
                "operatorAvailableProperties": sorted(prop.identifier for prop in properties),
                "operatorFactoryDefaults": defaults,
                "explicitExporterOptions": {"export_format": "GLB", "use_selection": True, "export_extras": True},
                "exportCustomPropertiesAvailable": "export_custom_properties" in properties,
                "fixtures": {}}
    if "export_custom_properties" in properties:
        metadata["explicitExporterOptions"]["export_custom_properties"] = True
    for variant in VARIANTS:
        cube.rotation_euler = (0, 0, math.pi / 2 if variant == "rotation-z-90" else 0)
        bpy.context.view_layer.update()
        points = [tuple(float(x) for x in cube.matrix_world @ vertex.co) for vertex in cube.data.vertices]
        assert all(math.isfinite(x) for point in points for x in point)
        metadata["fixtures"][variant] = {
            "authoredProperties": {key: cube[key] for key in cube.keys()},
            "assetProperties": {key: collection[key] for key in collection.keys()},
            "rotationEulerRadians": list(cube.rotation_euler),
            "blenderWorldMatrixRows": [list(row) for row in cube.matrix_world],
            "blenderWorldVertices": points,
            "blenderWorldBounds": [[min(p[a] for p in points) for a in range(3)],
                                   [max(p[a] for p in points) for a in range(3)]],
            "localVertexCount": len(cube.data.vertices), "polygonCount": len(cube.data.polygons),
            "blendSaveResult": sorted(bpy.ops.wm.save_as_mainfile(filepath=str(output / (variant + ".blend"))))}
        assert metadata["fixtures"][variant]["blendSaveResult"] == ["FINISHED"]
    write_new(output / "fixture-metadata.json", metadata)


def run():
    # No retry and no test/corpus/benchmark execution. Each child has its own bound.
    from tools.hestia_asset_compiler.admission import admit_pair
    from tools.hestia_asset_compiler.geometry import canonicalize_geometry
    from tools.blender.hestia_asset_authoring.canonical import canonical_json_bytes

    evidence_path = DOCS / "BLENDER_E2E.json"
    inputs = DOCS / "BLENDER_E2E_INPUTS"
    assert not evidence_path.exists() and not inputs.exists(), "do not overwrite evidence"
    assert TEMP.is_dir() and not list(TEMP.iterdir()), "owned TEMP must start empty"
    generation = Path(tempfile.mkdtemp(prefix="blender-e2e-", dir=TEMP))
    env = dict(os.environ, TEMP=str(generation), TMP=str(generation), PYTHONDONTWRITEBYTECODE="1",
               PYTHONUTF8="1", BLENDER_USER_CONFIG=str(generation / "config"),
               BLENDER_USER_SCRIPTS=str(generation / "scripts"), BLENDER_USER_DATAFILES=str(generation / "data"))
    evidence = {"status": "STARTED", "productIntegrated": False, "commit": "de0f405f2d0e1084d0fa7f993d3cf74761b66dca",
                "compilerCodeFreeze": "c8e451a3e52fc8da743df011debae682f93c89a3", "commands": [], "cases": []}
    evidence["helperSha256"] = digest(Path(__file__).read_bytes())
    frozen = json.loads((DOCS / "C8_DETERMINISM.json").read_bytes())["pythonSourceManifest"]
    source = [{"path": p.relative_to(ROOT).as_posix(), "bytes": p.stat().st_size, "sha256": digest(p.read_bytes())}
              for p in sorted((ROOT / "tools/hestia_asset_compiler").rglob("*.py"))]
    assert source == frozen, "compiler source freeze changed"
    evidence["pythonSourceManifestSha256"] = digest(json.dumps(source, sort_keys=True, separators=(",", ":"), allow_nan=False).encode())

    def child(argv, label, timeout=180):
        result = subprocess.run([str(arg) for arg in argv], cwd=ROOT, env=env, capture_output=True, timeout=timeout)
        record = {"label": label, "argv": [str(arg) for arg in argv], "timeoutSeconds": timeout,
                  "exitCode": result.returncode, "stdout": result.stdout.decode("utf-8", errors="replace"),
                  "stderr": result.stderr.decode("utf-8", errors="replace"),
                  "stdoutSha256": digest(result.stdout), "stderrSha256": digest(result.stderr)}
        evidence["commands"].append(record)
        print(label + ": Exit " + str(result.returncode), flush=True)
        return record

    try:
        creation = child([BLENDER, "--background", "--factory-startup", "--python-exit-code", "1",
                          "--python", Path(__file__).resolve(), "--", "fixture", generation], "real-fixture-creation")
        assert creation["exitCode"] == 0, "fixture preparation failed; STOP"
        evidence["runtime"] = json.loads((generation / "fixture-metadata.json").read_bytes())
        inputs.mkdir()
        for variant in VARIANTS:
            blend = generation / (variant + ".blend")
            glb = generation / (variant + ".glb")
            report = generation / (variant + ".hestia-authoring-report.json")
            exported = child([BLENDER, "--background", "--factory-startup", blend,
                              "--python-exit-code", "1", "--python",
                              ROOT / "tools/blender/hestia_asset_authoring/export_hestia_glb.py", "--",
                              "--output", glb, "--collection", "HestiaE2E", "--unapplied-scale", "warning"], variant + ": real-export")
            for artifact in (glb, report):
                if artifact.is_file():
                    with (inputs / artifact.name).open("xb") as stream:
                        stream.write(artifact.read_bytes())
            assert exported["exitCode"] == 0, "upstream exporter failure; STOP before any fix"
            raw_glb, raw_report = glb.read_bytes(), report.read_bytes()
            sidecar = json.loads(raw_report)
            case = {"variant": variant, "export": "PASS", "blendBytes": blend.stat().st_size,
                    "blendSha256": digest(blend.read_bytes()), "glbBytes": len(raw_glb), "glbSha256": digest(raw_glb),
                    "reportBytes": len(raw_report), "reportSha256": digest(raw_report), "report": sidecar, "profiles": []}
            evidence["cases"].append(case)
            assert sidecar["digests"]["glb_sha256"] == sidecar["payload"]["glbSha256"] == digest(raw_glb)
            assert sidecar["digests"]["report_sha256"] == digest(canonical_json_bytes(sidecar["payload"]))
            admitted = admit_pair(raw_glb, raw_report)
            geometry = canonicalize_geometry(admitted.source)
            case["glbDocument"] = admitted.source.document
            case["geometry"] = {"triangleCount": len(geometry.triangles), "bounds": geometry.bounds,
                                "topology": geometry.topology, "placements": geometry.placements,
                                "normalizedGeometrySha256": geometry.normalized_geometry_sha256,
                                "worldVertices": sorted({p for t in geometry.triangles for p in t.vertices})}
            assert len(geometry.triangles) == 12 and len(case["geometry"]["worldVertices"]) == 8
            for profile in PROFILES:
                target = generation / (variant + "-" + profile)
                compiled = child([PYTHON, "-B", "-X", "utf8", "-m", "tools.hestia_asset_compiler", "compile",
                                  "--glb", glb, "--report", report, "--profile", profile, "--output", target], variant + ": compile " + profile)
                outcome = {"profile": profile, "compileExitCode": compiled["exitCode"]}
                case["profiles"].append(outcome)
                if compiled["exitCode"] == 0:
                    outcome["status"] = "SUCCESS"
                    outcome["compileInfo"] = json.loads(compiled["stdout"])
                    for command in ("validate", "inspect"):
                        argv = [PYTHON, "-B", "-X", "utf8", "-m", "tools.hestia_asset_compiler", command, target]
                        if command == "inspect":
                            argv.append("--json")
                        verified = child(argv, variant + ": " + command + " " + profile)
                        assert verified["exitCode"] == 0, "actual package verification failed; STOP"
                        assert json.loads(verified["stdout"]) == outcome["compileInfo"]
                        outcome[command] = "PASS"
                    outcome["manifest"] = json.loads((target / "asset-manifest.json").read_bytes())
                    outcome["packageInventory"] = [{"path": p.relative_to(target).as_posix(), "bytes": p.stat().st_size,
                                                    "sha256": digest(p.read_bytes())} for p in sorted(target.rglob("*")) if p.is_file()]
                    outcome["publishedFileCount"] = len(outcome["packageInventory"])
                    outcome["publishedBytes"] = sum(item["bytes"] for item in outcome["packageInventory"])
                else:
                    outcome["diagnostic"] = json.loads(compiled["stderr"])
                    outcome["targetAbsent"] = not target.exists()
                    assert outcome["targetAbsent"], "rejected compile left target"
                    assert variant == "rotation-z-90" and compiled["exitCode"] == 1
                    assert outcome["diagnostic"] == {"status": "REJECTED", "diagnostics": [{"severity": "error", "code": "thin.unproven"}]}, "new finding; STOP"
                    outcome.update(status="KNOWN_UNSUPPORTED_PROOF", validate="NOT_APPLICABLE_NO_PACKAGE", inspect="NOT_APPLICABLE_NO_PACKAGE")
            assert glb.read_bytes() == raw_glb and report.read_bytes() == raw_report
        evidence["status"] = "FOCUSED_EXECUTION_COMPLETE_NOT_BLANKET_INTEROP_PASS"
    except Exception as error:
        evidence["status"] = "STOP_REQUIRES_SCOPE_REVIEW"
        evidence["error"] = str(error)
        raise
    finally:
        shutil.rmtree(generation)  # Only the generation created by this invocation.
        evidence["ownedGenerationRemoved"] = not generation.exists()
        evidence["ownedTempEntries"] = len(list(TEMP.iterdir()))
        write_new(evidence_path, evidence)


if __name__ == "__main__":
    sys.dont_write_bytecode = True
    if "--" in sys.argv:
        arguments = sys.argv[sys.argv.index("--") + 1:]
        assert arguments[0] == "fixture"
        fixtures(Path(arguments[1]))
    else:
        sys.path.insert(0, str(ROOT))
        run()
