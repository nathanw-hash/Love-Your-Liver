#!/usr/bin/env python3
# apply_consult_finalize.py - Milestone 3, slice 3c (finalize + snapshot)
# Run once. Exact-match anchors consumed; a second run aborts cleanly.
# Preserves UTF-8 BOM + CRLF. All edits sit before const MARKER_ORDER, so the
# engine slice stays byte-identical.
import sys

HTML = 'index.html'
FINALIZE_SRC = 'consult_finalize.js'

raw = open(HTML, 'rb').read()
has_bom = raw.startswith(b'\xef\xbb\xbf')
text = raw.decode('utf-8-sig')
if '\r\n' not in text:
    sys.exit('ABORT: expected CRLF line endings in index.html')
NL = '\r\n'

def to_crlf(s):
    return s.replace('\r\n', '\n').replace('\r', '\n').replace('\n', NL)

def replace_once(s, old, new, label):
    n = s.count(old)
    if n != 1:
        sys.exit('ABORT: anchor [%s] matched %d times (expected 1)' % (label, n))
    return s.replace(old, new)

# --- 1) Final branch: replace the 3c stub with the frozen read-only render ----
final_old = to_crlf(
    "  if (row.status === 'final') {\n"
    "    _consultOpenId = null;\n"
    "    consultClearDirty();\n"
    "    ed.innerHTML =\n"
    "      '<div class=\"card-title\" style=\"margin:0 0 6px;\">Consultation - ' + consultEsc(row.consult_date) + ' (final)</div>' +\n"
    "      '<p style=\"color:var(--text3);font-size:14px;line-height:1.6;\">Read-only snapshot view lands in slice 3c. ' +\n"
    "      'It will render the frozen snapshot captured at finalize, not live labs.</p>';\n"
    "    ed.scrollIntoView({ behavior: 'smooth', block: 'nearest' });\n"
    "    return;\n"
    "  }")
final_new = to_crlf(
    "  if (row.status === 'final') {\n"
    "    _consultOpenId = null;\n"
    "    consultClearDirty();\n"
    "    ed.innerHTML =\n"
    "      '<div class=\"card-title\" style=\"margin:0 0 2px;\">Consultation - ' + consultEsc(row.consult_date) + ' (final)</div>' +\n"
    "      (row.finalized_at ? '<div style=\"font-size:12px;color:var(--text3);margin:0 0 8px;\">Finalized ' + consultEsc(String(row.finalized_at).slice(0, 10)) + '</div>' : '') +\n"
    "      consultFinalNoteHtml(row) +\n"
    "      '<div style=\"margin-top:18px;padding-top:14px;border-top:1px solid var(--border);\">' +\n"
    "        '<div style=\"font-weight:700;font-size:14px;color:var(--text);margin-bottom:8px;\">Snapshot at finalize</div>' +\n"
    "        '<div id=\"consult-final-context\"></div>' +\n"
    "      '</div>';\n"
    "    const snap = row.snapshot || {};\n"
    "    const cEl = document.getElementById('consult-final-context');\n"
    "    if (cEl) {\n"
    "      const sBlood = snap.blood || null, sHair = snap.hair || null;\n"
    "      const sRec = snap.engine || { findings: [], priority_actions: [], supplement_doses: [] };\n"
    "      consultBuildContext(cEl, combineLabs(sBlood, sHair), sRec, sBlood, sHair);\n"
    "    }\n"
    "    ed.scrollIntoView({ behavior: 'smooth', block: 'nearest' });\n"
    "    return;\n"
    "  }")
text = replace_once(text, final_old, final_new, 'final-branch-render')

# --- 2) Draft action row: add Finalize beside Save draft ---------------------
btn_old = to_crlf(
    "    '<div style=\"margin-top:20px;\">' +\n"
    "      '<button class=\"btn btn-accent\" id=\"consult-save-btn\" onclick=\"consultSaveDraft()\">Save draft</button>' +\n"
    "    '</div>';")
btn_new = to_crlf(
    "    '<div style=\"margin-top:20px;display:flex;gap:10px;\">' +\n"
    "      '<button class=\"btn btn-accent\" id=\"consult-save-btn\" onclick=\"consultSaveDraft()\">Save draft</button>' +\n"
    "      '<button class=\"btn btn-outline\" id=\"consult-finalize-btn\" onclick=\"consultFinalize()\">Finalize</button>' +\n"
    "    '</div>';")
text = replace_once(text, btn_old, btn_new, 'draft-action-row')

# --- 3) Insert finalize/snapshot functions before MARKER_ORDER ---------------
fin = to_crlf(open(FINALIZE_SRC, 'rb').read().decode('utf-8')).rstrip(NL)
marker = 'const MARKER_ORDER = ['
if text.count(marker) != 1:
    sys.exit('ABORT: MARKER_ORDER anchor matched %d times (expected 1)' % text.count(marker))
text = text.replace(marker, fin + NL + NL + marker)

out = text.encode('utf-8')
if has_bom:
    out = b'\xef\xbb\xbf' + out
open(HTML, 'wb').write(out)
print('OK: applied slice 3c (3 edits).')
