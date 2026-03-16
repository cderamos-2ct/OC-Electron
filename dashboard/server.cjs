const http = require("node:http");
const https = require("node:https");
const { spawn } = require("node:child_process");
const httpProxy = require("http-proxy");

const dev = process.env.NODE_ENV !== "production";
const host = process.env.HOST || "127.0.0.1";
const port = Number.parseInt(process.env.PORT || "3000", 10);

const APP_HOST = process.env.OPENCLAW_DASHBOARD_APP_HOST || "127.0.0.1";
const APP_PORT = Number.parseInt(
  process.env.OPENCLAW_DASHBOARD_APP_PORT || "3001",
  10,
);

if (APP_PORT === port) {
  throw new Error(
    "OPENCLAW_DASHBOARD_APP_PORT must differ from the shell PORT",
  );
}

const APP_HTTP_TARGET =
  process.env.OPENCLAW_DASHBOARD_APP_TARGET || `http://${APP_HOST}:${APP_PORT}`;
const APP_WS_TARGET =
  process.env.OPENCLAW_DASHBOARD_APP_WS_TARGET || `ws://${APP_HOST}:${APP_PORT}`;

const CONTROL_HTTP_TARGET =
  process.env.OPENCLAW_CONTROL_TARGET || "http://127.0.0.1:18789";
const CONTROL_WS_TARGET =
  process.env.OPENCLAW_CONTROL_WS_TARGET || "ws://127.0.0.1:18789";
const AGENT_DASHBOARD_TARGET =
  process.env.OPENCLAW_AGENT_DASHBOARD_TARGET || "http://127.0.0.1:18792";

const MOUNTS = {
  control: "/__mounted/control",
  agentDashboard: "/__mounted/agent-dashboard",
};

function originFromTarget(target) {
  try {
    const next = new URL(target);
    const protocol =
      next.protocol === "ws:"
        ? "http:"
        : next.protocol === "wss:"
          ? "https:"
          : next.protocol;
    return `${protocol}//${next.host}`;
  } catch {
    return target;
  }
}

function withPrefixRemoved(rawUrl, prefix) {
  const url = new URL(rawUrl || "/", "http://localhost");
  const pathname =
    url.pathname === prefix
      ? "/"
      : url.pathname.startsWith(`${prefix}/`)
        ? url.pathname.slice(prefix.length)
        : url.pathname;
  return `${pathname || "/"}${url.search}`;
}

function mountClientPatch(prefix) {
  return `
<script>
(() => {
  const mountPrefix = ${JSON.stringify(prefix)};
  const passthrough = /^(?:[a-z]+:|\\/\\/|#|data:|blob:|mailto:|tel:)/i;

  const rewriteUrl = (value) => {
    if (typeof value !== "string" || !value || passthrough.test(value)) {
      return value;
    }
    if (value.startsWith(mountPrefix + "/") || value === mountPrefix) {
      return value;
    }
    if (value.startsWith("/")) {
      return mountPrefix + value;
    }
    return value;
  };

  const originalFetch = window.fetch.bind(window);
  window.fetch = (input, init) => {
    if (typeof input === "string") {
      return originalFetch(rewriteUrl(input), init);
    }
    if (input instanceof URL) {
      return originalFetch(rewriteUrl(input.toString()), init);
    }
    return originalFetch(input, init);
  };

  const OriginalEventSource = window.EventSource;
  window.EventSource = function PatchedEventSource(url, config) {
    return new OriginalEventSource(rewriteUrl(url), config);
  };
  window.EventSource.prototype = OriginalEventSource.prototype;

  const originalXhrOpen = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function patchedOpen(method, url, ...rest) {
    return originalXhrOpen.call(this, method, rewriteUrl(url), ...rest);
  };

  const rewriteAttrs = (root) => {
    if (!(root instanceof Element || root instanceof Document)) return;
    const elements = root.querySelectorAll("[href], [src], form[action]");
    elements.forEach((element) => {
      for (const attr of ["href", "src", "action"]) {
        const value = element.getAttribute(attr);
        if (value && value.startsWith("/")) {
          element.setAttribute(attr, rewriteUrl(value));
        }
      }
    });
  };

  const observer = new MutationObserver((records) => {
    records.forEach((record) => {
      record.addedNodes.forEach((node) => {
        if (node instanceof Element) {
          rewriteAttrs(node);
        }
      });
    });
  });

  document.addEventListener("DOMContentLoaded", () => rewriteAttrs(document));
  observer.observe(document.documentElement, { childList: true, subtree: true });
})();
</script>`;
}

