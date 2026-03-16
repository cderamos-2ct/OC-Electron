"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { DashboardScreenLayout } from "@/components/DashboardScreenLayout";
import { useOpenClaw } from "@/contexts/OpenClawContext";
import {
  Radio,
  RefreshCw,
  Loader2,
  LogOut,
  Wifi,
  WifiOff,
  AlertCircle,
  AlertTriangle,
  QrCode,
  X,
  CheckCircle2,
  Smartphone,
  Link2,
} from "lucide-react";
import type { ChannelMeta, ChannelDetail } from "@/lib/types";

type QRState =
  | { step: "idle" }
  | { step: "loading" }
  | { step: "showing"; qrDataUrl: string; message?: string }
  | { step: "waiting"; message?: string }
  | { step: "success"; message?: string }
  | { step: "error"; message: string };

export default function OpenClawChannelsPage() {
  const { rpc, isConnected } = useOpenClaw();
  const [channelMeta, setChannelMeta] = useState<ChannelMeta[]>([]);
  const [channelDetails, setChannelDetails] = useState<Record<string, ChannelDetail>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // QR login state
  const [qrState, setQrState] = useState<QRState>({ step: "idle" });
  const [linkingChannelId, setLinkingChannelId] = useState<string | null>(null);
  const abortRef = useRef(false);

  const refresh = useCallback(async () => {
    if (!isConnected) return;
    setLoading(true);
    setError(null);
    try {
      const result = (await rpc("channels.status")) as any;
      if (result?.channelMeta) setChannelMeta(result.channelMeta);
      if (result?.channels) setChannelDetails(result.channels);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load channels");
    } finally {
      setLoading(false);
    }
  }, [isConnected, rpc]);

  useEffect(() => {
    if (isConnected) refresh();
  }, [isConnected, refresh]);

  const handleLogout = async (id: string) => {
    try {
      await rpc("channels.logout", { id });
      await refresh();
    } catch (err) {
      console.error("Logout failed:", err);
    }
  };

  const startQRLogin = async (channelId: string) => {
    abortRef.current = false;
    setLinkingChannelId(channelId);
    setQrState({ step: "loading" });

    try {
      // Step 1: Get QR code
      const result = (await rpc("web.login.start", { id: channelId })) as any;
      if (abortRef.current) return;

      if (!result?.qrDataUrl) {
        setQrState({ step: "error", message: result?.message || "No QR code returned" });
        return;
      }

      setQrState({ step: "showing", qrDataUrl: result.qrDataUrl, message: result.message });

      // Step 2: Wait for scan (long-poll)
      setQrState((prev) =>
        prev.step === "showing"
          ? { step: "waiting", message: "Waiting for scan..." }
          : prev
      );

      // Small delay so user sees the QR before it transitions
      await new Promise((r) => setTimeout(r, 300));
      // Actually just show QR while waiting
      setQrState({ step: "showing", qrDataUrl: result.qrDataUrl, message: "Scan with your phone..." });

      const waitResult = (await rpc("web.login.wait", { timeoutMs: 120000 })) as any;
      if (abortRef.current) return;

      if (waitResult?.connected) {
        setQrState({ step: "success", message: waitResult.message || "Connected!" });
        // Refresh channels after success
        setTimeout(async () => {
          await refresh();
          setTimeout(() => {
            setQrState({ step: "idle" });
            setLinkingChannelId(null);
          }, 2000);
        }, 1000);
      } else {
        setQrState({
          step: "error",
          message: waitResult?.message || "QR scan timed out. Try again.",
        });
      }
    } catch (err) {
      if (abortRef.current) return;
      setQrState({
        step: "error",
        message: err instanceof Error ? err.message : "Login failed",
      });
    }
  };

  const cancelQRLogin = () => {
    abortRef.current = true;
    setQrState({ step: "idle" });
    setLinkingChannelId(null);
  };

  const linkedCount = channelMeta.filter((c) => channelDetails[c.id]?.linked).length;
  const showQRModal = qrState.step !== "idle" && linkingChannelId;

  return (
    <DashboardScreenLayout
      screenKey="channels"
      renderers={{
        "channels.workspace": () => (
          <section
            className="min-w-0 rounded-2xl border p-5"
            style={{ background: "var(--card)", borderColor: "var(--border)" }}
          >
            <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-xl font-semibold" style={{ color: "var(--text-primary)" }}>
                  Channels
                </h2>
                <p className="text-sm mt-1" style={{ color: "var(--text-secondary)" }}>
                  {linkedCount} of {channelMeta.length} channels linked
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

            {loading && channelMeta.length === 0 ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="w-8 h-8 animate-spin" style={{ color: "var(--text-secondary)" }} />
              </div>
            ) : channelMeta.length === 0 ? (
              <div className="text-center py-20">
                <Radio className="w-16 h-16 mx-auto mb-4 opacity-30" style={{ color: "var(--text-secondary)" }} />
                <p className="text-lg font-medium" style={{ color: "var(--text-primary)" }}>
                  No channels configured
                </p>
                <p className="text-sm mt-1" style={{ color: "var(--text-secondary)" }}>
                  Configure messaging channels in your Aegilume config
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {channelMeta.map((ch) => {
                  const detail = channelDetails[ch.id];
                  const isLinked = detail?.linked ?? false;
                  const isConfigured = detail?.configured ?? false;
                  const hasError = !!detail?.lastError;
                  const selfNum = detail?.self?.e164;
                  const authAge = detail?.authAgeMs ? formatAge(detail.authAgeMs) : null;
                  const isLinking = linkingChannelId === ch.id;
                  const supportsQR =
                    ch.id === "whatsapp" ||
                    ch.id === "whatsapp-web" ||
                    ch.detailLabel?.toLowerCase().includes("web");

                  return (
                    <div
                      key={ch.id}
                      className="min-w-0 overflow-hidden rounded-xl border"
                      style={{
                        background: "var(--card)",
                        borderColor: isLinking ? "var(--accent, #3b82f6)" : "var(--border)",
                      }}
                    >
                      <div className="flex flex-col gap-3 px-4 py-4 md:flex-row md:items-center md:justify-between">
                        <div className="min-w-0 flex items-start gap-4">
                          <div
                            className={`p-2 rounded-lg ${
                              isLinked ? "bg-green-500/10" : hasError ? "bg-red-500/10" : "bg-gray-500/10"
                            }`}
                          >
                            {isLinked ? (
                              <Wifi className="w-5 h-5 text-green-500" />
                            ) : hasError ? (
                              <AlertTriangle className="w-5 h-5 text-red-500" />
                            ) : (
                              <WifiOff className="w-5 h-5" style={{ color: "var(--text-secondary)" }} />
                            )}
                          </div>
                          <div className="min-w-0">
                            <h3 className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
                              {ch.label}
                            </h3>
                            <div className="mt-0.5 flex flex-wrap items-center gap-2">
                              {ch.detailLabel ? (
                                <span
                                  className="text-xs px-2 py-0.5 rounded-full"
                                  style={{
                                    background: "var(--background)",
                                    color: "var(--text-secondary)",
                                  }}
                                >
                                  {ch.detailLabel}
                                </span>
                              ) : null}
                              {selfNum ? (
                                <span className="text-xs" style={{ color: "var(--text-secondary)" }}>
                                  {selfNum}
                                </span>
                              ) : null}
                              {authAge ? (
                                <span className="text-xs" style={{ color: "var(--text-secondary)" }}>
                                  auth {authAge} ago
                                </span>
                              ) : null}
                            </div>
                            {detail?.lastError ? (
                              <p className="text-xs text-red-400 mt-1">
                                {detail.lastError}
                              </p>
                            ) : null}
                          </div>
                        </div>
                        <div className="flex flex-wrap items-center gap-3 md:justify-end">
                          <span
                            className={`text-xs px-2.5 py-1 rounded-full font-medium ${
                              isLinked
                                ? "bg-green-500/10 text-green-500"
                                : isConfigured
                                  ? "bg-yellow-500/10 text-yellow-500"
                                  : "bg-gray-500/10 text-gray-400"
                            }`}
                          >
                            {isLinked ? "Linked" : isConfigured ? "Configured" : "Not linked"}
                          </span>
                          {!isLinked && (supportsQR || isConfigured) ? (
                            <button
                              onClick={() => startQRLogin(ch.id)}
                              disabled={!!linkingChannelId}
                              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-blue-600 hover:bg-blue-700 text-white transition-colors disabled:opacity-40"
                            >
                              {supportsQR ? <QrCode className="w-3.5 h-3.5" /> : <Link2 className="w-3.5 h-3.5" />}
                              {supportsQR ? "Scan QR" : "Link"}
                            </button>
                          ) : null}
                          {isLinked ? (
                            <button
                              onClick={() => handleLogout(ch.id)}
                              className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs text-red-400 hover:bg-red-500/10 transition-colors"
                            >
                              <LogOut className="w-3 h-3" />
                              Disconnect
                            </button>
                          ) : null}
                        </div>
                      </div>

                      {isLinking && qrState.step !== "idle" ? (
                        <div className="border-t px-4 py-6" style={{ borderColor: "var(--border)" }}>
                          <QRPanel
                            state={qrState}
                            channelLabel={ch.label}
                            onCancel={cancelQRLogin}
                            onRetry={() => startQRLogin(ch.id)}
                          />
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        ),
      }}
    />
  );
}

function QRPanel({
  state,
  channelLabel,
  onCancel,
  onRetry,
}: {
  state: QRState;
  channelLabel: string;
  onCancel: () => void;
  onRetry: () => void;
}) {
  if (state.step === "loading") {
    return (
      <div className="flex flex-col items-center gap-3 py-4">
        <Loader2
          className="w-8 h-8 animate-spin"
          style={{ color: "var(--text-secondary)" }}
        />
        <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
          Generating QR code...
        </p>
        <button
          onClick={onCancel}
          className="text-xs px-3 py-1 rounded hover:bg-white/5 transition-colors"
          style={{ color: "var(--text-secondary)" }}
        >
          Cancel
        </button>
      </div>
    );
  }

  if (state.step === "showing") {
    return (
      <div className="flex flex-col items-center gap-4">
        <div className="flex items-center justify-between w-full max-w-xs">
          <h4
            className="text-sm font-medium"
            style={{ color: "var(--text-primary)" }}
          >
            Link {channelLabel}
          </h4>
          <button
            onClick={onCancel}
            className="p-1 rounded hover:bg-white/5 transition-colors"
            style={{ color: "var(--text-secondary)" }}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* QR Code */}
        <div className="bg-white p-4 rounded-2xl shadow-lg">
          <img
            src={state.qrDataUrl}
            alt="QR Code"
            className="w-56 h-56"
            style={{ imageRendering: "pixelated" }}
          />
        </div>

        {/* Instructions */}
        <div className="flex items-start gap-3 max-w-xs">
          <Smartphone
            className="w-5 h-5 mt-0.5 shrink-0"
            style={{ color: "var(--text-secondary)" }}
          />
          <div>
            <p className="text-sm" style={{ color: "var(--text-primary)" }}>
              Scan this QR code
            </p>
            <p
              className="text-xs mt-0.5"
              style={{ color: "var(--text-secondary)" }}
            >
              Open {channelLabel} on your phone, go to Linked Devices, and scan
              this code.
            </p>
          </div>
        </div>

        {state.message && (
          <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
            {state.message}
          </p>
        )}

        {/* Waiting indicator */}
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
          <span className="text-xs" style={{ color: "var(--text-secondary)" }}>
            Waiting for scan...
          </span>
        </div>
      </div>
    );
  }

  if (state.step === "waiting") {
    return (
      <div className="flex flex-col items-center gap-3 py-4">
        <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
        <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
          {state.message || "Waiting for scan..."}
        </p>
        <button
          onClick={onCancel}
          className="text-xs px-3 py-1 rounded hover:bg-white/5 transition-colors"
          style={{ color: "var(--text-secondary)" }}
        >
          Cancel
        </button>
      </div>
    );
  }

  if (state.step === "success") {
    return (
      <div className="flex flex-col items-center gap-3 py-4">
        <div className="p-3 rounded-full bg-green-500/10">
          <CheckCircle2 className="w-8 h-8 text-green-500" />
        </div>
        <p
          className="text-sm font-medium"
          style={{ color: "var(--text-primary)" }}
        >
          {state.message || "Connected!"}
        </p>
        <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
          {channelLabel} is now linked to Aegilume
        </p>
      </div>
    );
  }

  if (state.step === "error") {
    return (
      <div className="flex flex-col items-center gap-3 py-4">
        <div className="p-3 rounded-full bg-red-500/10">
          <AlertCircle className="w-8 h-8 text-red-500" />
        </div>
        <p className="text-sm text-red-400">{state.message}</p>
        <div className="flex gap-2">
          <button
            onClick={onRetry}
            className="text-xs px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white transition-colors"
          >
            Try Again
          </button>
          <button
            onClick={onCancel}
            className="text-xs px-3 py-1.5 rounded-lg hover:bg-white/5 transition-colors"
            style={{ color: "var(--text-secondary)" }}
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return null;
}

function formatAge(ms: number): string {
  const sec = Math.floor(ms / 1000);
  if (sec < 60) return `${sec}s`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h`;
  const days = Math.floor(hr / 24);
  return `${days}d`;
}
