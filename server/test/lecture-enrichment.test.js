import test from 'node:test';
import assert from 'node:assert/strict';
import { locateQuote, quoteAppearsIn, normalizeEnrichment, materialsForPrompt } from '../lib/lectureEnrichment.js';

const transcript = 'Okay so today we start with stress. Stress is defined as force per unit area, sigma equals F over A. '
  + 'Then strain, epsilon, is the change in length over the original length. Young\'s modulus is stress over strain. '
  + 'For Thursday please read chapter three point two and do problems one to five.';

test('locateQuote resolves a verbatim quote to the original offset', () => {
  const at = locateQuote(transcript, 'Stress is defined as force per unit area');
  assert.ok(at >= 0);
  assert.equal(transcript.slice(at, at + 6), 'Stress');
});

test('locateQuote tolerates punctuation and case differences but not paraphrase', () => {
  assert.ok(locateQuote(transcript, 'stress is defined as FORCE per unit area,') >= 0);
  assert.equal(locateQuote(transcript, 'stress means how much force acts on an area'), -1);
});

test('locateQuote falls back to the leading words of a long quote', () => {
  const at = locateQuote(transcript, 'Then strain, epsilon, is the change in length over the wrong ending here');
  assert.ok(at >= 0);
  assert.equal(transcript.slice(at, at + 4), 'Then');
});

test('a formula is verified only when it really appears in the materials', () => {
  const materials = [{ id: 'm1', file_name: 'slides.pdf', text: '[Page 3]\nStress: σ = F / A\nStrain: ε = ΔL / L' }];
  const out = normalizeEnrichment({
    one_liner: 'x', key_takeaways: [], outline: [], concepts: [],
    formulas: [
      { name: 'Stress', expression: 'σ = F / A', meaning: 'force per area', source: 'material', material_quote: 'σ = F / A', anchor: 'sigma equals F over A' },
      { name: 'Modulus', expression: 'E = σ / ε', meaning: 'stiffness', source: 'material', material_quote: 'E = σ / ε' },
      { name: 'Made up', expression: 'Q = m c ΔT', meaning: 'heat', source: 'transcript' },
    ],
  }, { transcript, materials });
  assert.equal(out.formulas.length, 3);
  assert.equal(out.formulas[0].verified, true);
  assert.equal(out.formulas[0].source, 'material');
  assert.ok(out.formulas[0].anchor.offset >= 0, 'anchor should resolve');
  // The model claimed the material had it; it does not. The claim is recorded, not trusted.
  assert.equal(out.formulas[1].verified, false);
  assert.equal(out.formulas[1].source, 'transcript');
  assert.equal(out.formulas[1].claimed_material, true);
  assert.equal(out.formulas[2].verified, false);
  assert.equal(out.stats.verified_formulas, 1);
});

test('without materials nothing can be verified, whatever the model claims', () => {
  const out = normalizeEnrichment({
    one_liner: 'x', key_takeaways: [], outline: [], concepts: [],
    definitions: [{ term: 'Strain', definition: 'change in length over original length', source: 'material', material_quote: 'Strain' }],
  }, { transcript, materials: [] });
  assert.equal(out.definitions[0].verified, false);
  assert.equal(out.definitions[0].source, 'transcript');
});

test('related concepts only point at concepts that exist', () => {
  const out = normalizeEnrichment({
    one_liner: 'x', key_takeaways: [], outline: [],
    concepts: [
      { name: 'Stress', explanation: 'force per area', related: ['Strain', 'Torque', 'stress'] },
      { name: 'Strain', explanation: 'deformation', related: [] },
    ],
  }, { transcript });
  assert.deepEqual(out.concepts[0].related, ['Strain']);
});

test('malformed items are dropped and caps are enforced', () => {
  const out = normalizeEnrichment({
    one_liner: 'x', key_takeaways: Array.from({ length: 40 }, (_, i) => `t${i}`),
    outline: [{ heading: '', summary: 'no heading' }, { heading: 'Intro', summary: '' }, { heading: 'Stress', summary: 'defined' }],
    concepts: [{ name: 'A', explanation: '' }],
    todos: [{ title: 'Read 3.2', kind: 'nonsense', due_hint: 'before Thursday' }, { title: '' }],
  }, { transcript });
  assert.equal(out.key_takeaways.length, 10);
  assert.equal(out.outline.length, 1);
  assert.equal(out.concepts.length, 0);
  assert.equal(out.todos.length, 1);
  assert.equal(out.todos[0].kind, 'task');
});

test('double-escaped LaTeX from the model is unescaped once', () => {
  const out = normalizeEnrichment({
    one_liner: 'x', key_takeaways: [], outline: [], concepts: [],
    formulas: [{ name: 'Stress', expression: 'σ = F/A', latex: '\\\\sigma = \\\\frac{F}{A}', meaning: 'm' }],
  }, { transcript });
  assert.equal(out.formulas[0].latex, '\\sigma = \\frac{F}{A}');
});

test('quoteAppearsIn ignores punctuation and case', () => {
  assert.ok(quoteAppearsIn('Young’s modulus: E = σ/ε (Pa)', 'e = σ / ε'));
  assert.ok(!quoteAppearsIn('E = σ/ε', 'F = m a'));
});

test('materialsForPrompt skips files whose text could not be extracted and respects the budget', () => {
  const rows = [
    { id: '1', file_name: 'a.pdf', extraction_status: 'ready', extracted_text: 'x'.repeat(100) },
    { id: '2', file_name: 'scan.pdf', extraction_status: 'failed', extracted_text: null },
    { id: '3', file_name: 'b.pdf', extraction_status: 'ready', extracted_text: 'y'.repeat(200_000) },
    { id: '4', file_name: 'c.pdf', extraction_status: 'ready', extracted_text: 'z' },
  ];
  const out = materialsForPrompt(rows);
  assert.deepEqual(out.map((m) => m.id), ['1', '3']);
  assert.ok(out[1].text.length < 200_000);
});
