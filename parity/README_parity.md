# LYL Engine Parity Harness

Validates that the table-driven **V2** engine (`generateRecommendationsV2`)
produces the same output as the original **V1** engine (`generateRecommendations`)
across a battery of edge-case inputs.

This is the validation layer we *thought* production shadow-mode was providing
on Thursday but wasn't — the shadow block called a function that no longer
existed and silently swallowed the resulting error, so every `parity OK` log
was meaningless. This harness does the comparison for real, offline, against
deliberately nasty synthetic inputs that real users won't reliably hit.

## What's in the box (already provided)

- `v1_engine.js` — the original engine, extracted verbatim from commit
  `70606b0~1` (last commit before the V2 switch). The reference implementation.
- `load_v2.js` — loads `generateRecommendationsV2` out of a raw script extract
  using Node's `vm` module (strips the trailing `</script></body></html>`).
- `fixtures.js` — 83 synthetic test cases covering threshold boundaries, null
  markers, both sexes, unknown/null sex, dose math at many weights, ratio
  markers, toxics, profile flags, and realistic full panels.
- `parity_harness.js` — runs both engines over every fixture, deep-diffs the
  output, and applies a whitelist for intended divergences.

## What you need to generate (2 files)

### 1. `v2_engine_extract.js` — the current V2 engine from index.html

From the repo root, in PowerShell:

```powershell
Get-Content index.html | Select-Object -Skip 2542 -First 520 | Set-Content parity\v2_engine_extract.js
```

`-Skip 2542` starts at line 2543 (the `const MARKER_ORDER = [` line). If the
engine has moved since this was written, find the right start line with:

```powershell
Select-String "^const MARKER_ORDER" index.html
```

and set `-Skip` to (that line number − 1). The `-First 520` grabs through the
end of the engine plus the trailing `</script></body></html>`, which the loader
strips automatically. Confirm the tail looks right:

```powershell
Get-Content parity\v2_engine_extract.js | Select-Object -Last 5
```

You should see the close of `processStandaloneFlags` (a `}`) followed by
`</script>`, `</body>`, `</html>`. If the function looks cut off mid-body,
increase `-First`.

### 2. `engine_data.json` — the seven engine_* tables

In the Supabase SQL editor, run:

```sql
SELECT
  (SELECT json_agg(t) FROM engine_thresholds t)          AS thresholds,
  (SELECT json_agg(t) FROM engine_ratio_thresholds t)    AS ratio_thresholds,
  (SELECT json_agg(t) FROM engine_findings t)            AS findings,
  (SELECT json_agg(t) FROM engine_actions t)             AS actions,
  (SELECT json_agg(t) FROM engine_supplement_doses t)    AS supplement_doses,
  (SELECT json_agg(t) FROM engine_toxic_thresholds t)    AS toxic_thresholds,
  (SELECT json_agg(t) FROM engine_profile_flag_actions t) AS profile_flag_actions;
```

Export the single result row as JSON (Supabase's export button, or copy the
cell) and save it as `parity/engine_data.json`. The harness accepts either the
raw object or a one-element array wrapping it.

## Run it

```powershell
cd parity
node parity_harness.js
```

## Reading the result

```
Fixtures run:        83
Clean (identical):   70
Whitelisted diffs:   13   (intended: ferritin {optHigh} fix)
Unexpected failures: 0
Result: PASS
```

- **Clean** — V1 and V2 produced byte-identical output. 
- **Whitelisted** — they differed, but only in the ferritin interpretation
  text, where V1 emits the literal `{optHigh}` bug and V2 (DB-fixed) emits the
  numeric high value. This is the intended fix, not a regression.
- **Unexpected failures** — a real divergence, or one engine threw. Each is
  printed with the triggering `labs`/`profile` and a field-level V1-vs-V2 diff.

Exit code is `0` on PASS, `1` on any unexpected failure, `2` if a required
input file is missing.

## Known intended divergences (the whitelist)

Currently the harness whitelists exactly one class of difference:

1. **Ferritin `{optHigh}` fix.** V1's template literal was missing a `$`, so it
   printed the literal string `{optHigh}`. The DB text was fixed Thursday to
   `{{optimal_high}}`, which V2 substitutes with the numeric high threshold.
   The harness confirms the *only* difference on ferritin findings is exactly
   that substitution.

Two other known quirks should produce **no diff** (both engines reproduce them
identically), so they are NOT whitelisted — if they ever show as a diff, that's
a real V2 regression worth investigating:

- **Hair copper text vs threshold mismatch.** Threshold is 0.5–1.5 but the
  interpretation text says "1.5–2.5". Both engines say this. Still parked
  pending Kelsey/Dr. Smith clinical input.
- **Hair molybdenum 'high' text.** V1's ternary reuses the optimal text when
  status is 'high'; the V2 findings table has a separate 'high' row with text
  identical to optimal. Same output either way.

## When to re-run

- After any change to the engine_* tables via the CMS (Week 2). The CMS edits
  the data V2 reads; this harness confirms those edits didn't break parity in
  some unexpected way.
- After any change to `generateRecommendationsV2` code.
- Before any deploy that touches engine logic or engine data.

## Adding a new intended divergence

When you intentionally change engine behavior (e.g., fixing the hair copper
text), the harness will start reporting it as an unexpected failure — correctly,
because V2 now differs from the V1 reference. At that point either:

- (preferred) accept that V1 is no longer the source of truth for that marker,
  and add a whitelist entry in `parity_harness.js` (see `diffIsWhitelisted`),
  documenting the intended change; or
- regenerate `v1_engine.js` from a newer commit if V1 itself was updated
  (unlikely — V1 is frozen history).
