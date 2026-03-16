# Cloudflare Tunnel — OpenClaw

Exposes the local OpenClaw gateway and web apps to the internet via
Cloudflare Tunnel (no open inbound firewall ports required).

## Endpoints

| Hostname | Local service | Purpose |
|---|---|---|
| `gateway.openclaw.io` | `ws://localhost:18789` | Gateway WebSocket (WS → WSS) |
| `app.openclaw.io` | `http://localhost:3000` | Dashboard / Next.js app |
| `mobile.openclaw.io` | `http://localhost:3002` | Mobile PWA (Vite) |

## Prerequisites

```bash
# Install cloudflared
brew install cloudflared

# Authenticate with your Cloudflare account
cloudflared tunnel login
```

## First-time setup

```bash
# 1. Create the tunnel (prints a UUID — save it)
cloudflared tunnel create openclaw

# 2. Edit tunnel-config.yaml — replace <TUNNEL_ID> with the UUID above

# 3. Add DNS CNAME records for each hostname
cloudflared tunnel route dns openclaw gateway.openclaw.io
cloudflared tunnel route dns openclaw app.openclaw.io
cloudflared tunnel route dns openclaw mobile.openclaw.io
```

## Running

```bash
# From the repo root
cloudflared tunnel --config apps/openclaw-shell/cloudflare/tunnel-config.yaml run

# Or use the helper script (starts tunnel + dev servers together)
pnpm --filter openclaw-shell dev:tunnel
```

## Notes

- The tunnel automatically upgrades `ws://` → `wss://` for the gateway.
- The credentials file (`~/.cloudflared/<TUNNEL_ID>.json`) is created by
  `cloudflared tunnel create` and should **not** be committed to git.
- To stop, press `Ctrl+C`. The tunnel is stateless — restarting is safe.
- For Tailscale users: you can also connect via `ws://<tailscale-ip>:18789`
  without the tunnel. Use the `?gateway=` query param or localStorage override
  to switch endpoints at runtime.
