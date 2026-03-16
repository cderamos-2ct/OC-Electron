# OPS-022 Validation: Seeded Review Mode

Date: 2026-03-13
Repo: `/Volumes/Storage/OpenClaw/dashboard`
Task target: close the first Personal Ops trust/demo-readiness gap with the smallest bounded change.

## Outcome

Shipped outcome `B`: the first Personal Ops slice is explicitly frozen as seeded read-only review mode when `/Volumes/Storage/OpenClaw/.antigravity/evidence/personal-ops/comms-board.json` is missing.

This follow-up fully lands that posture durably:
- the dashboard source now presents the missing-overlay case as an intentional `run_045_seed` review posture,
- `/api/personal-ops` source logic resolves to the same posture,
- and canonical task state was updated in `.antigravity` to record the ship.

Outcome `A` remains intentionally deferred: the durable overlay file still does not exist.

## Code / Content Changes In Scope

- `lib/personal-ops-store.ts`
  - Missing-overlay warning explicitly says `Seeded review mode is active`.
  - Missing-overlay capabilities reason explicitly says the slice is frozen to the `RUN-045` seed dataset with no provider writeback.
  - Disabled action reasons describe first-slice review mode rather than implying live mutation.
- `components/personal-ops/PersonalOpsCommsPageClient.tsx`
  - Mode card labels the fallback posture as `Seeded review mode`.
  - Mode detail says the board is frozen to the `RUN-045` seed dataset until the durable overlay exists.
  - Capability reason is surfaced in-page.
  - Detail drawer includes a `Shipped posture` block and disabled actions render as review-only.
- `.antigravity/tasks/items/OPS-022.md`
  - Marked done and updated to record outcome `B` as the landed trust-closing move.
- `.antigravity/tasks/items/OPS-021.md`
  - Refreshed to show the first slice is landed with explicit seeded-review posture.
- `.antigravity/tasks/items/OPS-019.md`
  - Refreshed so the parent records that the first-slice trust gap is closed by seeded-review freeze, with overlay/writeback deferred to future work.

## Verification Evidence

### 1. Type safety

Command:

```sh
npm run typecheck
```

Result:

```text
> openclaw-dashboard@0.1.0 typecheck
> tsc --noEmit
```

### 2. Current source-path behavior for `/api/personal-ops`

Because a fresh local HTTP verification port was not necessary for this bounded pass, verification executed `lib/personal-ops-store.ts` directly from source with a local TypeScript loader.

Command:

```sh
node <<'NODE'
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

const projectRoot = '/Volumes/Storage/OpenClaw/dashboard';
const cache = new Map();
function resolveTsPath(specifier, parentDir) {
  const base = specifier.startsWith('@/') ? path.join(projectRoot, specifier.slice(2)) : specifier.startsWith('.') ? path.resolve(parentDir, specifier) : null;
  if (!base) return null;
  for (const candidate of [base, `${base}.ts`, `${base}.tsx`, path.join(base, 'index.ts'), path.join(base, 'index.tsx')]) {
    if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) return candidate;
  }
  throw new Error(`Unable to resolve ${specifier} from ${parentDir}`);
}
function loadTsModule(filePath) {
  const resolved = path.resolve(filePath);
  if (cache.has(resolved)) return cache.get(resolved).exports;
  const source = fs.readFileSync(resolved, 'utf8');
  const transpiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true, jsx: ts.JsxEmit.ReactJSX },
    fileName: resolved,
  });
  const module = { exports: {} };
  cache.set(resolved, module);
  const dirname = path.dirname(resolved);
  const localRequire = (specifier) => {
    if (specifier === 'server-only') return {};
    const tsPath = resolveTsPath(specifier, dirname);
    return tsPath ? loadTsModule(tsPath) : require(specifier);
  };
  new Function('exports', 'require', 'module', '__filename', '__dirname', transpiled.outputText)(module.exports, localRequire, module, resolved, dirname);
  return module.exports;
}
const store = loadTsModule(path.join(projectRoot, 'lib/personal-ops-store.ts'));
const snapshot = store.getPersonalOpsSnapshot();
const detail = store.getPersonalOpsItemDetail('gmail:visualgraphx:security-alert-2026-02-22');
console.log(JSON.stringify({
  dataMode: snapshot.dataMode,
  warning: snapshot.warnings[0],
  overlayAvailable: snapshot.sources.overlayAvailable,
  overlayPath: snapshot.sources.overlayPath,
  capabilityReason: snapshot.capabilities.reason,
  detailDataMode: detail?.dataMode,
  firstActionReason: detail?.actions?.[0]?.reason,
}, null, 2));
NODE
```

Observed result:

```json
{
  "dataMode": "run_045_seed",
  "warning": "Seeded review mode is active. No durable `.antigravity/evidence/personal-ops/comms-board.json` overlay exists yet, so this first slice is intentionally rendering the RUN-045 seed board plus linked canonical tasks in read-only review mode.",
  "overlayAvailable": false,
  "overlayPath": "/Volumes/Storage/OpenClaw/.antigravity/evidence/personal-ops/comms-board.json",
  "capabilityReason": "Seeded review mode: the durable board overlay is missing, so this slice is intentionally frozen to the RUN-045 seed dataset with live evidence and task links but no provider writeback.",
  "detailDataMode": "run_045_seed",
  "firstActionReason": "Disabled in first-slice review mode. This ship is intentionally limited to trustworthy evidence drill-in and task-linked classification before any provider writeback exists."
}
```

### 3. Durable task/evidence path status

Command:

```sh
test -w /Volumes/Storage/OpenClaw/.antigravity && echo ANTIGRAVITY_WRITABLE || echo ANTIGRAVITY_NOT_WRITABLE
test -f /Volumes/Storage/OpenClaw/.antigravity/evidence/personal-ops/comms-board.json && echo OVERLAY_PRESENT || echo OVERLAY_MISSING
test -w /Volumes/Storage/OpenClaw/.antigravity/tasks/items/OPS-022.md && echo OPS022_WRITABLE || echo OPS022_NOT_WRITABLE
```

Observed result:

```text
ANTIGRAVITY_WRITABLE
OVERLAY_MISSING
OPS022_WRITABLE
```

## Landed Posture

The first Personal Ops slice is now honestly demoable as:

- `dataMode=run_045_seed`
- read-only review surface
- trustworthy evidence drill-in
- task-linked board classification
- no provider writeback
- no claim that a durable overlay already exists

## Remaining Risk / Exact Next Step

- The durable overlay file `/Volumes/Storage/OpenClaw/.antigravity/evidence/personal-ops/comms-board.json` is still absent.
- If the team wants to move beyond seeded review mode, the next bounded child should materialize that overlay from the current board model or replace it with a truly provider-backed source of truth.
- Do **not** reopen this task for broader personal-ops expansion; the trust-gap close for the first slice is complete.