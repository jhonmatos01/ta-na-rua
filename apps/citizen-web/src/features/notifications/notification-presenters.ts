import type { NotificationType } from './notification-contracts';

export const notificationTypeLabels: Record<NotificationType, string> = {
  OCCURRENCE_CREATED: 'Registro',
  STATUS_CHANGED: 'Atualização',
  OCCURRENCE_CONFIRMED: 'Comunidade',
  OCCURRENCE_DUPLICATE: 'Ocorrência relacionada',
  REPAIR_EVALUATION_REQUESTED: 'Avaliação',
  SYSTEM: 'Sistema',
};

export const notificationTypeStyles: Record<NotificationType, string> = {
  OCCURRENCE_CREATED: 'bg-brand-50 text-brand-700',
  STATUS_CHANGED: 'bg-amber-50 text-amber-800',
  OCCURRENCE_CONFIRMED: 'bg-emerald-50 text-emerald-700',
  OCCURRENCE_DUPLICATE: 'bg-violet-50 text-violet-700',
  REPAIR_EVALUATION_REQUESTED: 'bg-coral-100 text-red-800',
  SYSTEM: 'bg-slate-100 text-slate-700',
};
