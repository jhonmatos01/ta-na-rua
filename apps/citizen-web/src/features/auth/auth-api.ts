import { z } from 'zod';

import { apiRequest } from '../../lib/http-client';
import { sessionResponseSchema, userResponseSchema, type AuthUser } from './auth-contracts';

export interface LoginInput {
  email: string;
  password: string;
}

export interface RegisterInput extends LoginInput {
  name: string;
  phone?: string;
  municipalityId: string;
  neighborhood?: string;
}

export interface UpdateProfileInput {
  name?: string;
  phone?: string | null;
  neighborhood?: string | null;
  avatarUrl?: string | null;
}

export function login(input: LoginInput) {
  return apiRequest('/api/v1/auth/login', {
    method: 'POST',
    body: { ...input },
    schema: sessionResponseSchema,
  });
}

export async function register(input: RegisterInput): Promise<AuthUser> {
  const response = await apiRequest('/api/v1/auth/register', {
    method: 'POST',
    body: { ...input },
    schema: userResponseSchema,
  });
  return response.data.user;
}

export function refreshSession() {
  return apiRequest('/api/v1/auth/refresh', {
    method: 'POST',
    schema: sessionResponseSchema,
    retryUnauthorized: false,
  });
}

export function logout(): Promise<undefined> {
  return apiRequest('/api/v1/auth/logout', {
    method: 'POST',
    schema: z.undefined(),
    retryUnauthorized: false,
  });
}

export async function getMyProfile(): Promise<AuthUser> {
  const response = await apiRequest('/api/v1/users/me', {
    auth: true,
    schema: userResponseSchema,
  });
  return response.data.user;
}

export async function updateMyProfile(input: UpdateProfileInput): Promise<AuthUser> {
  const response = await apiRequest('/api/v1/users/me', {
    auth: true,
    method: 'PATCH',
    body: { ...input },
    schema: userResponseSchema,
  });
  return response.data.user;
}
