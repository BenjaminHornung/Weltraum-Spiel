"""Two bounded Blender derivatives; original native source and V1 assets are inputs."""
from pathlib import Path
import argparse
import copy
import hashlib
import importlib.util
import json
import shutil
import sys

sys.dont_write_bytecode = True
ROOT = Path(__file__).resolve().parents[3]
ART = ROOT / 'art/factory/play-surface-v2-2026-10-12'
V1_ART = ROOT / 'art/factory/play-2026-10-12'
PUBLIC = ROOT / 'apps/weltraum-browser/public/factory/play-2026-10-12'
SOURCE_HEAD = '96cced23cd285b57f8a557d01ac9ed8a158c927f'
SEALS = {
    'art/factory/play-2026-10-12/manifest.json': 'f76c9cb6e504555446d3bafe7b8ef7a95bdb3b9242df51a2ef836aec548f03e1',
    'art/factory/play-2026-10-12/build_assets.py': '9017f6aa208d1b84e2d3e381d6c44a8c9f36d790be2f43489a7a8b5b20ceece9',
    'tools/blender/hestia_asset_authoring/export_hestia_glb.py': '96732611048d3ff0d215e5c69ccfeed68234d552e75eed8c871572caf07b5b27',
}


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def record(path):
    return {'path': str(path.relative_to(ROOT)), 'sha256': sha(path), 'bytes': path.stat().st_size}


def write_json(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, indent=2, ensure_ascii=False) + '\n')


def original_helpers():
    """No original global freeze/snapshot/build/manifest call is admitted."""
    for relative, expected in SEALS.items():
        if sha(ROOT / relative) != expected:
            raise ValueError('Original source seal changed: ' + relative)
    spec = importlib.util.spec_from_file_location('hestia_v1_readonly_helpers', V1_ART / 'build_assets.py')
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def prepare_spec(family):
    original = json.loads((V1_ART / family / family / 'model-spec.json').read_text())
    directory = ART / family / (family + '-v2')
    directory.mkdir(parents=True, exist_ok=True)
    job = copy.deepcopy(original)
    job.update({'assetId': 'play_' + family + '_v2', 'slug': family + '-v2'})
    for key, filename in [('sourceSnapshot', 'native-source.json'),
                          ('sourceBlob', 'native-owner-source.blob')]:
        source = ROOT / original[key]['path']
        if sha(source) != original[key]['sha256'] or source.stat().st_size != original[key]['bytes']:
            raise ValueError('Native input seal changed: ' + str(source))
        shutil.copyfile(source, directory / filename)
        job[key] = record(directory / filename)
    job['visualRepair'] = {'version': 2, 'originalAssetId': original['assetId'],
                           'kind': 'bounded-render-surface-coplanarity-repair',
                           'nativeAuthority': 'unchanged original source only'}
    write_json(directory / 'model-spec.json', job)
    return original, job, directory


