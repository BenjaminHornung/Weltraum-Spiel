"""Independent binary GLB admission gates; no Blender/generator geometry imports."""
from collections import defaultdict
from pathlib import Path
import hashlib
import itertools
import json
import math
import struct
import subprocess
import unittest

ROOT = Path(__file__).resolve().parents[4]
ART = ROOT / 'art/factory/play-surface-v2-2026-10-12'
V1_ART = ROOT / 'art/factory/play-2026-10-12'
PUBLIC = ROOT / 'apps/weltraum-browser/public/factory/play-2026-10-12'
BASE_COMMIT = '035fed5b6547e1cd06267063046c6d1da54845c6'
PALETTE = {'EX-STRUCT': '30383D', 'EX-SHELL': 'B6BDB8', 'EX-FUNCTION': '407A79',
           'EX-HAZARD': 'D8A94E', 'EX-PV': '1D2E3C'}


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def decode_glb(path):
    data = path.read_bytes()
    if struct.unpack_from('<4sII', data) != (b'glTF', 2, len(data)):
        raise ValueError('Invalid binary GLB header')
    chunks, offset = {}, 12
    while offset < len(data):
        size, kind = struct.unpack_from('<II', data, offset)
        chunks[kind] = data[offset + 8:offset + 8 + size]
        offset += 8 + size
    return json.loads(chunks[0x4e4f534a]), chunks[0x004e4942]


def accessor(gltf, binary, index):
    a = gltf['accessors'][index]
    view = gltf['bufferViews'][a['bufferView']]
    width = {'SCALAR': 1, 'VEC3': 3}[a['type']]
    scalar = {5121: 'B', 5123: 'H', 5125: 'I', 5126: 'f'}[a['componentType']]
    fmt = '<' + scalar * width
    size = struct.calcsize(fmt)
    stride = view.get('byteStride', size)
    start = view.get('byteOffset', 0) + a.get('byteOffset', 0)
    return [struct.unpack_from(fmt, binary, start + i * stride)
            for i in range(a['count'])]


def triangles(gltf, binary):
    result = []
    for node in gltf['nodes']:
        if 'mesh' not in node:
            raise ValueError('Every exported node must be one native part mesh')
        for primitive in gltf['meshes'][node['mesh']]['primitives']:
            if primitive.get('mode', 4) != 4:
                raise ValueError('Expected explicit triangle primitives')
            positions = accessor(gltf, binary, primitive['attributes']['POSITION'])
            indices = [v[0] for v in accessor(gltf, binary, primitive['indices'])]
            material = gltf['materials'][primitive['material']]['name']
            for i in range(0, len(indices), 3):
                points = [positions[index] for index in indices[i:i+3]]
                axis = next((j for j in range(3)
                             if max(p[j] for p in points) - min(p[j] for p in points) < 1e-7), None)
                if axis is None:
                    raise ValueError('Unexpected non-axis-aligned triangle')
                axes = [j for j in range(3) if j != axis]
                projected = [(p[axes[0]], p[axes[1]]) for p in points]
                if abs(signed_area(projected)) < 1e-10:
                    raise ValueError('Degenerate triangle')
                result.append({'part': node['name'], 'material': material,
                               'axis': axis, 'plane': points[0][axis],
                               'polygon': projected})
    return result


def signed_area(polygon):
    return sum(a[0] * b[1] - a[1] * b[0]
               for a, b in zip(polygon, polygon[1:] + polygon[:1])) / 2


def overlap_area(first, second):
    """Sutherland-Hodgman triangle clipping, independent of cuboid authoring."""
    subject = list(first)
    clip = list(second) if signed_area(second) > 0 else list(reversed(second))
    for a, b in zip(clip, clip[1:] + clip[:1]):
        def side(p):
            return (b[0]-a[0])*(p[1]-a[1]) - (b[1]-a[1])*(p[0]-a[0])
        previous = subject[-1] if subject else None
        output = []
        for current in subject:
            before, after = side(previous), side(current)
            if (before >= -1e-10) != (after >= -1e-10):
                amount = before / (before-after)
                output.append((previous[0]+amount*(current[0]-previous[0]),
                               previous[1]+amount*(current[1]-previous[1])))
            if after >= -1e-10:
                output.append(current)
            previous = current
        subject = output
        if not subject:
            return 0.0
    return abs(signed_area(subject))


