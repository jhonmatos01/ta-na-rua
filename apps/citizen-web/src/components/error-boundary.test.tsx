import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ErrorBoundary } from './error-boundary';

function BrokenComponent(): never {
  throw new Error('falha interna que não deve aparecer');
}

describe('ErrorBoundary', () => {
  beforeEach(() => vi.spyOn(console, 'error').mockImplementation(() => undefined));
  afterEach(() => vi.restoreAllMocks());

  it('substitui falhas inesperadas por uma tela segura', () => {
    render(
      <ErrorBoundary>
        <BrokenComponent />
      </ErrorBoundary>,
    );

    expect(screen.getByRole('heading', { name: /não foi possível exibir/i })).toBeInTheDocument();
    expect(screen.queryByText(/falha interna que não deve aparecer/i)).not.toBeInTheDocument();
  });

  it('oferece recarregamento da página', () => {
    const reload = vi.fn();
    render(
      <ErrorBoundary onReload={reload}>
        <BrokenComponent />
      </ErrorBoundary>,
    );

    fireEvent.click(screen.getByRole('button', { name: /atualizar página/i }));
    expect(reload).toHaveBeenCalledOnce();
  });
});
