import { z } from 'zod';

import { config } from './config';

export type OperationalRole = 'ADMIN' | 'CITY_OPERATOR' | 'MODERATOR';
export type UserRole = 'CITIZEN' | OperationalRole;

const userSchema = z.object({
  id: z.uuid(),
  name: z.string().min(1),
  email: z.email(),
  role: z.enum(['CITIZEN', 'CITY_OPERATOR', 'MODERATOR', 'ADMIN']),
  municipalityId: z.uuid().nullable(),
  status: z.enum(['PENDING', 'ACTIVE', 'BLOCKED', 'DELETED']),
});

const sessionSchema = z.object({
  success: z.literal(true),
  data: z.object({
    accessToken: z.string().min(1),
    user: userSchema,
  }),
});

const filtersSchema = z.object({
  municipalityId: z.uuid().nullable(),
  categoryId: z.uuid().nullable(),
  neighborhoodId: z.uuid().nullable(),
  status: z.string().nullable(),
  startDate: z.string().nullable(),
  endDate: z.string().nullable(),
});

const summarySchema = z.object({
  success: z.literal(true),
  data: z.object({
    filters: filtersSchema,
    summary: z.object({
      totalOccurrences: z.number().int().nonnegative(),
      activeOccurrences: z.number().int().nonnegative(),
      resolvedOccurrences: z.number().int().nonnegative(),
      closedOccurrences: z.number().int().nonnegative(),
      contestedOccurrences: z.number().int().nonnegative(),
      rejectedOccurrences: z.number().int().nonnegative(),
      duplicateOccurrences: z.number().int().nonnegative(),
      totalConfirmations: z.number().int().nonnegative(),
      averagePriorityScore: z.number().nonnegative(),
      resolutionRate: z.number().nonnegative(),
    }),
  }),
});

const rankingSchema = z.object({
  success: z.literal(true),
  data: z.object({
    occurrences: z.array(
      z.object({
        occurrenceId: z.uuid(),
        protocol: z.string().min(1),
        title: z.string().min(1),
        categoryName: z.string().nullable(),
        neighborhoodName: z.string().nullable(),
        status: z.string().min(1),
        riskLevel: z.string().nullable(),
        priorityScore: z.number(),
        confirmationCount: z.number().int().nonnegative(),
        createdAt: z.iso.datetime(),
      }),
    ),
  }),
});

const categorySchema = z.object({
  success: z.literal(true),
  data: z.object({
    categories: z.array(
      z.object({
        key: z.string().nullable(),
        code: z.string().nullable().optional(),
        name: z.string().min(1),
        count: z.number().int().nonnegative(),
        percentage: z.number().nonnegative(),
      }),
    ),
  }),
});

const neighborhoodSchema = z.object({
  success: z.literal(true),
  data: z.object({
    neighborhoods: z.array(
      z.object({
        key: z.string().nullable(),
        name: z.string().min(1),
        count: z.number().int().nonnegative(),
        percentage: z.number().nonnegative(),
      }),
    ),
  }),
});

const occurrenceStatusSchema = z.enum([
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
]);

const occurrenceImageSchema = z.object({
  id: z.uuid(),
  url: z.string().min(1),
  mimeType: z.string().min(1),
  imageType: z.string().min(1),
  moderationStatus: z.string().min(1),
  createdAt: z.iso.datetime(),
});

const occurrenceSchema = z.object({
  id: z.uuid(),
  protocol: z.string().min(1),
  title: z.string().min(1),
  description: z.string().nullable(),
  category: z.object({ id: z.uuid(), name: z.string().nullable() }).nullable(),
  municipality: z.object({ id: z.uuid(), name: z.string().min(1) }),
  neighborhood: z
    .union([z.object({ id: z.uuid(), name: z.string().nullable() }), z.string().min(1)])
    .nullable(),
  status: occurrenceStatusSchema,
  severity: z.number().nullable(),
  priorityScore: z.number().min(0).max(100),
  riskLevel: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).nullable(),
  confirmationCount: z.number().int().nonnegative(),
  anonymousPublication: z.boolean(),
  images: z.array(occurrenceImageSchema),
  firstReportedAt: z.iso.datetime(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
  address: z.string().nullable(),
  location: z.object({
    latitude: z.number().min(-90).max(90),
    longitude: z.number().min(-180).max(180),
    accuracy: z.number().nonnegative().nullable().optional(),
    approximate: z.boolean(),
  }),
});

