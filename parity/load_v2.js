// Loader for the V2 engine extracted from index.html.
// The extract is raw JS from inside a <script> tag, so it:
//   (a) may have trailing </script></body></html> lines, and
//   (b) declares functions/consts at top level but does NOT export them.
// We strip the HTML tail, then run the code inside a fresh module scope using
// the vm module, capturing the symbols we need off the resulting context.

const fs = require('fs');
const vm = require('vm');

function loadV2(extractPath) {
  let src = fs.readFileSync(extractPath, 'utf8');

  // Strip anything from the first closing </script> onward (the HTML tail).
  const scriptEnd = src.indexOf('</script>');
  if (scriptEnd !== -1) src = src.slice(0, scriptEnd);

  // The extract uses `const`/`function` at top level. Under vm.runInContext,
  // top-level function declarations become properties of the context's global,
  // but top-level `const`/`let` do NOT (they're block-scoped to the script).
  // generateRecommendationsV2 is a `function` declaration, so it WILL be on the
  // context global. Its helpers are also `function` declarations (per the map),
  // so they'll be reachable by the engine at call time via closure/global.
  // The `const` tables (MARKER_ORDER etc.) are referenced by the functions in
  // the same script, so they resolve fine at call time within this context.

  const sandbox = {};
  vm.createContext(sandbox);
  vm.runInContext(src, sandbox, { filename: extractPath });

  if (typeof sandbox.generateRecommendationsV2 !== 'function') {
    throw new Error('generateRecommendationsV2 not found after loading ' + extractPath +
      '. The extract may be incomplete or the function may be defined differently.');
  }
  return sandbox.generateRecommendationsV2;
}

module.exports = { loadV2 };
