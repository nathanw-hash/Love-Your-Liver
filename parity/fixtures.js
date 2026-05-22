// Synthetic test fixtures for the parity harness.
// Goal: cover the edge cases that real production traffic won't reliably hit,
// so we exercise every branch of both engines and every threshold boundary.
//
// Each fixture is { name, labs, profile }. `labs` is the COMBINED shape that
// combineLabs produces (blood fields + hair fields + hair_toxics object).
// We build these directly rather than going through combineLabs so the harness
// has no dependency on the app's DB layer.

// Helper: a fully-null combined labs object (every marker absent).
function emptyLabs() {
  return {
    serum_retinol: null, ferritin: null, blood_copper: null, blood_zinc: null,
    hair_calcium: null, hair_phosphorus: null, hair_magnesium: null,
    hair_copper: null, hair_zinc: null, hair_selenium: null, hair_molybdenum: null,
    hair_toxics: { mercury: null, lead: null, cadmium: null, arsenic: null, aluminum: null, uranium: null },
  };
}

function lab(overrides) { return Object.assign(emptyLabs(), overrides); }
function toxics(overrides) { return Object.assign(emptyLabs().hair_toxics, overrides); }

const fixtures = [];
function add(name, labs, profile) { fixtures.push({ name, labs, profile }); }

// ---- Empty / minimal ----
add('all-null, empty profile', emptyLabs(), {});
add('all-null, male profile', emptyLabs(), { sex: 'male', weight_lbs: 200 });
add('all-null, female profile', emptyLabs(), { sex: 'female', weight_lbs: 130 });
add('all-null, unknown sex', emptyLabs(), { sex: 'unknown' });
add('all-null, null sex value', emptyLabs(), { sex: null });
add('all-null, no weight', emptyLabs(), { sex: 'male' });

// ---- Serum retinol boundaries (threshold 0..20, high_only) ----
add('retinol exactly 20 (boundary)', lab({ serum_retinol: 20 }), { sex: 'male' });
add('retinol 20.1 (just high)', lab({ serum_retinol: 20.1 }), { sex: 'male' });
add('retinol 0 (boundary low)', lab({ serum_retinol: 0 }), { sex: 'male' });
add('retinol 19.9 (optimal)', lab({ serum_retinol: 19.9 }), { sex: 'female' });

// ---- Ferritin: sex-specific thresholds (M 30-70, F 50-100) ----
add('ferritin 70 male (boundary high)', lab({ ferritin: 70 }), { sex: 'male' });
add('ferritin 71 male (high)', lab({ ferritin: 71 }), { sex: 'male' });
add('ferritin 30 male (boundary low)', lab({ ferritin: 30 }), { sex: 'male' });
add('ferritin 29 male (low)', lab({ ferritin: 29 }), { sex: 'male' });
add('ferritin 100 female (boundary high)', lab({ ferritin: 100 }), { sex: 'female' });
add('ferritin 101 female (high)', lab({ ferritin: 101 }), { sex: 'female' });
add('ferritin 50 female (boundary low)', lab({ ferritin: 50 }), { sex: 'female' });
add('ferritin 49 female (low)', lab({ ferritin: 49 }), { sex: 'female' });
// Unknown sex falls to the female branch in V1 (sex==='male' is false).
add('ferritin 80 unknown sex', lab({ ferritin: 80 }), { sex: 'unknown' });
add('ferritin 80 null sex', lab({ ferritin: 80 }), {});

// ---- Blood copper (>=90 high) ----
add('copper 89 (optimal)', lab({ blood_copper: 89 }), { sex: 'male' });
add('copper 90 (boundary, high)', lab({ blood_copper: 90 }), { sex: 'male' });
add('copper 91 (high)', lab({ blood_copper: 91 }), { sex: 'male' });

// ---- Blood zinc (100-135) ----
add('zinc 99 (low)', lab({ blood_zinc: 99 }), { sex: 'male', weight_lbs: 180 });
add('zinc 100 (boundary, optimal)', lab({ blood_zinc: 100 }), { sex: 'male', weight_lbs: 180 });
add('zinc 135 (boundary, optimal)', lab({ blood_zinc: 135 }), { sex: 'male' });
add('zinc 136 (high)', lab({ blood_zinc: 136 }), { sex: 'male' });
// Zinc dose math: exercise the weight-based cap at various weights.
add('zinc low, weight 100 (dose math)', lab({ blood_zinc: 90 }), { sex: 'female', weight_lbs: 100 });
add('zinc low, weight 150 (dose math)', lab({ blood_zinc: 90 }), { sex: 'female', weight_lbs: 150 });
add('zinc low, weight 200 (dose math, near cap)', lab({ blood_zinc: 90 }), { sex: 'male', weight_lbs: 200 });
add('zinc low, weight 300 (dose math, capped)', lab({ blood_zinc: 90 }), { sex: 'male', weight_lbs: 300 });
add('zinc low, no weight (default 150)', lab({ blood_zinc: 90 }), { sex: 'male' });
add('zinc low, weight 56 (low cap)', lab({ blood_zinc: 90 }), { sex: 'female', weight_lbs: 56 });

