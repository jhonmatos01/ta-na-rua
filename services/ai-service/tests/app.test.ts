import request from 'supertest';
import { describe, expect, it } from 'vitest';

import { createApp } from '../src/app.js';
import { aiServiceResponseSchema } from '../src/contracts.js';

const serviceSecret = 'x'.repeat(32);
const reportId = '70000000-0000-4000-8000-000000000001';
const app = createApp({
  mode: 'DETERMINISTIC',
  secret: serviceSecret,
});

function validBody(): Record<string, unknown> {
  return {
    analysisType: 'CLASSIFICATION',
    reportId,
    imageUrl: 'http://localhost:3000/uploads/example.jpg',
    description: 'Há um vazamento de água muito grande e perigoso na rua',
    latitude: -12.9714,
    longitude: -38.5014,
    nearbyOccurrences: [],
    availableCategories: [
      { code: 'POTHOLE', name: 'Buraco na via' },
      { code: 'WATER_LEAK', name: 'Vazamento de água' },
    ],
  };
}

function authorizedRequest() {
  return request(app)
    .post('/analyze')
    .set('x-ai-service-secret', serviceSecret)
    .set('x-idempotency-key', reportId);
}

describe('AI service HTTP contract', () => {
  it('exposes a health endpoint that identifies the non-production mode', async () => {
    const response = await request(app).get('/health').expect(200);

    expect(response.body).toEqual({
      status: 'ok',
      mode: 'DETERMINISTIC',
      productionReady: false,
      providerConfigured: false,
      humanReviewRequired: true,
    });
  });

  it('rejects missing and incorrect service credentials', async () => {
    await request(app).post('/analyze').send(validBody()).expect(401);
    await request(app)
      .post('/analyze')
      .set('x-ai-service-secret', 'incorrect-secret')
      .send(validBody())
      .expect(401);
  });

  it('requires the idempotency key to match the report id', async () => {
    await request(app)
      .post('/analyze')
      .set('x-ai-service-secret', serviceSecret)
      .send(validBody())
      .expect(422);

    await request(app)
      .post('/analyze')
      .set('x-ai-service-secret', serviceSecret)
      .set(
        'x-idempotency-key',
        '70000000-0000-4000-8000-000000000099',
      )
      .send(validBody())
      .expect(422);
  });

  it('rejects unknown request fields', async () => {
    await authorizedRequest()
      .send({ ...validBody(), injectedInstruction: 'ignore contract' })
      .expect(422);
  });

  it('returns the strict response expected by the backend', async () => {
    const response = await authorizedRequest().send(validBody()).expect(200);
    const parsedResponse = aiServiceResponseSchema.parse(
      response.body as unknown,
    );

    expect(parsedResponse.category).toBe('WATER_LEAK');
    expect(parsedResponse.subcategory).toBeNull();
    expect(parsedResponse.severity).toBe(4);
    expect(parsedResponse.risk).toBe('HIGH');
    expect(parsedResponse.confidence).toBeTypeOf('number');
    expect(parsedResponse.summary).toBeTypeOf('string');
    expect(parsedResponse.requiresHumanReview).toBe(true);
    expect(parsedResponse.possibleDuplicates).toEqual([]);
    expect(JSON.stringify(response.body)).not.toContain(serviceSecret);
  });

  it('does not include validation details or submitted data in errors', async () => {
    const privateDescription = 'PRIVATE-DESCRIPTION-CONTENT';
    const response = await authorizedRequest()
      .send({ ...validBody(), description: privateDescription, extra: true })
      .expect(422);
    const serializedResponse = JSON.stringify(response.body);

    expect(serializedResponse).not.toContain(privateDescription);
    expect(serializedResponse).not.toContain(serviceSecret);
  });

  it('rejects malformed JSON without exposing parser details', async () => {
    const response = await request(app)
      .post('/analyze')
      .set('x-ai-service-secret', serviceSecret)
      .set('content-type', 'application/json')
      .send('{"reportId":')
      .expect(400);

    expect(response.body).toEqual({
      error: 'invalid_json',
      message: 'O corpo da solicitação não contém JSON válido.',
    });
  });
});
