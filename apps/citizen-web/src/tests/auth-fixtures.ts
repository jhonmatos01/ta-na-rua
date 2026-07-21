import type { AuthUser } from '../features/auth/auth-contracts';

export const authUserFixture: AuthUser = {
  id: '50000000-0000-4000-8000-000000000001',
  name: 'Ana Cidadã',
  email: 'ana@example.test',
  phone: '+5571999990000',
  role: 'CITIZEN',
  municipalityId: '10000000-0000-4000-8000-000000000001',
  neighborhood: 'Pituba',
  avatarUrl: null,
  status: 'ACTIVE',
  emailVerifiedAt: null,
  lastLoginAt: '2026-07-20T21:00:00.000Z',
  createdAt: '2026-07-20T20:00:00.000Z',
  updatedAt: '2026-07-20T21:00:00.000Z',
  deletedAt: null,
};

export function sessionFixture(user: AuthUser = authUserFixture) {
  return {
    success: true as const,
    data: {
      accessToken: 'test-access-token',
      tokenType: 'Bearer' as const,
      expiresIn: 900,
      user,
    },
    meta: { requestId: 'test-auth-request' },
  };
}
