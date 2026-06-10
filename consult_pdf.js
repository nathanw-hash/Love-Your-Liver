// =============================================================================
// PDF deliverables - generated PDF files via pdfmake (Milestone 4, slice 4c+).
// Consults are remote (no paper), so deliverables are real downloadable PDFs
// rather than browser print. pdfMake + vfs_fonts are loaded as CDN script tags
// (pdfmake first, vfs second, so vfs_fonts auto-registers Roboto). This slice
// adds the SOAP note download; the handout download + email and the retirement
// of the old print path follow. Reads entirely from the frozen consult row
// (snapshot, sections, engine doses); provider name + patient DOB resolved live.
// Lives before const MARKER_ORDER - engine block untouched.
// =============================================================================

function consultPdfReady() {
  return (typeof pdfMake !== 'undefined') && pdfMake && typeof pdfMake.createPdf === 'function';
}

function consultPdfFilename(prefix, name, dateStr) {
  const safe = String(name || '').replace(/[^A-Za-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'client';
  const d = String(dateStr || consultDateToday()).slice(0, 10);
  return prefix + '-' + safe + '-' + d + '.pdf';
}

const CONSULT_PDF_STYLES = {
  brand:   { fontSize: 13, bold: true, color: '#2f6f3e' },
  title:   { fontSize: 17, bold: true, margin: [0, 2, 0, 1] },
  metaLbl: { bold: true },
  sec:     { fontSize: 11, bold: true, color: '#1d4d2a', margin: [0, 14, 0, 4] },
  secsub:  { fontSize: 8.5, color: '#777', margin: [0, 0, 0, 4] },
  k:       { color: '#444' },
  v:       { bold: true, alignment: 'right' },
  narrH:   { bold: true, fontSize: 11, margin: [0, 6, 0, 1] },
  fl:      { fontSize: 8.5, color: '#555', margin: [0, 4, 0, 0] },
  fv:      { fontSize: 10, margin: [0, 0, 0, 0] },
  foot:    { fontSize: 8.5, color: '#777', margin: [0, 16, 0, 0] }
};

function consultPdfValueTable(pairs) {
  return {
    table: {
      widths: ['*', 'auto'],
      body: pairs.map(function (p) {
        const val = consultShow(p[1]);
        return [
          { text: String(p[0]), style: 'k' },
          { text: (val === '-' ? '-' : String(val)), style: 'v' }
        ];
      })
    },
    layout: {
      hLineWidth: function (i, node) { return (i === 0 || i === node.table.body.length) ? 0 : 0.5; },
      vLineWidth: function () { return 0; },
      hLineColor: function () { return '#e6e6e6'; },
      paddingTop: function () { return 3; },
      paddingBottom: function () { return 3; },
      paddingLeft: function () { return 0; },
      paddingRight: function () { return 0; }
    },
    margin: [0, 2, 0, 6]
  };
}

function consultPdfNarr(key, sx) {
  const meta = (typeof CONSULT_SECTIONS !== 'undefined' ? CONSULT_SECTIONS : [])
    .find(function (s) { return s.key === key; });
  const label = meta ? meta.label : key;
  const v = sx[key] || {};
  const fld = function (l, val) {
    const has = val && String(val).trim();
    return [
      { text: l, style: 'fl' },
      { text: has ? String(val) : '-', style: 'fv' }
    ];
  };
  let stack = [{ text: label, style: 'narrH' }];
  stack = stack.concat(fld('Impression', v.impression))
               .concat(fld('Changes', v.changes))
               .concat(fld('Retest interval', v.retest_interval));
  return { stack: stack, margin: [0, 2, 0, 2] };
}

function consultNoteDocDef(row, authorName, dob) {
  const snap  = row.snapshot || {};
  const blood = snap.blood || null;
  const hair  = snap.hair  || null;
  const labs  = combineLabs(blood, hair);
  const sx    = consultNormalizeSections(row.sections);
  const eng   = snap.engine || {};
  const name  = consultPatientName(row);
  const tox   = labs.hair_toxics || {};

  const meta = [];
  meta.push({ text: [{ text: 'Patient: ', style: 'metaLbl' }, name] });
  if (dob) meta.push({ text: [{ text: 'Date of birth: ', style: 'metaLbl' }, dob] });
  meta.push({ text: [{ text: 'Consultation date: ', style: 'metaLbl' }, row.consult_date || '-'] });
  if (row.finalized_at) meta.push({ text: [{ text: 'Finalized: ', style: 'metaLbl' }, String(row.finalized_at).slice(0, 10)] });
  if (authorName) meta.push({ text: [{ text: 'Provider: ', style: 'metaLbl' }, authorName] });

  const doses = eng.supplement_doses || [];
  const dosesContent = doses.length
    ? doses.map(function (d) {
        const inner = [{ text: d.supplement + (d.dose ? ' - ' + d.dose : ''), bold: true }];
        if (d.instructions) inner.push({ text: String(d.instructions), style: 'fv' });
        return { stack: inner, margin: [0, 4, 0, 0] };
      })
    : [{ text: 'None.', style: 'fv' }];

  const content = [];
  content.push({ text: 'Nutrition Detective', style: 'brand' });
  content.push({ text: 'Clinical Note', style: 'title' });
  content.push({ stack: meta, margin: [0, 2, 0, 8] });

  content.push({ text: 'Discussion notes', style: 'sec' });
  content.push({ text: (row.discussion_notes && row.discussion_notes.trim()) ? String(row.discussion_notes) : '-', style: 'fv' });

  content.push({ text: 'Blood test results', style: 'sec' });
  if (blood && blood.test_date) content.push({ text: 'Tested ' + blood.test_date, style: 'secsub' });
  content.push(consultPdfValueTable([
    ['Serum retinol (Vitamin A)', labs.serum_retinol],
    ['Ferritin', labs.ferritin],
    ['Copper', labs.blood_copper],
    ['Zinc', labs.blood_zinc]
  ]));
  content.push(consultPdfNarr('vitamin_a', sx));
  content.push(consultPdfNarr('iron', sx));

  content.push({ text: 'Hair test results', style: 'sec' });
  if (hair && hair.test_date) content.push({ text: 'Tested ' + hair.test_date, style: 'secsub' });
  content.push(consultPdfValueTable([
    ['Calcium', labs.hair_calcium],
    ['Magnesium', labs.hair_magnesium],
    ['Ca/Mg ratio', consultRatio(labs.hair_calcium, labs.hair_magnesium)],
    ['Copper', labs.hair_copper],
    ['Zinc', labs.hair_zinc],
    ['Zn/Cu ratio', consultRatio(labs.hair_zinc, labs.hair_copper)],
    ['Phosphorus', labs.hair_phosphorus],
    ['Selenium', labs.hair_selenium],
    ['Molybdenum', labs.hair_molybdenum]
  ]));
  content.push(consultPdfNarr('copper_zinc', sx));

  content.push({ text: 'Toxic elements', style: 'sec' });
  content.push(consultPdfValueTable([
    ['Aluminum', tox.aluminum], ['Arsenic', tox.arsenic], ['Cadmium', tox.cadmium],
    ['Lead', tox.lead], ['Mercury', tox.mercury], ['Uranium', tox.uranium]
  ]));
  content.push(consultPdfNarr('toxics', sx));

  content.push({ text: 'Supplement recommendations', style: 'sec' });
  content.push({ stack: dosesContent });

  content.push({ text: 'Nutrition Detective - Clinical Note. ' + name + ', consultation ' + (row.consult_date || '') + '.', style: 'foot' });

  return {
    pageSize: 'LETTER',
    pageMargins: [54, 54, 54, 54],
    defaultStyle: { font: 'Roboto', fontSize: 10.5, lineHeight: 1.2, color: '#111' },
    styles: CONSULT_PDF_STYLES,
    content: content
  };
}

async function consultDownloadNote(id) {
  const row = (_consultRows || []).find(function (r) { return String(r.id) === String(id); });
  if (!row) { if (typeof toast === 'function') toast('Open a finalized consult to download.'); return; }
  if (!consultPdfReady()) { if (typeof toast === 'function') toast('PDF library still loading - try again in a moment.'); return; }
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
  const name = consultPatientName(row);
  const fname = consultPdfFilename('SOAP-note', name, row.consult_date);
  try {
    pdfMake.createPdf(consultNoteDocDef(row, authorName, dob)).download(fname);
  } catch (e) {
    console.error('[consult] note pdf failed:', e);
    if (typeof toast === 'function') toast('Could not generate the PDF.');
  }
}
