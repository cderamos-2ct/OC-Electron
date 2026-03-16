import { describe, it, expect } from 'vitest';
import { buildSubagentConfig } from '../router.js';
import type { AgentRouteConfig } from '../types.js';

const baseConfig: AgentRouteConfig = {
  defaultModel: 'claude-opus-4-6',
  modelProvider: 'anthropic',
  fallbackModel: 'gpt-5',
  reasoningLevel: 'high',
  canSpawnSubagents: true,
  subagentModel: 'claude-haiku-4-5',
  subagentMaxDepth: 3,
};

describe('buildSubagentConfig', () => {
  it('returns null when depth >= maxDepth', () => {
    expect(buildSubagentConfig(baseConfig, 3)).toBeNull();
    expect(buildSubagentConfig(baseConfig, 4)).toBeNull();
    expect(buildSubagentConfig(baseConfig, 100)).toBeNull();
  });

  it('returns null when subagentModel is not set', () => {
    const config: AgentRouteConfig = {
      ...baseConfig,
      subagentModel: null,
    };
    expect(buildSubagentConfig(config, 0)).toBeNull();
  });

  it('returns null when subagentModel is undefined', () => {
    const config: AgentRouteConfig = {
      defaultModel: 'claude-opus-4-6',
      modelProvider: 'anthropic',
    };
    expect(buildSubagentConfig(config, 0)).toBeNull();
  });

  it('builds a valid subagent config at depth 0', () => {
    const sub = buildSubagentConfig(baseConfig, 0);
    expect(sub).not.toBeNull();
    expect(sub!.defaultModel).toBe('claude-haiku-4-5');
    expect(sub!.modelProvider).toBe('anthropic');
    expect(sub!.reasoningLevel).toBe('low');
    expect(sub!.fallbackModel).toBe('gpt-5');
    expect(sub!.subagentModel).toBe('claude-haiku-4-5');
    expect(sub!.subagentMaxDepth).toBe(3);
  });

  it('detects provider from subagentModel string (claude prefix → anthropic)', () => {
    const config: AgentRouteConfig = {
      ...baseConfig,
      subagentModel: 'claude-haiku-4-5',
    };
    const sub = buildSubagentConfig(config, 0);
    expect(sub!.modelProvider).toBe('anthropic');
  });

  it('detects provider from subagentModel string (gpt prefix → openai)', () => {
    const config: AgentRouteConfig = {
      ...baseConfig,
      subagentModel: 'gpt-5-mini',
    };
    const sub = buildSubagentConfig(config, 0);
    expect(sub!.modelProvider).toBe('openai');
  });

  it('detects provider from subagentModel string (gemini prefix → google)', () => {
    const config: AgentRouteConfig = {
      ...baseConfig,
      subagentModel: 'gemini-pro',
    };
    const sub = buildSubagentConfig(config, 0);
    expect(sub!.modelProvider).toBe('google');
  });

  it('canSpawnSubagents is true when depth + 1 < maxDepth', () => {
    // depth=0, maxDepth=3 → depth+1=1 < 3 → can spawn
    const sub = buildSubagentConfig(baseConfig, 0);
    expect(sub!.canSpawnSubagents).toBe(true);
  });

  it('canSpawnSubagents is false when depth + 1 >= maxDepth', () => {
    // depth=2, maxDepth=3 → depth+1=3, not < 3 → cannot spawn
    const sub = buildSubagentConfig(baseConfig, 2);
    expect(sub!.canSpawnSubagents).toBe(false);
  });

  it('uses default maxDepth of 1 when subagentMaxDepth is not set', () => {
    const config: AgentRouteConfig = {
      defaultModel: 'claude-opus-4-6',
      modelProvider: 'anthropic',
      subagentModel: 'claude-haiku-4-5',
    };
    // depth=0 < maxDepth=1 → ok
    const sub = buildSubagentConfig(config, 0);
    expect(sub).not.toBeNull();
    // depth=1 >= maxDepth=1 → null
    expect(buildSubagentConfig(config, 1)).toBeNull();
  });

  it('always sets reasoningLevel to low for subagents', () => {
    const config: AgentRouteConfig = {
      ...baseConfig,
      reasoningLevel: 'high',
    };
    const sub = buildSubagentConfig(config, 0);
    expect(sub!.reasoningLevel).toBe('low');
  });

  it('preserves fallbackModel from parent config', () => {
    const config: AgentRouteConfig = {
      ...baseConfig,
      fallbackModel: 'gemini-pro',
    };
    const sub = buildSubagentConfig(config, 0);
    expect(sub!.fallbackModel).toBe('gemini-pro');
  });

  it('handles null fallbackModel gracefully', () => {
    const config: AgentRouteConfig = {
      ...baseConfig,
      fallbackModel: null,
    };
    const sub = buildSubagentConfig(config, 0);
    expect(sub).not.toBeNull();
    expect(sub!.fallbackModel).toBeNull();
  });
});
