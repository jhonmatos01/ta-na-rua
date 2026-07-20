import type { Request } from 'express';

export interface ResponseMeta {
  requestId: string;
}

export interface SuccessResponse<T> {
  success: true;
  data: T;
  meta: ResponseMeta;
}

export function createSuccessResponse<T>(request: Request, data: T): SuccessResponse<T> {
  return {
    success: true,
    data,
    meta: {
      requestId: request.requestId,
    },
  };
}
