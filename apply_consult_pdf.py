#!/usr/bin/env python3
# apply_consult_pdf.py - Milestone 4 slice 4c (SOAP note as generated PDF).
# Three anchored, run-once edits to index.html:
#   1. pdfmake + vfs_fonts CDN script tags after the pdfjs-dist tag (load order:
#      pdfmake then vfs_fonts, so vfs auto-registers Roboto)
#   2. consult_pdf.js inlined before `const MARKER_ORDER` (engine slice untouched)
#   3. swap the "Print clinical note" button -> "Download SOAP note (PDF)"
# Preserves UTF-8 BOM + CRLF. Anchors abort unless matched exactly once.

import sys

SRC = 'index.html'
JS  = 'consult_pdf.js'

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

# Guard: 4a must be present (the note button we are swapping).
if 'consultPrintNote' not in text:
    sys.exit('ABORT: clinical-note button (4a) not found. Apply 4a first.')

# ---------------------------------------------------------------------------
# Edit 1: pdfmake CDN script tags after the pdfjs-dist tag.
# ---------------------------------------------------------------------------
anchor1 = '<script src="https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.min.js"></script>'
cdn = ('<script src="https://cdn.jsdelivr.net/npm/pdfmake@0.2.20/build/pdfmake.min.js"></script>\r\n'
       '<script src="https://cdn.jsdelivr.net/npm/pdfmake@0.2.20/build/vfs_fonts.js"></script>')
text = replace_once(text, anchor1, anchor1 + '\r\n' + cdn, 'pdfjs-cdn')

# ---------------------------------------------------------------------------
# Edit 2: inline consult_pdf.js before `const MARKER_ORDER`.
# ---------------------------------------------------------------------------
js = open(JS, 'r', encoding='utf-8').read()
js = to_crlf(js).rstrip('\r\n')
anchor2 = 'const MARKER_ORDER = ['
text = replace_once(text, anchor2, js + '\r\n\r\n' + anchor2, 'marker-order')

# ---------------------------------------------------------------------------
# Edit 3: swap "Print clinical note" -> "Download SOAP note (PDF)".
# ---------------------------------------------------------------------------
anchor3 = (
    "        '<button class=\"btn btn-accent\" onclick=\"consultPrintNote(\\'' + consultEsc(row.id) + '\\')\">Print clinical note</button>' +"
)
repl3 = (
    "        '<button class=\"btn btn-accent\" onclick=\"consultDownloadNote(\\'' + consultEsc(row.id) + '\\')\">Download SOAP note (PDF)</button>' +"
)
text = replace_once(text, anchor3, repl3, 'note-button-swap')

out = text.encode('utf-8')
if has_bom:
    out = b'\xef\xbb\xbf' + out
open(SRC, 'wb').write(out)
print('OK: 3 edits applied (pdfmake CDN, SOAP-note PDF JS, note button swap).')
