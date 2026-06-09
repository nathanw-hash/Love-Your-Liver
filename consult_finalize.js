// =============================================================================
// Consultation workspace - finalize + snapshot (Milestone 3, slice 3c)
// Finalize assembles the frozen snapshot from the same data path the context
// pane runs (latest blood + hair + profile -> combineLabs -> the engine output)
// and commits it together with the current note in ONE atomic PATCH that flips
// status to final. RLS allows the draft->final transition (USING tests the
// pre-update row); the consultations_final_has_snapshot check is satisfied by
// the same write carrying snapshot + finalized_at. consultFinalNoteHtml renders
// the frozen note read-only for the final branch. The engine block is only read
// here, never edited.
// =============================================================================
async function consultAssembleSnapshot() {
  const uid = getActiveLabUserId();
  const { data: bloodArr } = await dbSelect('blood_tests', { user_id: 'eq.' + uid, order: 'test_date.desc', limit: '1' });
  const { data: hairArr }  = await dbSelect('hair_tests',  { user_id: 'eq.' + uid, order: 'test_date.desc', limit: '1' });
  const blood = Array.isArray(bloodArr) && bloodArr[0] ? bloodArr[0] : null;
  const hair  = Array.isArray(hairArr)  && hairArr[0]  ? hairArr[0]  : null;
  const { data: profileData } = await dbSelect('profiles', { user_id: 'eq.' + uid });
  const profile = Array.isArray(profileData) ? (profileData[0] || {}) : (profileData || {});
  const combined = combineLabs(blood, hair);
  const rec = generateRecommendationsV2(combined, profile, engineData);
  return {
    profile: profile,
    blood: blood,
    hair: hair,
    engine: {
      findings: rec.findings || [],
      priority_actions: rec.priority_actions || [],
      supplement_doses: rec.supplement_doses || []
    }
  };
}

function consultFinalNoteHtml(row) {
  const sx = consultNormalizeSections(row.sections);
  const field = function (label, val) {
    const has = val && String(val).trim();
    const body = has ? consultEsc(val).replace(/\n/g, '<br>') : '<span style="color:var(--text3);">-</span>';
    return '<div style="margin:8px 0 2px;font-size:12px;color:var(--text2);">' + consultEsc(label) + '</div>' +
           '<div style="font-size:14px;color:var(--text);line-height:1.5;">' + body + '</div>';
  };
  const notes = (row.discussion_notes && row.discussion_notes.trim())
    ? consultEsc(row.discussion_notes).replace(/\n/g, '<br>')
    : '<span style="color:var(--text3);">-</span>';
  const sectionsHtml = CONSULT_SECTIONS.map(function (s) {
    const v = sx[s.key];
    return '<div style="margin-top:16px;padding-top:12px;border-top:1px dashed var(--border);">' +
      '<div style="font-weight:700;font-size:14px;color:var(--text);">' + consultEsc(s.label) + '</div>' +
      field('Impression', v.impression) + field('Changes', v.changes) + field('Retest interval', v.retest_interval) +
    '</div>';
  }).join('');
  return '<div style="margin:6px 0 2px;font-size:12px;color:var(--text2);">Discussion notes</div>' +
         '<div style="font-size:14px;color:var(--text);line-height:1.5;">' + notes + '</div>' +
         sectionsHtml;
}

async function consultFinalize() {
  if (!_consultOpenId) return;
  if (!confirm("Finalize this consultation? It can't be edited afterward.")) return;
  const finBtn  = document.getElementById('consult-finalize-btn');
  const saveBtn = document.getElementById('consult-save-btn');
  const notesEl = document.getElementById('consult-notes');
  const sections = {};
  CONSULT_SECTIONS.forEach(function (s) {
    const imp = document.getElementById('consult-' + s.key + '-impression');
    const chg = document.getElementById('consult-' + s.key + '-changes');
    const ret = document.getElementById('consult-' + s.key + '-retest');
    sections[s.key] = {
      impression:      imp ? imp.value : '',
      changes:         chg ? chg.value : '',
      retest_interval: ret ? ret.value : ''
    };
  });
  if (finBtn)  { finBtn.disabled = true; finBtn.textContent = 'Finalizing...'; }
  if (saveBtn) saveBtn.disabled = true;
  try {
    const snapshot = await consultAssembleSnapshot();
    const now = new Date().toISOString();
    const finalizedId = _consultOpenId;
    const payload = {
      discussion_notes: notesEl ? notesEl.value : '',
      sections: sections,
      status: 'final',
      snapshot: snapshot,
      finalized_at: now,
      updated_at: now
    };
    const { data, error } = await dbUpdate('consultations', finalizedId, payload);
    if (error) { console.error('[consult] finalize failed:', error); toast('Could not finalize.'); return; }
    consultClearDirty();
    await renderConsultList();
    consultOpen(finalizedId);
    toast('Consultation finalized.');
  } catch (err) {
    console.error('[consult] finalize failed:', err);
    toast('Could not finalize.');
  } finally {
    if (finBtn)  { finBtn.disabled = false; finBtn.textContent = 'Finalize'; }
    if (saveBtn) saveBtn.disabled = false;
  }
}
