import { describe, expect, it } from 'vitest';

import type { AiServiceRequest } from '../src/contracts.js';
import { analyzeOccurrence } from '../src/engine.js';

const nearbyId = '60000000-0000-4000-8000-000000000001';

function buildRequest(): AiServiceRequest {
  return {
    analysisType: 'CLASSIFICATION',
    reportId: '70000000-0000-4000-8000-000000000001',
    imageUrl: 'http://localhost:3000/uploads/example.jpg',
    description: 'Buraco muito grande e perigoso no asfalto da avenida',
    latitude: -12.9714,
    longitude: -38.5014,
    nearbyOccurrences: [
      {
        id: nearbyId,
        category: 'Buraco na via',
        distanceMeters: 12,
        description: 'Buraco grande e perigoso no asfalto da avenida',
        imageUrls: ['http://localhost:3000/uploads/nearby.jpg'],
      },
    ],
    availableCategories: [
      { code: 'STREET_LIGHTING', name: 'Poste apagado' },
      { code: 'POTHOLE', name: 'Buraco na via' },
      { code: 'WATER_LEAK', name: 'Vazamento de água' },
    ],
  };
}

describe('analyzeOccurrence', () => {
  it('selects only a provided category and always requires human review', () => {
    const result = analyzeOccurrence(buildRequest());

    expect(result.category).toBe('POTHOLE');
    expect(result.requiresHumanReview).toBe(true);
    expect(result.confidence).toBeLessThanOrEqual(0.7);
    expect(result.severity).toBe(4);
    expect(result.risk).toBe('HIGH');
  });

  it('returns duplicate identifiers only from the supplied nearby occurrences', () => {
    const request = buildRequest();
    const result = analyzeOccurrence(request);
    const allowedIds = new Set(
      request.nearbyOccurrences.map((occurrence) => occurrence.id),
    );

    expect(result.possibleDuplicates).toContainEqual(
      expect.objectContaining({ occurrenceId: nearbyId }),
    );
    expect(
      result.possibleDuplicates.every((duplicate) =>
        allowedIds.has(duplicate.occurrenceId),
      ),
    ).toBe(true);
  });

  it('is deterministic for identical input', () => {
    const request = buildRequest();

    expect(analyzeOccurrence(request)).toEqual(analyzeOccurrence(request));
  });
});
