import { useCallback, useEffect, useState } from 'react';
import { invoke, on } from '../lib/ipc-client';
import type { AgentStatus } from '../../shared/types';

export function useAgents() {
  const [agents, setAgents] = useState<AgentStatus[]>([]);

  // Load agent list on mount
  useEffect(() => {
    let cancelled = false;
    invoke('gateway:rpc', 'agents.list', undefined)
      .then((result) => {
        if (cancelled) return;
        const list = Array.isArray(result) ? (result as AgentStatus[]) : [];
        setAgents(list);
      })
      .catch((err) => {
        if (cancelled) return;
        console.warn('[use-agents] Failed to load agents:', err);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Listen for live agent status updates
  useEffect(() => {
    const handler = (status: AgentStatus) => {
      setAgents((prev) => {
        const idx = prev.findIndex((a) => a.agentId === status.agentId);
        if (idx === -1) return [...prev, status];
        const next = [...prev];
        next[idx] = status;
        return next;
      });
    };
    const unsub = on('agent:status', handler);
    return () => {
      unsub();
    };
  }, []);

  // Also load bindings to enrich boundServices
  useEffect(() => {
    invoke('agent:bindings')
      .then((result) => {
        if (!result || typeof result !== 'object') return;
        const config = result as { bindings?: Array<{ agentId: string; services: string[] }> };
        if (!config.bindings) return;
        setAgents((prev) =>
          prev.map((agent) => {
            const binding = config.bindings!.find((b) => b.agentId === agent.agentId);
            if (!binding) return agent;
            return { ...agent, boundServices: binding.services };
          }),
        );
      })
      .catch(() => {
        // Non-fatal
      });
  }, []);

  const getAgentForService = useCallback(
    (serviceId: string): string | undefined => {
      return agents.find((a) => a.boundServices.includes(serviceId))?.agentId;
    },
    [agents],
  );

  const isAgentOnline = useCallback(
    (agentId: string): boolean => {
      return agents.find((a) => a.agentId === agentId)?.online ?? false;
    },
    [agents],
  );

  return { agents, getAgentForService, isAgentOnline };
}
