import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { PublicOccurrenceImage } from './public-occurrence-image';

describe('PublicOccurrenceImage', () => {
  it('substitui uma imagem pública indisponível por um estado seguro', () => {
    render(
      <PublicOccurrenceImage
        src="https://cdn.example.test/inexistente.jpg"
        alt="Imagem pública da ocorrência"
        className="aspect-square"
      />,
    );

    fireEvent.error(screen.getByRole('img', { name: 'Imagem pública da ocorrência' }));

    expect(screen.getByRole('img', { name: 'Imagem pública não disponível' })).toBeInTheDocument();
  });

  it('mantém o placeholder decorativo fora da árvore acessível', () => {
    const { container } = render(
      <PublicOccurrenceImage src={null} alt="" className="aspect-square" />,
    );

    expect(container.querySelector('[aria-hidden="true"]')).toBeInTheDocument();
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });
});
