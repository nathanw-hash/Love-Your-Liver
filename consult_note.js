// =============================================================================
// PDF deliverables - clinical note (Milestone 4, slice 4a). Renders the
// provider-facing clinical note for a FINALIZED consult into the shared
// #print-root and triggers print / Save-as-PDF (reusing consultPrintDoc from
// slice 4b). Clinical content is read entirely from the frozen row: snapshot
// (blood + hair via combineLabs, engine supplement_doses), discussion_notes,
// and the four captured narrative sections. Only the header identity fields are
// resolved live - the provider name via author_id -> profiles, and the patient
// DOB via client_id -> clients - since the snapshot froze the patient profile,
// not the author or the CRM record. Layout follows the clinic's discussion
// order: Blood (Vitamin A, Iron) -> Hair (Copper/Zinc) -> Toxics -> supplement
// recommendations. Sodium / potassium / additional hair elements are omitted
// (not captured yet; they arrive with the hair_additional slice). Pure UI/print
// - lives before const MARKER_ORDER, engine block untouched.
// =============================================================================

function consultNoteSec(title, sub) {
  return '<div class="pr-sec">' + consultEsc(title) + '</div>' +
         (sub ? '<div class="pr-secsub">' + consultEsc(sub) + '</div>' : '');
}

function consultNoteTable(pairs) {
  return '<div class="pr-table">' + pairs.map(function (p) {
    return '<div class="pr-trow"><span class="k">' + consultEsc(p[0]) + '</span>' +
           '<span class="v">' + consultEsc(consultShow(p[1])) + '</span></div>';
  }).join('') + '</div>';
}

function consultNoteNarr(key, sx) {
  const meta = (typeof CONSULT_SECTIONS !== 'undefined' ? CONSULT_SECTIONS : [])
    .find(function (s) { return s.key === key; });
  const label = meta ? meta.label : key;
  const v = sx[key] || {};
  const fld = function (l, val) {
    const has = val && String(val).trim();
    return '<div class="pr-fl">' + consultEsc(l) + '</div>' +
           '<div class="pr-fv">' + (has ? consultEsc(val).replace(/\n/g, '<br>') : '-') + '</div>';
  };
  return '<div class="pr-narr"><div class="pr-narr-h">' + consultEsc(label) + '</div>' +
         fld('Impression', v.impression) + fld('Changes', v.changes) +
         fld('Retest interval', v.retest_interval) + '</div>';
}

