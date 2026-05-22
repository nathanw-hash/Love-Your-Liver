#!/usr/bin/env node
// ============================================================================
// LYL Engine Parity Harness
// ============================================================================
// Runs V1 (original generateRecommendations) and V2 (table-driven
// generateRecommendationsV2) over a battery of synthetic fixtures and diffs
// their output. This is the validation layer we THOUGHT production shadow-mode
// was providing but wasn't (the shadow block called a function that didn't
// exist and silently swallowed the error).
//
// USAGE:
//   node parity_harness.js
//
// REQUIRES (all in the same directory):
//   - v1_engine.js            (provided — the extracted original engine)
//   - load_v2.js              (provided — loads V2 out of the extract)
//   - fixtures.js             (provided — synthetic test cases)
//   - v2_engine_extract.js    (YOU generate this from index.html, see README)
//   - engine_data.json        (YOU generate this from Supabase, see README)
//
// EXIT CODE: 0 if all diffs are clean-or-whitelisted, 1 if any unexpected diff.
// ============================================================================

const fs = require('fs');
const path = require('path');
const { generateRecommendations } = require('./v1_engine.js');
const { loadV2 } = require('./load_v2.js');
const { fixtures } = require('./fixtures.js');

// ---- Load V2 engine + engine data ------------------------------------------
const EXTRACT = path.join(__dirname, 'v2_engine_extract.js');
const DATA = path.join(__dirname, 'engine_data.json');

if (!fs.existsSync(EXTRACT)) {
  console.error('\nMISSING: v2_engine_extract.js');
  console.error('Generate it on the repo with:');
  console.error('  Get-Content index.html | Select-Object -Skip 2542 -First 520 | Set-Content parity/v2_engine_extract.js');
  console.error('(adjust -Skip if the MARKER_ORDER line is no longer at 2543)\n');
  process.exit(2);
}
if (!fs.existsSync(DATA)) {
  console.error('\nMISSING: engine_data.json');
  console.error('Generate it from the Supabase SQL editor (see README) and save the single-row');
  console.error('result as parity/engine_data.json\n');
  process.exit(2);
}

const generateRecommendationsV2 = loadV2(EXTRACT);

// engine_data.json may be either the raw single-row object with the 7 keys,
// or wrapped in an array (Supabase sometimes exports [{...}]). Normalize.
let engineData = JSON.parse(fs.readFileSync(DATA, 'utf8'));
if (Array.isArray(engineData)) engineData = engineData[0];

// The app's loadEngineData maps DB column names to the engineData shape the
// engine expects. The SQL we provided already aliases them (thresholds,
// ratio_thresholds, findings, actions, supplement_doses, toxic_thresholds,
// profile_flag_actions), so engineData should already have those 7 keys.
const requiredKeys = ['thresholds','ratio_thresholds','findings','actions','supplement_doses','toxic_thresholds','profile_flag_actions'];
const missing = requiredKeys.filter(k => !(k in engineData));
if (missing.length) {
  console.error('\nengine_data.json is missing keys:', missing.join(', '));
  console.error('Make sure you used the exact SELECT from the README (it aliases each table).\n');
  process.exit(2);
}

// ============================================================================
// Intended divergences — the WHITELIST.
// These are places where V2 SHOULD differ from V1 because V2 incorporates a
// deliberate fix. A diff matching one of these is EXPECTED, not a bug.
// Each entry is a function (v1Out, v2Out, fixture) -> bool: returns true if
// the (already-detected) difference is fully explained by this intended change.
// ============================================================================

// Normalize the V1 ferritin text to what we'd EXPECT V2 to produce after the
// {optHigh} -> {{optimal_high}} fix, so we can confirm the only difference is
// that substitution.
function ferritinFixExplains(v1Findings, v2Findings, fx) {
  // Find ferritin finding in each (if present).
  const v1F = v1Findings.find(f => f.marker === 'Ferritin');
  const v2F = v2Findings.find(f => f.marker === 'Ferritin');
  if (!v1F || !v2F) return false;
  // V1 text contains the literal "{optHigh}". V2 text should be identical
  // EXCEPT "{optHigh}" replaced by the numeric high threshold.
  const sex = (fx.profile.sex === 'male') ? 'male' : 'female';
  const optHigh = sex === 'male' ? 70 : 100;
  const v1Fixed = v1F.interpretation.replace('{optHigh}', String(optHigh));
  return v1Fixed === v2F.interpretation;
}

