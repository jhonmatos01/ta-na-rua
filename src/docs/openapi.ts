import { phase11Paths } from './phase11-openapi.js';
const successMetaSchema = {
  type: 'object',
  required: ['requestId'],
  properties: {
    requestId: {
      type: 'string',
      format: 'uuid',
      example: 'de305d54-75b4-431b-adb2-eb6b9e546014',
    },
  },
} as const;

const errorResponseSchema = {
  type: 'object',
  required: ['success', 'error', 'meta'],
  properties: {
    success: { type: 'boolean', enum: [false] },
    error: {
      type: 'object',
      required: ['code', 'message', 'details'],
      properties: {
        code: { type: 'string', example: 'DATABASE_UNAVAILABLE' },
        message: {
          type: 'string',
          example: 'O banco de dados esta temporariamente indisponivel.',
        },
        details: { type: 'object', additionalProperties: true },
      },
    },
    meta: successMetaSchema,
  },
} as const;

const errorResponse = (description: string) => ({
  description,
  content: {
    'application/json': {
      schema: { $ref: '#/components/schemas/ErrorResponse' },
    },
  },
});

const bearerSecurity = [{ bearerAuth: [] }] as const;
const internalAiSecurity = [{ aiInternalSecret: [] }] as const;

const occurrenceStatusSchema = {
  type: 'string',
  enum: [
    'PENDING_REVIEW',
    'PUBLISHED',
    'FORWARDED',
    'ACKNOWLEDGED',
    'UNDER_ANALYSIS',
    'SCHEDULED',
    'IN_PROGRESS',
    'RESOLVED',
    'CONTESTED',
    'CLOSED',
    'REJECTED',
    'DUPLICATE',
  ],
} as const;

const dashboardFilterParameters = [
  {
    in: 'query',
    name: 'municipalityId',
    description: 'Opcional para MODERATOR e ADMIN. CITY_OPERATOR sempre usa o municipio do token.',
    schema: { type: 'string', format: 'uuid' },
  },
  { in: 'query', name: 'categoryId', schema: { type: 'string', format: 'uuid' } },
  { in: 'query', name: 'neighborhoodId', schema: { type: 'string', format: 'uuid' } },
  { in: 'query', name: 'status', schema: occurrenceStatusSchema },
  {
    in: 'query',
    name: 'startDate',
    description: 'Inicio inclusivo do periodo, aplicado a createdAt.',
    schema: { type: 'string', format: 'date-time' },
  },
  {
    in: 'query',
    name: 'endDate',
    description: 'Fim inclusivo do periodo, aplicado a createdAt.',
    schema: { type: 'string', format: 'date-time' },
  },
] as const;

const dashboardJsonResponse = (description: string, dataProperties: Record<string, unknown>) => ({
  description,
  content: {
    'application/json': {
      schema: {
        type: 'object',
        required: ['success', 'data', 'meta'],
        properties: {
          success: { type: 'boolean', enum: [true] },
          data: {
            type: 'object',
            additionalProperties: false,
            required: Object.keys(dataProperties),
            properties: dataProperties,
          },
          meta: successMetaSchema,
        },
      },
    },
  },
});

const webhookHeaderParameters = [
  {
    in: 'header',
    name: 'x-webhook-id',
    required: true,
    description: 'Deve ser identico a externalEventId.',
    schema: { type: 'string', maxLength: 255 },
  },
  {
    in: 'header',
    name: 'x-webhook-timestamp',
    required: true,
    description: 'Unix timestamp em segundos, dentro da janela configurada.',
    schema: { type: 'string', pattern: '^\\d{10}$' },
  },
] as const;

const webhookResponses = {
  '202': {
    description: 'Evento autenticado, registrado e processado pela camada de entrada.',
    content: {
      'application/json': { schema: { $ref: '#/components/schemas/WebhookResponse' } },
    },
  },
  '200': {
    description: 'Repeticao idempotente do mesmo evento.',
    content: {
      'application/json': { schema: { $ref: '#/components/schemas/WebhookResponse' } },
    },
  },
  '401': errorResponse('Assinatura, timestamp ou identificador invalido.'),
  '409': errorResponse('Identificador reutilizado com outro payload.'),
  '422': errorResponse('Payload invalido.'),
  '429': errorResponse('Limite de requisicoes excedido.'),
  '503': errorResponse('Integracao nao configurada ou processamento indisponivel.'),
} as const;

const occurrenceIdParameter = {
  in: 'path',
  name: 'occurrenceId',
  required: true,
  schema: { type: 'string', format: 'uuid' },
} as const;

const departmentIdParameter = {
  in: 'path',
  name: 'departmentId',
  required: true,
  schema: { type: 'string', format: 'uuid' },
} as const;

const occurrenceListParameters = [
  { in: 'query', name: 'municipalityId', schema: { type: 'string', format: 'uuid' } },
  { in: 'query', name: 'neighborhood', schema: { type: 'string', maxLength: 150 } },
  { in: 'query', name: 'category', schema: { type: 'string', maxLength: 140 } },
  {
    in: 'query',
    name: 'status',
    schema: {
      type: 'string',
      enum: [
        'PENDING_REVIEW',
        'PUBLISHED',
        'FORWARDED',
        'ACKNOWLEDGED',
        'UNDER_ANALYSIS',
        'SCHEDULED',
        'IN_PROGRESS',
        'RESOLVED',
        'CONTESTED',
        'CLOSED',
        'REJECTED',
        'DUPLICATE',
      ],
    },
  },
  {
    in: 'query',
    name: 'risk',
    schema: { type: 'string', enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] },
  },
  { in: 'query', name: 'priority', schema: { type: 'number', minimum: 0, maximum: 100 } },
  { in: 'query', name: 'latitude', schema: { type: 'number', minimum: -90, maximum: 90 } },
  { in: 'query', name: 'longitude', schema: { type: 'number', minimum: -180, maximum: 180 } },
  { in: 'query', name: 'radius', schema: { type: 'integer', minimum: 1, maximum: 50000 } },
  { in: 'query', name: 'startDate', schema: { type: 'string', format: 'date-time' } },
  { in: 'query', name: 'endDate', schema: { type: 'string', format: 'date-time' } },
  { in: 'query', name: 'page', schema: { type: 'integer', minimum: 1, default: 1 } },
  {
    in: 'query',
    name: 'limit',
    schema: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
  },
] as const;

const userResponseProperties = {
  id: { type: 'string', format: 'uuid' },
  name: { type: 'string', example: 'Ana Cidada' },
  email: { type: 'string', format: 'email', example: 'ana@example.test' },
  phone: { type: 'string', nullable: true, example: '+5571999990001' },
  role: { type: 'string', enum: ['CITIZEN', 'CITY_OPERATOR', 'MODERATOR', 'ADMIN'] },
  municipalityId: { type: 'string', format: 'uuid', nullable: true },
  neighborhood: { type: 'string', nullable: true },
  avatarUrl: { type: 'string', format: 'uri', nullable: true },
  status: { type: 'string', enum: ['ACTIVE', 'PENDING', 'BLOCKED', 'DELETED'] },
  emailVerifiedAt: { type: 'string', format: 'date-time', nullable: true },
  lastLoginAt: { type: 'string', format: 'date-time', nullable: true },
  createdAt: { type: 'string', format: 'date-time' },
  updatedAt: { type: 'string', format: 'date-time' },
  deletedAt: { type: 'string', format: 'date-time', nullable: true },
} as const;

