#!/usr/bin/env python3
# Adds intake-for-a-client: admins can edit / submit a client's intake on the
# Client Intake tab. UI-only (index.html); the shared renderer and the engine
# are untouched. Self Intake tab (initIntake/completeIntake/reopenIntake) is
# left exactly as-is.
#
# index.html is UTF-8 BOM + CRLF. We read/write encoding='utf-8-sig',
# newline='' (preserves the BOM and the existing line endings) and detect the
# newline rather than assuming. Each anchor must match exactly once or we abort.
import sys

path = sys.argv[1] if len(sys.argv) > 1 else 'index.html'

with open(path, 'r', encoding='utf-8-sig', newline='') as f:
    data = f.read()

nl = '\r\n' if '\r\n' in data else '\n'

def to_nl(s):
    # source literals below use \n; normalise to the file's newline
    return s.replace('\r\n', '\n').replace('\n', nl)

edits = []

# ---- 1. Markup: status span + footer + softened subtitle on the panel ----
edits.append((r"""    <!-- CLIENT INTAKE (provider read-only) TAB -->
    <div class="panel" id="panel-clientintake">
      <div class="card">
        <div class="card-title">Client intake (read-only)</div>
        <p style="color:var(--muted,#666);font-size:14px;margin:6px 0 16px;">The selected client's submitted intake. Pick a client from the menu above. This view is read-only.</p>
        <div id="clientintake-root"></div>
      </div>
    </div>""",
r"""    <!-- CLIENT INTAKE (provider read-only; admin can edit on behalf) TAB -->
    <div class="panel" id="panel-clientintake">
      <div class="card">
        <div class="card-title" style="display:flex;justify-content:space-between;align-items:center;">
          <span>Client intake</span>
          <span id="clientintake-status" style="font-size:12px;font-weight:500;color:var(--muted,#888);"></span>
        </div>
        <p style="color:var(--muted,#666);font-size:14px;margin:6px 0 16px;">The selected client's intake. Pick a client from the menu above. Admins can edit or submit on the client's behalf.</p>
        <div id="clientintake-root"></div>
        <div id="clientintake-footer" style="margin-top:16px;"></div>
      </div>
    </div>"""))

# ---- 2. State: parallel handle for the client-edit session ----
edits.append((r"""let _intakeCompletedId = null;""",
r"""let _intakeCompletedId = null;
let _clientIntakeHandle = null;"""))

# ---- 3. signOut: reset the new handle too ----
edits.append((r"""  _currentProfileId = null; _currentClientId = null; _intakeMounted = false; _activeLabUserId = null; _activeClientId = null;""",
r"""  _currentProfileId = null; _currentClientId = null; _intakeMounted = false; _activeLabUserId = null; _activeClientId = null; _clientIntakeHandle = null;"""))

