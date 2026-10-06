import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    setupFiles: ['./tests/setup-env.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'json-summary'],
      include: ['src/**/*.ts'],
      exclude: [
        'src/server.ts',
        'src/database/migrate.ts',
        'src/database/bootstrap-pilot.ts',
        'src/database/validate-clean-database.ts',
        'src/database/validate-phase11.ts',
        'src/database/process-outbox.ts',
        'src/database/recalculate-priorities.ts',
        'src/database/seed.ts',
        'src/database/validate-schema.ts',
        'src/database/schema/**',
        'src/modules/auth/identity.repository.ts',
        'src/modules/ai/ai.repository.ts',
        'src/modules/confirmations/confirmations.repository.ts',
        'src/modules/dashboard/dashboard.repository.ts',
        'src/modules/departments/departments.repository.ts',
        'src/modules/evaluations/evaluations.repository.ts',
        'src/modules/occurrences/occurrences.repository.ts',
        'src/modules/notifications/notifications.repository.ts',
        'src/modules/outbox/outbox.repository.ts',
        'src/modules/status/status.repository.ts',
        'src/modules/webhooks/webhooks.repository.ts',
        'src/shared/types/**',
      ],
      thresholds: {
        statements: 80,
        functions: 80,
        lines: 80,
        branches: 70,
      },
    },
  },
});
