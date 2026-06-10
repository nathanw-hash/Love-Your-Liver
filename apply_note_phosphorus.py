#!/usr/bin/env python3
# apply_note_phosphorus.py - Milestone 4 slice 4a follow-up.
# Adds a Phosphorus row to the clinical-note hair table, positioned after the
# Zn/Cu ratio (matching the live context pane order). One anchored in-place
# insert; preserves UTF-8 BOM + CRLF; engine slice unaffected.

import sys

SRC = 'index.html'
raw = open(SRC, 'rb').read()
has_bom = raw.startswith(b'\xef\xbb\xbf')
text = raw.decode('utf-8-sig')
if '\r\n' not in text:
    sys.exit('ABORT: expected CRLF line endings in ' + SRC)

# 6-space indent makes this the note-builder row (the 4-space one is the context pane).
anchor = "      ['Zn/Cu ratio', consultRatio(labs.hair_zinc, labs.hair_copper)],"
phosphorus = "      ['Phosphorus', labs.hair_phosphorus],"

if text.count(anchor) != 1:
    sys.exit('ABORT: anchor matched %d times (expected 1)' % text.count(anchor))
if 'Phosphorus' in text and "['Phosphorus', labs.hair_phosphorus]," in text:
    sys.exit('ABORT: phosphorus row already present (run-once).')

text = text.replace(anchor, anchor + '\r\n' + phosphorus)

out = text.encode('utf-8')
if has_bom:
    out = b'\xef\xbb\xbf' + out
open(SRC, 'wb').write(out)
print('OK: phosphorus row added to clinical-note hair table.')
