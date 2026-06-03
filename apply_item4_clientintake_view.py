#!/usr/bin/env python3
# LYL Week-4 item 4 (UI): provider-only read-only "Client Intake" view.
# Surgical edits to index.html. Preserves UTF-8 BOM + CRLF. Exact-match asserts;
# writes nothing unless all edits match exactly once. Engine block untouched.
import sys

PATH = 'index.html'
data = open(PATH, 'r', encoding='utf-8-sig', newline='').read()
NL = '\r\n' if '\r\n' in data else '\n'

def nl(s):
    return s.replace('\n', NL)

EDITS = []

# A) _activeClientId + getActiveClientId() resolver (after getActiveLabUserId)
A_old = nl(
"let _activeLabUserId = null;\n"
"function getActiveLabUserId() {\n"
"  return _activeLabUserId || (currentUser ? currentUser.id : null);\n"
"}"
)
A_new = A_old + nl(
"\n\n"
"let _activeClientId = null;\n"
"async function getActiveClientId() {\n"
"  return _activeClientId || await getCurrentClientId();\n"
"}"
)
EDITS.append(("A getActiveClientId resolver", A_old, A_new))

# B) signOut reset
B_old = nl("  _currentProfileId = null; _currentClientId = null; _intakeMounted = false; _activeLabUserId = null;")
B_new = nl("  _currentProfileId = null; _currentClientId = null; _intakeMounted = false; _activeLabUserId = null; _activeClientId = null;")
EDITS.append(("B signOut resets _activeClientId", B_old, B_new))

# C1) onClientPick clear branch
C1_old = nl(
"  if (!clientId) {\n"
"    _activeLabUserId = null;\n"
"  } else {"
)
C1_new = nl(
"  if (!clientId) {\n"
"    _activeLabUserId = null;\n"
"    _activeClientId = null;\n"
"  } else {"
)
EDITS.append(("C1 onClientPick clears _activeClientId", C1_old, C1_new))

# C2) onClientPick set branch
C2_old = nl("    _activeLabUserId = uid;")
C2_new = nl("    _activeLabUserId = uid;\n    _activeClientId = clientId;")
EDITS.append(("C2 onClientPick sets _activeClientId", C2_old, C2_new))

# C3) onClientPick refreshes the view if it is the active panel
C3_old = nl("  if (active && active.id === 'panel-report') await generateAndShowReport();")
C3_new = nl("  if (active && active.id === 'panel-report') await generateAndShowReport();\n  if (active && active.id === 'panel-clientintake') await loadClientIntake();")
EDITS.append(("C3 onClientPick refreshes client-intake", C3_old, C3_new))

# D1) showTab trigger
D1_old = nl("  if (name === 'intake' && currentUser) initIntake();")
D1_new = nl("  if (name === 'intake' && currentUser) initIntake();\n  if (name === 'clientintake' && currentUser) loadClientIntake();")
EDITS.append(("D1 showTab loads client-intake", D1_old, D1_new))

# D2) tabIndex map (new tab is the 7th .tab button -> index 6; Admin stays 5)
D2_old = nl("  const tabIndex = { profile: 0, intake: 1, labs: 2, report: 3, history: 4 }[name];")
D2_new = nl("  const tabIndex = { profile: 0, intake: 1, labs: 2, report: 3, history: 4, clientintake: 6 }[name];")
EDITS.append(("D2 tabIndex map adds clientintake", D2_old, D2_new))

# E) provider-only top tab button (after Admin)
E_old = nl('      <button class="tab admin-only" style="display:none" onclick="showTab(\'admin\')">Admin</button>')
E_new = E_old + nl('\n      <button class="tab provider-only" style="display:none" onclick="showTab(\'clientintake\')">Client Intake</button>')
EDITS.append(("E Client Intake top tab", E_old, E_new))

# F) panel markup (before LABS TAB)
F_old = nl("    <!-- LABS TAB -->")
F_new = nl(
'    <!-- CLIENT INTAKE (provider read-only) TAB -->\n'
'    <div class="panel" id="panel-clientintake">\n'
'      <div class="card">\n'
'        <div class="card-title">Client intake (read-only)</div>\n'
'        <p style="color:var(--muted,#666);font-size:14px;margin:6px 0 16px;">The selected client\'s submitted intake. Pick a client from the menu above. This view is read-only.</p>\n'
'        <div id="clientintake-root"></div>\n'
'      </div>\n'
'    </div>\n'
'\n'
'    <!-- LABS TAB -->'
)
EDITS.append(("F panel-clientintake markup", F_old, F_new))