// ---- Hair calcium (40-42, watch_high) ----
add('hair Ca 39 (low)', lab({ hair_calcium: 39 }), { sex: 'male' });
add('hair Ca 40 (boundary optimal)', lab({ hair_calcium: 40 }), { sex: 'male' });
add('hair Ca 42 (boundary optimal)', lab({ hair_calcium: 42 }), { sex: 'male' });
add('hair Ca 43 (watch)', lab({ hair_calcium: 43 }), { sex: 'male' });

// ---- Hair phosphorus (low_only, <15) ----
add('hair P 14.9 (low)', lab({ hair_phosphorus: 14.9 }), { sex: 'male' });
add('hair P 15 (boundary optimal)', lab({ hair_phosphorus: 15 }), { sex: 'male' });

// ---- Ca:Mg ratio (3-11) — requires both hair_calcium and hair_magnesium ----
add('CaMg ratio mid (Ca40 Mg8 = 5.0 optimal)', lab({ hair_calcium: 40, hair_magnesium: 8 }), { sex: 'male' });
add('CaMg ratio low->high (Ca40 Mg20 = 2.0)', lab({ hair_calcium: 40, hair_magnesium: 20 }), { sex: 'male' });
add('CaMg ratio high->low (Ca60 Mg5 = 12.0)', lab({ hair_calcium: 60, hair_magnesium: 5 }), { sex: 'male' });
add('CaMg boundary 3.0 (Ca30 Mg10)', lab({ hair_calcium: 30, hair_magnesium: 10 }), { sex: 'male' });
add('CaMg boundary 11.0 (Ca44 Mg4)', lab({ hair_calcium: 44, hair_magnesium: 4 }), { sex: 'male' });
add('Mg present but Ca null (ratio skipped)', lab({ hair_magnesium: 8 }), { sex: 'male' });
add('Mg zero (division guard)', lab({ hair_calcium: 40, hair_magnesium: 0 }), { sex: 'male' });

// ---- Hair copper (0.5-1.5; text says 1.5-2.5 — known bug, both engines) ----
add('hair Cu 0.4 (low)', lab({ hair_copper: 0.4 }), { sex: 'male' });
add('hair Cu 0.5 (boundary optimal)', lab({ hair_copper: 0.5 }), { sex: 'male' });
add('hair Cu 1.5 (boundary optimal)', lab({ hair_copper: 1.5 }), { sex: 'male' });
add('hair Cu 1.6 (high)', lab({ hair_copper: 1.6 }), { sex: 'male' });

// ---- Zn:Cu ratio (18-22) — requires hair_zinc and hair_copper ----
add('ZnCu ratio mid (Zn20 Cu1 = 20 optimal)', lab({ hair_zinc: 20, hair_copper: 1 }), { sex: 'male' });
add('ZnCu ratio low (Zn15 Cu1 = 15)', lab({ hair_zinc: 15, hair_copper: 1 }), { sex: 'male' });
add('ZnCu ratio high (Zn25 Cu1 = 25)', lab({ hair_zinc: 25, hair_copper: 1 }), { sex: 'male' });
add('ZnCu boundary 18 (Zn18 Cu1)', lab({ hair_zinc: 18, hair_copper: 1 }), { sex: 'male' });
add('ZnCu boundary 22 (Zn22 Cu1)', lab({ hair_zinc: 22, hair_copper: 1 }), { sex: 'male' });
add('Zn present but Cu null (ratio skipped)', lab({ hair_zinc: 20 }), { sex: 'male' });
// NB: hair_copper present also triggers the standalone Hair Cu finding above.

// ---- Hair selenium (0.10-0.15) ----
add('hair Se 0.09 (low)', lab({ hair_selenium: 0.09 }), { sex: 'male' });
add('hair Se 0.10 (boundary optimal)', lab({ hair_selenium: 0.10 }), { sex: 'male' });
add('hair Se 0.15 (boundary optimal)', lab({ hair_selenium: 0.15 }), { sex: 'male' });
add('hair Se 0.16 (high)', lab({ hair_selenium: 0.16 }), { sex: 'male' });

