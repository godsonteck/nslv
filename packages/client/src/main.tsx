// ============================================
// NS LUXURY VILLA — Client Entrypoint
// React 18 render with TanStack Query Provider
// ============================================

import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import ErrorBoundary from './components/common/ErrorBoundary';
import { AmbientBackdrop } from './components/layout/AmbientBackdrop';
import './styles/globals.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <AmbientBackdrop />
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>,
);
