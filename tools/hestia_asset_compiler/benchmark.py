"""One bounded diagnostic workload; inclusive timing wrappers never bypass core proof."""

from contextlib import ExitStack
import copy
import platform
import sys
from time import perf_counter_ns, process_time_ns
from unittest.mock import patch

from . import admission, classification, geometry, package, thin
from .errors import CompilerError
from .glb import fail
from .golden import GWN_DECISION, bind_report
from .profiles import BUDGETS, BUDGET_VERSION, PROFILES
from .tests.glb_fixtures import box, fixture, glb, part


def small_input():
    """84 genuine meshes/accessor copies: 1008 input triangles AND 1008 expanded."""
    document, first = fixture(*box((0, 0, 0), (.5, .5, .5)))
    mesh = copy.deepcopy(document["meshes"][0])
    views, accessors = copy.deepcopy(document["bufferViews"]), copy.deepcopy(document["accessors"])
    document.update(nodes=[], meshes=[], bufferViews=[], accessors=[])
    binary = bytearray()
    for i in range(84):
        offset = len(binary)
        binary.extend(first)
        for view in views:
            document["bufferViews"].append({**view, "byteOffset": offset + view.get("byteOffset", 0)})
        for accessor in accessors:
            document["accessors"].append({**accessor, "bufferView": 2*i + accessor["bufferView"]})
        copied = copy.deepcopy(mesh)
        copied["primitives"][0]["attributes"]["POSITION"] = 2*i
        copied["primitives"][0]["indices"] = 2*i + 1
        document["meshes"].append(copied)
        document["nodes"].append({"mesh": i, "translation": [1.5*i, 0, 0], "extras": {"hestia": part(f"part.small.{i:03}")}})
    document["scenes"][0]["nodes"] = list(range(84))
    document["buffers"][0]["byteLength"] = len(binary)
    raw = glb(document, bytes(binary))
    return raw, bind_report(document, raw)


