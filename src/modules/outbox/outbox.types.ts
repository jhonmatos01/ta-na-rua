export type OutboxEventStatus = 'PENDING' | 'PROCESSING' | 'PROCESSED' | 'FAILED';

export interface OutboxEventRecord {
  id: string;
  eventType: string;
  entityType: string;
  entityId: string;
  payload: Record<string, unknown>;
  status: OutboxEventStatus;
  attempts: number;
  availableAt: Date;
  processedAt: Date | null;
  lastError: string | null;
  createdAt: Date;
}

export interface OutboxRepository {
  claimBatch(
    batchSize: number,
    maximumAttempts: number,
    now: Date,
    leaseUntil: Date,
  ): Promise<OutboxEventRecord[]>;
  markProcessed(eventId: string, processedAt: Date): Promise<void>;
  markDeliveryFailure(
    eventId: string,
    errorCode: string,
    terminal: boolean,
    availableAt: Date,
  ): Promise<void>;
}

export interface OutboxDeliveryClient {
  deliver(event: OutboxEventRecord): Promise<void>;
}

export interface OutboxBatchResult {
  claimed: number;
  processed: number;
  scheduledForRetry: number;
  failed: number;
}

export class OutboxDeliveryError extends Error {
  public constructor(public readonly code: string) {
    super(code);
    this.name = 'OutboxDeliveryError';
  }
}
