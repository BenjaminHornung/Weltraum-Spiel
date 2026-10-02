"""Bounded Float64 world geometry; exact predicates on those baked coordinates.

No report admission, repair, voxelization, thickness proof, or compiled output.
"""

from dataclasses import dataclass
from fractions import Fraction
import math

from tools.blender.hestia_asset_authoring.canonical import canonicalize, canonical_json_bytes, sha256_bytes
from .glb import extras, fail, finite_vector
from .profiles import BUDGETS, check_budget

GEOMETRY_VERSION = "spike-world-triangles-v1"


def sub(a, b):
    return tuple(x - y for x, y in zip(a, b))


def dot(a, b):
    return sum(x * y for x, y in zip(a, b))


def cross(a, b):
    return (a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0])


def lerp(a, b, t):
    return tuple(x + t * (y - x) for x, y in zip(a, b))


def determinant_sign(matrix):
    # Exact determinant of the stored Float64 matrix: no epsilon singularity guess.
    columns = [tuple(Fraction(matrix[4 * col + row]) for row in range(3)) for col in range(3)]
    determinant = dot(columns[0], cross(columns[1], columns[2]))
    if determinant == 0:
        fail("geometry.transform", "singular affine transform")
    return 1 if determinant > 0 else -1


def valid_matrix(matrix):
    if len(matrix) != 16 or any(not math.isfinite(x) for x in matrix):
        fail("geometry.transform", "nonfinite matrix or composition")
    matrix = tuple(float(x) for x in matrix)
    if tuple(matrix[i] for i in (3, 7, 11, 15)) != (0, 0, 0, 1):
        fail("geometry.transform", "affine column-major matrix required")
    determinant_sign(matrix)
    return matrix


def local_matrix(node):
    code = "geometry.transform"
    if "matrix" in node:
        if any(key in node for key in ("translation", "rotation", "scale")):
            fail(code, "matrix and TRS are mutually exclusive")
        return valid_matrix(tuple(float(x) for x in finite_vector(node["matrix"], 16, code)))
    translation = finite_vector(node.get("translation", [0, 0, 0]), 3, code)
    scale = finite_vector(node.get("scale", [1, 1, 1]), 3, code)
    x, y, z, w = finite_vector(node.get("rotation", [0, 0, 0, 1]), 4, code)
    # Input unit-quaternion tolerance only; components are never silently renormalized.
    if abs(x*x + y*y + z*z + w*w - 1) > 1e-6:
        fail(code, "unit quaternion required (squared-norm tolerance 1e-6)")
    sx, sy, sz = scale
    return valid_matrix((
        (1 - 2*(y*y + z*z))*sx, 2*(x*y + z*w)*sx, 2*(x*z - y*w)*sx, 0.0,
        2*(x*y - z*w)*sy, (1 - 2*(x*x + z*z))*sy, 2*(y*z + x*w)*sy, 0.0,
        2*(x*z + y*w)*sz, 2*(y*z - x*w)*sz, (1 - 2*(x*x + y*y))*sz, 0.0,
        *translation, 1.0,
    ))


def multiply(parent, local):
    return valid_matrix(tuple(sum(parent[4*k + row] * local[4*col + k] for k in range(4))
                              for col in range(4) for row in range(4)))


def world_point(matrix, point):
    result = tuple(sum(matrix[4*k + row] * point[k] for k in range(3)) + matrix[12 + row] for row in range(3))
    if any(not math.isfinite(x) for x in result):
        fail("geometry.nonfinite", "nonfinite baked world coordinate")
    if any(abs(x) > BUDGETS["world_coordinate"] for x in result):
        fail("budget.world_coordinate", "absolute world-coordinate ceiling exceeded")
    return tuple(0.0 if x == 0 else float(x) for x in result)


def triangle_key(part_id, material_id, vertices):
    rotations = tuple(vertices[i:] + vertices[:i] for i in range(3))
    return (part_id, material_id, min(rotations))


@dataclass(frozen=True)
class Triangle:
    part_id: str
    material_id: str
    vertices: tuple

    @property
    def key(self):
        return (self.part_id, self.material_id, self.vertices)


@dataclass(frozen=True)
class Geometry:
    triangles: tuple
    placements: tuple
    semantics: dict
    bounds: tuple | None
    topology: tuple
    normalized_geometry_sha256: str
    semantics_sha256: str


