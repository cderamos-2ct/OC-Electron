import React from 'react';
import { AgentCard, Agent } from './AgentCard';

interface DepartmentGroupProps {
  label: string;
  agents: Agent[];
  onSelectAgent: (agent: Agent) => void;
}

export function DepartmentGroup({ label, agents, onSelectAgent }: DepartmentGroupProps) {
  return (
    <div style={{ marginBottom: 28 }}>
      <div
        style={{
          fontSize: 11,
          fontWeight: 600,
          textTransform: 'uppercase',
          letterSpacing: '0.08em',
          color: 'var(--text-muted)',
          marginBottom: 10,
        }}
      >
        {label}
      </div>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(2, 1fr)',
          gap: 12,
        }}
      >
        {agents.map((agent) => (
          <AgentCard key={agent.id} agent={agent} onClick={onSelectAgent} />
        ))}
      </div>
    </div>
  );
}
