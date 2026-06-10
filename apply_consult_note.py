#!/usr/bin/env python3
# apply_consult_note.py - Milestone 4 slice 4a (clinical note). Stacks on 4b.
# Three anchored, run-once edits to index.html (post-4b):
#   1. clinical-note print CSS before head </style>
#   2. consult_note.js inlined before `const MARKER_ORDER` (engine slice byte-identical)
#   3. "Print clinical note" button (btn-accent) ahead of the 4b handout button
# Preserves UTF-8 BOM + CRLF. Anchors abort unless matched exactly once.

import sys

SRC = 'index.html'
JS  = 'consult_note.js'

raw = open(SRC, 'rb').read()
has_bom = raw.startswith(b'\xef\xbb\xbf')
text = raw.decode('utf-8-sig')
if '\r\n' not in text:
    sys.exit('ABORT: expected CRLF line endings in ' + SRC)

def to_crlf(s):
    return s.replace('\r\n', '\n').replace('\n', '\r\n')

def replace_once(t, anchor, repl, label):
    n = t.count(anchor)
    if n != 1:
        sys.exit('ABORT: anchor [%s] matched %d times (expected 1)' % (label, n))
    return t.replace(anchor, repl)

# Guard: 4b must already be applied (shared #print-root + handout button present).
if 'id="print-root"' not in text or 'consultPrintHandout' not in text:
    sys.exit('ABORT: slice 4b not detected (need #print-root + handout button). Apply 4b first.')

# ---------------------------------------------------------------------------
# Edit 1: clinical-note print CSS before the head's closing </style>.
# ---------------------------------------------------------------------------
NOTE_CSS = to_crlf(
'''/* ===== Milestone 4 slice 4a: clinical note (print) ===== */
#print-root .pr-secsub { font-size: 9pt; color: #777; text-transform: none;
  letter-spacing: 0; font-weight: 400; margin: -4px 0 6px; }
#print-root .pr-meta { margin: 6px 0 12px; font-size: 10.5pt; color: #222; }
#print-root .pr-meta div { margin: 1px 0; }
#print-root .pr-meta b { color: #111; }
#print-root .pr-table { margin: 4px 0 6px; }
#print-root .pr-trow { display: flex; justify-content: space-between; padding: 4px 0;
  border-bottom: 1px solid #e6e6e6; font-size: 10.5pt; }
#print-root .pr-trow .k { color: #444; }
#print-root .pr-trow .v { font-weight: 700; }
#print-root .pr-narr { margin: 6px 0; break-inside: avoid; }
#print-root .pr-narr-h { font-weight: 700; font-size: 11pt; margin-top: 6px; }
#print-root .pr-fl { font-size: 9.5pt; color: #555; margin-top: 4px; }
#print-root .pr-fv { font-size: 10.5pt; color: #111; line-height: 1.4; }''')

anchor1 = '</style>\r\n</head>'
text = replace_once(text, anchor1, NOTE_CSS + '\r\n' + anchor1, 'head-style-close')

# ---------------------------------------------------------------------------
# Edit 2: inline consult_note.js before `const MARKER_ORDER`.
# ---------------------------------------------------------------------------
js = open(JS, 'r', encoding='utf-8').read()
js = to_crlf(js).rstrip('\r\n')
anchor2 = 'const MARKER_ORDER = ['
text = replace_once(text, anchor2, js + '\r\n\r\n' + anchor2, 'marker-order')

# ---------------------------------------------------------------------------
# Edit 3: "Print clinical note" button ahead of the handout button.
# ---------------------------------------------------------------------------
anchor3 = (
    "        '<button class=\"btn btn-outline\" onclick=\"consultPrintHandout(\\'' + consultEsc(row.id) + '\\')\">Print patient handout</button>' +"
)
new_btn = (
    "        '<button class=\"btn btn-accent\" onclick=\"consultPrintNote(\\'' + consultEsc(row.id) + '\\')\">Print clinical note</button>' +"
)
text = replace_once(text, anchor3, new_btn + '\r\n' + anchor3, 'note-button')

out = text.encode('utf-8')
if has_bom:
    out = b'\xef\xbb\xbf' + out
open(SRC, 'wb').write(out)
print('OK: 3 edits applied (note CSS, clinical-note JS, Print clinical note button).')