def coplanar_different_material(gltf, binary):
    """Positive-area overlap includes SAME and OPPOSITE facing surfaces."""
    groups, collisions = defaultdict(list), []
    for triangle in triangles(gltf, binary):
        groups[(triangle['axis'], round(triangle['plane'], 6))].append(triangle)
    for values in groups.values():
        for first, second in itertools.combinations(values, 2):
            if first['material'] == second['material']:
                continue
            if abs(first['plane']-second['plane']) > 1e-6:
                continue
            a, b = first['polygon'], second['polygon']
            if any(min(max(p[j] for p in a), max(p[j] for p in b)) -
                   max(min(p[j] for p in a), min(p[j] for p in b)) <= 1e-8
                   for j in range(2)):
                continue
            area = overlap_area(a, b)
            if area > 1e-9:
                collisions.append({'firstPart': first['part'], 'secondPart': second['part'],
                                   'materials': [first['material'], second['material']],
                                   'axis': first['axis'], 'plane': first['plane'],
                                   'areaM2': area})
    return collisions


def inside_box(point, box):
    relative = [point[i]-box['centerM'][i] for i in range(3)]
    angle = box.get('rotationZRadians', 0)
    c, s = math.cos(angle), math.sin(angle)
    local = [c*relative[0]+s*relative[1], -s*relative[0]+c*relative[1], relative[2]]
    return all(abs(local[i]) <= box['sizeM'][i]/2 + 5e-6 for i in range(3))


class IndependentGeometryChecker(unittest.TestCase):
    def test_clipper_detects_interior_overlap_but_not_touching_edges(self):
        triangle = [(0, 0), (2, 0), (0, 2)]
        self.assertAlmostEqual(overlap_area(triangle, list(reversed(triangle))), 2)
        self.assertAlmostEqual(overlap_area(triangle, [(2, 0), (3, 0), (2, 1)]), 0)
        self.assertAlmostEqual(overlap_area(triangle, [(0, 0), (1, 0), (0, 1)]), .5)

    def test_v1_geometry_reproduces_known_service_and_chamber_defects(self):
        for family, part in [('cutter', 'cutter_service'), ('former', 'former_service')]:
            with self.subTest(family=family):
                overlaps = coplanar_different_material(*decode_glb(PUBLIC / (family + '.glb')))
                self.assertTrue(any(o['firstPart'] == part and o['secondPart'] == part
                                    for o in overlaps))
        cutter = coplanar_different_material(*decode_glb(PUBLIC / 'cutter.glb'))
        self.assertTrue(any(o['firstPart'] == 'cutter_chamber' and
                            o['secondPart'] == 'cutter_chamber' and o['axis'] == 2
                            and abs(o['plane'] + .875) < 1e-6 for o in cutter))