function injectHtml(html, prefix) {
  const patch = mountClientPatch(prefix);
  if (html.includes("</head>")) {
    return html.replace("</head>", `${patch}</head>`);
  }
  if (html.includes("</body>")) {
    return html.replace("</body>", `${patch}</body>`);
  }
  return `${patch}${html}`;
}

function rewriteLocationHeader(location, target, prefix) {
  if (typeof location !== "string" || !location) {
    return location;
  }

  if (location.startsWith("/")) {
    return `${prefix}${location}`;
  }

  try {
    const targetUrl = new URL(target);
    const nextUrl = new URL(location, targetUrl);
    const sameOrigin =
      nextUrl.protocol === targetUrl.protocol &&
      nextUrl.hostname === targetUrl.hostname &&
      nextUrl.port === targetUrl.port;

    if (sameOrigin) {
      return `${prefix}${nextUrl.pathname}${nextUrl.search}${nextUrl.hash}`;
    }
  } catch {
    return location;
  }

  return location;
}

function rewriteSetCookieHeaders(setCookie, prefix) {
  if (!setCookie) {
    return setCookie;
  }

  const values = Array.isArray(setCookie) ? setCookie : [setCookie];
  return values.map((entry) => {
    if (typeof entry !== "string") {
      return entry;
    }

    if (/(^|;\s*)Path=/i.test(entry)) {
      return entry.replace(/(^|;\s*)Path=([^;]*)/i, `$1Path=${prefix}`);
    }

    return `${entry}; Path=${prefix}`;
  });
}

function upstreamHeaders(req, targetUrl, rewriteHtml) {
  const headers = {
    ...req.headers,
    host: targetUrl.host,
  };

  if (rewriteHtml) {
    delete headers["accept-encoding"];
  }

  return headers;
}

function translateUpstreamHeaders(headers, target, prefix) {
  const nextHeaders = { ...headers };

  if (nextHeaders.location) {
    nextHeaders.location = rewriteLocationHeader(
      nextHeaders.location,
      target,
      prefix,
    );
  }

  if (nextHeaders["set-cookie"]) {
    nextHeaders["set-cookie"] = rewriteSetCookieHeaders(
      nextHeaders["set-cookie"],
      prefix,
    );
  }

  return nextHeaders;
}

function rewriteContentSecurityPolicy(policy, allowIframe) {
  if (!allowIframe || typeof policy !== "string" || !policy.trim()) {
    return policy;
  }

  const directives = policy
    .split(";")
    .map((entry) => entry.trim())
    .filter(Boolean)
    .filter((entry) => !entry.toLowerCase().startsWith("frame-ancestors"));

  directives.push("frame-ancestors 'self'");
  return directives.join("; ");
}

function rewriteEmbeddingHeaders(headers, allowIframe) {
  if (!allowIframe) {
    return headers;
  }

  const nextHeaders = { ...headers };
  const nextPolicy = rewriteContentSecurityPolicy(
    nextHeaders["content-security-policy"],
    allowIframe,
  );

  if (typeof nextPolicy === "string" && nextPolicy.trim()) {
    nextHeaders["content-security-policy"] = nextPolicy;
  } else {
    delete nextHeaders["content-security-policy"];
  }

  nextHeaders["x-frame-options"] = "SAMEORIGIN";
  return nextHeaders;
}

