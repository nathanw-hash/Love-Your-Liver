#!/usr/bin/env python3
# apply_consult_list.py - Milestone 3, slice 3a (consult list / draft lifecycle)
# Run once. Anchors are exact-match and consumed; a second run aborts cleanly.
# Preserves index.html's UTF-8 BOM + CRLF. Inserts new JS BEFORE const
# MARKER_ORDER so the engine slice stays byte-identical.
import sys, io

HTML = 'index.html'
JS_SRC = 'consult_list.js'

raw = open(HTML, 'rb').read()
has_bom = raw.startswith(b'\xef\xbb\xbf')
text = raw.decode('utf-8-sig')
if '\r\n' not in text:
    sys.exit('ABORT: expected CRLF line endings in index.html')
NL = '\r\n'

def replace_once(s, old, new, label):
    n = s.count(old)
    if n != 1:
        sys.exit('ABORT: anchor [%s] matched %d times (expected 1)' % (label, n))
    return s.replace(old, new)

# --- 1) HTML: swap the right-pane placeholder for the list scaffold ----------
html_old = (
    '            <div class="card-title">Consultation note</div>' + NL +
    '            <p style="color:var(--text3);font-size:14px;line-height:1.6;">Editor coming in the next slice. This pane will hold the discussion notes, the section-based impressions and changes, and the supplement picker.</p>'
)
html_new = (
    '            <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:14px;">' + NL +
    '              <div class="card-title" style="margin:0;">Consultations</div>' + NL +
    '              <button class="btn btn-outline" id="consult-new-btn" onclick="consultNew()" style="padding:7px 13px;font-size:13px;">+ New consult</button>' + NL +
    '            </div>' + NL +
    '            <div id="consult-list"><div style="color:var(--text3);font-size:14px;padding:8px 0;">Pick a client to see their consultations.</div></div>' + NL +
    '            <div id="consult-editor" style="display:none;margin-top:14px;padding-top:14px;border-top:1px solid var(--border);"></div>'
)
text = replace_once(text, html_old, html_new, 'html-placeholder')

# --- 2) showTab: also render the list on the consult tab ---------------------
show_old = "  if (name === 'consult' && currentUser) renderConsultContext();"
show_new = "  if (name === 'consult' && currentUser) { renderConsultContext(); renderConsultList(); }"
text = replace_once(text, show_old, show_new, 'showTab-consult')

# --- 3) onClientPick: refresh the consult panel on a client switch -----------
pick_old = "  if (active && active.id === 'panel-clientintake') await loadClientIntake();"
pick_new = (
    "  if (active && active.id === 'panel-clientintake') await loadClientIntake();" + NL +
    "  if (active && active.id === 'panel-consult') { renderConsultContext(); renderConsultList(); }"
)
text = replace_once(text, pick_old, pick_new, 'onClientPick-tail')

# --- 4) Insert the new JS immediately BEFORE const MARKER_ORDER --------------
js = open(JS_SRC, 'rb').read().decode('utf-8')
js = js.replace('\r\n', '\n').replace('\r', '\n').replace('\n', NL).rstrip(NL)
marker = 'const MARKER_ORDER = ['
if text.count(marker) != 1:
    sys.exit('ABORT: MARKER_ORDER anchor matched %d times (expected 1)' % text.count(marker))
block = js + NL + NL + marker
text = text.replace(marker, block)

out = text.encode('utf-8')
if has_bom:
    out = b'\xef\xbb\xbf' + out
open(HTML, 'wb').write(out)
print('OK: applied slice 3a (4 edits).')
