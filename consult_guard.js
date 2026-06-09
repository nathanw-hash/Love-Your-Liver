// =============================================================================
// Consultation workspace - unsaved-changes guard (Milestone 3, slice 3b.1)
// Protects an open draft with pending edits (_consultDirty) from silent loss:
// a beforeunload prompt on reload/close/navigate-away, plus confirm() gates on
// the in-app actions that replace the editor (switching consult rows, switching
// client). consultConfirmDiscard() short-circuits when nothing is dirty, so the
// prompt only ever appears with real pending edits.
// =============================================================================
function consultConfirmDiscard() {
  return !_consultDirty || confirm('Discard unsaved changes to this consultation?');
}

window.addEventListener('beforeunload', function (e) {
  if (_consultDirty) { e.preventDefault(); e.returnValue = ''; }
});
