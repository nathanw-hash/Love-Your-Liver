// preview_drift_check.js — guards the admin preview against engine drift.
//
// The admin "Preview" panel re-implements the engine's {{token}} substitution
// (index.html ~line 1410: "behavior must stay in sync"). Two surfaces can drift:
//   (A) the token VOCABULARY each side supplies per context, and
//   (B) the substitution MECHANICS (regex + null handling).
// This check loads the real functions out of index.html (not copies) so it
// tracks the shipped code, and fails non-zero on any drift.
//
// Run from parity/:  node preview_drift_check.js [path-to-index.html]

const fs = require('fs');
const path = require('path');

const INDEX = process.argv[2] || path.join(__dirname, '..', 'index.html');
const src = fs.readFileSync(INDEX, 'utf8'); // BOM tolerated by JS engines on read
const engineStart = src.indexOf('const MARKER_ORDER'); // engine block begins here
if (engineStart === -1) throw new Error('could not locate MARKER_ORDER (engine block)');

// ── helpers ────────────────────────────────────────────────────────────────
// Extract a top-level `function NAME(...) { ... }` by brace-matching.
function extractFn(name) {
  const sig = src.indexOf('function ' + name + '(');
  if (sig === -1) throw new Error('could not find function ' + name);
  let i = src.indexOf('{', sig), depth = 0;
  for (; i < src.length; i++) {
    if (src[i] === '{') depth++;
    else if (src[i] === '}') { depth--; if (depth === 0) { i++; break; } }
  }
  return src.slice(sig, i);
}

// Flat top-level keys of the ENGINE object literal containing `anchorKey:`.
// Searches only the engine region so it never matches the preview's objects.
// Handles `key:` and ES6 shorthand `key,` / `key` (end of line).
function engineObjectKeys(anchorKey) {
  const a = src.indexOf(anchorKey + ':', engineStart);
  if (a === -1) throw new Error('engine anchor not found past MARKER_ORDER: ' + anchorKey);
  const open = src.lastIndexOf('{', a);
  const close = src.indexOf('}', a);
  const body = src.slice(open + 1, close);
  const keys = [];
  body.split('\n').forEach(line => {
    const m = line.match(/^\s*([a-z_]+)\s*(?::|,|$)/);
    if (m) keys.push(m[1]);
  });
  return keys.sort();
}

const eq = (a, b) => a.length === b.length && a.every((x, i) => x === b[i]);
const sortedKeys = o => Object.keys(o).sort();

// Strip preview highlight spans and unescape, to compare to engine plain text.
function stripPreview(html) {
  return html
    .replace(/<span class="admin-preview-[a-z]+">([\s\S]*?)<\/span>/g, '$1')
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
}

// ── load the real functions (engineData bound mutably via a setter) ──────────
const PREVIEW_SAMPLE_WEIGHT = 170; // const in source; value irrelevant to key sets
const bundle = [
  'let engineData;',
  extractFn('substitute'),
  extractFn('previewSubstitute'),
  extractFn('sampleValueForThreshold'),
  extractFn('buildFindingPreviewVars'),
  extractFn('buildDosePreviewVars'),
  'return { substitute, previewSubstitute, sampleValueForThreshold,',
  '         buildFindingPreviewVars, buildDosePreviewVars,',
  '         setEngineData: (d) => { engineData = d; } };'
].join('\n\n');
// eslint-disable-next-line no-new-func
const fns = (new Function('PREVIEW_SAMPLE_WEIGHT', bundle))(PREVIEW_SAMPLE_WEIGHT);

// ── the contract (mirrors the table in the handoff note) ─────────────────────
const EXPECTED = {
  markerFinding: ['optimal_high', 'optimal_low', 'sex_label', 'sex_label_short', 'unit', 'value'],
  ratioFinding:  ['ratio', 'ratio_target_high', 'ratio_target_low'],
  dose:          ['max_dose_cap', 'weight', 'weight_factor_pct'],
};

const failures = [];
let checks = 0;
const expect = (label, cond, msg) => { checks++; if (!cond) failures.push('[' + label + '] ' + msg); };

// ── CHECK A: token-vocabulary parity ─────────────────────────────────────────
fns.setEngineData({
  thresholds: [{ marker_key: 'm1', sex: 'all', low_threshold: 10, high_threshold: 90, unit: 'mcg/dL' }],
  ratio_thresholds: [{ ratio_key: 'r1', optimal_low: 3, optimal_high: 11,
    status_when_below_low: 'high', status_when_above_high: 'low' }],
});

// A1: preview builders are internally consistent (knownKeys === keys(vars)) AND match the contract.
const mk = fns.buildFindingPreviewVars({ marker_key: 'm1', status: 'high' }, 'female');
expect('A1.marker.consistent', eq(mk.knownKeys.slice().sort(), sortedKeys(mk.vars)),
  'preview marker knownKeys != keys(vars): ' + JSON.stringify(mk.knownKeys) + ' vs ' + JSON.stringify(sortedKeys(mk.vars)));