def inside(point, triangle, normal):
    if dot(sub(point, triangle[0]), normal) != 0:
        return False
    return all(dot(cross(sub(triangle[(i + 1) % 3], triangle[i]), sub(point, triangle[i])), normal) >= 0
               for i in range(3))


def plane_cut(triangle, origin, normal):
    distances = [dot(sub(p, origin), normal) for p in triangle]
    points = set()
    for i in range(3):
        j = (i + 1) % 3
        if distances[i] == 0:
            points.add(triangle[i])
        if distances[i] * distances[j] < 0:
            points.add(lerp(triangle[i], triangle[j], distances[i] / (distances[i] - distances[j])))
    return points


def intersection_points(a, b, na, nb):
    if cross(na, nb) != (0, 0, 0):
        return ({p for p in plane_cut(a, b[0], nb) if inside(p, b, nb)}
                | {p for p in plane_cut(b, a[0], na) if inside(p, a, na)})
    if dot(sub(b[0], a[0]), na) != 0:
        return set()
    points = {p for p in a if inside(p, b, nb)} | {p for p in b if inside(p, a, na)}
    drop = max(range(3), key=lambda axis: abs(na[axis]))
    axes = [axis for axis in range(3) if axis != drop]

    def area(u, v):
        return u[axes[0]] * v[axes[1]] - u[axes[1]] * v[axes[0]]

    for i in range(3):
        p, q = a[i], a[(i + 1) % 3]
        u = sub(q, p)
        for j in range(3):
            r, s = b[j], b[(j + 1) % 3]
            v, delta = sub(s, r), sub(r, p)
            denominator = area(u, v)
            if denominator:
                t, other = area(delta, v) / denominator, area(delta, u) / denominator
                if 0 <= t <= 1 and 0 <= other <= 1:
                    points.add(lerp(p, q, t))
    return points


def on_shared(point, common):
    if not common:
        return False
    if len(common) == 1:
        return point == common[0]
    a, b = common
    delta, edge = sub(point, a), sub(b, a)
    return cross(delta, edge) == (0, 0, 0) and 0 <= dot(delta, edge) <= dot(edge, edge)


def validate_topology(part_id, triangles, solid):
    vertices, faces, edges = {}, [], {}
    geometric_faces = set()
    for triangle in triangles:
        positions = triangle.vertices
        unoriented = tuple(sorted(positions))
        if unoriented in geometric_faces:
            fail("geometry.duplicate", "duplicate per-part face, independent of material/winding")
        geometric_faces.add(unoriented)
        exact = tuple(vertices.setdefault(p, tuple(Fraction(x) for x in p)) for p in positions)
        normal = cross(sub(exact[1], exact[0]), sub(exact[2], exact[0]))
        if normal == (0, 0, 0):
            fail("geometry.degenerate", "zero-area baked triangle")
        index = len(faces)
        faces.append((exact, normal))
        for i in range(3):
            a, b = positions[i], positions[(i + 1) % 3]
            key = tuple(sorted((a, b)))
            entries = edges.setdefault(key, [])
            entries.append((index, a < b))
            if len(entries) > 2:
                fail("geometry.nonmanifold", "edge incidence greater than two")
    adjacent = [set() for _ in faces]
    closed = bool(faces)
    for entries in edges.values():
        if len(entries) == 1:
            closed = False
        elif entries[0][1] == entries[1][1]:
            fail("geometry.orientation", "shared edge directions must be opposite")
        else:
            a, b = (entry[0] for entry in entries)
            adjacent[a].add(b)
            adjacent[b].add(a)
    if solid and not closed:
        fail("geometry.open-solid", "Solid requires a closed triangle surface")
    incident = {p: set() for p in vertices}
    for i, triangle in enumerate(triangles):
        for p in triangle.vertices:
            incident[p].add(i)
    if solid:
        for fan in incident.values():
            visited, stack = set(), [min(fan)]
            while stack:
                face = stack.pop()
                if face not in visited:
                    visited.add(face)
                    stack.extend((adjacent[face] & fan) - visited)
            if visited != fan:
                fail("geometry.vertex-fan", "disconnected closed vertex fans")
    remaining = set(range(len(faces)))
    components = 0
    while remaining:
        components += 1
        stack = [min(remaining)]
        while stack:
            face = stack.pop()
            if face in remaining:
                remaining.remove(face)
                stack.extend(adjacent[face] & remaining)
    boxes = [(tuple(min(p[axis] for p in triangle.vertices) for axis in range(3)),
              tuple(max(p[axis] for p in triangle.vertices) for axis in range(3))) for triangle in triangles]
    # ponytail: bounded quadratic per-part scan; add a spatial broadphase only for an authorized larger corpus.
    for i, (a, na) in enumerate(faces):
        for j in range(i):
            if any(boxes[i][0][axis] > boxes[j][1][axis] or boxes[j][0][axis] > boxes[i][1][axis] for axis in range(3)):
                continue
            b, nb = faces[j]
            common = sorted(set(a) & set(b))
            if any(not on_shared(p, common) for p in intersection_points(a, b, na, nb)):
                fail("geometry.intersection", "illegal self/component intersection or contact")
    return {"partId": part_id, "vertices": len(vertices), "faces": len(faces), "components": components, "closed": closed}


