// =============================================================================
// Consultation workspace - editor fields + save-draft (Milestone 3, slice 3b)
// Replaces the slice-3a consultOpen stub. The draft branch now renders the
// editable note: a discussion_notes textarea plus four fixed sections
// (Vitamin A / Iron / Copper-Zinc / Toxics), each with impression, changes, and
// retest_interval (defaulting to 6 months). Save draft PATCHes discussion_notes
// + sections via dbUpdate (RLS permits updates on drafts only). The final branch
// keeps the read-only stub for slice 3c. The section keys here are the frozen
// jsonb contract the M4 PDF will read.
// =============================================================================
const CONSULT_SECTIONS = [
  { key: 'vitamin_a',   label: 'Vitamin A' },
  { key: 'iron',        label: 'Iron' },
  { key: 'copper_zinc', label: 'Copper / Zinc' },
  { key: 'toxics',      label: 'Toxics' }
];
const CONSULT_RETEST_DEFAULT = '6 months';
let _consultOpenId = null;
let _consultDirty = false;

function consultNormalizeSections(sections) {
  const src = (sections && typeof sections === 'object') ? sections : {};
  const out = {};
  CONSULT_SECTIONS.forEach(function (s) {
    const v = (src[s.key] && typeof src[s.key] === 'object') ? src[s.key] : {};
    out[s.key] = {
      impression:      typeof v.impression === 'string' ? v.impression : '',
      changes:         typeof v.changes === 'string' ? v.changes : '',
      retest_interval: typeof v.retest_interval === 'string' ? v.retest_interval : CONSULT_RETEST_DEFAULT
    };
  });
  return out;
}

function consultAttr(v) {
  return consultEsc(v).replace(/"/g, '&quot;');
}

function consultField(label, id, value, type, rows) {
  const base = 'width:100%;box-sizing:border-box;font-family:inherit;font-size:14px;padding:8px 10px;' +
    'border:1px solid var(--border);border-radius:8px;background:var(--surface);color:var(--text);';
  const lab = '<label for="' + id + '" style="display:block;font-size:12px;color:var(--text2);margin:8px 0 4px;">' + consultEsc(label) + '</label>';
  if (type === 'textarea') {
    return lab + '<textarea id="' + id + '" rows="' + (rows || 2) + '" oninput="consultMarkDirty()" ' +
      'style="' + base + 'resize:vertical;line-height:1.5;">' + consultEsc(value) + '</textarea>';
  }
  return lab + '<input id="' + id + '" type="text" value="' + consultAttr(value) + '" oninput="consultMarkDirty()" style="' + base + '">';
}

function consultMarkDirty() {
  _consultDirty = true;
  const d = document.getElementById('consult-dirty');
  if (d) d.style.display = 'inline';
}

function consultClearDirty() {
  _consultDirty = false;
  const d = document.getElementById('consult-dirty');
  if (d) d.style.display = 'none';
}

async function consultSaveDraft() {
  if (!_consultOpenId) return;
  const btn = document.getElementById('consult-save-btn');
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
  const payload = {
    discussion_notes: notesEl ? notesEl.value : '',
    sections: sections,
    updated_at: new Date().toISOString()
  };
  if (btn) { btn.disabled = true; btn.textContent = 'Saving...'; }
  try {
    const { data, error } = await dbUpdate('consultations', _consultOpenId, payload);
    if (error) { console.error('[consult] save draft failed:', error); toast('Could not save draft.'); return; }
    const row = _consultRows.find(function (r) { return String(r.id) === String(_consultOpenId); });
    if (row) { row.discussion_notes = payload.discussion_notes; row.sections = payload.sections; }
    consultClearDirty();
    toast('Draft saved.');
  } catch (err) {
    console.error('[consult] save draft failed:', err);
    toast('Could not save draft.');
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = 'Save draft'; }
  }
}

function consultOpen(id) {
  const row = _consultRows.find(function (r) { return String(r.id) === String(id); });
  const ed = document.getElementById('consult-editor');
  if (!row || !ed) return;
  ed.style.display = 'block';
  if (row.status === 'final') {
    _consultOpenId = null;
    consultClearDirty();
    ed.innerHTML =
      '<div class="card-title" style="margin:0 0 6px;">Consultation - ' + consultEsc(row.consult_date) + ' (final)</div>' +
      '<p style="color:var(--text3);font-size:14px;line-height:1.6;">Read-only snapshot view lands in slice 3c. ' +
      'It will render the frozen snapshot captured at finalize, not live labs.</p>';
    ed.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    return;
  }
  // Draft: editable note backed by discussion_notes + the sections jsonb.
  _consultOpenId = row.id;
  const sx = consultNormalizeSections(row.sections);
  const sectionsHtml = CONSULT_SECTIONS.map(function (s) {
    const v = sx[s.key];
    return '<div style="margin-top:18px;padding-top:14px;border-top:1px dashed var(--border);">' +
      '<div style="font-weight:700;font-size:14px;color:var(--text);">' + consultEsc(s.label) + '</div>' +
      consultField('Impression', 'consult-' + s.key + '-impression', v.impression, 'textarea', 2) +
      consultField('Changes', 'consult-' + s.key + '-changes', v.changes, 'textarea', 2) +
      consultField('Retest interval', 'consult-' + s.key + '-retest', v.retest_interval, 'text') +
    '</div>';
  }).join('');
  ed.innerHTML =
    '<div style="display:flex;align-items:center;justify-content:space-between;gap:12px;margin:0 0 6px;">' +
      '<div class="card-title" style="margin:0;">Consultation - ' + consultEsc(row.consult_date) + ' (draft)</div>' +
      '<span id="consult-dirty" style="display:none;font-size:12px;font-weight:600;color:var(--amber);">Unsaved changes</span>' +
    '</div>' +
    consultField('Discussion notes', 'consult-notes', row.discussion_notes || '', 'textarea', 4) +
    sectionsHtml +
    '<div style="margin-top:20px;">' +
      '<button class="btn btn-accent" id="consult-save-btn" onclick="consultSaveDraft()">Save draft</button>' +
    '</div>';
  consultClearDirty();
  ed.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}
