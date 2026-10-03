"""Deterministic exact G01-G30 research inputs and independent interval oracles.

No runtime assets, expected-cell inference from the voxelizer, or hash auto-update.
"""

import copy
from dataclasses import dataclass, replace
from fractions import Fraction
from itertools import product
import math
from pathlib import Path
import random
import struct

from tools.blender.hestia_asset_authoring.canonical import canonical_json_bytes, sha256_bytes
from .admission import admit_pair
from .errors import CompilerError
from .geometry import canonicalize_geometry
from .glb import bounded_read, fail, semantic, strict_json
from .package import bounded_json, compile_core, semantic_projection
from .profiles import PROFILES
from .tests.glb_fixtures import box, combine_meshes, fixture, glb, orthogonal_union, part

IDS = tuple(f"G{i:02}" for i in range(1, 31))
ORDER_IDS = {"G01", "G13", "G16", "G27", "G28"}
PINS = Path(__file__).with_name("tests") / "golden_hashes.json"
GWN_DECISION = {"status": "GWN_NO_ADOPTION", "evidenceKind": "REASONED_NOT_IMPLEMENTED",
    "reason": "Signed winding 2 in an equal-outward nested cavity conflicts with even/odd Air; no proven topology/thin replacement. Reference retained."}


def bind_report(document, raw):
    """Synthetic external sidecar, including negative GLBs; never decode bad geometry to bless it."""
    semantics = {"schema": "hestia.asset-authoring.v1", "asset": semantic(document["asset"]["extras"]["hestia"], "asset"),
                 "parts": [], "joints": [], "markers": [], "materials": []}
    for node in document["nodes"]:
        authored = node.get("extras", {}).get("hestia")
        if authored is not None:
            kind = authored["kind"]
            semantics[{"part": "parts", "joint": "joints", "marker": "markers"}[kind]].append(semantic(authored, kind))
    semantics["materials"] = [semantic(m["extras"]["hestia"], "material") for m in document["materials"]]
    counts = {key: 0 for key in ("vertexCount", "edgeCount", "polygonCount", "triangleCount", "boundaryEdgeCount",
                                "nonManifoldEdgeCount", "degeneratePolygonCount")}
    payload = {"schemaId": "hestia.asset-authoring.v1", "semantics": semantics, "glbSha256": sha256_bytes(raw),
        "diagnostics": [], "inventory": {"materials": [{"materialId": m["renderMaterialId"]} for m in semantics["materials"]],
            "meshes": [{"meshId": "inventory.mesh", "topology": counts, "boundsMin": None, "boundsMax": None,
                        "materialIds": [], "primitiveIds": []}], "primitives": []},
        "options": {"requireSchemaId": "hestia.asset-authoring.v1", "unappliedScalePolicy": "warning", "unappliedScaleTolerance": 0},
        "outputBasename": "fixture.glb"}
    return canonical_json_bytes({"payload": payload, "digests": {"glb_sha256": sha256_bytes(raw),
                                 "report_sha256": sha256_bytes(canonical_json_bytes(payload))}})


@dataclass(frozen=True)
class Case:
    case_id: str
    variant: str
    document: dict
    binary: bytes
    glb: bytes
    report: bytes
    oracle: dict
    expected: dict


def make_case(case_id, variant, document, binary, oracle, diagnostic=None, blocked=None):
    expected = {}
    for profile in PROFILES:
        code = diagnostic.get(profile) if isinstance(diagnostic, dict) else diagnostic
        expected[profile] = {"outcome": "BLOCKED" if code and blocked else "EXPECTED_REJECTION" if code else "SUCCESS",
                             "diagnostics": [code] if code else [], "reason": blocked if code and blocked else None}
    raw = glb(document, binary)
    return Case(case_id, variant, document, binary, raw, bind_report(document, raw), oracle, expected)


def rich_transport(document):
    """Two real primitives, a remappable parent node and an unused real declaration."""
    doc = copy.deepcopy(document)
    if len(doc["materials"]) == 1:
        doc["materials"].append({"extras": {"hestia": {"renderMaterialId": "render.b", "structuralMaterialId": "steel.b"}}})
    for mesh in doc["meshes"]:
        if len(mesh["primitives"]) != 1:
            continue
        first = mesh["primitives"][0]
        accessor = doc["accessors"][first["indices"]]
        half = accessor["count"] // 6 * 3
        second_accessor = {**accessor, "count": accessor["count"] - half,
                           "byteOffset": accessor.get("byteOffset", 0) + 2 * half}
        accessor["count"] = half
        doc["accessors"].append(second_accessor)
        mesh["primitives"].append({**copy.deepcopy(first), "indices": len(doc["accessors"]) - 1})
    doc["nodes"].append({"children": list(doc["scenes"][0]["nodes"])})
    doc["scenes"][0]["nodes"] = [len(doc["nodes"]) - 1]
    return doc


