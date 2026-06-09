#!/usr/bin/env python3
# apply_consult_editor.py - Milestone 3, slice 3b (editor fields + save-draft)
# Run once. Exact-match anchors are consumed; a second run aborts cleanly.
# Preserves index.html's UTF-8 BOM + CRLF. All edits live in the consult block
# (before const MARKER_ORDER), so the engine slice stays byte-identical.
import sys

HTML = 'index.html'
EDITOR_SRC = 'consult_editor.js'

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

# --- 1) Hard-gate renderConsultList on a deliberately-picked client ----------
text = replace_once(
    text,
    to_crlf("    const clientId = await getActiveClientId();\n    _consultClientId = clientId || null;"),
    to_crlf("    const clientId = _activeClientId;\n    _consultClientId = clientId || null;"),
    'hardgate-list')

# --- 2) Hard-gate consultNew on a deliberately-picked client -----------------
text = replace_once(
    text,
    to_crlf("    const clientId = await getActiveClientId();\n    if (!clientId) { toast('Pick a client first.'); return; }"),
    to_crlf("    const clientId = _activeClientId;\n    if (!clientId) { toast('Pick a client first.'); return; }"),
    'hardgate-new')

# --- 3) Reset open-editor state when the list (re)loads ----------------------
text = replace_once(
    text,
    to_crlf("  if (edEl) edEl.style.display = 'none';  // collapse any open editor on (re)load"),
    to_crlf("  if (edEl) edEl.style.display = 'none';  // collapse any open editor on (re)load\n  _consultOpenId = null; _consultDirty = false;"),
    'list-reset')

# --- 4) Replace the slice-3a consultOpen stub with the 3b editor block --------
old_open = to_crlf(
    "function consultOpen(id) {\n"
    "  const row = _consultRows.find(function (r) { return String(r.id) === String(id); });\n"
    "  const ed = document.getElementById('consult-editor');\n"
    "  if (!row || !ed) return;\n"
    "  ed.style.display = 'block';\n"
    "  // Slice 3a routing only: drafts -> editor (3b), finals -> snapshot view (3c).\n"
    "  if (row.status === 'final') {\n"
    "    ed.innerHTML =\n"
    "      '<div class=\"card-title\" style=\"margin:0 0 6px;\">Consultation - ' + consultEsc(row.consult_date) + ' (final)</div>' +\n"
    "      '<p style=\"color:var(--text3);font-size:14px;line-height:1.6;\">Read-only snapshot view lands in slice 3c. ' +\n"
    "      'It will render the frozen snapshot captured at finalize, not live labs.</p>';\n"
    "  } else {\n"
    "    ed.innerHTML =\n"
    "      '<div class=\"card-title\" style=\"margin:0 0 6px;\">Consultation - ' + consultEsc(row.consult_date) + ' (draft)</div>' +\n"
    "      '<p style=\"color:var(--text3);font-size:14px;line-height:1.6;\">Editor fields land in slice 3b: discussion notes, ' +\n"
    "      'the Vitamin A / Iron / Copper-Zinc / Toxics sections, save-draft, and finalize.</p>';\n"
    "  }\n"
    "  ed.scrollIntoView({ behavior: 'smooth', block: 'nearest' });\n"
    "}")

new_block = to_crlf(open(EDITOR_SRC, 'rb').read().decode('utf-8')).rstrip(NL)
text = replace_once(text, old_open, new_block, 'consultOpen-3a-stub')

out = text.encode('utf-8')
if has_bom:
    out = b'\xef\xbb\xbf' + out
open(HTML, 'wb').write(out)
print('OK: applied slice 3b (4 edits).')