function writeProxyError(res, target, err) {
  if (res.headersSent) {
    res.end();
    return;
  }
  res.writeHead(502, { "Content-Type": "text/plain; charset=utf-8" });
  res.end(`Proxy error for ${target}: ${err.message}`);
}

function proxyHttp(
  req,
  res,
  { target, prefix, rewriteHtml = false, allowIframe = false },
) {
  const targetUrl = new URL(target);
  const upstreamUrl = withPrefixRemoved(req.url, prefix);
  const client = targetUrl.protocol === "https:" ? https : http;

  const upstreamReq = client.request(
    {
      protocol: targetUrl.protocol,
      hostname: targetUrl.hostname,
      port: targetUrl.port,
      method: req.method,
      path: upstreamUrl,
      headers: upstreamHeaders(req, targetUrl, rewriteHtml),
    },
    (upstreamRes) => {
      const contentType = String(upstreamRes.headers["content-type"] || "");
      const shouldInject = rewriteHtml && contentType.includes("text/html");
      const headers = rewriteEmbeddingHeaders(
        translateUpstreamHeaders(upstreamRes.headers, target, prefix),
        allowIframe,
      );

      if (!shouldInject) {
        res.writeHead(upstreamRes.statusCode || 502, headers);
        upstreamRes.pipe(res);
        return;
      }

      const chunks = [];
      upstreamRes.on("data", (chunk) => chunks.push(chunk));
      upstreamRes.on("end", () => {
        const body = Buffer.concat(chunks).toString("utf8");
        delete headers["content-length"];
        const patched = injectHtml(body, prefix);
        res.writeHead(upstreamRes.statusCode || 200, headers);
        res.end(patched);
      });
    },
  );

  upstreamReq.on("error", (err) => writeProxyError(res, target, err));
  req.pipe(upstreamReq);
}

function pipeChildOutput(stream, label, writer) {
  if (!stream) {
    return;
  }

  stream.on("data", (chunk) => {
    const text = String(chunk);
    if (!text.trim()) {
      return;
    }
    const lines = text.replace(/\n$/, "").split("\n");
    for (const line of lines) {
      writer(`[${label}] ${line}\n`);
    }
  });
}

let dashboardChild = null;
let dashboardRestartTimer = null;
let shuttingDown = false;
let dashboardRestartDelayMs = 1000;

function clearDashboardRestartTimer() {
  if (dashboardRestartTimer) {
    clearTimeout(dashboardRestartTimer);
    dashboardRestartTimer = null;
  }
}

function scheduleDashboardRestart() {
  if (shuttingDown || process.env.OPENCLAW_DASHBOARD_EXTERNAL_APP === "1") {
    return;
  }

  clearDashboardRestartTimer();
  const delay = dashboardRestartDelayMs;
  dashboardRestartDelayMs = Math.min(dashboardRestartDelayMs * 2, 15000);
  console.log(`[dashboard-app] scheduling restart in ${delay}ms`);
  dashboardRestartTimer = setTimeout(() => {
    dashboardRestartTimer = null;
    startDashboardApp();
  }, delay);
}

function startDashboardApp() {
  if (dashboardChild && !dashboardChild.killed) {
    return dashboardChild;
  }

  if (process.env.OPENCLAW_DASHBOARD_EXTERNAL_APP === "1") {
    console.log("[dashboard-app] using external app target:", APP_HTTP_TARGET);
    return null;
  }

  clearDashboardRestartTimer();
  const nextCli = require.resolve("next/dist/bin/next");
  const args = [
    nextCli,
    dev ? "dev" : "start",
    "--hostname",
    APP_HOST,
    "--port",
    String(APP_PORT),
  ];

  const child = spawn(process.execPath, args, {
    cwd: __dirname,
    env: {
      ...process.env,
      HOST: APP_HOST,
      PORT: String(APP_PORT),
    },
    stdio: ["ignore", "pipe", "pipe"],
  });

  dashboardChild = child;
  pipeChildOutput(child.stdout, "dashboard-app", (line) => process.stdout.write(line));
  pipeChildOutput(child.stderr, "dashboard-app", (line) => process.stderr.write(line));

  child.on("exit", (code, signal) => {
    dashboardChild = null;
    console.log(
      `[dashboard-app] exited with code=${code ?? "null"} signal=${signal ?? "null"}`,
    );
    if (!shuttingDown) {
      scheduleDashboardRestart();
      return;
    }
  });

  dashboardRestartDelayMs = 1000;
  return child;
}