class V2AssetAdmission(unittest.TestCase):
    def test_whole_v2_glbs_have_no_positive_different_material_coplanarity(self):
        for family in ['cutter', 'former']:
            with self.subTest(family=family):
                overlaps = coplanar_different_material(*decode_glb(PUBLIC / (family + '-v2.glb')))
                self.assertEqual(overlaps, [], json.dumps(overlaps[:12], indent=2))

    def test_every_position_is_inside_its_original_part_box_union(self):
        for family in ['cutter', 'former']:
            with self.subTest(family=family):
                spec = json.loads((ART / family / (family + '-v2') / 'model-spec.json').read_text())
                source = json.loads((V1_ART / family / family / 'native-source.json').read_text())
                self.assertEqual(spec['source'], source)
                gltf, binary = decode_glb(PUBLIC / (family + '-v2.glb'))
                parts = {p['partId']: p for p in source['parts']}
                self.assertEqual(set(parts), {n['name'] for n in gltf['nodes']})
                for node in gltf['nodes']:
                    for primitive in gltf['meshes'][node['mesh']]['primitives']:
                        for point in accessor(gltf, binary, primitive['attributes']['POSITION']):
                            self.assertTrue(any(inside_box(point, box) for box in parts[node['name']]['boxes']),
                                            (family, node['name'], point))

    def test_repair_keeps_triangle_inventory_and_moves_vertices_by_at_most_one_mm(self):
        for family in ['cutter', 'former']:
            before, before_binary = decode_glb(PUBLIC / (family + '.glb'))
            after, after_binary = decode_glb(PUBLIC / (family + '-v2.glb'))
            original_nodes = {n['name']: n for n in before['nodes']}
            for node in after['nodes']:
                original = before['meshes'][original_nodes[node['name']]['mesh']]['primitives']
                changed = after['meshes'][node['mesh']]['primitives']
                self.assertEqual(len(original), len(changed))
                for old, new in zip(original, changed):
                    self.assertEqual(before['materials'][old['material']]['name'],
                                     after['materials'][new['material']]['name'])
                    old_positions = accessor(before, before_binary, old['attributes']['POSITION'])
                    new_positions = accessor(after, after_binary, new['attributes']['POSITION'])
                    old_indices = accessor(before, before_binary, old['indices'])
                    new_indices = accessor(after, after_binary, new['indices'])
                    self.assertEqual(len(old_positions), len(new_positions))
                    self.assertEqual(len(old_indices), len(new_indices))
                    self.assertEqual(set(v[0] for v in new_indices), set(range(len(new_positions))))
                    for point in new_positions:
                        distance = min(math.dist(point, original_point) for original_point in old_positions)
                        self.assertLessEqual(distance, .001 + 5e-7, (family, node['name'], point, distance))

    def test_nodes_keep_native_part_identity_and_neutral_transforms(self):
        for family in ['cutter', 'former']:
            with self.subTest(family=family):
                original = json.loads((V1_ART / family / family / 'model-spec.json').read_text())
                gltf, _ = decode_glb(PUBLIC / (family + '-v2.glb'))
                part_ids = [p['partId'] for p in original['source']['parts']]
                self.assertEqual(sorted(part_ids), sorted(n['name'] for n in gltf['nodes']))
                self.assertEqual(len(part_ids), len(gltf['nodes']))
                for node in gltf['nodes']:
                    self.assertNotIn('matrix', node)
                    self.assertNotIn('children', node)
                    self.assertEqual(node.get('translation', [0, 0, 0]), [0, 0, 0])
                    self.assertEqual(node.get('rotation', [0, 0, 0, 1]), [0, 0, 0, 1])
                    self.assertEqual(node.get('scale', [1, 1, 1]), [1, 1, 1])
                    self.assertEqual(node['extras']['playBinding'], {
                        'partId': node['name'], 'sourceSHA256': original['sourceFile']['sha256'],
                        'sourceAssetId': original['source']['assetId'],
                        'definitionId': original['source']['definitionId']})
                    canonical = node['extras']['hestia']
                    self.assertEqual(canonical['partId'], node['name'])
                    self.assertEqual(canonical['collisionPolicy'], 'None')
                    self.assertEqual(canonical['navigationPolicy'], 'None')
                    self.assertEqual(canonical['representation'], 'Decorative')
                for forbidden in ['animations', 'skins', 'textures', 'images']:
                    self.assertNotIn(forbidden, gltf)

    def test_material_palette_and_surface_response_are_unchanged(self):
        for family in ['cutter', 'former']:
            original, _ = decode_glb(PUBLIC / (family + '.glb'))
            current, _ = decode_glb(PUBLIC / (family + '-v2.glb'))
            before = {m['name']: m for m in original['materials']}
            after = {m['name']: m for m in current['materials']}
            self.assertEqual(before, after)
            self.assertTrue(set(after).issubset(PALETTE))

    def test_two_entry_manifest_source_payloads_and_export_reports_are_sealed(self):
        manifest = json.loads((ART / 'manifest.json').read_text())
        self.assertEqual(manifest['schema'], 'hestia.factory.play-assets/v1')
        self.assertEqual(manifest['palette'], PALETTE)
        self.assertEqual({e['assetId'] for e in manifest['assets']}, {'play_cutter_v2', 'play_former_v2'})
        self.assertEqual(len(manifest['assets']), 2)
        for entry in manifest['assets']:
            family = entry['family']
            original = json.loads((V1_ART / family / family / 'model-spec.json').read_text())
            self.assertEqual(entry['definitionRef'], original['definitionRef'])
            self.assertEqual(entry['sourceFile'], original['sourceFile'])
            for key in ['sourceBlob', 'sourceSnapshot', 'nativeBlend', 'runtimeGlb',
                        'exporterReport', 'provenance']:
                record = entry[key]
                path = ROOT / record['path']
                self.assertEqual(path.stat().st_size, record['bytes'])
                self.assertEqual(digest(path), record['sha256'])
            self.assertEqual((ROOT / entry['sourceBlob']['path']).read_bytes(),
                             (ROOT / original['sourceBlob']['path']).read_bytes())
            self.assertEqual((ROOT / entry['sourceSnapshot']['path']).read_bytes(),
                             (ROOT / original['sourceSnapshot']['path']).read_bytes())
            report = json.loads((ROOT / entry['exporterReport']['path']).read_text())
            self.assertEqual(report['digests']['glb_sha256'], entry['runtimeGlb']['sha256'])
            self.assertFalse(any(d['severity'] == 'error' for d in report['payload']['diagnostics']))
            provenance = json.loads((ROOT / entry['provenance']['path']).read_text())
            self.assertTrue(provenance['reopened'])
            self.assertEqual(provenance['blenderVersion'], '4.3.2')
            self.assertEqual(provenance['license'], 'LicenseRef-Hestia-Project-Original')
            self.assertEqual(entry['runtimeAdoption'], 'PENDING_INTEGRATOR')
            self.assertEqual(entry['ownerArtAcceptance'], 'OWNER_REVIEW_PENDING')

    def test_all_v1_payloads_and_generator_are_retained_byte_for_byte(self):
        manifest_path = V1_ART / 'manifest.json'
        self.assertEqual(manifest_path.stat().st_size, 83735)
        self.assertEqual(digest(manifest_path), 'f76c9cb6e504555446d3bafe7b8ef7a95bdb3b9242df51a2ef836aec548f03e1')
        generator = V1_ART / 'build_assets.py'
        self.assertEqual(digest(generator), '9017f6aa208d1b84e2d3e381d6c44a8c9f36d790be2f43489a7a8b5b20ceece9')
        v1 = json.loads(manifest_path.read_text())
        self.assertEqual(len(v1['assets']), 23)
        for entry in v1['assets']:
            for key in ['nativeBlend', 'runtimeGlb']:
                seal = entry[key]
                path = ROOT / seal['path']
                actual = path.read_bytes()
                if actual.startswith(b'version https://git-lfs.github.com/spec/v1\n'):
                    self.assertIn(('oid sha256:' + seal['sha256']).encode(), actual)
                    self.assertIn(('size ' + str(seal['bytes'])).encode(), actual)
                    original_index = subprocess.check_output(['git', 'show', BASE_COMMIT + ':' + seal['path']], cwd=ROOT)
                    self.assertEqual(actual, original_index)
                else:
                    self.assertEqual(len(actual), seal['bytes'])
                    self.assertEqual(hashlib.sha256(actual).hexdigest(), seal['sha256'])


if __name__ == '__main__':
    unittest.main(verbosity=2)
