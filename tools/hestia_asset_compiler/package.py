"""Report-bound deterministic research packages and Windows no-replace publication."""

from dataclasses import dataclass
from fractions import Fraction
import math
import os
from pathlib import Path
import re
import shutil
import stat
import sys
import tempfile

from tools.blender.hestia_asset_authoring.canonical import canonical_json_bytes, canonicalize, sha256_bytes
from . import COMPILER_VERSION
from .admission import admit_pair, digest, report_semantics, validate_inventory, validate_options
from .classification import CLASSIFICATION_VERSION, RAY_VERSION, TOPOLOGY_VERSION, classify_cells
from .errors import CompilerError
from .geometry import GEOMETRY_VERSION, canonicalize_geometry, valid_matrix, world_point
from .glb import bounded_read, fail, finite_vector, integer, positive, sequence, shape, strict_json
from .profiles import BUDGETS, BUDGET_VERSION, PROFILES, check_budget
from .thin import MATERIAL_VERSION, REPLACEMENT_VERSION, THIN_VERSION, check_material_intent, thin_gate
from .voxel import ADDRESS_VERSION, SURFACE_VERSION, Binding, brick_address, pack_bricks

SCHEMA = "hestia.asset-compiler-spike.v1"
COMPILER = {"id": "hestia.asset-compiler-spike", "version": COMPILER_VERSION}
VOXEL_VERSION = "spike-owned-package-voxelization-v1"
TREE_VERSION = "spike-virtual-manifest-tree-v1"
MASS_VERSION = "spike-owned-cell-geometric-inputs-v1"
ALGORITHMS = {"geometry": GEOMETRY_VERSION, "surface": SURFACE_VERSION, "address": ADDRESS_VERSION,
              "classification": CLASSIFICATION_VERSION, "ray": RAY_VERSION, "topology": TOPOLOGY_VERSION,
              "thin": THIN_VERSION, "replacement": REPLACEMENT_VERSION, "material": MATERIAL_VERSION,
              "voxelization": VOXEL_VERSION, "tree": TREE_VERSION, "geometricInputs": MASS_VERSION, "budgets": BUDGET_VERSION}
METADATA = {"asset-manifest.json", "diagnostics.json", "provenance.json", "compile-report.json"}
SOURCE_FIELDS = {"sources", "provenanceSha256", "manifestTreeSha256"}
VOXEL_FIELDS = ("schema", "profileId", "algorithmVersions", "cellMeters", "brickCellsPerAxis", "cellOrder",
                "gridBounds", "materialSlots", "bricks", "thinFeatureDecisions", "classificationProofs", "geometricMassInputs")


def json_bound(value, depth=0):
    """Conservative encoded-byte/token bounds BEFORE canonical copies/encoding."""
    check_budget("json_depth", depth)
    if value is None or type(value) is bool:
        return 5, 0
    if type(value) in (int, float):
        if not math.isfinite(value):
            fail("package.number", "finite metadata required")
        return len(str(value)), 0
    if type(value) is str:
        size = 2
        for char in value:
            code = ord(char)
            if 0xD800 <= code <= 0xDFFF:
                fail("package.string", "UTF-8 metadata required")
            size += 6 if code < 32 else 2 if char in '\\"' else 1 if code < 128 else 2 if code < 2048 else 3 if code < 65536 else 4
        check_budget("json_bytes", size)
        return size, 0
    if isinstance(value, dict):
        items = value.items()
        size, tokens = 2 + max(0, len(value) - 1) + len(value), 1 + 2 * len(value)
        for key, item in items:
            if type(key) is not str:
                fail("package.structure", "string metadata keys required")
            for child in (key, item):
                amount, count = json_bound(child, depth + 1)
                size, tokens = size + amount, tokens + count
                check_budget("json_bytes", size)
                check_budget("json_tokens", tokens)
        return size, tokens
    if isinstance(value, (list, tuple)):
        size, tokens = 2 + max(0, len(value) - 1), 1 + len(value)
        for item in value:
            amount, count = json_bound(item, depth + 1)
            size, tokens = size + amount, tokens + count
            check_budget("json_bytes", size)
            check_budget("json_tokens", tokens)
        return size, tokens
    fail("package.structure", "JSON metadata required")


def bounded_json(value):
    json_bound(value)
    data = canonical_json_bytes(value)
    check_budget("json_bytes", len(data))
    return data


def semantic_projection(manifest):
    return {key: value for key, value in manifest.items() if key not in SOURCE_FIELDS}


def voxel_preimage(manifest):
    return {key: manifest[key] for key in VOXEL_FIELDS}


def tree_hash(files):
    entries = []
    for path, data in sorted(files.items()):
        if path == "asset-manifest.json":
            manifest = strict_json(data)
            data = bounded_json({key: value for key, value in manifest.items() if key != "manifestTreeSha256"})
        entries.append({"path": path, "byteLength": len(data), "sha256": sha256_bytes(data)})
    return sha256_bytes(bounded_json({"treeVersion": TREE_VERSION, "files": entries}))


