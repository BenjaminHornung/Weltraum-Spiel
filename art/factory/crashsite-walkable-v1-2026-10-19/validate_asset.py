"""Validate actual exported GLB bytes and declared corridor geometry."""
from pathlib import Path
import hashlib
import json
import math
import shutil
import subprocess
import struct

ROOT = Path(__file__).resolve().parent
spec = json.loads((ROOT / 'MODEL_SPEC.json').read_text())
glb_path = ROOT / 'crashsite-walkable-v1.glb'
raw = glb_path.read_bytes()
magic, version, length = struct.unpack_from('<4sII', raw)
assert (magic, version, length) == (b'glTF', 2, len(raw))
offset = 12
chunks = []
while offset < len(raw):
    size, kind = struct.unpack_from('<I4s', raw, offset)
    offset += 8
    assert offset + size <= len(raw)
    chunks.append((kind, raw[offset:offset + size]))
    offset += size
assert len(chunks) == 2 and chunks[0][0] == b'JSON' and chunks[1][0] == b'BIN\0'
doc = json.loads(chunks[0][1])
binary = chunks[1][1]
assert doc['asset']['version'] == '2.0'
assert not doc.get('animations') and not doc.get('textures') and not doc.get('images')
assert not doc.get('cameras') and not doc.get('extensionsUsed')
assert len(doc['materials']) == spec['materialsMax']
palette = spec['paletteSrgbHex']
assert {material['name'] for material in doc['materials']} == set(palette)


def srgb_to_linear(byte):
    value = byte / 255.0
    return value / 12.92 if value <= 0.04045 else ((value + 0.055) / 1.055) ** 2.4


for material in doc['materials']:
    expected = [srgb_to_linear(int(palette[material['name']][index:index + 2], 16))
                for index in (0, 2, 4)] + [1.0]
    actual = material['pbrMetallicRoughness']['baseColorFactor']
    assert len(actual) == 4 and all(abs(actual[i] - expected[i]) <= 1e-6 for i in range(4)), (
        'Palette entry changed: ' + material['name'])
assert len(doc['meshes']) == spec['partsMax']
assert sorted(mesh['name'] for mesh in doc['meshes']) == spec['parts']

types = {'SCALAR': 1, 'VEC2': 2, 'VEC3': 3, 'VEC4': 4}
formats = {5123: ('H', 2), 5125: ('I', 4), 5126: ('f', 4)}


def values(index):
    accessor = doc['accessors'][index]
    view = doc['bufferViews'][accessor['bufferView']]
    assert not accessor.get('sparse') and view['buffer'] == 0
    form, size = formats[accessor['componentType']]
    width = types[accessor['type']]
    stride = view.get('byteStride', width * size)
    base = view.get('byteOffset', 0) + accessor.get('byteOffset', 0)
    assert base + (accessor['count'] - 1) * stride + width * size <= len(binary)
    return [struct.unpack_from('<' + form * width, binary, base + i * stride)
            for i in range(accessor['count'])]


def cross(a, b):
    return (a[1] * b[2] - a[2] * b[1],
            a[2] * b[0] - a[0] * b[2],
            a[0] * b[1] - a[1] * b[0])


def dot(a, b):
    return sum(a[i] * b[i] for i in range(3))


def subtract(a, b):
    return tuple(a[i] - b[i] for i in range(3))


def triangle_box_overlap(triangle, low, high):
    """SAT for a triangle and axis-aligned open-volume interior box."""
    center = tuple((low[i] + high[i]) * 0.5 for i in range(3))
    half = tuple((high[i] - low[i]) * 0.5 for i in range(3))
    points = [subtract(point, center) for point in triangle]
    edges = [subtract(points[1], points[0]),
             subtract(points[2], points[1]),
             subtract(points[0], points[2])]
    axes = [(1.0, 0.0, 0.0), (0.0, 1.0, 0.0), (0.0, 0.0, 1.0),
            cross(edges[0], edges[1])]
    basis = axes[:3]
    axes.extend(cross(edge, axis) for edge in edges for axis in basis)
    for axis in axes:
        if dot(axis, axis) < 1e-20:
            continue
        projected = [dot(point, axis) for point in points]
        radius = sum(half[i] * abs(axis[i]) for i in range(3))
        if min(projected) > radius or max(projected) < -radius:
            return False
    return True


def local_triangle(gltf_points):
    # Existing Blender->glTF export maps (x,y,z) to (x,z,-y).
    return [(point[0], -point[2], point[1]) for point in gltf_points]


