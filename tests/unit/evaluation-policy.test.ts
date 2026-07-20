import { describe, expect, it } from 'vitest';

import {
  evaluationEditDeadline,
  isEvaluationEditable,
  negativeRatio,
  shouldContest,
} from '../../src/modules/evaluations/evaluation-policy.js';

const policy = {
  editWindowDays: 7,
  negativeThreshold: 0.5,
  minimumCountForContestation: 3,
};

describe('politica de avaliacoes', () => {
  it('exige o minimo e a proporcao negativa configurada', () => {
    expect(shouldContest(2, 2, policy)).toBe(false);
    expect(shouldContest(3, 1, policy)).toBe(false);
    expect(shouldContest(3, 2, policy)).toBe(true);
    expect(shouldContest(4, 2, policy)).toBe(true);
  });

  it('calcula a proporcao sem dividir por zero', () => {
    expect(negativeRatio(0, 0)).toBe(0);
    expect(negativeRatio(4, 1)).toBe(0.25);
  });

  it('permite edicao ate o limite inclusivo de sete dias', () => {
    const createdAt = new Date('2026-07-01T12:00:00.000Z');
    const deadline = new Date('2026-07-08T12:00:00.000Z');
    expect(evaluationEditDeadline(createdAt, 7)).toEqual(deadline);
    expect(isEvaluationEditable(createdAt, deadline, 7)).toBe(true);
    expect(isEvaluationEditable(createdAt, new Date(deadline.getTime() + 1), 7)).toBe(false);
  });
});