def mass_inputs(entries, h):
    groups = {}
    for part_id, cell, binding in entries:
        key = (part_id, binding.structural_material_id)
        group = groups.setdefault(key, {"count": 0, "sums": [0, 0, 0], "lo": list(cell), "hi": list(cell)})
        group["count"] += 1
        for a in range(3):
            group["sums"][a] += cell[a]
            group["lo"][a] = min(group["lo"][a], cell[a])
            group["hi"][a] = max(group["hi"][a], cell[a])
    result = []
    for (part_id, structural), group in sorted(groups.items(), key=lambda item: (item[0][0], item[0][1] or "")):
        count = group["count"]
        result.append({"partId": part_id, "structuralMaterialId": structural,
            "applicability": "GeometricOnly" if structural is not None else "UnboundGeometry",
            "ownershipConvention": "PerPartContributions; overlaps are not net unique physical volume",
            "algorithm": MASS_VERSION, "cellCount": count, "cellVolumeCubicMeters": float(h ** 3),
            "occupiedCellVolumeCubicMeters": float(count * h ** 3),
            "cellCenterSumMeters": [float((Fraction(s) + Fraction(count, 2)) * h) for s in group["sums"]],
            "boundsCells": [group["lo"], group["hi"]],
            "boundsMeters": [[float(x * h) for x in group["lo"]], [float((x + 1) * h) for x in group["hi"]]]})
    return result


@dataclass(frozen=True)
class CompiledPackage:
    manifest: dict
    files: dict


def compile_core(glb_bytes, report_bytes, profile_id):
    if type(profile_id) is not str or profile_id not in PROFILES:
        fail("profile.required", "one explicit frozen research profile required")
    admitted = admit_pair(glb_bytes, report_bytes)
    geometry = canonicalize_geometry(admitted.source)
    decisions, projection, _ = thin_gate(geometry, profile_id)
    result = classify_cells(projection, profile_id)
    h = Fraction(PROFILES[profile_id])
    active = sorted(set(result.cells.values()), key=lambda b: (b.render_material_id, b.structural_material_id or ""))
    if len(active) > 255:
        fail("surface.material-slots", "only actual voxelized bindings count toward 255 slots")
    addresses = sorted({(part_id, brick_address(cell)[0]) for part_id, cell in result.cells})
    check_budget("bricks", len(addresses))
    slots = [{"slot": i + 1, "renderMaterialId": b.render_material_id, "structuralMaterialId": b.structural_material_id}
             for i, b in enumerate(active)]
    bricks = []
    for part_id, coordinate in addresses:
        key = sha256_bytes(bounded_json({"partId": part_id, "brickCoordinate": coordinate, "addressVersion": ADDRESS_VERSION}))
        bricks.append({"key": key, "path": f"bricks/{key}.bin", "partId": part_id, "coordinate": list(coordinate),
                       "byteLength": 4096, "sha256": "0" * 64})
    mass = mass_inputs(((p, cell, binding) for (p, cell), binding in result.cells.items()), h)
    grid_bounds = []
    for part_id in sorted(result.domains):
        groups = [m for m in mass if m["partId"] == part_id]
        grid_bounds.append({"partId": part_id, "minimumCell": [min(m["boundsCells"][0][a] for m in groups) for a in range(3)],
                            "maximumCell": [max(m["boundsCells"][1][a] for m in groups) for a in range(3)]})
    source_diagnostics = admitted.report["payload"]["diagnostics"]
    summary = {severity: sum(d["severity"] == severity for d in source_diagnostics) for severity in ("info", "warning", "error")}
    diagnostics = {"schema": SCHEMA, "diagnostics": [{"severity": "info", "code": "compile.admitted",
                    "assetId": geometry.semantics["asset"]["assetId"], "message": "Report-bound research package; no runtime integration"}],
                   "authoringDiagnosticCounts": summary}
    provenance = {"schema": SCHEMA, "sources": admitted.sources, "sourceInventory": admitted.report["payload"]["inventory"],
                  "authoringOptions": admitted.report["payload"]["options"], "authoringToolVersion": "UNRECORDED",
                  "authoringDiagnosticCounts": summary}
    manifest = {"schema": SCHEMA, "profileId": profile_id, "compiler": COMPILER, "algorithmVersions": ALGORITHMS,
        "assetId": geometry.semantics["asset"]["assetId"], "assetRevision": geometry.semantics["asset"]["assetRevision"],
        "authoringSchema": geometry.semantics["schema"], "asset": geometry.semantics["asset"],
        "coordinateFrame": geometry.semantics["asset"]["coordinateFrame"], "metersPerUnit": 1,
        "cellMeters": float(h), "brickCellsPerAxis": 16, "cellOrder": "x-fastest", "gridBounds": grid_bounds,
        "materials": geometry.semantics["materials"], "materialSlots": slots, "parts": geometry.semantics["parts"],
        "joints": geometry.semantics["joints"], "markers": geometry.semantics["markers"], "placements": geometry.placements,
        "bricks": bricks, "thinFeatureDecisions": decisions, "classificationProofs": result.proofs,
        "geometricMassInputs": mass, "diagnosticsSummary": summary, "sources": admitted.sources,
        "normalizedGeometrySha256": geometry.normalized_geometry_sha256, "semanticsSha256": geometry.semantics_sha256,
        "voxelizationSha256": "0" * 64, "provenanceSha256": "0" * 64, "manifestTreeSha256": "0" * 64}
    report = {"schema": SCHEMA, "status": "COMPILED_RESEARCH_PACKAGE", "compiler": COMPILER,
              "ownedCellCount": len(result.cells), "brickCount": len(bricks), "semanticProjectionSha256": "0" * 64,
              "contentHashes": {key: manifest[key] for key in ("normalizedGeometrySha256", "semanticsSha256", "voxelizationSha256")}}
    documents = {"asset-manifest.json": manifest, "diagnostics.json": diagnostics, "provenance.json": provenance, "compile-report.json": report}
    # Exact owned addresses and bounded metadata precede ANY 4096-byte brick payload allocation.
    check_budget("output_bytes", len(bricks) * 4096 + sum(json_bound(document)[0] for document in documents.values()))
    packed, _ = pack_bricks((p, cell, binding) for (p, cell), binding in result.cells.items())
    files = {f"bricks/{brick.key}.bin": brick.data for brick in packed}
    hashes = {brick.key: brick.sha256 for brick in packed}
    for brick in bricks:
        brick["sha256"] = hashes[brick["key"]]
    manifest["voxelizationSha256"] = sha256_bytes(bounded_json(voxel_preimage(manifest)))
    files["provenance.json"] = bounded_json(provenance)
    manifest["provenanceSha256"] = sha256_bytes(files["provenance.json"])
    report["contentHashes"]["voxelizationSha256"] = manifest["voxelizationSha256"]
    report["semanticProjectionSha256"] = sha256_bytes(bounded_json(semantic_projection(manifest)))
    files.update({name: bounded_json(value) for name, value in documents.items() if name != "provenance.json"})
    manifest["manifestTreeSha256"] = tree_hash(files)
    files["asset-manifest.json"] = bounded_json(manifest)
    check_budget("output_bytes", sum(map(len, files.values())))
    verify_files(files)
    return CompiledPackage(canonicalize(manifest), files)


