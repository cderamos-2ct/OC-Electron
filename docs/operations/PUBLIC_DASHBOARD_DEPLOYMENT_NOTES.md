# Public Dashboard Deployment Notes

## Purpose
Document the split between local dashboard health and public dashboard health for the real Next.js dashboard-lab app behind `cd.visualgraphx.com`.

## Current understanding

### Local runtime on the Mac
Confirmed working:
- shell server: `127.0.0.1:3000`
- Next app server: `127.0.0.1:3001`
- OpenClaw gateway: `127.0.0.1:18789`
- mounted control path works locally:
  - `http://127.0.0.1:3000/__mounted/control` → `200 OK`

### Public runtime
Observed earlier:
- `https://cd.visualgraphx.com` served the shell HTML
- but mounted/backend routes returned `502`

## Practical conclusion
The local proxy/runtime chain in the dashboard-lab app appears coherent.
That means a public failure at `cd.visualgraphx.com` should not automatically be blamed on the local shell app itself.

The likely split is:
- local shell/proxy/runtime = healthy enough
- public routing/deployment path to that shell = unhealthy, stale, or mismatched

## Rule for future debugging
Always distinguish:
1. **local shell health**
2. **local mounted-control health**
3. **public shell reachability**
4. **public mounted-control/backend reachability**

Do not flatten these into one "dashboard is up/down" statement.