function consultNoteHtml(row, authorName, dob) {
  const snap  = row.snapshot || {};
  const blood = snap.blood || null;
  const hair  = snap.hair  || null;
  const labs  = combineLabs(blood, hair);
  const sx    = consultNormalizeSections(row.sections);
  const eng   = snap.engine || {};
  const name  = consultPatientName(row);

  const meta =
    '<div class="pr-meta">' +
      '<div><b>Patient:</b> ' + consultEsc(name) + '</div>' +
      (dob ? '<div><b>Date of birth:</b> ' + consultEsc(dob) + '</div>' : '') +
      '<div><b>Consultation date:</b> ' + consultEsc(row.consult_date || '-') + '</div>' +
      (row.finalized_at ? '<div><b>Finalized:</b> ' + consultEsc(String(row.finalized_at).slice(0, 10)) + '</div>' : '') +
      (authorName ? '<div><b>Provider:</b> ' + consultEsc(authorName) + '</div>' : '') +
    '</div>';

  const notes = (row.discussion_notes && row.discussion_notes.trim())
    ? consultEsc(row.discussion_notes).replace(/\n/g, '<br>') : '-';
  const discussion = consultNoteSec('Discussion notes') + '<div class="pr-fv">' + notes + '</div>';

  const bloodBlock =
    consultNoteSec('Blood test results', blood && blood.test_date ? 'Tested ' + blood.test_date : '') +
    consultNoteTable([
      ['Serum retinol (Vitamin A)', labs.serum_retinol],
      ['Ferritin', labs.ferritin],
      ['Copper', labs.blood_copper],
      ['Zinc', labs.blood_zinc]
    ]) +
    consultNoteNarr('vitamin_a', sx) +
    consultNoteNarr('iron', sx);

  const hairBlock =
    consultNoteSec('Hair test results', hair && hair.test_date ? 'Tested ' + hair.test_date : '') +
    consultNoteTable([
      ['Calcium', labs.hair_calcium],
      ['Magnesium', labs.hair_magnesium],
      ['Ca/Mg ratio', consultRatio(labs.hair_calcium, labs.hair_magnesium)],
      ['Copper', labs.hair_copper],
      ['Zinc', labs.hair_zinc],
      ['Zn/Cu ratio', consultRatio(labs.hair_zinc, labs.hair_copper)],
      ['Phosphorus', labs.hair_phosphorus],
      ['Selenium', labs.hair_selenium],
      ['Molybdenum', labs.hair_molybdenum]
    ]) +
    consultNoteNarr('copper_zinc', sx);

  const tox = labs.hair_toxics || {};
  const toxBlock =
    consultNoteSec('Toxic elements') +
    consultNoteTable([
      ['Aluminum', tox.aluminum], ['Arsenic', tox.arsenic], ['Cadmium', tox.cadmium],
      ['Lead', tox.lead], ['Mercury', tox.mercury], ['Uranium', tox.uranium]
    ]) +
    consultNoteNarr('toxics', sx);

  const doses = eng.supplement_doses || [];
  let dosesHtml;
  if (doses.length) {
    dosesHtml = doses.map(function (d) {
      return '<div class="pr-narr"><div class="pr-item-h">' + consultEsc(d.supplement) +
             (d.dose ? ' - ' + consultEsc(d.dose) : '') + '</div>' +
             (d.instructions ? '<div class="pr-fv">' + consultEsc(d.instructions) + '</div>' : '') +
             '</div>';
    }).join('');
  } else {
    dosesHtml = '<div class="pr-fv">None.</div>';
  }
  const supBlock = consultNoteSec('Supplement recommendations') + dosesHtml;

  const foot =
    '<div class="pr-foot">Nutrition Detective - Clinical Note. ' + consultEsc(name) +
    ', consultation ' + consultEsc(row.consult_date || '') + '.</div>';

  return '<div class="pr-doc">' +
           '<div class="pr-brand">Nutrition Detective</div>' +
           '<div class="pr-title">Clinical Note</div>' +
           meta + discussion + bloodBlock + hairBlock + toxBlock + supBlock + foot +
         '</div>';
}

// Triggered from the finalized-consult view. Resolves provider name (author_id)
// and patient DOB (client_id) live, then builds + prints. Identity lookups are
// best-effort: on failure the note still prints with the frozen content.
async function consultPrintNote(id) {
  const row = (_consultRows || []).find(function (r) { return String(r.id) === String(id); });
  if (!row) {
    if (typeof toast === 'function') toast('Open a finalized consult to print the note.');
    return;
  }
  let authorName = '';
  let dob = '';
  try {
    if (row.author_id) {
      const res = await dbSelect('profiles', { id: 'eq.' + row.author_id });
      const a = Array.isArray(res.data) ? res.data[0] : res.data;
      if (a) authorName = String(a.name || a.display_name || '').trim();
    }
  } catch (e) { console.warn('[consult] author lookup failed:', e); }
  try {
    if (row.client_id) {
      const res = await dbSelect('clients', { id: 'eq.' + row.client_id });
      const c = Array.isArray(res.data) ? res.data[0] : res.data;
      if (c) dob = String(c.date_of_birth || '').trim();
    }
  } catch (e) { console.warn('[consult] client lookup failed:', e); }
  consultPrintDoc(consultNoteHtml(row, authorName, dob));
}