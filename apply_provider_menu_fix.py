#!/usr/bin/env python3
# apply_provider_menu_fix.py
# Fix: the Provider dropdown menu was clipped by .tabs (overflow-x:auto forces
# overflow-y to clip too), so an absolutely-positioned menu never showed.
# Switch the menu to position:fixed and set its coordinates from the button.
# Pure UI; engine slice untouched.
#
# Reads ./index.html from the current directory. Anchors must match once each.

import sys, os
HTML = 'index.html'

def fail(m): print('ABORT: ' + m); sys.exit(1)
if not os.path.exists(HTML): fail(HTML + ' not found')

raw = open(HTML, 'rb').read()
had_bom = raw[:3] == b'\xef\xbb\xbf'
crlf = b'\r\n' in raw
nl = '\r\n' if crlf else '\n'
text = raw.decode('utf-8-sig')

def apply_edit(label, anchor, replacement):
    global text
    n = text.count(anchor)
    if n != 1:
        fail('anchor for "%s" matched %d times (expected 1)' % (label, n))
    text = text.replace(anchor, replacement)
    print('  ok  ' + label)

# 1) Menu positioning: absolute (clipped by .tabs) -> fixed (escapes overflow).
apply_edit('menu position fixed',
           'position:absolute;right:0;top:calc(100% + 6px);',
           'position:fixed;')

# 2) Replace toggleProviderMenu with a version that positions from the button.
old_fn = nl.join([
  'function toggleProviderMenu(e) {',
  '  if (e) e.stopPropagation();',
  "  const m = document.getElementById('provider-menu');",
  '  if (!m) return;',
  "  if (m.style.display !== 'none') { closeProviderMenu(); return; }",
  "  m.style.display = 'flex';",
  "  setTimeout(function () { document.addEventListener('click', closeProviderMenu); }, 0);",
  '}',
])
new_fn = nl.join([
  'function toggleProviderMenu(e) {',
  '  if (e) e.stopPropagation();',
  "  const m = document.getElementById('provider-menu');",
  '  if (!m) return;',
  "  if (m.style.display !== 'none') { closeProviderMenu(); return; }",
  "  m.style.display = 'flex';",
  "  const btn = document.getElementById('provider-tab-btn');",
  '  if (btn) {',
  '    const r = btn.getBoundingClientRect();',
  "    m.style.top = (r.bottom + 6) + 'px';",
  "    m.style.left = Math.max(8, r.right - m.offsetWidth) + 'px';",
  '  }',
  "  setTimeout(function () { document.addEventListener('click', closeProviderMenu); }, 0);",
  '}',
])
apply_edit('toggleProviderMenu positioning', old_fn, new_fn)

out = text.encode('utf-8')
if had_bom: out = b'\xef\xbb\xbf' + out
open(HTML, 'wb').write(out)
print('Wrote %s (bom=%s, crlf=%s, %d bytes)' % (HTML, had_bom, crlf, len(out)))
