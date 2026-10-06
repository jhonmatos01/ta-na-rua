import { createRoot } from 'react-dom/client';

import { App } from './App';
import { AuthProvider } from './auth-context';
import './styles.css';

const rootElement = document.getElementById('root');
if (!rootElement) throw new Error('Elemento raiz do painel não encontrado.');

createRoot(rootElement).render(
  <AuthProvider>
    <App />
  </AuthProvider>,
);
