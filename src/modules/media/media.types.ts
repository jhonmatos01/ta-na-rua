import type { RequestContext } from '../auth/auth.types.js';
import type { OccurrenceStatus } from '../occurrences/occurrences.types.js';

export type ModerationStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'FLAGGED';
export interface MediaRecord {
  id: string;
  occurrenceId: string;
  storageKey: string;
  mimeType: string;
  moderationStatus: ModerationStatus;
  occurrenceStatus: OccurrenceStatus;
  municipalityId: string;
  ownerId: string;
  title: string;
  protocol: string;
  createdAt: Date;
}
export interface ModerationQuery {
  status: ModerationStatus;
  page: number;
  limit: number;
  municipalityId?: string | undefined;
}
export interface ModerationDecision {
  status: Exclude<ModerationStatus, 'PENDING'>;
  expectedStatus: ModerationStatus;
  reason: string;
}
export interface MediaRepository {
  find(selector: { id: string } | { storageKey: string }): Promise<MediaRecord | null>;
  list(query: ModerationQuery): Promise<{ images: MediaRecord[]; total: number }>;
  review(
    id: string,
    decision: ModerationDecision,
    actorId: string,
    context: RequestContext,
  ): Promise<MediaRecord | null>;
}
export interface MediaReader {
  read(key: string): Promise<Buffer>;
}
