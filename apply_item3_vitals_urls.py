#!/usr/bin/env python3
# LYL Week-4 item 3: fill the four vitals help-link URLs in intake_form.js.
# Preserves UTF-8 (NO BOM) + LF line endings. Exact-match asserts; aborts on mismatch.
import sys
PATH = 'intake_form.js'
EDITS = [
    ("How To Take Your Pulse",
     "https://www.drugs.com/cg/how-to-take-a-pulse.html"),
    ("How To Measure Your Respiratory Rate",
     "https://www.beaconhealthsystem.org/library/articles/how-to-measure-your-respiratory-rate?content_id=ART-20482580"),
    ("How To Measure Your Blood Pressure",
     "https://www.cdc.gov/high-blood-pressure/measure/?CDC_AAref_Val=https://www.cdc.gov/bloodpressure/measure.htm"),
    ("How To Take A Temperature",
     "https://www.drugs.com/cg/how-to-take-a-temperature.html"),
]
data = open(PATH, 'r', encoding='utf-8', newline='').read()
for text, url in EDITS:
    old = "{ text: '" + text + "', url: '' }"
    new = "{ text: '" + text + "', url: '" + url + "' }"
    n = data.count(old)
    if n != 1:
        print("ABORT [%s]: expected 1 match, found %d" % (text, n)); sys.exit(1)
    data = data.replace(old, new, 1)
    print("ok  [%s]" % text)
open(PATH, 'w', encoding='utf-8', newline='').write(data)
print("--- 4 vitals URLs filled ---")
