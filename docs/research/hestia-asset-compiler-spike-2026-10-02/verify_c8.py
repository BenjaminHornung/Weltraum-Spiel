"""C8 evidence wrapper only: native frozen CLI, no compiler changes or pin updates."""

import argparse
from collections import Counter
import hashlib
import json
import os
from pathlib import Path
import re
import subprocess
import sys
import tempfile
from time import perf_counter

ROOT = Path(__file__).resolve().parents[3]
DOCS = Path(__file__).resolve().parent
PYTHON = Path(r"C:\IFI_SourceCode\Utils\Python\cpython-3.12.13-windows-x86_64-none\python.exe")
GIT = r"C:\IFI_SourceCode\Utils\opencode-migration\runtime\git\cmd\git.exe"
OWNED = Path(r"C:\IFI_SourceCode\Utils\opencode-migration\tmp\opencode\hestia-agent3-2026-10-02-72981f9a")
FREEZE = "c8e451a3e52fc8da743df011debae682f93c89a3"
FROZEN = {
    ROOT / "tools/hestia_asset_compiler/tests/golden_hashes.json": "bb803dbfd408f075453f340d7a69a34f24b732debbbb318f04f02995fd073aa6",
    DOCS / "C7_GOLDEN_SMOKE.json": "f377ecb149fecb784ac146bdc5932999998c635bfb9d4cc2e81924c3ced173a6",
    DOCS / "C7_BENCHMARK_SMOKE.json": "81d58223018d026d86b24fecb3f9377d4a73846a3119f73da9a06c851c03c964",
}


def sha(raw):
    return hashlib.sha256(raw).hexdigest()


def encode(value):
    return json.dumps(value, sort_keys=True, separators=(",", ":"), allow_nan=False).encode("utf-8")


def require(condition, reason):
    if not condition:
        raise RuntimeError(reason)


def save(name, raw):
    with (DOCS / name).open("xb") as stream:
        stream.write(raw)
    return {"path": name, "bytes": len(raw), "sha256": sha(raw)}


def frozen_check():
    require(Path.cwd() == ROOT and Path(sys.executable) == PYTHON, "explicit Ctree cwd/interpreter required")
    require(Path(os.environ["TEMP"]) == OWNED and Path(os.environ["TMP"]) == OWNED, "owned Ctree TEMP required")
    for path, digest in FROZEN.items():
        require(sha(path.read_bytes()) == digest, "frozen C7 bytes changed; STOP without rebaseline")
    diff = subprocess.run([GIT, "diff", "--exit-code", FREEZE, "--", "tools/hestia_asset_compiler"], cwd=ROOT, capture_output=True, timeout=30)
    require(diff.returncode == 0, "compiler freeze changed; STOP")


def native(arguments, timeout, env=None):
    started = perf_counter()
    result = subprocess.run([str(PYTHON), "-B", "-X", "utf8", *arguments], cwd=ROOT, env=env,
                            capture_output=True, timeout=timeout)
    return result, round(perf_counter() - started, 6)


def foundation():
    results, logs = [], []
    for label, directory in (("compiler", "tools/hestia_asset_compiler/tests"), ("blenderHost", "tools/blender/tests")):
        args = ["-m", "unittest", "discover", "-s", directory, "-p", "test_*.py", "-v"]
        result, duration = native(args, 300)
        text = (result.stdout + result.stderr).decode("utf-8")
        for path, replacement in ((str(ROOT), "<WORKTREE>"), (str(OWNED), "<OWNED_TEMP>"), (str(PYTHON), "<CTREE_PYTHON>")):
            text = text.replace(path, replacement)
        logs.append(f"=== {label} ===\n{text}")
        match = re.search(r"Ran (\d+) tests? in ([\d.]+)s", text)
        results.append({"check": label, "arguments": args, "exitCode": result.returncode,
                        "testCount": int(match[1]) if match else None, "reportedSeconds": float(match[2]) if match else None,
                        "wallSeconds": duration, "status": "PASS" if result.returncode == 0 else "FAIL"})
        if result.returncode != 0:
            save("C8_TESTS_FAILURE.log", "\n".join(logs).encode("utf-8"))
            require(False, "fresh suite failed; evidence retained, no retry or fix authorized")
    before = sorted(str(p.relative_to(ROOT)) for directory in ("tools/hestia_asset_compiler", "tools/blender") for p in (ROOT / directory).rglob("*.pyc"))
    with tempfile.TemporaryDirectory(prefix="c8-compileall-cache-", dir=OWNED) as directory:
        env = {**os.environ, "PYTHONPYCACHEPREFIX": directory}
        args = ["-m", "compileall", "-q", "tools/hestia_asset_compiler"]
        result, duration = native(args, 120, env)
        caches = list(Path(directory).rglob("*.pyc"))
        require(result.returncode == 0 and bool(caches), "compileall failed or owned cache evidence missing")
        cache_count = len(caches)
    after = sorted(str(p.relative_to(ROOT)) for location in ("tools/hestia_asset_compiler", "tools/blender") for p in (ROOT / location).rglob("*.pyc"))
    require(before == after and not Path(directory).exists(), "cache ownership/cleanup changed source trees")
    results.append({"check": "compileallCompilerOnly", "arguments": args, "status": "PASS", "exitCode": result.returncode,
                    "wallSeconds": duration, "ownedCacheFiles": cache_count, "ownedCacheRemoved": True,
                    "sourceTreeCachesBefore": before, "sourceTreeCachesAfter": after})
    frozen_check()
    log = save("C8_TESTS.log", "\n".join(logs).encode("utf-8"))
    artifact = save("C8_TESTS.json", encode({"schema": "hestia.asset-compiler-c8-verification.v1", "codeFreezeSha": FREEZE,
        "checks": results, "log": log, "productIntegrated": False, "finalAcceptance": "PENDING_INDEPENDENT_END_REVIEW"}))
    print(encode({"foundation": results, "artifact": artifact}).decode(), flush=True)


