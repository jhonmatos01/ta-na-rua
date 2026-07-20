import type { RiskLevel } from '../occurrences/occurrences.types.js';

const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000;

const riskScores: Readonly<Record<RiskLevel, number>> = {
  LOW: 25,
  MEDIUM: 50,
  HIGH: 75,
  CRITICAL: 100,
};

export interface PriorityInput {
  confirmationCount: number;
  severity: number | null;
  riskLevel: RiskLevel | null;
  firstReportedAt: Date;
  calculatedAt: Date;
}

export interface PriorityService {
  calculate(input: PriorityInput): number;
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

export class DefaultPriorityService implements PriorityService {
  public calculate(input: PriorityInput): number {
    const confirmationScore = Math.min(Math.max(input.confirmationCount, 0) / 20, 1) * 100;
    const severityScore = input.severity === null ? 0 : clamp(input.severity / 5, 0, 1) * 100;
    const daysOpen = Math.max(
      0,
      (input.calculatedAt.getTime() - input.firstReportedAt.getTime()) / MILLISECONDS_PER_DAY,
    );
    const ageScore = Math.min(daysOpen / 30, 1) * 100;
    const riskScore = input.riskLevel === null ? 0 : riskScores[input.riskLevel];
    const score =
      confirmationScore * 0.35 + severityScore * 0.25 + ageScore * 0.2 + riskScore * 0.2;

    return Math.round((clamp(score, 0, 100) + Number.EPSILON) * 100) / 100;
  }
}
