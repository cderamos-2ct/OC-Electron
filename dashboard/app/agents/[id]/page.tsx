export const dynamic = "force-dynamic";

import { AgentDetailPageClient } from "@/components/AgentDetailPageClient";

export default async function AgentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <AgentDetailPageClient agentId={id} />;
}