bounds = [[math.inf] * 3, [-math.inf] * 3]
triangles = []
upward = []
vertices = draws = triangle_count = 0
part_results = []
for node in doc['nodes']:
    assert node.get('translation', [0, 0, 0]) == [0, 0, 0]
    assert node.get('scale', [1, 1, 1]) == [1, 1, 1]
    assert node.get('rotation', [0, 0, 0, 1]) == [0, 0, 0, 1]
    assert 'matrix' not in node and 'camera' not in node
    extras = node['extras']
    assert extras['assetId'] == spec['assetId'] and extras['worldAuthority'] is False
    assert extras['collisionPolicy'] == 'None' and extras['gameplayAdmission'] == 'NOT_ADMITTED'
    assert extras['flight'] == 'PERMANENTLY_INOPERABLE'

for mesh in doc['meshes']:
    part_triangles = 0
    for primitive in mesh['primitives']:
        assert primitive.get('mode', 4) == 4
        assert set(primitive['attributes']) == {'POSITION', 'NORMAL'}
        gltf_positions = values(primitive['attributes']['POSITION'])
        normals = values(primitive['attributes']['NORMAL'])
        indices = [value[0] for value in values(primitive['indices'])]
        assert len(indices) % 3 == 0 and max(indices) < len(gltf_positions)
        assert len(gltf_positions) == len(normals)
        local_positions = local_triangle(gltf_positions)
        for gltf_point, local_point, normal in zip(gltf_positions, local_positions, normals):
            assert all(math.isfinite(value) for value in gltf_point + normal)
            assert all(abs(value / spec['artGridMeters'] - round(value / spec['artGridMeters'])) < 1e-6
                       for value in gltf_point)
            assert sorted(abs(value) for value in normal) == [0, 0, 1]
            for axis in range(3):
                bounds[0][axis] = min(bounds[0][axis], gltf_point[axis])
                bounds[1][axis] = max(bounds[1][axis], gltf_point[axis])
            assert all(abs(value / spec['artGridMeters'] - round(value / spec['artGridMeters'])) < 1e-6
                       for value in local_point)
        for index in range(0, len(indices), 3):
            gltf_points = [gltf_positions[indices[index + step]] for step in range(3)]
            local_points = [local_positions[indices[index + step]] for step in range(3)]
            gltf_a, gltf_b, gltf_c = gltf_points
            gltf_normal = cross(subtract(gltf_b, gltf_a), subtract(gltf_c, gltf_a))
            assert dot(gltf_normal, normals[indices[index]]) > 0, 'Winding must face out'
            assert dot(gltf_normal, gltf_normal) > 0, 'No degenerate faces'
            triangle = (mesh['name'], local_points)
            triangles.append(triangle)
            if (abs(local_points[0][2] - local_points[1][2]) < 1e-6 and
                    abs(local_points[0][2] - local_points[2][2]) < 1e-6 and
                    cross(subtract(local_points[1], local_points[0]),
                          subtract(local_points[2], local_points[0]))[2] > 0):
                upward.append((mesh['name'], local_points))
        part_triangles += len(indices) // 3
        vertices += len(gltf_positions)
        draws += 1
    triangle_count += part_triangles
    part_results.append({'part': mesh['name'], 'triangles': part_triangles})

assert triangle_count <= spec['trianglesMax'] and draws <= spec['drawCallsMax']
assert bounds[0] == spec['originalBoundsYupM']['min']
assert bounds[1] == spec['originalBoundsYupM']['max']
assert sorted(node['name'] for node in doc['nodes'] if node['name'].startswith('turret_')) == [
    'turret_aft', 'turret_fore']

base_path = ROOT.parent / 'crashsite-hybrid-v2' / 'crashsite-hybrid-v2.glb'
base_sha256 = hashlib.sha256(base_path.read_bytes()).hexdigest()
assert base_sha256 == spec['baseAssetSha256'], 'Read-only source GLB changed'

corridor = spec['walkableCorridor']
clear_x = corridor['clearXLocalMeters']
min_headroom = corridor['minimumHeadroomMeters']
grid = spec['artGridMeters']
clear_epsilon = 0.0001
assert corridor['coordinateFrame']['worldFromBuilderLocal'] == '[6.5 + x, 1.5 + z, 7.5 - y] metres; identity hull rotation and scale.'
assert corridor['coordinateFrame']['worldAnchorMeters'] == [6.5, 1.5, 7.5]
assert abs(corridor['coordinateFrame']['groundWorldY'] -
           (corridor['coordinateFrame']['worldAnchorMeters'][1] +
            corridor['coordinateFrame']['groundBuilderLocalZ'])) < 1e-6


