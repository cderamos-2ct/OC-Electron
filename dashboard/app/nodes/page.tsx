"use client";

import { useState } from "react";
import { DashboardScreenLayout } from "@/components/DashboardScreenLayout";
import { useOpenClawNodes } from "@/hooks/use-openclaw-nodes";
import { useOpenClaw } from "@/contexts/OpenClawContext";
import {
  Server,
  Smartphone,
  RefreshCw,
  Loader2,
  Check,
  X,
  Trash2,
  Edit2,
  Monitor,
  AlertCircle,
} from "lucide-react";

export default function OpenClawNodesPage() {
  const { isConnected } = useOpenClaw();
  const {
    nodes,
    devices,
    loading,
    error,
    refresh,
    renameNode,
    approveDevice,
    rejectDevice,
    removeDevice,
  } = useOpenClawNodes();
  const [editingNode, setEditingNode] = useState<string | null>(null);
  const [editName, setEditName] = useState("");

  const handleRename = async (nodeId: string) => {
    if (!editName.trim()) return;
    await renameNode(nodeId, editName.trim());
    setEditingNode(null);
    setEditName("");
  };

  return (
    <DashboardScreenLayout
      screenKey="nodes"
      renderers={{
        "nodes.grid": () => (
          <section
            className="min-w-0 rounded-2xl border p-5"
            style={{ background: "var(--card)", borderColor: "var(--border)" }}
          >
            <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-xl font-semibold" style={{ color: "var(--text-primary)" }}>
                  Nodes
                </h2>
                <p className="text-sm mt-1" style={{ color: "var(--text-secondary)" }}>
                  Manage connected nodes and their capabilities
                </p>
              </div>
              <button
                onClick={refresh}
                disabled={loading}
                className="p-2 rounded-lg hover:bg-white/5 transition-colors"
                style={{ color: "var(--text-secondary)" }}
              >
                <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
              </button>
            </div>

            {error ? (
              <div className="mb-4 flex items-center gap-2 rounded-lg bg-red-500/10 px-4 py-3 text-sm text-red-500">
                <AlertCircle className="w-4 h-4" />
                {error}
              </div>
            ) : null}

            {loading && nodes.length === 0 ? (
              <Loader2 className="w-6 h-6 animate-spin" style={{ color: "var(--text-secondary)" }} />
            ) : nodes.length === 0 ? (
              <p className="text-sm" style={{ color: "var(--text-secondary)" }}>No nodes connected</p>
            ) : (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {nodes.map((node) => (
                  <div
                    key={node.id}
                    className="group min-w-0 rounded-xl border p-4"
                    style={{ background: "var(--card)", borderColor: "var(--border)" }}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg" style={{ background: "var(--background)" }}>
                          <Monitor className="w-5 h-5" style={{ color: "var(--text-secondary)" }} />
                        </div>
                        <div className="min-w-0">
                          {editingNode === node.id ? (
                            <div className="flex items-center gap-1">
                              <input
                                value={editName}
                                onChange={(e) => setEditName(e.target.value)}
                                onKeyDown={(e) => e.key === "Enter" && handleRename(node.id)}
                                className="px-2 py-0.5 rounded border bg-transparent text-sm outline-none"
                                style={{ borderColor: "var(--border)", color: "var(--text-primary)" }}
                                autoFocus
                              />
                              <button onClick={() => handleRename(node.id)}>
                                <Check className="w-3 h-3 text-green-500" />
                              </button>
                              <button onClick={() => setEditingNode(null)}>
                                <X className="w-3 h-3 text-red-400" />
                              </button>
                            </div>
                          ) : (
                            <div className="flex items-center gap-2">
                              <h3 className="truncate text-sm font-medium" style={{ color: "var(--text-primary)" }}>
                                {node.displayName || node.id}
                              </h3>
                              <button
                                onClick={() => { setEditingNode(node.id); setEditName(node.displayName || ""); }}
                                className="opacity-0 group-hover:opacity-100"
                              >
                                <Edit2 className="w-3 h-3" style={{ color: "var(--text-secondary)" }} />
                              </button>
                            </div>
                          )}
                          <p className="text-xs mt-0.5" style={{ color: "var(--text-secondary)" }}>
                            {node.platform ?? "unknown"} {node.version ? `v${node.version}` : ""}
                          </p>
                        </div>
                      </div>
                      <div
                        className={`w-2 h-2 rounded-full ${
                          node.status === "connected" || !node.status ? "bg-green-500" : "bg-gray-400"
                        }`}
                      />
                    </div>
                    {node.caps && node.caps.length > 0 ? (
                      <div className="mt-3 flex flex-wrap gap-1">
                        {node.caps.map((cap) => (
                          <span
                            key={cap}
                            className="text-[10px] px-1.5 py-0.5 rounded"
                            style={{ background: "var(--background)", color: "var(--text-secondary)" }}
                          >
                            {cap}
                          </span>
                        ))}
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            )}
          </section>
        ),
        "nodes.devices": () => (
          <section
            className="min-w-0 rounded-2xl border p-5"
            style={{ background: "var(--card)", borderColor: "var(--border)" }}
          >
            <h2 className="text-xl font-semibold mb-1" style={{ color: "var(--text-primary)" }}>
              Paired Devices
            </h2>
            <p className="mb-5 text-sm" style={{ color: "var(--text-secondary)" }}>
              Review and remove paired devices.
            </p>
            {devices.length === 0 ? (
              <p className="text-sm" style={{ color: "var(--text-secondary)" }}>No paired devices</p>
            ) : (
              <div className="space-y-2">
                {devices.map((device) => (
                  <div
                    key={device.deviceId}
                    className="flex min-w-0 items-center justify-between rounded-xl border px-4 py-3"
                    style={{ background: "var(--card)", borderColor: "var(--border)" }}
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium" style={{ color: "var(--text-primary)" }}>
                        {device.displayName || device.deviceId}
                      </p>
                      <p className="truncate text-xs" style={{ color: "var(--text-secondary)" }}>
                        {device.role} {device.platform ? `| ${device.platform}` : ""}
                      </p>
                    </div>
                    <button
                      onClick={() => removeDevice(device.deviceId)}
                      className="p-1.5 rounded-md text-red-400 hover:bg-red-500/10"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>
        ),
      }}
    />
  );
}
