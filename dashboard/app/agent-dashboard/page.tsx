import { EmbeddedDashboardFrame } from "@/components/EmbeddedDashboardFrame";

export default function AgentDashboardPage() {
  const token = process.env.NEXT_PUBLIC_OPENCLAW_GATEWAY_TOKEN?.trim();
  const mountPath = token
    ? `/__mounted/agent-dashboard/?token=${encodeURIComponent(token)}`
    : "/__mounted/agent-dashboard/";

  return (
    <EmbeddedDashboardFrame
      title="Agent Dashboard"
      description="Mounted from the legacy OpenClaw agent dashboard server with same-origin route rewriting."
      mountPath={mountPath}
    />
  );
}
