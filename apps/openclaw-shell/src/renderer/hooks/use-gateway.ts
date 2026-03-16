import { useEffect, useState } from 'react';
import { on } from '../lib/ipc-client';
import type { GatewayConnectionState } from '../../shared/types';

export function useGateway() {
  const [connectionState, setConnectionState] = useState<GatewayConnectionState>('disconnected');

  useEffect(() => {
    const handler = (state: GatewayConnectionState) => {
      setConnectionState(state);
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
