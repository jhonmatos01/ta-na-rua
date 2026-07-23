import type { RequestContext, UserRole } from '../auth/auth.types.js';
import type {
  CreateOccurrenceInput,
  MapQuery,
  NearbyQuery,
  OccurrenceListQuery,
  UpdateOccurrenceInput,
} from './occurrences.schemas.js';

export type OccurrenceStatus =
  | 'PENDING_REVIEW'
  | 'PUBLISHED'
  | 'FORWARDED'
  | 'ACKNOWLEDGED'
  | 'UNDER_ANALYSIS'
  | 'SCHEDULED'
  | 'IN_PROGRESS'
  | 'RESOLVED'
  | 'CONTESTED'
  | 'CLOSED'
  | 'REJECTED'
  | 'DUPLICATE';

export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export interface UploadedFile {
  buffer: Buffer;
  declaredMimeType: string;
  size: number;
}

export interface StoredImage {
  key: string;
  url: string;
  mimeType: 'image/jpeg' | 'image/png' | 'image/webp';
  size: number;
}

export class OccurrenceImageLimitError extends Error {
  public constructor() {
    super('Limite de imagens atingido durante a transacao.');
    this.name = 'OccurrenceImageLimitError';
  }
}

export interface OccurrenceImageRecord {
  id: string;
  fileUrl: string;
  mimeType: string;
  fileSize: number;
  imageType: string;
  moderationStatus: string;
  createdAt: Date;
}

export interface OccurrenceRecord {
  id: string;
  protocol: string;
  title: string;
  description: string | null;
  categoryId: string | null;
  categoryName: string | null;
  municipalityId: string;
  municipalityName: string;
  neighborhoodId: string | null;
  neighborhoodName: string | null;
  neighborhoodText: string | null;
  createdBy: string;
  status: OccurrenceStatus;
  severity: number | null;
  priorityScore: number;
  riskLevel: RiskLevel | null;
  address: string | null;
  latitude: number;
  longitude: number;
  locationAccuracy: number | null;
  anonymousPublication: boolean;
  confirmationCount: number;
  firstReportedAt: Date;
  createdAt: Date;
  updatedAt: Date;
  images: OccurrenceImageRecord[];
  distanceMeters?: number;
}

export interface HistoryRecord {
  id: string;
  previousStatus: OccurrenceStatus | null;
  newStatus: OccurrenceStatus;
  reason: string | null;
  publicMessage: string | null;
  createdAt: Date;
}

export interface LocationValidation {
  municipalityExists: boolean;
  declaredMunicipalityIsNearest: boolean;
  distanceMeters: number | null;
  neighborhoodMatches: boolean;
  categoryExists: boolean;
}

export interface CreateOccurrenceData {
  input: CreateOccurrenceInput;
  userId: string;
  image: StoredImage;
  context: RequestContext;
  now: Date;
}

export interface OccurrenceListResult {
  items: OccurrenceRecord[];
  total: number;
}

export interface OccurrenceVisibility {
  publicOnly: boolean;
  municipalityId?: string;
  ownerId?: string;
  confirmerId?: string;
  evaluationPendingForUserId?: string;
}

export interface OccurrenceRepository {
  validateLocationAndReferences(input: CreateOccurrenceInput): Promise<LocationValidation>;
  create(data: CreateOccurrenceData): Promise<OccurrenceRecord>;
  findById(occurrenceId: string): Promise<OccurrenceRecord | null>;
  list(query: OccurrenceListQuery, visibility: OccurrenceVisibility): Promise<OccurrenceListResult>;
  nearby(query: NearbyQuery, visibility: OccurrenceVisibility): Promise<OccurrenceListResult>;
  map(query: MapQuery, visibility: OccurrenceVisibility): Promise<OccurrenceRecord[]>;
  update(
    occurrenceId: string,
    actorId: string,
    input: UpdateOccurrenceInput,
    context: RequestContext,
    now: Date,
  ): Promise<OccurrenceRecord | null>;
  softDelete(
    occurrenceId: string,
    actorId: string,
    context: RequestContext,
    now: Date,
  ): Promise<boolean>;
  countImages(occurrenceId: string): Promise<number>;
  addImage(
    occurrenceId: string,
    actorId: string,
    image: StoredImage,
    maxImages: number,
    context: RequestContext,
    now: Date,
  ): Promise<OccurrenceImageRecord | null>;
  timeline(occurrenceId: string): Promise<HistoryRecord[]>;
}

export interface RequestPrincipal {
  sub: string;
  role: UserRole;
  municipalityId: string | null;
}
