"""Pure host-side tests for the Blender adapter and exporter CLI boundary."""

from __future__ import annotations

import ast
import hashlib
import importlib
import json
import struct
import sys
import tempfile
import types
import unittest
from pathlib import Path
from unittest import mock

import tools.blender.hestia_asset_authoring.blender_adapter as adapter
import tools.blender.hestia_asset_authoring.canonical as canonical
import tools.blender.hestia_asset_authoring.export_hestia_glb as cli
import tools.blender.hestia_asset_authoring.model as model
import tools.blender.hestia_asset_authoring.report as report
import tools.blender.hestia_asset_authoring.validation as validation


class _PropertyBlock(dict[str, object]):
    def id_properties_ensure(self) -> "_PropertyBlock":
        return self


class _FailingPropertyBlock(_PropertyBlock):
    def __init__(
        self,
        values: dict[str, object],
        *,
        fail_delete: str | None = None,
        fail_set: str | None = None,
    ) -> None:
        super().__init__(values)
        self.fail_delete = fail_delete
        self.fail_set = fail_set

    def __delitem__(self, key: str) -> None:
        if key == self.fail_delete:
            raise TypeError("injected delete failure")
        super().__delitem__(key)

    def __setitem__(self, key: str, value: object) -> None:
        if key == self.fail_set:
            raise TypeError("injected set failure")
        super().__setitem__(key, value)


class _FakeObject(_PropertyBlock):
    def __init__(self, name: str, properties: dict[str, object] | None = None) -> None:
        super().__init__(properties or {})
        self.name = name
        self.name_full = name
        self.data = None
        self.material_slots: tuple[object, ...] = ()
        self._selected = False

    def select_get(self) -> bool:
        return self._selected

    def select_set(self, selected: bool) -> None:
        self._selected = selected