const occurrenceListSchema = z.object({
  success: z.literal(true),
  data: z.object({ occurrences: z.array(occurrenceSchema) }),
  meta: z.object({
    requestId: z.string().min(1),
    page: z.number().int().positive(),
    limit: z.number().int().positive(),
    total: z.number().int().nonnegative(),
    totalPages: z.number().int().nonnegative(),
  }),
});

const occurrenceDetailSchema = z.object({
  success: z.literal(true),
  data: z.object({ occurrence: occurrenceSchema }),
});

const occurrenceTimelineSchema = z.object({
  success: z.literal(true),
  data: z.object({
    timeline: z.array(
      z.object({
        id: z.uuid(),
        previousStatus: occurrenceStatusSchema.nullable(),
        newStatus: occurrenceStatusSchema,
        publicMessage: z.string().nullable(),
        reason: z.string().nullable().optional(),
        createdAt: z.iso.datetime(),
      }),
    ),
  }),
});

export type SessionUser = z.infer<typeof userSchema>;
export type DashboardSummary = z.infer<typeof summarySchema>['data']['summary'];
export type RankingItem = z.infer<typeof rankingSchema>['data']['occurrences'][number];
export type CategoryItem = z.infer<typeof categorySchema>['data']['categories'][number];
export type NeighborhoodItem = z.infer<
  typeof neighborhoodSchema
>['data']['neighborhoods'][number];
export type OccurrenceStatus = z.infer<typeof occurrenceStatusSchema>;
export type OperationalOccurrence = z.infer<typeof occurrenceSchema>;
export type OccurrenceTimelineItem = z.infer<
  typeof occurrenceTimelineSchema
>['data']['timeline'][number];

export interface OccurrenceFilters {
  status?: OccurrenceStatus;
  category?: string;
  neighborhood?: string;
  startDate?: string;
  endDate?: string;
  page: number;
  limit?: number;
}

let accessToken: string | null = null;
let refreshHandler: (() => Promise<string | null>) | null = null;
let refreshPromise: Promise<string | null> | null = null;

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status?: number,
    readonly code?: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export function setAccessToken(token: string | null): void {
  accessToken = token;
}

export function setRefreshHandler(handler: (() => Promise<string | null>) | null): void {
  refreshHandler = handler;
}

async function refreshAccessToken(): Promise<string | null> {
  if (refreshHandler === null) return null;
  refreshPromise ??= refreshHandler().finally(() => {
    refreshPromise = null;
  });
  return refreshPromise;
}

interface RequestOptions<TSchema extends z.ZodType> {
  schema: TSchema;
  method?: 'GET' | 'POST';
  body?: Record<string, unknown>;
  auth?: boolean;
  retryUnauthorized?: boolean;
}

async function request<TSchema extends z.ZodType>(
  path: string,
  options: RequestOptions<TSchema>,
): Promise<z.output<TSchema>> {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), config.apiTimeoutMs);

  async function execute(canRetry: boolean): Promise<z.output<TSchema>> {
    const headers = new Headers({ Accept: 'application/json' });
    if (options.body) headers.set('Content-Type', 'application/json');
    if (options.auth && accessToken) headers.set('Authorization', `Bearer ${accessToken}`);

    const response = await fetch(new URL(path, `${config.apiBaseUrl}/`), {
      method: options.method ?? 'GET',
      headers,
      body: options.body ? JSON.stringify(options.body) : undefined,
      credentials: 'include',
      signal: controller.signal,
    });
    const payload = (await response.json().catch(() => undefined)) as unknown;

    if (
      response.status === 401 &&
      options.auth &&
      options.retryUnauthorized !== false &&
      canRetry &&
      (await refreshAccessToken()) !== null
    ) {
      return execute(false);
    }
    if (!response.ok) {
      const failure = z
        .object({
          error: z.object({ message: z.string().optional(), code: z.string().optional() }),
        })
        .safeParse(payload);
      throw new ApiError(
        failure.success ? (failure.data.error.message ?? 'Falha na API.') : 'Falha na API.',
        response.status,
        failure.success ? failure.data.error.code : undefined,
      );
    }
    const parsed = options.schema.safeParse(payload);
    if (!parsed.success) throw new ApiError('A API retornou um formato inesperado.');
    return parsed.data;
  }

  try {
    return await execute(true);
  } catch (error) {
    if (error instanceof ApiError) throw error;
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new ApiError('A API demorou mais que o esperado.');
    }
    throw new ApiError('Não foi possível acessar a API.');
  } finally {
    window.clearTimeout(timeoutId);
  }
}