def tunnel(low=.5, high=1, z_low=None, z_high=None):
    z_low, z_high = (low, high) if z_low is None else (z_low, z_high)
    return orthogonal_union((0, 2), (0, low, high, 2), (0, z_low, z_high, 2),
                            {(0, y, z) for y in range(3) for z in range(3) if (y, z) != (1, 1)})


def corpus():
    result = []

    def add(identity, variant="base", mesh=None, oracle=None, edit=None, diagnostic=None, blocked=None, rich=False):
        doc, binary = fixture(*(box() if mesh is None else mesh))
        if edit is not None:
            doc, binary = edit(doc, binary)
        if rich:
            doc = rich_transport(doc)
        result.append(make_case(identity, variant, doc, binary, oracle or {"boxes": {"part.a": [((0, 0, 0), (1, 1, 1))]}}, diagnostic, blocked))

    def update_node(values):
        def edit(doc, binary):
            doc["nodes"][0].update(values)
            return doc, binary
        return edit

    add("G01", rich=True)
    add("G02", mesh=box((0, 0, 0), (1, 1.5, .5)), oracle={"boxes": {"part.a": [((0, 0, 0), (1, 1.5, .5))]}})
    for identity, lo, hi in (("G03", (-2, -2, -2), (-1, -1, -1)), ("G04", (-.5,) * 3, (.5,) * 3)):
        add(identity, mesh=box(lo, hi), oracle={"boxes": {"part.a": [(lo, hi)]}})
    add("G05", "quarter-matrix", edit=update_node({"matrix": [0, 1, 0, 0, -1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]}),
        oracle={"boxes": {"part.a": [((-1, 0, 0), (0, 1, 1))]}})
    add("G05", "quarter-trs", edit=update_node({"rotation": [0, 0, math.sin(math.pi / 4), math.cos(math.pi / 4)]}),
        oracle={"worldBounds": [(-1, 0, 0), (0, 1, 1)]}, diagnostic="thin.unproven",
        blocked="Valid 90-degree C3 TRS baking; exact orthogonal thin proof unavailable without forbidden snapping.")
    q = math.sqrt(.5)
    add("G06", "finite-trs", edit=update_node({"rotation": [0, 0, math.sin(math.pi / 8), math.cos(math.pi / 8)],
        "scale": [2, 1.5, .5], "translation": [-3, 2, -1]}), oracle={"worldBounds": [(-3 - 1.5*q, 2, -1), (-3 + 2*q, 2 + 3.5*q, -.5)]},
        diagnostic="thin.unproven", blocked="Finite arbitrary TRS geometry is valid, general nonorthogonal Solid proof NOT VOXELIZED.")
    add("G07", "single-mirror", edit=update_node({"scale": [-1, 1, 1]}), oracle={"boxes": {"part.a": [((-1, 0, 0), (0, 1, 1))]}})

    def double_mirror(doc, binary):
        doc["nodes"][0]["scale"] = [-1, 1, 1]
        doc["nodes"].append({"children": [0], "scale": [-1, 1, 1]})
        doc["scenes"][0]["nodes"] = [1]
        return doc, binary
    add("G07", "double-mirror", edit=double_mirror)

    def instance(doc, binary):
        doc["nodes"].append({"mesh": 0, "translation": [3, 0, 0], "extras": {"hestia": part("part.b")}})
        doc["scenes"][0]["nodes"].append(1)
        return doc, binary
    two_boxes = {"boxes": {"part.a": [((0, 0, 0), (1, 1, 1))], "part.b": [((3, 0, 0), (4, 1, 1))]}}
    add("G08", edit=instance, oracle=two_boxes)

    def policy(value, declared=1):
        def edit(doc, binary):
            doc["nodes"][0]["extras"]["hestia"]["thinFeature"] = {"policy": value, "declaredMinimumThicknessMeters": declared}
            return doc, binary
        return edit
    add("G09", mesh=box((0, 0, 0), (1, 1, .0625)), edit=policy("Reject", 100),
        oracle={"worldBounds": [(0, 0, 0), (1, 1, .0625)]}, diagnostic="thin.too-thin")
    add("G10", "beam", mesh=box((0, 0, 0), (2, .0625, .125)), edit=policy("PreserveAsBeam"),
        oracle={"nonVoxel": "RectangularPrismBeam", "worldBounds": [(0, 0, 0), (2, .0625, .125)]})
    add("G10", "reject", mesh=box((0, 0, 0), (2, .0625, .125)),
        oracle={"worldBounds": [(0, 0, 0), (2, .0625, .125)]}, diagnostic="thin.too-thin")
    add("G11", "tube-rod-unproven", mesh=tunnel(.0625, 1.9375), edit=policy("PreserveAsRod"), diagnostic="thin.unproven",
        oracle={"worldBounds": [(0, 0, 0), (2, 2, 2)]},
        blocked="Actual hollow tube is not a filled rod; usable cylindrical/rod replacement proof unavailable.")
    add("G11", "tube-reject", mesh=tunnel(.0625, 1.9375), oracle={"worldBounds": [(0, 0, 0), (2, 2, 2)]}, diagnostic="thin.too-thin")

    def shell(layered=False):
        def edit(doc, binary):
            record = doc["nodes"][0]["extras"]["hestia"]
            record.update(representation="LayeredShell" if layered else "Shell", shell={"thicknessMeters": .0625,
                          "layers": [{"structuralMaterialId": "steel.a", "thicknessMeters": .0625}]})
            record["thinFeature"]["policy"] = "PreserveAsShell"
            if layered:
                record["shell"]["layers"].append({"structuralMaterialId": "steel.b", "thicknessMeters": .03125})
                doc["materials"].append({"extras": {"hestia": {"renderMaterialId": "render.b", "structuralMaterialId": "steel.b"}}})
            return doc, binary
        return edit
    rectangle = ([(0, 0, 0), (1, 0, 0), (1, 1, 0), (0, 1, 0)], [(0, 1, 2), (0, 2, 3)])
    add("G12", "single-layer", mesh=rectangle, edit=shell(), oracle={"nonVoxel": "RectangularSingleLayerMidplaneShell", "worldBounds": [(0, 0, 0), (1, 1, 0)]})
    add("G12", "multilayer-unproven", mesh=rectangle, edit=shell(True), oracle={"worldBounds": [(0, 0, 0), (1, 1, 0)]}, diagnostic="thin.unproven",
        blocked="No proven layer-stacking replacement; authored layer order/thickness retained, never filled as Solid.")
    inner_points, inner_faces = box((.5,) * 3, (1.5,) * 3)
    for variant, faces in (("equal-outward", inner_faces), ("reversed-inner", [(a, c, b) for a, b, c in inner_faces])):
        add("G13", variant, mesh=combine_meshes([box((0,) * 3, (2,) * 3), (inner_points, faces)]), rich=True,
            oracle={"boxes": {"part.a": [((0,) * 3, (2,) * 3)]}, "cavity": [(.5,) * 3, (1.5,) * 3]})
    for variant, low, high, zl, zh in (("narrow", .5, 1, .5, 1), ("resolvable", .5, 1.5, .5, 1.5),
                                      ("phase", .5625, 1.0625, .625, 1.125)):
        add("G14", variant, mesh=tunnel(low, high, zl, zh),
            oracle={"boxes": {"part.a": [((0,) * 3, (2,) * 3)]}, "tunnel": [(0, low, zl), (2, high, zh)]},
            diagnostic={"standard-025-v1": "classification.topology-loss"} if variant == "narrow" else None)
    add("G15", mesh=combine_meshes([box(), box((2, 0, 0), (3, 1, 1))]),
        oracle={"boxes": {"part.a": [((0, 0, 0), (1, 1, 1)), ((2, 0, 0), (3, 1, 1))]}, "materialComponents": 2})

    def wedge_materials(doc, binary):
        doc["materials"].append({"extras": {"hestia": {"renderMaterialId": "render.b", "structuralMaterialId": "steel.b"}}})
        first = doc["meshes"][0]["primitives"][0]
        doc["accessors"][1]["count"] = 6
        doc["accessors"].append({**doc["accessors"][1], "byteOffset": 12})
        doc["meshes"][0]["primitives"].append({**first, "indices": 2, "material": 1})
        return doc, binary
    add("G16", mesh=([(0, 0, 0), (1, 0, 0), (0, 1, 0), (0, 0, 1)], [(0, 2, 1), (0, 1, 3), (0, 3, 2), (1, 2, 3)]),
        edit=wedge_materials, diagnostic="material.ambiguity", rich=True)

    def hierarchy(doc, binary):
        doc, binary = instance(doc, binary)
        doc["nodes"][1]["extras"]["hestia"]["parentPartId"] = "part.a"
        doc["nodes"][0]["children"] = [1]
        doc["scenes"][0]["nodes"] = [0]
        return doc, binary
    add("G17", edit=hierarchy, oracle={**two_boxes, "parent": ["part.b", "part.a"]})

    def joint(doc, binary):
        doc["nodes"].extend([{"extras": {"hestia": part("part.b", "StructuralAssembly")}},
            {"translation": [1, 2, 3], "extras": {"hestia": {"kind": "joint", "jointId": "joint.a", "jointType": "Fixed",
             "parentPartId": "part.a", "childPartId": "part.b", "breakPolicy": "Never"}}},
            {"children": [2], "translation": [10, 0, 0]}])
        doc["scenes"][0]["nodes"] = [0, 1, 3]
        return doc, binary
    add("G18", edit=joint, oracle={"boxes": {"part.a": [((0,) * 3, (1,) * 3)]}, "placements": {"joint.a": [11, 2, 3]}})

    def marker(doc, binary):
        doc["nodes"].extend([{"translation": [-1, 0, 2], "extras": {"hestia": {"kind": "marker", "markerId": "marker.cut",
            "markerType": "CutInterface", "partId": "part.a", "interfaceId": "interface.a"}}}, {"children": [1], "translation": [10, 0, 0]}])
        doc["scenes"][0]["nodes"] = [0, 2]
        return doc, binary
    add("G19", edit=marker, oracle={"boxes": {"part.a": [((0,) * 3, (1,) * 3)]}, "placements": {"marker.cut": [9, 0, 2]}, "interfaceId": "interface.a"})
    add("G20", mesh=([(0, 0, 0), (1, 0, 0), (0, 1, 0)], [(0, 1, 2)]), diagnostic="geometry.open-solid")
    points, faces = box()
    add("G21", mesh=(points + [(.5, -1, 0)], faces + [(0, 1, 8)]), diagnostic="geometry.nonmanifold")
    add("G22", mesh=([(0, 0, 0), (1, 0, 0), (2, 0, 0)], [(0, 1, 2)]), diagnostic="geometry.degenerate")
    for variant, value in (("nan", float("nan")), ("infinity", float("inf"))):
        add("G23", variant, mesh=([(value, 0, 0), (1, 0, 0), (0, 1, 0)], [(0, 1, 2)]), diagnostic="glb.nonfinite")

    def extension(doc, binary):
        doc["extensionsRequired"] = ["UNKNOWN_required_geometry"]
        return doc, binary
    add("G24", edit=extension, diagnostic="glb.unsupported")

    def bad_accessor(doc, binary):
        doc["accessors"][0]["count"] = 9
        return doc, binary
    add("G25", edit=bad_accessor, diagnostic="glb.accessor")

    def sparse(doc, binary):
        doc["accessors"][0]["sparse"] = {"count": 1}
        return doc, binary
    add("G26", edit=sparse, diagnostic="glb.unsupported")
    add("G27", mesh=orthogonal_union((0, .5, 1), (0, .5, 1), (0, .5), {(0, 0, 0), (1, 0, 0), (0, 1, 0)}), rich=True,
        oracle={"boxes": {"part.a": [((0, 0, 0), (1, .5, .5)), ((0, 0, 0), (.5, 1, .5))]}, "sourceVolume": .375,
                "sourceCenter": [5/12, 5/12, .25]})
    add("G28", mesh=(points, list(reversed(faces))), rich=True)
    add("G29", edit=hierarchy, oracle={**two_boxes, "parent": ["part.b", "part.a"]}, rich=True)
    result.append(replace(list(ordering_variants(result[-1]))[-1], variant="reindexed"))
    add("G30", "huge-grid", mesh=box((0, 0, 0), (100, 100, 100)),
        diagnostic={"micro-0125-research-v1": "budget.candidate_work", "standard-025-v1": "budget.grid_cells"})
    add("G30", "padded-coordinate", mesh=box((999999.875, 0, 0), (1000000, .125, .125)),
        oracle={"worldBounds": [(999999.875, 0, 0), (1000000, .125, .125)]},
        diagnostic={"micro-0125-research-v1": "budget.grid_coordinate", "standard-025-v1": "thin.too-thin"})
    if {c.case_id for c in result} != set(IDS):
        fail("golden.inventory", "exact G01-G30 required")
    return tuple(result)