const openApiBaseDocument = {
  openapi: '3.0.3',
  info: {
    title: 'Ta na Rua! API',
    version: '1.0.0',
    description:
      'API REST final do MVP Ta na Rua!, com autenticacao, isolamento municipal, ocorrencias, operacao, dashboard, notificacoes, IA e webhooks. Todas as rotas /api estao sujeitas ao limite global documentado com HTTP 429; webhooks possuem uma camada adicional por provedor e origem.',
  },
  servers: [
    {
      url: '/',
      description: 'Mesma origem da interface Swagger',
    },
  ],
  tags: [
    {
      name: 'Health',
      description: 'Disponibilidade da API e de suas dependencias.',
    },
    { name: 'Auth', description: 'Cadastro, login e ciclo de vida das sessoes.' },
    { name: 'Users', description: 'Perfil autenticado e exclusao logica.' },
    { name: 'Admin Users', description: 'Gestao de usuarios exclusiva de ADMIN.' },
    {
      name: 'Occurrences',
      description: 'Criacao, consulta, localizacao, imagens e exclusao logica de ocorrencias.',
    },
    {
      name: 'Confirmations',
      description: 'Eu tambem vi, contagem comunitaria e recalculo atomico da prioridade.',
    },
    {
      name: 'Status',
      description: 'Maquina de estados, atribuicao municipal e historico das ocorrencias.',
    },
    {
      name: 'Departments',
      description: 'Gestao de departamentos com isolamento municipal.',
    },
    {
      name: 'Evaluations',
      description: 'Avaliacoes de reparo, resumo agregado e contestacao automatica.',
    },
    {
      name: 'Internal AI',
      description: 'Operacoes internas protegidas por segredo; nunca sao rotas publicas.',
    },
    {
      name: 'Dashboard',
      description:
        'Indicadores municipais para CITY_OPERATOR, MODERATOR e ADMIN, com isolamento por municipio.',
    },
    {
      name: 'Notifications',
      description: 'Notificacoes internas sempre restritas ao usuario autenticado.',
    },
    {
      name: 'Webhooks',
      description: 'Entradas externas autenticadas com HMAC-SHA256, timestamp e idempotencia.',
    },
  ],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'Access token JWT retornado por /api/v1/auth/login ou /refresh.',
      },
      aiInternalSecret: {
        type: 'apiKey',
        in: 'header',
        name: 'x-ai-service-secret',
        description:
          'Segredo interno configurado em AI_SERVICE_SECRET. Nunca use um segredo real no Swagger compartilhado.',
      },
      webhookSignature: {
        type: 'apiKey',
        in: 'header',
        name: 'x-webhook-signature',
        description:
          'HMAC-SHA256 no formato sha256=hex sobre "timestamp.corpo-bruto". Use tambem x-webhook-id e x-webhook-timestamp.',
      },
    },
    schemas: {
      ResponseMeta: successMetaSchema,
      ErrorResponse: errorResponseSchema,
      User: {
        type: 'object',
        required: ['id', 'name', 'email', 'role', 'status', 'createdAt', 'updatedAt'],
        properties: userResponseProperties,
      },
      UserResponse: {
        type: 'object',
        required: ['success', 'data', 'meta'],
        properties: {
          success: { type: 'boolean', enum: [true] },
          data: {
            type: 'object',
            required: ['user'],
            properties: { user: { $ref: '#/components/schemas/User' } },
          },
          meta: successMetaSchema,
        },
      },
      AuthSessionResponse: {
        type: 'object',
        required: ['success', 'data', 'meta'],
        properties: {
          success: { type: 'boolean', enum: [true] },
          data: {
            type: 'object',
            required: ['accessToken', 'tokenType', 'expiresIn', 'user'],
            properties: {
              accessToken: { type: 'string', description: 'JWT de curta duracao.' },
              tokenType: { type: 'string', enum: ['Bearer'] },
              expiresIn: { type: 'integer', example: 900 },
              user: { $ref: '#/components/schemas/User' },
            },
          },
          meta: successMetaSchema,
        },
      },
      ApiHealthResponse: {
        type: 'object',
        required: ['success', 'data', 'meta'],
        properties: {
          success: { type: 'boolean', enum: [true] },
          data: {
            type: 'object',
            required: ['status', 'timestamp'],
            properties: {
              status: { type: 'string', enum: ['ok'] },
              timestamp: { type: 'string', format: 'date-time' },
            },
          },
          meta: successMetaSchema,
        },
      },
      DatabaseHealthResponse: {
        type: 'object',
        required: ['success', 'data', 'meta'],
        properties: {
          success: { type: 'boolean', enum: [true] },
          data: {
            type: 'object',
            required: ['status', 'postgisVersion', 'responseTimeMs'],
            properties: {
              status: { type: 'string', enum: ['connected'] },
              postgisVersion: { type: 'string', example: '3.5 USE_GEOS=1 USE_PROJ=1 USE_STATS=1' },
              responseTimeMs: { type: 'number', format: 'double', minimum: 0, example: 4.27 },
            },
          },
          meta: successMetaSchema,
        },
      },
      OccurrenceImage: {
        type: 'object',
        required: ['id', 'url', 'mimeType', 'imageType', 'moderationStatus', 'createdAt'],
        properties: {
          id: { type: 'string', format: 'uuid' },
          url: { type: 'string', example: '/uploads/occurrences/2026/arquivo.png' },
          mimeType: { type: 'string', enum: ['image/jpeg', 'image/png', 'image/webp'] },
          imageType: { type: 'string', enum: ['INITIAL', 'UPDATE'] },
          moderationStatus: {
            type: 'string',
            enum: ['PENDING', 'APPROVED', 'REJECTED', 'FLAGGED'],
          },
          createdAt: { type: 'string', format: 'date-time' },
        },
      },
      Occurrence: {
        type: 'object',
        required: [
          'id',
          'protocol',
          'title',
          'municipality',
          'status',
          'location',
          'images',
          'createdAt',
        ],
        properties: {
          id: { type: 'string', format: 'uuid' },
          protocol: {
            type: 'string',
            pattern: '^TNR-[0-9]{4}-[0-9]{6}$',
            example: 'TNR-2026-000004',
          },
          title: { type: 'string', maxLength: 150 },
          description: { type: 'string', maxLength: 2000, nullable: true },
          category: { type: 'object', nullable: true, additionalProperties: true },
          municipality: { type: 'object', additionalProperties: true },
          neighborhood: { nullable: true, oneOf: [{ type: 'string' }, { type: 'object' }] },
          status: { type: 'string' },
          address: {
            type: 'string',
            nullable: true,
            description:
              'Sem numero/complemento no modo publico; integral somente para perfis autorizados.',
          },
          location: {
            type: 'object',
            required: ['latitude', 'longitude', 'approximate'],
            properties: {
              latitude: { type: 'number' },
              longitude: { type: 'number' },
              accuracy: { type: 'number', nullable: true },
              approximate: { type: 'boolean' },
            },
          },
          images: { type: 'array', items: { $ref: '#/components/schemas/OccurrenceImage' } },
          nearbyCandidates: {
            type: 'array',
            description:
              'Candidatos no raio e periodo configurados enviados ao contrato seguro da IA.',
            items: { type: 'object', additionalProperties: true },
          },
          aiAnalysis: {
            $ref: '#/components/schemas/AiProcessingResult',
            description:
              'Resultado ou fallback persistido depois que a ocorrencia ja foi confirmada no banco.',
          },
          createdAt: { type: 'string', format: 'date-time' },
          updatedAt: { type: 'string', format: 'date-time' },
        },
      },
      OccurrenceResponse: {
        type: 'object',
        required: ['success', 'data', 'meta'],
        properties: {
          success: { type: 'boolean', enum: [true] },
          data: {
            type: 'object',
            required: ['occurrence'],
            properties: { occurrence: { $ref: '#/components/schemas/Occurrence' } },
          },
          meta: successMetaSchema,
        },
      },
      Confirmation: {
        type: 'object',
        required: [
          'id',
          'occurrenceId',
          'directlyAffected',
          'problemWorsened',
          'comment',
          'createdAt',
          'updatedAt',
        ],
        properties: {
          id: { type: 'string', format: 'uuid' },
          occurrenceId: { type: 'string', format: 'uuid' },
          directlyAffected: { type: 'boolean' },
          problemWorsened: { type: 'boolean' },
          comment: { type: 'string', maxLength: 500, nullable: true },
          createdAt: { type: 'string', format: 'date-time' },
          updatedAt: { type: 'string', format: 'date-time' },
        },
      },
      ConfirmationMutationResponse: {
        type: 'object',
        required: ['success', 'data', 'meta'],
        properties: {
          success: { type: 'boolean', enum: [true] },
          data: {
            type: 'object',
            required: ['confirmation', 'occurrence'],
            properties: {
              confirmation: { $ref: '#/components/schemas/Confirmation' },
              occurrence: {
                type: 'object',
                required: ['confirmationCount', 'priorityScore'],
                properties: {
                  confirmationCount: { type: 'integer', minimum: 0, example: 2 },
                  priorityScore: {
                    type: 'number',
                    minimum: 0,
                    maximum: 100,
                    example: 31.75,
                  },
                },
              },
            },
          },
          meta: successMetaSchema,
        },
      },
      ConfirmationCountResponse: {
        type: 'object',
        required: ['success', 'data', 'meta'],
        properties: {
          success: { type: 'boolean', enum: [true] },
          data: {
            type: 'object',
            required: ['occurrenceId', 'confirmationCount', 'priorityScore'],
            properties: {
              occurrenceId: { type: 'string', format: 'uuid' },
              confirmationCount: { type: 'integer', minimum: 0, example: 2 },
              priorityScore: { type: 'number', minimum: 0, maximum: 100, example: 31.75 },
              confirmedByMe: {
                type: 'boolean',
                description: 'Retornado somente quando um JWT valido e enviado.',
              },
            },
          },
          meta: successMetaSchema,
        },
      },
      Department: {
        type: 'object',
        required: [
          'id',
          'municipalityId',
          'name',
          'description',
          'active',
          'createdAt',
          'updatedAt',
        ],
        properties: {
          id: { type: 'string', format: 'uuid' },
          municipalityId: { type: 'string', format: 'uuid' },
          name: { type: 'string', minLength: 2, maxLength: 150 },
          description: { type: 'string', maxLength: 2000, nullable: true },
          active: { type: 'boolean' },
          createdAt: { type: 'string', format: 'date-time' },
          updatedAt: { type: 'string', format: 'date-time' },
        },
      },
      DepartmentResponse: {
        type: 'object',
        required: ['success', 'data', 'meta'],
        properties: {
          success: { type: 'boolean', enum: [true] },
          data: {
            type: 'object',
            required: ['department'],
            properties: { department: { $ref: '#/components/schemas/Department' } },
          },
          meta: successMetaSchema,
        },
      },
      StatusOccurrence: {
        type: 'object',
        required: ['id', 'protocol', 'status', 'municipalityId', 'priorityScore'],
        properties: {
          id: { type: 'string', format: 'uuid' },
          protocol: { type: 'string', example: 'TNR-2026-000001' },
          status: occurrenceStatusSchema,
          municipalityId: { type: 'string', format: 'uuid' },
          assignedDepartmentId: { type: 'string', format: 'uuid', nullable: true },
          assignedBy: { type: 'string', format: 'uuid', nullable: true },
          assignedAt: { type: 'string', format: 'date-time', nullable: true },
          expectedResolutionAt: { type: 'string', format: 'date-time', nullable: true },
          scheduledFor: { type: 'string', format: 'date-time', nullable: true },
          resolutionDescription: { type: 'string', nullable: true },
          resolvedAt: { type: 'string', format: 'date-time', nullable: true },
          resolvedBy: { type: 'string', format: 'uuid', nullable: true },
          closedAt: { type: 'string', format: 'date-time', nullable: true },
          closedBy: { type: 'string', format: 'uuid', nullable: true },
          duplicateOfOccurrenceId: { type: 'string', format: 'uuid', nullable: true },
          priorityScore: { type: 'number', minimum: 0, maximum: 100 },
        },
      },
      StatusOccurrenceResponse: {
        type: 'object',
        required: ['success', 'data', 'meta'],
        properties: {
          success: { type: 'boolean', enum: [true] },
          data: {
            type: 'object',
            required: ['occurrence'],
            properties: { occurrence: { $ref: '#/components/schemas/StatusOccurrence' } },
          },
          meta: successMetaSchema,
        },
      },
      Evaluation: {
        type: 'object',
        required: [
          'id',
          'occurrenceId',
          'rating',
          'problemResolved',
          'serviceQuality',
          'comment',
          'isMine',
          'createdAt',
          'updatedAt',
        ],
        properties: {
          id: { type: 'string', format: 'uuid' },
          occurrenceId: { type: 'string', format: 'uuid' },
          rating: { type: 'integer', minimum: 1, maximum: 5 },
          problemResolved: { type: 'boolean' },
          serviceQuality: { type: 'integer', minimum: 1, maximum: 5, nullable: true },
          comment: { type: 'string', minLength: 1, maxLength: 1000, nullable: true },
          isMine: { type: 'boolean' },
          createdAt: { type: 'string', format: 'date-time' },
          updatedAt: { type: 'string', format: 'date-time' },
        },
      },
      MyEvaluationResponse: {
        type: 'object',
        required: ['success', 'data', 'meta'],
        properties: {
          success: { type: 'boolean', enum: [true] },
          meta: successMetaSchema,
          data: {
            type: 'object',
            required: ['evaluation', 'canCreate', 'canEdit', 'editDeadline', 'readOnlyReason'],
            properties: {
              evaluation: { allOf: [{ $ref: '#/components/schemas/Evaluation' }], nullable: true },
              canCreate: { type: 'boolean' },
              canEdit: { type: 'boolean' },
              editDeadline: { type: 'string', format: 'date-time', nullable: true },
              readOnlyReason: {
                type: 'string',
                nullable: true,
                enum: ['STATUS_NOT_EDITABLE', 'EDIT_WINDOW_EXPIRED', null],
              },
            },
          },
        },
      },
      EvaluationSummary: {
        type: 'object',
        required: [
          'occurrenceId',
          'occurrenceStatus',
          'total',
          'negativeCount',
          'negativePercentage',
          'averageRating',
          'averageServiceQuality',
          'minimumEvaluationsForContestation',
          'negativeThresholdPercentage',
          'eligibleForContestation',
        ],
        properties: {
          occurrenceId: { type: 'string', format: 'uuid' },
          occurrenceStatus: occurrenceStatusSchema,
          total: { type: 'integer', minimum: 0 },
          negativeCount: { type: 'integer', minimum: 0 },
          negativePercentage: { type: 'number', minimum: 0, maximum: 100, example: 66.67 },
          averageRating: { type: 'number', minimum: 1, maximum: 5, nullable: true },
          averageServiceQuality: {
            type: 'number',
            minimum: 1,
            maximum: 5,
            nullable: true,
          },
          minimumEvaluationsForContestation: { type: 'integer', minimum: 1, example: 3 },
          negativeThresholdPercentage: {
            type: 'number',
            minimum: 1,
            maximum: 100,
            example: 50,
          },
          eligibleForContestation: { type: 'boolean' },
        },
      },
      EvaluationMutationResponse: {
        type: 'object',
        required: ['success', 'data', 'meta'],
        properties: {
          success: { type: 'boolean', enum: [true] },
          data: {
            type: 'object',
            required: ['evaluation', 'summary', 'occurrenceContested'],
            properties: {
              evaluation: { $ref: '#/components/schemas/Evaluation' },
              summary: { $ref: '#/components/schemas/EvaluationSummary' },
              occurrenceContested: { type: 'boolean' },
            },
          },
          meta: successMetaSchema,
        },
      },
      EvaluationListResponse: {
        type: 'object',
        required: ['success', 'data', 'meta'],
        properties: {
          success: { type: 'boolean', enum: [true] },
          data: {
            type: 'object',
            required: ['evaluations', 'pagination'],
            properties: {
              evaluations: {
                type: 'array',
                items: { $ref: '#/components/schemas/Evaluation' },
              },
              pagination: {
                type: 'object',
                required: ['page', 'limit', 'total', 'totalPages'],
                properties: {
                  page: { type: 'integer', minimum: 1 },
                  limit: { type: 'integer', minimum: 1, maximum: 100 },
                  total: { type: 'integer', minimum: 0 },
                  totalPages: { type: 'integer', minimum: 0 },
                },
              },
            },
          },
          meta: successMetaSchema,
        },
      },
      EvaluationSummaryResponse: {
        type: 'object',
        required: ['success', 'data', 'meta'],
        properties: {
          success: { type: 'boolean', enum: [true] },
          data: {
            type: 'object',
            required: ['summary'],
            properties: { summary: { $ref: '#/components/schemas/EvaluationSummary' } },
          },
          meta: successMetaSchema,
        },
      },
      AiProcessingResult: {
        type: 'object',
        required: [
          'analysisId',
          'state',
          'attempts',
          'appliedClassification',
          'requiresHumanReview',
          'confidence',
          'possibleDuplicateCount',
        ],
        properties: {
          analysisId: { type: 'string', format: 'uuid', nullable: true },
          state: {
            type: 'string',
            enum: [
              'VALIDATED',
              'NOT_CONFIGURED',
              'TIMEOUT',
              'UNAVAILABLE',
              'HTTP_ERROR',
              'INVALID_RESPONSE',
              'DOMAIN_INCONSISTENCY',
            ],
          },
          attempts: { type: 'integer', minimum: 0, maximum: 3 },
          appliedClassification: { type: 'boolean' },
          requiresHumanReview: { type: 'boolean' },
          confidence: { type: 'number', minimum: 0, maximum: 1 },
          possibleDuplicateCount: { type: 'integer', minimum: 0 },
        },
      },
      AiProcessingResponse: {
        type: 'object',
        required: ['success', 'data', 'meta'],
        properties: {
          success: { type: 'boolean', enum: [true] },
          data: {
            type: 'object',
            required: ['analysis'],
            properties: { analysis: { $ref: '#/components/schemas/AiProcessingResult' } },
          },
          meta: successMetaSchema,
        },
      },
      AiPriorityResponse: {
        type: 'object',
        required: ['success', 'data', 'meta'],
        properties: {
          success: { type: 'boolean', enum: [true] },
          data: {
            type: 'object',
            required: ['priorityScore'],
            properties: { priorityScore: { type: 'number', minimum: 0, maximum: 100 } },
          },
          meta: successMetaSchema,
        },
      },
      DashboardFilters: {
        type: 'object',
        additionalProperties: false,
        required: [
          'municipalityId',
          'categoryId',
          'neighborhoodId',
          'status',
          'startDate',
          'endDate',
        ],
        properties: {
          municipalityId: { type: 'string', format: 'uuid', nullable: true },
          categoryId: { type: 'string', format: 'uuid', nullable: true },
          neighborhoodId: { type: 'string', format: 'uuid', nullable: true },
          status: { ...occurrenceStatusSchema, nullable: true },
          startDate: { type: 'string', format: 'date-time', nullable: true },
          endDate: { type: 'string', format: 'date-time', nullable: true },
        },
      },
      DashboardSummary: {
        type: 'object',
        required: [
          'totalOccurrences',
          'activeOccurrences',
          'resolvedOccurrences',
          'closedOccurrences',
          'contestedOccurrences',
          'rejectedOccurrences',
          'duplicateOccurrences',
          'totalConfirmations',
          'averagePriorityScore',
          'resolutionRate',
        ],
        properties: {
          totalOccurrences: { type: 'integer', minimum: 0 },
          activeOccurrences: { type: 'integer', minimum: 0 },
          resolvedOccurrences: { type: 'integer', minimum: 0 },
          closedOccurrences: { type: 'integer', minimum: 0 },
          contestedOccurrences: { type: 'integer', minimum: 0 },
          rejectedOccurrences: { type: 'integer', minimum: 0 },
          duplicateOccurrences: { type: 'integer', minimum: 0 },
          totalConfirmations: { type: 'integer', minimum: 0 },
          averagePriorityScore: { type: 'number', minimum: 0, maximum: 100 },
          resolutionRate: { type: 'number', minimum: 0, maximum: 100 },
        },
      },
      DashboardGroup: {
        type: 'object',
        required: ['key', 'name', 'count', 'percentage'],
        properties: {
          key: { type: 'string', nullable: true },
          code: { type: 'string', nullable: true },
          name: { type: 'string' },
          count: { type: 'integer', minimum: 0 },
          percentage: { type: 'number', minimum: 0, maximum: 100 },
        },
      },
      DashboardPriorityItem: {
        type: 'object',
        required: [
          'occurrenceId',
          'protocol',
          'title',
          'municipalityId',
          'municipalityName',
          'status',
          'priorityScore',
          'confirmationCount',
          'createdAt',
        ],
        properties: {
          occurrenceId: { type: 'string', format: 'uuid' },
          protocol: { type: 'string' },
          title: { type: 'string' },
          municipalityId: { type: 'string', format: 'uuid' },
          municipalityName: { type: 'string' },
          categoryCode: { type: 'string', nullable: true },
          categoryName: { type: 'string', nullable: true },
          neighborhoodName: { type: 'string', nullable: true },
          status: occurrenceStatusSchema,
          severity: { type: 'integer', minimum: 1, maximum: 5, nullable: true },
          riskLevel: {
            type: 'string',
            enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'],
            nullable: true,
          },
          priorityScore: { type: 'number', minimum: 0, maximum: 100 },
          confirmationCount: { type: 'integer', minimum: 0 },
          createdAt: { type: 'string', format: 'date-time' },
        },
      },
      DashboardResolutionTime: {
        type: 'object',
        required: [
          'resolvedOccurrences',
          'averageHours',
          'medianHours',
          'percentile90Hours',
          'minimumHours',
          'maximumHours',
        ],
        properties: {
          resolvedOccurrences: { type: 'integer', minimum: 0 },
          averageHours: { type: 'number', nullable: true },
          medianHours: { type: 'number', nullable: true },
          percentile90Hours: { type: 'number', nullable: true },
          minimumHours: { type: 'number', nullable: true },
          maximumHours: { type: 'number', nullable: true },
        },
      },
      DashboardHeatmapCell: {
        type: 'object',
        required: ['latitude', 'longitude', 'occurrenceCount', 'averagePriorityScore'],
        properties: {
          latitude: { type: 'number', minimum: -90, maximum: 90 },
          longitude: { type: 'number', minimum: -180, maximum: 180 },
          occurrenceCount: { type: 'integer', minimum: 1 },
          averagePriorityScore: { type: 'number', minimum: 0, maximum: 100 },
        },
      },
      Notification: {
        type: 'object',
        required: ['id', 'userId', 'type', 'title', 'message', 'readAt', 'createdAt'],
        properties: {
          id: { type: 'string', format: 'uuid' },
          userId: { type: 'string', format: 'uuid' },
          type: {
            type: 'string',
            enum: [
              'OCCURRENCE_CREATED',
              'STATUS_CHANGED',
              'OCCURRENCE_CONFIRMED',
              'OCCURRENCE_DUPLICATE',
              'REPAIR_EVALUATION_REQUESTED',
              'SYSTEM',
            ],
          },
          title: { type: 'string' },
          message: { type: 'string' },
          entityType: { type: 'string', nullable: true },
          entityId: { type: 'string', format: 'uuid', nullable: true },
          readAt: { type: 'string', format: 'date-time', nullable: true },
          createdAt: { type: 'string', format: 'date-time' },
        },
      },
      ReportWebhookRequest: {
        type: 'object',
        additionalProperties: false,
        required: ['externalEventId', 'eventType', 'occurredAt', 'data'],
        properties: {
          externalEventId: { type: 'string', maxLength: 255, example: 'telegram-update-123' },
          eventType: { type: 'string', enum: ['REPORT_RECEIVED'] },
          occurredAt: { type: 'string', format: 'date-time' },
          data: {
            type: 'object',
            additionalProperties: false,
            required: ['municipalityId', 'title', 'latitude', 'longitude'],
            properties: {
              municipalityId: { type: 'string', format: 'uuid' },
              title: { type: 'string', minLength: 3, maxLength: 180 },
              description: { type: 'string', minLength: 3, maxLength: 5000 },
              latitude: { type: 'number', minimum: -90, maximum: 90 },
              longitude: { type: 'number', minimum: -180, maximum: 180 },
              imageUrl: { type: 'string', format: 'uri', maxLength: 2048 },
            },
          },
        },
      },
      StatusWebhookRequest: {
        type: 'object',
        additionalProperties: false,
        required: ['externalEventId', 'eventType', 'occurredAt', 'data'],
        properties: {
          externalEventId: { type: 'string', maxLength: 255 },
          eventType: { type: 'string', enum: ['OCCURRENCE_STATUS_UPDATE'] },
          occurredAt: { type: 'string', format: 'date-time' },
          data: {
            type: 'object',
            additionalProperties: false,
            required: ['occurrenceId', 'status'],
            properties: {
              occurrenceId: { type: 'string', format: 'uuid' },
              status: occurrenceStatusSchema,
              reason: { type: 'string', minLength: 3, maxLength: 1000 },
              publicMessage: { type: 'string', minLength: 3, maxLength: 1000 },
            },
          },
        },
      },
      N8nCallbackWebhookRequest: {
        type: 'object',
        additionalProperties: false,
        required: ['externalEventId', 'eventType', 'occurredAt', 'data'],
        properties: {
          externalEventId: { type: 'string', maxLength: 255 },
          eventType: { type: 'string', enum: ['OUTBOX_DELIVERY_CALLBACK'] },
          occurredAt: { type: 'string', format: 'date-time' },
          data: {
            type: 'object',
            additionalProperties: false,
            required: ['outboxEventId', 'deliveryStatus'],
            properties: {
              outboxEventId: { type: 'string', format: 'uuid' },
              deliveryStatus: { type: 'string', enum: ['PROCESSED', 'FAILED'] },
              errorMessage: { type: 'string', maxLength: 500 },
            },
          },
        },
      },
      WebhookResponse: {
        type: 'object',
        required: ['success', 'data', 'meta'],
        properties: {
          success: { type: 'boolean', enum: [true] },
          data: {
            type: 'object',
            required: ['accepted', 'duplicate', 'webhookEventId', 'status', 'outboxEventId'],
            properties: {
              accepted: { type: 'boolean', enum: [true] },
              duplicate: { type: 'boolean' },
              webhookEventId: { type: 'string', format: 'uuid' },
              status: {
                type: 'string',
                enum: ['RECEIVED', 'PROCESSING', 'PROCESSED', 'FAILED', 'IGNORED'],
              },
              outboxEventId: { type: 'string', format: 'uuid', nullable: true },
            },
          },
          meta: successMetaSchema,
        },
      },
    },
  },
  paths: {
    '/health': {
      get: {
        tags: ['Health'],
        summary: 'Verifica a disponibilidade da API',
        description: 'Nao exige autenticacao e nao consulta dependencias externas.',
        operationId: 'getApiHealth',
        responses: {
          '200': {
            description: 'API disponivel.',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ApiHealthResponse' },
                example: {
                  success: true,
                  data: {
                    status: 'ok',
                    timestamp: '2026-07-18T19:30:00.000Z',
                  },
                  meta: {
                    requestId: 'de305d54-75b4-431b-adb2-eb6b9e546014',
                  },
                },
              },
            },
          },
        },
      },
    },
    '/api/v1/internal/ai/classify': {
      post: {
        tags: ['Internal AI'],
        summary: 'Executa classificacao interna de uma ocorrencia',
        description:
          'Protegida por segredo. A ocorrencia ja registrada e preservada em falhas, e a IA nunca altera status.',
        operationId: 'classifyOccurrenceWithAi',
        security: internalAiSecurity,
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                additionalProperties: false,
                required: ['occurrenceId'],
                properties: { occurrenceId: { type: 'string', format: 'uuid' } },
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Analise ou fallback persistido.',
            content: {
              'application/json': { schema: { $ref: '#/components/schemas/AiProcessingResponse' } },
            },
          },
          '401': errorResponse('Segredo interno ausente ou invalido.'),
          '404': errorResponse('Ocorrencia nao encontrada.'),
          '422': errorResponse('Identificador invalido.'),
          '503': errorResponse('Integracao interna nao configurada.'),
        },
      },
    },
    '/api/v1/internal/ai/find-duplicates': {
      post: {
        tags: ['Internal AI'],
        summary: 'Solicita sugestoes internas de duplicidade',
        description:
          'Registra somente sugestoes REQUIRES_REVIEW; nao altera status nem duplicate_of_occurrence_id.',
        operationId: 'findOccurrenceDuplicatesWithAi',
        security: internalAiSecurity,
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                additionalProperties: false,
                required: ['occurrenceId'],
                properties: { occurrenceId: { type: 'string', format: 'uuid' } },
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Sugestoes ou fallback persistido.',
            content: {
              'application/json': { schema: { $ref: '#/components/schemas/AiProcessingResponse' } },
            },
          },
          '401': errorResponse('Segredo interno ausente ou invalido.'),
          '404': errorResponse('Ocorrencia nao encontrada.'),
          '422': errorResponse('Identificador invalido.'),
          '503': errorResponse('Integracao interna nao configurada.'),
        },
      },
    },
    '/api/v1/internal/ai/recalculate-priority': {
      post: {
        tags: ['Internal AI'],
        summary: 'Recalcula a prioridade pela formula oficial',
        operationId: 'recalculateOccurrencePriorityInternal',
        security: internalAiSecurity,
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                additionalProperties: false,
                required: ['occurrenceId'],
                properties: { occurrenceId: { type: 'string', format: 'uuid' } },
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Prioridade reconciliada.',
            content: {
              'application/json': { schema: { $ref: '#/components/schemas/AiPriorityResponse' } },
            },
          },
          '401': errorResponse('Segredo interno ausente ou invalido.'),
          '404': errorResponse('Ocorrencia nao encontrada.'),
          '422': errorResponse('Identificador invalido.'),
          '503': errorResponse('Integracao interna nao configurada.'),
        },
      },
    },
    '/health/database': {
      get: {
        tags: ['Health'],
        summary: 'Verifica PostgreSQL e PostGIS',
        description:
          'Executa uma consulta simples que confirma a conexao e a disponibilidade da extensao PostGIS.',
        operationId: 'getDatabaseHealth',
        responses: {
          '200': {
            description: 'PostgreSQL conectado e PostGIS habilitado.',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/DatabaseHealthResponse' },
              },
            },
          },
          '503': {
            description: 'Banco indisponivel ou PostGIS nao habilitado.',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
                example: {
                  success: false,
                  error: {
                    code: 'DATABASE_UNAVAILABLE',
                    message: 'O banco de dados esta temporariamente indisponivel.',
                    details: {},
                  },
                  meta: {
                    requestId: 'de305d54-75b4-431b-adb2-eb6b9e546014',
                  },
                },
              },
            },
          },
        },
      },
    },
    '/api/v1/auth/register': {
      post: {
        tags: ['Auth'],
        summary: 'Cadastra um cidadao',
        description: 'O perfil e sempre CITIZEN; campos extras, incluindo role, sao rejeitados.',
        operationId: 'registerCitizen',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['name', 'email', 'password', 'municipalityId'],
                additionalProperties: false,
                properties: {
                  name: { type: 'string', minLength: 2, maxLength: 150 },
                  email: { type: 'string', format: 'email' },
                  phone: { type: 'string', example: '+5571999990001' },
                  password: { type: 'string', format: 'password', minLength: 12, maxLength: 128 },
                  municipalityId: { type: 'string', format: 'uuid' },
                  neighborhood: { type: 'string', maxLength: 150 },
                },
              },
              example: {
                name: 'Nova Cidada',
                email: 'nova.cidada@example.test',
                phone: '(71) 99999-0001',
                password: 'SenhaForte123!',
                municipalityId: '10000000-0000-4000-8000-000000000001',
                neighborhood: 'Pituba',
              },
            },
          },
        },
        responses: {
          '201': {
            description: 'Cidadao cadastrado.',
            content: {
              'application/json': { schema: { $ref: '#/components/schemas/UserResponse' } },
            },
          },
          '409': errorResponse('E-mail ou telefone ja cadastrado.'),
          '422': errorResponse('Dados ou municipio invalidos.'),
        },
      },
    },
    '/api/v1/auth/login': {
      post: {
        tags: ['Auth'],
        summary: 'Inicia uma sessao',
        description: 'Retorna o JWT no corpo e o refresh opaco somente em cookie httpOnly.',
        operationId: 'login',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['email', 'password'],
                additionalProperties: false,
                properties: {
                  email: { type: 'string', format: 'email' },
                  password: { type: 'string', format: 'password' },
                },
              },
              example: { email: 'ana.cidada@example.test', password: 'Cidada123!Fase2' },
            },
          },
        },
        responses: {
          '200': {
            description: 'Sessao criada e cookie de refresh definido.',
            headers: {
              'Set-Cookie': {
                schema: { type: 'string' },
                description: 'ta_na_rua_refresh; HttpOnly; SameSite=Lax.',
              },
            },
            content: {
              'application/json': { schema: { $ref: '#/components/schemas/AuthSessionResponse' } },
            },
          },
          '401': errorResponse('Credenciais invalidas.'),
          '403': errorResponse('Usuario bloqueado ou pendente.'),
          '422': errorResponse('Corpo invalido.'),
        },
      },
    },
    '/api/v1/auth/refresh': {
      post: {
        tags: ['Auth'],
        summary: 'Rotaciona o refresh token',
        description: 'Le o cookie httpOnly, revoga o token anterior e cria outro na mesma sessao.',
        operationId: 'refreshSession',
        parameters: [
          {
            in: 'cookie',
            name: 'ta_na_rua_refresh',
            required: true,
            schema: { type: 'string' },
            description: 'Refresh token opaco. Nao use o campo JWT do Authorize.',
          },
        ],
        responses: {
          '200': {
            description: 'Tokens rotacionados.',
            content: {
              'application/json': { schema: { $ref: '#/components/schemas/AuthSessionResponse' } },
            },
          },
          '401': errorResponse('Refresh ausente, invalido, expirado, revogado ou reutilizado.'),
        },
      },
    },
    '/api/v1/auth/logout': {
      post: {
        tags: ['Auth'],
        summary: 'Encerra a sessao atual',
        operationId: 'logout',
        parameters: [
          { in: 'cookie', name: 'ta_na_rua_refresh', schema: { type: 'string' }, required: false },
        ],
        responses: { '204': { description: 'Sessao revogada e cookie removido.' } },
      },
    },
    '/api/v1/auth/me': {
      get: {
        tags: ['Auth'],
        summary: 'Retorna o usuario da sessao',
        operationId: 'getAuthenticatedUser',
        security: bearerSecurity,
        responses: {
          '200': {
            description: 'Usuario autenticado.',
            content: {
              'application/json': { schema: { $ref: '#/components/schemas/UserResponse' } },
            },
          },
          '401': errorResponse('Token ausente, invalido, expirado ou sessao revogada.'),
          '403': errorResponse('Usuario bloqueado ou inativo.'),
        },
      },
    },
    '/api/v1/auth/change-password': {
      post: {
        tags: ['Auth'],
        summary: 'Altera a senha e revoga todas as sessoes',
        operationId: 'changePassword',
        security: bearerSecurity,
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['currentPassword', 'newPassword'],
                additionalProperties: false,
                properties: {
                  currentPassword: { type: 'string', format: 'password' },
                  newPassword: { type: 'string', format: 'password', minLength: 12 },
                },
              },
            },
          },
        },
        responses: {
          '204': { description: 'Senha alterada; novo login obrigatorio.' },
          '401': errorResponse('Token ou senha atual invalidos.'),
          '422': errorResponse('Nova senha invalida.'),
        },
      },
    },
    '/api/v1/users/me': {
      get: {
        tags: ['Users'],
        summary: 'Consulta o proprio perfil',
        operationId: 'getMyProfile',
        security: bearerSecurity,
        responses: {
          '200': {
            description: 'Perfil atual.',
            content: {
              'application/json': { schema: { $ref: '#/components/schemas/UserResponse' } },
            },
          },
          '401': errorResponse('Autenticacao obrigatoria.'),
          '403': errorResponse('Usuario bloqueado.'),
        },
      },
      patch: {
        tags: ['Users'],
        summary: 'Atualiza o proprio perfil',
        operationId: 'updateMyProfile',
        security: bearerSecurity,
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                additionalProperties: false,
                properties: {
                  name: { type: 'string' },
                  phone: { type: 'string', nullable: true },
                  municipalityId: { type: 'string', format: 'uuid', nullable: true },
                  neighborhood: { type: 'string', nullable: true },
                  avatarUrl: { type: 'string', format: 'uri', nullable: true },
                },
              },
              example: { name: 'Ana Atualizada', neighborhood: 'Itapua' },
            },
          },
        },
        responses: {
          '200': {
            description: 'Perfil atualizado.',
            content: {
              'application/json': { schema: { $ref: '#/components/schemas/UserResponse' } },
            },
          },
          '401': errorResponse('Autenticacao obrigatoria.'),
          '409': errorResponse('Telefone duplicado.'),
          '422': errorResponse('Dados invalidos.'),
        },
      },
      delete: {
        tags: ['Users'],
        summary: 'Exclui logicamente a propria conta',
        operationId: 'deleteMyProfile',
        security: bearerSecurity,
        responses: {
          '204': { description: 'Conta excluida e sessoes revogadas.' },
          '401': errorResponse('Autenticacao obrigatoria.'),
        },
      },
    },
    '/api/v1/admin/users': {
      get: {
        tags: ['Admin Users'],
        summary: 'Lista usuarios',
        description: 'Exclusiva de ADMIN.',
        operationId: 'listUsers',
        security: bearerSecurity,
        parameters: [
          { in: 'query', name: 'page', schema: { type: 'integer', minimum: 1, default: 1 } },
          {
            in: 'query',
            name: 'pageSize',
            schema: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
          },
          { in: 'query', name: 'municipalityId', schema: { type: 'string', format: 'uuid' } },
          {
            in: 'query',
            name: 'role',
            schema: { type: 'string', enum: ['CITIZEN', 'CITY_OPERATOR', 'MODERATOR', 'ADMIN'] },
          },
          {
            in: 'query',
            name: 'status',
            schema: { type: 'string', enum: ['ACTIVE', 'PENDING', 'BLOCKED', 'DELETED'] },
          },
        ],
        responses: {
          '200': { description: 'Lista paginada de usuarios.' },
          '401': errorResponse('Autenticacao obrigatoria.'),
          '403': errorResponse('Perfil sem permissao.'),
        },
      },
    },
    '/api/v1/admin/users/{userId}': {
      get: {
        tags: ['Admin Users'],
        summary: 'Consulta um usuario',
        operationId: 'getUserById',
        security: bearerSecurity,
        parameters: [
          {
            in: 'path',
            name: 'userId',
            required: true,
            schema: { type: 'string', format: 'uuid' },
          },
        ],
        responses: {
          '200': {
            description: 'Usuario encontrado.',
            content: {
              'application/json': { schema: { $ref: '#/components/schemas/UserResponse' } },
            },
          },
          '401': errorResponse('Autenticacao obrigatoria.'),
          '403': errorResponse('Perfil sem permissao.'),
          '404': errorResponse('Usuario nao encontrado.'),
        },
      },
    },
    '/api/v1/admin/users/{userId}/status': {
      patch: {
        tags: ['Admin Users'],
        summary: 'Altera o status de um usuario',
        description: 'Bloqueios revogam sessoes ativas.',
        operationId: 'updateUserStatus',
        security: bearerSecurity,
        parameters: [
          {
            in: 'path',
            name: 'userId',
            required: true,
            schema: { type: 'string', format: 'uuid' },
          },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['status'],
                additionalProperties: false,
                properties: {
                  status: { type: 'string', enum: ['ACTIVE', 'PENDING', 'BLOCKED'] },
                },
              },
              example: { status: 'BLOCKED' },
            },
          },
        },
        responses: {
          '200': {
            description: 'Status atualizado.',
            content: {
              'application/json': { schema: { $ref: '#/components/schemas/UserResponse' } },
            },
          },
          '401': errorResponse('Autenticacao obrigatoria.'),
          '403': errorResponse('Perfil sem permissao.'),
          '404': errorResponse('Usuario nao encontrado.'),
          '422': errorResponse('Alteracao invalida.'),
        },
      },
    },
    '/api/v1/admin/users/{userId}/role': {
      patch: {
        tags: ['Admin Users'],
        summary: 'Altera o perfil de um usuario',
        description: 'A alteracao revoga todas as sessoes do usuario.',
        operationId: 'updateUserRole',
        security: bearerSecurity,
        parameters: [
          {
            in: 'path',
            name: 'userId',
            required: true,
            schema: { type: 'string', format: 'uuid' },
          },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['role'],
                additionalProperties: false,
                properties: {
                  role: {
                    type: 'string',
                    enum: ['CITIZEN', 'CITY_OPERATOR', 'MODERATOR', 'ADMIN'],
                  },
                },
              },
              example: { role: 'CITY_OPERATOR' },
            },
          },
        },
        responses: {
          '200': {
            description: 'Perfil atualizado.',
            content: {
              'application/json': { schema: { $ref: '#/components/schemas/UserResponse' } },
            },
          },
          '401': errorResponse('Autenticacao obrigatoria.'),
          '403': errorResponse('Perfil sem permissao.'),
          '404': errorResponse('Usuario nao encontrado.'),
          '422': errorResponse('Alteracao invalida.'),
        },
      },
    },
    '/api/v1/occurrences': {
      get: {
        tags: ['Occurrences'],
        summary: 'Lista ocorrencias com filtros e paginacao',
        description:
          'Publicamente omite ocorrencias pendentes/rejeitadas, autor, endereco sensivel e precisao de localizacao.',
        operationId: 'listOccurrences',
        parameters: occurrenceListParameters,
        responses: {
          '200': {
            description: 'Lista paginada. page, limit, total e totalPages sao retornados em meta.',
          },
          '403': errorResponse('Isolamento municipal negou o filtro solicitado.'),
          '422': errorResponse('Filtros invalidos.'),
        },
      },
      post: {
        tags: ['Occurrences'],
        summary: 'Cria uma ocorrencia com imagem inicial obrigatoria',
        description:
          'Gera protocolo anual atomico e grava ocorrencia PENDING_REVIEW, relato, imagem, historico, auditoria e notificacao antes da IA. Depois chama o cliente externo; timeout, indisponibilidade ou resposta invalida geram fallback sem desfazer a ocorrencia.',
        operationId: 'createOccurrence',
        security: bearerSecurity,
        requestBody: {
          required: true,
          content: {
            'multipart/form-data': {
              schema: {
                type: 'object',
                required: ['title', 'municipalityId', 'latitude', 'longitude', 'image'],
                properties: {
                  title: { type: 'string', minLength: 3, maxLength: 150 },
                  description: { type: 'string', maxLength: 2000 },
                  categoryId: { type: 'string', format: 'uuid' },
                  municipalityId: { type: 'string', format: 'uuid' },
                  neighborhoodId: { type: 'string', format: 'uuid' },
                  neighborhoodText: { type: 'string', maxLength: 150 },
                  address: { type: 'string', maxLength: 500 },
                  latitude: { type: 'number', minimum: -90, maximum: 90 },
                  longitude: { type: 'number', minimum: -180, maximum: 180 },
                  locationAccuracy: { type: 'number', minimum: 0 },
                  anonymousPublication: { type: 'boolean', default: false },
                  image: {
                    type: 'string',
                    format: 'binary',
                    description:
                      'JPEG, PNG ou WebP; assinatura real validada; maximo padrao de 8 MB.',
                  },
                },
              },
              encoding: { image: { contentType: 'image/jpeg, image/png, image/webp' } },
            },
          },
        },
        responses: {
          '201': {
            description: 'Ocorrencia criada.',
            content: {
              'application/json': { schema: { $ref: '#/components/schemas/OccurrenceResponse' } },
            },
          },
          '401': errorResponse('Autenticacao obrigatoria.'),
          '413': errorResponse('Imagem acima do limite configurado.'),
          '415': errorResponse('MIME real invalido ou divergente.'),
          '422': errorResponse('Dados, imagem, municipio ou coordenadas invalidos.'),
        },
      },
    },
    '/api/v1/occurrences/nearby': {
      get: {
        tags: ['Occurrences'],
        summary: 'Busca ocorrencias por proximidade com PostGIS',
        operationId: 'getNearbyOccurrences',
        parameters: [
          {
            in: 'query',
            name: 'latitude',
            required: true,
            schema: { type: 'number', minimum: -90, maximum: 90 },
          },
          {
            in: 'query',
            name: 'longitude',
            required: true,
            schema: { type: 'number', minimum: -180, maximum: 180 },
          },
          {
            in: 'query',
            name: 'radius',
            schema: { type: 'integer', minimum: 1, maximum: 50000, default: 30 },
          },
          { in: 'query', name: 'municipalityId', schema: { type: 'string', format: 'uuid' } },
          { in: 'query', name: 'page', schema: { type: 'integer', minimum: 1, default: 1 } },
          {
            in: 'query',
            name: 'limit',
            schema: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
          },
        ],
        responses: {
          '200': { description: 'Ocorrencias ordenadas por distancia em metros.' },
          '403': errorResponse('Isolamento municipal negado.'),
          '422': errorResponse('Coordenadas ou raio invalidos.'),
        },
      },
    },
    '/api/v1/occurrences/map': {
      get: {
        tags: ['Occurrences'],
        summary: 'Retorna pontos resumidos para o mapa',
        operationId: 'getOccurrenceMap',
        parameters: [
          { in: 'query', name: 'municipalityId', schema: { type: 'string', format: 'uuid' } },
          { in: 'query', name: 'category', schema: { type: 'string' } },
          { in: 'query', name: 'status', schema: { type: 'string' } },
          {
            in: 'query',
            name: 'risk',
            schema: { type: 'string', enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] },
          },
          {
            in: 'query',
            name: 'limit',
            schema: { type: 'integer', minimum: 1, maximum: 1000, default: 500 },
          },
        ],
        responses: {
          '200': { description: 'Pontos publicos com coordenadas arredondadas.' },
          '403': errorResponse('Isolamento municipal negado.'),
          '422': errorResponse('Filtros invalidos.'),
        },
      },
    },
    '/api/v1/occurrences/mine': {
      get: {
        tags: ['Occurrences'],
        summary: 'Lista as ocorrencias do usuario autenticado',
        operationId: 'listMyOccurrences',
        security: bearerSecurity,
        parameters: occurrenceListParameters,
        responses: {
          '200': { description: 'Lista propria, incluindo ocorrencias pendentes.' },
          '401': errorResponse('Autenticacao obrigatoria.'),
          '422': errorResponse('Filtros invalidos.'),
        },
      },
    },
    '/api/v1/occurrences/{occurrenceId}': {
      get: {
        tags: ['Occurrences'],
        summary: 'Consulta os detalhes de uma ocorrencia',
        operationId: 'getOccurrence',
        parameters: [occurrenceIdParameter],
        responses: {
          '200': {
            description: 'Detalhe publico sanitizado ou integral para perfil autorizado.',
            content: {
              'application/json': { schema: { $ref: '#/components/schemas/OccurrenceResponse' } },
            },
          },
          '404': errorResponse('Ocorrencia inexistente ou nao visivel.'),
          '422': errorResponse('Identificador invalido.'),
        },
      },
      patch: {
        tags: ['Occurrences'],
        summary: 'Edita dados descritivos da ocorrencia',
        description:
          'O autor edita somente enquanto PENDING_REVIEW; MODERATOR e ADMIN podem editar sem alterar o status.',
        operationId: 'updateOccurrence',
        security: bearerSecurity,
        parameters: [occurrenceIdParameter],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                minProperties: 1,
                additionalProperties: false,
                properties: {
                  title: { type: 'string', minLength: 3, maxLength: 150 },
                  description: { type: 'string', maxLength: 2000, nullable: true },
                  neighborhoodText: { type: 'string', maxLength: 150, nullable: true },
                  address: { type: 'string', maxLength: 500, nullable: true },
                  anonymousPublication: { type: 'boolean' },
                },
              },
            },
          },
        },
        responses: {
          '200': { description: 'Ocorrencia atualizada.' },
          '401': errorResponse('Autenticacao obrigatoria.'),
          '403': errorResponse('Autor ou perfil sem permissao.'),
          '404': errorResponse('Ocorrencia nao encontrada.'),
          '409': errorResponse('Estado atual nao permite edicao pelo autor.'),
          '422': errorResponse('Corpo invalido.'),
        },
      },
      delete: {
        tags: ['Occurrences'],
        summary: 'Exclui logicamente uma ocorrencia',
        operationId: 'deleteOccurrence',
        security: bearerSecurity,
        parameters: [occurrenceIdParameter],
        responses: {
          '204': { description: 'Exclusao logica concluida.' },
          '401': errorResponse('Autenticacao obrigatoria.'),
          '403': errorResponse('Somente MODERATOR ou ADMIN.'),
          '404': errorResponse('Ocorrencia nao encontrada.'),
        },
      },
    },
    '/api/v1/occurrences/{occurrenceId}/images': {
      post: {
        tags: ['Occurrences'],
        summary: 'Adiciona uma imagem a uma ocorrencia',
        operationId: 'addOccurrenceImage',
        security: bearerSecurity,
        parameters: [occurrenceIdParameter],
        requestBody: {
          required: true,
          content: {
            'multipart/form-data': {
              schema: {
                type: 'object',
                required: ['image'],
                properties: { image: { type: 'string', format: 'binary' } },
              },
              encoding: { image: { contentType: 'image/jpeg, image/png, image/webp' } },
            },
          },
        },
        responses: {
          '201': { description: 'Imagem armazenada com moderacao PENDING.' },
          '401': errorResponse('Autenticacao obrigatoria.'),
          '403': errorResponse('Sem permissao sobre a ocorrencia.'),
          '404': errorResponse('Ocorrencia nao encontrada.'),
          '409': errorResponse('Limite de imagens atingido.'),
          '413': errorResponse('Imagem acima do limite.'),
          '415': errorResponse('MIME real invalido ou divergente.'),
          '422': errorResponse('Imagem ausente.'),
        },
      },
    },
    '/api/v1/occurrences/{occurrenceId}/confirmations': {
      post: {
        tags: ['Confirmations'],
        summary: 'Confirma que o cidadao tambem viu a ocorrencia',
        description:
          'Exclusivo de CITIZEN. A confirmacao, o contador, a prioridade, a notificacao e a auditoria sao gravados atomicamente.',
        operationId: 'confirmOccurrence',
        security: bearerSecurity,
        parameters: [occurrenceIdParameter],
        requestBody: {
          required: false,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                additionalProperties: false,
                properties: {
                  directlyAffected: { type: 'boolean', default: false },
                  problemWorsened: { type: 'boolean', default: false },
                  comment: { type: 'string', minLength: 1, maxLength: 500, nullable: true },
                },
              },
              example: {
                directlyAffected: true,
                problemWorsened: false,
                comment: 'O problema continua no local.',
              },
            },
          },
        },
        responses: {
          '201': {
            description: 'Confirmacao criada e prioridade recalculada.',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ConfirmationMutationResponse' },
              },
            },
          },
          '401': errorResponse('Autenticacao obrigatoria.'),
          '403': errorResponse('Somente CITIZEN pode confirmar.'),
          '404': errorResponse('Ocorrencia nao encontrada.'),
          '409': errorResponse('Confirmacao duplicada ou status nao confirmavel.'),
          '422': errorResponse('Identificador ou corpo invalido.'),
        },
      },
    },
    '/api/v1/occurrences/{occurrenceId}/confirmations/me': {
      delete: {
        tags: ['Confirmations'],
        summary: 'Remove a confirmacao do cidadao autenticado',
        description: 'Remove a confirmacao e recalcula contador e prioridade na mesma transacao.',
        operationId: 'removeMyOccurrenceConfirmation',
        security: bearerSecurity,
        parameters: [occurrenceIdParameter],
        responses: {
          '204': { description: 'Confirmacao removida.' },
          '401': errorResponse('Autenticacao obrigatoria.'),
          '403': errorResponse('Somente CITIZEN pode remover a propria confirmacao.'),
          '404': errorResponse('Ocorrencia ou confirmacao nao encontrada.'),
          '422': errorResponse('Identificador invalido.'),
        },
      },
    },
    '/api/v1/occurrences/{occurrenceId}/confirmations/count': {
      get: {
        tags: ['Confirmations'],
        summary: 'Consulta a contagem e a prioridade atuais',
        description:
          'A resposta publica nao exibe pendencias ou rejeicoes. Com JWT, inclui confirmedByMe.',
        operationId: 'getOccurrenceConfirmationCount',
        security: [{}, { bearerAuth: [] }],
        parameters: [occurrenceIdParameter],
        responses: {
          '200': {
            description: 'Contagem transacional e prioridade entre 0 e 100.',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ConfirmationCountResponse' },
              },
            },
          },
          '404': errorResponse('Ocorrencia inexistente ou nao visivel.'),
          '422': errorResponse('Identificador invalido.'),
        },
      },
    },
    '/api/v1/occurrences/{occurrenceId}/evaluations': {
      post: {
        tags: ['Evaluations'],
        summary: 'Avalia o reparo de uma ocorrencia resolvida ou fechada',
        description:
          'Exclusivo de CITIZEN relacionado por criacao, report ou confirmacao. Avaliacao, auditoria, notificacao e eventual contestacao sao atomicas.',
        operationId: 'createOccurrenceEvaluation',
        security: bearerSecurity,
        parameters: [occurrenceIdParameter],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                additionalProperties: false,
                required: ['rating', 'problemResolved'],
                properties: {
                  rating: { type: 'integer', minimum: 1, maximum: 5 },
                  problemResolved: { type: 'boolean' },
                  serviceQuality: {
                    type: 'integer',
                    minimum: 1,
                    maximum: 5,
                    nullable: true,
                  },
                  comment: { type: 'string', minLength: 1, maxLength: 1000, nullable: true },
                },
              },
              example: {
                rating: 2,
                problemResolved: false,
                serviceQuality: 3,
                comment: 'O problema voltou depois do reparo.',
              },
            },
          },
        },
        responses: {
          '201': {
            description: 'Avaliacao criada e indicadores recalculados.',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/EvaluationMutationResponse' },
              },
            },
          },
          '401': errorResponse('Autenticacao obrigatoria.'),
          '403': errorResponse('Perfil sem permissao ou cidadao nao relacionado.'),
          '404': errorResponse('Ocorrencia nao encontrada.'),
          '409': errorResponse('Status nao avaliavel ou avaliacao duplicada.'),
          '422': errorResponse('Identificador, nota ou corpo invalido.'),
        },
      },
      get: {
        tags: ['Evaluations'],
        summary: 'Lista avaliacoes detalhadas da ocorrencia',
        description:
          'Exige relacao do cidadao ou perfil operacional autorizado. Nao expoe identificadores dos avaliadores.',
        operationId: 'listOccurrenceEvaluations',
        security: bearerSecurity,
        parameters: [
          occurrenceIdParameter,
          { in: 'query', name: 'page', schema: { type: 'integer', minimum: 1, default: 1 } },
          {
            in: 'query',
            name: 'limit',
            schema: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
          },
        ],
        responses: {
          '200': {
            description: 'Avaliacoes paginadas sem dados pessoais.',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/EvaluationListResponse' },
              },
            },
          },
          '401': errorResponse('Autenticacao obrigatoria.'),
          '403': errorResponse('Usuario ou municipio sem permissao.'),
          '404': errorResponse('Ocorrencia nao encontrada.'),
          '422': errorResponse('Identificador ou paginacao invalida.'),
        },
      },
    },
    '/api/v1/occurrences/{occurrenceId}/evaluations/summary': {
      get: {
        tags: ['Evaluations'],
        summary: 'Consulta indicadores agregados das avaliacoes',
        description:
          'Resumo publico sem comentarios ou dados pessoais. Usa minimo de 3 avaliacoes e limiar negativo de 50% por padrao.',
        operationId: 'getOccurrenceEvaluationSummary',
        security: [{}, { bearerAuth: [] }],
        parameters: [occurrenceIdParameter],
        responses: {
          '200': {
            description: 'Indicadores e criterio atual de contestacao.',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/EvaluationSummaryResponse' },
              },
            },
          },
          '404': errorResponse('Ocorrencia inexistente ou nao visivel.'),
          '422': errorResponse('Identificador invalido.'),
        },
      },
    },
    '/api/v1/occurrences/{occurrenceId}/evaluations/me': {
      get: {
        tags: ['Evaluations'],
        summary: 'Consulta a propria avaliacao e permissao atual de edicao',
        operationId: 'getMyOccurrenceEvaluation',
        security: bearerSecurity,
        parameters: [occurrenceIdParameter],
        responses: {
          '200': {
            description:
              'Avaliacao propria (ou null), canCreate, canEdit, editDeadline e readOnlyReason. Prazo e status sao avaliados pelo servidor.',
            content: {
              'application/json': { schema: { $ref: '#/components/schemas/MyEvaluationResponse' } },
            },
          },
          '401': errorResponse('Autenticacao obrigatoria.'),
          '403': errorResponse('Somente cidadaos.'),
          '404': errorResponse('Ocorrencia inexistente ou nao visivel.'),
          '422': errorResponse('Identificador invalido.'),
        },
      },
      patch: {
        tags: ['Evaluations'],
        summary: 'Edita a avaliacao do cidadao autenticado',
        description:
          'Permite alteracao por 7 dias. Aceita RESOLVED, CLOSED e CONTESTED; depois da reabertura operacional a edicao e bloqueada.',
        operationId: 'updateMyOccurrenceEvaluation',
        security: bearerSecurity,
        parameters: [occurrenceIdParameter],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                additionalProperties: false,
                minProperties: 1,
                properties: {
                  rating: { type: 'integer', minimum: 1, maximum: 5 },
                  problemResolved: { type: 'boolean' },
                  serviceQuality: {
                    type: 'integer',
                    minimum: 1,
                    maximum: 5,
                    nullable: true,
                  },
                  comment: { type: 'string', minLength: 1, maxLength: 1000, nullable: true },
                },
              },
              example: { rating: 4, problemResolved: true, comment: 'Reparo revisado.' },
            },
          },
        },
        responses: {
          '200': {
            description: 'Avaliacao e indicadores atualizados.',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/EvaluationMutationResponse' },
              },
            },
          },
          '401': errorResponse('Autenticacao obrigatoria.'),
          '403': errorResponse('Somente CITIZEN pode editar a propria avaliacao.'),
          '404': errorResponse('Ocorrencia ou avaliacao nao encontrada.'),
          '409': errorResponse('Prazo encerrado ou status nao editavel.'),
          '422': errorResponse('Identificador, nota ou corpo invalido.'),
        },
      },
    },
    '/api/v1/occurrences/{occurrenceId}/status': {
      patch: {
        tags: ['Status'],
        summary: 'Executa uma transicao valida da maquina de estados',
        description:
          'Bloqueia a ocorrencia e grava status, campos de atendimento, historico, auditoria e notificacoes na mesma transacao.',
        operationId: 'updateOccurrenceStatus',
        security: bearerSecurity,
        parameters: [occurrenceIdParameter],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                additionalProperties: false,
                required: ['status'],
                properties: {
                  status: occurrenceStatusSchema,
                  reason: { type: 'string', minLength: 1, maxLength: 2000, nullable: true },
                  publicMessage: {
                    type: 'string',
                    minLength: 1,
                    maxLength: 2000,
                    nullable: true,
                  },
                  departmentId: { type: 'string', format: 'uuid' },
                  expectedResolutionAt: { type: 'string', format: 'date-time' },
                  scheduledFor: { type: 'string', format: 'date-time' },
                  resolutionDescription: { type: 'string', minLength: 3, maxLength: 2000 },
                  duplicateOfOccurrenceId: { type: 'string', format: 'uuid' },
                },
              },
              example: {
                status: 'FORWARDED',
                departmentId: '40000000-0000-4000-8000-000000000001',
                expectedResolutionAt: '2026-07-25T15:00:00.000Z',
                publicMessage: 'A ocorrencia foi encaminhada para a equipe responsavel.',
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Transicao concluida atomicamente.',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/StatusOccurrenceResponse' },
              },
            },
          },
          '401': errorResponse('Autenticacao obrigatoria.'),
          '403': errorResponse('Perfil ou municipio sem permissao.'),
          '404': errorResponse('Ocorrencia nao encontrada.'),
          '409': errorResponse('Transicao inexistente na maquina de estados.'),
          '422': errorResponse('Campo obrigatorio, departamento, data ou alvo invalido.'),
        },
      },
    },
    '/api/v1/occurrences/{occurrenceId}/assignment': {
      patch: {
        tags: ['Status'],
        summary: 'Atribui ou reatribui a ocorrencia e atualiza a previsao',
        description:
          'Exige departamento ativo do mesmo municipio e registra auditoria e notificacoes atomicamente.',
        operationId: 'assignOccurrenceDepartment',
        security: bearerSecurity,
        parameters: [occurrenceIdParameter],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                additionalProperties: false,
                required: ['departmentId'],
                properties: {
                  departmentId: { type: 'string', format: 'uuid' },
                  expectedResolutionAt: { type: 'string', format: 'date-time' },
                  reason: { type: 'string', maxLength: 2000, nullable: true },
                  publicMessage: { type: 'string', maxLength: 2000, nullable: true },
                },
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Atribuicao atualizada.',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/StatusOccurrenceResponse' },
              },
            },
          },
          '401': errorResponse('Autenticacao obrigatoria.'),
          '403': errorResponse('Perfil ou municipio sem permissao.'),
          '404': errorResponse('Ocorrencia nao encontrada.'),
          '409': errorResponse('Status nao aceita atribuicao.'),
          '422': errorResponse('Departamento ou data invalida.'),
        },
      },
    },
    '/api/v1/occurrences/{occurrenceId}/status-history': {
      get: {
        tags: ['Status'],
        summary: 'Consulta o historico cronologico de status',
        description:
          'O publico recebe somente mensagens publicas; motivos e responsavel aparecem a perfis autorizados.',
        operationId: 'getOccurrenceStatusHistory',
        security: [{}, { bearerAuth: [] }],
        parameters: [occurrenceIdParameter],
        responses: {
          '200': { description: 'Historico cronologico da ocorrencia.' },
          '404': errorResponse('Ocorrencia inexistente ou nao visivel.'),
          '422': errorResponse('Identificador invalido.'),
        },
      },
    },
    '/api/v1/departments': {
      get: {
        tags: ['Departments'],
        summary: 'Lista departamentos no escopo municipal permitido',
        operationId: 'listDepartments',
        security: bearerSecurity,
        parameters: [
          { in: 'query', name: 'municipalityId', schema: { type: 'string', format: 'uuid' } },
          { in: 'query', name: 'active', schema: { type: 'boolean' } },
          { in: 'query', name: 'page', schema: { type: 'integer', minimum: 1, default: 1 } },
          {
            in: 'query',
            name: 'limit',
            schema: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
          },
        ],
        responses: {
          '200': { description: 'Departamentos e paginacao.' },
          '401': errorResponse('Autenticacao obrigatoria.'),
          '403': errorResponse('Perfil ou municipio sem permissao.'),
          '422': errorResponse('Filtro invalido.'),
        },
      },
      post: {
        tags: ['Departments'],
        summary: 'Cria um departamento municipal',
        operationId: 'createDepartment',
        security: bearerSecurity,
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                additionalProperties: false,
                required: ['municipalityId', 'name'],
                properties: {
                  municipalityId: { type: 'string', format: 'uuid' },
                  name: { type: 'string', minLength: 2, maxLength: 150 },
                  description: { type: 'string', maxLength: 2000, nullable: true },
                },
              },
            },
          },
        },
        responses: {
          '201': {
            description: 'Departamento criado.',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/DepartmentResponse' },
              },
            },
          },
          '401': errorResponse('Autenticacao obrigatoria.'),
          '403': errorResponse('Perfil ou municipio sem permissao.'),
          '409': errorResponse('Nome duplicado no municipio.'),
          '422': errorResponse('Municipio ou corpo invalido.'),
        },
      },
    },
    '/api/v1/departments/{departmentId}': {
      get: {
        tags: ['Departments'],
        summary: 'Consulta um departamento',
        operationId: 'getDepartment',
        security: bearerSecurity,
        parameters: [departmentIdParameter],
        responses: {
          '200': {
            description: 'Departamento encontrado.',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/DepartmentResponse' },
              },
            },
          },
          '401': errorResponse('Autenticacao obrigatoria.'),
          '403': errorResponse('Municipio sem permissao.'),
          '404': errorResponse('Departamento nao encontrado.'),
        },
      },
      patch: {
        tags: ['Departments'],
        summary: 'Atualiza nome ou descricao do departamento',
        operationId: 'updateDepartment',
        security: bearerSecurity,
        parameters: [departmentIdParameter],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                additionalProperties: false,
                properties: {
                  name: { type: 'string', minLength: 2, maxLength: 150 },
                  description: { type: 'string', maxLength: 2000, nullable: true },
                },
                minProperties: 1,
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Departamento atualizado.',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/DepartmentResponse' },
              },
            },
          },
          '401': errorResponse('Autenticacao obrigatoria.'),
          '403': errorResponse('Municipio sem permissao.'),
          '404': errorResponse('Departamento nao encontrado.'),
          '409': errorResponse('Nome duplicado no municipio.'),
          '422': errorResponse('Corpo invalido.'),
        },
      },
      delete: {
        tags: ['Departments'],
        summary: 'Desativa o departamento',
        operationId: 'deactivateDepartment',
        security: bearerSecurity,
        parameters: [departmentIdParameter],
        responses: {
          '204': { description: 'Departamento desativado.' },
          '401': errorResponse('Autenticacao obrigatoria.'),
          '403': errorResponse('Municipio sem permissao.'),
          '404': errorResponse('Departamento nao encontrado.'),
        },
      },
    },
    '/api/v1/departments/{departmentId}/active': {
      patch: {
        tags: ['Departments'],
        summary: 'Ativa ou desativa o departamento',
        operationId: 'setDepartmentActive',
        security: bearerSecurity,
        parameters: [departmentIdParameter],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                additionalProperties: false,
                required: ['active'],
                properties: { active: { type: 'boolean' } },
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Estado de ativacao atualizado.',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/DepartmentResponse' },
              },
            },
          },
          '401': errorResponse('Autenticacao obrigatoria.'),
          '403': errorResponse('Municipio sem permissao.'),
          '404': errorResponse('Departamento nao encontrado.'),
          '422': errorResponse('Corpo invalido.'),
        },
      },
    },
    '/api/v1/dashboard/summary': {
      get: {
        tags: ['Dashboard'],
        summary: 'Consulta o resumo do painel municipal',
        description:
          'CITY_OPERATOR fica limitado ao municipio do token. MODERATOR e ADMIN podem selecionar municipio ou consultar o consolidado.',
        operationId: 'getDashboardSummary',
        security: bearerSecurity,
        parameters: dashboardFilterParameters,
        responses: {
          '200': dashboardJsonResponse('Resumo agregado.', {
            filters: { $ref: '#/components/schemas/DashboardFilters' },
            summary: { $ref: '#/components/schemas/DashboardSummary' },
          }),
          '401': errorResponse('Autenticacao obrigatoria.'),
          '403': errorResponse('Perfil ou municipio sem permissao.'),
          '422': errorResponse('Filtro ou periodo invalido.'),
        },
      },
    },
    '/api/v1/dashboard/by-category': {
      get: {
        tags: ['Dashboard'],
        summary: 'Agrupa ocorrencias por categoria',
        operationId: 'getDashboardByCategory',
        security: bearerSecurity,
        parameters: dashboardFilterParameters,
        responses: {
          '200': dashboardJsonResponse('Categorias, contagens e percentuais.', {
            filters: { $ref: '#/components/schemas/DashboardFilters' },
            categories: {
              type: 'array',
              items: { $ref: '#/components/schemas/DashboardGroup' },
            },
          }),
          '401': errorResponse('Autenticacao obrigatoria.'),
          '403': errorResponse('Perfil ou municipio sem permissao.'),
          '422': errorResponse('Filtro ou periodo invalido.'),
        },
      },
    },
    '/api/v1/dashboard/by-neighborhood': {
      get: {
        tags: ['Dashboard'],
        summary: 'Agrupa ocorrencias por bairro',
        operationId: 'getDashboardByNeighborhood',
        security: bearerSecurity,
        parameters: dashboardFilterParameters,
        responses: {
          '200': dashboardJsonResponse('Bairros, contagens e percentuais.', {
            filters: { $ref: '#/components/schemas/DashboardFilters' },
            neighborhoods: {
              type: 'array',
              items: { $ref: '#/components/schemas/DashboardGroup' },
            },
          }),
          '401': errorResponse('Autenticacao obrigatoria.'),
          '403': errorResponse('Perfil ou municipio sem permissao.'),
          '422': errorResponse('Filtro ou periodo invalido.'),
        },
      },
    },
    '/api/v1/dashboard/by-status': {
      get: {
        tags: ['Dashboard'],
        summary: 'Agrupa ocorrencias por status',
        operationId: 'getDashboardByStatus',
        security: bearerSecurity,
        parameters: dashboardFilterParameters,
        responses: {
          '200': dashboardJsonResponse('Status, contagens e percentuais.', {
            filters: { $ref: '#/components/schemas/DashboardFilters' },
            statuses: {
              type: 'array',
              items: { $ref: '#/components/schemas/DashboardGroup' },
            },
          }),
          '401': errorResponse('Autenticacao obrigatoria.'),
          '403': errorResponse('Perfil ou municipio sem permissao.'),
          '422': errorResponse('Filtro ou periodo invalido.'),
        },
      },
    },
    '/api/v1/dashboard/priority-ranking': {
      get: {
        tags: ['Dashboard'],
        summary: 'Lista o ranking de prioridade',
        description:
          'Retorna no maximo 100 itens e nao inclui usuario, contato, descricao, endereco ou coordenada.',
        operationId: 'getDashboardPriorityRanking',
        security: bearerSecurity,
        parameters: [
          ...dashboardFilterParameters,
          {
            in: 'query',
            name: 'limit',
            schema: { type: 'integer', minimum: 1, maximum: 100, default: 25 },
          },
        ],
        responses: {
          '200': dashboardJsonResponse('Ranking ordenado por prioridade.', {
            filters: { $ref: '#/components/schemas/DashboardFilters' },
            limit: { type: 'integer', minimum: 1, maximum: 100 },
            occurrences: {
              type: 'array',
              items: { $ref: '#/components/schemas/DashboardPriorityItem' },
            },
          }),
          '401': errorResponse('Autenticacao obrigatoria.'),
          '403': errorResponse('Perfil ou municipio sem permissao.'),
          '422': errorResponse('Filtro, periodo ou limite invalido.'),
        },
      },
    },
    '/api/v1/dashboard/resolution-time': {
      get: {
        tags: ['Dashboard'],
        summary: 'Calcula o tempo de resolucao em horas',
        operationId: 'getDashboardResolutionTime',
        security: bearerSecurity,
        parameters: dashboardFilterParameters,
        responses: {
          '200': dashboardJsonResponse('Media, mediana, percentil 90 e extremos.', {
            filters: { $ref: '#/components/schemas/DashboardFilters' },
            resolutionTime: { $ref: '#/components/schemas/DashboardResolutionTime' },
          }),
          '401': errorResponse('Autenticacao obrigatoria.'),
          '403': errorResponse('Perfil ou municipio sem permissao.'),
          '422': errorResponse('Filtro ou periodo invalido.'),
        },
      },
    },
    '/api/v1/dashboard/heatmap': {
      get: {
        tags: ['Dashboard'],
        summary: 'Retorna celulas agregadas do mapa de calor',
        description:
          'Agrupa localizacoes em celulas de 250 metros e nunca retorna a coordenada exata da ocorrencia.',
        operationId: 'getDashboardHeatmap',
        security: bearerSecurity,
        parameters: dashboardFilterParameters,
        responses: {
          '200': dashboardJsonResponse('Ate 1000 celulas agregadas.', {
            filters: { $ref: '#/components/schemas/DashboardFilters' },
            cellSizeMeters: { type: 'integer', enum: [250] },
            cells: {
              type: 'array',
              items: { $ref: '#/components/schemas/DashboardHeatmapCell' },
            },
          }),
          '401': errorResponse('Autenticacao obrigatoria.'),
          '403': errorResponse('Perfil ou municipio sem permissao.'),
          '422': errorResponse('Filtro ou periodo invalido.'),
        },
      },
    },
    '/api/v1/dashboard/export': {
      get: {
        tags: ['Dashboard'],
        summary: 'Exporta o recorte do painel em CSV',
        description:
          'Exportacao MVP limitada a 10.000 linhas, sem dados pessoais, descricao, endereco ou coordenada. Campos de texto sao protegidos contra formulas.',
        operationId: 'exportDashboardCsv',
        security: bearerSecurity,
        parameters: [
          ...dashboardFilterParameters,
          {
            in: 'query',
            name: 'format',
            schema: { type: 'string', enum: ['csv'], default: 'csv' },
          },
          {
            in: 'query',
            name: 'limit',
            schema: { type: 'integer', minimum: 1, maximum: 10000, default: 10000 },
          },
        ],
        responses: {
          '200': {
            description: 'Arquivo CSV UTF-8 com BOM.',
            headers: {
              'Content-Disposition': { schema: { type: 'string' } },
              'X-Export-Row-Count': { schema: { type: 'integer', minimum: 0 } },
              'X-Export-Limit': { schema: { type: 'integer', minimum: 1, maximum: 10000 } },
              'X-Export-Truncated': { schema: { type: 'boolean' } },
            },
            content: {
              'text/csv': {
                schema: { type: 'string' },
                example:
                  'protocol,title,municipality_name,category_code,category_name,neighborhood_name,status,severity,risk_level,priority_score,confirmation_count,first_reported_at,resolved_at,created_at',
              },
            },
          },
          '401': errorResponse('Autenticacao obrigatoria.'),
          '403': errorResponse('Perfil ou municipio sem permissao.'),
          '422': errorResponse('Filtro, periodo, formato ou limite invalido.'),
        },
      },
    },
    '/api/v1/notifications': {
      get: {
        tags: ['Notifications'],
        summary: 'Lista as notificacoes do usuario autenticado',
        operationId: 'listNotifications',
        security: bearerSecurity,
        parameters: [
          { in: 'query', name: 'page', schema: { type: 'integer', minimum: 1, default: 1 } },
          {
            in: 'query',
            name: 'limit',
            schema: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
          },
          { in: 'query', name: 'unreadOnly', schema: { type: 'boolean', default: false } },
          {
            in: 'query',
            name: 'type',
            schema: {
              type: 'string',
              enum: [
                'OCCURRENCE_CREATED',
                'STATUS_CHANGED',
                'OCCURRENCE_CONFIRMED',
                'OCCURRENCE_DUPLICATE',
                'REPAIR_EVALUATION_REQUESTED',
                'SYSTEM',
              ],
            },
          },
        ],
        responses: {
          '200': {
            description: 'Pagina de notificacoes sem acesso a registros de outro usuario.',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', enum: [true] },
                    data: {
                      type: 'object',
                      properties: {
                        notifications: {
                          type: 'array',
                          items: { $ref: '#/components/schemas/Notification' },
                        },
                        pagination: { type: 'object', additionalProperties: true },
                      },
                    },
                    meta: successMetaSchema,
                  },
                },
              },
            },
          },
          '401': errorResponse('Autenticacao obrigatoria.'),
          '422': errorResponse('Filtro ou paginacao invalida.'),
        },
      },
    },
    '/api/v1/notifications/unread-count': {
      get: {
        tags: ['Notifications'],
        summary: 'Conta notificacoes nao lidas do usuario',
        operationId: 'getUnreadNotificationCount',
        security: bearerSecurity,
        responses: {
          '200': {
            description: 'Contador individual.',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', enum: [true] },
                    data: {
                      type: 'object',
                      properties: { unreadCount: { type: 'integer', minimum: 0 } },
                    },
                    meta: successMetaSchema,
                  },
                },
              },
            },
          },
          '401': errorResponse('Autenticacao obrigatoria.'),
        },
      },
    },
    '/api/v1/notifications/read-all': {
      patch: {
        tags: ['Notifications'],
        summary: 'Marca todas as notificacoes do usuario como lidas',
        operationId: 'readAllNotifications',
        security: bearerSecurity,
        responses: {
          '200': { description: 'Quantidade alterada.' },
          '401': errorResponse('Autenticacao obrigatoria.'),
        },
      },
    },
    '/api/v1/notifications/{notificationId}/read': {
      patch: {
        tags: ['Notifications'],
        summary: 'Marca uma notificacao do usuario como lida',
        operationId: 'readNotification',
        security: bearerSecurity,
        parameters: [
          {
            in: 'path',
            name: 'notificationId',
            required: true,
            schema: { type: 'string', format: 'uuid' },
          },
        ],
        responses: {
          '200': { description: 'Notificacao atualizada de forma idempotente.' },
          '401': errorResponse('Autenticacao obrigatoria.'),
          '404': errorResponse('Notificacao inexistente ou de outro usuario.'),
          '422': errorResponse('Identificador invalido.'),
        },
      },
    },
    '/api/v1/webhooks/telegram/report': {
      post: {
        tags: ['Webhooks'],
        summary: 'Recebe relato normalizado do Telegram',
        description:
          'Registra o evento e cria a entrega de outbox. A automacao completa do bot permanece fora do MVP.',
        operationId: 'receiveTelegramReport',
        security: [{ webhookSignature: [] }],
        parameters: webhookHeaderParameters,
        requestBody: {
          required: true,
          content: {
            'application/json': { schema: { $ref: '#/components/schemas/ReportWebhookRequest' } },
          },
        },
        responses: webhookResponses,
      },
    },
    '/api/v1/webhooks/whatsapp/report': {
      post: {
        tags: ['Webhooks'],
        summary: 'Recebe relato normalizado do WhatsApp',
        description:
          'Registra o evento e cria a entrega de outbox. A automacao completa do WhatsApp permanece fora do MVP.',
        operationId: 'receiveWhatsappReport',
        security: [{ webhookSignature: [] }],
        parameters: webhookHeaderParameters,
        requestBody: {
          required: true,
          content: {
            'application/json': { schema: { $ref: '#/components/schemas/ReportWebhookRequest' } },
          },
        },
        responses: webhookResponses,
      },
    },
    '/api/v1/webhooks/status-update': {
      post: {
        tags: ['Webhooks'],
        summary: 'Recebe atualizacao de status normalizada do integrador',
        description:
          'Registra e audita o evento sem reenviar ao n8n; nao ignora a maquina de estados nem concede permissao operacional ao chamador.',
        operationId: 'receiveStatusUpdateWebhook',
        security: [{ webhookSignature: [] }],
        parameters: webhookHeaderParameters,
        requestBody: {
          required: true,
          content: {
            'application/json': { schema: { $ref: '#/components/schemas/StatusWebhookRequest' } },
          },
        },
        responses: webhookResponses,
      },
    },
    '/api/v1/webhooks/n8n/events': {
      post: {
        tags: ['Webhooks'],
        summary: 'Recebe callback de entrega do n8n',
        operationId: 'receiveN8nOutboxCallback',
        security: [{ webhookSignature: [] }],
        parameters: webhookHeaderParameters,
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/N8nCallbackWebhookRequest' },
            },
          },
        },
        responses: {
          ...webhookResponses,
          '404': errorResponse('Evento de outbox nao encontrado.'),
        },
      },
    },
    '/api/v1/occurrences/{occurrenceId}/timeline': {
      get: {
        tags: ['Occurrences'],
        summary: 'Consulta a linha do tempo publica da ocorrencia',
        description: 'Motivos internos aparecem somente a perfis autorizados.',
        operationId: 'getOccurrenceTimeline',
        parameters: [occurrenceIdParameter],
        responses: {
          '200': { description: 'Historico em ordem cronologica.' },
          '404': errorResponse('Ocorrencia inexistente ou nao visivel.'),
          '422': errorResponse('Identificador invalido.'),
        },
      },
    },
  },
} as const;