def surface_height_at(x, y, part=None):
    hits = []
    for triangle_part, points in upward:
        if part is not None and triangle_part != part:
            continue
        if x < min(point[0] for point in points) - 1e-6 or x > max(point[0] for point in points) + 1e-6:
            continue
        if y < min(point[1] for point in points) - 1e-6 or y > max(point[1] for point in points) + 1e-6:
            continue
        a, b, c = points
        area = (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0])
        if abs(area) < 1e-12:
            continue
        wa = ((b[0] - x) * (c[1] - y) - (b[1] - y) * (c[0] - x)) / area
        wb = ((c[0] - x) * (a[1] - y) - (c[1] - y) * (a[0] - x)) / area
        wc = 1.0 - wa - wb
        if min(wa, wb, wc) >= -1e-6:
            hits.append((triangle_part, wa * a[2] + wb * b[2] + wc * c[2]))
    return hits


segments = []
segments.extend({'id': 'ramp-row-' + str(row['row']),
                 'localY': row['localY'],
                 'floorLocalZMeters': row['floorLocalZMeters']}
                for row in corridor['rampTreads'])
segments.extend(corridor['bayFloorSegments'])
segments.sort(key=lambda segment: segment['localY'][0])
assert abs((clear_x[1] - clear_x[0]) - corridor['minimumClearWidthMeters']) < 1e-6
assert corridor['minimumClearWidthMeters'] >= 0.8
assert min_headroom >= 2.1
assert corridor['minimumClearWidthMeters'] >= 2 * corridor['playerCapsule']['radiusMeters']
assert min_headroom >= corridor['playerCapsule']['heightMeters']
seam = corridor['externalTerrainSeam']


def assert_grid_aligned(value, label):
    assert abs(value / grid - round(value / grid)) < 1e-6, label + ' must align to the art grid'


def assert_grid_length(length, label):
    cells = round(length / grid)
    assert cells > 0 and abs(length - cells * grid) < 1e-6, label + ' must be an integral number of art cells'


assert_grid_aligned(clear_x[0], 'Corridor X minimum')
assert_grid_aligned(clear_x[1], 'Corridor X maximum')
assert_grid_length(clear_x[1] - clear_x[0], 'Corridor width')
for segment in segments:
    x_min, x_max = segment.get('clearXLocalMeters', clear_x)
    y_min, y_max = segment['localY']
    for value, label in [(x_min, 'Segment X minimum'), (x_max, 'Segment X maximum'),
                         (y_min, 'Segment Y minimum'), (y_max, 'Segment Y maximum')]:
        assert_grid_aligned(value, label)
    assert_grid_length(x_max - x_min, 'Segment width')
    assert_grid_length(y_max - y_min, 'Segment length')
seam_min, seam_max = seam['localY']
assert_grid_aligned(seam_min, 'External seam minimum Y')
assert_grid_aligned(seam_max, 'External seam maximum Y')
assert_grid_length(seam_max - seam_min, 'External seam length')
assert abs(seam['localY'][1] - segments[0]['localY'][0]) < 1e-6
first_step = abs(seam['floorLocalZMeters'] - segments[0]['floorLocalZMeters'])
assert first_step <= seam['maxStepMeters'] + 1e-6
assert first_step <= corridor['playerCapsule']['maxStepMeters'] + 1e-6
for previous, current in zip(segments, segments[1:]):
    assert abs(previous['localY'][1] - current['localY'][0]) < 1e-6, 'Corridor floor segments must connect'
    step = abs(previous['floorLocalZMeters'] - current['floorLocalZMeters'])
    assert step <= corridor['maximumAdjacentFloorStepMeters'] + 1e-6
    assert step <= corridor['playerCapsule']['maxStepMeters'] + 1e-6

for segment in corridor['bayFloorSegments']:
    assert abs(segment['requiredCeilingLocalZMeters'] -
               (segment['floorLocalZMeters'] + min_headroom)) < 1e-6

