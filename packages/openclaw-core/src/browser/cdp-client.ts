/** CDP Client Wrapper - wraps Electron webContents.debugger API. */

export interface CDPDebugger {
  attach(protocolVersion: string): void;
  detach(): void;
  sendCommand(method: string, params?: Record<string, unknown>): Promise<unknown>;
  isAttached(): boolean;
}

export interface CDPClientOptions {
  /** Protocol version to request on attach. Defaults to '1.3'. */
  protocolVersion?: string;
}

export interface CDPScreenshot {
  /** Base64-encoded PNG data. */
  data: string;
  mimeType: 'image/png';
}

export interface CDPEvalResult {
  value: unknown;
  type: string;
  wasThrown?: boolean;
  exceptionMessage?: string;
}

export interface CDPNodeInfo {
  nodeId: number;
  backendNodeId: number;
  nodeName: string;
  nodeType: number;
  attributes: string[];
  childNodeCount?: number;
  children?: CDPNodeInfo[];
}

// ─── Client ──────────────────────────────────────────────────────────────────

export class CDPClient {
  private dbg: CDPDebugger;
  private protocolVersion: string;
  private attached = false;

  constructor(debugger_: CDPDebugger, options: CDPClientOptions = {}) {
    this.dbg = debugger_;
    this.protocolVersion = options.protocolVersion ?? '1.3';
  }

  // ── Lifecycle ──────────────────────────────────────────────────────

  attach(): void {
    if (this.attached) return;
    this.dbg.attach(this.protocolVersion);
    this.attached = true;
  }

  detach(): void {
    if (!this.attached) return;
    try {
      this.dbg.detach();
    } finally {
      this.attached = false;
    }
  }

  isAttached(): boolean {
    return this.attached;
  }

  // ── Navigation ─────────────────────────────────────────────────────

  async navigate(url: string): Promise<void> {
    await this.send('Page.navigate', { url });
  }

  // ── DOM Querying ───────────────────────────────────────────────────

  /**
   * Returns the backend node ID for the first element matching `selector`,
   * or null if not found.
   */
  async querySelector(selector: string): Promise<number | null> {
    const doc = await this.send('DOM.getDocument', { depth: 0 }) as {
      root: { nodeId: number };
    };
    const result = await this.send('DOM.querySelector', {
      nodeId: doc.root.nodeId,
      selector,
    }) as { nodeId: number };

    return result.nodeId > 0 ? result.nodeId : null;
  }

  /**
   * Returns the full document snapshot as CDPNodeInfo.
   */
  async getDocument(depth = 2): Promise<CDPNodeInfo> {
    const result = await this.send('DOM.getDocument', { depth }) as {
      root: CDPNodeInfo;
    };
    return result.root;
  }

  // ── Interaction ────────────────────────────────────────────────────

  async click(selector: string): Promise<boolean> {
    const nodeId = await this.querySelector(selector);
    if (nodeId === null) return false;

    // Resolve to object, then dispatch click via Runtime
    const obj = await this.send('DOM.resolveNode', { nodeId }) as {
      object: { objectId: string };
    };
    await this.send('Runtime.callFunctionOn', {
      objectId: obj.object.objectId,
      functionDeclaration: 'function() { this.click(); }',
      silent: true,
    });
    return true;
  }

  async fill(selector: string, value: string): Promise<boolean> {
    const nodeId = await this.querySelector(selector);
    if (nodeId === null) return false;

    const obj = await this.send('DOM.resolveNode', { nodeId }) as {
      object: { objectId: string };
    };
    // Use native value setter to trigger React/Vue synthetic events
    await this.send('Runtime.callFunctionOn', {
      objectId: obj.object.objectId,
      functionDeclaration: `function(v) {
        const nativeSetter =
          Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set ||
          Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')?.set;
        if (nativeSetter) nativeSetter.call(this, v);
        else this.value = v;
        this.dispatchEvent(new Event('input', { bubbles: true }));
        this.dispatchEvent(new Event('change', { bubbles: true }));
      }`,
      arguments: [{ value }],
      silent: true,
    });
    return true;
  }

  // ── Scrolling ──────────────────────────────────────────────────────

  async scroll(selector: string | null, deltaY = 300): Promise<boolean> {
    if (selector) {
      const nodeId = await this.querySelector(selector);
      if (nodeId === null) return false;

      const obj = await this.send('DOM.resolveNode', { nodeId }) as {
        object: { objectId: string };
      };
      await this.send('Runtime.callFunctionOn', {
        objectId: obj.object.objectId,
        functionDeclaration: `function(dy) { this.scrollBy({ top: dy, behavior: 'smooth' }); }`,
        arguments: [{ value: deltaY }],
        silent: true,
      });
    } else {
      await this.evaluate(`window.scrollBy({ top: ${deltaY}, behavior: 'smooth' })`);
    }
    return true;
  }

  // ── JavaScript Evaluation ──────────────────────────────────────────

  async evaluate(expression: string): Promise<CDPEvalResult> {
    const result = await this.send('Runtime.evaluate', {
      expression,
      returnByValue: true,
      awaitPromise: true,
      silent: false,
    }) as {
      result: { value: unknown; type: string };
      exceptionDetails?: { text: string };
    };

    if (result.exceptionDetails) {
      return {
        value: undefined,
        type: 'undefined',
        wasThrown: true,
        exceptionMessage: result.exceptionDetails.text,
      };
    }

    return {
      value: result.result.value,
      type: result.result.type,
      wasThrown: false,
    };
  }

  // ── Screenshot ─────────────────────────────────────────────────────

  async screenshot(): Promise<CDPScreenshot> {
    const result = await this.send('Page.captureScreenshot', {
      format: 'png',
    }) as { data: string };

    return {
      data: result.data,
      mimeType: 'image/png',
    };
  }

  // ── Network Interception ───────────────────────────────────────────

  async enableNetworkInterception(): Promise<void> {
    await this.send('Network.enable', {});
    await this.send('Fetch.enable', {
      patterns: [{ urlPattern: '*' }],
    });
  }

  // ── Wait for Selector ──────────────────────────────────────────────

  /**
   * Polls until `selector` appears in the DOM or `timeoutMs` elapses.
   * Returns true if found, false on timeout.
   */
  async waitForSelector(selector: string, timeoutMs = 5000, intervalMs = 200): Promise<boolean> {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      const nodeId = await this.querySelector(selector);
      if (nodeId !== null) return true;
      await sleep(intervalMs);
    }
    return false;
  }

  // ── Internal ───────────────────────────────────────────────────────

  private async send(method: string, params: Record<string, unknown> = {}): Promise<unknown> {
    return this.dbg.sendCommand(method, params);
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
