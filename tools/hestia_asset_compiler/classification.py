"""Bounded research fill with exact parity and an orthogonal cubical certificate.

This does not admit a report, measure thickness, or publish a compiled package.
"""

from bisect import bisect_right
from collections import deque
from dataclasses import dataclass, replace
from fractions import Fraction
from itertools import product
import math

from .geometry import cross, dot, sub
from .glb import fail
from .profiles import check_budget, check_grid
from .voxel import Binding, enumerate_cells, pack_bricks, preflight_surface, rational, rasterize, volume

CLASSIFICATION_VERSION = "spike-exterior-six-parity-v1"
RAY_VERSION = "spike-exact-eight-directions-v1"
TOPOLOGY_VERSION = "spike-orthogonal-cubical-inclusion-v1"
DIRECTIONS = ((1, 0, 0), (0, 1, 0), (0, 0, 1), (1, 2, 3),
              (2, 3, 5), (3, 5, 7), (5, 7, 11), (7, 11, 13))
NEIGHBORS = ((-1, 0, 0), (0, -1, 0), (0, 0, -1), (0, 0, 1), (0, 1, 0), (1, 0, 0))
NEAR = tuple(p for p in product((-1, 0, 1), repeat=3) if p != (0, 0, 0))


def prepared_triangles(triangles):
    result = []
    for triangle in triangles:
        points = tuple(tuple(rational(x) for x in p) for p in triangle.vertices)
        result.append((points, cross(sub(points[1], points[0]), sub(points[2], points[0]))))
    return tuple(result)


def parity_witness(point, faces):
    """Strict exact ray hits; abandon shared-edge/vertex/coplanar rays, never jitter."""
    point = tuple(rational(x) for x in point)
    for direction_index, direction in enumerate(DIRECTIONS):
        hits, ambiguous = 0, False
        for triangle, normal in faces:
            distance = dot(sub(triangle[0], point), normal)
            denominator = dot(direction, normal)
            if denominator == 0:
                if distance == 0:
                    ambiguous = True
                    break
                continue
            t = distance / denominator
            if t < 0:
                continue
            intersection = tuple(point[a] + t * direction[a] for a in range(3))
            sides = [dot(cross(sub(triangle[(i + 1) % 3], triangle[i]),
                               sub(intersection, triangle[i])), normal) for i in range(3)]
            if min(sides) < 0:
                continue
            if t == 0 or min(sides) == 0:
                ambiguous = True
                break
            hits += 1
        if not ambiguous:
            return bool(hits % 2), direction_index
    fail("classification.ray-ambiguity", "no proven non-grazing ray among eight fixed directions")


def shifted(cell, delta):
    return tuple(a + b for a, b in zip(cell, delta))


def flood(seed, remaining):
    """Consume a finite allowed set with face adjacency only."""
    remaining.remove(seed)
    reached, queue = {seed}, deque([seed])
    while queue:
        cell = queue.popleft()
        for delta in NEIGHBORS:
            neighbor = shifted(cell, delta)
            if neighbor in remaining:
                remaining.remove(neighbor)
                reached.add(neighbor)
                queue.append(neighbor)
    return frozenset(reached)


def region_labels(cells):
    remaining, labels, count = set(cells), {}, 0
    # Sort once: repeated min(remaining) could be quadratic for many disconnected regions.
    for seed in sorted(cells):
        if seed in remaining:
            component = flood(seed, remaining)
            labels.update((cell, count) for cell in component)
            count += 1
    return labels, count


def feature(states):
    return (sum(1 << a for a in range(3) if states[a] == 1),
            tuple(int(s == 2) for s in states))


FEATURES = tuple(feature(states) for states in product(range(3), repeat=3))
ATTACHMENTS = tuple((offset, tuple(feature(s) for s in product(
    *((0,) if d < 0 else (2,) if d > 0 else (0, 1, 2) for d in offset)))) for offset in NEAR)


def cubical_euler(cells):
    features = {(mask, shifted(cell, origin)) for cell in cells for mask, origin in FEATURES}
    return sum((-1) ** mask.bit_count() for mask, origin in features)


def attachment_is_disk(cell, material):
    attached, face_closure = set(), set()
    for offset, features in ATTACHMENTS:
        if shifted(cell, offset) in material:
            attached.update(features)
            if sum(abs(d) for d in offset) == 1:
                face_closure.update(features)
    # A pure face patch on a cube boundary, connected with Euler 1, is a PL disk.
    # Reject dangling edge/vertex contacts: contractibility alone proves Material homotopy,
    # not preservation of its embedded boundary and complementary Air topology.
    if not attached or attached != face_closure:
        return False
    if sum((-1) ** mask.bit_count() for mask, origin in attached) != 1:
        return False
    vertices = {origin for mask, origin in attached if mask == 0}
    adjacent = {v: set() for v in vertices}
    for mask, origin in attached:
        if mask.bit_count() == 1:
            endpoint = tuple(origin[a] + int(mask == (1 << a)) for a in range(3))
            adjacent[origin].add(endpoint)
            adjacent[endpoint].add(origin)
    reached, queue = set(), [min(vertices)]
    while queue:
        vertex = queue.pop()
        if vertex not in reached:
            reached.add(vertex)
            queue.extend(adjacent[vertex] - reached)
    return reached == vertices


