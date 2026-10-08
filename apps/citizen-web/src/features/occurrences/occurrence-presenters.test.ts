import { describe, expect, it } from 'vitest';

import {
  publicOccurrenceFixture,
  secondPublicOccurrenceFixture,
} from '../../tests/occurrence-fixtures';
import { getNeighborhoodLabel, matchesOccurrenceSearch } from './occurrence-presenters';

describe('apresentação pública de ocorrências', () => {
  it('busca sem diferenciar maiúsculas ou acentos', () => {
    expect(matchesOccurrenceSearch(publicOccurrenceFixture, 'BURACO')).toBe(true);
    expect(matchesOccurrenceSearch(publicOccurrenceFixture, 'via')).toBe(true);
    expect(matchesOccurrenceSearch(secondPublicOccurrenceFixture, 'iluminacao')).toBe(true);
    expect(matchesOccurrenceSearch(publicOccurrenceFixture, 'vazamento')).toBe(false);
  });

  it('aceita bairro estruturado ou texto legado', () => {
    expect(getNeighborhoodLabel(publicOccurrenceFixture)).toBe('Pituba');
    expect(getNeighborhoodLabel(secondPublicOccurrenceFixture)).toBe('Centro');
  });
});
