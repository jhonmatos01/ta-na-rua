import type { AiServiceRequest, AiServiceResponse } from './contracts.js';

const CATEGORY_SYNONYM_GROUPS = [
  ['buraco', 'asfalto', 'pavimento', 'pista', 'via'],
  ['poste', 'iluminacao', 'luz', 'lampada', 'escuro'],
  ['vazamento', 'agua', 'cano', 'tubulacao'],
  ['calcada', 'passeio', 'acessibilidade'],
  ['lixo', 'entulho', 'residuo', 'coleta'],
  ['esgoto', 'bueiro', 'drenagem'],
] as const;

const CRITICAL_TERMS = [
  'risco de morte',
  'acidente grave',
  'desabamento',
  'fio energizado',
  'via interditada',
];

const HIGH_TERMS = [
  'perigo',
  'acidente',
  'alagamento',
  'intransitavel',
  'muito grande',
  'muito fundo',
  'sem iluminacao',
];

const LOW_TERMS = ['pequeno', 'leve', 'superficial', 'pouco'];

function normalize(value: string): string {
  return value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLocaleLowerCase('pt-BR')
    .replace(/[^\p{Letter}\p{Number}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function tokenize(value: string): Set<string> {
  return new Set(
    normalize(value)
      .split(' ')
      .filter((token) => token.length >= 3),
  );
}

function countIntersection(left: Set<string>, right: Set<string>): number {
  let intersection = 0;

  for (const token of left) {
    if (right.has(token)) {
      intersection += 1;
    }
  }

  return intersection;
}

function jaccardSimilarity(left: string, right: string): number {
  const leftTokens = tokenize(left);
  const rightTokens = tokenize(right);

  if (leftTokens.size === 0 || rightTokens.size === 0) {
    return 0;
  }

  const intersection = countIntersection(leftTokens, rightTokens);
  const union = leftTokens.size + rightTokens.size - intersection;

  return union === 0 ? 0 : intersection / union;
}

function containsAny(value: string, terms: readonly string[]): boolean {
  return terms.some((term) => value.includes(term));
}

function selectCategory(request: AiServiceRequest): {
  code: string;
  name: string;
  score: number;
} {
  const normalizedDescription = normalize(request.description);
  const descriptionTokens = tokenize(request.description);
  const [firstCategory, ...remainingCategories] = request.availableCategories;

  if (firstCategory === undefined) {
    throw new Error('At least one category is required.');
  }

  const scoreCategory = (category: (typeof request.availableCategories)[number]) => {
    const normalizedCategory = normalize(`${category.code} ${category.name}`);
    const categoryTokens = tokenize(normalizedCategory);
    let score = countIntersection(descriptionTokens, categoryTokens) * 2;

    for (const synonymGroup of CATEGORY_SYNONYM_GROUPS) {
      if (
        containsAny(normalizedDescription, synonymGroup) &&
        containsAny(normalizedCategory, synonymGroup)
      ) {
        score += 3;
      }
    }

    return { ...category, score };
  };

  let selected = scoreCategory(firstCategory);

  for (const category of remainingCategories) {
    const candidate = scoreCategory(category);

    if (candidate.score > selected.score) {
      selected = candidate;
    }
  }

  return selected;
}

function inferSeverity(description: string): number {
  const normalizedDescription = normalize(description);

  if (containsAny(normalizedDescription, CRITICAL_TERMS)) {
    return 5;
  }

  if (containsAny(normalizedDescription, HIGH_TERMS)) {
    return 4;
  }

  if (containsAny(normalizedDescription, LOW_TERMS)) {
    return 2;
  }

  return 3;
}

function riskForSeverity(
  severity: number,
): AiServiceResponse['risk'] {
  if (severity >= 5) {
    return 'CRITICAL';
  }

  if (severity === 4) {
    return 'HIGH';
  }

  if (severity === 3) {
    return 'MEDIUM';
  }

  return 'LOW';
}

function round(value: number): number {
  return Math.round(value * 1_000) / 1_000;
}

function categoryMatches(candidate: string | null, code: string, name: string): boolean {
  if (candidate === null) {
    return false;
  }

  const normalizedCandidate = normalize(candidate);

  return (
    normalizedCandidate === normalize(code) ||
    normalizedCandidate === normalize(name)
  );
}

function findPossibleDuplicates(
  request: AiServiceRequest,
  category: { code: string; name: string },
): AiServiceResponse['possibleDuplicates'] {
  return request.nearbyOccurrences
    .map((occurrence) => {
      const textScore = jaccardSimilarity(
        request.description,
        occurrence.description,
      );
      const distanceScore = Math.max(0, 1 - occurrence.distanceMeters / 100);
      const categoryScore = categoryMatches(
        occurrence.category,
        category.code,
        category.name,
      )
        ? 1
        : 0;
      const similarity = round(
        textScore * 0.65 + distanceScore * 0.25 + categoryScore * 0.1,
      );

      return {
        occurrenceId: occurrence.id,
        similarity,
        reason: `Descrição e proximidade comparadas a ${Math.round(
          occurrence.distanceMeters,
        )} m.`,
      };
    })
    .filter((candidate) => candidate.similarity >= 0.45)
    .sort((left, right) => right.similarity - left.similarity)
    .slice(0, 10);
}

export function analyzeOccurrence(request: AiServiceRequest): AiServiceResponse {
  const category = selectCategory(request);
  const severity = inferSeverity(request.description);
  const possibleDuplicates = findPossibleDuplicates(request, category);
  const confidence =
    category.score === 0 ? 0.35 : Math.min(0.7, 0.48 + category.score * 0.04);

  return {
    category: category.code,
    subcategory: null,
    severity,
    risk: riskForSeverity(severity),
    confidence: round(confidence),
    summary:
      possibleDuplicates.length > 0
        ? `Sugestão determinística: ${category.name}; ${possibleDuplicates.length} ocorrência(s) próxima(s) requerem conferência.`
        : `Sugestão determinística: ${category.name}; nenhuma duplicidade provável foi identificada.`,
    requiresHumanReview: true,
    possibleDuplicates,
  };
}
