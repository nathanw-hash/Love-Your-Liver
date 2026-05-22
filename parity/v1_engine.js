// V1 engine — the ORIGINAL generateRecommendations, extracted verbatim from
// old_index_with_v1.html (commit 70606b0~1, the last commit before the V2 switch).
// This is the reference implementation. Do not "fix" anything here — its job is
// to reproduce exactly what production did before V2, so the harness can detect
// any place V2 diverges.

function generateRecommendations(labs, profile) {
  const findings = [];
  const actions  = [];
  const doses    = [];
  const sex      = profile.sex || 'unknown';
  const weight   = profile.weight_lbs || 150;

  function status(val, low, high) {
    if (val === null || val === undefined) return null;
    if (val < low) return 'low';
    if (val > high) return 'high';
    return 'optimal';
  }

  // Serum retinol
  if (labs.serum_retinol !== null) {
    const s = status(labs.serum_retinol, 0, 20);
    findings.push({ marker:'Serum retinol', value: labs.serum_retinol, unit:'mcg/dL', status: s==='high'?'high': s==='low'?'low':'optimal',
      interpretation: s==='high' ? 'Elevated —key driver of cholestasis and liver injury in LYL framework.' :
                      s==='low'  ? 'Low retinol —unusual; ensure no liver storage depletion.' :
                                   'Within LYL optimal range.' });
    if (s === 'high') actions.push({ priority:'urgent', title:'Reduce vitamin A intake', body:'Eliminate liver, organ meats, cod liver oil, dairy, and fortified foods. Avoid all vitamin A and fish oil supplements. High retinol is the primary driver of cholestasis.' });
  }

  // Ferritin
  if (labs.ferritin !== null) {
    const optLow  = sex==='male' ? 30 : 50;
    const optHigh = sex==='male' ? 70 : 100;
    const s = status(labs.ferritin, optLow, optHigh);
    findings.push({ marker:'Ferritin', value: labs.ferritin, unit:'ng/mL', status: s==='high'?'high': s==='low'?'low':'optimal',
      interpretation: s==='high' ? `High (${sex==='male'?'M':'F'} optimal ${optLow}…{optHigh}). Often indicates inflammation and/or copper toxicity, not true iron excess.` :
                      s==='low'  ? `Low (${sex==='male'?'M':'F'} optimal ${optLow}…{optHigh}). True iron deficiency —address root cause (copper toxicity, cholestasis) first.` :
                                   `Within optimal range (${optLow}…{optHigh} ng/mL for ${sex==='male'?'males':'females'}).` });
    if (s==='high') actions.push({ priority:'action', title:'Address elevated ferritin', body:'High ferritin typically reflects inflammation or copper toxicity rather than true iron excess. Work the LYL protocol —do not supplement iron. Consider blood donation if consistently above range after confirming with provider.' });
    if (s==='low')  actions.push({ priority:'urgent', title:'Investigate low ferritin', body:'Low ferritin suggests true iron deficiency. Address copper toxicity and cholestasis as root causes before considering iron supplementation.' });
  }

  // Blood copper
  if (labs.blood_copper !== null) {
    findings.push({ marker:'Blood copper', value: labs.blood_copper, unit:'mcg/dL', status: labs.blood_copper >= 90 ? 'high' : 'optimal',
      interpretation: labs.blood_copper >= 90 ? 'Elevated blood copper —synergistic with vitamin A toxicity. Major driver of cholestasis, hormonal dysregulation, and mineral depletion.' : 'Blood copper within optimal range (< 90 mcg/dL).' });
    if (labs.blood_copper >= 90) actions.push({ priority:'urgent', title:'Address copper toxicity', body:'Remove copper sources: eliminate chocolate, nuts, seeds, soy. Check water pipes (copper pipes leach into water —use RO filtration). Avoid copper cookware. Work the Big Minerals: selenium, molybdenum, and zinc antagonize copper.' });
  }

  // Blood zinc
  if (labs.blood_zinc !== null) {
    const s = status(labs.blood_zinc, 100, 135);
    findings.push({ marker:'Blood zinc', value: labs.blood_zinc, unit:'mcg/dL', status: s==='low'?'low': s==='high'?'high':'optimal',
      interpretation: s==='low' ? 'Low blood zinc —impairs RBP production (needed to clear vitamin A), reduces ADH enzyme activity, and slows copper displacement from the liver.' :
                      s==='high' ? 'High blood zinc —unusual without supplementation. Confirm no excessive zinc supplementation.' : 'Blood zinc within acceptable range.' });
    if (s==='low') {
      const maxDose = Math.min(Math.round(weight * 0.40 / 15) * 15, 60);
      doses.push({ supplement:'Zinc picolinate', dose: maxDose + 'mg/day', instructions:`Calculated from body weight (40% of ${weight} lbs, capped at 60mg). Start at 15–30mg and increase slowly. Do not exceed 60mg/day — doses above 90mg risk zinc toxicity.` });
      actions.push({ priority:'action', title:'Support zinc levels', body:`Start zinc picolinate — personalized max dose ${maxDose}mg/day based on your weight. Begin at 15–30mg and increase gradually. Strong reactions to even low doses suggest significant copper toxicity — reduce dose or pause until later in the program.` });
    }
  }

  // Hair calcium
  if (labs.hair_calcium !== null) {
    const s = status(labs.hair_calcium, 40, 42);
    findings.push({ marker:'Hair Ca', value: labs.hair_calcium, unit:'', status: s==='low'?'low': s==='high'?'watch':'optimal',
      interpretation: s==='low'  ? 'Hair calcium below optimal (40–42). May indicate calcium dysregulation or magnesium deficiency.' :
                      s==='high' ? 'High hair calcium often indicates biounavailable calcium depositing in soft tissues rather than bones. Associated with vitamin D dysregulation, vitamin A toxicity, and magnesium deficiency.' :
                                   'Hair calcium within optimal range (40–42).' });
    if (s==='high') actions.push({ priority:'watch', title:'High hair calcium —biounavailability', body:'Address with topical magnesium (keeps calcium in correct locations), reduce vitamin A, get vitamin D from sunlight not supplements, and consider vitamin K2 MK-4 (directs calcium to bones). Do not supplement calcium.' });
  }

  // Hair phosphorus
  if (labs.hair_phosphorus !== null) {
    var sP = labs.hair_phosphorus < 15 ? 'low' : 'optimal';
    findings.push({ marker:'Hair P', value: labs.hair_phosphorus, unit:'', status: sP,
      interpretation: sP==='low' ? 'Hair phosphorus below 15 - indicates deficiency.' : 'Hair phosphorus within optimal range (>= 15).' });
  }

  // Hair magnesium - evaluated as Ca:Mg ratio (target 3-11)
  if (labs.hair_magnesium !== null && labs.hair_calcium !== null && labs.hair_magnesium > 0) {
    var caMgRatio = labs.hair_calcium / labs.hair_magnesium;
    var caMgStr = caMgRatio.toFixed(1);
    var sMg = caMgRatio < 3 ? 'high' : caMgRatio > 11 ? 'low' : 'optimal';
    findings.push({ marker:'Hair Mg', value: labs.hair_magnesium, unit:'', status: sMg,
      interpretation: sMg==='low'  ? 'Hair magnesium low relative to calcium (Ca:Mg ratio ' + caMgStr + ', target 3-11). Magnesium deficiency impairs many enzymes and contributes to calcium dysregulation.' :
                      sMg==='high' ? 'Hair magnesium high relative to calcium (Ca:Mg ratio ' + caMgStr + ', target 3-11).' :
                                     'Hair magnesium balanced with calcium (Ca:Mg ratio ' + caMgStr + ', target 3-11).' });
  }

  // Hair copper
  if (labs.hair_copper !== null) {
    const s = status(labs.hair_copper, 0.5, 1.5);
    findings.push({ marker:'Hair Cu', value: labs.hair_copper, unit:'', status: s==='high'?'high': s==='low'?'low':'optimal',
      interpretation: s==='high' ? 'Hair copper elevated above optimal (1.5–2.5). Confirms copper accumulation in tissues.' :
                      s==='low'  ? 'Low hair copper —may reflect copper dumping out of tissues (a positive sign during detox) or true deficiency.' :
                                   'Hair copper within optimal range (1.5–2.5).' });
    if (s==='high') actions.push({ priority:'action', title:'Elevated hair copper', body:'Work the copper detox protocol: zinc picolinate, selenium, molybdenum, flush niacin, and soluble fiber. Eliminate high-copper foods: chocolate, nuts, seeds, soy. Check for copper pipes in your water supply.' });
  }

  // Hair zinc - evaluated as ratio with hair copper (target 20:1, +/- 10% = 18-22)
  if (labs.hair_zinc !== null && labs.hair_copper !== null && labs.hair_copper > 0) {
    var znCuRatio = labs.hair_zinc / labs.hair_copper;
    var znRatioStr = znCuRatio.toFixed(1);
    var s = znCuRatio < 18 ? 'low' : znCuRatio > 22 ? 'high' : 'optimal';
    findings.push({ marker:'Hair Zn', value: labs.hair_zinc, unit:'', status: s,
      interpretation: s==='low'  ? 'Hair zinc low relative to copper (Zn:Cu ratio ' + znRatioStr + ':1, target 18-22:1). Insufficient zinc impairs vitamin A detox and copper clearance.' :
                      s==='high' ? 'Hair zinc high relative to copper (Zn:Cu ratio ' + znRatioStr + ':1, target 18-22:1). Confirm no excessive supplementation.' :
                                   'Hair zinc balanced with copper (Zn:Cu ratio ' + znRatioStr + ':1, target 18-22:1).' });
  }

  // Hair selenium
  if (labs.hair_selenium !== null) {
    const s = status(labs.hair_selenium, 0.10, 0.15);
    findings.push({ marker:'Hair Se', value: labs.hair_selenium, unit:'', status: s==='low'?'low': s==='high'?'high':'optimal',
      interpretation: s==='low'  ? 'Hair selenium below optimal (0.11–0.15). Selenium is required for ALDH enzyme (vitamin A detox pathway) and protects the liver against vitamin A toxicity.' :
                      s==='high' ? 'Hair selenium above optimal range.' :
                                   'Hair selenium within optimal range (0.11–0.15).' });
    if (s==='low') {
      doses.push({ supplement:'Selenium glycinate', dose:'150mcg/day', instructions:'Big Minerals rule: if it causes negative reactions within 3–7 days, reduce dose or stop temporarily.' });
      actions.push({ priority:'action', title:'Support selenium levels', body:'Start selenium glycinate 150mcg/day. Selenium protects the liver, supports ALDH (vitamin A detox), and is a copper and mercury antagonist. Start at lower dose if sensitive.' });
    }
  }

  // Hair molybdenum
  if (labs.hair_molybdenum !== null) {
    const s = status(labs.hair_molybdenum, 0.004, 0.008);
    findings.push({ marker:'Hair Mo', value: labs.hair_molybdenum, unit:'', status: s==='low'?'low': s==='high'?'high':'optimal',
      interpretation: s==='low'  ? 'Hair molybdenum below 0.004 —indicates deficiency. Molybdenum is required for ALDH and aldehyde oxidase enzymes critical to vitamin A detox.' :
                                   'Hair molybdenum above deficiency threshold (0.004).' });
    if (s==='low') {
      doses.push({ supplement:'Molybdenum glycinate', dose:'150mcg/day', instructions:'Big Minerals rule: if it causes negative reactions within 3–7 days, reduce dose or stop temporarily.' });
      actions.push({ priority:'action', title:'Address molybdenum deficiency', body:'Molybdenum deficiency impairs the ALDH enzyme pathway needed to process and eliminate vitamin A. Signs include sensitivity to alcohol, wine, caffeine, or high-sulfur foods.' });
    }
  }

  // Toxic elements
  const toxics = labs.hair_toxics || {};
  const toxicFlags = [];
  if (toxics.mercury  > 0.05)  toxicFlags.push('Mercury (Hg) elevated —remove amalgam fillings via IAOMT-trained dentist only. Minimize all fish intake.');
  if (toxics.lead     > 0.15)  toxicFlags.push('Lead (Pb) elevated —identify environmental sources. Avoid clay supplements (may contain bioavailable lead).');
  if (toxics.cadmium  > 0.05)  toxicFlags.push('Cadmium (Cd) elevated —common from cigarette smoke and contaminated foods.');
  if (toxics.arsenic  > 0.06)  toxicFlags.push('Arsenic (As) elevated —check drinking water source. Avoid rice-heavy diet if confirmed.');
  if (toxics.aluminum > 3.0)   toxicFlags.push('Aluminum (Al) elevated —eliminate aluminum cookware and foil contact with food.');
  if (toxics.uranium  > 0.01)  toxicFlags.push('Uranium (U) elevated —check well water if applicable.');
  if (toxicFlags.length > 0) {
    actions.push({ priority:'urgent', title:'Toxic element burden detected', body: toxicFlags.join('\n') });
    findings.push({ marker:'Toxic elements', value:'Elevated', unit:'', status:'high', interpretation: toxicFlags.join(' ') });
  }

  // Fix These FIRST warnings
  const fixFirst = [];
  if (profile.flag_mercury_fillings) fixFirst.push('Mercury fillings present —stop the exposure before detoxing. Use only an IAOMT-trained dentist for removal (iaomt.org).');
  if (profile.flag_mold_exposure)    fixFirst.push('Mold exposure flagged —detoxing while still exposed is pointless. Identify and eliminate the mold source first.');
  if (profile.flag_copper_pipes)     fixFirst.push('Copper pipes flagged —install RO filtration for drinking/cooking water. Standard shower filters do not remove copper.');
  if (profile.flag_low_protein)      fixFirst.push('Low protein intake flagged —minimum 50g total protein per day from all sources combined.');
  if (fixFirst.length > 0) actions.unshift({ priority:'urgent', title:'Fix These FIRST —blocking recovery', body: fixFirst.join('\n') });

  // Women's hormonal
  if (sex==='female' && profile.flag_hormonal_issues) {
    actions.push({ priority:'action', title:'Women\'s hormonal support', body:'Consider vitamin K2 (MK-4 form, 3–5mg/day) for heavy menstrual bleeding. Topical magnesium over abdomen helps with cramps and copper detox. Always start probiotics with Lactobacillus first. Eliminate high-copper foods: chocolate, nuts, seeds.' });
  }

  return { findings, priority_actions: actions, supplement_doses: doses };
}

module.exports = { generateRecommendations };
