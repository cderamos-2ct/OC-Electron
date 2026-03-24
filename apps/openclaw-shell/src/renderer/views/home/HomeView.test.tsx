import React from 'react';
import { render, screen, waitFor, act } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { HomeView } from './HomeView';

const invokeMock = vi.fn();
const gatewayMock = vi.fn();

vi.mock('../../lib/ipc-client', () => ({
  invoke: (...args: unknown[]) => invokeMock(...args),
  on: vi.fn(),
}));

vi.mock('../../hooks/use-agents', () => ({
  useAgents: () => ({ agents: [], getAgentForService: () => undefined, isAgentOnline: () => false }),
}));

vi.mock('../../hooks/use-gateway', () => ({
  useGateway: () => gatewayMock(),
}));

function setGatewayState(isConnected: boolean) {
  gatewayMock.mockReturnValue({
    isConnected,
    connectionState: isConnected ? 'connected' : 'disconnected',
    isConnecting: false,
  });
}

beforeEach(() => {
  invokeMock.mockReset();
  setGatewayState(true);
});

describe('HomeView', () => {
  it('shows only backend-derived metric values and no fake placeholders', async () => {
    invokeMock.mockImplementation((channel: string) => {
      switch (channel) {
        case 'api.gmail.list':
          return Promise.resolve([{ id: 'm-1' }, { id: 'm-2' }]);
        case 'api.calendar.list':
          return Promise.resolve([{ id: 'c-1' }]);
        case 'api.github.notifications':
          return Promise.resolve([]);
        case 'task:list':
          return Promise.resolve([{ id: 't-1' }, { id: 't-2' }, { id: 't-3' }]);
        default:
          return Promise.resolve([]);
      }
    });

    render(<HomeView userName="Jordan" />);

    expect(invokeMock).toHaveBeenCalledWith('api.gmail.list', 'comms', 'in:inbox is:unread', 100);
    expect(invokeMock).toHaveBeenCalledWith('api.calendar.list', 'calendar', expect.any(String), expect.any(String));
    expect(invokeMock).toHaveBeenCalledWith('api.github.notifications', 'build', false);
    expect(invokeMock).toHaveBeenCalledWith('task:list');

    expect(await screen.findByText('Unread emails')).toBeInTheDocument();
    expect(await screen.findByText('Calendar events today')).toBeInTheDocument();
    expect(await screen.findByText('GitHub notifications')).toBeInTheDocument();
    expect(await screen.findByText('Pending tasks')).toBeInTheDocument();

    expect(await screen.findByText('2')).toBeInTheDocument();
    expect(await screen.findByText('1')).toBeInTheDocument();
    expect(await screen.findByText('3')).toBeInTheDocument();

    expect(screen.queryByText('Emails triaged')).toBeNull();
    expect(screen.queryByText('PRs merged')).toBeNull();
    expect(screen.queryByText('Invites handled')).toBeNull();
    expect(screen.queryByText('—')).toBeNull();

    expect(screen.getByText('Unread emails').parentElement).toHaveTextContent('2');
    expect(screen.getByText('Calendar events today').parentElement).toHaveTextContent('1');
    expect(screen.getByText('Pending tasks').parentElement).toHaveTextContent('3');
  });

  it('stops loading indicator once every metric settles', async () => {
    let gmailResolve: (value: unknown) => void;
    let calendarResolve: (value: unknown) => void;
    let githubResolve: (value: unknown) => void;
    let taskResolve: (value: unknown) => void;

    invokeMock.mockImplementation((channel: string) => {
      switch (channel) {
        case 'api.gmail.list':
          return new Promise((resolve) => {
            gmailResolve = resolve;
          });
        case 'api.calendar.list':
          return new Promise((resolve) => {
            calendarResolve = resolve;
          });
        case 'api.github.notifications':
          return new Promise((resolve) => {
            githubResolve = resolve;
          });
        case 'task:list':
          return new Promise((resolve) => {
            taskResolve = resolve;
          });
        default:
          return Promise.resolve([]);
      }
    });

    render(<HomeView />);

    expect(screen.getByText('Loading live metrics...')).toBeInTheDocument();

    await act(async () => {
      gmailResolve([{ id: 'm-1' }]);
      calendarResolve([]);
      githubResolve([]);
      taskResolve([{ id: 't-1' }]);
    });

    await waitFor(() => {
      expect(screen.queryByText('Loading live metrics...')).toBeNull();
    });

    expect(screen.queryByText('Some dashboard metrics are unavailable.')).toBeNull();
    expect(screen.getByText('Unread emails').parentElement).toHaveTextContent('1');
    expect(screen.getByText('Pending tasks').parentElement).toHaveTextContent('1');
  });

  it('shows explicit per-card errors while keeping disconnected states explicit', async () => {
    invokeMock.mockImplementation((channel: string) => {
      switch (channel) {
        case 'api.gmail.list':
          return Promise.resolve({ error: 'gmail unavailable' });
        case 'api.calendar.list':
          return Promise.resolve({ error: 'calendar unavailable' });
        case 'api.github.notifications':
          return Promise.resolve({ error: 'github unavailable' });
        case 'task:list':
          return Promise.resolve({ error: 'task store error' });
        default:
          return Promise.resolve([]);
      }
    });

    render(<HomeView />);

    await waitFor(() => {
      expect(screen.getByText('Some dashboard metrics are unavailable.')).toBeInTheDocument();
    });

    expect(screen.getByText('Unread emails').parentElement).toHaveTextContent('gmail unavailable');
    expect(screen.getByText('Calendar events today').parentElement).toHaveTextContent('calendar unavailable');
    expect(screen.getByText('GitHub notifications').parentElement).toHaveTextContent('github unavailable');
    expect(screen.getByText('Pending tasks').parentElement).toHaveTextContent('task store error');
  });

  it('shows explicit disconnected state without pseudo-loading', async () => {
    setGatewayState(false);
    invokeMock.mockResolvedValue([{ id: 'm-1' }]);

    render(<HomeView />);

    expect(screen.queryByText('Loading live metrics...')).toBeNull();

    await waitFor(() => {
      expect(screen.getByText('Some dashboard metrics are unavailable.')).toBeInTheDocument();
    });

    expect(screen.getByText('Unread emails').parentElement).toHaveTextContent('Gateway disconnected');
    expect(screen.getByText('Calendar events today').parentElement).toHaveTextContent('Gateway disconnected');
    expect(screen.getByText('GitHub notifications').parentElement).toHaveTextContent('Gateway disconnected');
    expect(screen.getByText('Pending tasks').parentElement).toHaveTextContent('Gateway disconnected');
  });
});
