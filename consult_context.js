// =============================================================================
// Consultation workspace - read-only context pane (Milestone 3, slice 2)
// Isolated from renderReport: own consult-* container ids and consult* globals.
// Reuses the existing data path (latest blood + hair + profile -> combineLabs
// -> generateRecommendationsV2). Does NOT touch the engine block or renderReport.
// =============================================================================
let _consultLoading = false;

async function renderConsultContext() {
  const emptyEl = document.getElementById('consult-empty');
  const ctxEl   = document.getElementById('consult-context');
  if (!ctxEl) return;
  if (_consultLoading) return;
  _consultLoading = true;
  ctxEl.style.display = 'none';
  if (emptyEl) { emptyEl.style.display = 'block'; emptyEl.textContent = 'Loading consult context...'; }
  try {
    const uid = getActiveLabUserId();
    if (!uid) {
      if (emptyEl) emptyEl.textContent = 'Pick a client from the selector above to load their consult context.';
      return;
    }
    const { data: bloodArr } = await dbSelect('blood_tests', { user_id: 'eq.' + uid, order: 'test_date.desc', limit: '1' });
    const { data: hairArr }  = await dbSelect('hair_tests',  { user_id: 'eq.' + uid, order: 'test_date.desc', limit: '1' });
    const blood = Array.isArray(bloodArr) && bloodArr[0] ? bloodArr[0] : null;
    const hair  = Array.isArray(hairArr)  && hairArr[0]  ? hairArr[0]  : null;
    const { data: profileData } = await dbSelect('profiles', { user_id: 'eq.' + uid });
    const profile = Array.isArray(profileData) ? (profileData[0] || {}) : (profileData || {});
    const combined = combineLabs(blood, hair);
    const rec = generateRecommendationsV2(combined, profile, engineData);
    consultBuildContext(ctxEl, combined, rec, blood, hair);
    if (emptyEl) emptyEl.style.display = 'none';
    ctxEl.style.display = 'block';
  } catch (err) {
    console.error('[consult] context load failed:', err);
    if (emptyEl) { emptyEl.style.display = 'block'; emptyEl.textContent = 'Could not load consult context.'; }
  } finally {
    _consultLoading = false;
  }
}

function consultEsc(v) {
  return String(v == null ? '' : v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function consultShow(v) {
  return (v === null || v === undefined || v === '') ? '-' : v;
}

function consultRatio(a, b) {
  if (a == null || b == null || Number(b) === 0) return null;
  return Math.round((Number(a) / Number(b)) * 100) / 100;
}

function consultRows(pairs) {
  return pairs.map(function (p) {
    return '<div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--border);font-size:14px;">' +
             '<span style="color:var(--text2);">' + consultEsc(p[0]) + '</span>' +
             '<span style="font-weight:600;">' + consultEsc(consultShow(p[1])) + '</span>' +
           '</div>';
  }).join('');
}

function consultBuildContext(el, labs, rec, blood, hair) {
  let dateHeader;
  if (blood && hair)      dateHeader = 'Blood ' + consultEsc(blood.test_date) + ' / Hair ' + consultEsc(hair.test_date);
  else if (blood)         dateHeader = 'Blood ' + consultEsc(blood.test_date);
  else if (hair)          dateHeader = 'Hair ' + consultEsc(hair.test_date);
  else                    dateHeader = 'No labs on file';

  const bloodRows = [
    ['Serum retinol', labs.serum_retinol],
    ['Ferritin',      labs.ferritin],
    ['Blood copper',  labs.blood_copper],
    ['Blood zinc',    labs.blood_zinc]
  ];

  const hairRows = [
    ['Calcium',     labs.hair_calcium],
    ['Magnesium',   labs.hair_magnesium],
    ['Ca/Mg ratio', consultRatio(labs.hair_calcium, labs.hair_magnesium)],
    ['Copper',      labs.hair_copper],
    ['Zinc',        labs.hair_zinc],
    ['Zn/Cu ratio', consultRatio(labs.hair_zinc, labs.hair_copper)],
    ['Phosphorus',  labs.hair_phosphorus],
    ['Selenium',    labs.hair_selenium],
    ['Molybdenum',  labs.hair_molybdenum]
  ];

  const toxics = labs.hair_toxics || {};
  const toxicKeys = ['aluminum', 'arsenic', 'cadmium', 'lead', 'mercury', 'uranium'];
  const toxicRows = toxicKeys.map(function (k) {
    return [k.charAt(0).toUpperCase() + k.slice(1), toxics[k]];
  });

  const findingsHtml = (rec.findings || []).map(function (f) {
    const st = f.status || '';
    return '<div class="metric-card ' + consultEsc(st) + '">' +
             '<div class="metric-label">' + consultEsc(f.marker) + '</div>' +
             '<div class="metric-value">' + consultEsc(f.value) +
               (f.unit ? ' <span style="font-size:13px;font-weight:400">' + consultEsc(f.unit) + '</span>' : '') +
             '</div>' +
             '<div class="metric-status">' + consultEsc(st.charAt(0).toUpperCase() + st.slice(1)) + '</div>' +
           '</div>';
  }).join('');

  const priorityColor = function (p) {
    return p === 'urgent' ? 'urgent' : p === 'action' ? 'action' : p === 'watch' ? 'watch' : 'info';
  };
  const actionsHtml = (rec.priority_actions || []).map(function (a) {
    return '<div class="rec-item ' + priorityColor(a.priority) + '">' +
             '<div class="rec-title">' + consultEsc(a.title) + '</div>' +
             '<div class="rec-body">' + consultEsc(a.body).replace(/\n/g, '<br>') + '</div>' +
           '</div>';
  }).join('');

  let dosesHtml = '';
  if ((rec.supplement_doses || []).length) {
    dosesHtml = '<div class="card"><div class="card-title">Personalized supplement doses</div>' +
      rec.supplement_doses.map(function (d) {
        return '<div style="padding:14px 0;border-bottom:1px solid var(--border);">' +
                 '<div style="font-weight:600;font-size:15px;margin-bottom:4px">' + consultEsc(d.supplement) + ' - ' + consultEsc(d.dose) + '</div>' +
                 '<div style="font-size:13px;color:var(--text2)">' + consultEsc(d.instructions) + '</div>' +
               '</div>';
      }).join('') + '</div>';
  }

  el.innerHTML =
    '<div class="card"><div class="card-title">Labs on file - ' + dateHeader + '</div></div>' +
    '<div class="card"><div class="card-title">Blood</div>' + consultRows(bloodRows) + '</div>' +
    '<div class="card"><div class="card-title">Hair - nutritional elements</div>' + consultRows(hairRows) + '</div>' +
    '<div class="card"><div class="card-title">Hair - toxic elements</div>' + consultRows(toxicRows) + '</div>' +
    '<div class="card"><div class="card-title">Engine findings</div><div class="metric-grid">' +
      (findingsHtml || '<p style="color:var(--text3);font-size:14px">No findings.</p>') + '</div></div>' +
    '<div class="card"><div class="card-title">Recommendations</div>' +
      (actionsHtml || '<p style="color:var(--text3);font-size:14px">No specific actions flagged.</p>') + '</div>' +
    dosesHtml;
}
