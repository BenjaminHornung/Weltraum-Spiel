import { sampleQuery } from '../src/fixture.mjs';
self.onmessage = async ({ data }) => {
  try { self.postMessage({ result: await sampleQuery(data.request, data.profile), isolated: self.crossOriginIsolated }); }
  catch (error) { self.postMessage({ error: String(error) }); }
};
