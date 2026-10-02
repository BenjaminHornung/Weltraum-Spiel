"""Small deterministic GLB fixtures; no Blender, geometry library, or files needed."""

import json
import struct


def part(part_id="part.a", representation="Solid"):
    return {
        "kind": "part", "partId": part_id, "representation": representation,
        "destructible": representation != "Decorative", "collisionPolicy": "Voxel",
        "navigationPolicy": "Obstacle", "defaultRenderMaterialId": "render.a",
        "structuralMaterialId": "steel.a",
        "thinFeature": {"policy": "Reject", "declaredMinimumThicknessMeters": 1},
    }


def fixture(vertices=None, faces=None, *, index_type=5123, stride=12):
    vertices = vertices or [(0, 0, 0), (1, 0, 0), (0, 1, 0)]
    faces = faces if faces is not None else [(0, 1, 2)]
    binary = bytearray()
    for vertex in vertices:
        binary.extend(struct.pack("<3f", *vertex))
        binary.extend(bytes(stride - 12))
    positions_length = len(binary)
    fmt = {5121: "B", 5123: "H", 5125: "I"}[index_type]
    flat = [index for face in faces for index in face]
    binary.extend(struct.pack("<" + fmt * len(flat), *flat))
    document = {
        "asset": {"version": "2.0", "generator": "spike-fixture-v1", "extras": {"hestia": {
            "schema": "hestia.asset-authoring.v1", "assetId": "asset.test", "assetRevision": 0,
            "representation": "Solid", "metersPerUnit": 1,
            "coordinateFrame": {"upAxis": "+Y", "forwardAxis": "+Z", "handedness": "RIGHT"},
        }}},
        "scene": 0, "scenes": [{"nodes": [0]}],
        "nodes": [{"mesh": 0, "extras": {"hestia": part()}}],
        "meshes": [{"primitives": [{"attributes": {"POSITION": 0}, "indices": 1, "material": 0}]}],
        "materials": [{"extras": {"hestia": {"renderMaterialId": "render.a", "structuralMaterialId": "steel.a"}}}],
        "buffers": [{"byteLength": len(binary)}],
        "bufferViews": [{"buffer": 0, "byteOffset": 0, "byteLength": positions_length, "byteStride": stride},
                        {"buffer": 0, "byteOffset": positions_length, "byteLength": len(binary) - positions_length}],
        "accessors": [{"bufferView": 0, "componentType": 5126, "count": len(vertices), "type": "VEC3"},
                      {"bufferView": 1, "componentType": index_type, "count": len(flat), "type": "SCALAR"}],
    }
    return document, bytes(binary)


def glb(document, binary, *, json_bytes=None):
    text = json_bytes if json_bytes is not None else json.dumps(document, sort_keys=True, separators=(",", ":")).encode()
    text += b" " * (-len(text) % 4)
    binary += b"\0" * (-len(binary) % 4)
    chunks = struct.pack("<II", len(text), 0x4E4F534A) + text
    chunks += struct.pack("<II", len(binary), 0x004E4942) + binary
    return struct.pack("<4sII", b"glTF", 2, 12 + len(chunks)) + chunks


def box(lo=(0, 0, 0), hi=(1, 1, 1)):
    vertices = [(lo[0], lo[1], lo[2]), (hi[0], lo[1], lo[2]), (hi[0], hi[1], lo[2]), (lo[0], hi[1], lo[2]),
                (lo[0], lo[1], hi[2]), (hi[0], lo[1], hi[2]), (hi[0], hi[1], hi[2]), (lo[0], hi[1], hi[2])]
    # Outward winding, deliberately shared positions rather than a computed oracle.
    faces = [(0, 2, 1), (0, 3, 2), (4, 5, 6), (4, 6, 7), (0, 1, 5), (0, 5, 4),
             (3, 7, 6), (3, 6, 2), (0, 4, 7), (0, 7, 3), (1, 2, 6), (1, 6, 5)]
    return vertices, faces


def combine_meshes(meshes):
    vertices, faces = [], []
    for points, triangles in meshes:
        offset = len(vertices)
        vertices.extend(points)
        faces.extend(tuple(i + offset for i in face) for face in triangles)
    return vertices, faces


def orthogonal_union(xs, ys, zs, occupied):
    """Fixture boundary from supplied boxes, not a production occupancy oracle."""
    axes = (xs, ys, zs)
    vertices, faces, ids = [], [], {}
    sides = ((2, -1), (2, 1), (1, -1), (1, 1), (0, -1), (0, 1))
    for cell in sorted(occupied):
        points, triangles = box(tuple(axes[a][cell[a]] for a in range(3)),
                                tuple(axes[a][cell[a] + 1] for a in range(3)))
        for side, (axis, delta) in enumerate(sides):
            neighbor = tuple(cell[a] + (delta if a == axis else 0) for a in range(3))
            if neighbor in occupied:
                continue
            for face in triangles[2 * side:2 * side + 2]:
                result = []
                for index in face:
                    point = points[index]
                    if point not in ids:
                        ids[point] = len(vertices)
                        vertices.append(point)
                    result.append(ids[point])
                faces.append(tuple(result))
    return vertices, faces
