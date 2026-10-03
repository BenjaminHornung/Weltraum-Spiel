"""Stdlib research CLI. Expected input failures have codes, never host-path tracebacks."""

import argparse
import os
from pathlib import Path
import shutil
import sys
import tempfile

from tools.blender.hestia_asset_authoring.canonical import sha256_bytes
from .errors import CompilerError
from .package import bounded_json, compile_to_directory, publication_parent, verify_package, write_file
from .profiles import PROFILES, check_budget


class Parser(argparse.ArgumentParser):
    def error(self, message):
        raise CompilerError("cli.arguments", "invalid or missing arguments; use --help")


def parser():
    result = Parser(prog="python -m tools.hestia_asset_compiler", description="Offline research only; PRODUCT_INTEGRATED=NO")
    commands = result.add_subparsers(dest="command", required=True)
    compile = commands.add_parser("compile", help="report-bound atomic no-replace package")
    for name in ("glb", "report", "output"):
        compile.add_argument("--" + name, required=True)
    compile.add_argument("--profile", choices=tuple(PROFILES), required=True)
    for name in ("validate", "inspect"):
        sub = commands.add_parser(name, help="actual package files/hash verification" if name == "validate" else "validated package information")
        sub.add_argument("directory")
        if name == "inspect":
            sub.add_argument("--json", action="store_true")
    from .golden import IDS
    golden = commands.add_parser("golden", help="deterministic G01-G30 inputs, real core/oracles/frozen hash checks")
    golden.add_argument("--case", choices=IDS, action="append", dest="cases")
    golden.add_argument("--profile", choices=tuple(PROFILES), action="append", dest="profiles")
    golden.add_argument("--repeats", type=int, choices=range(1, 11), default=1)
    golden.add_argument("--output", help="new local Windows research evidence directory, never overwritten")
    bench = commands.add_parser("benchmark", help="one bounded CONTAMINATED_DIAGNOSTIC per selected profile")
    bench.add_argument("--population", choices=("small", "medium", "large"), default="small")
    bench.add_argument("--profile", choices=tuple(PROFILES), action="append", dest="profiles")
    bench.add_argument("--output", help="new local Windows research evidence directory")
    return result


def information(manifest):
    return {"status": "VALID", "schema": manifest["schema"], "assetId": manifest["assetId"], "assetRevision": manifest["assetRevision"],
        "profileId": manifest["profileId"], "cellMeters": manifest["cellMeters"], "partCount": len(manifest["parts"]),
        "ownedCellCount": sum(m["cellCount"] for m in manifest["geometricMassInputs"]), "brickCount": len(manifest["bricks"]),
        "sources": manifest["sources"], "manifestTreeSha256": manifest["manifestTreeSha256"], "productIntegrated": False,
        "thinOutcomes": {d["partId"]: d["outcome"] for d in manifest["thinFeatureDecisions"]},
        "diagnosticsSummary": manifest["diagnosticsSummary"], "contentHashes": {key: manifest[key] for key in
            ("normalizedGeometrySha256", "semanticsSha256", "voxelizationSha256")}}


def publish_research_files(files, target):
    """One owned sibling generation for corpus/benchmark EVIDENCE, not an asset package."""
    target, parent = publication_parent(target)
    check_budget("output_bytes", sum(map(len, files.values())))
    staging = None
    try:
        staging = Path(tempfile.mkdtemp(prefix=".hestia-research-", dir=parent))
        for name, data in sorted(files.items()):
            path = Path(name)
            if path.is_absolute() or ".." in path.parts or "\\" in name or ":" in name:
                raise CompilerError("cli.evidence-path", "research file paths must be internal stable relative names")
            destination = staging / path
            destination.parent.mkdir(parents=True, exist_ok=True)
            write_file(destination, data)
            if sha256_bytes(destination.read_bytes()) != sha256_bytes(data):
                raise CompilerError("cli.evidence-verification", "actual written research bytes differ")
        if os.path.lexists(target):
            raise CompilerError("publication.target-exists", "existing output preserved")
        os.rename(staging, target)  # Same admitted local-Windows no-replace semantics as C6.
        staging = None
    except OSError:
        raise CompilerError("publication.target-exists" if os.path.lexists(target) else "publication.io", "research publication failed") from None
    finally:
        if staging is not None:
            try:
                shutil.rmtree(staging)  # Invocation-created staging ONLY.
            except OSError:
                raise CompilerError("publication.cleanup", "owned research staging cleanup failed") from None


def main(argv=None):
    try:
        args = parser().parse_args(argv)
        if args.command == "compile":
            target = compile_to_directory(args.glb, args.report, args.profile, args.output)
            data = information(verify_package(target))
        elif args.command in ("validate", "inspect"):
            data = information(verify_package(args.directory))
            if args.command == "inspect" and not args.json:
                print(f"{data['assetId']} revision {data['assetRevision']} | {data['profileId']} | {data['ownedCellCount']} owned cells | {data['brickCount']} bricks\n"
                      f"tree {data['manifestTreeSha256']}\nResearch only; PRODUCT_INTEGRATED=NO")
                return 0
        elif args.command == "golden":
            from .golden import run_corpus
            if args.output is not None:
                publication_parent(args.output)
            data, files, _ = run_corpus(args.cases, args.profiles, args.repeats)
            if args.output is not None:
                publish_research_files(files, args.output)
        else:
            from .benchmark import benchmark
            if args.output is not None:
                publication_parent(args.output)
            data = benchmark(args.population, args.profiles)
            if args.output is not None:
                publish_research_files({"benchmark-run.json": bounded_json(data)}, args.output)
        print(bounded_json(data).decode("utf-8"))
        return 0
    except CompilerError as error:
        print(bounded_json({"status": "REJECTED", "diagnostics": [{"severity": "error", "code": error.code}]}).decode("utf-8"), file=sys.stderr)
        return 2 if error.code in ("cli.arguments", "golden.arguments", "benchmark.arguments") else 3 if error.code.startswith("golden.") else 1
    except (OSError, ValueError):
        print('{"diagnostics":[{"code":"cli.io","severity":"error"}],"status":"REJECTED"}', file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main())
