#!/usr/bin/env python3
# apply_consult_handout_pdf.py - Milestone 4 slice 4d (handout PDF + email).
# Two anchored, run-once edits to index.html:
#   1. consult_handout_pdf.js inlined before `const MARKER_ORDER` (engine untouched)
#   2. swap "Print patient handout" -> "Download handout (PDF)" + "Email to client"
# Preserves UTF-8 BOM + CRLF. Anchors abort unless matched exactly once.

import sys

SRC = 'index.html'
JS  = 'consult_handout_pdf.js'

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

# Guards: 4b (handout URLs + button) and 4c (pdfmake helpers) must be present.
if 'ND_HANDOUT_URLS' not in text or 'consultPrintHandout' not in text:
    sys.exit('ABORT: slice 4b not detected. Apply 4b first.')
if 'CONSULT_PDF_STYLES' not in text:
    sys.exit('ABORT: slice 4c not detected (pdfmake helpers). Apply 4c first.')

# ---------------------------------------------------------------------------
# Edit 1: inline consult_handout_pdf.js before `const MARKER_ORDER`.
# ---------------------------------------------------------------------------
js = open(JS, 'r', encoding='utf-8').read()
js = to_crlf(js).rstrip('\r\n')
anchor1 = 'const MARKER_ORDER = ['
text = replace_once(text, anchor1, js + '\r\n\r\n' + anchor1, 'marker-order')

# ---------------------------------------------------------------------------
# Edit 2: swap "Print patient handout" -> Download handout + Email to client.
# ---------------------------------------------------------------------------
anchor2 = (
    "        '<button class=\"btn btn-outline\" onclick=\"consultPrintHandout(\\'' + consultEsc(row.id) + '\\')\">Print patient handout</button>' +"
)
repl2 = (
    "        '<button class=\"btn btn-outline\" onclick=\"consultDownloadHandout(\\'' + consultEsc(row.id) + '\\')\">Download handout (PDF)</button>' +\r\n"
    "        '<button class=\"btn btn-outline\" onclick=\"consultEmailHandout(\\'' + consultEsc(row.id) + '\\')\">Email to client</button>' +"
)
text = replace_once(text, anchor2, repl2, 'handout-button-swap')

out = text.encode('utf-8')
if has_bom:
    out = b'\xef\xbb\xbf' + out
open(SRC, 'wb').write(out)
print('OK: 2 edits applied (handout PDF JS, handout button -> Download + Email).')
