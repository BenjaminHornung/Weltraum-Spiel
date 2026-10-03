import './style.css';
import referenceIndex from '../../../reference-cards/index.json';
import concepts from '../../../reference-cards/concepts.json';
import { registeredMountCount } from '../../contracts/experiment';
import { canonicalJson, parseBoundedJson, record, requireValue, sha256 } from '../../contracts/validation';
import { loadInventory, loadReplay, publicAssetRoot, PINNED_INVENTORY_SHA256, type LabInventory } from '../../runner/assets';
import { liveThreeHostCounts } from '../../runner/threeHost';
import { liveWebGpuHostCounts } from '../../experiments/three-webgpu';
import { knownHostMount, registration } from './hosts';
import { cameras, deriveReplay, NATIVE_SCENARIOS, type Replay, type Selection, type Variant } from './model';
import { createGallerySession, type GalleryState } from './session';
import { sourceBinding, type SourceBinding } from './source';
import { bindEvidence, bindingTemplate, canExportPair, EVIDENCE_LIMIT, runtimeBinding, type EvidenceFiles, type EvidenceKey } from './evidence';

function element<T extends HTMLElement>(id: string): T { const value = document.getElementById(id); requireValue(value, `Missing gallery element ${id}`); return value as T; }
const menu = (id: string) => element<HTMLSelectElement>(id);
const button = (id: string) => element<HTMLButtonElement>(id);
const output = (id: string) => element<HTMLOutputElement>(id);
const dialog = element<HTMLDialogElement>('overlay'); const page = new AbortController();
let source: SourceBinding; let inventory: LabInventory; let currentReplay: Replay | null = null;
let closed = false; let overlayUrl: string | null = null; let opener: HTMLElement | null = null;
type Bound = Awaited<ReturnType<typeof bindEvidence>> & { image: Uint8Array<ArrayBuffer> };
const slots: Partial<Record<'A' | 'B', Bound>> = {};
const assetRoot = publicAssetRoot(import.meta.env.BASE_URL, location.href);

