import { Component, type ErrorInfo, type ReactNode } from 'react';

import { Button } from './button';

interface ErrorBoundaryProps {
  children: ReactNode;
  onReload?: () => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
  errorId?: string;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true, errorId: globalThis.crypto.randomUUID() };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    if (import.meta.env.DEV) console.error('Falha inesperada na interface', error, info);
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <main className="grid min-h-screen place-items-center bg-slate-50 px-6 py-16">
        <section className="w-full max-w-xl rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-sm">
          <p className="text-sm font-bold uppercase tracking-widest text-brand-700">
            Erro inesperado
          </p>
          <h1 className="mt-3 text-3xl font-black tracking-tight text-slate-950">
            Não foi possível exibir esta página
          </h1>
          <p className="mt-4 text-slate-600">
            Atualize a página para tentar novamente. Nenhum dado sensível é exibido aqui.
          </p>
          {import.meta.env.DEV && this.state.errorId ? (
            <p className="mt-3 font-mono text-xs text-slate-500">
              Referência local: {this.state.errorId}
            </p>
          ) : null}
          <Button
            className="mt-6"
            onClick={this.props.onReload ?? (() => window.location.reload())}
          >
            Atualizar página
          </Button>
        </section>
      </main>
    );
  }
}
