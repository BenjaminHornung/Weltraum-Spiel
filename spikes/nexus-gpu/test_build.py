import hashlib
import importlib.util
import json
from pathlib import Path
from tempfile import TemporaryDirectory
import unittest

import prepare


def load_binding():
    spec = importlib.util.spec_from_file_location("bind_artifacts", Path(__file__).with_name("bind-artifacts.py"))
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module.bind


class BuildBindingTest(unittest.TestCase):
    def test_upstream_changed_or_extra_input_is_rejected(self):
        with TemporaryDirectory() as tmp:
            root = Path(tmp)
            cargo = root / "Cargo.toml"
            cargo.write_bytes(b"abc")
            expected = {cargo.name: ("100644", hashlib.sha1(b"blob 3\0abc").hexdigest())}
            prepare.verify_files(root, expected)
            cargo.write_bytes(b"xyz")
            with self.assertRaisesRegex(ValueError, "modified"):
                prepare.verify_files(root, expected)
            cargo.write_bytes(b"abc")
            (root / "effect.spv").touch()
            with self.assertRaisesRegex(ValueError, "unbound"):
                prepare.verify_files(root, expected)

    def test_requires_real_shader_outputs_from_both_packages_and_embedded_bytes(self):
        with TemporaryDirectory() as tmp:
            root = Path(tmp)
            web = root / "web"
            web.mkdir()
            (web / "nexus.js").write_text("export default {}")
            spv = b"\x03\x02\x23\x07" + b"\0" * 16
            binary = b"\0asm\x01\0\0\0"
            events = []
            for crate in ("nexus_rbd3d", "vortx"):
                out = root / crate / "out"
                shaders = out / "shaders-spirv"
                shaders.mkdir(parents=True)
                (shaders / "test.spv").write_bytes(spv)
                events.append({"reason": "build-script-executed", "package_id": f"path+file:///{crate}#0.0.0",
                               "out_dir": str(out)})
            log = root / "cargo-build.jsonl"
            (web / "nexus_bg.wasm").write_bytes(binary)
            log.write_text(json.dumps(events[0]))
            bind = load_binding()
            with self.assertRaisesRegex(ValueError, "Missing shader build"):
                bind(root)
            log.write_text("\n".join(map(json.dumps, events)))
            with self.assertRaisesRegex(ValueError, "unembedded"):
                bind(root)
            (web / "nexus_bg.wasm").write_bytes(binary + spv)
            result = bind(root)
            self.assertEqual([s["path"] for s in result["shaders"]],
                             ["shaders/nexus_rbd3d/test.spv", "shaders/vortx/test.spv"])
            self.assertFalse(result["gpuDispatchMeasured"])


if __name__ == "__main__":
    unittest.main()