function options(id: string, values: readonly { value: string; label: string; disabled?: boolean }[], selected?: string) {
  const select = menu(id); select.replaceChildren(...values.map((value) => {
    const option = new Option(value.label, value.value); option.disabled = value.disabled ?? false; return option;
  }));
  if (selected && values.some((value) => value.value === selected)) { select.value = selected; }
}
function nativeAllowed() { return (NATIVE_SCENARIOS as readonly string[]).includes(menu('scenario').value); }
const labels: Record<Variant, string> = { 'fixture-control': 'C0 · fixture-control', C1: 'C1 · explicit WebGL2', C2: 'C2 · explicit WebGPU' };
function syncVariant(variant: Variant) {
  const id = variant === 'fixture-control' ? 'RD-03' : 'RD-11'; menu('experiment').value = id;
  options('variant', (id === 'RD-03' ? ['fixture-control'] : ['C1', 'C2']).map((value) => ({ value, label: labels[value as Variant], disabled: id === 'RD-11' && !nativeAllowed() })), variant);
  const preset = registration(variant).preset; options('preset', [{ value: preset.id, label: `${preset.id} (registered)` }]);
}
function syncPairMenus() {
  for (const [id, fallback] of [['a-variant', 'fixture-control'], ['b-variant', 'C1']] as const) {
    const previous = menu(id).value || fallback;
    options(id, (['fixture-control', 'C1', 'C2'] as const).map((value) => ({ value, label: labels[value], disabled: value !== 'fixture-control' && !nativeAllowed() })), nativeAllowed() ? previous : 'fixture-control');
  }
  const nativeOption = menu('experiment').querySelector<HTMLOptionElement>('option[value="RD-11"]'); if (nativeOption) { nativeOption.disabled = !nativeAllowed(); }
}
function selection(cameraId = menu('camera').value): Selection {
  const values = menu('viewport').value.split(',').map(Number);
  return { scenarioId: menu('scenario').value, variant: menu('variant').value as Variant, cameraId, width: values[0]!, height: values[1]!, dpr: values[2]! };
}
function freshCanvas() {
  const canvas = document.createElement('canvas'); canvas.id = 'gallery-canvas'; canvas.setAttribute('aria-label', 'Active Hestia presentation replay');
  element('viewport-host').replaceChildren(canvas); return canvas;
}
function ready(state = session.read()) { return state.status === 'READY' && !state.busy && Boolean(state.comparison?.frame.paused); }
function pairReady(): boolean {
  return Boolean(source) && canExportPair(session.read(), source, { A: slots.A?.card, B: slots.B?.card },
    { A: menu('a-variant').value as Variant, B: menu('b-variant').value as Variant });
}
function evidenceButtons() {
  button('export-pair').disabled = !pairReady(); button('contact-sheet').disabled = !pairReady();
  for (const id of ['binding-template', 'inputs', 'bind']) { button(id).disabled = !ready() || !source; }
}
function show(state: GalleryState) {
  const displayStatus = state.status === 'READY' && state.busy ? 'PREPARING' : state.status;
  output('status').value = `${displayStatus} · ${state.busy && state.status === 'READY' ? 'Waiting for matching commanded frame' : state.message}`; output('status').dataset.status = displayStatus;
  const host = element('viewport-host'); host.setAttribute('aria-busy', String(state.busy)); host.dataset.mounting = String(state.status === 'PREPARING');
  if (state.selection) { host.style.width = `${state.selection.width}px`; host.style.maxWidth = '100%'; host.style.aspectRatio = `${state.selection.width} / ${state.selection.height}`; }
  const c = state.comparison;
  element('frame-summary').textContent = c ? `${state.busy ? 'Last submitted · ' : ''}Tick ${c.frame.tick} · ${c.frame.paused ? 'paused' : 'playing'} · ${c.frame.cameraId} · revision ${c.frame.sourceRevision} · reset ${c.resetTick ?? 'none'} · ${state.submission!.backend.requested} requested / ${state.submission!.backend.actual} actual · ${c.viewport.width}×${c.viewport.height} DPR ${c.viewport.dpr}` : state.status === 'ERROR' ? 'No READY frame — error, no substitute renderer.' : 'Waiting for matching submitted frame.';
  output('facts').value = JSON.stringify({ productIntegrated: false, evidenceClass: 'ACTUAL-RUNTIME-ONLY-WHEN-READY', inventorySha256: PINNED_INVENTORY_SHA256,
    source: source ? { ...source, files: undefined } : null, state, owners: { registeredMounts: registeredMountCount(), c0: liveThreeHostCounts(), rd11: liveWebGpuHostCounts() },
    gates: { originalREN12: 'FAIL', visualAdoption: 'DEFER', nativeBenchmark: 'NOT_RUN', art: 'NOT_RUN', product: 'NOT_RUN' } }, null, 2);
  output('facts').dataset.tick = String(c?.frame.tick ?? -1); output('facts').dataset.generation = String(state.generation);
  for (const id of ['play', 'pause', 'step', 'seek-go', 'reset']) { button(id).disabled = state.status !== 'READY' || state.busy; }
  button('pause').disabled = state.status !== 'READY' || !c || c.frame.paused;
  const seek = element<HTMLInputElement>('seek'); seek.max = String(state.durationTicks);
  if (c && document.activeElement !== seek) { seek.value = String(c.frame.tick); }
  if (state.status === 'READY' && state.selection) { menu('camera').value = state.selection.cameraId; }
  if (state.status === 'ERROR') { host.replaceChildren(); }
  evidenceButtons();
}
const session = createGallerySession({
  async load(s, signal) {
    const replay = currentReplay?.scenario.id === s.scenarioId ? currentReplay : await loadReplay(inventory, s.scenarioId, assetRoot, fetch, signal);
    signal.throwIfAborted(); currentReplay = replay;
    options('camera', cameras(replay).map((value) => ({ value, label: value })), s.cameraId || replay.scenario.initialCameraId); menu('camera').disabled = false; return replay;
  }, mount: knownHostMount(freshCanvas), changed: show,
});
async function choose(cameraId?: string) { if (!closed && inventory) { await session.select(selection(cameraId)); } }
function scenariosForFixture() {
  const fixture = inventory.fixtures.find((entry) => entry.id === menu('fixture').value); requireValue(fixture, 'Unknown initial fixture');
  const list = inventory.scenarios.filter((entry) => entry.initialFixtureDigest === fixture.fixtureDigest);
  options('scenario', list.map((entry) => ({ value: entry.id, label: entry.id }))); syncPairMenus();
  syncVariant(nativeAllowed() ? (menu('variant').value as Variant || 'fixture-control') : 'fixture-control');
}
function text(parent: HTMLElement, tag: string, content: string) { const child = document.createElement(tag); child.textContent = content; parent.append(child); return child; }
function references() {
  for (const ref of referenceIndex.references) {
    const row = text(element('references'), 'li', ''); row.dataset.referenceId = ref.id;
    text(row, 'strong', `${ref.id} · ${ref.title}`); text(row, 'p', `Media ${ref.accessStatus.media}; author UNKNOWN; license UNKNOWN; adoption ${ref.license.adoption}. No image available.`);
    const view = document.createElement('button'); view.type = 'button'; view.textContent = `View ${ref.id} source notes`;
    view.addEventListener('click', () => { openOverlay(view, `${ref.id} · unviewed reference`); text(element('overlay-body'), 'pre', JSON.stringify(ref, null, 2)); }); row.append(view);
    const link = document.createElement('a'); link.href = ref.sourceRef.url; link.target = '_blank'; link.rel = 'noopener noreferrer'; link.textContent = ' Original source (external, not acquired)'; row.append(link);
  }
  for (const asset of concepts.assets) { const row = text(element('concepts'), 'li', `${asset.id} · ${asset.availability} · ${'requestedBasename' in asset ? asset.requestedBasename : asset.path} · no decoded image`); row.dataset.availability = asset.availability; }
}
function openOverlay(from: HTMLElement, title: string) {
  opener = from; element('overlay-title').textContent = title; element('overlay-body').replaceChildren(); dialog.showModal(); button('close-overlay').focus();
}
dialog.addEventListener('close', () => { if (overlayUrl) { URL.revokeObjectURL(overlayUrl); overlayUrl = null; } element('overlay-body').replaceChildren(); opener?.focus(); opener = null; });
button('close-overlay').addEventListener('click', () => { dialog.close(); });
function download(name: string, bytes: Uint8Array<ArrayBuffer> | string, type = 'application/json') {
  const blob = new Blob([bytes], { type }); const url = URL.createObjectURL(blob); const link = document.createElement('a');
  link.href = url; link.download = name; link.click(); setTimeout(() => { URL.revokeObjectURL(url); }, 0);
}
async function action(job: () => Promise<void> | void) {
  try { await job(); } catch (error) { output('evidence-status').value = `Blocked: ${String(error)}`; } finally { evidenceButtons(); }
}
button('binding-template').addEventListener('click', () => { void action(() => { download('RD40.binding.json', canonicalJson(bindingTemplate(session.read(), source))); }); });
button('inputs').addEventListener('click', () => { void action(async () => {
  const state = session.read(); runtimeBinding(state, source); requireValue(currentReplay && state.selection, 'Missing validated replay');
  const prepared = await deriveReplay(currentReplay, state.selection); requireValue(session.read().generation === state.generation && ready(), 'Inputs became stale');
  const fixture = prepared.fixtures.get(state.comparison!.fixtureDigest); requireValue(fixture, 'Missing selected snapshot');
  download('RD40-validated-inputs.json', canonicalJson({ productIntegrated: false, encoding: 'UTF-8 canonical JSON; extract each value without additional whitespace',
    'original.json': prepared.scenario, 'effective.json': prepared.effective, 'fixture.json': fixture, source }));
}); });
function renderCards() {
  element('evidence-cards').replaceChildren();
  for (const slot of ['A', 'B'] as const) {
    const value = slots[slot]; const row = text(element('evidence-cards'), 'li', value ? `${slot} · ${value.card.runtime.selection.variant} · ${value.cardHash}` : `${slot} · missing own evidence`);
    if (value) {
      const view = document.createElement('button'); view.textContent = `View own ${slot} image`; view.addEventListener('click', () => {
        openOverlay(view, `Own ${slot} byte-bound image · ${value.cardHash}`); overlayUrl = URL.createObjectURL(new Blob([value.image], { type: 'image/png' }));
        const image = document.createElement('img'); image.src = overlayUrl; image.alt = `Own ${slot} ${value.card.runtime.selection.variant} at tick ${value.card.runtime.comparison.frame.tick}`; element('overlay-body').append(image);
      }); row.append(view);
    }
  }
}
button('bind').addEventListener('click', () => { void action(async () => {
  const selected = element<HTMLInputElement>('evidence-files').files; requireValue(selected && selected.length === 6, 'Select exactly binding + run + PNG + three input JSON files');
  const state = session.read(); runtimeBinding(state, source); const slot = menu('evidence-slot').value as 'A' | 'B';
  requireValue(state.selection?.variant === menu(`${slot.toLowerCase()}-variant`).value, 'Selected evidence slot does not match active variant');
  const local = new Map<string, Uint8Array<ArrayBuffer>>();
  for (const file of Array.from(selected)) { requireValue(!local.has(file.name) && file.size > 0 && file.size <= EVIDENCE_LIMIT, 'Duplicate, empty or oversized local file'); local.set(file.name, new Uint8Array(await file.arrayBuffer())); }
  const sidecars = [...local].filter(([name]) => name.endsWith('.binding.json')); requireValue(sidecars.length === 1, 'Exactly one .binding.json required');
  const sidecar = sidecars[0]![1]; const receipts = record(record(parseBoundedJson(sidecar)).files); const files = {} as Record<EvidenceKey, EvidenceFiles[EvidenceKey]>;
  for (const key of ['run', 'image', 'original', 'effective', 'fixture'] as const) {
    const receipt = record(receipts[key]); requireValue(typeof receipt.path === 'string', 'Missing file path');
    const name = receipt.path.split('/').at(-1)!; const bytes = local.get(name); requireValue(bytes, `Missing ${name}`); files[key] = { name, bytes };
  }
  const value = await bindEvidence(state, source, sidecar, files);
  const bitmap = await createImageBitmap(new Blob([files.image.bytes], { type: 'image/png' }));
  try { requireValue(bitmap.width === state.comparison!.viewport.bufferWidth && bitmap.height === state.comparison!.viewport.bufferHeight, 'Decoded PNG dimensions mismatch'); } finally { bitmap.close(); }
  requireValue(ready() && canonicalJson(runtimeBinding(session.read(), source)) === canonicalJson(value.card.runtime), 'Runtime changed while reading evidence');
  slots[slot] = { ...value, image: files.image.bytes }; output('evidence-status').value = `${slot} bound · ${value.cardHash} · external Git/build verification still required`; renderCards();
}); });
button('export-pair').addEventListener('click', () => { void action(async () => {
  requireValue(pairReady(), 'Missing/stale/pending comparison evidence');
  const cards = { schema: 'rd40-comparison-pair-v1', productIntegrated: false, A: slots.A!.card, B: slots.B!.card, hashes: { A: slots.A!.cardHash, B: slots.B!.cardHash } };
  const pairHash = await sha256(new TextEncoder().encode(canonicalJson(cards))); requireValue(pairReady(), 'Comparison became stale');
  download('RD40-comparison-cards.json', canonicalJson({ ...cards, pairHash }));
}); });
button('contact-sheet').addEventListener('click', () => { void action(async () => {
  requireValue(pairReady(), 'Missing/stale/pending comparison evidence'); const a = slots.A!; const b = slots.B!;
  const canvas = document.createElement('canvas'); canvas.width = 1280; canvas.height = 460; const ctx = canvas.getContext('2d'); requireValue(ctx, 'Contact-sheet Canvas2D unavailable');
  ctx.fillStyle = '#101719'; ctx.fillRect(0, 0, canvas.width, canvas.height); ctx.font = '14px sans-serif';
  for (const [index, value] of [a, b].entries()) {
    const image = await createImageBitmap(new Blob([value.image], { type: 'image/png' }));
    try { ctx.drawImage(image, index * 640, 0, 640, 360); } finally { image.close(); }
    ctx.fillStyle = '#e4eeee'; ctx.fillText(`${index === 0 ? 'A' : 'B'} · ${value.card.runtime.selection.variant} · tick ${value.card.runtime.comparison.frame.tick}`, index * 640 + 12, 388);
    ctx.fillText(value.cardHash.slice(0, 48), index * 640 + 12, 414);
  }
  ctx.fillText('Own bound images only · REN12 FAIL / visual adoption DEFER · ProductIntegrated=false', 12, 446);
  const blob = await new Promise<Blob | null>((resolve) => { canvas.toBlob(resolve, 'image/png'); }); requireValue(blob && pairReady() && slots.A === a && slots.B === b, 'Contact sheet became stale');
  const bytes = new Uint8Array(await blob.arrayBuffer()); const imageSha256 = await sha256(bytes); requireValue(pairReady() && slots.A === a && slots.B === b, 'Contact sheet became stale');
  download('RD40-contact-sheet.png', bytes, 'image/png'); download('RD40-contact-sheet.json', canonicalJson({ productIntegrated: false, imageSha256, A: a.cardHash, B: b.cardHash, imageSources: [a.card.files, b.card.files], classification: 'TOOL-SIDECAR-NOT-NATIVE-BENCHMARK' }));
}); });
element<HTMLFormElement>('selection').addEventListener('submit', (event) => { event.preventDefault(); });
menu('fixture').addEventListener('change', () => { scenariosForFixture(); void choose(''); });
menu('scenario').addEventListener('change', () => { syncPairMenus(); syncVariant(nativeAllowed() ? menu('variant').value as Variant : 'fixture-control'); void choose(''); });
menu('experiment').addEventListener('change', () => { syncVariant(menu('experiment').value === 'RD-03' ? 'fixture-control' : 'C1'); void choose(); });
for (const id of ['camera', 'viewport', 'preset']) { menu(id).addEventListener('change', () => { void choose(); }); }
menu('variant').addEventListener('change', () => { syncVariant(menu('variant').value as Variant); void choose(); });
for (const slot of ['a', 'b']) { button(`switch-${slot}`).addEventListener('click', () => { syncVariant(menu(`${slot}-variant`).value as Variant); void choose(); }); menu(`${slot}-variant`).addEventListener('change', evidenceButtons); }
for (const control of document.querySelectorAll<HTMLButtonElement>('[data-command]')) { control.addEventListener('click', () => { void session.command(control.dataset.command as 'play' | 'pause' | 'step' | 'reset'); }); }
button('seek-go').addEventListener('click', () => { void session.command('seek', Number(element<HTMLInputElement>('seek').value)); });
element('seek').addEventListener('keydown', (event) => { if (event.key === 'Enter') { event.preventDefault(); button('seek-go').click(); } });
button('dispose').addEventListener('click', () => { closed = true; void session.dispose().then(() => {
  element('viewport-host').replaceChildren();
  output('status').value = session.read().status === 'ERROR' ? `ERROR · disposed request retained failure: ${session.read().message}` : 'IDLE · disposed; reload explicitly to start a new session';
}); });
document.addEventListener('keydown', (event) => {
  if (dialog.open || event.altKey || event.ctrlKey || event.metaKey || (event.target instanceof Element && event.target.closest('input,select,textarea,button,a,[contenteditable]'))) { return; }
  if (event.code === 'Space') { event.preventDefault(); void session.command(session.read().comparison?.frame.paused ? 'play' : 'pause'); }
});
window.addEventListener('pagehide', () => { page.abort(); void session.dispose(); if (overlayUrl) { URL.revokeObjectURL(overlayUrl); } }, { once: true });
references(); renderCards(); syncVariant('fixture-control'); show(session.read());
try {
  source = await sourceBinding(); inventory = await loadInventory(assetRoot, fetch, page.signal);
  const initialDigests = new Set(inventory.scenarios.map((entry) => entry.initialFixtureDigest));
  options('fixture', inventory.fixtures.filter((entry) => initialDigests.has(entry.fixtureDigest)).map((entry) => ({ value: entry.id, label: entry.id })), 'F01-HVP-COAST');
  menu('fixture').disabled = false; menu('scenario').disabled = false; scenariosForFixture(); await choose('');
} catch (error) { output('status').value = `ERROR · ${String(error)}`; output('status').dataset.status = 'ERROR'; element('viewport-host').setAttribute('aria-busy', 'false'); }
