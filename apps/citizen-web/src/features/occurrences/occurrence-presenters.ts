import type { OccurrenceStatus, PublicOccurrence, RiskLevel } from './occurrence-contracts';

export const occurrenceStatusLabels: Record<OccurrenceStatus, string> = {
  PENDING_REVIEW: 'Em revisão',
  PUBLISHED: 'Publicado',
  FORWARDED: 'Encaminhado',
  ACKNOWLEDGED: 'Recebido',
  UNDER_ANALYSIS: 'Em análise',
  SCHEDULED: 'Agendado',
  IN_PROGRESS: 'Em atendimento',
  RESOLVED: 'Resolvido',
  CONTESTED: 'Contestado',
  CLOSED: 'Encerrado',
  REJECTED: 'Rejeitado',
  DUPLICATE: 'Relacionado',
};

export const riskLevelLabels: Record<RiskLevel, string> = {
  LOW: 'Baixo',
  MEDIUM: 'Médio',
  HIGH: 'Alto',
  CRITICAL: 'Crítico',
};

export function getNeighborhoodLabel(occurrence: PublicOccurrence): string {
  if (occurrence.neighborhood === null) return 'Bairro não informado';
  return typeof occurrence.neighborhood === 'string'
    ? occurrence.neighborhood
    : (occurrence.neighborhood.name ?? 'Bairro não informado');
}

export function getNeighborhoodValue(occurrence: PublicOccurrence): string | null {
  if (occurrence.neighborhood === null) return null;
  return typeof occurrence.neighborhood === 'string'
    ? occurrence.neighborhood
    : occurrence.neighborhood.id;
}

function normalize(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/gu, '')
    .toLocaleLowerCase('pt-BR')
    .trim();
}

export function matchesOccurrenceSearch(occurrence: PublicOccurrence, rawSearch: string): boolean {
  const search = normalize(rawSearch);
  if (search.length === 0) return true;
  return normalize(
    [
      occurrence.title,
      occurrence.protocol,
      occurrence.category?.name ?? '',
      getNeighborhoodLabel(occurrence),
      occurrence.address ?? '',
    ].join(' '),
  ).includes(search);
}

export function formatPublicDate(value: string): string {
  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}