# G) loadClientIntake() function (before logEngineEdit)
G_old = nl("async function logEngineEdit(tableName, rowId, oldRow, newValues, editorProfileId) {")
G_func = nl(
"async function loadClientIntake() {\n"
"  const root = document.getElementById('clientintake-root');\n"
"  if (!root) return;\n"
"  const esc = str => String(str == null ? '' : str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');\n"
"  const cid = await getActiveClientId();\n"
"  if (!cid) { root.innerHTML = '<p style=\"color:var(--muted,#666)\">No client selected.</p>'; return; }\n"
"  root.innerHTML = '<p style=\"color:var(--muted,#666)\">Loading...</p>';\n"
"  const { data, error } = await dbSelect('intake_submissions', { client_id: 'eq.' + cid, order: 'created_at.desc', limit: '1' });\n"
"  if (error) { root.innerHTML = '<p style=\"color:var(--red,#8a1f1f)\">Could not load intake (' + esc(error.message || 'permission or network error') + ').</p>'; return; }\n"
"  const sub = Array.isArray(data) ? data[0] : data;\n"
"  if (!sub) { root.innerHTML = '<p style=\"color:var(--muted,#666)\">This client has not started an intake yet.</p>'; return; }\n"
"  const answers = sub.answers || {};\n"
"  const fmt = v => { try { return new Date(v).toLocaleString(); } catch (_) { return String(v); } };\n"
"  const completed = sub.status === 'completed';\n"
"  const statusLabel = completed ? 'Completed' : 'In progress';\n"
"  const statusColor = completed ? 'var(--accent,#2a7d4f)' : 'var(--muted,#888)';\n"
"  const when = sub.completed_at ? ' &middot; completed ' + esc(fmt(sub.completed_at)) : (sub.started_at ? ' &middot; started ' + esc(fmt(sub.started_at)) : '');\n"
"  let html = '<div style=\"margin-bottom:14px;\">';\n"
"  html += '<span style=\"display:inline-block;padding:3px 10px;border-radius:999px;font-size:12px;font-weight:600;color:#fff;background:' + statusColor + ';\">' + esc(statusLabel) + '</span>';\n"
"  html += '<span style=\"margin-left:10px;font-size:12px;color:var(--muted,#888);\">form v' + esc(sub.form_version) + when + '</span>';\n"
"  html += '</div>';\n"
"  const form = window.LYL_INTAKE;\n"
"  const seen = {};\n"
"  (form && form.sections ? form.sections : []).forEach(sec => {\n"
"    html += '<div class=\"section-title\" style=\"margin-top:18px;\">' + esc(sec.title || sec.id) + '</div>';\n"
"    (sec.questions || []).forEach(q => {\n"
"      seen[q.id] = true;\n"
"      let v = answers[q.id];\n"
"      if (q.id === 'vitals_weight' && answers.vitals_weight_unit) v = (v == null ? '' : v) + ' ' + answers.vitals_weight_unit;\n"
"      let disp;\n"
"      if (Array.isArray(v)) disp = v.length ? v.map(esc).join(', ') : '&mdash;';\n"
"      else if (v == null || v === '') disp = '&mdash;';\n"
"      else disp = esc(v);\n"
"      html += '<div style=\"padding:8px 0;border-bottom:1px solid var(--border,#eee);\">';\n"
"      html += '<div style=\"font-size:12px;color:var(--muted,#888);margin-bottom:2px;\">' + esc(q.label || q.id) + '</div>';\n"
"      html += '<div style=\"font-size:14px;color:var(--text,#222);white-space:pre-wrap;\">' + disp + '</div>';\n"
"      html += '</div>';\n"
"    });\n"
"  });\n"
"  const extras = Object.keys(answers).filter(k => !seen[k] && k !== 'vitals_weight_unit');\n"
"  if (extras.length) {\n"
"    html += '<div class=\"section-title\" style=\"margin-top:18px;\">Other answers</div>';\n"
"    extras.forEach(k => {\n"
"      const v = answers[k];\n"
"      const disp = Array.isArray(v) ? v.map(esc).join(', ') : (v == null || v === '' ? '&mdash;' : esc(v));\n"
"      html += '<div style=\"padding:8px 0;border-bottom:1px solid var(--border,#eee);\">';\n"
"      html += '<div style=\"font-size:12px;color:var(--muted,#888);margin-bottom:2px;\">' + esc(k) + '</div>';\n"
"      html += '<div style=\"font-size:14px;color:var(--text,#222);white-space:pre-wrap;\">' + disp + '</div>';\n"
"      html += '</div>';\n"
"    });\n"
"  }\n"
"  root.innerHTML = html;\n"
"}"
)
G_new = G_func + nl("\n\n") + G_old
EDITS.append(("G loadClientIntake function", G_old, G_new))

for desc, old, new in EDITS:
    n = data.count(old)
    if n != 1:
        print("ABORT [%s]: expected 1 match, found %d" % (desc, n)); sys.exit(1)
    data = data.replace(old, new, 1)
    print("ok  [%s]" % desc)

open(PATH, 'w', encoding='utf-8-sig', newline='').write(data)
print("--- index.html: client-intake view applied (%d edits) ---" % len(EDITS))
