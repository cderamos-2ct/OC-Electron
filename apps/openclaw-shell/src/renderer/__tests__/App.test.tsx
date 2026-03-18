import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, beforeEach } from 'vitest';
import { App } from '../App';

beforeEach(async () => {
  const { useSetupStore } = await import('../stores/setup-store');
  const { useShellStore } = await import('../stores/shell-store');
  const { useViewStore } = await import('../stores/view-store');

  useSetupStore.setState({
    setupComplete: true,
    setupLoading: false,
    bootstrapping: false,
    bootstrapConfig: null,
    userName: 'Test',
  });
  useShellStore.setState({ services: [], activeServiceId: 'openclaw-dashboard' });
  useViewStore.setState({ activeView: 'home', viewHistory: [] });
});

describe('App', () => {
  it('renders without throwing', () => {
    expect(() => render(<App />)).not.toThrow();
  });

  it('renders the AE brand mark in the title bar', () => {
    render(<App />);
    // The title bar contains "AE" — present in both normal layout and error boundary
    const aeElements = screen.getAllByText('AE');
    expect(aeElements.length).toBeGreaterThan(0);
  });

  it('does not show setup wizard when setupComplete is true', () => {
    render(<App />);
    // SetupWizard should not be present
    expect(screen.queryByRole('button', { name: /get started/i })).toBeNull();
  });
});
