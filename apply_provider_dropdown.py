#!/usr/bin/env python3
# apply_provider_dropdown.py
# Top-nav cleanup: replace the three provider tab buttons (Admin, Client Intake,
# Consult) with a single "Provider" dropdown, and rewire showTab's active-state
# handling. Pure UI; the engine slice stays byte-identical.
#
# Reads ./index.html and ./provider_menu.js from the current directory.
# Every anchor must match exactly once or the script aborts with nothing written.

import sys, os

HTML = 'index.html'
JS   = 'provider_menu.js'

def fail(msg):
    print('ABORT: ' + msg)
    sys.exit(1)

if not os.path.exists(HTML): fail(HTML + ' not found')
if not os.path.exists(JS):   fail(JS + ' not found')

raw = open(HTML, 'rb').read()
had_bom = raw[:3] == b'\xef\xbb\xbf'
crlf    = b'\r\n' in raw
nl      = '\r\n' if crlf else '\n'
text    = raw.decode('utf-8-sig')

js_block = open(JS, 'r', encoding='utf-8', newline='').read()
js_block = js_block.replace('\r\n', '\n').replace('\r', '\n').replace('\n', nl).rstrip(nl)

def apply_edit(label, anchor, replacement):
    global text
    n = text.count(anchor)
    if n != 1:
        fail('anchor for "%s" matched %d times (expected 1): %s' % (label, n, anchor[:70]))
    text = text.replace(anchor, replacement)
    print('  ok  ' + label)

# 1) Replace the three provider tab buttons with the Provider dropdown.
a1 = nl.join([
  '''      <button class="tab admin-only" style="display:none" onclick="showTab('admin')">Admin</button>''',
  '''      <button class="tab provider-only" style="display:none" onclick="showTab('clientintake')">Client Intake</button>''',
  '''      <button class="tab provider-only" style="display:none" onclick="showTab('consult')">Consult</button>''',
])
item_style = "width:100%;text-align:left;padding:9px 12px;background:none;border:none;border-radius:7px;font-family:inherit;font-size:14px;color:var(--text);cursor:pointer;"
hover = '''onmouseover="this.style.background='var(--border)'" onmouseout="this.style.background='none'"'''
r1 = nl.join([
  '      <div class="provider-dd provider-only" id="provider-dd" style="display:none;position:relative;">',
  '        <button class="tab" id="provider-tab-btn" onclick="toggleProviderMenu(event)">Provider &#9662;</button>',
  '        <div class="provider-menu" id="provider-menu" style="display:none;flex-direction:column;gap:2px;position:absolute;right:0;top:calc(100% + 6px);min-width:170px;background:var(--surface);border:1px solid var(--border);border-radius:10px;box-shadow:0 12px 30px rgba(0,0,0,0.14);padding:6px;z-index:1500;">',
  '          <button class="provider-menu-item admin-only" style="display:none;' + item_style + '" ' + hover + ''' onclick="providerGo('admin')">Admin</button>''',
  '          <button class="provider-menu-item" style="' + item_style + '" ' + hover + ''' onclick="providerGo('clientintake')">Client Intake</button>''',
  '          <button class="provider-menu-item" style="' + item_style + '" ' + hover + ''' onclick="providerGo('consult')">Consult</button>''',
  '        </div>',
  '      </div>',
])
apply_edit('provider dropdown markup', a1, r1)

# 2) Trim the showTab index map (provider sub-tabs are no longer indexed tabs).
a2 = 'const tabIndex = { profile: 0, intake: 1, labs: 2, report: 3, history: 4, clientintake: 6, consult: 7 }[name];'
r2 = 'const tabIndex = { profile: 0, intake: 1, labs: 2, report: 3, history: 4 }[name];'
apply_edit('showTab index map', a2, r2)

# 3) Provider-active state + menu close, inserted before the bnav active line.
a3 = '''const bnavBtn = document.querySelector('.bnav-tab[data-tab="' + name + '"]');'''
prov = nl.join([
  "  if (name === 'admin' || name === 'clientintake' || name === 'consult') {",
  "    const provBtn = document.getElementById('provider-tab-btn');",
  "    if (provBtn) provBtn.classList.add('active');",
  "  }",
  "  closeProviderMenu();",
  "  ",
])
r3 = prov + a3
apply_edit('showTab provider-active + close', a3, r3)

# 4) Provider menu JS, inserted before the engine slice.
a4 = 'const MARKER_ORDER = ['
r4 = js_block + nl + nl + a4
apply_edit('provider menu JS', a4, r4)

out = text.encode('utf-8')
if had_bom:
    out = b'\xef\xbb\xbf' + out
open(HTML, 'wb').write(out)
print('Wrote %s (bom=%s, crlf=%s, %d bytes)' % (HTML, had_bom, crlf, len(out)))
