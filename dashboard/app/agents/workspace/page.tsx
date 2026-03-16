import { Suspense } from "react";
import { AgentWorkspacePageClient } from "@/components/AgentWorkspacePageClient";

export default function AgentWorkspacePage() {
  return (
    <Suspense fallback={null}>
      <AgentWorkspacePageClient />
    </Suspense>
  );
}
