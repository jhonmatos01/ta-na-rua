import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { ServiceStatusCard } from './service-status-card';

const baseProps = {
  title: 'Serviço de teste',
  description: 'Descrição pública do serviço.',
};

describe('ServiceStatusCard', () => {
  it('representa o carregamento sem conteúdo técnico', () => {
    render(<ServiceStatusCard {...baseProps} state="loading" />);

    expect(screen.getByText('Verificando')).toBeInTheDocument();
    expect(screen.getByLabelText('Carregando status')).toBeInTheDocument();
  });

  it('explica quando o monitoramento está desativado', () => {
    render(<ServiceStatusCard {...baseProps} state="disabled" />);

    expect(screen.getByText('Não monitorado')).toBeInTheDocument();
    expect(screen.getByText(/consulta desativada/i)).toBeInTheDocument();
  });

  it('usa textos padrão para disponibilidade', () => {
    render(<ServiceStatusCard {...baseProps} state="available" checkedAt={0} />);

    expect(screen.getByText('Disponível')).toBeInTheDocument();
    expect(screen.getByText(/respondendo normalmente/i)).toBeInTheDocument();
    expect(screen.queryByText(/verificado em/i)).not.toBeInTheDocument();
  });

  it('oferece nova tentativa no estado indisponível', () => {
    const retry = vi.fn();
    render(<ServiceStatusCard {...baseProps} state="unavailable" onRetry={retry} />);

    expect(screen.getByText('Indisponível')).toBeInTheDocument();
    expect(screen.getByText(/não foi possível consultar/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /tentar novamente/i }));
    expect(retry).toHaveBeenCalledOnce();
  });
});
