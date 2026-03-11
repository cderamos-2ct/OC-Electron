import { NextResponse } from "next/server";
import {
  delegateCanonicalTask,
  delegateCanonicalTasks,
  getAgentManagerAudit,
  getAgentManagerRecommendations,
  hireAgentFromTaskCluster,
  refineAgentPacket,
} from "@/lib/antigravity-agents";

export async function GET() {
  return NextResponse.json({
    recommendations: getAgentManagerRecommendations(),
    audit: getAgentManagerAudit(),
  });
}

export async function POST(request: Request) {
  const body = await request.json();
  const action = String(body.action || "");

  if (action === "delegate") {
    const taskIds = Array.isArray(body.taskIds) ? body.taskIds.map(String) : [];
    const agentId = String(body.agentId || "");
    if (!taskIds.length || !agentId) {
      return NextResponse.json({ error: "taskIds and agentId are required" }, { status: 400 });
    }
    const result =
      taskIds.length === 1
        ? delegateCanonicalTask(taskIds[0], agentId)
        : delegateCanonicalTasks(taskIds, agentId);
    return NextResponse.json(result);
  }

  if (action === "hire") {
    const taskIds = Array.isArray(body.taskIds) ? body.taskIds.map(String) : [];
    if (!taskIds.length) {
      return NextResponse.json({ error: "taskIds are required" }, { status: 400 });
    }
    return NextResponse.json(
      hireAgentFromTaskCluster({
        taskIds,
        draft: body.draft,
      }),
      { status: 201 },
    );
  }

  if (action === "refine-packet") {
    const agentId = String(body.agentId || "");
    if (!agentId) {
      return NextResponse.json({ error: "agentId is required" }, { status: 400 });
    }
    return NextResponse.json(refineAgentPacket(agentId));
  }

  return NextResponse.json({ error: `Unsupported action: ${action}` }, { status: 400 });
}