export function login(email: string, password: string) {
  return request('/api/v1/auth/login', {
    method: 'POST',
    body: { email, password },
    schema: sessionSchema,
    retryUnauthorized: false,
  });
}

export function refreshSession() {
  return request('/api/v1/auth/refresh', {
    method: 'POST',
    schema: sessionSchema,
    retryUnauthorized: false,
  });
}

export async function logout(): Promise<void> {
  await request('/api/v1/auth/logout', {
    method: 'POST',
    schema: z.undefined(),
    retryUnauthorized: false,
  });
}

export async function getDashboard() {
  const [summary, ranking, categories] = await Promise.all([
    request('/api/v1/dashboard/summary', { auth: true, schema: summarySchema }),
    request('/api/v1/dashboard/priority-ranking?limit=5', {
      auth: true,
      schema: rankingSchema,
    }),
    request('/api/v1/dashboard/by-category', { auth: true, schema: categorySchema }),
  ]);
  return {
    summary: summary.data.summary,
    ranking: ranking.data.occurrences,
    categories: categories.data.categories,
  };
}

export async function getOperationsFilterOptions() {
  const [categories, neighborhoods] = await Promise.all([
    request('/api/v1/dashboard/by-category', { auth: true, schema: categorySchema }),
    request('/api/v1/dashboard/by-neighborhood', { auth: true, schema: neighborhoodSchema }),
  ]);
  return {
    categories: categories.data.categories,
    neighborhoods: neighborhoods.data.neighborhoods,
  };
}

export async function listOccurrences(filters: OccurrenceFilters) {
  const query = new URLSearchParams({
    page: String(filters.page),
    limit: String(filters.limit ?? 8),
  });
  if (filters.status) query.set('status', filters.status);
  if (filters.category) query.set('category', filters.category);
  if (filters.neighborhood) query.set('neighborhood', filters.neighborhood);
  if (filters.startDate) query.set('startDate', `${filters.startDate}T00:00:00.000Z`);
  if (filters.endDate) query.set('endDate', `${filters.endDate}T23:59:59.999Z`);

  const response = await request(`/api/v1/occurrences?${query.toString()}`, {
    auth: true,
    schema: occurrenceListSchema,
  });
  return {
    occurrences: response.data.occurrences,
    pagination: response.meta,
  };
}

export async function getOccurrenceDetail(occurrenceId: string) {
  const [occurrence, timeline] = await Promise.all([
    request(`/api/v1/occurrences/${occurrenceId}`, {
      auth: true,
      schema: occurrenceDetailSchema,
    }),
    request(`/api/v1/occurrences/${occurrenceId}/timeline`, {
      auth: true,
      schema: occurrenceTimelineSchema,
    }),
  ]);
  return {
    occurrence: occurrence.data.occurrence,
    timeline: timeline.data.timeline,
  };
}

export function resolveAssetUrl(value: string): string | null {
  try {
    const url = new URL(value, `${config.apiBaseUrl}/`);
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.toString() : null;
  } catch {
    return null;
  }
}

export function isOperationalRole(role: UserRole): role is OperationalRole {
  return role === 'CITY_OPERATOR' || role === 'MODERATOR' || role === 'ADMIN';
}
