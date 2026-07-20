import { describe, expect, it } from 'vitest';

import { DefaultPriorityService } from '../../src/modules/confirmations/priority.service.js';

const service = new DefaultPriorityService();
const baseDate = new Date('2026-07-01T00:00:00.000Z');

describe('PriorityService', () => {
  it('retorna zero sem confirmacoes, gravidade, idade ou risco', () => {
    expect(
      service.calculate({
        confirmationCount: 0,
        severity: null,
        riskLevel: null,
        firstReportedAt: baseDate,
        calculatedAt: baseDate,
      }),
    ).toBe(0);
  });

  it('aplica os quatro pesos e arredonda para duas casas', () => {
    expect(
      service.calculate({
        confirmationCount: 3,
        severity: 4,
        riskLevel: 'HIGH',
        firstReportedAt: baseDate,
        calculatedAt: new Date('2026-07-11T00:00:00.000Z'),
      }),
    ).toBe(46.92);
  });

  it('limita confirmacoes, idade e resultado em 100', () => {
    expect(
      service.calculate({
        confirmationCount: 200,
        severity: 5,
        riskLevel: 'CRITICAL',
        firstReportedAt: baseDate,
        calculatedAt: new Date('2027-07-01T00:00:00.000Z'),
      }),
    ).toBe(100);
  });

  it('nao gera idade negativa para datas futuras', () => {
    expect(
      service.calculate({
        confirmationCount: 1,
        severity: null,
        riskLevel: null,
        firstReportedAt: new Date('2026-07-02T00:00:00.000Z'),
        calculatedAt: baseDate,
      }),
    ).toBe(1.75);
  });
});