def component_correspondence(small, large):
    small_labels, small_count = region_labels(small)
    large_labels, large_count = region_labels(large)
    mapping = [set() for _ in range(large_count)]
    for cell, label in small_labels.items():
        mapping[large_labels[cell]].add(label)
    if (small_count != large_count or any(len(m) != 1 for m in mapping)
            or len({next(iter(m)) for m in mapping}) != small_count):
        fail("classification.topology-loss", "TopologyLoss: source/raster region correspondence changed")
    return small_count, large_count


def prove_topology(source, target, bounds):
    """Prove the actual inclusion by contractible attachments, not Euler alone."""
    size = check_grid(*bounds)
    check_budget("candidate_work", 105 * size)
    if (len(source) > size or len(target) > size or any(
            type(cell) is not tuple or len(cell) != 3
            or any(type(x) is not int or x < a or x > b for x, a, b in zip(cell, *bounds))
            for cell in target)):
        fail("classification.topology-unproven", "TopologyUnproven: bounded common-refinement cells required")
    if not source or not source <= target:
        fail("classification.topology-unproven", "TopologyUnproven: conservative material inclusion absent")
    source_euler, target_euler = cubical_euler(source), cubical_euler(target)
    if source_euler != target_euler:
        fail("classification.topology-loss", "TopologyLoss: cubical source/raster Euler invariant changed")
    source_count, target_count = component_correspondence(source, target)
    domain = set(enumerate_cells(bounds))
    raster_air, source_air = component_correspondence(domain - target, domain - source)
    material, pending = set(source), target - source
    queue, queued = deque(sorted(pending)), set(pending)
    additions, attempts = 0, 0
    while queue:
        cell = queue.popleft()
        queued.remove(cell)
        attempts += 1
        if attachment_is_disk(cell, material):
            material.add(cell)
            pending.remove(cell)
            additions += 1
            for delta in NEAR:
                neighbor = shifted(cell, delta)
                if neighbor in pending and neighbor not in queued:
                    queue.append(neighbor)
                    queued.add(neighbor)
    if pending:
        fail("classification.topology-unproven", "TopologyUnproven: inclusion attachment certificate incomplete")
    return {"topologyVersion": TOPOLOGY_VERSION, "homotopyEquivalent": True,
            "conservativeInclusion": True, "sourceEuler": source_euler, "rasterEuler": target_euler,
            "sourceMaterialComponents": source_count, "rasterMaterialComponents": target_count,
            "sourceAirComponents": source_air, "rasterAirComponents": raster_air,
            "certifiedAdditions": additions, "attachmentAttempts": attempts}


def preflight_classification(geometry, profile_id):
    parts = {p["partId"]: p for p in geometry.semantics["parts"]}
    projection = replace(geometry, triangles=tuple(t for t in geometry.triangles
                         if parts[t.part_id]["representation"] != "Decorative"))
    h, plans, domains, surface_stats = preflight_surface(projection, profile_id)
    materials = {m["renderMaterialId"]: Binding(m["renderMaterialId"], m.get("structuralMaterialId"))
                 for m in geometry.semantics["materials"]}
    active = {materials[t.material_id] for t in projection.triangles}
    if len(active) > 255:
        fail("surface.material-slots", "active byte slots exceed 255; Air is zero")
    grouped = {part_id: [] for part_id in domains}
    for triangle in projection.triangles:
        grouped[triangle.part_id].append(triangle)
    records, stats = {}, dict(surface_stats)
    stats.update(source_cells=0, refined_cells=0, ray_triangle_work=0, witness_work=0)
    for part_id in sorted(domains):
        if parts[part_id]["representation"] != "Solid":
            continue
        faces = prepared_triangles(grouped[part_id])
        bindings = {materials[t.material_id] for t in grouped[part_id]}
        if len(bindings) != 1:
            fail("classification.volume-material-unproven", "only a homogeneous geometry-bound fill is proven")
        planes = [set() for _ in range(3)]
        for triangle, normal in faces:
            axes = [a for a, value in enumerate(normal) if value != 0]
            if len(axes) != 1:
                fail("classification.topology-unproven", "TopologyUnproven: certificate requires orthogonal faces")
            axis = axes[0]
            planes[axis].add(triangle[0][axis])
        low, high = domains[part_id]
        cuts = tuple(tuple(sorted(planes[a] | {low[a] * h, (high[a] + 1) * h})) for a in range(3))
        source_size = math.prod(len(axis) - 1 for axis in cuts)
        refined_size = math.prod(high[a] - low[a] + 1 + sum(value % h != 0 for value in cuts[a])
                                 for a in range(3))
        domain_size = volume(domains[part_id])
        # Every possible component may require eight rays through all faces; no optimistic count.
        rays = 8 * len(faces) * (domain_size + source_size)
        # 27 attachment attempts/cell + 24 face-neighbor label steps + 54 Euler feature visits.
        witness = 105 * refined_size
        for name, count in (("source_cells", source_size), ("refined_cells", refined_size),
                            ("ray_triangle_work", rays), ("witness_work", witness)):
            stats[name] += count
        stats["grid_cells"] += source_size + refined_size
        stats["flood_cells"] += 4 * refined_size
        stats["candidate_work"] += rays + witness + 6 * domain_size
        for name in ("grid_cells", "flood_cells", "candidate_work"):
            check_budget(name, stats[name])
        records[part_id] = (faces, cuts, next(iter(bindings)))
    # No grid ranges, raster maps, floods, common-refinement sets or bricks exist before ALL totals pass.
    return h, plans, domains, materials, records, stats


