#!/usr/bin/env node

/**
 * OpenClaw Gmail Tools — Minimal MCP Server
 *
 * Adds the missing Gmail capabilities that the managed Anthropic connector lacks:
 *   - modify_labels: Add/remove labels on messages (enables archiving, marking read)
 *   - send_draft: Send an existing draft by draft ID
 *   - delete_draft: Delete a draft by draft ID
 *   - batch_modify_labels: Modify labels on multiple messages at once
 *
 * Auth: Uses OAuth2 credentials from ~/.gmail-mcp/gcp-oauth.keys.json
 *        and tokens from ~/.gmail-mcp/credentials.json
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { google } from "googleapis";
import { readFile, writeFile, mkdir } from "fs/promises";
import { join } from "path";
import { homedir } from "os";

const CONFIG_DIR = join(homedir(), ".gmail-mcp");
const OAUTH_KEYS_PATH = join(CONFIG_DIR, "gcp-oauth.keys.json");
const CREDENTIALS_PATH = join(CONFIG_DIR, "credentials.json");

const SCOPES = [
  "https://www.googleapis.com/auth/gmail.modify",
  "https://www.googleapis.com/auth/gmail.send",
  "https://www.googleapis.com/auth/gmail.readonly",
];

// --- Auth ---

async function loadOAuthClient() {
  let keys;
  try {
    const raw = await readFile(OAUTH_KEYS_PATH, "utf-8");
    keys = JSON.parse(raw);
  } catch {
    throw new Error(
      `OAuth keys not found at ${OAUTH_KEYS_PATH}. ` +
      `Run: node ${import.meta.url} auth`
    );
  }

  // Handle both formats: {installed: {...}} and {web: {...}}
  const creds = keys.installed || keys.web;
  if (!creds) throw new Error("Invalid OAuth keys format");

  const oauth2 = new google.auth.OAuth2(
    creds.client_id,
    creds.client_secret,
    creds.redirect_uris?.[0] || "http://localhost:3000/oauth2callback"
  );

  // Try to load saved tokens
  try {
    const tokenRaw = await readFile(CREDENTIALS_PATH, "utf-8");
    const tokens = JSON.parse(tokenRaw);
    oauth2.setCredentials(tokens);

    // Auto-refresh if expired
    oauth2.on("tokens", async (newTokens) => {
      const existing = JSON.parse(await readFile(CREDENTIALS_PATH, "utf-8"));
      const merged = { ...existing, ...newTokens };
      await writeFile(CREDENTIALS_PATH, JSON.stringify(merged, null, 2));
    });
  } catch {
    throw new Error(
      `No saved credentials at ${CREDENTIALS_PATH}. ` +
      `Run: node ${import.meta.url} auth`
    );
  }

  return oauth2;
}

async function runAuthFlow() {
  let keys;
  try {
    const raw = await readFile(OAUTH_KEYS_PATH, "utf-8");
    keys = JSON.parse(raw);
  } catch {
    console.error(`\nOAuth keys not found at ${OAUTH_KEYS_PATH}`);
    console.error("\nSetup steps:");
    console.error("1. Go to Google Cloud Console → APIs & Services → Credentials");
    console.error("2. Create OAuth 2.0 Client ID (Desktop application)");
    console.error("3. Download the JSON file");
    console.error(`4. Save it as ${OAUTH_KEYS_PATH}`);
    console.error("5. Make sure Gmail API is enabled in your project");
    console.error("6. Run this command again\n");
    process.exit(1);
  }

  const REDIRECT_PORT = 3000;
  const REDIRECT_URI = `http://localhost:${REDIRECT_PORT}`;

  const creds = keys.installed || keys.web;
  const oauth2 = new google.auth.OAuth2(
    creds.client_id,
    creds.client_secret,
    REDIRECT_URI
  );

  const authUrl = oauth2.generateAuthUrl({
    access_type: "offline",
    scope: SCOPES,
    prompt: "consent",
  });

  console.log("\nStarting local OAuth callback server...");
  console.log(`\nOpen this URL in your browser:\n`);
  console.log(authUrl);
  console.log("\nWaiting for authorization...\n");

  // Start a local HTTP server to catch the OAuth callback
  const { createServer } = await import("http");
  const { URL } = await import("url");

  const code = await new Promise((resolve, reject) => {
    const server = createServer((req, res) => {
      const url = new URL(req.url, `http://localhost:${REDIRECT_PORT}`);
      const authCode = url.searchParams.get("code");
      const error = url.searchParams.get("error");

      if (error) {
        res.writeHead(200, { "Content-Type": "text/html" });
        res.end("<h1>Authorization Failed</h1><p>Error: " + error + "</p><p>You can close this tab.</p>");
        server.close();
        reject(new Error(`OAuth error: ${error}`));
        return;
      }

      if (authCode) {
        res.writeHead(200, { "Content-Type": "text/html" });
        res.end("<h1>Authorization Successful!</h1><p>You can close this tab and return to the terminal.</p>");
        server.close();
        resolve(authCode);
        return;
      }

      res.writeHead(404);
      res.end("Not found");
    });

    server.listen(REDIRECT_PORT, () => {
      console.log(`Callback server listening on port ${REDIRECT_PORT}`);
    });

    // Timeout after 5 minutes
    setTimeout(() => {
      server.close();
      reject(new Error("OAuth authorization timed out after 5 minutes"));
    }, 300000);
  });

  const { tokens } = await oauth2.getToken(code);
  await mkdir(CONFIG_DIR, { recursive: true });
  await writeFile(CREDENTIALS_PATH, JSON.stringify(tokens, null, 2));
  console.log(`\nCredentials saved to ${CREDENTIALS_PATH}`);
  console.log("Gmail Tools MCP server is ready to use.\n");
}

// --- Tool Definitions ---

const TOOLS = [
  {
    name: "gmail_modify_labels",
    description:
      "Add or remove labels from a Gmail message. Use removeLabelIds: ['INBOX'] to archive. " +
      "Use removeLabelIds: ['UNREAD'] to mark as read. Use addLabelIds to apply labels.",
    inputSchema: {
      type: "object",
      properties: {
        messageId: {
          type: "string",
          description: "The Gmail message ID",
        },
        addLabelIds: {
          type: "array",
          items: { type: "string" },
          description: "Label IDs to add (e.g., ['STARRED', 'Label_123'])",
        },
        removeLabelIds: {
          type: "array",
          items: { type: "string" },
          description:
            "Label IDs to remove (e.g., ['INBOX', 'UNREAD'] to archive and mark read)",
        },
      },
      required: ["messageId"],
    },
  },
  {
    name: "gmail_batch_modify_labels",
    description:
      "Add or remove labels from multiple Gmail messages at once. Efficient for bulk operations " +
      "like archiving all proof notifications.",
    inputSchema: {
      type: "object",
      properties: {
        messageIds: {
          type: "array",
          items: { type: "string" },
          description: "Array of Gmail message IDs to modify",
        },
        addLabelIds: {
          type: "array",
          items: { type: "string" },
          description: "Label IDs to add to all messages",
        },
        removeLabelIds: {
          type: "array",
          items: { type: "string" },
          description: "Label IDs to remove from all messages",
        },
      },
      required: ["messageIds"],
    },
  },
  {
    name: "gmail_send_draft",
    description:
      "Send an existing Gmail draft by its draft ID. The draft is sent and removed from the drafts folder.",
    inputSchema: {
      type: "object",
      properties: {
        draftId: {
          type: "string",
          description:
            "The draft ID (from gmail_list_drafts). Note: this is the draft ID, not the message ID.",
        },
      },
      required: ["draftId"],
    },
  },
  {
    name: "gmail_delete_draft",
    description: "Permanently delete a Gmail draft by its draft ID.",
    inputSchema: {
      type: "object",
      properties: {
        draftId: {
          type: "string",
          description: "The draft ID to delete",
        },
      },
      required: ["draftId"],
    },
  },
  {
    name: "gmail_get_draft",
    description: "Read the full content of a Gmail draft by its draft ID.",
    inputSchema: {
      type: "object",
      properties: {
        draftId: {
          type: "string",
          description: "The draft ID to read",
        },
      },
      required: ["draftId"],
    },
  },
];

// --- Tool Handlers ---

async function handleModifyLabels(gmail, args) {
  const { messageId, addLabelIds = [], removeLabelIds = [] } = args;

  const result = await gmail.users.messages.modify({
    userId: "me",
    id: messageId,
    requestBody: { addLabelIds, removeLabelIds },
  });

  return {
    success: true,
    messageId: result.data.id,
    labelIds: result.data.labelIds,
    summary: `Modified labels on message ${messageId}. ` +
      (addLabelIds.length ? `Added: ${addLabelIds.join(", ")}. ` : "") +
      (removeLabelIds.length ? `Removed: ${removeLabelIds.join(", ")}.` : ""),
  };
}

async function handleBatchModifyLabels(gmail, args) {
  const { messageIds, addLabelIds = [], removeLabelIds = [] } = args;

  // Gmail API has batchModify but it's on users.messages
  await gmail.users.messages.batchModify({
    userId: "me",
    requestBody: {
      ids: messageIds,
      addLabelIds,
      removeLabelIds,
    },
  });

  return {
    success: true,
    count: messageIds.length,
    summary: `Modified labels on ${messageIds.length} messages. ` +
      (addLabelIds.length ? `Added: ${addLabelIds.join(", ")}. ` : "") +
      (removeLabelIds.length ? `Removed: ${removeLabelIds.join(", ")}.` : ""),
  };
}

async function handleSendDraft(gmail, args) {
  const { draftId } = args;

  const result = await gmail.users.drafts.send({
    userId: "me",
    requestBody: { id: draftId },
  });

  const headers = {};
  if (result.data.message?.payload?.headers) {
    for (const h of result.data.message.payload.headers) {
      if (["To", "Subject", "From"].includes(h.name)) {
        headers[h.name] = h.value;
      }
    }
  }

  return {
    success: true,
    messageId: result.data.message?.id,
    threadId: result.data.message?.threadId,
    summary: `Draft sent successfully. To: ${headers.To || "unknown"}, Subject: ${headers.Subject || "unknown"}`,
  };
}

async function handleDeleteDraft(gmail, args) {
  const { draftId } = args;

  await gmail.users.drafts.delete({
    userId: "me",
    id: draftId,
  });

  return {
    success: true,
    summary: `Draft ${draftId} permanently deleted.`,
  };
}

async function handleGetDraft(gmail, args) {
  const { draftId } = args;

  const result = await gmail.users.drafts.get({
    userId: "me",
    id: draftId,
    format: "full",
  });

  const draft = result.data;
  const message = draft.message;
  const headers = {};

  if (message?.payload?.headers) {
    for (const h of message.payload.headers) {
      headers[h.name] = h.value;
    }
  }

  // Extract body
  let body = "";
  const payload = message?.payload;

  if (payload) {
    if (payload.body?.data) {
      body = Buffer.from(payload.body.data, "base64url").toString("utf-8");
    } else if (payload.parts) {
      for (const part of payload.parts) {
        if (part.mimeType === "text/plain" && part.body?.data) {
          body = Buffer.from(part.body.data, "base64url").toString("utf-8");
          break;
        }
      }
      // Fall back to HTML if no plain text
      if (!body) {
        for (const part of payload.parts) {
          if (part.mimeType === "text/html" && part.body?.data) {
            body = Buffer.from(part.body.data, "base64url").toString("utf-8");
            break;
          }
        }
      }
    }
  }

  return {
    draftId: draft.id,
    messageId: message?.id,
    threadId: message?.threadId,
    to: headers["To"] || "",
    from: headers["From"] || "",
    subject: headers["Subject"] || "",
    date: headers["Date"] || "",
    cc: headers["Cc"] || "",
    bcc: headers["Bcc"] || "",
    body,
  };
}

// --- Server ---

async function main() {
  // Handle auth subcommand
  if (process.argv[2] === "auth") {
    await runAuthFlow();
    return;
  }

  const auth = await loadOAuthClient();
  const gmail = google.gmail({ version: "v1", auth });

  const server = new Server(
    { name: "openclaw-gmail-tools", version: "1.0.0" },
    { capabilities: { tools: {} } }
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: TOOLS,
  }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    try {
      let result;
      switch (name) {
        case "gmail_modify_labels":
          result = await handleModifyLabels(gmail, args);
          break;
        case "gmail_batch_modify_labels":
          result = await handleBatchModifyLabels(gmail, args);
          break;
        case "gmail_send_draft":
          result = await handleSendDraft(gmail, args);
          break;
        case "gmail_delete_draft":
          result = await handleDeleteDraft(gmail, args);
          break;
        case "gmail_get_draft":
          result = await handleGetDraft(gmail, args);
          break;
        default:
          return {
            content: [{ type: "text", text: `Unknown tool: ${name}` }],
            isError: true,
          };
      }

      return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              error: true,
              message: error.message,
              code: error.code,
              details: error.errors?.[0]?.message,
            }),
          },
        ],
        isError: true,
      };
    }
  });

  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  console.error("Fatal:", err.message);
  process.exit(1);
});
