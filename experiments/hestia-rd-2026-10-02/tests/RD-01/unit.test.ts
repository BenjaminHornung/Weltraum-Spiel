import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const readJson = (file: string) => JSON.parse(readFileSync(new URL(file, import.meta.url), 'utf8'));
const sources = readJson('../../docs/coordination/input-package/sources/web_sources.json').sources
  .filter((source: { id: string }) => source.id.startsWith('RR-'));
const ids = ['RR-01', 'RR-02', 'RR-03', 'RR-04', 'RR-05', 'RR-06', 'RR-07'];
const inputs = () => ({ cards: ids.map((id) => readJson(`../../reference-cards/${id}.json`)),
  concepts: readJson('../../reference-cards/concepts.json'), sources });

describe('RD-01 reference provenance', () => {
  it('REF01 exactly RR-01..RR-07 with unique original links; missing/broken links remain visible', async () => {
    const { buildIndex } = await import('../../src/tools/reference-index/catalog.mjs');
    const data = inputs();
    const index = buildIndex(data);
    expect(index.references.map((reference) => reference.id)).toEqual(ids);
    expect(index.references.map((reference) => reference.sourceRef.url)).toEqual(sources.map((source: { url: string }) => source.url));
    expect(new Set(index.references.map((reference) => reference.sourceRef.url)).size).toBe(7);
    expect(index.issues).toEqual([]);
    const broken = structuredClone(data);
    broken.cards.pop();
    broken.cards[0].sourceRef.url = null;
    broken.cards[1].sourceRef.url = 'https://example.invalid/replacement';
    const defects = buildIndex(broken);
    expect(defects.references.map((reference) => reference.id)).toEqual(ids);
    expect(defects.references[0].sourceRef.url).toBeNull();
    expect(defects.references[1].sourceRef.url).toBe('https://example.invalid/replacement');
    expect(defects.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'RR-01', code: 'URL_MISMATCH' }),
      expect.objectContaining({ id: 'RR-02', code: 'URL_MISMATCH' }),
      expect.objectContaining({ id: 'RR-07', code: 'MISSING_CARD' })
    ]));
    const duplicate = structuredClone(data);
    duplicate.cards.push(duplicate.cards[0]);
    expect(buildIndex(duplicate).issues).toContainEqual(expect.objectContaining({ id: 'RR-01', code: 'DUPLICATE_CARD' }));
  });

  it('REF02 historical package, current author, FPS/hardware and own observation are distinct', async () => {
    const { buildIndex } = await import('../../src/tools/reference-index/catalog.mjs');
    const index = buildIndex(inputs());
    for (const reference of index.references) {
      expect(reference.claims.historicalPackage.every((claim: { origin: string }) => claim.origin === 'HISTORICAL_PACKAGE')).toBe(true);
      expect(reference.claims.authorTextRead.status).toBe('UNAVAILABLE');
      expect(reference.claims.authorTextRead.statements).toEqual([]);
      expect(reference.claims.ownObservation.every((claim: { origin: string; kind: string }) =>
        claim.origin === 'RD01_OBSERVATION' && claim.kind === 'HTTP_ACCESS')).toBe(true);
      expect(reference.claims.fpsHardware.isOwnMeasurement).toBe(false);
      expect(reference.claims.fpsHardware.hardware).toBeNull();
      expect(reference.claims.ownObservation.some((claim: { kind: string }) => claim.kind === 'FPS')).toBe(false);
    }
    const rr05 = index.references.find((reference) => reference.id === 'RR-05')!;
    expect(rr05.claims.fpsHardware).toMatchObject({ origin: 'HISTORICAL_PACKAGE', fps: 120, resolution: '4K' });
    const rr06 = index.references.find((reference) => reference.id === 'RR-06')!;
    expect(rr06.claims.historicalPackage).toContainEqual(expect.objectContaining({
      kind: 'AUTHOR_MEMORY_AS_REPORTED', value: { megabytesApprox: 630, templates: 4, seconds: 5 }
    }));
  });

  it('REF03 unknown/unviewed media never becomes VIEWED or ART_ACCEPTED', async () => {
    const { buildIndex } = await import('../../src/tools/reference-index/catalog.mjs');
    const data = inputs();
    data.cards[0].accessStatus.media = 'UNKNOWN';
    const index = buildIndex(data);
    for (const reference of index.references) {
      expect(reference.accessStatus.media).not.toBe('VIEWED');
      expect(reference.artStatus).toBe('NOT_RUN');
      expect(reference.observedIntervals).toEqual([]);
    }
    expect(index.concepts.assets.filter((asset: { availability: string }) => asset.availability === 'IMAGE_BYTES')).toEqual([]);
    expect(index.concepts.accessStatus.media).toBe('NOT_VIEWED');
    expect(index.concepts.artStatus).toBe('NOT_RUN');
    const falsePlayback = structuredClone(data);
    falsePlayback.cards[0].accessStatus.media = 'VIEWED';
    expect(() => buildIndex(falsePlayback)).toThrow(/media|Art/i);
    const falseArt = structuredClone(data);
    falseArt.cards[0].artStatus = 'ART_ACCEPTED';
    expect(() => buildIndex(falseArt)).toThrow(/media|Art/i);
    const inventedIntervals = structuredClone(data);
    inventedIntervals.concepts.observedIntervals = [{ startSeconds: 0, endSeconds: 1 }];
    expect(() => buildIndex(inventedIntervals)).toThrow(/media|Art/i);
  });

  it('REF04 identical input yields identical catalog/experiment mapping regardless of file order', async () => {
    const { buildIndex } = await import('../../src/tools/reference-index/catalog.mjs');
    const data = inputs();
    const reversed = { ...data, cards: [...data.cards].reverse(), sources: [...data.sources].reverse(),
      concepts: { ...data.concepts, assets: [...data.concepts.assets].reverse(), experimentIds: [...data.concepts.experimentIds].reverse() } };
    expect(JSON.stringify(buildIndex(reversed))).toBe(JSON.stringify(buildIndex(data)));
    const mapping = Object.fromEntries(buildIndex(data).references.map((reference) => [reference.id, reference.experimentIds]));
    expect(mapping).toEqual({
      'RR-01': ['RD-15'], 'RR-02': ['RD-31', 'RD-33'], 'RR-03': ['RD-13', 'RD-14'],
      'RR-04': ['RD-13', 'RD-23', 'RD-51'], 'RR-05': ['RD-13'],
      'RR-06': ['RD-21', 'RD-22', 'RD-23'], 'RR-07': ['RD-20', 'RD-41']
    });
  });
});
