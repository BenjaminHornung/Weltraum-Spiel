import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import test from 'node:test';

// Prepared source checks only; running this file needs separate authorization.
const read = path => readFile(new URL(path, import.meta.url), 'utf8');
const hash = text => createHash('sha256').update(text).digest('hex');
const inserted = '      m.alphaTest=0;\n      m.maskNode=mask.greaterThanEqual(0.5);\n';

test('B2 has exactly two assignments and no other material source changes', async () => {
  const control = await read('../control/src/materials.ts');
  const candidate = await read('../candidate/src/materials.ts');
  assert.equal(hash(control), 'dc89e8a1ae346e2b55544f4e97851ca5c405b3cfa2a0beae11982069db5ef5f1');
  assert.equal(candidate.split(inserted).length, 2);
  assert.equal(candidate.replace(inserted, ''), control);
  assert.equal(await read('../candidate/src/port.ts'), await read('../control/src/port.ts'));
});

test('CPU predicate specification matches original GL at and around .5; no GPU proof', async () => {
  const {cases} = JSON.parse(await read('./cases.json'));
  for (const c of cases.filter(c => 'maskValue' in c)) {
    assert.equal(c.maskValue < .5, c.originalGlDiscard);
    assert.equal(c.maskValue <= .5, c.stockNodeAlphaDiscard);
    assert.equal(c.maskValue >= .5, c.expectedCandidateVisibleKeep);
    assert.equal(c.maskValue >= .5, c.expectedCandidateShadowKeep);
  }
});

test('bound public types and visible/shadow propagation retain their source bytes', async () => {
  const {supportingInputs} = JSON.parse(await read('../input-bindings.json'));
  const source = async suffix => {
    const row = supportingInputs.find(r => r.path.replaceAll('\\', '/').endsWith(suffix));
    assert.ok(row, suffix);
    const bytes = await readFile(row.path);
    assert.equal(bytes.length, row.bytes);
    assert.equal(createHash('sha256').update(bytes).digest('hex'), row.sha256);
    return bytes.toString('utf8');
  };
  const types = await source('/@types/three/src/materials/nodes/NodeMaterial.d.ts');
  const operator = await source('/@types/three/src/nodes/math/OperatorNode.d.ts');
  const visible = await source('/three/src/materials/nodes/NodeMaterial.js');
  const shadow = await source('/three/src/renderers/common/Renderer.js');
  const gl = await source('/three/src/renderers/shaders/ShaderChunk/alphatest_fragment.glsl.js');
  assert.match(types, /maskNode: Node \| null/);
  assert.match(operator, /greaterThanEqual: ComparisonOperatorNumExtensions<"float">/);
  assert.match(visible, /bool\( this\.maskNode \)\.not\(\)\.discard\(\)/);
  assert.match(shadow, /material\.maskShadowNode \|\| material\.maskNode/);
  assert.match(shadow, /maskNode\.not\(\)\.discard\(\)/);
  assert.match(shadow, /positionNode = material\.positionNode/);
  assert.match(gl, /diffuseColor\.a < alphaTest/);
});