def recess_coplanar_surfaces(collection):
    """Move only conflicting cuboid face bounds inward, never cut/open a mesh.

    Faces are rectangular and axis aligned in both real Blender inputs. Material
    priority fixes the visible winner. Distinct depths separate the originally
    equal planes, with no repeated/cumulative pass. The deepest face recess is
    0.5 mm; even a vertex on three changed axes moves less than 0.867 mm.
    """
    from collections import defaultdict
    import itertools
    import math
    priority = {'EX-STRUCT': 0, 'EX-SHELL': 1, 'EX-FUNCTION': 2,
                'EX-HAZARD': 3, 'EX-PV': 4}
    groups, changes = defaultdict(list), {}
    objects = {obj.name: obj for obj in collection.objects}
    for obj in collection.objects:
        if obj.type != 'MESH':
            raise ValueError('Only the admitted native part meshes may be repaired')
        for face in obj.data.polygons:
            if len(face.vertices) != 4:
                raise ValueError('Repair requires the original closed cuboid quads')
            points = [obj.data.vertices[i].co.copy() for i in face.vertices]
            axis = next((i for i in range(3) if max(p[i] for p in points) - min(p[i] for p in points) < 1e-7), None)
            if axis is None:
                raise ValueError('Repair rejects non-axis-aligned geometry')
            name = obj.data.materials[face.material_index].name
            if name not in priority:
                raise ValueError('Repair rejects any changed material palette')
            projected_axes = [i for i in range(3) if i != axis]
            value = {'object': obj.name, 'face': face.index, 'vertices': list(face.vertices),
                     'axis': axis, 'plane': points[0][axis], 'material': name,
                     'sign': 1 if face.normal[axis] > 0 else -1,
                     'min': [min(p[i] for p in points) for i in projected_axes],
                     'max': [max(p[i] for p in points) for i in projected_axes]}
            groups[(axis, round(value['plane'], 6))].append(value)
    for faces in groups.values():
        for first, second in itertools.combinations(faces, 2):
            if first['material'] == second['material'] or abs(first['plane']-second['plane']) > 1e-6:
                continue
            if any(min(first['max'][i], second['max'][i]) - max(first['min'][i], second['min'][i]) <= 1e-8
                   for i in range(2)):
                continue
            loser = first if priority[first['material']] < priority[second['material']] else second
            changes[(loser['object'], loser['face'])] = loser
    moves = defaultdict(dict)
    for face in changes.values():
        depth = (4-priority[face['material']]) * .000125
        for vertex in face['vertices']:
            key = (face['object'], vertex)
            shift = -face['sign'] * depth
            previous = moves[key].get(face['axis'])
            if previous is not None and abs(previous-shift) > 1e-12:
                raise ValueError('Conflicting face bounds would open/collapse a cuboid')
            moves[key][face['axis']] = shift
    maximum = 0.0
    for (object_name, vertex), axes in moves.items():
        length = math.sqrt(sum(shift*shift for shift in axes.values()))
        if length > .001:
            raise ValueError('Repair exceeded the one-millimetre per-vertex grant')
        maximum = max(maximum, length)
        for axis, shift in axes.items():
            objects[object_name].data.vertices[vertex].co[axis] += shift
    for obj in collection.objects:
        obj.data.update()
    return {'changedFaceCount': len(changes), 'changedVertexCount': len(moves),
            'maxVertexDisplacementM': maximum, 'maxFaceRecessM': .0005,
            'materialPriorityLowToHigh': list(priority),
            'topology': 'same connected vertices, six closed quads per original cuboid'}