def golden():
    print("C8_NATIVE_GOLDEN_STARTED repeats=10 profiles=2 logicalRecords=370", flush=True)
    source_files = [{"path": str(p.relative_to(ROOT)).replace("\\", "/"), "bytes": p.stat().st_size, "sha256": sha(p.read_bytes())}
                    for p in sorted((ROOT / "tools/hestia_asset_compiler").rglob("*.py"))]
    tree = subprocess.run([GIT, "rev-parse", f"{FREEZE}:tools/hestia_asset_compiler"], cwd=ROOT, capture_output=True, timeout=30)
    require(tree.returncode == 0, "Git code tree unavailable")
    with tempfile.TemporaryDirectory(prefix="c8-native-golden-", dir=OWNED) as owned:
        target = Path(owned) / "generation"
        args = ["-m", "tools.hestia_asset_compiler", "golden", "--repeats", "10", "--output", str(target)]
        result, duration = native(args, 5250)
        require(result.returncode == 0, f"native corpus exit {result.returncode}; STOP, no retry/rebaseline")
        require(not result.stderr, "unexpected corpus stderr")
        summary = json.loads(result.stdout)
        require(summary == json.loads((target / "corpus-run.json").read_bytes()), "actual published summary mismatch")
        records = [record for path in sorted((target / "records").glob("*.json")) for record in json.loads(path.read_bytes())]
        require(summary["caseIds"] == [f"G{i:02}" for i in range(1, 31)] and summary["repeats"] == 10, "incomplete repeat/case matrix")
        require(len(records) == summary["recordCount"] == 370, "logical record count changed")
        require(summary["outcomeCounts"] == {"SUCCESS": 285, "EXPECTED_REJECTION": 77, "BLOCKED": 8}, "corpus outcome changed")
        previous = json.loads((DOCS / "C7_GOLDEN_SMOKE.json").read_bytes())["records"]
        require(encode(records) == encode(previous), "case records changed; do not update pins")
        addressed, different = set(), set()
        for record in records:
            stem = target / "inputs" / record["caseId"] / record["variant"]
            raw, report = stem.with_name(stem.name + ".glb").read_bytes(), stem.with_name(stem.name + ".report.json").read_bytes()
            sources = record["sources"]
            require(sha(raw) == sources["sourceGlbSha256"] and sha(report) == sources["sourceReportSha256"], "published source bytes mismatch")
            from tools.blender.hestia_asset_authoring.canonical import canonical_json_bytes
            require(sha(canonical_json_bytes(json.loads(report)["payload"])) == sources["authoringPayloadSha256"], "payload binding mismatch")
            addressed.add((record["caseId"], record["variant"]))
            different.add((sha(raw), sha(report)))
        require(len(addressed) == 185 and len(different) == 179, "source pair inventory changed")
        files = [{"path": str(p.relative_to(target)).replace("\\", "/"), "bytes": p.stat().st_size, "sha256": sha(p.read_bytes())}
                 for p in sorted(target.rglob("*")) if p.is_file()]
        raw_artifact = save("C8_GOLDEN_RAW.json", encode({"summary": summary, "records": records}))
    frozen_check()
    require(not Path(owned).exists(), "owned corpus cleanup failed")
    counts = {profile: dict(Counter(r["outcome"] for r in records if r["profileId"] == profile)) for profile in summary["profiles"]}
    evidence = {"schema": "hestia.asset-compiler-c8-determinism.v1", "phase": "C8_PRE_COMMIT_VERIFICATION",
        "status": "REPEAT_VERIFIED_PENDING_END_REVIEW", "codeFreezeSha": FREEZE, "compilerGitTree": tree.stdout.decode().strip(),
        "pythonSourceManifest": source_files, "pythonSourceTreeSha256": sha(encode(source_files)),
        "nativeArguments": [*args[:-1], "<OWNED_CTREE_GENERATION>"], "nativeExitCode": result.returncode,
        "stdoutSha256": sha(result.stdout), "stderrBytes": len(result.stderr), "wallSeconds": duration,
        "rawEngineSummary": summary, "rawArtifact": raw_artifact, "rawRecordsEqualC7": True,
        "logicalRecords": 370, "repeatsPerRecord": 10, "caseExecutions": 3700,
        "caseExecutionCountBasis": "Verified frozen run_corpus loop: baseline once plus nine actual run_case calls for EACH record; no cache/replay.",
        "compileCoreCallCount": "NOT_INSTRUMENTED; do not equate logical execution counts with measured core-call counts",
        "profileOutcomeCounts": counts, "variantAddressedInputPairs": 185, "differentGlbReportShaPairs": 179,
        "allSameInputPackageFileBytesCompared": True, "diagnosticsAndTreesCompared": True, "orderingMatrix": "3x2x2x2",
        "actualPublishedFiles": files, "publicationVerified": True, "ownedGenerationRemoved": True,
        "frozenC7ArtifactsUnchanged": True, "finalAcceptance": "PENDING_INDEPENDENT_END_REVIEW", "productIntegrated": False}
    artifact = save("C8_DETERMINISM.json", encode(evidence))
    print(encode({"C8_NATIVE_GOLDEN_FINISHED": "PASS", "artifact": artifact, "raw": raw_artifact,
        "repeats": 10, "logicalRecords": 370, "caseExecutions": 3700, "outcomeCounts": summary["outcomeCounts"],
        "profileOutcomeCounts": counts, "wallSeconds": duration, "ownedGenerationRemoved": True}).decode(), flush=True)


