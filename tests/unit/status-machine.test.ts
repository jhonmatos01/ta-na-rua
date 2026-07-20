import { describe, expect, it } from 'vitest';

import { occurrenceStatusValues } from '../../src/database/schema/enums.js';
import {
  canRoleTransition,
  isValidStatusTransition,
  validStatusTransitions,
} from '../../src/modules/status/status-machine.js';

describe('maquina de estados definitiva', () => {
  it('contem exatamente as 24 transicoes do PRD', () => {
    const transitions = Object.entries(validStatusTransitions).flatMap(([from, targets]) =>
      targets.map((to) => `${from}->${to}`),
    );
    expect(transitions).toHaveLength(24);
    expect(transitions).toContain('PENDING_REVIEW->PUBLISHED');
    expect(transitions).toContain('PUBLISHED->DUPLICATE');
    expect(transitions).toContain('CLOSED->CONTESTED');
    expect(transitions).toContain('DUPLICATE->PENDING_REVIEW');
  });

  it('rejeita todas as combinacoes ausentes, inclusive o mesmo status', () => {
    for (const previous of occurrenceStatusValues) {
      for (const next of occurrenceStatusValues) {
        expect(isValidStatusTransition(previous, next)).toBe(
          validStatusTransitions[previous].includes(next),
        );
      }
    }
    expect(isValidStatusTransition('PUBLISHED', 'RESOLVED')).toBe(false);
    expect(isValidStatusTransition('IN_PROGRESS', 'IN_PROGRESS')).toBe(false);
  });

  it('nega alteracao direta ao cidadao e limita o operador ao atendimento', () => {
    expect(canRoleTransition('CITIZEN', 'PUBLISHED', 'FORWARDED')).toBe(false);
    expect(canRoleTransition('CITY_OPERATOR', 'PUBLISHED', 'FORWARDED')).toBe(true);
    expect(canRoleTransition('CITY_OPERATOR', 'PENDING_REVIEW', 'PUBLISHED')).toBe(false);
    expect(canRoleTransition('CITY_OPERATOR', 'PUBLISHED', 'DUPLICATE')).toBe(false);
    expect(canRoleTransition('CITY_OPERATOR', 'IN_PROGRESS', 'RESOLVED')).toBe(true);
  });

  it('permite ao moderador e administrador todas as transicoes validas', () => {
    for (const [previous, targets] of Object.entries(validStatusTransitions)) {
      for (const next of targets) {
        expect(canRoleTransition('MODERATOR', previous as never, next)).toBe(true);
        expect(canRoleTransition('ADMIN', previous as never, next)).toBe(true);
      }
    }
  });
});