const openApiHttpMethods = ['get', 'post', 'put', 'patch', 'delete'] as const;

function addGlobalApiRateLimitResponses<T extends typeof openApiBaseDocument>(document: T): T {
  const paths = document.paths as Record<string, Record<string, unknown>>;
  for (const [path, pathItem] of Object.entries(paths)) {
    if (!path.startsWith('/api/')) continue;
    for (const method of openApiHttpMethods) {
      const operation = pathItem[method] as { responses?: Record<string, unknown> } | undefined;
      if (operation?.responses !== undefined && operation.responses['429'] === undefined) {
        operation.responses['429'] = errorResponse('Limite global de requisicoes da API excedido.');
      }
    }
  }
  return document;
}

const continuationDocument = {
  ...openApiBaseDocument,
  paths: { ...openApiBaseDocument.paths, ...phase11Paths },
};
for (const path of ['/api/v1/occurrences', '/api/v1/occurrences/mine', '/api/v1/occurrences/map']) {
  const operations = continuationDocument.paths as unknown as Record<
    string,
    { get?: { parameters?: unknown[] } }
  >;
  const get = operations[path]?.get;
  if (get !== undefined) {
    get.parameters ??= [];
    get.parameters.push({
      name: 'q',
      in: 'query',
      schema: { type: 'string', maxLength: 150 },
      description: 'Busca literal por titulo ou descricao, antes da paginacao.',
    });
    if (path.endsWith('/map'))
      get.parameters.push({
        name: 'neighborhood',
        in: 'query',
        schema: { type: 'string', maxLength: 150 },
      });
  }
}
export const openApiDocument = addGlobalApiRateLimitResponses(continuationDocument);
