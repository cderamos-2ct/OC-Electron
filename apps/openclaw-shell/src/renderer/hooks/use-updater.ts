import { useState, useEffect, useCallback } from 'react';
import { on, invoke } from '../lib/ipc-client';
import type { UpdateStatus } from '../../shared/types';

export type { UpdateStatus };

export function useUpdater() {
  const [status, setStatus] = useState<UpdateStatus>({ state: 'idle' });

  useEffect(() => {
    // Get current status on mount
    invoke('updater:status').then((result) => {
      if (result && typeof result === 'object') {
        setStatus(result as UpdateStatus);
      }
    }).catch(() => {});

    // Listen for status updates
    const unsub = on('updater:status', (data) => {
      setStatus(data as UpdateStatus);
    });
    return unsub;
  }, []);

  const checkForUpdates = useCallback(() => {
    invoke('updater:check').catch(() => {});
  }, []);

  const installNow = useCallback(() => {
    invoke('updater:install-now').catch(() => {});
  }, []);

  return {
    status,
    isUpdateReady: status.state === 'ready',
    isDownloading: status.state === 'downloading',
    checkForUpdates,
    installNow,
  };
}
