#!/usr/bin/env python3
# apply_consult_panel.py
# Milestone 3, slice 2: adds the provider-only Consult tab + two-pane workspace
# shell (read-only context pane + stubbed editor pane) to the testing app.
#
# - Reads ./index.html and ./consult_context.js from the current directory.
# - Detects and preserves the file's BOM and line endings.
# - Every anchor must match exactly once or the script aborts with nothing written.
# - The new JS is inserted BEFORE `const MARKER_ORDER` so the engine slice
#   (MARKER_ORDER .. final </script>) stays byte-identical for the parity harness.

import sys, os

HTML = 'index.html'
JS   = 'consult_context.js'

def fail(msg):
    print('ABORT: ' + msg)
    sys.exit(1)

if not os.path.exists(HTML): fail(HTML + ' not found in current directory')
if not os.path.exists(JS):   fail(JS + ' not found in current directory')

raw = open(HTML, 'rb').read()
had_bom = raw[:3] == b'\xef\xbb\xbf'
crlf    = b'\r\n' in raw
nl      = '\r\n' if crlf else '\n'
text    = raw.decode('utf-8-sig')

# Read the JS block and normalise its newlines to the host file's.
js_block = open(JS, 'r', encoding='utf-8', newline='').read()
js_block = js_block.replace('\r\n', '\n').replace('\r', '\n').replace('\n', nl)
js_block = js_block.rstrip(nl)

def apply_edit(label, anchor, replacement):
    global text
    n = text.count(anchor)
    if n != 1:
        fail('anchor for "%s" matched %d times (expected 1): %s' % (label, n, anchor[:70]))
    text = text.replace(anchor, replacement)
    print('  ok  ' + label)

# 1) Top tab button (appended last so showTab indices do not shift).
a1 = '''<button class="tab provider-only" style="display:none" onclick="showTab('clientintake')">Client Intake</button>'''
r1 = a1 + nl + '      ' + '''<button class="tab provider-only" style="display:none" onclick="showTab('consult')">Consult</button>'''
apply_edit('top tab button', a1, r1)

# 2) Two-pane panel, inserted before panel-comparison.
a2 = '    <div class="panel" id="panel-comparison">'
panel = nl.join([
  '    <div class="panel" id="panel-consult">',
  '      <div style="display:flex;flex-wrap:wrap;gap:16px;align-items:flex-start;">',
  '        <div style="flex:1 1 380px;min-width:300px;">',
  '          <div id="consult-empty" style="color:var(--text3);font-size:14px;padding:20px;">Pick a client from the selector above to load their consult context.</div>',
  '          <div id="consult-context" style="display:none;"></div>',
  '        </div>',
  '        <div style="flex:1 1 380px;min-width:300px;">',
  '          <div class="card">',
  '            <div class="card-title">Consultation note</div>',
  '            <p style="color:var(--text3);font-size:14px;line-height:1.6;">Editor coming in the next slice. This pane will hold the discussion notes, the section-based impressions and changes, and the supplement picker.</p>',
  '          </div>',
  '        </div>',
  '      </div>',
  '    </div>',
])
r2 = panel + nl + a2
apply_edit('consult panel', a2, r2)

# 3) showTab index map.
a3 = 'clientintake: 6 }[name];'
r3 = 'clientintake: 6, consult: 7 }[name];'
apply_edit('showTab index map', a3, r3)

# 4) showTab init hook.
a4 = "if (name === 'comparison' && _comparisonContext) renderComparison();"
r4 = a4 + nl + '  ' + "if (name === 'consult' && currentUser) renderConsultContext();"
apply_edit('showTab consult hook', a4, r4)

# 5) JS block, inserted before the engine slice start.
a5 = 'const MARKER_ORDER = ['
r5 = js_block + nl + nl + a5
apply_edit('consult JS block', a5, r5)

out = text.encode('utf-8')
if had_bom:
    out = b'\xef\xbb\xbf' + out
open(HTML, 'wb').write(out)
print('Wrote %s (bom=%s, crlf=%s, %d bytes)' % (HTML, had_bom, crlf, len(out)))
