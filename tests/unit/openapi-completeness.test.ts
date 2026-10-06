import { describe, expect, it } from 'vitest';

import { openApiDocument } from '../../src/docs/openapi.js';

const httpMethods = ['get', 'post', 'put', 'patch', 'delete'] as const;

interface Operation {
  operationId?: string;
  summary?: string;
  tags?: string[];
  security?: unknown[];
  requestBody?: {
    content?: Record<string, { schema?: unknown }>;
  };
  responses?: Record<string, unknown>;
}

function operations(): Array<{ path: string; method: string; operation: Operation }> {
  const paths = openApiDocument.paths as Record<string, Record<string, unknown>>;
  return Object.entries(paths).flatMap(([path, pathItem]) =>
    httpMethods.flatMap((method) => {
      const operation = pathItem[method] as Operation | undefined;
      return operation === undefined ? [] : [{ path, method, operation }];
    }),
  );
}

function resolveLocalReference(reference: string): unknown {
  return reference
    .slice(2)
    .split('/')
    .reduce<unknown>((value, segment) => {
      if (value === null || typeof value !== 'object') return undefined;
      return (value as Record<string, unknown>)[segment];
    }, openApiDocument);
}

function collectReferences(value: unknown, references: string[] = []): string[] {
  if (Array.isArray(value)) {
    for (const item of value) collectReferences(item, references);
    return references;
  }
  if (value === null || typeof value !== 'object') return references;
  for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
    if (key === '$ref' && typeof entry === 'string') references.push(entry);
    else collectReferences(entry, references);
  }
  return references;
}

describe('OpenAPI final', () => {
  it('mantem o inventario completo e operationIds unicos', () => {
    const documented = operations();
    const operationIds = documented.map(({ operation }) => operation.operationId);

    expect(Object.keys(openApiDocument.paths)).toHaveLength(57);
    expect(documented).toHaveLength(67);
    expect(operationIds.every((value) => typeof value === 'string' && value.length > 0)).toBe(true);
    expect(new Set(operationIds).size).toBe(operationIds.length);
  });

  it('documenta resumo, tags, respostas de sucesso e rate limit em cada operacao', () => {
    for (const { path, method, operation } of operations()) {
      expect(operation.summary, `${method.toUpperCase()} ${path} sem summary`).toBeTypeOf('string');
      expect(operation.tags?.length, `${method.toUpperCase()} ${path} sem tag`).toBeGreaterThan(0);
      const responseCodes = Object.keys(operation.responses ?? {});
      expect(
        responseCodes.some((code) => /^2\d\d$/u.test(code)),
        `${method.toUpperCase()} ${path} sem resposta 2xx`,
      ).toBe(true);
      if (path.startsWith('/api/')) {
        expect(responseCodes, `${method.toUpperCase()} ${path} sem resposta 429`).toContain('429');
      }
    }
  });

  it('mantem schemas para todos os corpos e referencias locais resolviveis', () => {
    for (const { path, method, operation } of operations()) {
      if (operation.requestBody === undefined) continue;
      const mediaTypes = Object.entries(operation.requestBody.content ?? {});
      expect(mediaTypes.length, `${method.toUpperCase()} ${path} sem media type`).toBeGreaterThan(
        0,
      );
      for (const [mediaType, content] of mediaTypes) {
        expect(
          content.schema,
          `${method.toUpperCase()} ${path} ${mediaType} sem schema`,
        ).toBeDefined();
      }
    }

    const references = collectReferences(openApiDocument);
    expect(references.length).toBeGreaterThan(0);
    for (const reference of references) {
      expect(reference.startsWith('#/'), `Referencia externa inesperada: ${reference}`).toBe(true);
      expect(
        resolveLocalReference(reference),
        `Referencia inexistente: ${reference}`,
      ).toBeDefined();
    }
  });

  it('documenta autenticacao sempre que 401 faz parte do contrato', () => {
    const credentialFlows = new Set(['login', 'refreshSession']);
    for (const { path, method, operation } of operations()) {
      if (operation.responses?.['401'] === undefined) continue;
      if (operation.operationId !== undefined && credentialFlows.has(operation.operationId)) {
        continue;
      }
      expect(
        operation.security?.length ?? 0,
        `${method.toUpperCase()} ${path} declara 401 mas nao documenta security`,
      ).toBeGreaterThan(0);
    }
  });

  it('documenta os dois uploads como multipart binario', () => {
    const paths = openApiDocument.paths as Record<string, Record<string, Operation>>;
    const uploads = [
      paths['/api/v1/occurrences']?.post,
      paths['/api/v1/occurrences/{occurrenceId}/images']?.post,
    ];
    for (const operation of uploads) {
      const schema = operation?.requestBody?.content?.['multipart/form-data']?.schema;
      expect(schema).toMatchObject({
        type: 'object',
        properties: { image: { type: 'string', format: 'binary' } },
      });
    }
  });
});