expect('A1.marker.contract', eq(mk.knownKeys.slice().sort(), EXPECTED.markerFinding),
  'preview marker token set: ' + JSON.stringify(mk.knownKeys.slice().sort()));

const rt = fns.buildFindingPreviewVars({ marker_key: 'r1', status: 'low' }, 'female');
expect('A1.ratio.consistent', eq(rt.knownKeys.slice().sort(), sortedKeys(rt.vars)),
  'preview ratio knownKeys != keys(vars): ' + JSON.stringify(rt.knownKeys) + ' vs ' + JSON.stringify(sortedKeys(rt.vars)));
expect('A1.ratio.contract', eq(rt.knownKeys.slice().sort(), EXPECTED.ratioFinding),
  'preview ratio token set: ' + JSON.stringify(rt.knownKeys.slice().sort()));

const dsv = fns.buildDosePreviewVars({ weight_factor: 0.5, max_dose_cap: 100 });
expect('A1.dose.consistent', eq(dsv.knownKeys.slice().sort(), sortedKeys(dsv.vars)),
  'preview dose knownKeys != keys(vars): ' + JSON.stringify(dsv.knownKeys) + ' vs ' + JSON.stringify(sortedKeys(dsv.vars)));
expect('A1.dose.contract', eq(dsv.knownKeys.slice().sort(), EXPECTED.dose),
  'preview dose token set: ' + JSON.stringify(dsv.knownKeys.slice().sort()));

// A2: ENGINE var objects (scanned from source, engine region only) match the same contract.
expect('A2.marker', eq(engineObjectKeys('sex_label_short'), EXPECTED.markerFinding),
  'engine marker-finding vars: ' + JSON.stringify(engineObjectKeys('sex_label_short')));
expect('A2.ratio', eq(engineObjectKeys('ratio_target_low'), EXPECTED.ratioFinding),
  'engine ratio-finding vars: ' + JSON.stringify(engineObjectKeys('ratio_target_low')));
expect('A2.dose', eq(engineObjectKeys('weight_factor_pct'), EXPECTED.dose),
  'engine dose vars: ' + JSON.stringify(engineObjectKeys('weight_factor_pct')));
// Action context: engine supplies {computed_dose}; there is intentionally NO
// preview for actions. If a preview is added later, extend this check.
expect('A2.action', eq(engineObjectKeys('computed_dose'), ['computed_dose']),
  'engine action vars: ' + JSON.stringify(engineObjectKeys('computed_dose')));

// ── CHECK B: substitution mechanics equivalence ──────────────────────────────
// previewSubstitute (spans stripped) must equal engine substitute for the same
// (text, vars). knownKeys = keys(vars) so the "(no value)" branch never fires.
// The "(empty)" branch on blank text is an intentional UX divergence, asserted
// separately rather than compared.
const cases = [
  ['plain text, no tokens', 'No tokens here.', {}],
  ['single known token', 'Value is {{value}} mcg.', { value: 42 }],
  ['multiple tokens', '{{sex_label}} optimal {{optimal_low}}-{{optimal_high}}.', { sex_label: 'females', optimal_low: 50, optimal_high: 100 }],
  ['adjacent tokens', '{{a}}{{b}}', { a: 'x', b: 'y' }],
  ['null-valued token -> empty', 'cap {{max_dose_cap}} units', { max_dose_cap: null }],
  ['unknown token left literal', 'see {{not_a_token}} here', { value: 1 }],
  ['token with punctuation', '({{ratio}}:1)', { ratio: '2.0' }],
  ['repeated token', '{{x}} and {{x}}', { x: 'q' }],
];
for (const [name, text, vars] of cases) {
  const eng = fns.substitute(text, vars);
  const prev = stripPreview(fns.previewSubstitute(text, vars, Object.keys(vars)));
  expect('B.' + name, eng === prev,
    'mechanics drift\n      engine : ' + JSON.stringify(eng) + '\n      preview: ' + JSON.stringify(prev));
}
const emptyPrev = fns.previewSubstitute('', {}, []);
expect('B.empty-divergence-documented', /admin-preview-empty/.test(emptyPrev),
  'previewSubstitute("") should use the (empty) placeholder; if removed, update this note');

// ── report ───────────────────────────────────────────────────────────────────
console.log('=== Preview-vs-Engine Drift Check ===');
console.log('Source:   ' + INDEX);
console.log('Checks:   ' + checks);
console.log('Failures: ' + failures.length);
if (failures.length) {
  console.log('\n--- FAILURES ---');
  failures.forEach(f => console.log('  ' + f));
  console.log('\nResult: DRIFT DETECTED');
  process.exit(1);
}
console.log('\nResult: PASS \u2014 preview and engine agree on token vocabulary and substitution.');