# ---- 4. loadClientIntake rewrite + editClientIntake + submitClientIntake ----
edits.append((r"""async function loadClientIntake() {
  const root = document.getElementById('clientintake-root');
  if (!root) return;
  const esc = str => String(str == null ? '' : str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  const cid = await getActiveClientId();
  if (!cid) { root.innerHTML = '<p style="color:var(--muted,#666)">No client selected.</p>'; return; }
  root.innerHTML = '<p style="color:var(--muted,#666)">Loading...</p>';
  const { data, error } = await dbSelect('intake_submissions', { client_id: 'eq.' + cid, order: 'created_at.desc', limit: '1' });
  if (error) { root.innerHTML = '<p style="color:var(--red,#8a1f1f)">Could not load intake (' + esc(error.message || 'permission or network error') + ').</p>'; return; }
  const sub = Array.isArray(data) ? data[0] : data;
  if (!sub) { root.innerHTML = '<p style="color:var(--muted,#666)">This client has not started an intake yet.</p>'; return; }
root.innerHTML = intakeSubmissionHTML(sub);
}""",
r"""async function loadClientIntake() {
  const root = document.getElementById('clientintake-root');
  const footer = document.getElementById('clientintake-footer');
  const statusEl = document.getElementById('clientintake-status');
  if (!root) return;
  _clientIntakeHandle = null;
  if (statusEl) statusEl.textContent = '';
  if (footer) footer.innerHTML = '';
  const esc = str => String(str == null ? '' : str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  const cid = await getActiveClientId();
  if (!cid) { root.innerHTML = '<p style="color:var(--muted,#666)">No client selected.</p>'; return; }
  root.innerHTML = '<p style="color:var(--muted,#666)">Loading...</p>';
  const { data, error } = await dbSelect('intake_submissions', { client_id: 'eq.' + cid, order: 'created_at.desc', limit: '1' });
  if (error) { root.innerHTML = '<p style="color:var(--red,#8a1f1f)">Could not load intake (' + esc(error.message || 'permission or network error') + ').</p>'; return; }
  const sub = Array.isArray(data) ? data[0] : data;
  if (!sub) {
    root.innerHTML = '<p style="color:var(--muted,#666)">This client has not started an intake yet.</p>';
    if (footer && isAdminUser) footer.innerHTML = '<button class="btn btn-accent" onclick="editClientIntake()">Start intake for this client</button>';
    return;
  }
  root.innerHTML = intakeSubmissionHTML(sub);
  if (footer && isAdminUser) footer.innerHTML = '<button class="btn btn-outline" onclick="editClientIntake()">Edit this client\'s intake</button>';
}

async function editClientIntake() {
  if (!isAdminUser) return;
  const root = document.getElementById('clientintake-root');
  const footer = document.getElementById('clientintake-footer');
  const statusEl = document.getElementById('clientintake-status');
  if (!root) return;
  const cid = await getActiveClientId();
  if (!cid) { toast('No client selected.'); return; }
  // If the latest submission is completed, reopen it in place (flip to
  // in_progress) so we edit the SAME row instead of spawning a duplicate
  // (intake_submissions has no UNIQUE on client_id).
  const { data } = await dbSelect('intake_submissions', { client_id: 'eq.' + cid, order: 'updated_at.desc', limit: '1' });
  const latest = Array.isArray(data) ? data[0] : data;
  if (latest && latest.status === 'completed') {
    const { error } = await dbUpdate('intake_submissions', latest.id, { status: 'in_progress', completed_at: null });
    if (error) { toast('Could not re-open this client\'s intake. Please try again.'); return; }
  }
  root.innerHTML = '';
  _clientIntakeHandle = await window.LYLIntakeRenderer.mount({
    db: { select: dbSelect, insert: dbInsert, update: dbUpdate },
    clientId: cid,
    mountEl: root,
    form: window.LYL_INTAKE,
    sectionIds: window.LYL_INTAKE.sections.map(s => s.id),
    onStatus: function (s) {
      if (!statusEl) return;
      statusEl.textContent = s === 'saving' ? 'Saving...' : s === 'saved' ? 'Saved' : s === 'error' ? 'Save failed' : '';
    }
  });
  if (footer) footer.innerHTML = '<button class="btn btn-accent" onclick="submitClientIntake()">Submit on behalf</button>' +
    '<button class="btn btn-outline" style="margin-left:10px;" onclick="loadClientIntake()">Done (back to read-only)</button>' +
    '<span style="margin-left:10px;font-size:12px;color:var(--muted,#888);">Editing as admin &middot; changes autosave.</span>';
}

async function submitClientIntake() {
  if (!_clientIntakeHandle || !_clientIntakeHandle.submissionId) return;
  const scope = document.getElementById('panel-clientintake') || document;
  const emailEl = scope.querySelector('#iq_email');
  const cc1El = scope.querySelector('#iq_cc_1');
  if ((!emailEl || !emailEl.value.trim()) || (!cc1El || !cc1El.value.trim())) {
    toast('Please fill in the client\'s email and first main concern before submitting.');
    return;
  }
  try {
    if (_clientIntakeHandle.flush) await _clientIntakeHandle.flush();
    const { error } = await dbUpdate('intake_submissions', _clientIntakeHandle.submissionId, { status: 'completed', completed_at: new Date().toISOString() });
    if (error) { toast('Could not submit intake. Please try again.'); return; }
    _clientIntakeHandle = null;
    await loadClientIntake();
  } catch (e) {
    toast('Could not submit intake. Please try again.');
  }
}"""))

for i, (old, new) in enumerate(edits, 1):
    old_n = to_nl(old)
    new_n = to_nl(new)
    c = data.count(old_n)
    if c != 1:
        raise SystemExit('ANCHOR %d matched %d times (expected 1) -- aborting, no write.' % (i, c))
    data = data.replace(old_n, new_n)

with open(path, 'w', encoding='utf-8-sig', newline='') as f:
    f.write(data)

print('OK: applied %d edits to %s' % (len(edits), path))
