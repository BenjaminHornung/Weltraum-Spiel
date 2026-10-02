import copy
from pathlib import Path
import struct
import tempfile
import unittest
from unittest.mock import patch

from glb_fixtures import box, fixture, glb, part
from tools.hestia_asset_compiler.errors import CompilerError
from tools.hestia_asset_compiler.geometry import canonicalize_geometry
from tools.hestia_asset_compiler.glb import load_glb, read_glb, read_report, strict_json
from tools.hestia_asset_compiler.profiles import BUDGETS, PROFILES, check_budget, check_grid


class ReaderTests(unittest.TestCase):
    def reject(self, code, document=None, binary=None, raw=None):
        if document is None:
            document, binary = fixture()
        with self.assertRaises(CompilerError) as caught:
            read_glb(raw if raw is not None else glb(document, binary))
        self.assertEqual(code, caught.exception.code)

    def test_fixture_repeatability_and_profiles(self):
        doc, binary = fixture()
        self.assertEqual(glb(doc, binary), glb(*fixture()))
        parsed = read_glb(glb(doc, binary))
        self.assertEqual(parsed.primitives[0][0].positions, ((0.0, 0.0, 0.0), (1.0, 0.0, 0.0), (0.0, 1.0, 0.0)))
        self.assertEqual(parsed.primitives[0][0].indices, (0, 1, 2))
        self.assertEqual(tuple(PROFILES.values()), (0.125, 0.25))

    def test_header_and_chunks_negative(self):
        valid = glb(*fixture())
        cases = [b"", b"xxxx" + valid[4:], valid[:4] + struct.pack("<I", 1) + valid[8:],
                 valid[:-1], valid + b"1234", valid[:12] + struct.pack("<II", 3, 0x4E4F534A) + valid[20:]]
        for raw in cases:
            with self.subTest(raw=raw[:20]):
                self.reject("glb.container", raw=raw)
        self.reject("glb.container", raw=valid[:16] + struct.pack("<I", 0x004E4942) + valid[20:])
        self.reject("glb.container", raw=valid[:16] + struct.pack("<I", 1234) + valid[20:])
        first_length = struct.unpack_from("<I", valid, 12)[0]
        second = 20 + first_length
        self.reject("glb.container", raw=valid[:second + 4] + struct.pack("<I", 0x4E4F534A) + valid[second + 8:])

    def test_json_before_decode(self):
        for raw, code in [(b'{"a":1,"a":2}', "json.duplicate-key"), (b'{"a":NaN}', "json.number"),
                          (b'{"a":1e999}', "json.number"), (b'"\xff"', "json.syntax"),
                          (b"[" * 65 + b"0" + b"]" * 65, "budget.json_depth"), (b'{"a":}', "json.syntax")]:
            with self.subTest(raw=raw[:30]), self.assertRaises(CompilerError) as caught:
                strict_json(raw)
            self.assertEqual(code, caught.exception.code)
        self.assertEqual(strict_json(b'{"s":"[\\\"{]"}'), {"s": '["{]'})

    def test_all_numeric_budget_boundaries(self):
        for name, limit in BUDGETS.items():
            with self.subTest(name=name):
                check_budget(name, limit)
                with self.assertRaises(CompilerError) as caught:
                    check_budget(name, limit + 1)
                self.assertEqual("budget." + name, caught.exception.code)
                with self.assertRaises(CompilerError):
                    check_budget(name, True)
        self.assertEqual(check_grid((-2, -2, -2), (9, 9, 9)), 1728)
        for lo, hi, code in [((0, 0, 0), (8000001, 0, 0), "budget.grid_coordinate"),
                             ((0, 0, 0), (200, 200, 200), "budget.grid_cells")]:
            with self.assertRaises(CompilerError) as caught:
                check_grid(lo, hi)
            self.assertEqual(code, caught.exception.code)

    def test_unreachable_primitive_index_storage_before_decode(self):
        for indexed in (True, False):
            with self.subTest(indexed=indexed):
                if indexed:
                    doc, binary = fixture(faces=[(0, 1, 2)] * 10001)
                else:
                    doc, binary = fixture(vertices=[(0, 0, 0)] * 10002)
                    doc["meshes"][0]["primitives"][0].pop("indices")
                primitive = doc["meshes"][0]["primitives"][0]
                # This mesh is unreachable: only mesh 0 participates in the instance count.
                doc["meshes"].append({"primitives": [dict(primitive) for _ in range(512)]})
                original_unpack = struct.unpack_from

                def header_only(fmt, *args):
                    if fmt not in ("<4sII", "<II"):
                        raise AssertionError("binary decode reached before cumulative index-storage guard")
                    return original_unpack(fmt, *args)

                with patch("tools.hestia_asset_compiler.glb.struct.unpack_from", side_effect=header_only):
                    self.reject("budget.decoded_bytes", doc, binary)

    def test_preread_file_and_report_caps(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "big.glb"
            with path.open("wb") as stream:
                stream.truncate(BUDGETS["glb_bytes"] + 1)
            with patch.object(Path, "read_bytes", side_effect=AssertionError("must not read")):
                with self.assertRaises(CompilerError) as caught:
                    load_glb(path)
            self.assertEqual(caught.exception.code, "budget.glb_bytes")
            with path.open("wb") as stream:
                stream.truncate(BUDGETS["report_bytes"] + 1)
            with self.assertRaises(CompilerError) as caught:
                read_report(path)
            self.assertEqual(caught.exception.code, "budget.report_bytes")
            path.write_bytes(b'{"payload":{},"digests":{}}')
            self.assertEqual(read_report(path)[0], {"payload": {}, "digests": {}})

    def test_bin_padding_and_buffer_boundary(self):
        doc, binary = fixture(index_type=5121)
        read_glb(glb(doc, binary))  # one byte alignment slack
        for length in [len(binary) - 4, len(binary) + 4]:
            bad = copy.deepcopy(doc)
            bad["buffers"][0]["byteLength"] = length
            self.reject("glb.buffer", bad, binary)
        doc["bufferViews"][1]["byteLength"] += 1
        self.reject("glb.buffer-view", doc, binary)

    def test_accessor_stride_offset_and_range(self):
        doc, binary = fixture(stride=16)
        read_glb(glb(doc, binary))
        # Offset 4 is legal with this stride; offset 8 exceeds the exact last access.
        shifted = copy.deepcopy(doc)
        shifted["accessors"][0]["byteOffset"] = 4
        read_glb(glb(shifted, binary))
        for field, value in [("byteOffset", 8), ("count", 4), ("count", True), ("componentType", 5125), ("type", "VEC2")]:
            bad = copy.deepcopy(doc)
            bad["accessors"][0][field] = value
            self.reject("glb.accessor", bad, binary)
        for stride in [8, 13, 256]:
            bad = copy.deepcopy(doc)
            bad["bufferViews"][0]["byteStride"] = stride
            self.reject("glb.accessor", bad, binary)
        doc["accessors"][0]["sparse"] = {}
        self.reject("glb.unsupported", doc, binary)

    def test_indices_unsigned_sentinels_and_oob(self):
        for component in [5121, 5123, 5125]:
            doc, binary = fixture(index_type=component)
            read_glb(glb(doc, binary))
            maximum = {5121: 255, 5123: 65535, 5125: 4294967295}[component]
            doc, binary = fixture(faces=[(0, 1, maximum)], index_type=component)
            self.reject("glb.indices", doc, binary)
        doc, binary = fixture(faces=[(0, 1, 3)])
        self.reject("glb.indices", doc, binary)
        doc, binary = fixture()
        doc["accessors"][1]["normalized"] = True
        self.reject("glb.accessor", doc, binary)
        doc["accessors"][1]["normalized"] = False
        doc["bufferViews"][1]["byteStride"] = 4
        self.reject("glb.accessor", doc, binary)

    def test_binary_nonfinite_and_normal_tangent(self):
        for value in [float("inf"), float("nan")]:
            doc, binary = fixture(vertices=[(value, 0, 0), (1, 0, 0), (0, 1, 0)])
            self.reject("glb.nonfinite", doc, binary)
        doc, binary = fixture()
        doc["meshes"][0]["primitives"][0]["attributes"]["NORMAL"] = 0
        read_glb(glb(doc, binary))
        doc["meshes"][0]["primitives"][0]["attributes"]["TANGENT"] = 0
        self.reject("glb.accessor", doc, binary)

    def test_unsupported_failclosed(self):
        base, binary = fixture()
        changes = [{"extensionsRequired": ["UNKNOWN"]}, {"extensionsUsed": ["KHR_draco_mesh_compression"]},
                   {"animations": []}, {"skins": []}]
        for change in changes:
            doc = copy.deepcopy(base)
            doc.update(change)
            self.reject("glb.unsupported", doc, binary)
        for field, value in [("mode", 1), ("targets", []), ("extensions", {"EXT_mesh_gpu_instancing": {}})]:
            doc = copy.deepcopy(base)
            doc["meshes"][0]["primitives"][0][field] = value
            self.reject("glb.unsupported", doc, binary)
        for uri in ["https://example.invalid/x", "file:///x", "data:application/octet-stream;base64,AA=="]:
            doc = copy.deepcopy(base)
            doc["buffers"][0]["uri"] = uri
            self.reject("glb.unsupported", doc, binary)

    def test_graph_and_instancing(self):
        base, binary = fixture()
        doc = copy.deepcopy(base)
        doc["nodes"].append({"mesh": 0, "extras": {"hestia": part("part.b")}})
        doc["scenes"][0]["nodes"] = [0, 1]
        self.assertEqual(len(read_glb(glb(doc, binary)).reachable), 2)
        for nodes, roots in [([{"children": [0]}], [0]), ([{"children": [1, 1]}, {}], [0]),
                             ([{"children": [2]}, {"children": [2]}, {}], [0, 1]),
                             ([{"children": [1]}, {}], [0, 1]), ([{}], [0, 0])]:
            bad = copy.deepcopy(base)
            bad["nodes"] = nodes
            bad["scenes"][0]["nodes"] = roots
            self.reject("glb.graph", bad, binary)
        doc = copy.deepcopy(base)
        doc["nodes"] = [{"children": [i + 1]} for i in range(64)] + [{}]
        self.reject("budget.graph_depth", doc, binary)

    def test_owned_mesh_exact_extras_and_material(self):
        for mutate in [lambda d: d["nodes"][0].pop("extras"),
                       lambda d: d["materials"][0].pop("extras"),
                       lambda d: d["nodes"][0]["extras"]["hestia"].update(partId=" BAD"),
                       lambda d: d["nodes"][0]["extras"]["hestia"].update(unknown=True),
                       lambda d: d["asset"]["extras"]["hestia"].update(metersPerUnit=True)]:
            doc, binary = fixture()
            mutate(doc)
            self.reject("glb.semantics", doc, binary)

    def test_embedded_render_data_and_external_image(self):
        doc, binary = fixture()
        doc["images"] = [{"bufferView": 0, "mimeType": "image/png"}]
        doc["samplers"] = [{"wrapS": 10497, "magFilter": 9729}]
        doc["textures"] = [{"source": 0, "sampler": 0}]
        doc["materials"][0]["pbrMetallicRoughness"] = {"baseColorFactor": [1, 1, 1, 1], "baseColorTexture": {"index": 0}}
        read_glb(glb(doc, binary))
        doc["images"][0]["uri"] = "https://example.invalid/image.png"
        self.reject("glb.unsupported", doc, binary)

    def test_counts_and_instance_cap_before_binary_decode(self):
        doc, binary = fixture(faces=[(0, 1, 2)] * 10001)
        doc["nodes"].append({"mesh": 0, "extras": {"hestia": part("part.b")}})
        doc["scenes"][0]["nodes"] = [0, 1]
        unpack = struct.unpack_from

        def headers_only(fmt, *args):
            if fmt not in ("<4sII", "<II"):
                raise AssertionError("expanded budget must reject before binary decode")
            return unpack(fmt, *args)

        with patch("tools.hestia_asset_compiler.glb.struct.unpack_from", side_effect=headers_only):
            self.reject("budget.instance_triangles", doc, binary)
        doc, binary = fixture()
        doc["accessors"][0]["count"] = BUDGETS["accessor_elements"] + 1
        self.reject("budget.accessor_elements", doc, binary)
        doc["accessors"][0]["count"] = 3
        doc["nodes"] = [{}] * (BUDGETS["nodes"] + 1)
        self.reject("budget.nodes", doc, binary)

    def test_malformed_shapes_always_stable_rejection(self):
        for mutate in [lambda d: d.update(nodes=[None]), lambda d: d.update(meshes=[None]),
                       lambda d: d["meshes"][0].update(primitives=[None]),
                       lambda d: d["accessors"][0].update(type=[]),
                       lambda d: d["bufferViews"][0].update(byteLength=True),
                       lambda d: d["nodes"][0].update(children=[False]),
                       lambda d: d["asset"]["extras"]["hestia"].update(assetRevision=True)]:
            doc, binary = fixture()
            mutate(doc)
            with self.subTest(doc=doc), self.assertRaises(CompilerError):
                read_glb(glb(doc, binary))

    def test_uv_pbr_extension_and_semantic_references(self):
        doc, binary = fixture()
        doc["materials"][0]["extensions"] = {"KHR_materials_unlit": {}}
        doc["extensionsRequired"] = ["KHR_materials_unlit"]
        read_glb(glb(doc, binary))
        doc["materials"][0]["extensions"]["KHR_materials_unlit"] = {"unknown": True}
        self.reject("glb.render", doc, binary)
        doc, binary = fixture()
        doc["nodes"][0]["extras"]["hestia"]["parentPartId"] = "part.missing"
        self.reject("glb.semantics", doc, binary)
        doc["nodes"][0]["extras"]["hestia"]["parentPartId"] = "part.a"
        self.reject("glb.semantics", doc, binary)

    def test_actual_uv_tangent_color_accessors(self):
        doc, binary = fixture()
        binary += b"\0" * (-len(binary) % 4)
        for name, width in [("TEXCOORD_0", 2), ("TANGENT", 4), ("COLOR_0", 4)]:
            start = len(binary)
            binary += struct.pack("<" + "f" * (width * 3), *([0.5] * (width * 3)))
            doc["bufferViews"].append({"buffer": 0, "byteOffset": start, "byteLength": width * 12})
            doc["accessors"].append({"bufferView": len(doc["bufferViews"]) - 1, "componentType": 5126, "count": 3, "type": "VEC" + str(width)})
            doc["meshes"][0]["primitives"][0]["attributes"][name] = len(doc["accessors"]) - 1
        doc["buffers"][0]["byteLength"] = len(binary)
        read_glb(glb(doc, binary))
        tangent = doc["bufferViews"][3]["byteOffset"]
        binary = binary[:tangent] + struct.pack("<f", float("inf")) + binary[tangent + 4:]
        self.reject("glb.nonfinite", doc, binary)

    def test_owner_lists_bounded_before_location_scan(self):
        class CountedOwners(list):
            visits = 0

            def __iter__(self):
                for owner in super().__iter__():
                    self.visits += 1
                    yield owner

        for field, budget in [("materials", "materials"), ("nodes", "nodes")]:
            with self.subTest(oversized=field):
                doc, binary = fixture(*box())
                doc[field] = [{"extensions": {}} for _ in range(BUDGETS[budget] + 1)]
                raw = glb(doc, binary)
                owners = CountedOwners(doc[field])

                def counted_json(data):
                    result = strict_json(data)
                    result[field] = owners
                    return result

                with patch("tools.hestia_asset_compiler.glb.strict_json", side_effect=counted_json):
                    self.reject("budget." + budget, raw=raw)
                self.assertEqual(owners.visits, 0, "cap must precede owner-set construction and scanner work")

        doc, binary = fixture()
        doc["materials"] += [{"extensions": {}, "extras": {"hestia": {
            "renderMaterialId": "render." + str(i), "structuralMaterialId": "steel." + str(i),
        }}} for i in range(1, BUDGETS["materials"])]
        raw = glb(doc, binary)
        owners = CountedOwners(doc["materials"])

        def counted_materials(data):
            result = strict_json(data)
            result["materials"] = owners
            return result

        with patch("tools.hestia_asset_compiler.glb.strict_json", side_effect=counted_materials):
            self.assertEqual(len(read_glb(raw).semantics["materials"]), 1024)
        self.assertLessEqual(owners.visits, 4 * len(owners), "owner admission must not scan the material list per object")
        for field in ("materials", "nodes"):
            for value in ({}, None, [None]):
                with self.subTest(field=field, value=value):
                    doc, binary = fixture()
                    doc[field] = value
                    self.reject("glb.structure", doc, binary)

    def test_hestia_transport_locations_and_ordinary_extras(self):
        doc, binary = fixture(*box())
        doc["images"] = [{"bufferView": 0, "mimeType": "image/png"}]
        doc["samplers"] = [{}]
        doc["textures"] = [{"source": 0, "sampler": 0}]
        doc["materials"][0]["pbrMetallicRoughness"] = {"baseColorTexture": {"index": 0}}
        doc["materials"][0]["extensions"] = {"KHR_materials_unlit": {}}
        doc["extensionsUsed"] = ["KHR_materials_unlit"]

        def owners(d):
            return [d, d["scenes"][0], d["meshes"][0], d["meshes"][0]["primitives"][0],
                    d["buffers"][0], d["bufferViews"][0], d["accessors"][0], d["images"][0],
                    d["samplers"][0], d["textures"][0], d["materials"][0]["pbrMetallicRoughness"],
                    d["materials"][0]["pbrMetallicRoughness"]["baseColorTexture"],
                    d["materials"][0]["extensions"]["KHR_materials_unlit"]]

        for index in range(len(owners(doc))):
            with self.subTest(unsupported_owner=index):
                bad = copy.deepcopy(doc)
                owners(bad)[index]["extras"] = {"hestia": {"renderMaterialId": "render.other"}}
                if index == 1:
                    owners(bad)[index]["extras"]["hestia"] = {"schema": "unknown.schema", "assetId": "asset.other"}
                self.reject("glb.semantics-location", bad, binary)
        expected = canonicalize_geometry(read_glb(glb(doc, binary)))
        ordinary = copy.deepcopy(doc)
        # Extras are opaque user metadata, not aliases for transport/extension owners.
        for owner in owners(ordinary)[:10] + [ordinary["asset"], ordinary["nodes"][0], ordinary["materials"][0]]:
            owner.setdefault("extras", {})["note"] = {"extensions": {"editor.flag": True}}
        parsed = read_glb(glb(ordinary, binary))
        self.assertEqual(parsed.document, ordinary)
        actual = canonicalize_geometry(parsed)
        self.assertEqual(len(actual.triangles), 12)
        self.assertEqual(actual.normalized_geometry_sha256, expected.normalized_geometry_sha256)
        self.assertEqual(actual.semantics_sha256, expected.semantics_sha256)

    def test_all_vertex_attribute_alignment_before_decode(self):
        def attribute(name, component, width, stride=None, offset=0, view_offset=0):
            doc, binary = fixture(*box())
            element = {5121: 1, 5123: 2, 5126: 4}[component] * width
            length = offset + 8 * (stride if stride is not None else element)
            view = {"buffer": 0, "byteOffset": len(binary) + view_offset, "byteLength": length}
            if stride is not None:
                view["byteStride"] = stride
            binary += bytes(view_offset + length)
            doc["bufferViews"].append(view)
            doc["accessors"].append({"bufferView": 2, "componentType": component, "count": 8,
                                     "type": "VEC" + str(width), "normalized": component != 5126, "byteOffset": offset})
            doc["meshes"][0]["primitives"][0]["attributes"][name] = 2
            doc["buffers"][0]["byteLength"] = len(binary)
            return doc, binary

        unpack = struct.unpack_from

        def headers_only(fmt, *args):
            if fmt not in ("<4sII", "<II"):
                raise AssertionError("misaligned attribute reached binary decoding")
            return unpack(fmt, *args)

        invalid = [("TEXCOORD_0", 5121, 2), ("TEXCOORD_1", 5121, 2), ("COLOR_0", 5121, 3),
                   ("TEXCOORD_0", 5121, 2, 4, 1), ("TEXCOORD_0", 5121, 2, 4, 3, 1),
                   ("NORMAL", 5126, 3, None, 0, 1), ("TANGENT", 5126, 4, None, 0, 1)]
        for args in invalid:
            with self.subTest(invalid=args):
                doc, binary = attribute(*args)
                self.reject("glb.accessor", doc, binary)
                with patch("tools.hestia_asset_compiler.glb.struct.unpack_from", side_effect=headers_only):
                    self.reject("glb.accessor", doc, binary)
        for args in [("TEXCOORD_0", 5121, 2, 4), ("TEXCOORD_1", 5123, 2), ("COLOR_0", 5121, 4),
                     ("COLOR_0", 5121, 3, 4), ("NORMAL", 5126, 3), ("TANGENT", 5126, 4)]:
            with self.subTest(valid=args):
                self.assertEqual(len(read_glb(glb(*attribute(*args))).primitives[0][0].positions), 8)
        for component, prefix in [(5121, 1), (5123, 2)]:
            with self.subTest(index_component=component):
                doc, binary = fixture(*box(), index_type=component)
                start = doc["bufferViews"][1]["byteOffset"]
                binary = binary[:start] + bytes(prefix) + binary[start:]
                doc["buffers"][0]["byteLength"] = len(binary)
                doc["bufferViews"][1]["byteLength"] += prefix
                doc["accessors"][1]["byteOffset"] = prefix
                self.assertEqual(len(read_glb(glb(doc, binary)).primitives[0][0].indices), 36)

    def test_render_zero_defaults_nonnegative_without_input_rewrite(self):
        doc, binary = fixture(*box())
        expected = canonicalize_geometry(read_glb(glb(doc, binary)))
        variants = [{"alphaMode": "MASK", "alphaCutoff": value} for value in (0, 0.0, 0.5, 2)]
        variants += [{"extensions": {"KHR_materials_emissive_strength": value}}
                     for value in ({}, {"emissiveStrength": 0}, {"emissiveStrength": 0.0}, {"emissiveStrength": 1}, {"emissiveStrength": 2})]
        for variant in variants:
            with self.subTest(valid=variant):
                valid = copy.deepcopy(doc)
                valid["materials"][0].update(variant)
                valid["extensionsUsed"] = ["KHR_materials_emissive_strength"]
                parsed = read_glb(glb(valid, binary))
                self.assertEqual(parsed.document, valid)  # omitted default stays omitted
                actual = canonicalize_geometry(parsed)
                self.assertEqual(actual.normalized_geometry_sha256, expected.normalized_geometry_sha256)
                self.assertEqual(actual.semantics_sha256, expected.semantics_sha256)
        for value in (-1, True, False, None, "0", [], float("nan"), float("inf"), -float("inf")):
            for field in ("alphaCutoff", "emissiveStrength"):
                with self.subTest(invalid=value, field=field):
                    bad = copy.deepcopy(doc)
                    bad["extensionsUsed"] = ["KHR_materials_emissive_strength"]
                    if field == "alphaCutoff":
                        bad["materials"][0][field] = value
                    else:
                        bad["materials"][0]["extensions"] = {"KHR_materials_emissive_strength": {field: value}}
                    code = "json.number" if type(value) is float else "glb.render"
                    self.reject(code, bad, binary)
        doc["nodes"][0]["extras"]["hestia"]["thinFeature"]["declaredMinimumThicknessMeters"] = 0
        self.reject("glb.semantics", doc, binary)
        doc, binary = fixture()
        doc["nodes"] += [{"extras": {"hestia": part("part.b", "StructuralAssembly")}}, {"extras": {"hestia": {
            "kind": "joint", "jointId": "joint.a", "parentPartId": "part.a", "childPartId": "part.b",
            "jointType": "Fixed", "breakPolicy": "Threshold", "breakForceNewtons": 1,
        }}}]
        doc["scenes"][0]["nodes"] = [0, 1, 2]
        read_glb(glb(doc, binary))
        doc["nodes"][2]["extras"]["hestia"]["breakForceNewtons"] = 0
        self.reject("glb.semantics", doc, binary)


if __name__ == "__main__":
    unittest.main()
