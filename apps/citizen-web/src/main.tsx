import { QueryClientProvider } from '@tanstack/react-query';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router-dom';

import { ErrorBoundary } from './components/error-boundary';
import './index.css';
import { queryClient } from './lib/query-client';
import { router } from './router';

const rootElement = document.getElementById('root');

if (!rootElement) throw new Error('Elemento raiz da aplicação não encontrado.');

createRoot(rootElement).render(
  <StrictMode>
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
      </QueryClientProvider>
    </ErrorBoundary>
  </StrictMode>,
);