def benchmark():
    with tempfile.TemporaryDirectory(prefix="c8-native-benchmark-", dir=OWNED) as owned:
        target = Path(owned) / "generation"
        result, _ = native(["-m", "tools.hestia_asset_compiler", "benchmark", "--population", "small", "--output", str(target)], 180)
        require(result.returncode == 0 and not result.stderr, "bounded benchmark rejected; no retry/claim")
        raw = (target / "benchmark-run.json").read_bytes()
        data = json.loads(raw)
        require(data == json.loads(result.stdout), "actual benchmark publication differs")
        for run in data["runs"]:
            count = run["counts"]
            require(run["status"] == "MEASURED" and run["qualification"] == "CONTAMINATED_DIAGNOSTIC", "benchmark not diagnostic success")
            require(count["inputTriangles"] == count["expandedTriangles"] == 1008 and count["inputVertices"] == count["decodedVertices"] == 672, "actual workload count mismatch")
            require(count["ownedCells"] == (18144 if run["profileId"] == "micro-0125-research-v1" else 5376), "analytic owned-cell count differs")
        exclusions = []
        for population in ("medium", "large"):
            excluded, _ = native(["-m", "tools.hestia_asset_compiler", "benchmark", "--population", population], 30)
            require(excluded.returncode == 0 and not excluded.stderr, "budget-exclusion CLI failed")
            item = json.loads(excluded.stdout)
            require(all(r["status"] == "NOT_RUN_BUDGET_EXCLUDED" for r in item["runs"]), "larger population executed")
            exclusions.append(item)
    frozen_check()
    artifact = save("C8_BENCHMARK.json", encode({"schema": "hestia.asset-compiler-c8-benchmark-evidence.v1", "codeFreezeSha": FREEZE,
        "nativeExitCode": 0, "actualSmallRun": data, "actualBudgetExclusions": exclusions,
        "ownedGenerationRemoved": not Path(owned).exists(), "frozenC7ArtifactsUnchanged": True,
        "finalAcceptance": "PENDING_INDEPENDENT_END_REVIEW", "productIntegrated": False}))
    print(encode({"benchmark": "PASS_CONTAMINATED_DIAGNOSTIC", "artifact": artifact,
        "runs": [{"profileId": r["profileId"], "counts": r["counts"], "total": r["phases"]["total"]} for r in data["runs"]]}).decode(), flush=True)


if __name__ == "__main__":
    choice = argparse.ArgumentParser()
    choice.add_argument("phase", choices=("foundation", "golden", "benchmark"))
    args = choice.parse_args()
    frozen_check()
    sys.path.insert(0, str(ROOT))  # Evidence script's explicit readonly source checkout.
    {"foundation": foundation, "golden": golden, "benchmark": benchmark}[args.phase]()
