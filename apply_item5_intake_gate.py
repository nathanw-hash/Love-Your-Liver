#!/usr/bin/env python3
# LYL Week-4 item 5: gate the self-fill Intake tab on completion.
#  - host-side "Submit intake" -> status=completed, completed_at (validates email + cc_1)
#  - completed -> locked read-only view (shared intakeSubmissionHTML) + "Edit again"
#  - "Edit again" -> status=in_progress, completed_at=null -> editable again (same row resumes)
#  - loadClientIntake refactored to reuse the shared renderer (one source of truth)
#  - tidy the now-stale NEEDS YOUR INPUT note in intake_form.js
# Exact-match asserts; writes nothing unless every edit matches once.
# index.html: UTF-8 BOM + CRLF.  intake_form.js: UTF-8 no BOM (endings detected).
import sys

def replace_once(data, old, new, desc):
    n = data.count(old)
    if n != 1:
        print("ABORT [%s]: expected 1 match, found %d" % (desc, n)); sys.exit(1)
    print("ok  [%s]" % desc)
    return data.replace(old, new, 1)

# ============================ index.html =====================================
PATH = 'index.html'
data = open(PATH, 'r', encoding='utf-8-sig', newline='').read()
NL = '\r\n' if '\r\n' in data else '\n'
def nl(s): return s.replace('\n', NL)

INIT_OLD = nl(
"let _intakeMounted = false;\n"
"async function initIntake() {\n"
"  if (_intakeMounted) return;\n"
"  const root = document.getElementById('intake-root');\n"
"  const statusEl = document.getElementById('intake-status');\n"
"  if (!root) return;\n"
"  const clientId = await getCurrentClientId();\n"
"  if (!clientId) {\n"
"    root.innerHTML = '<p style=\"color:var(--red,#8a1f1f)\">We could not find your client record yet. Please contact your provider.</p>';\n"
"    return;\n"
"  }\n"
"  _intakeMounted = true;\n"
"  window.LYLIntakeRenderer.mount({\n"
"    db: { select: dbSelect, insert: dbInsert, update: dbUpdate },\n"
"    clientId: clientId,\n"
"    mountEl: root,\n"
"    form: window.LYL_INTAKE,\n"
"    sectionIds: window.LYL_INTAKE.sections.map(s => s.id),\n"
"    onStatus: function (s) {\n"
"      if (!statusEl) return;\n"
"      statusEl.textContent = s === 'saving' ? 'Saving...' : s === 'saved' ? 'Saved' : s === 'error' ? 'Save failed' : '';\n"
"    }\n"
"  });\n"
"}"
)
INIT_NEW = nl(
"let _intakeMounted = false;\n"
"let _intakeHandle = null;\n"
"let _intakeCompletedId = null;\n"
"\n"
"function intakeSubmissionHTML(sub) {\n"
"  const esc = str => String(str == null ? '' : str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');\n"
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
"  return html;\n"
"}\n"
"\n"
"async function initIntake() {\n"
"  const root = document.getElementById('intake-root');\n"
"  const footer = document.getElementById('intake-footer');\n"
"  const statusEl = document.getElementById('intake-status');\n"
"  if (!root) return;\n"
"  const clientId = await getCurrentClientId();\n"
"  if (!clientId) {\n"
"    root.innerHTML = '<p style=\"color:var(--red,#8a1f1f)\">We could not find your client record yet. Please contact your provider.</p>';\n"
"    if (footer) footer.innerHTML = '';\n"
"    return;\n"
"  }\n"
"  const { data } = await dbSelect('intake_submissions', { client_id: 'eq.' + clientId, order: 'updated_at.desc', limit: '1' });\n"
"  const latest = Array.isArray(data) ? data[0] : data;\n"
"  if (latest && latest.status === 'completed') {\n"
"    _intakeMounted = false;\n"
"    _intakeCompletedId = latest.id;\n"
"    if (statusEl) statusEl.textContent = 'Submitted';\n"
"    root.innerHTML = '<p style=\"color:var(--muted,#666);font-size:14px;margin:0 0 16px;\">You have submitted your intake. It is locked for your provider to review. You can re-open it if you need to make changes.</p>' + intakeSubmissionHTML(latest);\n"
"    if (footer) footer.innerHTML = '<button class=\"btn btn-outline\" onclick=\"reopenIntake()\">Edit again</button>';\n"
"    return;\n"
"  }\n"
"  if (_intakeMounted) return;\n"
"  _intakeMounted = true;\n"
"  _intakeHandle = await window.LYLIntakeRenderer.mount({\n"
"    db: { select: dbSelect, insert: dbInsert, update: dbUpdate },\n"
"    clientId: clientId,\n"
"    mountEl: root,\n"
"    form: window.LYL_INTAKE,\n"
"    sectionIds: window.LYL_INTAKE.sections.map(s => s.id),\n"
"    onStatus: function (s) {\n"
"      if (!statusEl) return;\n"
"      statusEl.textContent = s === 'saving' ? 'Saving...' : s === 'saved' ? 'Saved' : s === 'error' ? 'Save failed' : '';\n"
"    }\n"
"  });\n"
"  if (footer) footer.innerHTML = '<button class=\"btn btn-accent\" onclick=\"completeIntake()\">Submit intake</button><span style=\"margin-left:10px;font-size:12px;color:var(--muted,#888);\">You can keep editing until you submit.</span>';\n"
"}\n"
"\n"
"async function completeIntake() {\n"
"  if (!_intakeHandle || !_intakeHandle.submissionId) return;\n"
"  const emailEl = document.getElementById('iq_email');\n"
"  const cc1El = document.getElementById('iq_cc_1');\n"
"  if ((!emailEl || !emailEl.value.trim()) || (!cc1El || !cc1El.value.trim())) {\n"
"    toast('Please fill in your email and your first main concern before submitting.');\n"
"    return;\n"
"  }\n"
"  try {\n"
"    if (_intakeHandle.flush) await _intakeHandle.flush();\n"
"    const { error } = await dbUpdate('intake_submissions', _intakeHandle.submissionId, { status: 'completed', completed_at: new Date().toISOString() });\n"
"    if (error) { toast('Could not submit intake. Please try again.'); return; }\n"
"    _intakeMounted = false;\n"
"    _intakeHandle = null;\n"
"    await initIntake();\n"
"  } catch (e) {\n"
"    toast('Could not submit intake. Please try again.');\n"
"  }\n"
"}\n"
"\n"
"async function reopenIntake() {\n"
"  if (!_intakeCompletedId) return;\n"
"  const { error } = await dbUpdate('intake_submissions', _intakeCompletedId, { status: 'in_progress', completed_at: null });\n"
"  if (error) { toast('Could not re-open intake. Please try again.'); return; }\n"
"  _intakeCompletedId = null;\n"
"  _intakeMounted = false;\n"
"  _intakeHandle = null;\n"
"  await initIntake();\n"
"}"
)

