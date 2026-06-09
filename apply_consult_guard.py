#!/usr/bin/env python3
# apply_consult_guard.py - Milestone 3, slice 3b.1 (unsaved-changes guard)
# Run once. Exact-match anchors are consumed; a second run aborts cleanly.
# Preserves UTF-8 BOM + CRLF. All edits sit before const MARKER_ORDER, so the
# engine slice stays byte-identical.
import sys

HTML = 'index.html'
GUARD_SRC = 'consult_guard.js'

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

# --- 1) Guard consultOpen: prompt before replacing a dirty editor ------------
text = replace_once(
    text,
    to_crlf("  if (!row || !ed) return;\n  ed.style.display = 'block';"),
    to_crlf("  if (!row || !ed) return;\n  if (!consultConfirmDiscard()) return;\n  ed.style.display = 'block';"),
    'consultOpen-guard')

# --- 2) Guard onClientPick: prompt + revert dropdown on a dirty client switch -
text = replace_once(
    text,
    to_crlf("async function onClientPick(clientId) {\n  if (!clientId) {"),
    to_crlf(
        "async function onClientPick(clientId) {\n"
        "  const _activePanel = document.querySelector('.panel.active');\n"
        "  if (_activePanel && _activePanel.id === 'panel-consult' && !consultConfirmDiscard()) {\n"
        "    const _sel = document.getElementById('client-picker');\n"
        "    if (_sel) _sel.value = _activeClientId || '';\n"
        "    return;\n"
        "  }\n"
        "  if (!clientId) {"),
    'onClientPick-guard')

# --- 3) Insert the guard helper + beforeunload listener before MARKER_ORDER --
guard = to_crlf(open(GUARD_SRC, 'rb').read().decode('utf-8')).rstrip(NL)
marker = 'const MARKER_ORDER = ['
if text.count(marker) != 1:
    sys.exit('ABORT: MARKER_ORDER anchor matched %d times (expected 1)' % text.count(marker))
text = text.replace(marker, guard + NL + NL + marker)

out = text.encode('utf-8')
if has_bom:
    out = b'\xef\xbb\xbf' + out
open(HTML, 'wb').write(out)
print('OK: applied slice 3b.1 guard (3 edits).')