def build_axes(cuts, h, domain):
    low, high = domain
    return tuple(tuple(sorted(set(axis) | {i * h for i in range(low[a], high[a] + 2)}))
                 for a, axis in enumerate(cuts))


def source_cells(faces, cuts):
    material = set()
    for cell in product(*(range(len(axis) - 1) for axis in cuts)):
        center = tuple((cuts[a][cell[a]] + cuts[a][cell[a] + 1]) / 2 for a in range(3))
        if parity_witness(center, faces)[0]:
            material.add(cell)
    return material


def refine_material(coarse_source, filled, cuts, axes, h):
    source, target = set(), set()
    to_source, to_grid = [], []
    for axis, cut in zip(axes, cuts):
        centers = [(a + b) / 2 for a, b in zip(axis, axis[1:])]
        to_source.append([bisect_right(cut, center) - 1 for center in centers])
        to_grid.append([int(center // h) for center in centers])
    for cell in product(*(range(len(axis) - 1) for axis in axes)):
        if tuple(to_source[a][cell[a]] for a in range(3)) in coarse_source:
            source.add(cell)
        if tuple(to_grid[a][cell[a]] for a in range(3)) in filled:
            target.add(cell)
    return source, target


@dataclass(frozen=True)
class Classification:
    profile_id: str
    cells: dict
    domains: dict
    bricks: tuple
    material_slots: tuple
    exterior: dict
    cavities: dict
    proofs: dict
    stats: dict


def classify_cells(geometry, profile_id):
    h, plans, domains, materials, records, stats = preflight_classification(geometry, profile_id)
    cells = rasterize(plans, h, materials)
    exterior, cavities, proofs = {}, {}, {}
    parts = {p["partId"]: p for p in geometry.semantics["parts"]}
    surfaces = {part_id: set() for part_id in domains}
    for part_id, cell in cells:
        surfaces[part_id].add(cell)
    for part_id in sorted(parts):
        representation = parts[part_id]["representation"]
        if representation != "Solid":
            proofs[part_id] = {"representation": representation, "filled": False,
                              "reason": "DecorativeOnly" if representation == "Decorative" else "SurfaceOnly"}
            continue
        faces, cuts, binding = records[part_id]
        domain = domains[part_id]
        remaining = set(enumerate_cells(domain)) - surfaces[part_id]
        exterior[part_id] = flood(domain[0], remaining)
        empty, filled = [], set(surfaces[part_id])
        for seed in sorted(remaining):
            if seed not in remaining:
                continue
            component = flood(seed, remaining)
            center = tuple((Fraction(x) + Fraction(1, 2)) * h for x in seed)
            if parity_witness(center, faces)[0]:
                for cell in sorted(component):
                    identity = (part_id, cell)
                    if identity in cells:
                        fail("surface.cell-collision", "interior must not overwrite a surface cell")
                    cells[identity] = binding
                filled.update(component)
            else:
                empty.append(component)
        cavities[part_id] = tuple(empty)
        coarse = source_cells(faces, cuts)
        axes = build_axes(cuts, h, domain)
        source, target = refine_material(coarse, filled, cuts, axes, h)
        bounds = ((0, 0, 0), tuple(len(axis) - 2 for axis in axes))
        proof = prove_topology(source, target, bounds)
        proof.update(representation="Solid", filled=True, classificationVersion=CLASSIFICATION_VERSION,
                     rayVersion=RAY_VERSION, sourceArrangementCells=math.prod(len(a) - 1 for a in cuts),
                     commonRefinementCells=volume(bounds))
        proofs[part_id] = proof
    return Classification(profile_id, dict(sorted(cells.items())), domains, (), (),
                           exterior, cavities, proofs, stats)


def classify_geometry(geometry, profile_id):
    result = classify_cells(geometry, profile_id)
    bricks, slots = pack_bricks((owner, cell, binding) for (owner, cell), binding in result.cells.items())
    return replace(result, bricks=bricks, material_slots=slots)
