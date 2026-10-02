import { readFileSync } from 'node:fs';
import path from 'node:path';
import { performance } from 'node:perf_hooks';
import { fileURLToPath } from 'node:url';
import { sha, sorted } from './fixture-export.mjs';
import { BASE, LAB, RUN, START, ownedPath, stageSource, verifyFreeze, writeOwned } from './stage-source.mjs';
import { makeSyntheticFixtures } from './synthetic.mjs';
import { makeProductFixture } from './product-crop.mjs';
import { readFixtureDirectory, writeBundle } from './fixture-files.mjs';

async function main() {
  const argv = process.argv.slice(2); const options = {};
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--reverse-order') { options.reverse = true; }
    else if (['--source-ref', '--input-freeze-ref', '--out', '--stage'].includes(argv[i]) && argv[i + 1]) { options[argv[i].slice(2)] = argv[++i]; }
    else { throw new Error('Usage: export-fixtures.mjs --source-ref <b3 SHA> --out <own output> [--input-freeze-ref <HEAD freeze SHA>] [--stage <own run directory>] [--reverse-order]'); }
  }
  if (options['source-ref'] !== BASE || !options.out) { throw new Error('Exact pinned source-ref and owned out required'); }
  const out = ownedPath(options.out, true); const stage = ownedPath(options.stage ?? `${RUN}/stage-v1`);
  const start = performance.now(); const cpu = process.cpuUsage();
  const inputFreezeRef = options['input-freeze-ref'] ?? START;
  const freeze = verifyFreeze(inputFreezeRef);
  const generatorFiles = sorted(['fixture-export.mjs', 'synthetic.mjs', 'stage-source.mjs', 'product-crop.mjs', 'fixture-files.mjs', 'export-fixtures.mjs']
    .map(file => ({ path: `exporters/${file}`, sha256: sha(readFileSync(path.join(LAB, 'exporters', file))) })), f => f.path);
  const staged = await stageSource(stage, BASE);
  writeOwned(path.join(stage, 'source-adapters.json'), `${JSON.stringify(staged.adapters, null, 2)}\n`);
  const generated = await makeSyntheticFixtures(staged.contracts, generatorFiles.find(f => f.path === 'exporters/synthetic.mjs').sha256, Boolean(options.reverse));
  const product = await makeProductFixture(staged, path.join(stage, 'proof'), Boolean(options.reverse));
  const bundles = sorted([...generated.bundles, product.bundle], b => `${b.group}:${b.fixture.sourceRevision}`);
  const scenarios = sorted([...generated.scenarios, product.scenario], s => s.group);
  const imported = new Map(); const fixtures = [];
  for (const bundle of bundles) {
    const relative = bundle.fixture.sourceRevision === 0 ? bundle.group : `${bundle.group}/snapshots/r${bundle.fixture.sourceRevision}-${bundle.revisionLabel}`;
    const directory = path.join(out, relative);
    const recipe = { schema: 'rd02-fixture-recipe-v1', fixtureId: bundle.fixture.id, fixtureDigest: bundle.fixtureDigest,
      mode: 'presentation-replay', productIntegrated: false, generatorFiles, generatorVersion: 'rd02-fixtures-v1',
      seed: bundle.fixture.kind === 'product-derived' ? bundle.cases.nativeSeed : 20261002,
      sourceRevision: bundle.fixture.sourceRevision, cases: bundle.cases, regions: bundle.recipeRegions,
      nativeSourceAdapters: bundle.fixture.kind === 'product-derived' ? staged.adapters : [],
      limits: { manifestBytes: 1_048_576, payloadBytes: 134_217_728 },
      meshBoundaryPolicy: 'open exposed-face projection; unknown is NOT known air; same policy required for greedy/ray comparisons',
      authority: 'lab presentation snapshots only; not native CutApplied/Receipt, save, physics, world or generated shader proof' };
    writeBundle(directory, bundle, recipe, staged.contracts);
    const loaded = await readFixtureDirectory(directory, staged.contracts);
    imported.set(bundle.fixtureDigest, loaded.fixture);
    fixtures.push({ id: bundle.fixture.id, group: bundle.group, sourceRevision: bundle.fixture.sourceRevision,
      revisionLabel: bundle.revisionLabel, manifestPath: `${relative}/manifest.json`, recipePath: `${relative}/recipe.json`,
      fixtureDigest: bundle.fixtureDigest, manifestSha256: sha(bundle.manifestBytes), manifestBytes: bundle.manifestBytes.length,
      recipeSha256: sha(readFileSync(path.join(directory, 'recipe.json'))), sourceRefs: bundle.fixture.sourceRefs,
      payloadBytes: bundle.payloadBytes, payloads: bundle.fixture.payloads.map(p => ({ ...p, path: `${relative}/${p.path}` })) });
  }
  const scenarioInventory = [];
  for (const entry of scenarios) {
    const loaded = staged.contracts.importScenario(entry.scenarioBytes, imported);
    const digest = await staged.contracts.getScenarioDigest(loaded);
    if (digest !== entry.scenarioDigest) { throw new Error('Scenario roundtrip mismatch'); }
    writeOwned(path.join(out, `${entry.group}/scenario.json`), entry.scenarioBytes, true);
    scenarioInventory.push({ id: loaded.id, path: `${entry.group}/scenario.json`, sha256: sha(entry.scenarioBytes), scenarioDigest: digest,
      initialFixtureDigest: loaded.fixtureDigest, mode: loaded.mode,
      snapshots: loaded.snapshots.map(s => ({ tick: s.tick, fixtureDigest: s.fixtureDigest, id: s.manifest.id, sourceRevision: s.manifest.sourceRevision })) });
  }
  const inventory = { schema: 'rd02-fixture-inventory-v1', sourceRef: BASE, productIntegrated: false,
    groups: ['F00-CONTROL', 'F01-HVP-COAST', 'F02-ROOT-GROVE', 'F03-SHELTER', 'F04-DETACH', 'F05-CUTOUT', 'F06-MATERIAL', 'F07-SCALE'],
    fixtures, scenarios: scenarioInventory };
  writeOwned(path.join(out, 'inventory.json'), `${staged.contracts.canonicalJson(inventory)}\n`, true);
  const cpuUsed = process.cpuUsage(cpu);
  const diagnostic = { schema: 'rd02-export-cost-v1', sourceRef: BASE, inputFreezeRef, out, stage, reverseOrder: Boolean(options.reverse),
    wallMilliseconds: performance.now() - start, processCpuUserMilliseconds: cpuUsed.user / 1000,
    processCpuSystemMilliseconds: cpuUsed.system / 1000, processPeakRssKiB: process.resourceUsage().maxRSS,
    currentMemoryBytes: process.memoryUsage(), fixtureCount: fixtures.length,
    totalPayloadBytes: fixtures.reduce((sum, f) => sum + f.payloadBytes, 0),
    totalManifestBytes: fixtures.reduce((sum, f) => sum + f.manifestBytes, 0),
    largestFixtureBytes: Math.max(...fixtures.map(f => f.payloadBytes)), inventorySha256: sha(readFileSync(path.join(out, 'inventory.json'))),
    productDiagnostic: product.diagnostic, freeze, gpu: { status: 'not-run', reason: 'Pure source export; no GPU lease' },
    gameRuntimeCost: { status: 'not-run', reason: 'Export CPU/bytes are not runtime costs or capacity proof' }, productIntegrated: false };
  writeOwned(`${RUN}/export-${Date.now()}-${options.reverse ? 'reverse' : 'normal'}.json`, `${JSON.stringify(diagnostic, null, 2)}\n`);
  console.log(JSON.stringify(diagnostic, null, 2));
}
if (path.resolve(process.argv[1] ?? '') === fileURLToPath(import.meta.url)) {
  main().catch(error => { console.error(error.stack); process.exitCode = 1; });
}
