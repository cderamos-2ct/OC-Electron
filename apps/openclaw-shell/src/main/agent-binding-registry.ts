import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { dirname, join } from 'path';
import { homedir } from 'os';
import type { AgentBinding, AgentBindingConfig, AgentCapability } from '../shared/types.js';
import { SHELL_CONFIG_DIR_NAME, AGENT_BINDINGS_FILE_NAME } from '../shared/constants.js';

const AGENT_BINDINGS_FILE = join(homedir(), SHELL_CONFIG_DIR_NAME, AGENT_BINDINGS_FILE_NAME);

const DEFAULT_CONFIG: AgentBindingConfig = {
  orchestrator: 'cd',
  fallbackAgent: 'cd',
  // Agent IDs must match the gateway JSON config IDs in .antigravity/agents/*.json
  bindings: [
    {
      agentId: 'cd',            // CD — Orchestrator / Chief of Staff
      services: ['openclaw-dashboard'],
      capabilities: ['observe', 'act'],
      apis: [],
    },
    {
      agentId: 'comms',         // Karoline — Communications Director
      services: ['gmail', 'gmail-work', 'teams', 'slack', 'google-chat'],
      capabilities: ['observe', 'act'],
      apis: ['gmail', 'gws'],
    },
    {
      agentId: 'iris',          // Iris — Channel Aggregator (reports to Karoline)
      services: ['gmail', 'teams', 'slack', 'google-chat', 'trello', 'mightycall'],
      capabilities: ['observe', 'act'],
      apis: ['gmail', 'gws', 'slack', 'trello', 'mightycall'],
    },
    {
      agentId: 'hermes',        // Hermes — Relationship Intelligence
      services: [],
      capabilities: ['observe'],
      apis: ['people-graph'],
    },
    {
      agentId: 'vesta',         // Vesta — Personal/Family Life Guardian
      services: ['google-calendar'],
      capabilities: ['observe', 'act'],
      apis: ['calendar'],
    },
    {
      agentId: 'finance',       // Marcus — Financial Intelligence
      services: [],
      capabilities: ['observe'],
      apis: ['gmail'],
    },
    {
      agentId: 'notes',         // Ada — Knowledge Architect
      services: ['fireflies', 'apple-notes'],
      capabilities: ['observe', 'act'],
      apis: ['fireflies'],
    },
    {
      agentId: 'calendar',      // Kronos — Time Strategist
      services: ['google-calendar'],
      capabilities: ['observe', 'act'],
      apis: ['calendar', 'gws'],
    },
    {
      agentId: 'ops',           // Argus — Infrastructure Guardian
      services: ['openclaw-dashboard'],
      capabilities: ['observe', 'act'],
      apis: [],
    },
    {
      agentId: 'build',         // Vulcan — Implementation Specialist
      services: ['github', 'trello'],
      capabilities: ['observe', 'act'],
      apis: ['github'],
    },
    {
      agentId: 'research',      // Hypatia — Research Intelligence
      services: ['web-research'],
      capabilities: ['observe', 'act'],
      apis: [],
    },
    {
      agentId: 'socrates',      // Socrates — Learning Coach
      services: [],
      capabilities: ['observe'],
      apis: [],
    },
    {
      agentId: 'verifier',      // Themis — Quality Verification
      services: [],
      capabilities: ['observe'],
      apis: [],
    },
    {
      agentId: 'boswell',       // Boswell — Narrative/Activity Tracker
      services: ['openclaw-dashboard'],
      capabilities: ['observe'],
      apis: [],
    },
  ],
};

export class AgentServiceBindingRegistry {
  private config: AgentBindingConfig;

  private constructor(config: AgentBindingConfig) {
    this.config = config;
  }

  static fromConfig(configPath: string = AGENT_BINDINGS_FILE): AgentServiceBindingRegistry {
    if (!existsSync(configPath)) {
      mkdirSync(dirname(configPath), { recursive: true });
      writeFileSync(configPath, JSON.stringify(DEFAULT_CONFIG, null, 2), 'utf-8');
      return new AgentServiceBindingRegistry(DEFAULT_CONFIG);
    }

    try {
      const raw = readFileSync(configPath, 'utf-8');
      const config = JSON.parse(raw) as AgentBindingConfig;
      return new AgentServiceBindingRegistry(config);
    } catch (err) {
      console.error('[AgentServiceBindingRegistry] Failed to load config, using defaults:', err);
      return new AgentServiceBindingRegistry(DEFAULT_CONFIG);
    }
  }

  private findBinding(agentId: string): AgentBinding | undefined {
    return this.config.bindings.find((b) => b.agentId === agentId);
  }

  isAgentBoundTo(agentId: string, serviceId: string): boolean {
    const binding = this.findBinding(agentId);
    return binding?.services.includes(serviceId) ?? false;
  }

  canObserve(agentId: string, serviceId: string): boolean {
    const binding = this.findBinding(agentId);
    if (!binding) return false;
    return (
      binding.services.includes(serviceId) &&
      binding.capabilities.includes('observe' as AgentCapability)
    );
  }

  canAct(agentId: string, serviceId: string): boolean {
    const binding = this.findBinding(agentId);
    if (!binding) return false;
    return (
      binding.services.includes(serviceId) &&
      binding.capabilities.includes('act' as AgentCapability)
    );
  }

  hasAPIAccess(agentId: string, apiName: string): boolean {
    const binding = this.findBinding(agentId);
    return binding?.apis?.includes(apiName) ?? false;
  }

  getServicesForAgent(agentId: string): string[] {
    return this.findBinding(agentId)?.services ?? [];
  }

  getAgentForService(serviceId: string): string {
    const match = this.config.bindings.find(
      (b) => b.agentId !== this.config.orchestrator && b.services.includes(serviceId),
    );
    return match?.agentId ?? this.config.fallbackAgent;
  }

  getConfig(): AgentBindingConfig {
    return this.config;
  }
}