def ordering_variants(case):
    for triangle_order, nodes_reverse, primitives_reverse, materials_reverse in product(("normal", "reverse", "seed42"), (False, True), (False, True), (False, True)):
        doc, binary = copy.deepcopy(case.document), bytearray(case.binary)
        touched = set()
        for mesh in doc["meshes"]:
            for primitive in mesh["primitives"]:
                index = primitive["indices"]
                if index in touched:
                    continue
                touched.add(index)
                accessor = doc["accessors"][index]
                view = doc["bufferViews"][accessor["bufferView"]]
                offset = view.get("byteOffset", 0) + accessor.get("byteOffset", 0)
                values = struct.unpack_from("<" + "H" * accessor["count"], binary, offset)
                faces = [values[i:i+3] for i in range(0, len(values), 3)]
                if triangle_order == "reverse":
                    faces.reverse()
                elif triangle_order == "seed42":
                    random.Random(42 + index).shuffle(faces)
                struct.pack_into("<" + "H" * len(values), binary, offset, *(v for face in faces for v in face))
            if primitives_reverse:
                mesh["primitives"].reverse()
        if nodes_reverse:
            size = len(doc["nodes"])
            doc["nodes"].reverse()
            for node in doc["nodes"]:
                if "children" in node:
                    node["children"] = [size - 1 - i for i in node["children"]]
            for scene in doc["scenes"]:
                scene["nodes"] = [size - 1 - i for i in scene["nodes"]]
        if materials_reverse:
            size = len(doc["materials"])
            doc["materials"].reverse()
            for mesh in doc["meshes"]:
                for primitive in mesh["primitives"]:
                    primitive["material"] = size - 1 - primitive["material"]
        name = f"{case.variant}.o-{triangle_order}-n{int(nodes_reverse)}-p{int(primitives_reverse)}-m{int(materials_reverse)}"
        raw = glb(doc, bytes(binary))
        yield replace(case, variant=name, document=doc, binary=bytes(binary), glb=raw, report=bind_report(doc, raw))


