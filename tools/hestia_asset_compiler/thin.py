"""Spike-local orthogonal axis-section proof; no general thickness claim."""

from dataclasses import replace
from fractions import Fraction
from itertools import product

from .classification import prepared_triangles, source_cells
from .errors import CompilerError
from .glb import fail
from .profiles import check_budget
from .voxel import Binding, preflight_surface, volume

THIN_VERSION = "spike-orthogonal-section-two-samples-v1"
REPLACEMENT_VERSION = "spike-box-beam-single-layer-shell-v1"
MATERIAL_VERSION = "spike-unanimous-explicit-binding-v1"


def reject(decisions, decision, outcome, reason):
    decision.update(outcome=outcome, reason=reason)
    error = CompilerError("thin.too-thin" if outcome == "RejectedTooThin" else "thin.unproven",
                          f"{decision['partId']}: {reason}")
    error.decisions = tuple(decisions + [decision])
    raise error


def check_material_intent(part, bindings, asset):
    declared = [item for item in (part.get("structuralMaterialId"), asset.get("defaultStructuralMaterialId")) if item is not None]
    for binding in bindings:
        if any(binding.structural_material_id != item for item in declared):
            fail("material.ambiguity", "explicit part/default and geometry material do not agree; no precedence invented")


def section_proof(material, cuts):
    """Exact run lengths on EVERY axial section of the complete source arrangement."""
    minima, witness = [], None
    for axis in range(3):
        other = [a for a in range(3) if a != axis]
        minimum = None
        for indices in product(*(range(len(cuts[a]) - 1) for a in other)):
            start = None
            for i in range(len(cuts[axis])):
                cell = [0, 0, 0]
                cell[axis] = i
                for a, index in zip(other, indices):
                    cell[a] = index
                inside = i < len(cuts[axis]) - 1 and tuple(cell) in material
                if inside and start is None:
                    start = i
                elif not inside and start is not None:
                    length = cuts[axis][i] - cuts[axis][start]
                    if minimum is None or length < minimum:
                        minimum = length
                    if witness is None or length < witness[0]:
                        p = [(cuts[a][index] + cuts[a][index + 1]) / 2 for a, index in zip(other, indices)]
                        ends = []
                        for value in (cuts[axis][start], cuts[axis][i]):
                            endpoint = [0, 0, 0]
                            endpoint[axis] = value
                            for a, coordinate in zip(other, p):
                                endpoint[a] = coordinate
                            ends.append(endpoint)
                        witness = (length, axis, ends)
                    start = None
        if minimum is None:
            fail("thin.unproven", "empty material arrangement is not a thickness proof")
        minima.append(float(minimum))
    return ({"scope": "ExactOrthogonalMaterialAxisSections", "minimumAxisSectionMeters": min(minima),
             "axisSectionMinimaMeters": minima, "thinSectionWitness": {"axis": witness[1],
             "endpointsMeters": [[float(x) for x in point] for point in witness[2]],
             "exactEndpointRatios": [[{"numerator": str(x.numerator), "denominator": str(x.denominator)} for x in point] for point in witness[2]],
             "exactLengthRatio": {"numerator": str(witness[0].numerator), "denominator": str(witness[0].denominator)}}}, witness[0])


def shell_rectangle(triangles, part, binding):
    shell = part.get("shell")
    if shell is None or len(shell["layers"]) != 1:
        return None
    layer = shell["layers"][0]
    if layer["structuralMaterialId"] != binding.structural_material_id or layer["thicknessMeters"] != shell["thicknessMeters"]:
        return None
    faces = prepared_triangles(triangles)
    lo = [min(p[a] for vertices, _ in faces for p in vertices) for a in range(3)]
    hi = [max(p[a] for vertices, _ in faces for p in vertices) for a in range(3)]
    fixed = [a for a in range(3) if lo[a] == hi[a]]
    if len(fixed) != 1:
        return None
    axis = fixed[0]
    tangent = [a for a in range(3) if a != axis]
    normals = {1 if normal[axis] > 0 else -1 for _, normal in faces}
    area2 = sum(abs(normal[axis]) for _, normal in faces)
    if len(normals) != 1 or area2 != 2 * (hi[tangent[0]] - lo[tangent[0]]) * (hi[tangent[1]] - lo[tangent[1]]):
        return None
    normal = [0, 0, 0]
    normal[axis] = next(iter(normals))
    return {"kind": "RectangularSingleLayerMidplaneShell", "replacementVersion": REPLACEMENT_VERSION,
            "boundsMinMeters": list(map(float, lo)), "boundsMaxMeters": list(map(float, hi)), "normal": normal,
            "extrusionConvention": "SymmetricAboutMeasuredSurfacePlane", "thicknessMeters": shell["thicknessMeters"],
            "layerIntent": shell["layers"], "renderMaterialId": binding.render_material_id,
            "structuralMaterialId": binding.structural_material_id}