const controlWsProxy = httpProxy.createProxyServer({
  target: CONTROL_WS_TARGET,
  changeOrigin: false,
  secure: false,
  ws: true,
  xfwd: true,
});

controlWsProxy.on("error", (error, _req, socket) => {
  console.error("[ws-proxy:error]", error?.message || error);
  if (socket && socket.writable) {
    socket.end("HTTP/1.1 502 Bad Gateway\r\n\r\n");
  }
});

const appHttpProxy = httpProxy.createProxyServer({
  target: APP_HTTP_TARGET,
  changeOrigin: true,
  secure: false,
  xfwd: true,
});

appHttpProxy.on("error", (error, req, res) => {
  writeProxyError(res, APP_HTTP_TARGET, error);
});

const appWsProxy = httpProxy.createProxyServer({
  target: APP_WS_TARGET,
  changeOrigin: true,
  secure: false,
  ws: true,
  xfwd: true,
});

appWsProxy.on("error", (error, _req, socket) => {
  if (socket && socket.writable) {
    socket.end("HTTP/1.1 502 Bad Gateway\r\n\r\n");
  }
  console.error("[app-ws-proxy:error]", error?.message || error);
});

startDashboardApp();

const server = http.createServer((req, res) => {
  const url = req.url || "/";

  if (url.startsWith(MOUNTS.control)) {
    proxyHttp(req, res, {
      target: CONTROL_HTTP_TARGET,
      prefix: MOUNTS.control,
      allowIframe: true,
    });
    return;
  }

  if (url.startsWith("/__mounted/lobsterboard")) {
    res.statusCode = 410;
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    res.end("LobsterBoard mount retired");
    return;
  }

  if (url.startsWith(MOUNTS.agentDashboard)) {
    proxyHttp(req, res, {
      target: AGENT_DASHBOARD_TARGET,
      prefix: MOUNTS.agentDashboard,
      rewriteHtml: true,
      allowIframe: true,
    });
    return;
  }

  appHttpProxy.web(req, res);
});

server.on("upgrade", (req, socket, head) => {
  if ((req.url || "").startsWith(MOUNTS.control)) {
    req.url = withPrefixRemoved(req.url, MOUNTS.control);
    controlWsProxy.ws(req, socket, head);
    return;
  }

  appWsProxy.ws(req, socket, head);
});

server.listen(port, host, () => {
  console.log(
    `openclaw-dashboard shell listening on http://${host}:${port} (dev=${dev})`,
  );
  console.log(`dashboard app target: ${APP_HTTP_TARGET}`);
  console.log(`control-ui mount: ${MOUNTS.control} -> ${CONTROL_HTTP_TARGET}`);
  console.log(
    `agent-dashboard mount: ${MOUNTS.agentDashboard} -> ${AGENT_DASHBOARD_TARGET}`,
  );
});

function shutdown() {
  shuttingDown = true;
  clearDashboardRestartTimer();
  server.close();
  if (dashboardChild && !dashboardChild.killed) {
    dashboardChild.kill("SIGTERM");
  }
}

process.on("SIGINT", () => {
  shutdown();
  process.exit(0);
});

process.on("SIGTERM", () => {
  shutdown();
  process.exit(0);
});