def compile_files(glb_path, report_path, profile_id):
    if report_path is None:
        fail("report.required", "an authoring sidecar is required")
    if any(not isinstance(path, (str, os.PathLike)) for path in (glb_path, report_path)):
        fail("input.path", "explicit caller-provided source paths required; no file-descriptor aliases")
    try:
        return compile_core(bounded_read(glb_path, "glb_bytes"), bounded_read(report_path, "report_bytes"), profile_id)
    except OSError:
        raise CompilerError("input.io", "bounded source read failed") from None


def read_ratio(value):
    shape(value, ["numerator", "denominator"], ["numerator", "denominator"], "package.thin")
    if (type(value["numerator"]) is not str or re.fullmatch("-?[0-9]{1,400}", value["numerator"]) is None
            or type(value["denominator"]) is not str or re.fullmatch("[0-9]{1,400}", value["denominator"]) is None):
        fail("package.thin", "bounded exact Float64-derived decimal ratio required")
    denominator = int(value["denominator"])
    if denominator <= 0:
        fail("package.thin", "positive exact ratio denominator required")
    return Fraction(int(value["numerator"]), denominator)


def validate_decision(decision, part, h, semantics, material_by_id):
    if decision.get("policy") != part["thinFeature"]["policy"]:
        fail("package.thin", "thin policy must retain original intent")
    if decision["outcome"] == "Voxelized":
        if part["representation"] != "Solid":
            fail("package.thin", "only proved Solid sections authorize voxel cells")
        proof = decision.get("proof", {})
        witness = proof.get("thinSectionWitness", {})
        ratio = witness.get("exactLengthRatio", {})
        if proof.get("scope") != "ExactOrthogonalMaterialAxisSections" or proof.get("samplingThresholdMeters") != 2 * h:
            fail("package.thin", "actual versioned section witness required")
        length = read_ratio(ratio)
        if length < 2 * h:
            fail("package.thin", "exact section witness does not meet sampling margin")
        axis = integer(witness["axis"], maximum=2, code="package.thin")
        endpoints = sequence(witness["endpointsMeters"], "package.thin")
        if len(endpoints) != 2:
            fail("package.thin", "two actual section endpoints required")
        for point in endpoints:
            finite_vector(point, 3, "package.thin")
        exact = sequence(witness["exactEndpointRatios"], "package.thin")
        if len(exact) != 2 or any(len(sequence(point, "package.thin")) != 3 for point in exact):
            fail("package.thin", "two fully specified exact section endpoints required")
        points = [[read_ratio(value) for value in point] for point in exact]
        if (any(abs(x) > BUDGETS["world_coordinate"] for point in points for x in point)
                or [[float(x) for x in point] for point in points] != endpoints or points[1][axis] - points[0][axis] != length
                or any(points[0][a] != points[1][a] for a in range(3) if a != axis)):
            fail("package.thin", "section witness endpoint/length mismatch")
    elif decision["outcome"] == "PreservedSemantic":
        replacement = decision.get("replacement", {})
        kind = replacement.get("kind")
        if kind == "SemanticAssemblyGraph":
            children = sorted(p["partId"] for p in semantics["parts"] if p.get("parentPartId") == part["partId"])
            if part["representation"] != "StructuralAssembly" or replacement.get("childPartIds") != children:
                fail("package.thin", "usable semantic assembly graph required")
        elif kind in ("RectangularPrismBeam", "RectangularSingleLayerMidplaneShell"):
            if replacement.get("replacementVersion") != REPLACEMENT_VERSION:
                fail("package.thin", "versioned reconstructable replacement required")
            material = material_by_id.get(replacement.get("renderMaterialId"))
            if material is None or replacement.get("structuralMaterialId") != material.get("structuralMaterialId"):
                fail("package.thin", "replacement must retain a declared render/structural binding")
            check_material_intent(part, {Binding(material["renderMaterialId"], material.get("structuralMaterialId"))}, semantics["asset"])
            lo = finite_vector(replacement["boundsMinMeters"], 3, "package.thin")
            hi = finite_vector(replacement["boundsMaxMeters"], 3, "package.thin")
            extents = [Fraction(b) - Fraction(a) for a, b in zip(lo, hi)]
            if kind == "RectangularPrismBeam":
                axis = integer(replacement["axis"], maximum=2, code="package.thin")
                cross_section = [float(extents[a]) for a in range(3) if a != axis]
                if (part["representation"] != "Solid" or part["thinFeature"]["policy"] != "PreserveAsBeam"
                        or any(x <= 0 for x in extents) or extents[axis] < 4 * max(extents[a] for a in range(3) if a != axis)
                        or replacement["lengthMeters"] != float(extents[axis])
                        or replacement["crossSectionMeters"] != cross_section):
                    fail("package.thin", "beam parameters must reconstruct exact measured box")
            else:
                shell = part.get("shell", {})
                positive(replacement["thicknessMeters"], "package.thin")
                normal = finite_vector(replacement["normal"], 3, "package.thin")
                normal_axes = [a for a, n in enumerate(normal) if n != 0]
                if (part["representation"] not in ("Shell", "LayeredShell") or part["thinFeature"]["policy"] != "PreserveAsShell"
                        or len(shell.get("layers", [])) != 1 or sum(x == 0 for x in extents) != 1 or any(x < 0 for x in extents)
                        or len(normal_axes) != 1 or abs(normal[normal_axes[0]]) != 1 or extents[normal_axes[0]] != 0
                        or replacement["layerIntent"] != shell.get("layers") or replacement["thicknessMeters"] != shell.get("thicknessMeters")
                        or shell["layers"][0]["structuralMaterialId"] != replacement["structuralMaterialId"]
                        or replacement.get("extrusionConvention") != "SymmetricAboutMeasuredSurfacePlane"):
                    fail("package.thin", "single-layer rectangular midplane shell parameters required")
        else:
            fail("package.thin", "unsupported/missing reconstructable replacement")
    elif part["representation"] != "Decorative" and (part["thinFeature"]["policy"] != "DecorativeOnly"
            or part["destructible"] or part["collisionPolicy"] != "None" or part["navigationPolicy"] != "None"):
        fail("package.thin", "DecorativeOnly cannot erase authoritative structural policy")