# Edit 2 FIRST: while loadClientIntake's render block is still the only copy of these
# markers (initIntake's replacement below adds a second copy via intakeSubmissionHTML).
S = nl("  const answers = sub.answers || {};")
E = nl("  root.innerHTML = html;")
if data.count(S) != 1 or data.count(E) != 1:
    print("ABORT [2 loadClientIntake refactor]: markers not unique"); sys.exit(1)
si = data.find(S); ei = data.find(E) + len(E)
if not (0 <= si < ei):
    print("ABORT [2 loadClientIntake refactor]: bad span"); sys.exit(1)
data = data[:si] + nl("root.innerHTML = intakeSubmissionHTML(sub);") + data[ei:]
print("ok  [2 loadClientIntake reuses shared renderer]")

data = replace_once(data, INIT_OLD, INIT_NEW, "1 initIntake gate + complete/reopen + shared renderer")

# Edit 3: add intake-footer to the panel
F_OLD = nl('      <div id="intake-root"></div>')
F_NEW = F_OLD + nl('\n      <div id="intake-footer" style="margin-top:16px;"></div>')
data = replace_once(data, F_OLD, F_NEW, "3 intake-footer in panel")

open(PATH, 'w', encoding='utf-8-sig', newline='').write(data)

# ============================ intake_form.js =================================
PATH2 = 'intake_form.js'
d2 = open(PATH2, 'r', encoding='utf-8', newline='').read()
NL2 = '\r\n' if '\r\n' in d2 else '\n'
def nl2(s): return s.replace('\n', NL2)

NOTE_OLD = nl2(
" *    as-is (only its symptom options + Other). Flag if you want a \"None\" added.\n"
" *\n"
" * NEEDS YOUR INPUT:\n"
" *  - The four vitals help links (pulse / respiratory rate / BP / temperature)\n"
" *    have empty url:'' \u2014 paste the real URLs from the Google Form when handy.\n"
" * ==========================================================================*/"
)
NOTE_NEW = nl2(
" *    as-is (only its symptom options + Other). Flag if you want a \"None\" added.\n"
" * ==========================================================================*/"
)
n2 = d2.count(NOTE_OLD)
if n2 != 1:
    print("ABORT [4 intake_form.js note tidy]: expected 1 match, found %d" % n2); sys.exit(1)
d2 = d2.replace(NOTE_OLD, NOTE_NEW, 1)
print("ok  [4 intake_form.js stale note removed]")
open(PATH2, 'w', encoding='utf-8', newline='').write(d2)

print("--- item 5 applied: index.html (3 edits) + intake_form.js (1 edit) ---")
