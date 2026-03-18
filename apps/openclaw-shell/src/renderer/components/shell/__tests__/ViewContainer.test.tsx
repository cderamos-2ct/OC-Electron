/**
 * Smoke tests — each of the 9 views mounts via ViewContainer without throwing.
 *
 * We test ViewContainer directly (rather than individual views) to exercise
 * the real routing / animation wrapper used in production.
 */
import React from 'react';
import { render } from '@testing-library/react';
import { describe, it, expect, beforeEach } from 'vitest';
import { ViewContainer } from '../ViewContainer';
import type { ViewId } from '../../../stores/view-store';

const ALL_VIEWS: ViewId[] = [
  'home',
  'tasks',
  'draft-review',
  'agents',
  'comms',
  'calendar',
  'github',
  'browser',
  'vault',
];

beforeEach(async () => {
  // Reset view store to default before each test
  const { useViewStore } = await import('../../../stores/view-store');
  useViewStore.setState({ activeView: 'home', viewHistory: [] });
});

describe('ViewContainer — view mount smoke tests', () => {
  it.each(ALL_VIEWS)('mounts view "%s" without throwing', async (viewId) => {
    const { useViewStore } = await import('../../../stores/view-store');
    useViewStore.setState({ activeView: viewId, viewHistory: [] });

    expect(() => render(<ViewContainer />)).not.toThrow();
  });
});