def measure_compile(raw, report, profile):
    if profile not in PROFILES:
        fail("benchmark.arguments", "explicit frozen profile required")
    phases, observed = {}, {}

    def timed(module, name, phase, scope, capture=None):
        original = getattr(module, name)
        record = phases.setdefault(phase, {"status": "MEASURED", "scope": scope, "calls": 0,
                                          "wallMilliseconds": 0.0, "cpuMilliseconds": 0.0})

        def call(*args, **kwargs):
            wall, cpu = perf_counter_ns(), process_time_ns()
            try:
                result = original(*args, **kwargs)
                if capture is not None:
                    observed[capture] = result
                return result
            finally:
                record["calls"] += 1
                record["wallMilliseconds"] += (perf_counter_ns() - wall) / 1_000_000
                record["cpuMilliseconds"] += (process_time_ns() - cpu) / 1_000_000
        return patch.object(module, name, call)

    wall, cpu = perf_counter_ns(), process_time_ns()
    generated, diagnostic = None, None
    with ExitStack() as stack:
        for module, name, phase, scope, capture in (
            (package, "admit_pair", "inputHash", "INCLUSIVE_IN_MEMORY_ADMISSION_HASH_PARSE_SEMANTICS; file I/O not measured", "admitted"),
            (admission, "read_glb", "glbParse", "NESTED_IN_INPUT_HASH; actual bounded reader", None),
            (package, "canonicalize_geometry", "transformsNormalize", "COMBINED_INCLUSIVE_BAKING_AND_GEOMETRY_VALIDATION", "geometry"),
            (geometry, "validate_topology", "geometryValidation", "NESTED_IN_TRANSFORMS_NORMALIZE; actual per-Part topology", None),
            (package, "thin_gate", "thinMeasurementAdmission", "INCLUSIVE_MEASUREMENT_PREFLIGHT_BINDINGS", "thin"),
            (classification, "rasterize", "surfaceCoverage", "NESTED_IN_CLASSIFICATION; actual conservative SAT coverage", None),
            (package, "classify_cells", "classificationFill", "COMBINED_INCLUSIVE_PREFLIGHT_COVERAGE_FILL_PARITY_TOPOLOGY", "classified"),
            (thin, "check_material_intent", "materialResolution", "PARTIAL_NESTED_EXPLICIT_BINDING_CHECKS; maps/slots combined elsewhere", None),
            (package, "pack_bricks", "brickPacking", "ACTUAL_PACKING_INCLUDES_ADDRESS_SLOT_HASH", None),
            (package, "bounded_json", "hashingSerialization", "PARTIAL_PACKAGE_JSON_AND_SHA_CALLS_INCLUDING_VERIFICATION; other hashes in owning combined phases", None),
            (package, "sha256_bytes", "hashingSerialization", "PARTIAL_PACKAGE_JSON_AND_SHA_CALLS_INCLUDING_VERIFICATION; other hashes in owning combined phases", None),
            (package, "verify_files", "outputVerification", "INCLUSIVE_ACTUAL_BYTE_VERIFICATION; nested serialization/hash calls", None),
        ):
            stack.enter_context(timed(module, name, phase, scope, capture))
        try:
            generated = package.compile_core(raw, report, profile)
        except CompilerError as error:
            diagnostic = error.code
    total = {"status": "MEASURED", "scope": "INCLUSIVE_IN_MEMORY_TOTAL; instrumentation overhead included; nested phases DO NOT SUM",
             "wallMilliseconds": (perf_counter_ns() - wall) / 1_000_000, "cpuMilliseconds": (process_time_ns() - cpu) / 1_000_000}
    # A phase not reached is NOT a measured zero.
    for name in ("inputHash", "glbParse", "transformsNormalize", "geometryValidation", "surfaceCoverage", "classificationFill",
                 "materialResolution", "brickPacking", "hashingSerialization", "outputVerification", "thinMeasurementAdmission"):
        if name not in phases or phases[name]["calls"] == 0:
            phases[name] = {"status": "UNAVAILABLE", "reason": "Core rejected before this phase; no measured zero."}
    phases.update(total=total, optionalGwn={"status": "NOT_RUN", "reason": GWN_DECISION["reason"]})
    source = observed.get("admitted")
    baked = observed.get("geometry")
    classified = observed.get("classified")
    counts = {"inputBytes": len(raw), "reportBytes": len(report), "inputTriangles": None, "inputVertices": None, "decodedVertices": None,
              "expandedTriangles": len(baked.triangles) if baked is not None else None,
              "ownedCells": None, "bricks": None, "outputBytes": None}
    if source is not None:
        counts["inputTriangles"] = sum(len(p.indices)//3 for m in source.source.primitives for p in m)
        accessors = {p["attributes"]["POSITION"] for m in source.source.document["meshes"] for p in m["primitives"]}
        counts["inputVertices"] = sum(source.source.document["accessors"][i]["count"] for i in accessors)
        counts["decodedVertices"] = sum(len(p.positions) for m in source.source.primitives for p in m)
    if generated is not None:
        counts.update(ownedCells=sum(m["cellCount"] for m in generated.manifest["geometricMassInputs"]),
                      bricks=len(generated.manifest["bricks"]), outputBytes=sum(map(len, generated.files.values())))
    stats = {"thinAndPotentialClassification": observed["thin"][2] if "thin" in observed else "UNAVAILABLE",
             "classification": classified.stats if classified is not None else "UNAVAILABLE"}
    sources = source.sources if source is not None else {"sourceGlbSha256": package.sha256_bytes(raw), "sourceReportSha256": package.sha256_bytes(report)}
    result = {"status": "MEASURED" if generated is not None else "BLOCKED", "diagnostic": diagnostic,
        "qualification": "CONTAMINATED_DIAGNOSTIC", "reason": "No exclusive CPU slot or freedom from parallel HVP/renderer agents proven; never stop foreign sessions.",
        "profileId": profile, "memory": "UNSUPPORTED", "sources": sources, "counts": counts, "budgetStats": stats,
        "budgetVersion": BUDGET_VERSION, "caps": dict(BUDGETS), "phases": phases}
    return result, generated


def benchmark(population="small", profiles=None):
    profiles = list(PROFILES if profiles is None else profiles)
    if population not in ("small", "medium", "large") or not profiles or len(set(profiles)) != len(profiles) or set(profiles) - set(PROFILES):
        fail("benchmark.arguments", "bounded population and frozen profile selection required")
    runs = []
    if population != "small":
        for profile in profiles:
            runs.append({"profileId": profile, "status": "NOT_RUN_BUDGET_EXCLUDED", "qualification": "CONTAMINATED_DIAGNOSTIC",
                "population": population, "requestedInputTriangleRange": [25000, 50000] if population == "medium" else [100000, 250000],
                "expandedTriangleLimit": BUDGETS["instance_triangles"], "reason": "At least one instance already exceeds frozen 20000 expanded triangles; no input allocation/core invocation.",
                "phases": {"total": {"status": "NOT_RUN"}}, "memory": "UNSUPPORTED"})
    else:
        raw, report = small_input()
        for profile in profiles:
            measured, _ = measure_compile(raw, report, profile)
            measured["population"] = "small-84-real-mesh-copies"
            runs.append(measured)
    return {"schema": "hestia.asset-compiler-benchmark.c7.v1", "qualification": "CONTAMINATED_DIAGNOSTIC", "runs": runs,
            "environment": {"python": sys.version.split()[0], "platform": sys.platform,
                            "osVersion": platform.win32_ver()[1] if sys.platform == "win32" else platform.release(), "machine": platform.machine()},
            "gwn": GWN_DECISION, "productIntegrated": False, "finalC8PerformanceAcceptance": "NOT_RUN"}