class BlenderBoundaryTests(unittest.TestCase):
    def test_package_adapter_and_cli_import_without_bpy(self) -> None:
        with mock.patch.dict(sys.modules, {"bpy": None}):
            for module_name in (
                "tools.blender.hestia_asset_authoring",
                "tools.blender.hestia_asset_authoring.blender_adapter",
                "tools.blender.hestia_asset_authoring.export_hestia_glb",
            ):
                imported = importlib.import_module(module_name)
                self.assertIsNotNone(imported)

    def test_direct_bpy_import_is_confined_to_blender_adapter(self) -> None:
        package_dir = Path(adapter.__file__).resolve().parent
        offenders: list[str] = []
        importers: list[str] = []
        for path in sorted(package_dir.glob("*.py")):
            tree = ast.parse(path.read_text(encoding="utf-8"), filename=str(path))
            has_bpy_import = any(
                (isinstance(node, ast.Import) and any(alias.name == "bpy" for alias in node.names))
                or (isinstance(node, ast.ImportFrom) and node.module == "bpy")
                for node in ast.walk(tree)
            )
            if has_bpy_import:
                importers.append(path.name)
                if path.name != "blender_adapter.py":
                    offenders.append(path.name)
        self.assertEqual(["blender_adapter.py"], importers)
        self.assertEqual([], offenders)

    def test_cli_only_parses_arguments_after_blender_separator(self) -> None:
        parsed = cli._argument_parser().parse_args(
            cli._script_arguments(
                [
                    "blender",
                    "--background",
                    "source.blend",
                    "--python",
                    "export_hestia_glb.py",
                    "--",
                    "--collection",
                    "Export",
                    "--output",
                    "asset.glb",
                ]
            )
        )
        self.assertEqual("Export", parsed.collection)
        self.assertEqual(Path("asset.glb"), parsed.output)
        self.assertEqual([], cli._script_arguments(["blender", "--output", "wrong.glb"]))

    def test_empty_explicit_collection_never_falls_back_to_scene_export(self) -> None:
        scene_object = _FakeObject("ScenePart")
        scene = types.SimpleNamespace(objects=(scene_object,))
        collection = types.SimpleNamespace(
            name="Export",
            name_full="Export",
            objects=(),
            children=(),
        )
        fake_blender = types.SimpleNamespace(context=types.SimpleNamespace(scene=scene))

        with mock.patch.object(adapter, "bpy", fake_blender):
            with self.assertRaisesRegex(
                adapter.HestiaContractError,
                "named collection contains no exportable objects: 'Export'",
            ):
                adapter.export_glb("ignored.glb", collection=collection, scene=scene)

    def test_source_properties_reject_unknown_hestia_and_canonical_camel_case(self) -> None:
        for properties in ({"hestia.future_contract": 1}, {"hestia": {"attacker": True}}):
            with self.subTest(properties=properties):
                with self.assertRaisesRegex(adapter.HestiaContractError, "unknown Hestia"):
                    adapter.extract_properties(properties)
        for canonical_name in ("assetRevision", "declaredMinimumThicknessM"):
            with self.subTest(canonical_name=canonical_name):
                with self.assertRaisesRegex(adapter.HestiaContractError, "canonical camelCase"):
                    adapter.extract_properties({canonical_name: 1})

    def test_every_exact_input_property_has_a_canonical_mapping_without_drop(self) -> None:
        properties = {
            "hestia.schema_version": "hestia.asset-authoring.v1",
            "hestia.asset_id": "asset-01",
            "hestia.asset_revision": 2,
            "hestia.part_id": "part-01",
            "hestia.parent_part_id": "part-parent",
            "hestia.representation_mode": "Shell",
            "hestia.render_material_id": "render-01",
            "hestia.structural_material_id": "steel",
            "hestia.destructible": True,
            "hestia.collision_policy": "AuthoredMesh",
            "hestia.navigation_policy": "Obstacle",
            "hestia.thin_feature_policy": "PreserveAsShell",
            "hestia.declared_minimum_thickness_m": 0.02,
            "hestia.shell_thickness_m": 0.04,
            "hestia.joint_id": "joint-01",
            "hestia.child_part_id": "part-child",
            "hestia.joint_type": "Breakable",
            "hestia.break_policy": "Threshold",
            "hestia.break_force_n": 20.0,
            "hestia.break_torque_nm": 10.0,
            "hestia.marker_id": "marker-01",
            "hestia.marker_type": "CutInterface",
            "hestia.cut_interface_id": "cut-01",
            "hestia.palette_index": 0,
        }
        canonical_properties = adapter.canonical_properties(properties)
        self.assertEqual(len(properties), len(canonical_properties))
        self.assertEqual("Shell", canonical_properties["representation"])
        self.assertEqual(0.02, canonical_properties["declaredMinimumThicknessMeters"])
        self.assertEqual(20.0, canonical_properties["breakForceNewtons"])
        self.assertEqual("cut-01", canonical_properties["interfaceId"])
        self.assertEqual(0, canonical_properties["paletteIndex"])

    def test_required_asset_revision_and_declared_thickness_are_not_defaulted(self) -> None:
        fake_blender = types.SimpleNamespace()
        source = _PropertyBlock(
            {
                "hestia.schema_version": "hestia.asset-authoring.v1",
                "hestia.asset_id": "asset-01",
                "hestia.representation_mode": "StructuralAssembly",
            }
        )
        with mock.patch.object(adapter, "bpy", fake_blender):
            with self.assertRaisesRegex(adapter.HestiaContractError, "hestia.asset_revision"):
                adapter.extract_asset(source, objects=())

        source["hestia.asset_revision"] = 3
        part = _FakeObject(
            "Part",
            {
                "hestia.part_id": "part-01",
                "hestia.representation_mode": "StructuralAssembly",
                "hestia.render_material_id": "mat-render",
                "hestia.structural_material_id": "mat-structural",
                "hestia.destructible": False,
                "hestia.collision_policy": "None",
                "hestia.navigation_policy": "None",
                "hestia.thin_feature_policy": "Reject",
            },
        )
        with (
            mock.patch.object(adapter, "bpy", fake_blender),
            mock.patch.object(adapter, "transform_from_object", return_value=model.Transform()),
            mock.patch.object(adapter, "collect_mesh_inventory", return_value=((), (), ())),
        ):
            with self.assertRaisesRegex(adapter.HestiaContractError, "hestia.declared_minimum_thickness_m"):
                adapter.extract_asset(source, objects=(part,))

    def test_schema_version_is_required_and_must_match_exactly(self) -> None:
        fake_blender = types.SimpleNamespace()
        common = {
            "hestia.asset_id": "asset-01",
            "hestia.asset_revision": 1,
            "hestia.representation_mode": "StructuralAssembly",
        }
        with mock.patch.object(adapter, "bpy", fake_blender):
            with self.assertRaisesRegex(adapter.HestiaContractError, "hestia.schema_version"):
                adapter.extract_asset(_PropertyBlock(common), objects=())
            with self.assertRaisesRegex(adapter.HestiaContractError, "must be exactly"):
                adapter.extract_asset(
                    _PropertyBlock({**common, "hestia.schema_version": "hestia.asset-authoring.v1 "}),
                    objects=(),
                )

    def test_extracts_shell_layer_cut_interface_required_joint_and_material_palette(self) -> None:
        source = _PropertyBlock(
            {
                "hestia.schema_version": "hestia.asset-authoring.v1",
                "hestia.asset_id": "asset-01",
                "hestia.asset_revision": 4,
                "hestia.representation_mode": "StructuralAssembly",
            }
        )
        material = _PropertyBlock(
            {
                "hestia.render_material_id": "paint-blue",
                "hestia.structural_material_id": "steel",
                "hestia.palette_index": 0,
            }
        )
        material.name = "Blue"  # type: ignore[attr-defined]
        material.name_full = "Blue"  # type: ignore[attr-defined]
        part = _FakeObject(
            "Hull",
            {
                "hestia.part_id": "hull",
                "hestia.parent_part_id": "frame",
                "hestia.representation_mode": "LayeredShell",
                "hestia.render_material_id": "paint-blue",
                "hestia.structural_material_id": "steel",
                "hestia.destructible": True,
                "hestia.collision_policy": "AuthoredMesh",
                "hestia.navigation_policy": "Obstacle",
                "hestia.thin_feature_policy": "PreserveAsShell",
                "hestia.declared_minimum_thickness_m": 0.01,
                "hestia.shell_thickness_m": 0.04,
            },
        )
        part.material_slots = (types.SimpleNamespace(material=material),)
        joint = _FakeObject(
            "HullJoint",
            {
                "hestia.joint_id": "joint-hull",
                "hestia.parent_part_id": "hull",
                "hestia.child_part_id": "panel",
                "hestia.joint_type": "Breakable",
                "hestia.break_policy": "Threshold",
                "hestia.break_force_n": 250.0,
            },
        )
        marker = _FakeObject(
            "HullCut",
            {
                "hestia.marker_id": "cut-hull",
                "hestia.marker_type": "CutInterface",
                "hestia.part_id": "hull",
                "hestia.cut_interface_id": "interface-hull",
            },
        )
        with (
            mock.patch.object(adapter, "bpy", types.SimpleNamespace()),
            mock.patch.object(adapter, "transform_from_object", return_value=model.Transform()),
            mock.patch.object(adapter, "collect_mesh_inventory", return_value=((), (), ())),
        ):
            extracted = adapter.extract_asset(source, objects=(part, joint, marker))

        extracted_part = extracted.asset.parts[0]
        self.assertEqual("frame", extracted_part.parent_part_id)
        self.assertEqual(0.04, extracted_part.shell.thickness_m)  # type: ignore[union-attr]
        self.assertEqual("steel", extracted_part.shell.layers[0].structural_material_id)  # type: ignore[union-attr]
        self.assertEqual("interface-hull", extracted.asset.markers[0].interface_id)
        self.assertEqual(250.0, extracted.asset.joints[0].break_force_n)
        self.assertEqual(0, extracted.asset.materials[0].palette_index)

        del joint["hestia.break_force_n"]
        with (
            mock.patch.object(adapter, "bpy", types.SimpleNamespace()),
            mock.patch.object(adapter, "transform_from_object", return_value=model.Transform()),
            mock.patch.object(adapter, "collect_mesh_inventory", return_value=((), (), ())),
        ):
            with self.assertRaisesRegex(adapter.HestiaContractError, "Threshold break policy requires"):
                adapter.extract_asset(source, objects=(part, joint, marker))

    def test_cut_interface_and_shell_require_their_conditional_properties(self) -> None:
        source = _PropertyBlock(
            {
                "hestia.schema_version": "hestia.asset-authoring.v1",
                "hestia.asset_id": "asset-01",
                "hestia.asset_revision": 1,
                "hestia.representation_mode": "Shell",
            }
        )
        marker = _FakeObject(
            "Cut",
            {"hestia.marker_id": "cut-01", "hestia.marker_type": "CutInterface"},
        )
        with (
            mock.patch.object(adapter, "bpy", types.SimpleNamespace()),
            mock.patch.object(adapter, "transform_from_object", return_value=model.Transform()),
            mock.patch.object(adapter, "collect_mesh_inventory", return_value=((), (), ())),
        ):
            with self.assertRaisesRegex(adapter.HestiaContractError, "cut_interface_id"):
                adapter.extract_asset(source, objects=(marker,))

    def test_extraction_rejects_multi_role_and_role_shaped_objects_without_ids(self) -> None:
        source = _PropertyBlock(
            {
                "hestia.schema_version": "hestia.asset-authoring.v1",
                "hestia.asset_id": "asset-01",
                "hestia.asset_revision": 1,
                "hestia.representation_mode": "StructuralAssembly",
            }
        )
        cases = (
            (
                _FakeObject(
                    "Mixed",
                    {
                        "hestia.marker_id": "marker-01",
                        "hestia.marker_type": "Snap",
                        "hestia.part_id": "part-01",
                        "hestia.destructible": False,
                    },
                ),
                "multiple Hestia roles",
            ),
            (_FakeObject("PartShaped", {"hestia.collision_policy": "None"}), "hestia.part_id"),
            (_FakeObject("JointShaped", {"hestia.child_part_id": "part-01"}), "hestia.joint_id"),
            (_FakeObject("MarkerShaped", {"hestia.marker_type": "Snap"}), "hestia.marker_id"),
            (
                _FakeObject("ParentOnly", {"hestia.parent_part_id": "part-01"}),
                "do not identify",
            ),
            (_FakeObject("Unowned", {"hestia.palette_index": 1}), "do not identify"),
        )
        with (
            mock.patch.object(adapter, "bpy", types.SimpleNamespace()),
            mock.patch.object(adapter, "collect_mesh_inventory", return_value=((), (), ())),
        ):
            for obj, message in cases:
                with self.subTest(name=obj.name):
                    with self.assertRaisesRegex(adapter.HestiaContractError, message):
                        adapter.extract_asset(source, objects=(obj,))

    def test_material_identity_dedupes_references_but_rejects_distinct_blocks_with_same_id(self) -> None:
        source = _PropertyBlock(
            {
                "hestia.schema_version": "hestia.asset-authoring.v1",
                "hestia.asset_id": "asset-01",
                "hestia.asset_revision": 1,
                "hestia.representation_mode": "StructuralAssembly",
            }
        )
        part = _FakeObject(
            "Hull",
            {
                "hestia.part_id": "hull",
                "hestia.representation_mode": "StructuralAssembly",
                "hestia.render_material_id": "paint-blue",
                "hestia.destructible": False,
                "hestia.collision_policy": "None",
                "hestia.navigation_policy": "None",
                "hestia.thin_feature_policy": "Reject",
                "hestia.declared_minimum_thickness_m": 0.01,
            },
        )
        first = _PropertyBlock({"hestia.render_material_id": "paint-blue"})
        first.name = first.name_full = "BlueA"  # type: ignore[attr-defined]
        second = _PropertyBlock({"hestia.render_material_id": "paint-blue"})
        second.name = second.name_full = "BlueB"  # type: ignore[attr-defined]

        with (
            mock.patch.object(adapter, "bpy", types.SimpleNamespace()),
            mock.patch.object(adapter, "transform_from_object", return_value=model.Transform()),
            mock.patch.object(adapter, "collect_mesh_inventory", return_value=((), (), ())),
        ):
            part.material_slots = (
                types.SimpleNamespace(material=first),
                types.SimpleNamespace(material=first),
            )
            extracted = adapter.extract_asset(source, objects=(part,))
            self.assertEqual(("paint-blue",), tuple(item.render_material_id for item in extracted.asset.materials))

            part.material_slots = (
                types.SimpleNamespace(material=first),
                types.SimpleNamespace(material=second),
            )
            with self.assertRaisesRegex(
                adapter.HestiaContractError,
                "distinct material data-blocks share render material ID: paint-blue",
            ):
                adapter.extract_asset(source, objects=(part,))

    def test_structural_material_id_does_not_create_phantom_render_material(self) -> None:
        source = _PropertyBlock(
            {
                "hestia.schema_version": "hestia.asset-authoring.v1",
                "hestia.asset_id": "asset-01",
                "hestia.asset_revision": 1,
                "hestia.representation_mode": "StructuralAssembly",
            }
        )
        part = _FakeObject(
            "Hull",
            {
                "hestia.part_id": "hull",
                "hestia.representation_mode": "StructuralAssembly",
                "hestia.render_material_id": "paint",
                "hestia.structural_material_id": "steel",
                "hestia.destructible": False,
                "hestia.collision_policy": "None",
                "hestia.navigation_policy": "None",
                "hestia.thin_feature_policy": "Reject",
                "hestia.declared_minimum_thickness_m": 0.01,
            },
        )
        material = _PropertyBlock(
            {
                "hestia.render_material_id": "paint",
                "hestia.structural_material_id": "steel",
            }
        )
        material.name = material.name_full = "PaintSteel"  # type: ignore[attr-defined]
        part.material_slots = (types.SimpleNamespace(material=material),)

        with (
            mock.patch.object(adapter, "bpy", types.SimpleNamespace()),
            mock.patch.object(adapter, "transform_from_object", return_value=model.Transform()),
            mock.patch.object(adapter, "collect_mesh_inventory", return_value=((), (), ())),
        ):
            extracted = adapter.extract_asset(source, objects=(part,))

        self.assertEqual(
            (model.CanonicalMaterial(render_material_id="paint", structural_material_id="steel"),),
            extracted.asset.materials,
        )
        self.assertNotIn(
            "steel",
            tuple(material.render_material_id for material in extracted.asset.materials),
        )

    def test_empty_material_slots_leave_default_render_material_unresolved(self) -> None:
        source = _PropertyBlock(
            {
                "hestia.schema_version": "hestia.asset-authoring.v1",
                "hestia.asset_id": "asset-01",
                "hestia.asset_revision": 1,
                "hestia.representation_mode": "StructuralAssembly",
            }
        )
        part = _FakeObject(
            "Hull",
            {
                "hestia.part_id": "hull",
                "hestia.representation_mode": "StructuralAssembly",
                "hestia.render_material_id": "paint",
                "hestia.structural_material_id": "steel",
                "hestia.destructible": False,
                "hestia.collision_policy": "None",
                "hestia.navigation_policy": "None",
                "hestia.thin_feature_policy": "Reject",
                "hestia.declared_minimum_thickness_m": 0.01,
            },
        )
        part.material_slots = ()

        with (
            mock.patch.object(adapter, "bpy", types.SimpleNamespace()),
            mock.patch.object(adapter, "transform_from_object", return_value=model.Transform()),
            mock.patch.object(adapter, "collect_mesh_inventory", return_value=((), (), ())),
        ):
            extracted = adapter.extract_asset(source, objects=(part,))

        self.assertEqual((), extracted.asset.materials)
        diagnostics = validation.validate_asset(extracted)
        self.assertTrue(
            any(
                item.severity == model.DiagnosticSeverity.ERROR
                and item.code == "reference.not-exactly-one"
                and item.path.endswith(".defaultRenderMaterialId")
                and "paint" in item.message
                for item in diagnostics
            )
        )

    def test_semantic_part_mesh_creates_polygon_material_primitives_and_always_clears(self) -> None:
        red = _PropertyBlock({"hestia.render_material_id": "paint-red"})
        red.name = "Red"  # type: ignore[attr-defined]
        red.name_full = "Red"  # type: ignore[attr-defined]
        blue = _PropertyBlock({"hestia.render_material_id": "paint-blue"})
        blue.name = "Blue"  # type: ignore[attr-defined]
        blue.name_full = "Blue"  # type: ignore[attr-defined]
        mesh = types.SimpleNamespace(
            vertices=tuple(
                types.SimpleNamespace(co=coordinate)
                for coordinate in ((0, 0, 0), (1, 0, 0), (1, 1, 0), (0, 1, 0))
            ),
            edges=tuple(
                types.SimpleNamespace(vertices=edge)
                for edge in ((0, 1), (1, 2), (2, 3), (3, 0), (0, 2))
            ),
            polygons=(
                types.SimpleNamespace(vertices=(0, 1, 2), area=0.5, material_index=1),
                types.SimpleNamespace(vertices=(0, 2, 3), area=0.5, material_index=0),
            ),
        )
        evaluated = types.SimpleNamespace(
            material_slots=(types.SimpleNamespace(material=red), types.SimpleNamespace(material=blue)),
            to_mesh=mock.Mock(return_value=mesh),
            to_mesh_clear=mock.Mock(),
        )
        obj = _FakeObject("Hull", {"hestia.part_id": "hull"})
        obj.type = "MESH"  # type: ignore[attr-defined]
        obj.evaluated_get = mock.Mock(return_value=evaluated)  # type: ignore[attr-defined]

        fake_blender = types.SimpleNamespace(
            context=types.SimpleNamespace(evaluated_depsgraph_get=mock.Mock(return_value=object()))
        )
        with mock.patch.object(adapter, "bpy", fake_blender):
            inventory, primitives = adapter.mesh_inventory_for_object(obj)  # type: ignore[misc]

        self.assertEqual("hull", inventory.mesh_id)
        self.assertEqual(("paint-blue", "paint-red"), inventory.material_ids)
        self.assertEqual(("hull:0", "hull:1"), inventory.primitive_ids)
        self.assertEqual(
            (("hull:0", "paint-red", 1), ("hull:1", "paint-blue", 1)),
            tuple((item.primitive_id, item.material_id, item.topology.polygon_count) for item in primitives),
        )
        evaluated.to_mesh_clear.assert_called_once_with()

    def test_transform_uses_true_matrix_determinant_to_preserve_reflection(self) -> None:
        class Matrix:
            values = (
                (-2.0, 0.0, 0.0, 0.0),
                (0.0, 3.0, 0.0, 0.0),
                (0.0, 0.0, 4.0, 0.0),
                (0.0, 0.0, 0.0, 1.0),
            )

            def __getitem__(self, index: int) -> tuple[float, ...]:
                return self.values[index]

            @staticmethod
            def to_translation() -> tuple[float, float, float]:
                return (0.0, 0.0, 0.0)

            @staticmethod
            def to_quaternion() -> tuple[float, float, float, float]:
                return (0.0, 0.0, 0.0, 1.0)

            @staticmethod
            def to_scale() -> tuple[float, float, float]:
                return (2.0, 3.0, 4.0)

        obj = _FakeObject("Mirrored")
        obj.matrix_local = Matrix()  # type: ignore[attr-defined]
        with mock.patch.object(adapter, "bpy", types.SimpleNamespace()):
            metrics = adapter.transform_metrics(obj)
            transform = adapter.transform_from_object(obj)
        self.assertEqual(-24.0, metrics["determinant"])
        self.assertEqual((-2.0, 3.0, 4.0), transform.scale)

    def test_attach_extras_uses_exact_allowlists_and_completes_nested_assignment(self) -> None:
        class CopyingBlock(_PropertyBlock):
            def __setitem__(self, key: str, value: object) -> None:
                super().__setitem__(key, dict(value) if isinstance(value, dict) else value)

        block = CopyingBlock()
        extras = {
            "partId": "hull",
            "representation": "LayeredShell",
            "thinFeature": {
                "policy": "PreserveAsShell",
                "declaredMinimumThicknessMeters": 0.01,
            },
            "shell": {
                "thicknessMeters": 0.04,
                "layers": [{"structuralMaterialId": "steel", "thicknessMeters": 0.04}],
            },
            "tags": ("hull",),
        }
        with mock.patch.object(adapter, "bpy", types.SimpleNamespace()):
            adapter.attach_hestia_extras(block, extras, kind="part")
            with self.assertRaisesRegex(adapter.HestiaContractError, "non-canonical"):
                adapter.attach_hestia_extras(block, {**extras, "representationMode": "Shell"}, kind="part")
            with self.assertRaisesRegex(adapter.HestiaContractError, "non-canonical"):
                adapter.attach_hestia_extras(_PropertyBlock(), {"schema": "x", "kind": "part"})
        self.assertEqual("PreserveAsShell", block["hestia"]["thinFeature"]["policy"])  # type: ignore[index]
        self.assertEqual("steel", block["hestia"]["shell"]["layers"][0]["structuralMaterialId"])  # type: ignore[index]
        self.assertEqual(["hull"], block["hestia"]["tags"])  # type: ignore[index]
        self.assertEqual("part", block["hestia"]["kind"])  # type: ignore[index]

    def test_node_extras_add_each_exact_transport_kind_and_nowhere_else(self) -> None:
        contracts = {
            "part": {
                "partId": "part-01",
                "representation": "StructuralAssembly",
                "destructible": False,
                "collisionPolicy": "None",
                "navigationPolicy": "None",
                "thinFeature": {"policy": "Reject", "declaredMinimumThicknessMeters": 0.01},
                "tags": (),
            },
            "joint": {
                "jointId": "joint-01",
                "parentPartId": "part-01",
                "childPartId": "part-02",
                "jointType": "Fixed",
                "breakPolicy": "Never",
                "tags": (),
            },
            "marker": {"markerId": "marker-01", "markerType": "Snap", "tags": ()},
        }
        with mock.patch.object(adapter, "bpy", types.SimpleNamespace()):
            for kind, contract in contracts.items():
                with self.subTest(kind=kind):
                    block = _PropertyBlock()
                    adapter.attach_hestia_extras(block, contract, kind=kind)
                    self.assertEqual(kind, block["hestia"]["kind"])  # type: ignore[index]
            with self.assertRaisesRegex(adapter.HestiaContractError, "non-canonical"):
                adapter.attach_hestia_extras(
                    _PropertyBlock(),
                    {"renderMaterialId": "mat-01", "kind": "part"},
                )

    def test_attach_canonical_extras_matches_material_id_to_render_material_id(self) -> None:
        material = _PropertyBlock({"hestia.render_material_id": "paint-blue"})
        obj = _FakeObject("Hull")
        obj.material_slots = (types.SimpleNamespace(material=material),)
        source = _PropertyBlock()
        canonical_material = model.CanonicalMaterial(
            render_material_id="paint-blue",
            structural_material_id="steel",
            palette_index=3,
            tags=("exterior",),
        )
        authoring_input = model.AuthoringInput(
            asset=model.CanonicalAsset(
                asset_id="asset-01",
                asset_revision=1,
                representation_mode=model.RepresentationMode.STRUCTURAL_ASSEMBLY,
                materials=(canonical_material,),
            ),
            inventory=model.GeometryInventory((), (), ()),
        )
        real_attach = mock.Mock(wraps=adapter.attach_hestia_extras)
        boundary_adapter = types.SimpleNamespace(
            attach_hestia_extras=real_attach,
            iter_scene_objects=mock.Mock(return_value=(obj,)),
            extract_properties=adapter.extract_properties,
        )
        expected_contract = {
            "renderMaterialId": "paint-blue",
            "structuralMaterialId": "steel",
            "paletteIndex": 3,
            "tags": ("exterior",),
        }

        with mock.patch.object(adapter, "bpy", types.SimpleNamespace()):
            cli._attach_canonical_extras(boundary_adapter, source, object(), None, authoring_input)

        real_attach.assert_any_call(material, expected_contract)
        self.assertEqual(
            {
                "paletteIndex": 3,
                "renderMaterialId": "paint-blue",
                "structuralMaterialId": "steel",
                "tags": ["exterior"],
            },
            material["hestia"],
        )
        self.assertNotIn("kind", material["hestia"])  # type: ignore[operator]

    def test_snapshot_is_detached_and_restore_attempts_every_block_after_partial_failure(self) -> None:
        original = _PropertyBlock(
            {"hestia": {"nested": {"value": 1}}, "hestia.part_id": "hull", "ordinary": 7}
        )
        snapshot = adapter.snapshot_hestia_properties((original,))
        original["hestia"]["nested"]["value"] = 9  # type: ignore[index]
        original["hestia.temporary"] = True
        adapter.restore_hestia_properties(snapshot)
        self.assertEqual(1, original["hestia"]["nested"]["value"])  # type: ignore[index]
        self.assertNotIn("hestia.temporary", original)
        self.assertEqual(7, original["ordinary"])

        failing = _FailingPropertyBlock({}, fail_set="hestia.part_id")
        succeeding = _PropertyBlock({"hestia.temporary": True})
        with self.assertRaisesRegex(adapter.HestiaContractError, "could not restore"):
            adapter.restore_hestia_properties(
                (
                    (failing, {"hestia.part_id": "failed"}),
                    (succeeding, {"hestia.part_id": "restored"}),
                )
            )
        self.assertEqual("restored", succeeding["hestia.part_id"])
        self.assertNotIn("hestia.temporary", succeeding)

        cannot_delete = _FailingPropertyBlock({"hestia.part_id": "failed"}, fail_delete="hestia.part_id")
        deleted = _PropertyBlock({"hestia.part_id": "removed"})
        with self.assertRaisesRegex(adapter.HestiaContractError, "temporarily remove"):
            adapter.clear_hestia_properties(
                (
                    (cannot_delete, {"hestia.part_id": "failed"}),
                    (deleted, {"hestia.part_id": "removed"}),
                )
            )
        self.assertNotIn("hestia.part_id", deleted)

    @staticmethod
    def _authoring_input() -> model.AuthoringInput:
        asset = model.CanonicalAsset(
            asset_id="asset-01",
            asset_revision=7,
            representation_mode=model.RepresentationMode.STRUCTURAL_ASSEMBLY,
        )
        return model.AuthoringInput(asset=asset, inventory=model.GeometryInventory((), (), ()))

    def test_non_finite_mesh_bounds_are_rejected_and_serialized_as_null(self) -> None:
        base_input = self._authoring_input()
        inputs = model.AuthoringInput(
            asset=base_input.asset,
            inventory=model.GeometryInventory(
                meshes=(
                    model.MeshInventory(
                        "mesh-01",
                        bounds_min=(float("nan"), 0.0, 0.0),
                        bounds_max=(1.0, 1.0, 1.0),
                        material_ids=("mat-render",),
                        primitive_ids=("mesh-01",),
                    ),
                ),
                primitives=(model.PrimitiveInventory("mesh-01", "mesh-01", "mat-render"),),
                materials=(model.MaterialInventory("mat-render"),),
            ),
        )

        diagnostics = validation.validate_asset(inputs)
        bounds_diagnostics = [item for item in diagnostics if item.code == "inventory.bounds"]
        self.assertEqual(1, len(bounds_diagnostics))
        self.assertEqual(model.DiagnosticSeverity.ERROR, bounds_diagnostics[0].severity)
        self.assertEqual("mesh[mesh-01]", bounds_diagnostics[0].path)

        document = report.build_report(
            inputs,
            diagnostics=diagnostics,
            glb_sha256=None,
            output_basename="asset.glb",
        )
        serialized = canonical.canonical_json_bytes(document)
        report_document = json.loads(serialized)
        mesh_payload = report_document["payload"]["inventory"]["meshes"][0]
        self.assertIsNone(mesh_payload["boundsMin"])
        self.assertEqual([1.0, 1.0, 1.0], mesh_payload["boundsMax"])
        self.assertIsNone(report_document["payload"]["glbSha256"])
        self.assertIsNone(report_document["digests"]["glb_sha256"])
        serialized_text = serialized.decode("utf-8")
        for forbidden in ("NaN", "Infinity", "timestamp"):
            with self.subTest(forbidden=forbidden):
                self.assertNotIn(forbidden, serialized_text)

    @staticmethod
    def _minimal_glb(
        document: dict[str, object] | None = None,
        trailing_chunks: tuple[tuple[int, bytes], ...] = (),
    ) -> bytes:
        payload = json.dumps(
            document or {"asset": {"version": "2.0"}},
            separators=(",", ":"),
        ).encode("utf-8")
        payload += b" " * (-len(payload) % 4)
        chunks = ((0x4E4F534A, payload), *trailing_chunks)
        body = b"".join(
            struct.pack("<II", len(chunk), chunk_type) + chunk
            for chunk_type, chunk in chunks
        )
        return struct.pack("<4sII", b"glTF", 2, 12 + len(body)) + body

    @staticmethod
    def _glb_document(data: bytes) -> tuple[dict[str, object], tuple[tuple[int, bytes], ...]]:
        magic, version, length = struct.unpack_from("<4sII", data)
        if (magic, version, length) != (b"glTF", 2, len(data)):
            raise AssertionError("invalid test GLB header")
        chunks: list[tuple[int, bytes]] = []
        offset = 12
        while offset < len(data):
            chunk_length, chunk_type = struct.unpack_from("<II", data, offset)
            offset += 8
            chunk = data[offset : offset + chunk_length]
            if len(chunk) != chunk_length or chunk_length % 4:
                raise AssertionError("invalid test GLB chunk")
            chunks.append((chunk_type, chunk))
            offset += chunk_length
        return json.loads(chunks[0][1].decode("utf-8")), tuple(chunks)

    @staticmethod
    def _mock_modules(
        output: Path,
        *,
        diagnostics: tuple[model.Diagnostic, ...] = (),
    ) -> tuple[object, object, object, object, object]:
        scene = _PropertyBlock()
        scene.objects = ()  # type: ignore[attr-defined]
        blender = types.SimpleNamespace(context=types.SimpleNamespace(scene=scene))
        authoring_input = BlenderBoundaryTests._authoring_input()

        def export_glb(path: Path, **_: object) -> set[str]:
            Path(path).write_bytes(BlenderBoundaryTests._minimal_glb())
            return {"FINISHED"}

        def attach_hestia_extras(
            target: _PropertyBlock,
            extras: object,
            *,
            kind: str | None = None,
            **_: object,
        ) -> None:
            copied_extras = json.loads(json.dumps(extras))
            if kind is not None:
                copied_extras["kind"] = kind
            target["hestia"] = copied_extras

        def snapshot_hestia_properties(
            blocks: object,
            *,
            include_root: bool = True,
        ) -> list[tuple[_PropertyBlock, dict[str, object]]]:
            return [
                (
                    block,
                    {
                        key: json.loads(json.dumps(value))
                        for key, value in block.items()
                        if key.startswith("hestia.") or (include_root and key == "hestia")
                    },
                )
                for block in blocks  # type: ignore[union-attr]
            ]

        def clear_hestia_properties(snapshots: object, *, include_root: bool = True) -> None:
            for block, values in snapshots:  # type: ignore[union-attr]
                for key in values:
                    del block[key]

        def restore_hestia_properties(snapshots: object) -> None:
            for block, values in snapshots:  # type: ignore[union-attr]
                for key in tuple(block):
                    if key == "hestia" or key.startswith("hestia."):
                        del block[key]
                block.update(values)

        mocked_adapter = types.SimpleNamespace(
            HestiaContractError=adapter.HestiaContractError,
            require_blender=mock.Mock(return_value=blender),
            find_named_collection=mock.Mock(return_value=None),
            extract_asset=mock.Mock(return_value=authoring_input),
            iter_scene_objects=mock.Mock(return_value=()),
            iter_collection_objects=mock.Mock(return_value=()),
            extract_properties=mock.Mock(return_value={}),
            attach_hestia_extras=mock.Mock(side_effect=attach_hestia_extras),
            snapshot_hestia_properties=mock.Mock(side_effect=snapshot_hestia_properties),
            clear_hestia_properties=mock.Mock(side_effect=clear_hestia_properties),
            restore_hestia_properties=mock.Mock(side_effect=restore_hestia_properties),
            export_glb=mock.Mock(side_effect=export_glb),
        )
        mocked_validation = types.SimpleNamespace(validate_asset=mock.Mock(return_value=diagnostics))
        return mocked_adapter, model, mocked_validation, report, canonical

    def test_validation_error_preserves_glb_and_atomically_replaces_deterministic_report(self) -> None:
        diagnostic = model.Diagnostic(
            severity=model.DiagnosticSeverity.ERROR,
            code="schema.invalid",
            message="invalid source",
        )
        with tempfile.TemporaryDirectory() as directory:
            output = Path(directory) / "asset.glb"
            sidecar = Path(directory) / "asset.hestia-authoring-report.json"
            output.write_bytes(b"stale")
            sidecar.write_bytes(b"stale")
            modules = self._mock_modules(output, diagnostics=(diagnostic,))
            mocked_adapter = modules[0]
            with mock.patch.object(cli, "_load_contract_modules", return_value=modules):
                result = cli.main(["blender", "--", "--output", str(output)])
                first_report = sidecar.read_bytes()
                second_result = cli.main(["blender", "--", "--output", str(output)])
            self.assertEqual(1, result)
            self.assertEqual(1, second_result)
            mocked_adapter.export_glb.assert_not_called()  # type: ignore[attr-defined]
            self.assertEqual(b"stale", output.read_bytes())
            self.assertEqual(first_report, sidecar.read_bytes())
            report_document = json.loads(first_report)
            self.assertIsNone(report_document["digests"]["glb_sha256"])
            self.assertIsNone(report_document["payload"]["glbSha256"])
            self.assertEqual("asset.glb", report_document["payload"]["outputBasename"])
            self.assertEqual(
                "schema.invalid",
                report_document["payload"]["diagnostics"][0]["code"],
            )

    def test_txt_output_is_rejected_before_handoff_and_preserves_sentinels(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            output = Path(directory) / "asset.txt"
            sidecar = Path(directory) / "asset.hestia-authoring-report.json"
            output.write_bytes(b"prior-output")
            sidecar.write_bytes(b"prior-sidecar")
            modules = self._mock_modules(output)
            mocked_adapter = modules[0]
            with (
                mock.patch.object(cli, "_load_contract_modules", return_value=modules),
                mock.patch.object(cli.os, "replace") as replace,
            ):
                result = cli.main(["blender", "--", "--output", str(output)])

            self.assertEqual(1, result)
            mocked_adapter.export_glb.assert_not_called()  # type: ignore[attr-defined]
            replace.assert_not_called()
            self.assertEqual(b"prior-output", output.read_bytes())
            self.assertEqual(b"prior-sidecar", sidecar.read_bytes())

    def test_output_equal_to_blender_source_is_rejected_without_mutating_source(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            source = Path(directory) / "source.glb"
            source.write_bytes(b"source-sentinel")
            modules = self._mock_modules(source)
            mocked_adapter = modules[0]
            mocked_adapter.require_blender().data = types.SimpleNamespace(filepath=str(source))  # type: ignore[attr-defined]
            with (
                mock.patch.object(cli, "_load_contract_modules", return_value=modules),
                mock.patch.object(cli.os, "replace") as replace,
            ):
                result = cli.main(["blender", "--", "--output", str(source)])

            self.assertEqual(1, result)
            mocked_adapter.export_glb.assert_not_called()  # type: ignore[attr-defined]
            replace.assert_not_called()
            self.assertEqual(b"source-sentinel", source.read_bytes())

    def test_explicit_collection_is_asset_metadata_source_without_scene_duplication(self) -> None:
        expected_asset_extras = {
            "schema": "hestia.asset-authoring.v1",
            "assetId": "asset-01",
            "assetRevision": 7,
            "representation": "StructuralAssembly",
            "metersPerUnit": 1,
            "coordinateFrame": {"forwardAxis": "+Z", "handedness": "RIGHT", "upAxis": "+Y"},
            "tags": [],
        }

        with tempfile.TemporaryDirectory() as directory:
            output = Path(directory) / "asset.glb"
            modules = self._mock_modules(output)
            mocked_adapter = modules[0]
            scene = mocked_adapter.require_blender().context.scene  # type: ignore[attr-defined]
            collection = _PropertyBlock()
            collection.name = "StructuralAssembly"  # type: ignore[attr-defined]
            collection.objects = ()  # type: ignore[attr-defined]
            collection.children = ()  # type: ignore[attr-defined]
            collection_object = _FakeObject("CollectionPart")
            mocked_adapter.find_named_collection.return_value = collection  # type: ignore[attr-defined]
            mocked_adapter.iter_collection_objects.return_value = (collection_object,)  # type: ignore[attr-defined]
            observed: dict[str, object] = {}

            def export_collection(path: Path, **_: object) -> set[str]:
                observed["collection_hestia"] = json.loads(json.dumps(collection["hestia"]))
                observed["scene_hestia"] = scene.get("hestia")
                Path(path).write_bytes(BlenderBoundaryTests._minimal_glb())
                return {"FINISHED"}

            mocked_adapter.export_glb.side_effect = export_collection  # type: ignore[attr-defined]
            with mock.patch.object(cli, "_load_contract_modules", return_value=modules):
                result = cli.main(
                    [
                        "blender",
                        "--",
                        "--collection",
                        "StructuralAssembly",
                        "--output",
                        str(output),
                    ]
                )

            self.assertEqual(0, result)
            self.assertEqual(expected_asset_extras, observed["collection_hestia"])
            self.assertIsNone(observed["scene_hestia"])
            mocked_adapter.extract_asset.assert_called_once_with(  # type: ignore[attr-defined]
                collection,
                collection=collection,
                scene=scene,
            )
            mocked_adapter.export_glb.assert_called_once_with(
                mock.ANY, collection=collection, strip_root_hestia=False
            )  # type: ignore[attr-defined]

        with tempfile.TemporaryDirectory() as directory:
            output = Path(directory) / "asset.glb"
            modules = self._mock_modules(output)
            mocked_adapter = modules[0]
            scene = mocked_adapter.require_blender().context.scene  # type: ignore[attr-defined]
            observed_scene: dict[str, object] = {}

            def export_scene(path: Path, **_: object) -> set[str]:
                observed_scene["scene_hestia"] = json.loads(json.dumps(scene["hestia"]))
                Path(path).write_bytes(BlenderBoundaryTests._minimal_glb())
                return {"FINISHED"}

            mocked_adapter.export_glb.side_effect = export_scene  # type: ignore[attr-defined]
            with mock.patch.object(cli, "_load_contract_modules", return_value=modules):
                result = cli.main(["blender", "--", "--output", str(output)])

            self.assertEqual(0, result)
            self.assertEqual(expected_asset_extras, observed_scene["scene_hestia"])
            mocked_adapter.find_named_collection.assert_not_called()  # type: ignore[attr-defined]
            mocked_adapter.extract_asset.assert_called_once_with(  # type: ignore[attr-defined]
                scene,
                collection=None,
                scene=scene,
            )
            mocked_adapter.export_glb.assert_called_once_with(
                mock.ANY, collection=None, strip_root_hestia=False
            )  # type: ignore[attr-defined]

    def test_cli_treats_every_collection_option_as_explicit_and_fails_on_empty(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            output = Path(directory) / "asset.glb"
            for collection_name in ("Export", ""):
                with self.subTest(collection_name=collection_name):
                    modules = self._mock_modules(output)
                    mocked_adapter = modules[0]
                    empty_collection = types.SimpleNamespace(name=collection_name, objects=(), children=())
                    mocked_adapter.find_named_collection.return_value = empty_collection  # type: ignore[attr-defined]
                    mocked_adapter.iter_collection_objects.return_value = ()  # type: ignore[attr-defined]
                    with (
                        mock.patch.object(cli, "_load_contract_modules", return_value=modules),
                        mock.patch.object(cli, "_print_error") as print_error,
                    ):
                        result = cli.main(
                            [
                                "blender",
                                "--",
                                "--collection",
                                collection_name,
                                "--output",
                                str(output),
                            ]
                        )

                    self.assertEqual(1, result)
                    mocked_adapter.find_named_collection.assert_called_once_with(  # type: ignore[attr-defined]
                        collection_name,
                        mocked_adapter.require_blender().context.scene,  # type: ignore[attr-defined]
                    )
                    mocked_adapter.extract_asset.assert_not_called()  # type: ignore[attr-defined]
                    mocked_adapter.export_glb.assert_not_called()  # type: ignore[attr-defined]
                    print_error.assert_called_once_with(
                        "adapter.failed",
                        "could not normalize or validate the Blender asset: "
                        f"named collection contains no exportable objects: {collection_name!r}",
                    )

    def test_postprocess_sets_exact_asset_extras_and_rebuilds_valid_chunks(self) -> None:
        canonical_asset = self._authoring_input().asset
        full_document = canonical_asset.to_contract_dict()
        bin_chunk = b"\x01\x02\x03\x04"
        source = self._minimal_glb(
            {
                "asset": {
                    "version": "2.0",
                    "generator": "Blender",
                    "extras": {"legitimate": {"kept": True}, "hestia": {"obsolete": True}},
                },
                "scenes": [{"extras": {"hestia": full_document, "keep": 3}}],
            },
            ((0x004E4942, bin_chunk),),
        )

        processed = cli._postprocess_glb(source, canonical_asset)
        document, chunks = self._glb_document(processed)
        asset_payload = document["asset"]  # type: ignore[index]
        expected = {
            "schema": "hestia.asset-authoring.v1",
            "assetId": "asset-01",
            "assetRevision": 7,
            "representation": "StructuralAssembly",
            "metersPerUnit": 1,
            "coordinateFrame": {"forwardAxis": "+Z", "handedness": "RIGHT", "upAxis": "+Y"},
            "tags": [],
        }
        self.assertEqual(expected, asset_payload["extras"]["hestia"])  # type: ignore[index]
        self.assertEqual({"kept": True}, asset_payload["extras"]["legitimate"])  # type: ignore[index]
        self.assertEqual("Blender", asset_payload["generator"])  # type: ignore[index]
        self.assertNotIn("parts", asset_payload["extras"]["hestia"])  # type: ignore[index]
        self.assertEqual({"keep": 3}, document["scenes"][0]["extras"])  # type: ignore[index]
        self.assertEqual((0x004E4942, bin_chunk), chunks[1])
        self.assertEqual(0, len(chunks[0][1]) % 4)
        self.assertTrue(chunks[0][1].endswith(b" ") or len(chunks[0][1]) % 4 == 0)

    def test_postprocess_rejects_malformed_glb_without_publishing_destination(self) -> None:
        valid = self._minimal_glb()
        json_chunk = 0x4E4F534A
        malformed_cases = (
            ("bad magic", b"BAD!" + valid[4:], "glTF magic and version 2"),
            (
                "bad version",
                struct.pack("<4sII", b"glTF", 3, len(valid)) + valid[12:],
                "glTF magic and version 2",
            ),
            ("truncated header", valid[:8], "header is truncated"),
            (
                "chunk overrun",
                struct.pack("<4sII", b"glTF", 2, 24)
                + struct.pack("<II", 8, json_chunk)
                + b"{}  ",
                "chunk exceeds",
            ),
            (
                "invalid JSON",
                struct.pack("<4sII", b"glTF", 2, 24)
                + struct.pack("<II", 4, json_chunk)
                + b"{bad",
                "not valid UTF-8 JSON",
            ),
            (
                "multiple JSON chunks",
                self._minimal_glb(trailing_chunks=((json_chunk, b"{}  "),)),
                "exactly one JSON chunk",
            ),
        )

        for label, malformed, error_text in malformed_cases:
            with self.subTest(label=label):
                with self.assertRaisesRegex(ValueError, error_text):
                    cli._postprocess_glb(malformed, self._authoring_input().asset)

                with tempfile.TemporaryDirectory() as directory:
                    output = Path(directory) / "asset.glb"
                    sidecar = Path(directory) / "asset.hestia-authoring-report.json"
                    output.write_bytes(b"prior-output")
                    sidecar.write_bytes(b"prior-sidecar")
                    modules = self._mock_modules(output)
                    mocked_adapter = modules[0]

                    def export_malformed(path: Path, **_: object) -> set[str]:
                        path.write_bytes(malformed)
                        return {"FINISHED"}

                    mocked_adapter.export_glb.side_effect = export_malformed  # type: ignore[attr-defined]
                    with (
                        mock.patch.object(cli, "_load_contract_modules", return_value=modules),
                        mock.patch.object(cli, "_replace_handoff") as replace_handoff,
                        mock.patch.object(cli, "_print_error") as print_error,
                    ):
                        result = cli.main(["blender", "--", "--output", str(output)])

                    self.assertEqual(1, result)
                    replace_handoff.assert_not_called()
                    self.assertEqual(b"prior-output", output.read_bytes())
                    self.assertEqual(b"prior-sidecar", sidecar.read_bytes())
                    self.assertEqual("export.failed", print_error.call_args.args[0])
                    self.assertRegex(print_error.call_args.args[1], error_text)

    def test_success_writes_exact_deterministic_sidecar_with_canonical_semantics(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            output = Path(directory) / "asset.glb"
            sidecar = Path(directory) / "asset.hestia-authoring-report.json"
            modules = self._mock_modules(output)
            with mock.patch.object(cli, "_load_contract_modules", return_value=modules):
                first_result = cli.main(["blender", "--", "--output", str(output)])
                first_bytes = sidecar.read_bytes()
                first_glb = output.read_bytes()
                second_result = cli.main(["blender", "--", "--output", str(output)])
                second_bytes = sidecar.read_bytes()

            self.assertEqual((0, 0), (first_result, second_result))
            self.assertEqual(first_bytes, second_bytes)
            self.assertEqual(first_glb, output.read_bytes())
            self.assertEqual(
                hashlib.sha256(first_glb).hexdigest(),
                json.loads(first_bytes)["digests"]["glb_sha256"],
            )
            report_document = json.loads(first_bytes)
            payload = report_document["payload"]
            self.assertRegex(report_document["digests"]["report_sha256"], r"^[0-9a-f]{64}$")
            self.assertEqual(
                hashlib.sha256(canonical.canonical_json_bytes(payload)).hexdigest(),
                report_document["digests"]["report_sha256"],
            )
            self.assertEqual(7, payload["semantics"]["asset"]["assetRevision"])
            self.assertEqual("asset.glb", payload["outputBasename"])
            self.assertEqual("warning", payload["options"]["unappliedScalePolicy"])
            self.assertFalse((Path(directory) / "asset.glb.hestia-authoring-report.json").exists())
            serialized = first_bytes.decode("utf-8")
            for forbidden in ("timestamp", "locale", "random", str(Path(directory)), "asset_revision"):
                with self.subTest(forbidden=forbidden):
                    self.assertNotIn(forbidden, serialized)

            document, _ = self._glb_document(first_glb)
            hestia = document["asset"]["extras"]["hestia"]  # type: ignore[index]
            self.assertEqual("asset-01", hestia["assetId"])
            self.assertNotIn("asset", hestia)
            self.assertNotIn("parts", hestia)

    def test_final_sidecar_replace_failure_restores_both_prior_artifacts(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            output = Path(directory) / "asset.glb"
            sidecar = Path(directory) / "asset.hestia-authoring-report.json"
            output.write_bytes(b"prior-glb")
            sidecar.write_bytes(b"prior-report")
            modules = self._mock_modules(output)
            real_replace = cli.os.replace
            replace_counts = {output: 0, sidecar: 0}

            def fail_first_sidecar_replace(source: str, destination: str) -> None:
                destination_path = Path(destination)
                if destination_path in replace_counts:
                    replace_counts[destination_path] += 1
                if destination_path == sidecar and replace_counts[sidecar] == 1:
                    raise OSError("injected sidecar replace failure")
                real_replace(source, destination)

            with (
                mock.patch.object(cli, "_load_contract_modules", return_value=modules),
                mock.patch.object(cli.os, "replace", side_effect=fail_first_sidecar_replace),
                mock.patch.object(cli, "_print_error") as print_error,
            ):
                result = cli.main(["blender", "--", "--output", str(output)])

            self.assertEqual(1, result)
            self.assertEqual({output: 2, sidecar: 2}, replace_counts)
            self.assertEqual(b"prior-glb", output.read_bytes())
            self.assertEqual(b"prior-report", sidecar.read_bytes())
            print_error.assert_called_once_with(
                "export.failed",
                "injected sidecar replace failure",
            )

    def test_final_replace_restoration_failure_is_surfaced_and_fails_closed(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            output = Path(directory) / "asset.glb"
            sidecar = Path(directory) / "asset.hestia-authoring-report.json"
            output.write_bytes(b"prior-glb")
            sidecar.write_bytes(b"prior-report")
            modules = self._mock_modules(output)
            real_replace = cli.os.replace
            replace_counts = {output: 0, sidecar: 0}

            def fail_sidecar_then_output_restore(source: str, destination: str) -> None:
                destination_path = Path(destination)
                if destination_path in replace_counts:
                    replace_counts[destination_path] += 1
                if destination_path == sidecar and replace_counts[sidecar] == 1:
                    raise OSError("injected sidecar replace failure")
                if destination_path == output and replace_counts[output] == 2:
                    raise OSError("injected output restoration failure")
                real_replace(source, destination)

            with (
                mock.patch.object(cli, "_load_contract_modules", return_value=modules),
                mock.patch.object(cli.os, "replace", side_effect=fail_sidecar_then_output_restore),
                mock.patch.object(cli, "_print_error") as print_error,
                mock.patch("builtins.print") as print_message,
            ):
                result = cli.main(["blender", "--", "--output", str(output)])

            self.assertEqual(1, result)
            self.assertEqual({output: 2, sidecar: 2}, replace_counts)
            self.assertNotEqual(b"prior-glb", output.read_bytes())
            self.assertEqual(b"prior-report", sidecar.read_bytes())
            print_error.assert_called_once_with(
                "export.failed",
                "handoff replacement failed and prior artifacts could not be restored",
            )
            self.assertFalse(
                any(
                    call.args and str(call.args[0]).startswith("Exported GLB and report")
                    for call in print_message.call_args_list
                )
            )

    def test_export_failure_preserves_prior_artifacts_and_restores_attached_extras(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            output = Path(directory) / "asset.glb"
            sidecar = Path(directory) / "asset.hestia-authoring-report.json"
            output.write_bytes(b"prior-glb")
            sidecar.write_bytes(b"prior-report")
            modules = self._mock_modules(output)
            mocked_adapter = modules[0]
            scene = mocked_adapter.require_blender().context.scene  # type: ignore[attr-defined]
            scene["hestia"] = {"legitimate": "original"}

            def fail_export(path: Path, **_: object) -> set[str]:
                self.assertNotEqual(output, Path(path))
                self.assertEqual("asset-01", scene["hestia"]["assetId"])
                Path(path).write_bytes(b"partial")
                raise RuntimeError("injected export failure")

            mocked_adapter.export_glb.side_effect = fail_export  # type: ignore[attr-defined]
            with mock.patch.object(cli, "_load_contract_modules", return_value=modules):
                result = cli.main(["blender", "--", "--output", str(output)])

            self.assertEqual(1, result)
            self.assertEqual(b"prior-glb", output.read_bytes())
            self.assertEqual(b"prior-report", sidecar.read_bytes())
            self.assertEqual({"legitimate": "original"}, scene["hestia"])
            self.assertEqual([], list(Path(directory).glob("*.tmp.glb")))

    def test_cli_export_handoff_strips_raw_properties_and_restores_them_after_success_or_failure(self) -> None:
        part = model.CanonicalPart(
            part_id="part-01",
            representation_mode=model.RepresentationMode.STRUCTURAL_ASSEMBLY,
            destructible=False,
            collision_policy=model.CollisionPolicy.NONE,
            navigation_policy=model.NavigationPolicy.NONE,
            thin_feature=model.ThinFeature(
                policy=model.ThinFeaturePolicy.REJECT,
                declared_minimum_thickness_m=0.01,
            ),
            default_render_material_id="mat-render",
            structural_material_id="mat-structural",
        )
        material_contract = model.CanonicalMaterial(
            render_material_id="mat-render",
            structural_material_id="mat-structural",
            palette_index=3,
            tags=("exterior",),
        )
        asset = model.CanonicalAsset(
            asset_id="asset-01",
            asset_revision=7,
            representation_mode=model.RepresentationMode.STRUCTURAL_ASSEMBLY,
            parts=(part,),
            materials=(material_contract,),
        )
        authoring_input = model.AuthoringInput(
            asset=asset,
            inventory=model.GeometryInventory((), (), ()),
        )

        for should_fail in (False, True):
            with self.subTest(should_fail=should_fail), tempfile.TemporaryDirectory() as directory:
                output = Path(directory) / "asset.glb"
                modules = self._mock_modules(output)
                mocked_adapter = modules[0]
                mocked_adapter.extract_asset.return_value = authoring_input  # type: ignore[attr-defined]
                mocked_adapter.extract_properties.side_effect = adapter.extract_properties  # type: ignore[attr-defined]

                source = _PropertyBlock(
                    {
                        "hestia.schema_version": "hestia.asset-authoring.v1",
                        "hestia.asset_id": "raw-asset",
                        "hestia.asset_revision": 2,
                        "hestia": {"legacy": "source"},
                        "ordinary": "source-preserved",
                    }
                )
                source.name = "StructuralAssembly"  # type: ignore[attr-defined]
                source.objects = ()  # type: ignore[attr-defined]
                source.children = ()  # type: ignore[attr-defined]
                part_object = _FakeObject(
                    "Part",
                    {
                        "hestia.part_id": "part-01",
                        "hestia.representation_mode": "StructuralAssembly",
                        "hestia.destructible": False,
                        "hestia.collision_policy": "None",
                        "hestia.navigation_policy": "None",
                        "hestia.thin_feature_policy": "Reject",
                        "hestia.declared_minimum_thickness_m": 0.01,
                        "hestia.render_material_id": "mat-render",
                        "ordinary": "object-preserved",
                    },
                )
                mesh_data = _PropertyBlock({"hestia": {"legacy": "mesh"}, "ordinary": "mesh-preserved"})
                part_object.data = mesh_data
                material = _PropertyBlock(
                    {
                        "hestia.render_material_id": "mat-render",
                        "hestia.structural_material_id": "mat-structural",
                        "hestia.palette_index": 3,
                        "hestia": {"legacy": "material"},
                        "ordinary": "material-preserved",
                    }
                )
                part_object.material_slots = (types.SimpleNamespace(material=material),)
                mocked_adapter.find_named_collection.return_value = source  # type: ignore[attr-defined]
                mocked_adapter.iter_collection_objects.return_value = (part_object,)  # type: ignore[attr-defined]
                original_properties = {
                    name: json.loads(json.dumps(block))
                    for name, block in (
                        ("source", source),
                        ("part", part_object),
                        ("mesh", mesh_data),
                        ("material", material),
                    )
                }
                mocked_adapter.extract_properties.return_value = {"hestia.part_id": "part-01"}  # type: ignore[attr-defined]
                material.get = mock.Mock(return_value="mat-render")  # type: ignore[method-assign]
                observed_during_export: dict[str, dict[str, object]] = {}

                def export_collection(path: Path, **_: object) -> set[str]:
                    observed_during_export.update(
                        {
                            name: json.loads(json.dumps(block))
                            for name, block in (
                                ("source", source),
                                ("part", part_object),
                                ("mesh", mesh_data),
                                ("material", material),
                            )
                        }
                    )
                    Path(path).write_bytes(BlenderBoundaryTests._minimal_glb())
                    if should_fail:
                        raise RuntimeError("injected export failure")
                    return {"FINISHED"}

                mocked_adapter.export_glb.side_effect = export_collection  # type: ignore[attr-defined]
                with mock.patch.object(cli, "_load_contract_modules", return_value=modules):
                    result = cli.main(
                        [
                            "blender",
                            "--",
                            "--collection",
                            "StructuralAssembly",
                            "--output",
                            str(output),
                        ]
                    )

                self.assertEqual(1 if should_fail else 0, result)
                expected_source_hestia = {
                    "schema": "hestia.asset-authoring.v1",
                    "assetId": "asset-01",
                    "assetRevision": 7,
                    "representation": "StructuralAssembly",
                    "metersPerUnit": 1,
                    "coordinateFrame": {"forwardAxis": "+Z", "handedness": "RIGHT", "upAxis": "+Y"},
                    "tags": [],
                }
                expected_hestia = {
                    "source": expected_source_hestia,
                    "part": json.loads(json.dumps({**part.to_contract_dict(), "kind": "part"})),
                    "material": json.loads(json.dumps(material_contract.to_contract_dict())),
                }
                for name in ("source", "part", "material"):
                    with self.subTest(should_fail=should_fail, block=name):
                        observed = observed_during_export[name]
                        self.assertEqual(
                            [key for key in observed if key.startswith("hestia.")],
                            [],
                        )
                        self.assertEqual(expected_hestia[name], observed["hestia"])
                observed_mesh = observed_during_export["mesh"]
                self.assertEqual({"ordinary": "mesh-preserved"}, observed_mesh)
                self.assertEqual(original_properties, {
                    name: json.loads(json.dumps(block))
                    for name, block in (
                        ("source", source),
                        ("part", part_object),
                        ("mesh", mesh_data),
                        ("material", material),
                    )
                })
                mocked_adapter.export_glb.assert_called_once_with(
                    mock.ANY, collection=source, strip_root_hestia=False
                )  # type: ignore[attr-defined]

    def test_export_restores_source_custom_properties_even_when_export_fails(self) -> None:
        obj = _FakeObject("Part", {"hestia": {"attacker": True}, "hestia.part_id": "part-01", "ordinary": 4})
        obj._selected = True
        scene = types.SimpleNamespace(objects=(obj,))
        view_objects = types.SimpleNamespace(active=obj)
        observed_during_export: dict[str, object] = {}

        def export_operator(**_: object) -> set[str]:
            observed_during_export.update(obj)
            raise RuntimeError("export failed")

        gltf = mock.Mock(side_effect=export_operator)
        gltf.get_rna_type.return_value.properties = {}
        fake_blender = types.SimpleNamespace(
            context=types.SimpleNamespace(scene=scene, view_layer=types.SimpleNamespace(objects=view_objects)),
            ops=types.SimpleNamespace(export_scene=types.SimpleNamespace(gltf=gltf)),
        )
        with mock.patch.object(adapter, "bpy", fake_blender):
            with self.assertRaisesRegex(RuntimeError, "export failed"):
                adapter.export_glb("ignored.glb", objects=(obj,), scene=scene)

        self.assertNotIn("hestia.part_id", observed_during_export)
        self.assertNotIn("hestia", observed_during_export)
        self.assertEqual({"attacker": True}, obj["hestia"])
        self.assertEqual("part-01", obj["hestia.part_id"])
        self.assertEqual(4, obj["ordinary"])
        self.assertTrue(obj.select_get())
        self.assertIs(obj, view_objects.active)


if __name__ == "__main__":
    unittest.main()
