#!/usr/bin/env python3
# LYL Week-4 item 2: render ALL intake sections (not just the default first three).
# Adds sectionIds to the LYLIntakeRenderer.mount() call in initIntake().
# Preserves UTF-8 BOM + CRLF. Exact-match assert; aborts on mismatch. Engine untouched.
import sys
PATH = 'index.html'
NL = '\r\n'
OLD = NL.join([
    '    form: window.LYL_INTAKE,',
    '    onStatus: function (s) {',
])
NEW = NL.join([
    '    form: window.LYL_INTAKE,',
    '    sectionIds: window.LYL_INTAKE.sections.map(s => s.id),',
    '    onStatus: function (s) {',
])
data = open(PATH, 'r', encoding='utf-8-sig', newline='').read()
n = data.count(OLD)
if n != 1:
    print('ABORT: expected exactly 1 match, found %d' % n); sys.exit(1)
data = data.replace(OLD, NEW, 1)
open(PATH, 'w', encoding='utf-8-sig', newline='').write(data)
print('ok - sectionIds added to initIntake mount')