def validate_proofs(proofs, voxelized):
    shape(proofs, voxelized, voxelized, "package.proofs")
    fields = ("topologyVersion homotopyEquivalent conservativeInclusion sourceEuler rasterEuler sourceMaterialComponents "
              "rasterMaterialComponents sourceAirComponents rasterAirComponents certifiedAdditions attachmentAttempts "
              "representation filled classificationVersion rayVersion sourceArrangementCells commonRefinementCells").split()
    for proof in proofs.values():
        shape(proof, fields, fields, "package.proofs")
        if (proof["representation"] != "Solid" or proof["filled"] is not True or proof["homotopyEquivalent"] is not True
                or proof["conservativeInclusion"] is not True or proof["topologyVersion"] != TOPOLOGY_VERSION
                or proof["classificationVersion"] != CLASSIFICATION_VERSION or proof["rayVersion"] != RAY_VERSION):
            fail("package.proofs", "actual admitted versioned Solid proof descriptors required")
        for key in ("sourceEuler", "rasterEuler"):
            integer(proof[key], -27 * BUDGETS["grid_cells"], 27 * BUDGETS["grid_cells"], "package.proofs")
        for key in ("sourceMaterialComponents", "rasterMaterialComponents", "sourceAirComponents", "rasterAirComponents",
                    "sourceArrangementCells", "commonRefinementCells"):
            integer(proof[key], 1, BUDGETS["grid_cells"], "package.proofs")
        integer(proof["certifiedAdditions"], maximum=proof["commonRefinementCells"], code="package.proofs")
        integer(proof["attachmentAttempts"], proof["certifiedAdditions"], 27 * proof["commonRefinementCells"], "package.proofs")
        if any(proof[a] != proof[b] for a, b in (("sourceEuler", "rasterEuler"),
                ("sourceMaterialComponents", "rasterMaterialComponents"), ("sourceAirComponents", "rasterAirComponents"))):
            fail("package.proofs", "admitted topology correspondence cannot report a loss")


