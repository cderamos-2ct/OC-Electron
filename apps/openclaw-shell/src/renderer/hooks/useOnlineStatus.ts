import { useEffect, useState } from 'react';
import { useGateway } from './use-gateway';
import { getPendingCount } from '../../shared/offline-queue';

export interface OnlineStatus {
  isOnline: boolean;
  isGatewayConnected: boolean;
  pendingCount: number;
}

/**
 * Combines navigator.onLine + gateway WebSocket state into a single hook.
 * Gateway connection state is the primary signal; navigator.onLine is supplementary.
 * Tracks pending offline queue count.
 */
export function useOnlineStatus(): OnlineStatus {
  const { isConnected } = useGateway();
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [pendingCount, setPendingCount] = useState(() => getPendingCount());

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Refresh pending count whenever gateway connection state changes
  useEffect(() => {
    setPendingCount(getPendingCount());
  }, [isConnected]);

  return {
    isOnline,
    isGatewayConnected: isConnected,
    pendingCount,
  };
}
