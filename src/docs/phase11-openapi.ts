const bearer = [{ bearerAuth: [] }];
const uuid = { type: 'string', format: 'uuid' };
const imageId = { name: 'imageId', in: 'path', required: true, schema: uuid };
const error = { description: 'Erro padronizado com error.code, error.message e meta.requestId.' };
const json = (schema: Record<string, unknown>) => ({ 'application/json': { schema } });
const envelope = (properties: Record<string, unknown>) => ({
  type: 'object',
  properties: { success: { type: 'boolean' }, data: { type: 'object', properties } },
});
const pagination = {
  type: 'object',
  properties: {
    page: { type: 'integer' },
    limit: { type: 'integer' },
    total: { type: 'integer' },
    totalPages: { type: 'integer' },
  },
};
const moderationStates = ['PENDING', 'APPROVED', 'REJECTED', 'FLAGGED'];
const statuses = { type: 'string', enum: moderationStates };
const image = {
  type: 'object',
  properties: {
    id: uuid,
    occurrenceId: uuid,
    title: { type: 'string' },
    protocol: { type: 'string' },
    municipalityId: uuid,
    status: statuses,
    occurrenceStatus: { type: 'string' },
    url: { type: 'string' },
    createdAt: { type: 'string', format: 'date-time' },
  },
};
export const phase11Paths = {
  '/api/v1/media/{imageId}': {
    get: {
      operationId: 'readOccurrenceImage',
      summary: 'Ler imagem com controle de visibilidade',
      tags: ['Media'],
      security: [{}, ...bearer],
      parameters: [imageId],
      description:
        'Anonimo: somente imagem aprovada de ocorrencia publica nao excluida. Autor, operador do municipio e moderadores podem consultar imagens privadas. Cache-Control: private, no-store. S3 deve impedir acesso direto ao bucket/CDN.',
      responses: {
        '200': {
          description: 'Imagem binaria.',
          content: {
            'image/png': { schema: { type: 'string', format: 'binary' } },
            'image/jpeg': { schema: { type: 'string', format: 'binary' } },
            'image/webp': { schema: { type: 'string', format: 'binary' } },
          },
        },
        '401': error,
        '403': error,
        '404': error,
        '422': error,
      },
    },
  },
  '/api/v1/moderation/images': {
    get: {
      operationId: 'listImageReviewQueue',
      summary: 'Fila de revisao de imagens para ADMIN ou MODERATOR',
      tags: ['Media'],
      security: bearer,
      parameters: [
        { name: 'status', in: 'query', schema: { ...statuses, default: 'PENDING' } },
        { name: 'municipalityId', in: 'query', schema: uuid },
        {
          name: 'page',
          in: 'query',
          schema: { type: 'integer', minimum: 1, maximum: 100000, default: 1 },
        },
        {
          name: 'limit',
          in: 'query',
          schema: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
        },
      ],
      responses: {
        '200': {
          description: 'Fila paginada sem chave de storage ou identidade do autor.',
          content: json(envelope({ images: { type: 'array', items: image }, pagination })),
        },
        '401': error,
        '403': error,
        '422': error,
      },
    },
  },
  '/api/v1/moderation/images/{imageId}': {
    patch: {
      operationId: 'reviewOccurrenceImage',
      summary: 'Registrar decisao auditada de moderacao de imagem',
      tags: ['Media'],
      security: bearer,
      parameters: [imageId],
      description:
        'Requer motivo e expectedStatus. Um conflito de revisao retorna 409. Aprovacao da foto nao altera status da ocorrencia.',
      requestBody: {
        required: true,
        content: json({
          type: 'object',
          additionalProperties: false,
          required: ['status', 'expectedStatus', 'reason'],
          properties: {
            status: { type: 'string', enum: ['APPROVED', 'REJECTED', 'FLAGGED'] },
            expectedStatus: statuses,
            reason: { type: 'string', minLength: 3, maxLength: 1000 },
          },
        }),
      },
      responses: {
        '200': {
          description: 'Decisao registrada.',
          content: json(
            envelope({ image: { type: 'object', properties: { id: uuid, status: statuses } } }),
          ),
        },
        '401': error,
        '403': error,
        '404': error,
        '409': error,
        '422': error,
      },
    },
  },
  '/api/v1/catalog/municipalities': {
    get: {
      operationId: 'listPublicMunicipalities',
      summary: 'Catalogo de municipios ativos',
      tags: ['Catalog'],
      security: [],
      responses: {
        '200': {
          description: 'Municipios ordenados por UF e nome.',
          content: json(
            envelope({
              municipalities: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    id: uuid,
                    name: { type: 'string' },
                    state: { type: 'string' },
                    ibgeCode: { type: 'string' },
                    latitude: { type: 'number' },
                    longitude: { type: 'number' },
                  },
                },
              },
            }),
          ),
        },
        '422': error,
      },
    },
  },
  '/api/v1/catalog/categories': {
    get: {
      operationId: 'listPublicCategories',
      summary: 'Catalogo de categorias ativas',
      tags: ['Catalog'],
      security: [],
      responses: {
        '200': {
          description: 'Categorias de infraestrutura municipal.',
          content: json(
            envelope({
              categories: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    id: uuid,
                    code: { type: 'string' },
                    name: { type: 'string' },
                    slug: { type: 'string' },
                    description: { type: 'string' },
                    icon: { type: 'string', nullable: true },
                  },
                },
              },
            }),
          ),
        },
        '422': error,
      },
    },
  },
  '/api/v1/catalog/neighborhoods': {
    get: {
      operationId: 'listPublicNeighborhoods',
      summary: 'Catalogo de bairros ativos de um municipio ativo',
      tags: ['Catalog'],
      security: [],
      parameters: [{ name: 'municipalityId', in: 'query', required: true, schema: uuid }],
      responses: {
        '200': {
          description: 'Bairros do municipio selecionado.',
          content: json(
            envelope({
              neighborhoods: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    id: uuid,
                    municipalityId: uuid,
                    name: { type: 'string' },
                    slug: { type: 'string' },
                  },
                },
              },
            }),
          ),
        },
        '404': error,
        '422': error,
      },
    },
  },
} as const;