def thin_gate(geometry, profile_id):
    parts = {p["partId"]: p for p in geometry.semantics["parts"]}
    bindings = {m["renderMaterialId"]: Binding(m["renderMaterialId"], m.get("structuralMaterialId"))
                for m in geometry.semantics["materials"]}
    grouped = {part_id: [] for part_id in parts}
    for triangle in geometry.triangles:
        grouped[triangle.part_id].append(triangle)
    decorative = {p["partId"] for p in parts.values() if p["representation"] == "Decorative"}
    projection = replace(geometry, triangles=tuple(t for t in geometry.triangles if t.part_id not in decorative))
    h, plans, domains, stats = preflight_surface(projection, profile_id)
    decisions, records = [], {}
    # Budget the entire potential surface/classification plus the extra measurement BEFORE source sets.
    # This intentionally conservative bound also covers parts later preserved without bricks.
    for part_id, triangles in sorted(grouped.items()):
        if not triangles or part_id in decorative or parts[part_id]["representation"] != "Solid":
            continue
        faces = prepared_triangles(triangles)
        planes = [set() for _ in range(3)]
        for points, normal in faces:
            axes = [a for a, n in enumerate(normal) if n != 0]
            if len(axes) != 1:
                continue
            planes[axes[0]].add(points[0][axes[0]])
        if any(sum(n != 0 for n in normal) != 1 for _, normal in faces):
            records[part_id] = None
            continue
        low, high = domains[part_id]
        cuts = tuple(tuple(sorted(planes[a] | {low[a] * h, (high[a] + 1) * h})) for a in range(3))
        size = volume(((0, 0, 0), tuple(len(axis) - 2 for axis in cuts)))
        refined = 1
        for a in range(3):
            refined *= high[a] - low[a] + 1 + sum(value % h != 0 for value in cuts[a])
        domain = volume(domains[part_id])
        stats["grid_cells"] += 2 * size + refined
        stats["flood_cells"] += 4 * refined
        stats["candidate_work"] += 8 * len(faces) * (domain + 2 * size) + 105 * refined + 6 * domain + 6 * size
        for name in ("grid_cells", "flood_cells", "candidate_work"):
            check_budget(name, stats[name])
        records[part_id] = (faces, cuts)
    voxelized = set()
    for part_id, part in sorted(parts.items()):
        triangles = grouped[part_id]
        policy = part["thinFeature"]["policy"]
        decision = {"partId": part_id, "policy": policy, "intent": part["thinFeature"], "thinVersion": THIN_VERSION}
        active = {bindings[t.material_id] for t in triangles}
        check_material_intent(part, active, geometry.semantics["asset"])
        if part_id in decorative or policy == "DecorativeOnly":
            if part_id not in decorative and (part["destructible"] or part["collisionPolicy"] != "None" or part["navigationPolicy"] != "None"):
                reject(decisions, decision, "RejectedUnprovenThickness", "DecorativeOnly cannot erase an authoritative structural part")
            decision.update(outcome="DecorativeOnly", reason="ExplicitNonVoxelPolicy")
        elif not triangles and part["representation"] == "StructuralAssembly":
            decision.update(outcome="PreservedSemantic", replacement={"kind": "SemanticAssemblyGraph",
                            "childPartIds": sorted(p["partId"] for p in parts.values() if p.get("parentPartId") == part_id)})
        elif part["representation"] in ("Shell", "LayeredShell"):
            replacement = shell_rectangle(triangles, part, next(iter(active))) if triangles and len(active) == 1 else None
            if policy != "PreserveAsShell" or replacement is None:
                reject(decisions, decision, "RejectedUnprovenThickness", "only a proven single-layer rectangular midplane shell is usable")
            decision.update(outcome="PreservedSemantic", replacement=replacement,
                            proof={"scope": "ExactPlanarRectangleCoverage; authored single-layer extrusion intent", "solidFill": False})
        elif part["representation"] != "Solid" or not triangles or records.get(part_id) is None:
            reject(decisions, decision, "RejectedUnprovenThickness", "orthogonal material-section proof unavailable; geometry baking is not invalid")
        else:
            if len(active) != 1:
                fail("material.ambiguity", "homogeneous geometry binding required; no material precedence")
            faces, cuts = records[part_id]
            material = source_cells(faces, cuts)
            proof, measured = section_proof(material, cuts)
            proof["samplingThresholdMeters"] = float(2 * h)  # one cell sample + one-cell reconstruction margin
            decision["proof"] = proof
            if measured >= 2 * h:
                decision.update(outcome="Voxelized", reason="AllExactAxisMaterialSectionsMeetTwoCellThreshold")
                voxelized.add(part_id)
            else:
                # Not an AABB guess: all six measured facet planes + the exact single material region prove a box.
                is_box = material == {(1, 1, 1)} and all(len(axis) == 4 for axis in cuts)
                lo, hi = [axis[1] for axis in cuts], [axis[2] for axis in cuts]
                extents = [b - a for a, b in zip(lo, hi)]
                axis = max(range(3), key=lambda a: (extents[a], -a))
                other = [a for a in range(3) if a != axis]
                if policy == "PreserveAsBeam" and is_box and extents[axis] >= 4 * max(extents[a] for a in other):
                    binding = next(iter(active))
                    decision.update(outcome="PreservedSemantic", replacement={"kind": "RectangularPrismBeam",
                        "replacementVersion": REPLACEMENT_VERSION, "axis": axis,
                        "boundsMinMeters": list(map(float, lo)), "boundsMaxMeters": list(map(float, hi)),
                        "lengthMeters": float(extents[axis]), "crossSectionMeters": [float(extents[a]) for a in other],
                        "renderMaterialId": binding.render_material_id, "structuralMaterialId": binding.structural_material_id})
                elif policy == "Reject":
                    reject(decisions, decision, "RejectedTooThin", "exact material-section witness is below the sampling threshold")
                else:
                    reject(decisions, decision, "RejectedUnprovenThickness", "requested replacement shape is not proven; tubes are never filled rods")
        decisions.append(decision)
    projected = replace(geometry, triangles=tuple(t for t in geometry.triangles if t.part_id in voxelized),
                        semantics={**geometry.semantics, "parts": [p for p in geometry.semantics["parts"] if p["partId"] in voxelized]})
    return decisions, projected, stats
