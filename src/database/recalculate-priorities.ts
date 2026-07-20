import { logger } from '../config/logger.js';
import { PostgresConfirmationsRepository } from '../modules/confirmations/confirmations.repository.js';
import { DefaultPriorityService } from '../modules/confirmations/priority.service.js';
import { closeDatabase } from './pool.js';

async function recalculatePriorities(): Promise<void> {
  const repository = new PostgresConfirmationsRepository();
  const priorityService = new DefaultPriorityService();
  const calculatedAt = new Date();
  const result = await repository.recalculateAll(calculatedAt, (input) =>
    priorityService.calculate(input),
  );
  logger.info({ ...result, calculatedAt }, 'Contadores e prioridades recalculados com sucesso.');
}

try {
  await recalculatePriorities();
} catch (error) {
  logger.error({ err: error }, 'Falha ao recalcular contadores e prioridades.');
  process.exitCode = 1;
} finally {
  await closeDatabase();
}
