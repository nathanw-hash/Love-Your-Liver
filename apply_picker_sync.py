#!/usr/bin/env python3
# apply_picker_sync.py - keep the provider client-picker label in sync with the
# active selection. buildClientPicker() runs on every onAuthStateChange (login
# AND token refresh), and was hard-resetting the dropdown to "Myself" while
# _activeClientId stayed on the picked client - so after a token refresh the
# panels showed a client's data under a "Myself" label. Reflect the real
# selection instead. Far above the engine slice; no engine/harness impact.
import sys

HTML = 'index.html'
raw = open(HTML, 'rb').read()
has_bom = raw.startswith(b'\xef\xbb\xbf')
text = raw.decode('utf-8-sig')
if '\r\n' not in text:
    sys.exit('ABORT: expected CRLF line endings in index.html')

old = "  sel.value = '';"
new = "  sel.value = _activeClientId || '';"
n = text.count(old)
if n != 1:
    sys.exit('ABORT: anchor matched %d times (expected 1)' % n)
text = text.replace(old, new)

out = text.encode('utf-8')
if has_bom:
    out = b'\xef\xbb\xbf' + out
open(HTML, 'wb').write(out)
print('OK: applied picker-sync fix (1 edit).')
