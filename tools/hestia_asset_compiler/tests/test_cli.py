"""Native module CLI evidence under invocation-owned Ctree TEMP only."""

from contextlib import redirect_stderr, redirect_stdout
import io
import json
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest
from unittest.mock import patch

from tools.hestia_asset_compiler.package import verify_package
from package_fixtures import pair

ROOT = Path(__file__).resolve().parents[3]


def cli(*args):
    return subprocess.run([sys.executable, "-B", "-X", "utf8", "-m", "tools.hestia_asset_compiler", *map(str, args)],
                          cwd=ROOT, capture_output=True, text=True, encoding="utf-8", timeout=120)


class CliTests(unittest.TestCase):
    def test_help_and_no_silent_profile_or_report_defaults(self):
        result = cli("--help")
        self.assertEqual(result.returncode, 0, result.stderr)
        for command in ("compile", "validate", "inspect", "golden", "benchmark"):
            self.assertIn(command, result.stdout)
        for omitted in ("--glb", "--profile", "--report", "--output"):
            args = ["compile", "--glb", "PRIVATE_INPUT", "--report", "PRIVATE_REPORT",
                    "--profile", "micro-0125-research-v1", "--output", "PRIVATE_OUTPUT"]
            index = args.index(omitted)
            del args[index:index + 2]
            result = cli(*args)
            self.assertEqual(result.returncode, 2)
            self.assertEqual(json.loads(result.stderr)["diagnostics"][0]["code"], "cli.arguments")
            self.assertNotIn("PRIVATE", result.stderr)
            self.assertNotIn("Traceback", result.stderr)

    def test_native_compile_validate_inspect_both_profiles_source_unchanged(self):
        raw, sidecar, _ = pair()
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            glb, report = root / "source.glb", root / "source.json"
            glb.write_bytes(raw)
            report.write_bytes(sidecar)
            for profile, count in (("micro-0125-research-v1", 1000), ("standard-025-v1", 216)):
                output = root / profile
                result = cli("compile", "--glb", glb, "--report", report, "--profile", profile, "--output", output)
                self.assertEqual(result.returncode, 0, result.stderr)
                self.assertNotIn(str(root), result.stdout + result.stderr)
                self.assertEqual(sum(m["cellCount"] for m in verify_package(output)["geometricMassInputs"]), count)
                result = cli("validate", output)
                self.assertEqual(result.returncode, 0, result.stderr)
                self.assertEqual(json.loads(result.stdout)["status"], "VALID")
                result = cli("inspect", output, "--json")
                self.assertEqual(result.returncode, 0, result.stderr)
                self.assertEqual(json.loads(result.stdout)["ownedCellCount"], count)
                result = cli("inspect", output)
                self.assertEqual(result.returncode, 0, result.stderr)
                self.assertIn("asset.test", result.stdout)
                self.assertIn("PRODUCT_INTEGRATED=NO", result.stdout)
            self.assertEqual(glb.read_bytes(), raw)
            self.assertEqual(report.read_bytes(), sidecar)

    def test_existing_target_and_corrupt_inspect_fail_closed(self):
        raw, sidecar, _ = pair()
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            glb, report, output = root / "source.glb", root / "source.json", root / "out"
            glb.write_bytes(raw)
            report.write_bytes(sidecar)
            args = ("compile", "--glb", glb, "--report", report, "--profile", "standard-025-v1", "--output", output)
            self.assertEqual(cli(*args).returncode, 0)
            before = {str(p.relative_to(output)): p.read_bytes() for p in output.rglob("*") if p.is_file()}
            result = cli(*args)
            self.assertEqual(result.returncode, 1)
            self.assertEqual(json.loads(result.stderr)["diagnostics"][0]["code"], "publication.target-exists")
            self.assertEqual(before, {str(p.relative_to(output)): p.read_bytes() for p in output.rglob("*") if p.is_file()})
            brick = next((output / "bricks").iterdir())
            brick.write_bytes(b"\0" * 4096)
            for command in ("validate", "inspect"):
                result = cli(command, output)
                self.assertEqual(result.returncode, 1)
                self.assertEqual(result.stdout, "")
                self.assertNotIn("Traceback", result.stderr)
                self.assertNotIn(str(root), result.stderr)
                self.assertEqual(json.loads(result.stderr)["diagnostics"][0]["code"], "package.brick-hash")
            self.assertFalse(any(p.name.startswith(".hestia-") for p in root.iterdir()))

    def test_missing_input_and_invalid_choices_have_stable_private_diagnostics(self):
        result = cli("validate", ROOT / "PRIVATE_MISSING")
        self.assertEqual(result.returncode, 1)
        self.assertEqual(json.loads(result.stderr)["diagnostics"][0]["code"], "package.io")
        self.assertNotIn("PRIVATE_MISSING", result.stderr)
        for args in (("golden", "--case", "G31"), ("golden", "--repeats", "11"), ("benchmark", "--profile", "unknown")):
            result = cli(*args)
            self.assertEqual(result.returncode, 2)
            self.assertEqual(json.loads(result.stderr)["diagnostics"][0]["code"], "cli.arguments")

    def test_golden_real_input_generation_and_benchmark_cap_exclusion(self):
        with tempfile.TemporaryDirectory() as directory:
            target = Path(directory) / "golden"
            result = cli("golden", "--case", "G01", "--profile", "standard-025-v1", "--output", target)
            self.assertEqual(result.returncode, 0, result.stderr)
            self.assertEqual(json.loads(result.stdout)["caseIds"], ["G01"])
            self.assertTrue((target / "inputs" / "G01" / "base.glb").is_file())
            self.assertTrue((target / "corpus-run.json").is_file())
            before = (target / "corpus-run.json").read_bytes()
            result = cli("golden", "--case", "G01", "--output", target)
            self.assertEqual(result.returncode, 1)
            self.assertEqual(json.loads(result.stderr)["diagnostics"][0]["code"], "publication.target-exists")
            self.assertEqual((target / "corpus-run.json").read_bytes(), before)
        for population in ("medium", "large"):
            result = cli("benchmark", "--population", population)
            self.assertEqual(result.returncode, 0, result.stderr)
            data = json.loads(result.stdout)
            self.assertTrue(all(run["status"] == "NOT_RUN_BUDGET_EXCLUDED" for run in data["runs"]))

    def test_wrong_report_native_compile_rejects_without_publish(self):
        from package_fixtures import rehash
        raw, _, report = pair()
        report["payload"]["glbSha256"] = "0" * 64
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            source, sidecar, output = root / "source.glb", root / "source.json", root / "out"
            source.write_bytes(raw)
            sidecar.write_bytes(rehash(report))
            result = cli("compile", "--glb", source, "--report", sidecar, "--profile", "standard-025-v1", "--output", output)
            self.assertEqual(result.returncode, 1)
            self.assertEqual(json.loads(result.stderr)["diagnostics"][0]["code"], "report.glb-mismatch")
            self.assertEqual(result.stdout, "")
            self.assertNotIn(str(root), result.stderr)
            self.assertNotIn("Traceback", result.stderr)
            self.assertFalse(output.exists())
            self.assertFalse(any(p.name.startswith(".hestia-") for p in root.iterdir()))

    def test_golden_pin_error_exit_three_and_research_write_cleanup(self):
        from tools.hestia_asset_compiler.__main__ import main, publish_research_files
        from tools.hestia_asset_compiler.errors import CompilerError
        stdout, stderr = io.StringIO(), io.StringIO()
        with patch("tools.hestia_asset_compiler.golden.load_pins", return_value={}), redirect_stdout(stdout), redirect_stderr(stderr):
            self.assertEqual(main(["golden", "--case", "G01", "--profile", "standard-025-v1"]), 3)
        self.assertEqual(stdout.getvalue(), "")
        self.assertEqual(json.loads(stderr.getvalue())["diagnostics"][0]["code"], "golden.pin-mismatch")
        with tempfile.TemporaryDirectory() as directory:
            root, output = Path(directory), Path(directory) / "out"
            foreign = root / ".hestia-research-foreign"
            foreign.mkdir()
            (foreign / "sentinel").write_bytes(b"FOREIGN")
            with patch("tools.hestia_asset_compiler.__main__.write_file", side_effect=OSError("injected")):
                with self.assertRaises(CompilerError) as error:
                    publish_research_files({"input.glb": b"owned"}, output)
                self.assertEqual(error.exception.code, "publication.io")
            self.assertEqual(list(root.iterdir()), [foreign])
            self.assertEqual((foreign / "sentinel").read_bytes(), b"FOREIGN")

    def test_research_publisher_rejects_anchored_names_before_parent_mkdir_or_write_in_RAM(self):
        from tools.hestia_asset_compiler.__main__ import publish_research_files
        from tools.hestia_asset_compiler.errors import CompilerError
        parent, staging = ROOT, ROOT / ".hestia-research-RAM-only"
        target, payload = ROOT / "RAM-only-output", b"owned"
        # All filesystem operations are mocked: even the pre-fix escape cannot touch foreign files.
        for name in ("/probe.bin", "/probe/file.json", "\\probe.bin", "C:probe.bin", "C:/probe.bin",
                     "//server/share/probe.bin", "../probe.bin", "legal/../probe.bin", "legal\\probe.bin"):
            with self.subTest(name=name), \
                    patch("tools.hestia_asset_compiler.__main__.publication_parent", return_value=(target, parent)), \
                    patch("tools.hestia_asset_compiler.__main__.tempfile.mkdtemp", return_value=str(staging)), \
                    patch.object(Path, "mkdir", autospec=True) as mkdir, \
                    patch.object(Path, "read_bytes", autospec=True, return_value=payload), \
                    patch("tools.hestia_asset_compiler.__main__.write_file") as write, \
                    patch("tools.hestia_asset_compiler.__main__.os.path.lexists", return_value=False), \
                    patch("tools.hestia_asset_compiler.__main__.os.rename") as rename, \
                    patch("tools.hestia_asset_compiler.__main__.shutil.rmtree") as cleanup:
                with self.assertRaises(CompilerError) as error:
                    publish_research_files({name: payload}, target)
                self.assertEqual(error.exception.code, "cli.evidence-path")
                mkdir.assert_not_called()
                write.assert_not_called()
                rename.assert_not_called()
                cleanup.assert_called_once_with(staging)
        with patch("tools.hestia_asset_compiler.__main__.publication_parent", return_value=(target, parent)), \
                patch("tools.hestia_asset_compiler.__main__.tempfile.mkdtemp", return_value=str(staging)), \
                patch.object(Path, "mkdir", autospec=True) as mkdir, \
                patch.object(Path, "read_bytes", autospec=True, return_value=payload), \
                patch("tools.hestia_asset_compiler.__main__.write_file") as write, \
                patch("tools.hestia_asset_compiler.__main__.os.path.lexists", return_value=False), \
                patch("tools.hestia_asset_compiler.__main__.os.rename") as rename, \
                patch("tools.hestia_asset_compiler.__main__.shutil.rmtree") as cleanup:
            publish_research_files({"legal/probe.json": payload}, target)
            mkdir.assert_called_once_with(staging / "legal", parents=True, exist_ok=True)
            write.assert_called_once_with(staging / "legal/probe.json", payload)
            rename.assert_called_once_with(staging, target)
            cleanup.assert_not_called()

    def test_benchmark_real_core_rejection_exits_one_without_stdout_or_publication(self):
        from tools.hestia_asset_compiler.__main__ import main
        from tools.hestia_asset_compiler.benchmark import benchmark
        from tools.hestia_asset_compiler.golden import corpus
        case = next(c for c in corpus() if c.case_id == "G24")
        target = ROOT / "PRIVATE_RAM_ONLY_OUTPUT"
        with patch("tools.hestia_asset_compiler.benchmark.small_input", return_value=(case.glb, case.report)), \
                patch("tools.hestia_asset_compiler.benchmark.perf_counter_ns", return_value=0), \
                patch("tools.hestia_asset_compiler.benchmark.process_time_ns", return_value=0):
            # Synthetic clocks ONLY; the paired negative input goes through the REAL core.
            result = benchmark("small", ["standard-025-v1"])
            self.assertEqual(result["runs"][0]["status"], "BLOCKED")
            self.assertEqual(result["runs"][0]["diagnostic"], "glb.unsupported")
            for output in ([], ["--output", str(target)]):
                stdout, stderr = io.StringIO(), io.StringIO()
                with self.subTest(output=bool(output)), redirect_stdout(stdout), redirect_stderr(stderr), \
                        patch("tools.hestia_asset_compiler.__main__.publication_parent", return_value=(target, ROOT)), \
                        patch("tools.hestia_asset_compiler.__main__.publish_research_files") as publish:
                    self.assertEqual(main(["benchmark", "--profile", "standard-025-v1", *output]), 1)
                    self.assertEqual(stdout.getvalue(), "")
                    self.assertEqual(json.loads(stderr.getvalue()), {"status": "REJECTED", "diagnostics": [{"severity": "error", "code": "glb.unsupported"}]})
                    self.assertNotIn("PRIVATE", stderr.getvalue())
                    self.assertNotIn("Traceback", stderr.getvalue())
                    publish.assert_not_called()