// ---- Hair molybdenum (0.004-0.008) — high text == optimal text in V1 ----
add('hair Mo 0.003 (low)', lab({ hair_molybdenum: 0.003 }), { sex: 'male' });
add('hair Mo 0.004 (boundary optimal)', lab({ hair_molybdenum: 0.004 }), { sex: 'male' });
add('hair Mo 0.008 (boundary optimal)', lab({ hair_molybdenum: 0.008 }), { sex: 'male' });
add('hair Mo 0.009 (HIGH — divergence candidate)', lab({ hair_molybdenum: 0.009 }), { sex: 'male' });

// ---- Toxic elements (each just over / under its threshold) ----
add('mercury just over (0.06)', lab({ hair_toxics: toxics({ mercury: 0.06 }) }), { sex: 'male' });
add('mercury boundary (0.05, not over)', lab({ hair_toxics: toxics({ mercury: 0.05 }) }), { sex: 'male' });
add('lead just over (0.16)', lab({ hair_toxics: toxics({ lead: 0.16 }) }), { sex: 'male' });
add('cadmium just over (0.06)', lab({ hair_toxics: toxics({ cadmium: 0.06 }) }), { sex: 'male' });
add('arsenic just over (0.07)', lab({ hair_toxics: toxics({ arsenic: 0.07 }) }), { sex: 'male' });
add('aluminum just over (3.1)', lab({ hair_toxics: toxics({ aluminum: 3.1 }) }), { sex: 'male' });
add('uranium just over (0.02)', lab({ hair_toxics: toxics({ uranium: 0.02 }) }), { sex: 'male' });
add('multiple toxics elevated', lab({ hair_toxics: toxics({ mercury: 0.1, lead: 0.2, arsenic: 0.1 }) }), { sex: 'male' });

// ---- Profile flags (Fix These FIRST + hormonal) ----
add('flag mercury fillings', emptyLabs(), { sex: 'male', flag_mercury_fillings: true });
add('flag mold exposure', emptyLabs(), { sex: 'male', flag_mold_exposure: true });
add('flag copper pipes', emptyLabs(), { sex: 'male', flag_copper_pipes: true });
add('flag low protein', emptyLabs(), { sex: 'male', flag_low_protein: true });
add('all fix-first flags', emptyLabs(), { sex: 'male', flag_mercury_fillings: true, flag_mold_exposure: true, flag_copper_pipes: true, flag_low_protein: true });
add('hormonal flag, female (fires)', emptyLabs(), { sex: 'female', flag_hormonal_issues: true });
add('hormonal flag, male (should NOT fire)', emptyLabs(), { sex: 'male', flag_hormonal_issues: true });
add('hormonal flag, unknown sex (should NOT fire)', emptyLabs(), { sex: 'unknown', flag_hormonal_issues: true });

// ---- Realistic combined cases (Nathan-like + others) ----
add('Nathan-like full panel', lab({
  serum_retinol: 45.3, ferritin: 231, blood_copper: 79, blood_zinc: 107,
  hair_calcium: 68, hair_phosphorus: 15, hair_magnesium: 9.7, hair_copper: 3.4,
  hair_zinc: 19, hair_selenium: 0.1, hair_molybdenum: 0.005,
  hair_toxics: toxics({ mercury: 0.1 }),
}), { sex: 'male', weight_lbs: 248 });
add('everything-high female full panel', lab({
  serum_retinol: 60, ferritin: 400, blood_copper: 150, blood_zinc: 90,
  hair_calcium: 80, hair_phosphorus: 10, hair_magnesium: 5, hair_copper: 5,
  hair_zinc: 10, hair_selenium: 0.05, hair_molybdenum: 0.002,
  hair_toxics: toxics({ mercury: 0.5, lead: 0.5, cadmium: 0.5, arsenic: 0.5, aluminum: 10, uranium: 0.5 }),
}), { sex: 'female', weight_lbs: 140, flag_hormonal_issues: true, flag_mercury_fillings: true });
add('everything-optimal male', lab({
  serum_retinol: 10, ferritin: 50, blood_copper: 50, blood_zinc: 120,
  hair_calcium: 41, hair_phosphorus: 20, hair_magnesium: 6, hair_copper: 1,
  hair_zinc: 20, hair_selenium: 0.12, hair_molybdenum: 0.006,
}), { sex: 'male', weight_lbs: 175 });

module.exports = { fixtures, emptyLabs };
