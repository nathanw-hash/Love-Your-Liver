#!/usr/bin/env python3
# events-for-client UI hardening (no DB change; RLS already has admin INSERT/UPDATE, no admin DELETE).
#   Edit 1  - hide the Delete button when editing on behalf of another user (matches self-only DELETE RLS).
#   Edit 2a - add an on-behalf banner element to the event form markup.
#   Edit 2b - drive that banner in showEventForm (applies to both the new and edit branches).
# Conventions: read/write utf-8-sig + newline='' (preserve BOM + CRLF); detect newline; exact-match
# anchors that abort unless matched exactly once.
import sys

PATH = sys.argv[1] if len(sys.argv) > 1 else 'index.html'

with open(PATH, encoding='utf-8-sig', newline='') as f:
    data = f.read()

nl = '\r\n' if '\r\n' in data else '\n'

def J(lines):
    return nl.join(lines)

edits = []

# --- Edit 1: Delete button only when active lab user IS the current user (no admin DELETE) ---
edits.append((
    "    deleteBtn.style.display = 'inline-block';",
    "    deleteBtn.style.display = (currentUser && getActiveLabUserId() === currentUser.id) ? 'inline-block' : 'none';",
))

# --- Edit 2a: on-behalf banner element in the event-form markup (hidden by default) ---
edits.append((
    '          <input type="hidden" id="event-id">',
    J([
        '          <input type="hidden" id="event-id">',
        '          <div id="event-onbehalf-banner" style="display:none;background:var(--accent-light);border:1px solid #a3d9be;border-radius:8px;padding:8px 12px;margin-bottom:12px;font-size:13px;color:var(--accent);"></div>',
    ]),
))

# --- Edit 2b: set the banner inside showEventForm, just before the form is revealed ---
edits.append((
    "  form.style.display = 'block';",
    J([
        "  const obBanner = document.getElementById('event-onbehalf-banner');",
        "  if (obBanner) {",
        "    const labUid = getActiveLabUserId();",
        "    if (currentUser && labUid && labUid !== currentUser.id) {",
        "      const c = _clientPickerMap[_activeClientId];",
        "      const nm = c ? (((c.first_name || '') + ' ' + (c.last_name || '')).trim() || c.email || 'this client') : 'this client';",
        "      obBanner.textContent = `Adding to ${nm}'s timeline (not your own).`;",
        "      obBanner.style.display = 'block';",
        "    } else {",
        "      obBanner.style.display = 'none';",
        "    }",
        "  }",
        "  form.style.display = 'block';",
    ]),
))

for old, new in edits:
    n = data.count(old)
    if n != 1:
        sys.exit('ABORT: anchor matched %d times (expected exactly 1):\n%r' % (n, old))
    data = data.replace(old, new)

with open(PATH, 'w', encoding='utf-8-sig', newline='') as f:
    f.write(data)

print('OK: applied %d edits' % len(edits))
