"""Research contact-A surface projection, not an admitted compiled asset."""

from dataclasses import dataclass
from fractions import Fraction
from itertools import product
import math

from tools.blender.hestia_asset_authoring.canonical import canonical_json_bytes, sha256_bytes
from .geometry import cross, dot, sub
from .glb import fail
from .profiles import PROFILES, check_budget, check_grid

SURFACE_VERSION = "spike-exact-sat-contact-a-v1"
ADDRESS_VERSION = "spike-owned-16-x-fastest-v1"


def rational(value):
    if type(value) not in (int, float, Fraction) or (type(value) is float and not math.isfinite(value)):
        fail("surface.nonfinite", "finite numeric coordinate required")
    return Fraction(value)


def sat_planes(vertices):
    triangle = tuple(tuple(rational(x) for x in point) for point in vertices)
    if len(triangle) != 3 or any(len(p) != 3 for p in triangle):
        fail("surface.triangle", "three 3D vertices required")
    edges = [sub(triangle[(i + 1) % 3], triangle[i]) for i in range(3)]
    normal = cross(edges[0], edges[1])
    if normal == (0, 0, 0):
        fail("surface.triangle", "degenerate triangle")
    basis = ((1, 0, 0), (0, 1, 0), (0, 0, 1))
    axes = (*basis, normal, *(cross(edge, axis) for edge in edges for axis in basis))
    return tuple((axis, min(dot(axis, p) for p in triangle), max(dot(axis, p) for p in triangle))
                 for axis in axes if axis != (0, 0, 0))


def overlaps(planes, low, high):
    # Exact rational fallback is the reference itself: equality is contact, never an epsilon gap.
    for axis, minimum, maximum in planes:
        box_min = sum(axis[i] * (low[i] if axis[i] >= 0 else high[i]) for i in range(3))
        box_max = sum(axis[i] * (high[i] if axis[i] >= 0 else low[i]) for i in range(3))
        if minimum > box_max or maximum < box_min:
            return False
    return True


def triangle_box_overlap(vertices, low, high):
    low, high = tuple(map(rational, low)), tuple(map(rational, high))
    if len(low) != 3 or len(high) != 3 or any(a > b for a, b in zip(low, high)):
        fail("surface.bounds", "ordered 3D box required")
    return overlaps(sat_planes(vertices), low, high)


