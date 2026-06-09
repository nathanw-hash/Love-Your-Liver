// =============================================================================
// Consultation workspace - draft lifecycle / list (Milestone 3, slice 3a)
// A client's consultations + "New consult", backed by the `consultations`
// table (RLS: select/insert on is_admin(); update/delete drafts only). The
// subject resolves via getActiveClientId() -> clients.id, the same path the
// rest of the workspace uses; author is the provider's profile id. The editor
// fields (3b) and the immutable snapshot view (3c) land next - this slice wires
// the list, draft creation, one-draft-per-client resume, and draft/final
// routing. Isolated _consult* globals; does not touch the engine block.
// =============================================================================
let _consultListLoading = false;
let _consultRows = [];        // last-loaded rows for the active client (in-memory)
let _consultClientId = null;  // client_id the current list belongs to

function consultDateToday() {
  const d = new Date();
  const p = function (n) { return String(n).padStart(2, '0'); };
  return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
}

function consultStatusBadge(status) {
  const isFinal = status === 'final';
  const bg = isFinal ? 'var(--good-bg,#e7f4ea)' : 'var(--warn-bg,#fff4e0)';
  const fg = isFinal ? 'var(--good,#2f7d4f)' : 'var(--warn,#9a6a1a)';
  const label = isFinal ? 'Final' : 'Draft';
  return '<span style="font-size:11px;font-weight:700;letter-spacing:.03em;text-transform:uppercase;' +
         'padding:2px 8px;border-radius:999px;background:' + bg + ';color:' + fg + ';">' + label + '</span>';
}

async function renderConsultList() {
  const listEl = document.getElementById('consult-list');
  const newBtn = document.getElementById('consult-new-btn');
  const edEl   = document.getElementById('consult-editor');
  if (!listEl) return;
  if (_consultListLoading) return;
  _consultListLoading = true;
  if (edEl) edEl.style.display = 'none';  // collapse any open editor on (re)load
  try {
    const clientId = await getActiveClientId();
    _consultClientId = clientId || null;
    if (!clientId) {
      _consultRows = [];
      listEl.innerHTML = '<div style="color:var(--text3);font-size:14px;padding:8px 0;">Pick a client to see their consultations.</div>';
      if (newBtn) newBtn.disabled = true;
      return;
    }
    if (newBtn) newBtn.disabled = false;
    const { data, error } = await dbSelect('consultations', {
      client_id: 'eq.' + clientId,
      order: 'consult_date.desc,created_at.desc'
    });
    if (error) throw error;
    _consultRows = Array.isArray(data) ? data : [];
    if (_consultRows.length === 0) {
      listEl.innerHTML = '<div style="color:var(--text3);font-size:14px;padding:8px 0;">No consultations yet. Use New consult to start one.</div>';
      return;
    }
    listEl.innerHTML = _consultRows.map(function (r) {
      return '<button type="button" class="consult-row" onclick="consultOpen(\'' + consultEsc(r.id) + '\')" ' +
               'style="display:flex;align-items:center;justify-content:space-between;gap:10px;width:100%;text-align:left;' +
               'padding:11px 13px;margin-bottom:8px;background:var(--surface,#fff);border:1px solid var(--border);' +
               'border-radius:10px;cursor:pointer;font-family:inherit;">' +
               '<span style="font-size:14px;font-weight:600;color:var(--text);">' + consultEsc(r.consult_date || '(no date)') + '</span>' +
               consultStatusBadge(r.status) +
             '</button>';
    }).join('');
  } catch (err) {
    console.error('[consult] list load failed:', err);
    listEl.innerHTML = '<div style="color:var(--bad,#b23);font-size:14px;padding:8px 0;">Could not load consultations.</div>';
  } finally {
    _consultListLoading = false;
  }
}

async function consultNew() {
  try {
    const clientId = await getActiveClientId();
    if (!clientId) { toast('Pick a client first.'); return; }
    // One open draft per client: resume the existing draft rather than stack.
    const existingDraft = _consultRows.find(function (r) { return r.status === 'draft'; });
    if (existingDraft) {
      toast('Opening the existing draft for this client.');
      consultOpen(existingDraft.id);
      return;
    }
    const authorId = await getCurrentProfileId();
    const payload = {
      client_id: clientId,
      author_id: authorId,
      consult_date: consultDateToday(),
      status: 'draft',
      discussion_notes: '',
      sections: {}
    };
    const { data, error } = await dbInsert('consultations', payload);
    if (error) { console.error('[consult] create draft failed:', error); toast('Could not create consult.'); return; }
    await renderConsultList();
    if (data && data.id) consultOpen(data.id);
  } catch (err) {
    console.error('[consult] consultNew failed:', err);
    toast('Could not create consult.');
  }
}

function consultOpen(id) {
  const row = _consultRows.find(function (r) { return String(r.id) === String(id); });
  const ed = document.getElementById('consult-editor');
  if (!row || !ed) return;
  ed.style.display = 'block';
  // Slice 3a routing only: drafts -> editor (3b), finals -> snapshot view (3c).
  if (row.status === 'final') {
    ed.innerHTML =
      '<div class="card-title" style="margin:0 0 6px;">Consultation - ' + consultEsc(row.consult_date) + ' (final)</div>' +
      '<p style="color:var(--text3);font-size:14px;line-height:1.6;">Read-only snapshot view lands in slice 3c. ' +
      'It will render the frozen snapshot captured at finalize, not live labs.</p>';
  } else {
    ed.innerHTML =
      '<div class="card-title" style="margin:0 0 6px;">Consultation - ' + consultEsc(row.consult_date) + ' (draft)</div>' +
      '<p style="color:var(--text3);font-size:14px;line-height:1.6;">Editor fields land in slice 3b: discussion notes, ' +
      'the Vitamin A / Iron / Copper-Zinc / Toxics sections, save-draft, and finalize.</p>';
  }
  ed.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}