def box_cells(bounds, h, air=False):
    lo, hi = bounds
    spans = []
    for a, b in zip(lo, hi):
        a, b = Fraction(a) / h, Fraction(b) / h
        start = math.floor(a) + 1 if air else math.ceil(a) - 1
        end = math.ceil(b) - 2 if air else math.floor(b)
        spans.append(range(start, end + 1))
    return set(product(*spans))


def check(condition, reason):
    if not condition:
        fail("golden.oracle", reason)


def independent_oracle(case, package, geometry, profile):
    manifest, spec, h = package.manifest, case.oracle, Fraction(PROFILES[profile])
    connectivity = None
    expected = {}
    for owner, boxes in spec.get("boxes", {}).items():
        expected[owner] = set().union(*(box_cells(bounds, h) for bounds in boxes))
    if "cavity" in spec:
        expected["part.a"] -= box_cells(spec["cavity"], h, air=True)
    if "tunnel" in spec:
        lo, hi = spec["tunnel"]
        # A through-tunnel has no end cap; use strict yz intervals over the full x span.
        ys = range(math.floor(Fraction(lo[1])/h) + 1, math.ceil(Fraction(hi[1])/h) - 1)
        zs = range(math.floor(Fraction(lo[2])/h) + 1, math.ceil(Fraction(hi[2])/h) - 1)
        path_cells = set(product(range(-1, math.floor(Fraction(2)/h) + 1), ys, zs))
        expected["part.a"] -= path_cells
        check(bool(path_cells), "successful tunnel must have a through-body six-neighbor Air witness")
        proof = manifest["classificationProofs"]["part.a"]
        check(proof["sourceAirComponents"] == proof["rasterAirComponents"] == 1, "tunnel exterior correspondence lost")
        connectivity = {"sourceAirComponents": 1, "rasterAirComponents": 1, "witness": "All decoded cells on every straight six-neighbor x path are Air",
                        "xCellRange": [-1, math.floor(Fraction(2)/h)], "yCellRange": [ys.start, ys.stop-1], "zCellRange": [zs.start, zs.stop-1]}
    actual, bindings = {}, {s["slot"]: (s["renderMaterialId"], s["structuralMaterialId"]) for s in manifest["materialSlots"]}
    for brick in manifest["bricks"]:
        check(brick["partId"] in expected, "unexpected brick owner")
        payload = package.files[brick["path"]]
        check(len(payload) == 4096, "brick length")
        for offset, slot in enumerate(payload):
            if slot:
                cell = tuple(16 * b + p for b, p in zip(brick["coordinate"], (offset % 16, offset // 16 % 16, offset // 256)))
                identity = (brick["partId"], cell)
                check(identity not in actual, "duplicate owned cell")
                check(bindings[slot] == ("render.a", "steel.a"), "unexpected material selector")
                actual[identity] = slot
    check(set(actual) == {(owner, cell) for owner, cells in expected.items() for cell in cells}, "full independent owned interval set differs")
    bounds = {owner: [[min(c[a] for c in cells) for a in range(3)], [max(c[a] for c in cells) for a in range(3)]]
              for owner, cells in expected.items() if cells}
    grid_bounds = [{"partId": owner, "minimumCell": bounds[owner][0], "maximumCell": bounds[owner][1]} for owner in sorted(bounds)]
    check(manifest["gridBounds"] == grid_bounds, "independent occupied grid bounds differ")
    for mass in manifest["geometricMassInputs"]:
        cells = expected[mass["partId"]]
        lo, hi = bounds[mass["partId"]]
        check(mass["boundsCells"] == [lo, hi], "independent inclusive cell bounds differ")
        check(mass["boundsMeters"] == [[float(x*h) for x in lo], [float((x+1)*h) for x in hi]], "independent occupied meter bounds differ")
        check(mass["cellVolumeCubicMeters"] == float(h**3), "independent cell volume differs")
        check(mass["cellCount"] == len(cells), "owned count differs")
        sums = [float(sum((Fraction(c[a]) + Fraction(1, 2))*h for c in cells)) for a in range(3)]
        check(mass["cellCenterSumMeters"] == sums, "independent cell center sums differ")
        check(mass["occupiedCellVolumeCubicMeters"] == float(len(cells) * h**3), "raster volume differs")
    if "nonVoxel" in spec:
        check(not manifest["bricks"] and not manifest["geometricMassInputs"], "preserved semantics fabricated voxel mass")
        check(manifest["thinFeatureDecisions"][0]["replacement"]["kind"] == spec["nonVoxel"], "replacement kind differs")
    if "parent" in spec:
        child, parent = spec["parent"]
        check(next(p for p in manifest["parts"] if p["partId"] == child)["parentPartId"] == parent, "part hierarchy lost")
    for identity, origin in spec.get("placements", {}).items():
        check(next(p for p in manifest["placements"] if p["id"] == identity)["worldMatrix"][12:15] == origin, "world placement lost")
    if "interfaceId" in spec:
        check(manifest["markers"][0]["interfaceId"] == spec["interfaceId"], "CutInterface lost")
    if "materialComponents" in spec:
        proof = manifest["classificationProofs"]["part.a"]
        check(proof["sourceMaterialComponents"] == proof["rasterMaterialComponents"] == spec["materialComponents"], "disconnected components merged")
    if "sourceVolume" in spec:
        volume, moments = Fraction(0), [Fraction(0)] * 3
        for triangle in geometry.triangles:
            a, b, c = [tuple(map(Fraction, p)) for p in triangle.vertices]
            determinant = sum(a[i] * (b[(i+1)%3]*c[(i+2)%3] - b[(i+2)%3]*c[(i+1)%3]) for i in range(3))
            v = determinant / 6
            volume += v
            for axis in range(3):
                moments[axis] += v * (a[axis] + b[axis] + c[axis]) / 4
        check(float(volume) == spec["sourceVolume"] and [float(m/volume) for m in moments] == spec["sourceCenter"], "independent signed source integrals differ")
    return {"ownedCells": len(actual), "cellSets": "INDEPENDENT_FULL_INTERVAL_SETS", "sourceOracle": spec, "connectivity": connectivity}


def run_case(case, profile):
    expected = case.expected[profile]
    record = {"caseId": case.case_id, "variant": case.variant, "profileId": profile, "expected": expected,
        "sources": {"sourceGlbSha256": sha256_bytes(case.glb), "sourceReportSha256": sha256_bytes(case.report),
                    "authoringPayloadSha256": sha256_bytes(canonical_json_bytes(strict_json(case.report)["payload"]))},
        "inputBytes": {"glb": len(case.glb), "report": len(case.report)}, "admissionStage": {"status": "NOT_RUN"},
        "geometryStage": {"status": "NOT_RUN"}, "sourceBounds": None, "oracle": "PASS"}
    source = geometry = None
    try:
        admitted = admit_pair(case.glb, case.report)
        record["sources"] = admitted.sources
        source = admitted.source
        points = [p for mesh in source.primitives for primitive in mesh for p in primitive.positions]
        record["sourceBounds"] = {"scope": "DecodedLocalAccessorBounds", "bounds":
            [[min(p[a] for p in points) for a in range(3)], [max(p[a] for p in points) for a in range(3)]]}
        position_accessors = {p["attributes"]["POSITION"] for m in source.document["meshes"] for p in m["primitives"]}
        record["admissionStage"] = {"status": "VALID", "inputTriangles": sum(len(p.indices)//3 for m in source.primitives for p in m),
                                    "inputVertices": sum(source.document["accessors"][i]["count"] for i in position_accessors),
                                    "decodedPositionReferences": len(points)}
        geometry = canonicalize_geometry(source)
        record["geometryStage"] = {"status": "VALID", "worldBounds": geometry.bounds, "expandedTriangles": len(geometry.triangles),
            "normalizedGeometrySha256": geometry.normalized_geometry_sha256, "semanticsSha256": geometry.semantics_sha256}
        bounds = case.oracle.get("worldBounds")
        if bounds is None and "boxes" in case.oracle:
            boxes = [b for values in case.oracle["boxes"].values() for b in values]
            bounds = [[min(b[0][a] for b in boxes) for a in range(3)], [max(b[1][a] for b in boxes) for a in range(3)]]
        if bounds is not None and (not expected["diagnostics"] or expected["outcome"] == "BLOCKED" or "worldBounds" in case.oracle):
            check(all(math.isclose(a, b, rel_tol=0, abs_tol=1e-12) for row, other in zip(geometry.bounds, bounds) for a, b in zip(row, other)),
                  "independent world geometry bounds differ")
    except CompilerError as error:
        if error.code.startswith("golden."):
            raise
        record["geometryStage" if source is not None else "admissionStage"] = {"status": "REJECTED", "diagnostic": error.code}
    try:
        generated = compile_core(case.glb, case.report, profile)
    except CompilerError as error:
        check(expected["diagnostics"] == [error.code], f"{case.case_id}/{case.variant}: unexpected rejection code {error.code}")
        record.update(outcome=expected["outcome"], diagnostics=[error.code], blockedReason=expected["reason"])
        if hasattr(error, "decisions"):
            record["thinDecisions"] = error.decisions
        return record
    check(not expected["diagnostics"], f"{case.case_id}/{case.variant}: expected rejection was accepted")
    check(geometry is not None, "package succeeded without valid stage geometry")
    record["invariants"] = independent_oracle(case, generated, geometry, profile)
    manifest = generated.manifest
    projection = semantic_projection(manifest)
    record.update(outcome="SUCCESS", diagnostics=[], contentHashes={k: manifest[k] for k in
        ("normalizedGeometrySha256", "semanticsSha256", "voxelizationSha256")}, semanticProjection=projection,
        semanticProjectionSha256=sha256_bytes(bounded_json(projection)), manifestTreeSha256=manifest["manifestTreeSha256"],
        ownedBricks=manifest["bricks"], fileHashes={name: sha256_bytes(data) for name, data in sorted(generated.files.items())},
        outputBytes=sum(map(len, generated.files.values())), thinDecisions=manifest["thinFeatureDecisions"], _files=generated.files)
    return record


def public_record(record):
    return {key: value for key, value in record.items() if key not in ("semanticProjection", "_files")}


def pin(record):
    return {key: record[key] for key in ("sources", "outcome", "diagnostics", "geometryStage", "contentHashes",
            "semanticProjectionSha256", "manifestTreeSha256", "fileHashes", "outputBytes") if key in record}


def load_pins():
    try:
        pins = strict_json(bounded_read(PINS, "json_bytes"))
        if not isinstance(pins, dict):
            fail("golden.pins-invalid", "frozen corpus hash map required")
        return pins
    except OSError:
        raise CompilerError("golden.pins-missing", "frozen corpus hashes required; never auto-update expectations") from None


def run_corpus(case_ids=None, profiles=None, repeats=1, *, check_pins=True, ordering=True):
    selected, profiles = list(IDS if case_ids is None else case_ids), list(PROFILES if profiles is None else profiles)
    if (not selected or len(selected) != len(set(selected)) or set(selected) - set(IDS) or type(repeats) is not int
            or not 1 <= repeats <= 10 or not profiles or len(profiles) != len(set(profiles)) or set(profiles) - set(PROFILES)):
        fail("golden.arguments", "bounded G01-G30/profile selection and repeats 1..10 required")
    pins = load_pins() if check_pins else None
    records, input_files = [], {}
    for case in corpus():
        if case.case_id not in selected:
            continue
        variants = (case, *ordering_variants(case)) if ordering and case.case_id in ORDER_IDS else (case,)
        baselines = {}
        for variant in variants:
            input_files[f"inputs/{case.case_id}/{variant.variant}.glb"] = variant.glb
            input_files[f"inputs/{case.case_id}/{variant.variant}.report.json"] = variant.report
            for profile in profiles:
                record = run_case(variant, profile)
                baseline = baselines.setdefault(profile, record)
                if variant is not case:
                    check(record["outcome"] == baseline["outcome"] and record["diagnostics"] == baseline["diagnostics"], "ordering changes diagnostic outcome")
                    check(record["geometryStage"] == baseline["geometryStage"], "ordering changes canonical geometry or placements")
                    if record["outcome"] == "SUCCESS":
                        check(record["contentHashes"] == baseline["contentHashes"], "ordering changes content hashes")
                        check(bounded_json(record["semanticProjection"]) == bounded_json(baseline["semanticProjection"]), "ordering changes EXACT projection")
                        check({k: v for k, v in record["_files"].items() if k.startswith("bricks/")} ==
                              {k: v for k, v in baseline["_files"].items() if k.startswith("bricks/")}, "ordering changes actual owned brick bytes")
                        if variant.glb == case.glb and variant.report == case.report:
                            check(record["_files"] == baseline["_files"], "same source bytes change ANY output/diagnostic/tree byte")
                for _ in range(repeats - 1):
                    repeated = run_case(variant, profile)
                    check(public_record(repeated) == public_record(record), "same input repeat changes diagnostics/hash evidence")
                    check(repeated.get("_files") == record.get("_files"), "same pinned bytes change ANY package output byte")
                key = f"{case.case_id}/{variant.variant}/{profile}"
                if pins is not None:
                    if key not in pins or bounded_json(pin(record)) != bounded_json(pins[key]):
                        fail("golden.pin-mismatch", "frozen corpus pin mismatch; expectations are never updated automatically")
                records.append(record)
    # Opposite inner winding is NOT oriented geometry/projection identity.
    hollow = [r for r in records if r["caseId"] == "G13" and ".o-" not in r["variant"]]
    for profile in profiles:
        matching = [r for r in hollow if r["profileId"] == profile]
        if len(matching) == 2:
            check(matching[0]["ownedBricks"] == matching[1]["ownedBricks"], "inner winding changes even/odd hollow bricks")
        remapped = [r for r in records if r["caseId"] == "G29" and r["profileId"] == profile]
        if len(remapped) == 2:
            check(remapped[0]["geometryStage"] == remapped[1]["geometryStage"], "G29 reindex changes geometry/placements")
            check(remapped[0]["contentHashes"] == remapped[1]["contentHashes"]
                  and bounded_json(remapped[0]["semanticProjection"]) == bounded_json(remapped[1]["semanticProjection"]), "G29 reindex changes EXACT content/projection")
            check({p: b for p, b in remapped[0]["_files"].items() if p.startswith("bricks/")} ==
                  {p: b for p, b in remapped[1]["_files"].items() if p.startswith("bricks/")}, "G29 reindex changes owned bytes")
    counts = {outcome: sum(r["outcome"] == outcome for r in records) for outcome in ("SUCCESS", "EXPECTED_REJECTION", "BLOCKED")}
    summary = {"schema": "hestia.asset-compiler-golden.c7.v1", "status": "C7_SMOKE_PASS", "caseIds": selected,
               "profiles": profiles, "repeats": repeats, "orderingMatrix": "3x2x2x2" if ordering else "NOT_RUN",
               "recordCount": len(records), "outcomeCounts": counts, "gwn": GWN_DECISION, "productIntegrated": False,
               "finalC8Acceptance": "NOT_RUN"}
    files = dict(input_files)
    files["corpus-run.json"] = bounded_json(summary)
    for identity in selected:
        files[f"records/{identity}.json"] = bounded_json([public_record(r) for r in records if r["caseId"] == identity])
    return summary, files, {f"{r['caseId']}/{r['variant']}/{r['profileId']}": pin(r) for r in records}
