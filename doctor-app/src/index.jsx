/**
 * doctor-app/src/index.jsx
 * Phase 5 Fix — Adds ErrorBoundary + QueryClientProvider
 *
 * REPLACE: doctor-app/src/index.jsx (full file replacement)
 *
 * Changes from original:
 *   1. Wrapped root in <ErrorBoundary> — prevents full white-screen crash
 *   2. Wrapped root in <QueryClientProvider> — enables React Query everywhere
 *   3. ReactQueryDevtools added (only renders in development, zero prod overhead)
 */
import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';

import './i18n';
import App from './App';
// SocketProvider is rendered inside App.jsx — do not import it here
import { queryClient } from './queryClient';
import ErrorBoundary from './components/ErrorBoundary';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
            <App />
        </BrowserRouter>
        {/* Only visible in development — zero bundle impact in production */}
        <ReactQueryDevtools initialIsOpen={false} />
      </QueryClientProvider>
    </ErrorBoundary>
  </React.StrictMode>
);
