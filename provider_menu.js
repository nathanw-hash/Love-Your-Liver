// =============================================================================
// Provider dropdown menu (Milestone 3 - top-nav cleanup)
// Groups the provider tools (Admin, Client Intake, Consult) behind one
// "Provider" trigger in the top nav. Pure UI; no engine or parity impact.
// =============================================================================
function toggleProviderMenu(e) {
  if (e) e.stopPropagation();
  const m = document.getElementById('provider-menu');
  if (!m) return;
  if (m.style.display !== 'none') { closeProviderMenu(); return; }
  m.style.display = 'flex';
  setTimeout(function () { document.addEventListener('click', closeProviderMenu); }, 0);
}

function closeProviderMenu() {
  const m = document.getElementById('provider-menu');
  if (m) m.style.display = 'none';
  document.removeEventListener('click', closeProviderMenu);
}

function providerGo(name) {
  closeProviderMenu();
  showTab(name);
}