sample_count = 0
for segment in segments:
    x_min, x_max = segment.get('clearXLocalMeters', clear_x)
    y_min, y_max = segment['localY']
    floor_z = segment['floorLocalZMeters']
    nx = round((x_max - x_min) / grid)
    ny = round((y_max - y_min) / grid)
    assert nx > 0 and ny > 0
    assert abs(nx * grid - (x_max - x_min)) < 1e-6
    assert abs(ny * grid - (y_max - y_min)) < 1e-6
    for ix in range(nx):
        x = x_min + (ix + 0.5) * grid
        for iy in range(ny):
            y = y_min + (iy + 0.5) * grid
            hits = surface_height_at(x, y)
            assert any(abs(height - floor_z) < 1e-5 for _, height in hits), (
                'Missing exported floor support at corridor sample ' + repr((segment['id'], x, y, floor_z)))
            sample_count += 1
    prism_low = (x_min + clear_epsilon, y_min + clear_epsilon, floor_z + clear_epsilon)
    prism_high = (x_max - clear_epsilon, y_max - clear_epsilon,
                  floor_z + min_headroom - clear_epsilon)
    for part, triangle in triangles:
        tri_low = tuple(min(point[axis] for point in triangle) for axis in range(3))
        tri_high = tuple(max(point[axis] for point in triangle) for axis in range(3))
        if any(tri_high[axis] < prism_low[axis] or tri_low[axis] > prism_high[axis] for axis in range(3)):
            continue
        assert not triangle_box_overlap(triangle, prism_low, prism_high), (
            'Exported geometry intrudes into corridor clearance: ' + repr((segment['id'], part, triangle)))

for case in corridor['relocatedEmptyCaseFootprints']:
    top_z = 1.0 + case['heightZ'] + spec['bodyGridMeters']
    x = case['xMin'] + case['widthX'] * 0.5
    y = case['yMin'] + case['depthY'] * 0.5
    assert any(part == 'cargo_bay' and abs(height - top_z) < 1e-5
               for part, height in surface_height_at(x, y, 'cargo_bay')), (
        'Relocated empty case top was not found in exported geometry: ' + case['name'])

blend_path = ROOT / 'crashsite-walkable-v1.blend'
native = blend_path.read_bytes()
native_encoding = None
native_header = None
if native.startswith(b'BLENDER'):
    native_header = native[:12]
    legacy_header = (len(native_header) == 12 and native_header[7:8] in (b'-', b'_') and
                     native_header[8:9] in (b'v', b'V') and native_header[9:12].isdigit())
    assert legacy_header or native_header == b'BLENDER17-01', 'Plain Blender header is malformed'
    native_encoding = 'plain'
elif native.startswith(b'\x28\xb5\x2f\xfd'):
    node = shutil.which('node')
    assert node is not None, 'Node.js is required to validate Blender Zstandard source'
    decoder = (
        "const fs=require('node:fs');"
        "const zlib=require('node:zlib');"
        "const compressed=fs.readFileSync(0);"
        "const decoded=zlib.zstdDecompressSync(compressed,{maxOutputLength:16777216});"
        "process.stdout.write(decoded.subarray(0,12));"
    )
    try:
        result = subprocess.run([node, '-e', decoder], input=native, stdout=subprocess.PIPE,
                                stderr=subprocess.DEVNULL, timeout=5, check=False)
    except (OSError, subprocess.TimeoutExpired) as error:
        raise AssertionError('Blender Zstandard header decode failed closed') from error
    native_header = result.stdout
    assert result.returncode == 0 and native_header == b'BLENDER17-01', (
        'Compressed Blender source header is invalid or could not be decoded')
    native_encoding = 'zstd'
else:
    raise AssertionError('Native source is neither a plain nor Zstandard Blender file')
report = {
    'kind': 'ACTUAL_STATIC_GLB_AND_CORRIDOR_INSPECTION',
    'result': 'PASS',
    'assetId': spec['assetId'],
    'sourceSha256': base_sha256,
    'sha256': hashlib.sha256(raw).hexdigest(),
    'bytes': len(raw),
    'triangles': triangle_count,
    'vertices': vertices,
    'drawCalls': draws,
    'parts': part_results,
    'materials': len(doc['materials']),
    'textures': 0,
    'boundsYupM': {'min': bounds[0], 'max': bounds[1]},
    'artGridMeters': spec['artGridMeters'],
    'nativeBytes': len(native),
    'nativeSha256': hashlib.sha256(native).hexdigest(),
    'nativeEncoding': native_encoding,
    'nativeDecodedHeader': native_header.decode('ascii'),
    'corridor': {
        'result': 'PASS',
        'segments': len(segments),
        'floorSamples': sample_count,
        'widthMeters': corridor['minimumClearWidthMeters'],
        'headroomMeters': min_headroom,
        'maximumStepMeters': corridor['maximumAdjacentFloorStepMeters'],
        'externalTerrainSeam': 'NOT_ASSERTED_BY_GLB'
    },
    'flight': 'PERMANENTLY_INOPERABLE',
    'exactTurretCount': spec['exactTurretCount'],
    'worldAuthority': False,
    'gameplayAdmission': 'NOT_ADMITTED',
    'visualAcceptance': 'OWNER_REVIEW_PENDING'
}
(ROOT / 'WALKABILITY_VALIDATION.json').write_text(json.dumps(report, indent=2) + '\n')
print(json.dumps(report, indent=2))
