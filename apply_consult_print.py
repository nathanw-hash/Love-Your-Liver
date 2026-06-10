#!/usr/bin/env python3
# apply_consult_print.py - Milestone 4 slice 4b (patient supplement handout).
# Four anchored, run-once edits to index.html:
#   1. print CSS (handout doc styles + #print-root isolation) before head </style>
#   2. <div id="print-root"> as a direct child of <body>, before </body>
#   3. consult_print.js inlined before `const MARKER_ORDER` (engine slice stays byte-identical)
#   4. "Print patient handout" button into the finalized-consult branch of consultOpen
# Preserves UTF-8 BOM + CRLF. Anchors abort unless matched exactly once (run-once).

import sys

SRC = 'index.html'
JS  = 'consult_print.js'

raw = open(SRC, 'rb').read()
has_bom = raw.startswith(b'\xef\xbb\xbf')
text = raw.decode('utf-8-sig')          # strip BOM if present; keep CRLF in body
if '\r\n' not in text:
    sys.exit('ABORT: expected CRLF line endings in ' + SRC)

def to_crlf(s):
    return s.replace('\r\n', '\n').replace('\n', '\r\n')

def replace_once(t, anchor, repl, label):
    n = t.count(anchor)
    if n != 1:
        sys.exit('ABORT: anchor [%s] matched %d times (expected 1)' % (label, n))
    return t.replace(anchor, repl)

# ---------------------------------------------------------------------------
# Edit 1: print CSS, inserted just before the head's closing </style>.
# ---------------------------------------------------------------------------
PRINT_CSS = to_crlf(
'''/* ===== Milestone 4: print / PDF deliverables (handout + clinical note) ===== */
#print-root { display: none; }
@media print {
  body > *:not(#print-root) { display: none !important; }
  #print-root { display: block !important; }
  @page { size: auto; margin: 0.6in; }
  html, body { background: #fff !important; }
}
#print-root .pr-doc {
  color: #111; background: #fff;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
  font-size: 11pt; line-height: 1.42;
  -webkit-print-color-adjust: exact; print-color-adjust: exact;
}
#print-root .pr-brand { font-size: 13pt; font-weight: 800; letter-spacing: .02em; color: #2f6f3e; }
#print-root .pr-title { font-size: 15pt; font-weight: 800; margin: 2px 0 1px; }
#print-root .pr-date  { font-size: 11pt; color: #333; margin: 0 0 10px; }
#print-root .pr-banner { font-weight: 700; border: 1.5px solid #2f6f3e; background: #eef6f0;
  color: #1d4d2a; padding: 8px 10px; border-radius: 6px; margin: 8px 0 12px; }
#print-root .pr-read { margin: 6px 0; }
#print-root .pr-info { margin: 6px 0; font-size: 10.5pt; color: #222; }
#print-root .pr-info b { color: #111; }
#print-root .pr-sec { font-weight: 800; text-transform: uppercase; letter-spacing: .03em;
  font-size: 11pt; color: #1d4d2a; border-bottom: 1.5px solid #cfd8cf; padding-bottom: 3px;
  margin: 16px 0 8px; break-after: avoid; }
#print-root .pr-item { margin: 8px 0; break-inside: avoid; }
#print-root .pr-item-h { font-weight: 700; }
#print-root .pr-dose { font-weight: 400; }
#print-root .pr-sub { margin: 2px 0 0 16px; font-size: 10pt; color: #444; }
#print-root .pr-link { color: #1a5fb4; text-decoration: underline; }
#print-root .pr-foot { margin-top: 14px; font-size: 9.5pt; color: #666;
  border-top: 1px solid #ddd; padding-top: 6px; }''')

anchor1 = '</style>\r\n</head>'
text = replace_once(text, anchor1, PRINT_CSS + '\r\n' + anchor1, 'head-style-close')

# ---------------------------------------------------------------------------
# Edit 2: #print-root container as a direct child of <body>, before </body>.
# ---------------------------------------------------------------------------
anchor2 = '</script>\r\n</body>'
repl2 = '</script>\r\n<div id="print-root" aria-hidden="true"></div>\r\n</body>'
text = replace_once(text, anchor2, repl2, 'body-close')

# ---------------------------------------------------------------------------
# Edit 3: inline consult_print.js before `const MARKER_ORDER` (keeps the engine
# slice from MARKER_ORDER -> final </script> byte-identical).
# ---------------------------------------------------------------------------
js = open(JS, 'r', encoding='utf-8').read()
js = to_crlf(js).rstrip('\r\n')
anchor3 = 'const MARKER_ORDER = ['
text = replace_once(text, anchor3, js + '\r\n\r\n' + anchor3, 'marker-order')

# ---------------------------------------------------------------------------
# Edit 4: "Print patient handout" button into the finalized-consult branch.
# Inserted between the Finalized-date line and consultFinalNoteHtml(row).
# ---------------------------------------------------------------------------
anchor4 = (
    "      (row.finalized_at ? '<div style=\"font-size:12px;color:var(--text3);margin:0 0 8px;\">Finalized ' + consultEsc(String(row.finalized_at).slice(0, 10)) + '</div>' : '') +\r\n"
    "      consultFinalNoteHtml(row) +"
)
repl4 = (
    "      (row.finalized_at ? '<div style=\"font-size:12px;color:var(--text3);margin:0 0 8px;\">Finalized ' + consultEsc(String(row.finalized_at).slice(0, 10)) + '</div>' : '') +\r\n"
    "      '<div style=\"display:flex;gap:8px;flex-wrap:wrap;margin:6px 0 12px;\">' +\r\n"
    "        '<button class=\"btn btn-outline\" onclick=\"consultPrintHandout(\\'' + consultEsc(row.id) + '\\')\">Print patient handout</button>' +\r\n"
    "      '</div>' +\r\n"
    "      consultFinalNoteHtml(row) +"
)
text = replace_once(text, anchor4, repl4, 'final-branch-button')

# ---------------------------------------------------------------------------
# Write back, re-attaching BOM if it was present.
# ---------------------------------------------------------------------------
out = text.encode('utf-8')
if has_bom:
    out = b'\xef\xbb\xbf' + out
open(SRC, 'wb').write(out)
print('OK: 4 edits applied (print CSS, #print-root, handout JS, print button).')
