#!/usr/bin/env node

/**
 * OpenClaw Fireflies Tools — MCP Server
 *
 * Connects to Fireflies.ai GraphQL API to pull meeting transcripts,
 * summaries, and action items. Ada (Notes agent) uses this for full
 * meeting processing instead of relying on email recap summaries.
 *
 * Auth: Bearer token from FIREFLIES_API_KEY env var or
 *       /Volumes/Storage/OpenClaw/.secrets/fireflies_api_key.txt
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { readFileSync } from "fs";

const API_URL = "https://api.fireflies.ai/graphql";
const API_KEY_PATHS = [
  "/Volumes/Storage/OpenClaw/.secrets/fireflies_api_key.txt",
];

function getApiKey() {
  if (process.env.FIREFLIES_API_KEY) return process.env.FIREFLIES_API_KEY.trim();
  for (const p of API_KEY_PATHS) {
    try {
      return readFileSync(p, "utf-8").trim();
    } catch {}
  }
  throw new Error("Fireflies API key not found. Set FIREFLIES_API_KEY or place key in .secrets/fireflies_api_key.txt");
}

async function graphql(query, variables = {}) {
  const apiKey = getApiKey();
  const res = await fetch(API_URL, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query, variables }),
  });

  if (!res.ok) {
    throw new Error(`Fireflies API error: ${res.status} ${res.statusText}`);
  }

  const data = await res.json();
  if (data.errors) {
    throw new Error(`GraphQL error: ${data.errors.map(e => e.message).join(", ")}`);
  }
  return data.data;
}

// --- Tool Definitions ---

const TOOLS = [
  {
    name: "fireflies_list_meetings",
    description:
      "List recent meetings recorded by Fireflies. Returns title, date, duration, and participants for each meeting.",
    inputSchema: {
      type: "object",
      properties: {
        limit: {
          type: "number",
          description: "Max meetings to return (default 20)",
        },
      },
    },
  },
  {
    name: "fireflies_get_transcript",
    description:
      "Get the full transcript for a meeting by its Fireflies ID. Returns speaker-attributed sentences with timestamps.",
    inputSchema: {
      type: "object",
      properties: {
        id: {
          type: "string",
          description: "The Fireflies transcript ID (from fireflies_list_meetings)",
        },
      },
      required: ["id"],
    },
  },
  {
    name: "fireflies_get_summary",
    description:
      "Get the AI-generated summary, action items, and key topics for a meeting. Lighter than full transcript.",
    inputSchema: {
      type: "object",
      properties: {
        id: {
          type: "string",
          description: "The Fireflies transcript ID",
        },
      },
      required: ["id"],
    },
  },
  {
    name: "fireflies_search",
    description:
      "Search across all meeting transcripts for specific terms or topics.",
    inputSchema: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "Search query (e.g., 'Buckner site', 'action items', 'budget')",
        },
        limit: {
          type: "number",
          description: "Max results (default 10)",
        },
      },
      required: ["query"],
    },
  },
];

// --- Tool Handlers ---

async function handleListMeetings(args) {
  const limit = args.limit || 20;
  const data = await graphql(`
    {
      transcripts {
        id
        title
        date
        duration
        organizer_email
        participants
        transcript_url
      }
    }
  `);

  const meetings = (data.transcripts || []).slice(0, limit).map(t => ({
    id: t.id,
    title: t.title,
    date: t.date ? new Date(t.date).toISOString() : null,
    duration_minutes: t.duration ? Math.round(t.duration) : null,
    organizer: t.organizer_email,
    participants: t.participants || [],
    url: t.transcript_url,
  }));

  return { meetings, count: meetings.length };
}

async function handleGetTranscript(args) {
  const data = await graphql(`
    query($id: String!) {
      transcript(id: $id) {
        id
        title
        date
        duration
        organizer_email
        participants
        sentences {
          speaker_name
          text
          start_time
          end_time
        }
        summary {
          overview
          action_items
        }
      }
    }
  `, { id: args.id });

  const t = data.transcript;
  if (!t) throw new Error(`Transcript not found: ${args.id}`);

  return {
    id: t.id,
    title: t.title,
    date: t.date ? new Date(t.date).toISOString() : null,
    duration_minutes: t.duration ? Math.round(t.duration) : null,
    organizer: t.organizer_email,
    participants: t.participants || [],
    sentences: (t.sentences || []).map(s => ({
      speaker: s.speaker_name,
      text: s.text,
      start: s.start_time,
      end: s.end_time,
    })),
    summary: t.summary?.overview || null,
    action_items: t.summary?.action_items || [],
  };
}

async function handleGetSummary(args) {
  const data = await graphql(`
    query($id: String!) {
      transcript(id: $id) {
        id
        title
        date
        duration
        participants
        summary {
          overview
          action_items
          keywords
          outline
          shorthand_bullet
        }
      }
    }
  `, { id: args.id });

  const t = data.transcript;
  if (!t) throw new Error(`Transcript not found: ${args.id}`);

  return {
    id: t.id,
    title: t.title,
    date: t.date ? new Date(t.date).toISOString() : null,
    duration_minutes: t.duration ? Math.round(t.duration) : null,
    participants: t.participants || [],
    overview: t.summary?.overview || null,
    action_items: t.summary?.action_items || [],
    keywords: t.summary?.keywords || [],
    outline: t.summary?.outline || [],
    bullets: t.summary?.shorthand_bullet || [],
  };
}

async function handleSearch(args) {
  // Fireflies doesn't have a native search endpoint in their public GraphQL API,
  // so we pull recent transcripts and filter client-side
  const data = await graphql(`
    {
      transcripts {
        id
        title
        date
        duration
        participants
        summary {
          overview
          action_items
          keywords
        }
      }
    }
  `);

  const query = args.query.toLowerCase();
  const limit = args.limit || 10;

  const matches = (data.transcripts || [])
    .filter(t => {
      const searchable = [
        t.title,
        t.summary?.overview,
        ...(t.summary?.action_items || []),
        ...(t.summary?.keywords || []),
        ...(t.participants || []),
      ].filter(Boolean).join(" ").toLowerCase();
      return searchable.includes(query);
    })
    .slice(0, limit)
    .map(t => ({
      id: t.id,
      title: t.title,
      date: t.date ? new Date(t.date).toISOString() : null,
      duration_minutes: t.duration ? Math.round(t.duration) : null,
      participants: t.participants || [],
      overview: t.summary?.overview || null,
      matching_action_items: (t.summary?.action_items || [])
        .filter(ai => ai.toLowerCase().includes(query)),
    }));

  return { query: args.query, matches, count: matches.length };
}

// --- Server ---

const server = new Server(
  { name: "openclaw-fireflies", version: "1.0.0" },
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
      case "fireflies_list_meetings":
        result = await handleListMeetings(args || {});
        break;
      case "fireflies_get_transcript":
        result = await handleGetTranscript(args);
        break;
      case "fireflies_get_summary":
        result = await handleGetSummary(args);
        break;
      case "fireflies_search":
        result = await handleSearch(args);
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
      content: [{ type: "text", text: JSON.stringify({ error: true, message: error.message }) }],
      isError: true,
    };
  }
});

const transport = new StdioServerTransport();
await server.connect(transport);
