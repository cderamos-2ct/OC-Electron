import React from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import { initRendererTelemetry } from './lib/telemetry';
import { App } from './App';
import { AppErrorBoundary } from './components/errors/AppErrorBoundary';

initRendererTelemetry();

const container = document.getElementById('root');
if (!container) {
  throw new Error('Root element #root not found');
}

const root = createRoot(container);
root.render(
  <React.StrictMode>
    <AppErrorBoundary>
      <App />
    </AppErrorBoundary>
  </React.StrictMode>,
);