def canonicalize_geometry(source):
    """Consume read_glb output; validate/bake before producing geometry-only hashes."""
    nodes = source.document["nodes"]
    parts = {p["partId"]: p for p in source.semantics["parts"]}
    counts = {part_id: 0 for part_id in parts}
    for index in source.reachable:
        node = nodes[index]
        if "mesh" in node:
            counts[extras(node)["partId"]] += sum(len(p.indices) // 3 for p in source.primitives[node["mesh"]])
    check_budget("instance_triangles", sum(counts.values()))
    check_budget("topology_pairs", sum(n * (n - 1) // 2 for n in counts.values()))
    # All limits precede world-instance expansion and the per-part topology maps.
    world, signs, placements = {}, {}, []
    for index in source.reachable:
        node = nodes[index]
        local = local_matrix(node)
        parent = source.parents[index]
        matrix = multiply(world[parent], local) if parent != -1 else local
        world_point(matrix, (0, 0, 0))  # Also covers geometryless joint/marker translation.
        world[index] = matrix
        signs[index] = determinant_sign(matrix)
        authored = extras(node)
        if authored is not None:
            kind = authored["kind"]
            placements.append({"kind": kind, "id": authored[kind + "Id"], "worldMatrix": list(matrix)})
    triangles = []
    for index in source.reachable:
        node = nodes[index]
        if "mesh" not in node:
            continue
        part_id = extras(node)["partId"]
        for primitive in source.primitives[node["mesh"]]:
            # Transform only referenced vertices: unused accessor rows cannot multiply by instance count.
            points = {i: world_point(world[index], primitive.positions[i]) for i in sorted(set(primitive.indices))}
            for offset in range(0, len(primitive.indices), 3):
                a, b, c = (points[i] for i in primitive.indices[offset:offset + 3])
                vertices = (a, c, b) if signs[index] < 0 else (a, b, c)
                key = triangle_key(part_id, primitive.material_id, vertices)
                triangles.append(Triangle(*key))
    triangles.sort(key=lambda triangle: triangle.key)
    grouped = {part_id: [] for part_id in parts}
    for triangle in triangles:
        grouped[triangle.part_id].append(triangle)
    topology = []
    for part_id in sorted(parts):
        solid = parts[part_id]["representation"] == "Solid"
        if solid and not grouped[part_id]:
            fail("geometry.empty-solid", "Solid part has no reachable geometry")
        topology.append(validate_topology(part_id, grouped[part_id], solid))
    placements = tuple(canonicalize(sorted(placements, key=lambda entry: (entry["kind"], entry["id"]))))
    semantics = canonicalize(source.semantics)
    bounds = None
    if triangles:
        bounds = (tuple(min(p[axis] for t in triangles for p in t.vertices) for axis in range(3)),
                  tuple(max(p[axis] for t in triangles for p in t.vertices) for axis in range(3)))
    geometry_hash = sha256_bytes(canonical_json_bytes({"algorithm": GEOMETRY_VERSION,
        "coordinateFrame": semantics["asset"]["coordinateFrame"], "metersPerUnit": 1,
        "triangles": [{"partId": t.part_id, "renderMaterialId": t.material_id, "vertices": t.vertices} for t in triangles]}))
    semantic_hash = sha256_bytes(canonical_json_bytes({"semantics": semantics, "placements": placements}))
    return Geometry(tuple(triangles), placements, semantics, bounds, tuple(topology), geometry_hash, semantic_hash)