def build(assets):
    import bpy
    if bpy.app.version != (4, 3, 2):
        raise ValueError('Only the installed Blender 4.3.2 authoring contract is admitted')
    helper = original_helpers()
    from hestia_asset_authoring import export_hestia_glb
    v1_manifest = json.loads((V1_ART / 'manifest.json').read_text())
    entries = []
    for slug in assets:
        family = slug.removesuffix('-v2')
        original, job, directory = prepare_spec(family)
        baseline = next(e for e in v1_manifest['assets'] if e['slug'] == family)
        source_blend = ROOT / baseline['nativeBlend']['path']
        if sha(source_blend) != baseline['nativeBlend']['sha256']:
            raise ValueError('Native Blender input seal changed: ' + family)
        # The real delivered native scene supplies the cuboids and all witnesses.
        bpy.ops.wm.open_mainfile(filepath=str(source_blend))
        bpy.context.preferences.filepaths.save_version = 0
        collection = bpy.data.collections['hestia_play']
        collection['hestia.asset_id'] = job['assetId']
        collection['hestia.asset_revision'] = 1
        repair = recess_coplanar_surfaces(collection)
        job['visualRepair'].update(repair)
        write_json(directory / 'model-spec.json', job)
        bpy.context.scene['playProvenance'] = json.dumps({
            'sourceHead': SOURCE_HEAD, 'sourceFile': job['sourceFile'],
            'sourceBlob': job['sourceBlob'], 'sourceSnapshot': job['sourceSnapshot'],
            'generatorSHA256': sha(Path(__file__)),
            'nativeAuthority': 'unchanged frozen source; model is visual-only',
            'visualRepair': job['visualRepair']}, sort_keys=True)
        blend = directory / (slug + '.blend')
        bpy.ops.wm.save_as_mainfile(filepath=str(blend), check_existing=False)
        bpy.ops.wm.open_mainfile(filepath=str(blend))
        if bpy.data.filepath != str(blend):
            raise ValueError('Native derivative did not reopen from disk')
        if {o.name for o in bpy.data.collections['hestia_play'].objects} != {p['partId'] for p in job['source']['parts']}:
            raise ValueError('Native derivative part set changed')
        output = PUBLIC / (slug + '.glb')
        code = export_hestia_glb.main(['blender', '--', '--output', str(output),
                                     '--collection', 'hestia_play', '--unapplied-scale', 'error'])
        if code:
            raise ValueError('Existing project exporter rejected ' + slug)
        gltf = helper.glb_json(output)
        binding = helper.validate_binding({'source': job['source'],
                    'sourceSHA256': job['sourceFile']['sha256'],
                    'definitionRef': job['definitionRef'], 'nodes': gltf['nodes']})
        if not binding['valid']:
            raise ValueError('Source binding rejected: ' + str(binding['errors']))
        provenance = {'schema': 'hestia.play-model-provenance/v1', 'sourceHead': SOURCE_HEAD,
                      'sourceFile': job['sourceFile'], 'sourceBlob': job['sourceBlob'],
                      'sourceSnapshot': job['sourceSnapshot'], 'generator': record(Path(__file__)),
                      'originalNativeBlend': baseline['nativeBlend'],
                      'originalRuntimeGlb': baseline['runtimeGlb'], 'originalAssetId': original['assetId'],
                      'nativeBlend': record(blend), 'reopened': True, 'runtimeGlb': record(output),
                      'exporter': record(ROOT / 'tools/blender/hestia_asset_authoring/export_hestia_glb.py'),
                      'blenderVersion': bpy.app.version_string, 'gltfExporterVersion': '4.3.47',
                      'origin': 'project-original native Blender scene derivative; no provider/remote textures',
                      'license': 'LicenseRef-Hestia-Project-Original',
                      'assetToVoxelCompiler': 'KNOWN_GAP_NOT_DELIVERED',
                      'visualRepair': job['visualRepair']}
        write_json(directory / 'provenance.json', provenance)
        entry = copy.deepcopy(baseline)
        entry.update({'assetId': job['assetId'], 'slug': slug, 'sourceBlob': job['sourceBlob'],
                      'sourceSnapshot': job['sourceSnapshot'], 'nativeBlend': record(blend),
                      'runtimeGlb': {**record(output), 'url': '/factory/play-2026-10-12/' + output.name},
                      'exporterReport': record(output.with_name(slug + '.hestia-authoring-report.json')),
                      'provenance': record(directory / 'provenance.json'),
                      'nativeBoundsM': helper.native_bounds(job['source']),
                      'runtimeAdoption': 'PENDING_INTEGRATOR',
                      'ownerArtAcceptance': 'OWNER_REVIEW_PENDING',
                      'visualRepair': job['visualRepair']})
        entry['nativeReferences']['snapshotPath'] = job['sourceSnapshot']['path']
        entries.append(entry)
        print('PLAY_SURFACE_V2_SAVED_REOPENED_EXPORTED=' + slug)
    write_json(ART / 'manifest.json', {
        'schema': 'hestia.factory.play-assets/v1', 'sourceHead': SOURCE_HEAD,
        'assets': entries, 'palette': helper.PALETTE,
        'authority': 'derived render meshes only; no collider/material/quantity/energy/save authority',
        'knownGaps': ['runtime adoption is Integrator scope', 'human Art/usability/hardware acceptance pending']})


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--assets', nargs=2, choices=['cutter-v2', 'former-v2'], required=True)
    args = parser.parse_args(sys.argv[sys.argv.index('--') + 1:])
    if set(args.assets) != {'cutter-v2', 'former-v2'}:
        raise ValueError('The grant admits exactly the two distinct versioned assets')
    build(args.assets)


if __name__ == '__main__':
    main()
