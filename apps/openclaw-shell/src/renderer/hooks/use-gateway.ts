import { useEffect, useRef, useState } from 'react';
import { on, gatewayRpc } from '../lib/ipc-client';
import { flushQueue } from '../../shared/offline-queue';
import type { GatewayConnectionState } from '../../shared/types';

export function useGateway() {
  const [connectionState, setConnectionState] = useState<GatewayConnectionState>('disconnected');
  const prevStateRef = useRef<GatewayConnectionState>('disconnected');

  useEffect(() => {
    const handler = (state: GatewayConnectionState) => {
      const prev = prevStateRef.current;
      prevStateRef.current = state;
      setConnectionState(state);

      // Auto-flush offline queue when transitioning to connected
      if (state === 'connected' && prev !== 'connected') {
        flushQueue(gatewayRpc).catch(() => {
          // Flush errors are non-fatal; items stay in queue for next reconnect
        });
      }
    };

    const unsub = on('gateway:state', handler);
    return () => {
      unsub();
    };
  }, []);

  return {
    connectionState,
    isConnected: connectionState === 'connected',
    isConnecting: connectionState === 'connecting' || connectionState === 'authenticating',
  };
}