// ============================================================================
// Diffing
// ============================================================================

function deepEqual(a, b) {
  return JSON.stringify(a) === JSON.stringify(b);
}

// Produce a human-readable, field-level diff between two engine outputs.
// Returns an array of diff strings (empty if identical).
function diffOutputs(v1, v2) {
  const diffs = [];
  for (const section of ['findings', 'priority_actions', 'supplement_doses']) {
    const a = v1[section] || [];
    const b = v2[section] || [];
    if (a.length !== b.length) {
      diffs.push(`${section}: length ${a.length} (V1) vs ${b.length} (V2)`);
    }
    const n = Math.max(a.length, b.length);
    for (let i = 0; i < n; i++) {
      if (!deepEqual(a[i], b[i])) {
        diffs.push(`${section}[${i}]:\n      V1: ${JSON.stringify(a[i])}\n      V2: ${JSON.stringify(b[i])}`);
      }
    }
  }
  return diffs;
}

// Decide whether a non-empty diff is fully explained by intended divergences.
// Strategy: clone V1 output, apply each whitelisted transform, and re-diff. If
// the diff disappears, it was all intended.
function diffIsWhitelisted(v1, v2, fx) {
  // Apply ferritin fix to a copy of V1, then re-compare.
  const v1Patched = JSON.parse(JSON.stringify(v1));
  const fF = v1Patched.findings.find(f => f.marker === 'Ferritin');
  if (fF && fF.interpretation.includes('{optHigh}')) {
    const sex = (fx.profile.sex === 'male') ? 'male' : 'female';
    const optHigh = sex === 'male' ? 70 : 100;
    fF.interpretation = fF.interpretation.replace('{optHigh}', String(optHigh));
  }
  return diffOutputs(v1Patched, v2).length === 0;
}

// ============================================================================
// Run
// ============================================================================

let cleanCount = 0;
let whitelistedCount = 0;
const failures = [];

for (const fx of fixtures) {
  let v1Out, v2Out;
  try {
    v1Out = generateRecommendations(fx.labs, fx.profile);
  } catch (e) {
    failures.push({ fx, kind: 'V1 threw', detail: e.stack || String(e) });
    continue;
  }
  try {
    v2Out = generateRecommendationsV2(fx.labs, fx.profile, engineData);
  } catch (e) {
    failures.push({ fx, kind: 'V2 threw', detail: e.stack || String(e) });
    continue;
  }

  const rawDiffs = diffOutputs(v1Out, v2Out);
  if (rawDiffs.length === 0) {
    cleanCount++;
    continue;
  }
  if (diffIsWhitelisted(v1Out, v2Out, fx)) {
    whitelistedCount++;
    continue;
  }
  failures.push({ fx, kind: 'unexpected diff', detail: rawDiffs.join('\n    ') });
}

// ============================================================================
// Report
// ============================================================================

console.log('\n=== LYL Engine Parity Harness ===');
console.log(`Fixtures run:        ${fixtures.length}`);
console.log(`Clean (identical):   ${cleanCount}`);
console.log(`Whitelisted diffs:   ${whitelistedCount}  (intended: ferritin {optHigh} fix)`);
console.log(`Unexpected failures: ${failures.length}`);

if (failures.length) {
  console.log('\n--- FAILURES ---');
  for (const f of failures) {
    console.log(`\n[${f.kind}] ${f.fx.name}`);
    console.log(`  labs:    ${JSON.stringify(f.fx.labs)}`);
    console.log(`  profile: ${JSON.stringify(f.fx.profile)}`);
    console.log(`  ${f.detail}`);
  }
  console.log('\nResult: PARITY MISMATCH — see failures above.\n');
  process.exit(1);
} else {
  console.log('\nResult: PASS — V2 matches V1 on all fixtures (modulo intended fixes).\n');
  process.exit(0);
}