def brick_address(cell):
    if len(cell) != 3 or any(type(x) is not int for x in cell):
        fail("surface.address", "integer 3D cell required")
    coordinate = tuple(x // 16 for x in cell)
    local = tuple(x % 16 for x in cell)
    return coordinate, local, local[0] + 16 * local[1] + 256 * local[2]


def enumerate_cells(bounds):
    low, high = bounds
    return product(*(range(a, b + 1) for a, b in zip(low, high)))


def volume(bounds):
    return math.prod(b - a + 1 for a, b in zip(*bounds))


@dataclass(frozen=True)
class Binding:
    render_material_id: str
    structural_material_id: str | None


@dataclass(frozen=True)
class Brick:
    key: str
    part_id: str
    coordinate: tuple
    data: bytes
    sha256: str


@dataclass(frozen=True)
class Surface:
    profile_id: str
    cells: dict
    domains: dict
    bricks: tuple
    material_slots: tuple
    stats: dict


def pack_bricks(entries):
    """Bound records/slots/owned addresses before allocating any 4096-byte payload."""
    records, active, addresses, seen = [], set(), set(), set()
    for part_id, cell, binding in entries:
        check_budget("grid_cells", len(records) + 1)
        for value in cell:
            check_budget("grid_coordinate", abs(value))
        coordinate, local, offset = brick_address(cell)
        identity = (part_id, cell)
        if identity in seen:
            fail("surface.cell-collision", "duplicate owned cell; never overwrite")
        seen.add(identity)
        active.add(binding)
        if len(active) > 255:
            fail("surface.material-slots", "active byte slots exceed 255; Air is zero")
        addresses.add((part_id, coordinate))
        check_budget("bricks", len(addresses))
        check_budget("output_bytes", len(addresses) * 4096)
        records.append((part_id, cell, binding, coordinate, offset))
    slots = tuple(sorted(active, key=lambda b: (b.render_material_id, b.structural_material_id or "")))
    slot_by_binding = {binding: i + 1 for i, binding in enumerate(slots)}
    payloads = {key: bytearray(4096) for key in sorted(addresses)}
    for part_id, cell, binding, coordinate, offset in sorted(records, key=lambda r: (r[0], r[1])):
        payloads[part_id, coordinate][offset] = slot_by_binding[binding]
    bricks = []
    for (part_id, coordinate), payload in sorted(payloads.items()):
        data = bytes(payload)
        key = sha256_bytes(canonical_json_bytes({"partId": part_id, "brickCoordinate": coordinate,
                                               "addressVersion": ADDRESS_VERSION}))
        bricks.append(Brick(key, part_id, coordinate, data, sha256_bytes(data)))
    return tuple(bricks), slots


def preflight_surface(geometry, profile_id):
    if type(profile_id) is not str or profile_id not in PROFILES:
        fail("surface.profile", "one explicit research profile required")
    h = Fraction(PROFILES[profile_id])
    check_budget("instance_triangles", len(geometry.triangles))
    plans, spans, per_part_work = [], {}, {}
    stats = {name: 0 for name in ("candidate_work", "grid_cells", "flood_cells", "bricks", "output_bytes")}
    for triangle in geometry.triangles:
        low, high = [], []
        for axis in range(3):
            values = [rational(p[axis]) / h for p in triangle.vertices]
            # ceil(min)-1 includes the cell below an exact grid plane; floor(max) includes above.
            a, b = min(values), max(values)
            low.append(-(-a.numerator // a.denominator) - 1)
            high.append(b.numerator // b.denominator)
            check_budget("grid_coordinate", max(abs(low[-1]), abs(high[-1])))
        bounds = (tuple(low), tuple(high))
        work = volume(bounds)
        per_part_work[triangle.part_id] = per_part_work.get(triangle.part_id, 0) + work
        check_budget("candidate_work", per_part_work[triangle.part_id])
        stats["candidate_work"] += work
        check_budget("candidate_work", stats["candidate_work"])
        previous = spans.get(triangle.part_id, bounds)
        spans[triangle.part_id] = (tuple(min(a, b) for a, b in zip(previous[0], low)),
                                  tuple(max(a, b) for a, b in zip(previous[1], high)))
        plans.append((triangle, bounds))
    domains = {}
    for part_id, (low, high) in sorted(spans.items()):
        bounds = (tuple(x - 1 for x in low), tuple(x + 1 for x in high))
        cells = check_grid(*bounds)
        bricks = math.prod(b // 16 - a // 16 + 1 for a, b in zip(*bounds))
        domains[part_id] = bounds
        for name, count in (("grid_cells", cells), ("flood_cells", cells), ("bricks", bricks),
                            ("output_bytes", bricks * 4096)):
            stats[name] += count
            check_budget(name, stats[name])
    return h, plans, domains, stats


def rasterize(plans, h, materials):
    candidates = {}
    for triangle, bounds in plans:
        planes = sat_planes(triangle.vertices)
        binding = materials[triangle.material_id]
        for cell in enumerate_cells(bounds):
            low = tuple(x * h for x in cell)
            if overlaps(planes, low, tuple(x + h for x in low)):
                candidates.setdefault((triangle.part_id, cell), set()).add(binding)
    cells = {}
    for key, bindings in sorted(candidates.items()):
        if len(bindings) != 1:
            fail("surface.material-ambiguity", "multiple semantic surface materials; no ordering priority")
        cells[key] = next(iter(bindings))
    return cells


def voxelize_surface(geometry, profile_id):
    h, plans, domains, stats = preflight_surface(geometry, profile_id)
    materials = {m["renderMaterialId"]: Binding(m["renderMaterialId"], m.get("structuralMaterialId"))
                 for m in geometry.semantics["materials"]}
    cells = rasterize(plans, h, materials)
    bricks, slots = pack_bricks((owner, cell, binding) for (owner, cell), binding in cells.items())
    return Surface(profile_id, cells, domains, bricks, slots, stats)
