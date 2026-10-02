import { stageSource, RUN, BASE } from '../../exporters/stage-source.mjs';
import { makeProductFixture } from '../../exporters/product-crop.mjs';

const staged = await stageSource(`${RUN}/stage-v1`, BASE);
const original = staged.contracts.canonicalJson;
staged.contracts.canonicalJson = value => {
  const json = original(value);
  if (value.id === 'F01-HVP-COAST' && value.objects?.every(o => o.meshes === undefined)) {
    console.log(JSON.stringify({ diagnostic: 'pre-mesh manifest reservation', bytes: Buffer.byteLength(json),
      fields: Object.entries(value).map(([key, field]) => ({ key, bytes: Buffer.byteLength(original(field)) })) }, null, 2));
  }
  return json;
};
await makeProductFixture(staged, `${RUN}/stage-v1/proof`);
