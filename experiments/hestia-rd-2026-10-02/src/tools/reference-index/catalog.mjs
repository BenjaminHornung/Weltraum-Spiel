const referenceIds = ['RR-01', 'RR-02', 'RR-03', 'RR-04', 'RR-05', 'RR-06', 'RR-07'];

function assertUnviewed(entry) {
  if (!['NOT_VIEWED', 'UNKNOWN'].includes(entry?.accessStatus?.media)
    || !Array.isArray(entry.observedIntervals) || entry.observedIntervals.length !== 0
    || entry.artStatus !== 'NOT_RUN' || entry.productIntegrated !== false) {
    throw new Error('RD-01 catalog has no media playback, Art acceptance or product integration authority');
  }
}

/**
 * Pure data projection; missing/duplicate/broken references are visible defects, never substitute links.
 * @param {{cards: Array<any>, concepts: any, sources: Array<{id: string, title: string, url: string}>}} input
 */
export function buildIndex({ cards, concepts, sources }) {
  if (!Array.isArray(cards) || !Array.isArray(sources)
    || sources.length !== 7 || referenceIds.some((id) => sources.filter((source) => source.id === id).length !== 1)) {
    throw new Error('Expected the seven original source-manifest records');
  }
  assertUnviewed(concepts);
  const issues = [];
  for (const id of [...new Set(cards.map((card) => card.id))].sort()) {
    if (!referenceIds.includes(id)) {
      issues.push({ id, code: 'UNEXPECTED_CARD' });
    }
  }
  const references = referenceIds.map((id) => {
    const expected = sources.find((source) => source.id === id);
    const matches = cards.filter((card) => card.id === id);
    if (matches.length !== 1) {
      issues.push({ id, code: matches.length === 0 ? 'MISSING_CARD' : 'DUPLICATE_CARD' });
      return { id, title: expected.title, sourceRef: { url: null }, expectedUrl: expected.url,
        accessStatus: { text: 'UNAVAILABLE', media: 'UNKNOWN' }, observedIntervals: [],
        claims: null, desiredEffect: [], exclusions: [], experimentIds: [], resultLinks: [],
        artStatus: 'NOT_RUN', productIntegrated: false, catalogStatus: 'DEFECT' };
    }
    const card = matches[0];
    assertUnviewed(card);
    if (!Array.isArray(card.experimentIds) || card.experimentIds.some((experimentId) => !/^RD-\d{2}$/.test(experimentId))
      || new Set(card.experimentIds).size !== card.experimentIds.length) {
      throw new Error(`Invalid experimentIds: ${id}`);
    }
    if (!Array.isArray(card.claims?.historicalPackage) || card.claims.historicalPackage.some((claim) => claim.origin !== 'HISTORICAL_PACKAGE')
      || card.claims.authorTextRead?.status !== 'UNAVAILABLE' || card.claims.authorTextRead.statements?.length !== 0
      || card.accessStatus.text !== 'UNAVAILABLE' || card.claims.fpsHardware?.isOwnMeasurement !== false
      || !Array.isArray(card.claims.ownObservation)
      || card.claims.ownObservation.some((claim) => claim.origin !== 'RD01_OBSERVATION' || claim.kind !== 'HTTP_ACCESS')) {
      throw new Error(`Claim provenance must remain historical/current-author/HTTP-observation distinct: ${id}`);
    }
    const broken = card.sourceRef?.url !== expected.url;
    if (broken) {
      issues.push({ id, code: 'URL_MISMATCH' });
    }
    return { ...card, expectedUrl: expected.url, experimentIds: [...card.experimentIds].sort(),
      catalogStatus: broken ? 'DEFECT' : 'COMPLETE_UNVIEWED' };
  });
  const conceptIndex = { ...concepts, assets: [...concepts.assets].sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0),
    experimentIds: [...concepts.experimentIds].sort() };
  const experiments = [...new Set([...references.flatMap((reference) => reference.experimentIds), ...conceptIndex.experimentIds])]
    .sort().map((id) => ({ id, referenceIds: references.filter((reference) => reference.experimentIds.includes(id)).map((reference) => reference.id),
      conceptIds: conceptIndex.experimentIds.includes(id) ? [conceptIndex.id] : [], resultStatus: 'NOT_RUN' }));
  return { schemaVersion: 1, taskId: 'RD-01', productIntegrated: false, artStatus: 'NOT_RUN',
    references, concepts: conceptIndex, experiments, issues };
}