def verify_files(files):
    try:
        return _verify_files(files)
    except (TypeError, ValueError, KeyError, IndexError, AttributeError, OverflowError) as exc:
        if isinstance(exc, CompilerError):
            raise
        raise CompilerError("package.structure", "invalid closed package metadata") from None


def _verify_files(files):
    """Recompute bindings, masses and hashes from the actual generated/file bytes."""
    if not isinstance(files, dict) or len(files) > BUDGETS["bricks"] + len(METADATA):
        fail("package.inventory", "bounded package file inventory required")
    for path, data in files.items():
        if type(path) is not str or (path not in METADATA and re.fullmatch(r"bricks/[0-9a-f]{64}\.bin", path) is None) or type(data) is not bytes:
            fail("package.inventory", "only fixed metadata and hashed brick paths allowed")
    check_budget("output_bytes", sum(map(len, files.values())))
    if not METADATA <= set(files):
        fail("package.inventory", "all four metadata files required")
    docs = {name: strict_json(files[name]) for name in METADATA}
    if any(bounded_json(value) != files[name] for name, value in docs.items()):
        fail("package.canonical", "canonical deterministic metadata required")
    manifest = docs["asset-manifest.json"]
    fields = ("schema profileId compiler algorithmVersions assetId assetRevision authoringSchema asset coordinateFrame metersPerUnit cellMeters "
              "brickCellsPerAxis cellOrder gridBounds materials materialSlots parts joints markers placements bricks thinFeatureDecisions "
              "classificationProofs geometricMassInputs diagnosticsSummary sources normalizedGeometrySha256 semanticsSha256 "
              "voxelizationSha256 provenanceSha256 manifestTreeSha256").split()
    shape(manifest, fields, fields, "package.manifest")
    if (manifest["schema"] != SCHEMA or manifest["compiler"] != COMPILER or manifest["algorithmVersions"] != ALGORITHMS
            or type(manifest["profileId"]) is not str or manifest["profileId"] not in PROFILES
            or type(manifest["cellMeters"]) not in (int, float) or manifest["cellMeters"] != PROFILES[manifest["profileId"]]
            or type(manifest["brickCellsPerAxis"]) is not int or manifest["brickCellsPerAxis"] != 16
            or manifest["cellOrder"] != "x-fastest" or type(manifest["metersPerUnit"]) not in (int, float) or manifest["metersPerUnit"] != 1):
        fail("package.manifest", "exact versioned research format required")
    semantics = report_semantics({"schema": manifest["authoringSchema"], "asset": manifest["asset"],
                                 **{key: manifest[key] for key in ("parts", "joints", "markers", "materials")}})
    if (manifest["coordinateFrame"] != semantics["asset"]["coordinateFrame"] or manifest["assetId"] != semantics["asset"]["assetId"]
            or type(manifest["assetRevision"]) is not int or manifest["assetRevision"] != semantics["asset"]["assetRevision"]):
        fail("package.manifest", "flattened manifest identity/frame must agree with canonical semantics")
    placements = sequence(manifest["placements"], "package.placements")
    expected = {(kind, item[kind + "Id"]) for kind, collection in (("part", "parts"), ("joint", "joints"), ("marker", "markers")) for item in semantics[collection]}
    seen = set()
    for entry in placements:
        shape(entry, ["kind", "id", "worldMatrix"], ["kind", "id", "worldMatrix"], "package.placements")
        identity = (entry["kind"], entry["id"])
        if identity not in expected or identity in seen:
            fail("package.placements", "exactly one placement per stable semantic ID required")
        seen.add(identity)
        world_point(valid_matrix(finite_vector(entry["worldMatrix"], 16, "package.placements")), (0, 0, 0))
    if seen != expected or placements != sorted(placements, key=lambda entry: (entry["kind"], entry["id"])):
        fail("package.placements", "complete sorted placement inventory required")
    semantic_hash = sha256_bytes(bounded_json({"semantics": semantics, "placements": placements}))
    if semantic_hash != manifest["semanticsSha256"]:
        fail("package.semantics-hash", "actual semantic/placement bytes differ")
    parts = {p["partId"]: p for p in semantics["parts"]}
    material_by_id = {m["renderMaterialId"]: m for m in semantics["materials"]}
    decisions = sequence(manifest["thinFeatureDecisions"], "package.thin")
    outcomes = {}
    for decision in decisions:
        part_id = decision.get("partId") if isinstance(decision, dict) else None
        if (part_id not in parts or part_id in outcomes or decision.get("outcome") not in ("Voxelized", "PreservedSemantic", "DecorativeOnly")
                or decision.get("intent") != parts[part_id]["thinFeature"] or decision.get("thinVersion") != THIN_VERSION):
            fail("package.thin", "complete admitted thin decisions required")
        if decision["outcome"] == "PreservedSemantic" and not isinstance(decision.get("replacement"), dict):
            fail("package.thin", "real replacement parameters required")
        validate_decision(decision, parts[part_id], Fraction(manifest["cellMeters"]), semantics, material_by_id)
        outcomes[part_id] = decision["outcome"]
    if set(outcomes) != set(parts):
        fail("package.thin", "no silently missing semantic part")
    validate_proofs(manifest["classificationProofs"], {p for p, outcome in outcomes.items() if outcome == "Voxelized"})
    slots = sequence(manifest["materialSlots"], "package.slots")
    if len(slots) > 255:
        fail("surface.material-slots", "active byte slots exceed 255")
    bindings = {}
    for i, item in enumerate(slots, 1):
        shape(item, ["slot", "renderMaterialId", "structuralMaterialId"], ["slot", "renderMaterialId", "structuralMaterialId"], "package.slots")
        if type(item["slot"]) is not int or item["slot"] != i or item["renderMaterialId"] not in material_by_id:
            fail("package.slots", "sequential stable semantic slots required")
        material = material_by_id[item["renderMaterialId"]]
        if item["structuralMaterialId"] != material.get("structuralMaterialId"):
            fail("package.slots", "slot binding disagrees with declared material")
        bindings[i] = Binding(item["renderMaterialId"], item["structuralMaterialId"])
    if len(set(bindings.values())) != len(bindings) or list(bindings.values()) != sorted(bindings.values(), key=lambda b: (b.render_material_id, b.structural_material_id or "")):
        fail("package.slots", "unique lexically ordered bindings required")
    bricks = sequence(manifest["bricks"], "package.bricks")
    check_budget("bricks", len(bricks))
    expected_paths, addresses, entries, used = set(METADATA), set(), [], set()
    for brick in bricks:
        fields = ["key", "path", "partId", "coordinate", "byteLength", "sha256"]
        shape(brick, fields, fields, "package.bricks")
        part_id = brick["partId"]
        if outcomes.get(part_id) != "Voxelized":
            fail("package.bricks", "brick owner must be an admitted voxelized Part")
        coordinate = sequence(brick["coordinate"], "package.bricks")
        if len(coordinate) != 3:
            fail("package.bricks", "three integer brick coordinates required")
        for value in coordinate:
            integer(value, -BUDGETS["grid_coordinate"], BUDGETS["grid_coordinate"], "package.bricks")
        address = (part_id, tuple(coordinate))
        key = sha256_bytes(bounded_json({"partId": part_id, "brickCoordinate": coordinate, "addressVersion": ADDRESS_VERSION}))
        if (address in addresses or brick["key"] != key or brick["path"] != f"bricks/{key}.bin"
                or type(brick["byteLength"]) is not int or brick["byteLength"] != 4096):
            fail("package.bricks", "unique owned address/key/length binding required")
        addresses.add(address)
        path = brick["path"]
        expected_paths.add(path)
        data = files.get(path)
        if data is None or len(data) != 4096 or sha256_bytes(data) != digest(brick["sha256"]) or not any(data):
            fail("package.brick-hash", "actual non-Air brick bytes must match length/SHA")
        for offset, slot in enumerate(data):
            if slot:
                if slot not in bindings:
                    fail("package.slots", "unknown non-Air byte slot")
                binding = bindings[slot]
                check_material_intent(parts[part_id], {binding}, semantics["asset"])
                used.add(slot)
                local = (offset % 16, offset // 16 % 16, offset // 256)
                cell = tuple(16 * b + x for b, x in zip(coordinate, local))
                for value in cell:
                    check_budget("grid_coordinate", abs(value))
                check_budget("grid_cells", len(entries) + 1)
                entries.append((part_id, cell, binding))
    if set(files) != expected_paths or used != set(bindings):
        fail("package.inventory", "no unexpected files or unused byte slots allowed")
    masses = mass_inputs(entries, Fraction(manifest["cellMeters"]))
    for mass in sequence(manifest["geometricMassInputs"], "package.geometric-inputs"):
        integer(mass["cellCount"], 1, BUDGETS["grid_cells"], "package.geometric-inputs")
        for cell in mass["boundsCells"]:
            if len(sequence(cell, "package.geometric-inputs")) != 3:
                fail("package.geometric-inputs", "three integer cell bounds required")
            for value in cell:
                integer(value, -BUDGETS["grid_coordinate"], BUDGETS["grid_coordinate"], "package.geometric-inputs")
    if masses != manifest["geometricMassInputs"]:
        fail("package.geometric-inputs", "geometric inputs must match actual decoded owned cells")
    grid_bounds = []
    for part_id in sorted({p for p, _, _ in entries}):
        groups = [m for m in masses if m["partId"] == part_id]
        grid_bounds.append({"partId": part_id, "minimumCell": [min(m["boundsCells"][0][a] for m in groups) for a in range(3)],
                            "maximumCell": [max(m["boundsCells"][1][a] for m in groups) for a in range(3)]})
    if grid_bounds != manifest["gridBounds"]:
        fail("package.grid-bounds", "grid bounds must match actual decoded owned cells, excluding padding")
    for bound in sequence(manifest["gridBounds"], "package.grid-bounds"):
        shape(bound, ["partId", "minimumCell", "maximumCell"], ["partId", "minimumCell", "maximumCell"], "package.grid-bounds")
        for name in ("minimumCell", "maximumCell"):
            if len(sequence(bound[name], "package.grid-bounds")) != 3:
                fail("package.grid-bounds", "three integer cell bounds required")
            for value in bound[name]:
                integer(value, -BUDGETS["grid_coordinate"], BUDGETS["grid_coordinate"], "package.grid-bounds")
    if {part_id for part_id, _, _ in entries} != {p for p, outcome in outcomes.items() if outcome == "Voxelized"}:
        fail("package.bricks", "voxelized Parts must have actual owned cells")
    if sha256_bytes(bounded_json(voxel_preimage(manifest))) != manifest["voxelizationSha256"]:
        fail("package.voxelization-hash", "actual voxelization preimage differs")
    if sha256_bytes(files["provenance.json"]) != manifest["provenanceSha256"] or docs["provenance.json"].get("sources") != manifest["sources"]:
        fail("package.provenance", "actual source provenance bytes differ")
    provenance = docs["provenance.json"]
    fields = ["schema", "sources", "sourceInventory", "authoringOptions", "authoringToolVersion", "authoringDiagnosticCounts"]
    shape(provenance, fields, fields, "package.provenance")
    if provenance["schema"] != SCHEMA or provenance["authoringToolVersion"] != "UNRECORDED":
        fail("package.provenance", "actual source provenance format required; no invented exporter version")
    validate_inventory(provenance["sourceInventory"], semantics)
    validate_options(provenance["authoringOptions"])
    summary = manifest["diagnosticsSummary"]
    shape(summary, ["info", "warning", "error"], ["info", "warning", "error"], "package.diagnostics")
    for count in summary.values():
        integer(count, code="package.diagnostics")
    if summary["error"] != 0 or provenance["authoringDiagnosticCounts"] != summary:
        fail("package.diagnostics", "no authoring Error or inconsistent source count")
    diagnostic_file = docs["diagnostics.json"]
    shape(diagnostic_file, ["schema", "diagnostics", "authoringDiagnosticCounts"], ["schema", "diagnostics", "authoringDiagnosticCounts"], "package.diagnostics")
    if (diagnostic_file["schema"] != SCHEMA or diagnostic_file["authoringDiagnosticCounts"] != summary
            or diagnostic_file["diagnostics"] != [{"severity": "info", "code": "compile.admitted", "assetId": manifest["assetId"],
                "message": "Report-bound research package; no runtime integration"}]):
        fail("package.diagnostics", "only stable compiler-owned diagnostics/counts admitted")
    source_fields = ["sourceGlbSha256", "sourceReportSha256", "authoringPayloadSha256"]
    shape(manifest["sources"], source_fields, source_fields, "package.provenance")
    for value in manifest["sources"].values():
        digest(value)
    report = docs["compile-report.json"]
    fields = ["schema", "status", "compiler", "ownedCellCount", "brickCount", "semanticProjectionSha256", "contentHashes"]
    shape(report, fields, fields, "package.compile-report")
    if report["schema"] != SCHEMA or report["compiler"] != COMPILER or report["status"] != "COMPILED_RESEARCH_PACKAGE":
        fail("package.compile-report", "research-only compile status required")
    integer(report["ownedCellCount"], maximum=BUDGETS["grid_cells"], code="package.compile-report")
    integer(report["brickCount"], maximum=BUDGETS["bricks"], code="package.compile-report")
    if (report.get("contentHashes") != {key: manifest[key] for key in ("normalizedGeometrySha256", "semanticsSha256", "voxelizationSha256")}
            or report.get("ownedCellCount") != len(entries) or report.get("brickCount") != len(bricks)
            or report.get("semanticProjectionSha256") != sha256_bytes(bounded_json(semantic_projection(manifest)))):
        fail("package.compile-report", "actual manifest/count/projection bindings differ")
    for key in ("normalizedGeometrySha256", "semanticsSha256", "voxelizationSha256", "manifestTreeSha256"):
        digest(manifest[key])
    if tree_hash(files) != manifest["manifestTreeSha256"]:
        fail("package.tree-hash", "actual package file tree differs")
    return manifest


def reparse(path):
    info = path.lstat()
    return stat.S_ISLNK(info.st_mode) or bool(getattr(info, "st_file_attributes", 0) & getattr(stat, "FILE_ATTRIBUTE_REPARSE_POINT", 0x400))


def verify_package(directory):
    if not isinstance(directory, (str, os.PathLike)):
        fail("package.inventory", "an explicit package directory required")
    try:
        root = Path(directory)
        if reparse(root) or not root.is_dir():
            fail("package.inventory", "regular package directory required")
        paths, brick_count = [], 0
        for entry in root.iterdir():
            if reparse(entry):
                fail("package.inventory", "package links/reparse points forbidden")
            if entry.name == "bricks" and entry.is_dir():
                for brick in entry.iterdir():
                    brick_count += 1
                    check_budget("bricks", brick_count)
                    if reparse(brick) or not brick.is_file() or re.fullmatch("[0-9a-f]{64}\\.bin", brick.name) is None:
                        fail("package.inventory", "regular hashed brick files required")
                    paths.append((f"bricks/{brick.name}", brick))
            elif entry.name in METADATA and entry.is_file():
                paths.append((entry.name, entry))
            else:
                fail("package.inventory", "unexpected package path")
        check_budget("output_bytes", sum(path.stat().st_size for _, path in paths))
        files = {}
        for name, path in paths:
            if name in METADATA:
                files[name] = bounded_read(path, "json_bytes")
            else:
                if path.stat().st_size != 4096:
                    fail("package.brick-hash", "brick length must be exactly 4096")
                with path.open("rb") as stream:
                    files[name] = stream.read(4097)
        return verify_files(files)
    except OSError:
        raise CompilerError("package.io", "bounded package verification read failed") from None


def publication_parent(target):
    if not isinstance(target, (str, os.PathLike)):
        fail("publication.target", "an explicit caller-provided output path required")
    target = Path(target).absolute()  # lexical only; never resolve away an existing link
    if os.path.lexists(target):
        fail("publication.target-exists", "any existing lexical output path is preserved unchanged")
    if sys.platform != "win32":
        fail("publication.platform", "no-replace atomic directory publication is supported only on local Windows")
    if not re.fullmatch("[A-Za-z]:", target.drive):
        fail("publication.platform", "local drive required; UNC publication is unsupported")
    import ctypes
    drive_type = ctypes.WinDLL("kernel32", use_last_error=True).GetDriveTypeW
    drive_type.argtypes, drive_type.restype = [ctypes.c_wchar_p], ctypes.c_uint
    if drive_type(target.anchor) not in (2, 3):
        fail("publication.platform", "fixed/removable local drive required; mapped network publication unsupported")
    parent = target.parent
    try:
        for ancestor in (parent, *parent.parents):
            if reparse(ancestor) or not ancestor.is_dir():
                fail("publication.parent", "existing regular local parent without reparse ancestors required")
    except OSError:
        raise CompilerError("publication.parent", "local parent admission failed") from None
    return target, parent


def write_file(path, data):
    with path.open("xb") as stream:
        stream.write(data)


def publish_package(package, target):
    target, parent = publication_parent(target)
    verify_files(package.files)
    staging = None
    try:
        staging = Path(tempfile.mkdtemp(prefix=".hestia-compile-", dir=parent))
        (staging / "bricks").mkdir()
        for name in sorted(package.files, key=lambda name: (name == "asset-manifest.json", not name.startswith("bricks/"), name)):
            write_file(staging / name, package.files[name])
        verify_package(staging)
        # Windows os.rename is no-replace, INCLUDING a collision after this lexical recheck.
        if os.path.lexists(target):
            fail("publication.target-exists", "publish collision; foreign target preserved")
        os.rename(staging, target)
        staging = None
        return target
    except FileExistsError:
        raise CompilerError("publication.target-exists", "publish collision; foreign target preserved") from None
    except OSError:
        if os.path.lexists(target):
            raise CompilerError("publication.target-exists", "publish collision; foreign target preserved") from None
        raise CompilerError("publication.io", "owned staging/write/no-replace rename failed; nothing published") from None
    finally:
        if staging is not None:
            try:
                shutil.rmtree(staging)  # ONLY the unique directory created by THIS invocation
            except OSError:
                raise CompilerError("publication.cleanup", "owned staging cleanup failed; no successful publication") from None


def compile_to_directory(glb_path, report_path, profile_id, target):
    publication_parent(target)
    return publish_package(compile_files(glb_path, report_path, profile_id), target)
