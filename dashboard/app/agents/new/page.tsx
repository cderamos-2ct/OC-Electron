"use client";

export const dynamic = "force-dynamic";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useOpenClawAgents } from "@/hooks/use-openclaw-agents";
import { ArrowLeft, Save, Loader2 } from "lucide-react";

export default function NewAgentPage() {
  const router = useRouter();
  const { createAgent } = useOpenClawAgents();

  const [name, setName] = useState("");
  const [emoji, setEmoji] = useState("🤖");
  const [lane, setLane] = useState("custom");
  const [description, setDescription] = useState("");
  const [monitorSurfaces, setMonitorSurfaces] = useState("");
  const [communicationChannels, setCommunicationChannels] = useState("");
  const [modelProvider, setModelProvider] = useState("anthropic");
  const [defaultModel, setDefaultModel] = useState("");
  const [fallbackModel, setFallbackModel] = useState("");
  const [authProfile, setAuthProfile] = useState("default");
  const [reasoningLevel, setReasoningLevel] = useState("medium");
  const [canSpawnSubagents, setCanSpawnSubagents] = useState(true);
  const [subagentModel, setSubagentModel] = useState("");
  const [subagentMaxDepth, setSubagentMaxDepth] = useState("1");
  const [subagentUseCases, setSubagentUseCases] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCreate = async () => {
    if (!name.trim()) {
      setError("Name is required");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await createAgent({
        name,
        lane,
        status: "planned",
        description,
        monitorSurfaces: lines(monitorSurfaces),
        communicationChannels: lines(communicationChannels),
        modelProvider,
        defaultModel: defaultModel || null,
        fallbackModel: fallbackModel || null,
        authProfile: authProfile || null,
        reasoningLevel: reasoningLevel || null,
        canSpawnSubagents,
        subagentModel: subagentModel || null,
        subagentMaxDepth: canSpawnSubagents ? Number(subagentMaxDepth || "1") : 0,
        subagentUseCases: lines(subagentUseCases),
        identity: { name, emoji, theme: description },
      });
      router.push("/agents");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create agent");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-6 space-y-6 max-w-2xl">
      <div className="flex items-center gap-3">
        <button
          onClick={() => router.push("/agents")}
          className="p-2 rounded-lg hover:bg-white/5 transition-colors"
          style={{ color: "var(--text-secondary)" }}
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-2xl font-bold" style={{ color: "var(--text-primary)" }}>
          New Agent
        </h1>
      </div>

      {error && (
        <div className="px-4 py-3 rounded-lg bg-red-500/10 text-red-500 text-sm">
          {error}
        </div>
      )}

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>
            Name *
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="My Agent"
            className="w-full px-3 py-2 rounded-lg border bg-transparent text-sm outline-none focus:ring-2 focus:ring-blue-500/50"
            style={{ borderColor: "var(--border)", color: "var(--text-primary)" }}
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>
            Emoji
          </label>
          <input
            type="text"
            value={emoji}
            onChange={(e) => setEmoji(e.target.value)}
            className="w-20 px-3 py-2 rounded-lg border bg-transparent text-sm text-center outline-none focus:ring-2 focus:ring-blue-500/50"
            style={{ borderColor: "var(--border)", color: "var(--text-primary)" }}
            maxLength={4}
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>
            Lane
          </label>
          <input
            type="text"
            value={lane}
            onChange={(e) => setLane(e.target.value)}
            placeholder="communications"
            className="w-full px-3 py-2 rounded-lg border bg-transparent text-sm outline-none focus:ring-2 focus:ring-blue-500/50"
            style={{ borderColor: "var(--border)", color: "var(--text-primary)" }}
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>
            Purpose / Description
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={4}
            placeholder="Own inbox triage, follow-ups, and communication tasks."
            className="w-full px-3 py-2 rounded-lg border bg-transparent text-sm outline-none resize-y focus:ring-2 focus:ring-blue-500/50"
            style={{ borderColor: "var(--border)", color: "var(--text-primary)" }}
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>
            Monitored Surfaces
          </label>
          <textarea
            value={monitorSurfaces}
            onChange={(e) => setMonitorSurfaces(e.target.value)}
            rows={4}
            placeholder={"Apple Mail\nGmail API\nMicrosoft Teams"}
            className="w-full px-3 py-2 rounded-lg border bg-transparent text-sm outline-none resize-y focus:ring-2 focus:ring-blue-500/50"
            style={{ borderColor: "var(--border)", color: "var(--text-primary)" }}
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>
            Communication Channels
          </label>
          <textarea
            value={communicationChannels}
            onChange={(e) => setCommunicationChannels(e.target.value)}
            rows={4}
            placeholder={"email\nteams\nimessage"}
            className="w-full px-3 py-2 rounded-lg border bg-transparent text-sm outline-none resize-y focus:ring-2 focus:ring-blue-500/50"
            style={{ borderColor: "var(--border)", color: "var(--text-primary)" }}
          />
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <label className="block text-sm font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>
              Provider
            </label>
            <input
              type="text"
              value={modelProvider}
              onChange={(e) => setModelProvider(e.target.value)}
              placeholder="anthropic"
              className="w-full px-3 py-2 rounded-lg border bg-transparent text-sm outline-none focus:ring-2 focus:ring-blue-500/50"
              style={{ borderColor: "var(--border)", color: "var(--text-primary)" }}
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>
              Default Model
            </label>
            <input
              type="text"
              value={defaultModel}
              onChange={(e) => setDefaultModel(e.target.value)}
              placeholder="anthropic/claude-sonnet-4.6"
              className="w-full px-3 py-2 rounded-lg border bg-transparent text-sm outline-none focus:ring-2 focus:ring-blue-500/50"
              style={{ borderColor: "var(--border)", color: "var(--text-primary)" }}
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>
              Fallback Model
            </label>
            <input
              type="text"
              value={fallbackModel}
              onChange={(e) => setFallbackModel(e.target.value)}
              placeholder="openai/gpt-5-mini"
              className="w-full px-3 py-2 rounded-lg border bg-transparent text-sm outline-none focus:ring-2 focus:ring-blue-500/50"
              style={{ borderColor: "var(--border)", color: "var(--text-primary)" }}
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>
              Auth Profile
            </label>
            <input
              type="text"
              value={authProfile}
              onChange={(e) => setAuthProfile(e.target.value)}
              placeholder="default"
              className="w-full px-3 py-2 rounded-lg border bg-transparent text-sm outline-none focus:ring-2 focus:ring-blue-500/50"
              style={{ borderColor: "var(--border)", color: "var(--text-primary)" }}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <label className="block text-sm font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>
              Reasoning Level
            </label>
            <input
              type="text"
              value={reasoningLevel}
              onChange={(e) => setReasoningLevel(e.target.value)}
              placeholder="medium"
              className="w-full px-3 py-2 rounded-lg border bg-transparent text-sm outline-none focus:ring-2 focus:ring-blue-500/50"
              style={{ borderColor: "var(--border)", color: "var(--text-primary)" }}
            />
          </div>
          <label className="flex items-center gap-3 rounded-lg border px-3 py-2 text-sm" style={{ borderColor: "var(--border)", color: "var(--text-primary)" }}>
            <input
              type="checkbox"
              checked={canSpawnSubagents}
              onChange={(e) => setCanSpawnSubagents(e.target.checked)}
            />
            Allow subagents
          </label>
          <div>
            <label className="block text-sm font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>
              Subagent Model
            </label>
            <input
              type="text"
              value={subagentModel}
              onChange={(e) => setSubagentModel(e.target.value)}
              placeholder="openai/gpt-5-mini"
              className="w-full px-3 py-2 rounded-lg border bg-transparent text-sm outline-none focus:ring-2 focus:ring-blue-500/50"
              style={{ borderColor: "var(--border)", color: "var(--text-primary)" }}
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>
              Subagent Max Depth
            </label>
            <input
              type="number"
              min={0}
              max={2}
              value={subagentMaxDepth}
              onChange={(e) => setSubagentMaxDepth(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border bg-transparent text-sm outline-none focus:ring-2 focus:ring-blue-500/50"
              style={{ borderColor: "var(--border)", color: "var(--text-primary)" }}
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>
            Subagent Use Cases
          </label>
          <textarea
            value={subagentUseCases}
            onChange={(e) => setSubagentUseCases(e.target.value)}
            rows={3}
            placeholder={"parallel inbox triage\nmeeting prep workers"}
            className="w-full px-3 py-2 rounded-lg border bg-transparent text-sm outline-none resize-y focus:ring-2 focus:ring-blue-500/50"
            style={{ borderColor: "var(--border)", color: "var(--text-primary)" }}
          />
        </div>

        <div className="flex justify-end">
          <button
            onClick={handleCreate}
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium transition-colors disabled:opacity-50"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Create Agent
          </button>
        </div>
      </div>
    </div>
  );
}

function lines(value: string) {
  return value
    .split("\n")
    .map((item) => item.trim())
    .filter(Boolean);
}
