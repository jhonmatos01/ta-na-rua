import type {
  CreatedOccurrence,
  MapPoint,
  PublicOccurrence,
  TimelineItem,
} from '../features/occurrences/occurrence-contracts';

export const publicOccurrenceFixture: PublicOccurrence = {
  id: '30000000-0000-4000-8000-000000000001',
  protocol: 'TNR-2026-000001',
  title: 'Buraco na Rua das Flores',
  description: 'Buraco grande próximo à faixa de pedestres.',
  category: {
    id: '20000000-0000-4000-8000-000000000001',
    name: 'Buraco na via',
  },
  municipality: {
    id: '10000000-0000-4000-8000-000000000001',
    name: 'Salvador',
  },
  neighborhood: {
    id: '11000000-0000-4000-8000-000000000001',
    name: 'Pituba',
  },
  status: 'IN_PROGRESS',
  severity: 4,
  priorityScore: 82.4,
  riskLevel: 'HIGH',
  confirmationCount: 18,
  anonymousPublication: false,
  images: [
    {
      id: '31000000-0000-4000-8000-000000000001',
      url: '/uploads/occurrences/buraco-publico.jpg',
      mimeType: 'image/jpeg',
      imageType: 'PRIMARY',
      moderationStatus: 'APPROVED',
      createdAt: '2026-07-20T14:00:00.000Z',
    },
  ],
  firstReportedAt: '2026-07-20T14:00:00.000Z',
  createdAt: '2026-07-20T14:00:00.000Z',
  updatedAt: '2026-07-20T18:30:00.000Z',
  address: 'Rua das Flores',
  location: {
    latitude: -12.9714,
    longitude: -38.5014,
    approximate: true,
  },
};

export const secondPublicOccurrenceFixture: PublicOccurrence = {
  ...publicOccurrenceFixture,
  id: '30000000-0000-4000-8000-000000000002',
  protocol: 'TNR-2026-000002',
  title: 'Poste apagado na avenida',
  description: 'Iluminação apagada há três noites.',
  category: {
    id: '20000000-0000-4000-8000-000000000002',
    name: 'Iluminação pública',
  },
  neighborhood: 'Centro',
  status: 'PUBLISHED',
  priorityScore: 45,
  riskLevel: 'MEDIUM',
  confirmationCount: 7,
  images: [],
  location: {
    latitude: -12.979,
    longitude: -38.51,
    approximate: true,
  },
};

export const mapPointFixtures: MapPoint[] = [
  {
    id: publicOccurrenceFixture.id,
    protocol: publicOccurrenceFixture.protocol,
    title: publicOccurrenceFixture.title,
    status: publicOccurrenceFixture.status,
    category: publicOccurrenceFixture.category?.name ?? null,
    riskLevel: publicOccurrenceFixture.riskLevel,
    confirmationCount: publicOccurrenceFixture.confirmationCount,
    latitude: publicOccurrenceFixture.location.latitude,
    longitude: publicOccurrenceFixture.location.longitude,
  },
  {
    id: secondPublicOccurrenceFixture.id,
    protocol: secondPublicOccurrenceFixture.protocol,
    title: secondPublicOccurrenceFixture.title,
    status: secondPublicOccurrenceFixture.status,
    category: secondPublicOccurrenceFixture.category?.name ?? null,
    riskLevel: secondPublicOccurrenceFixture.riskLevel,
    confirmationCount: secondPublicOccurrenceFixture.confirmationCount,
    latitude: secondPublicOccurrenceFixture.location.latitude,
    longitude: secondPublicOccurrenceFixture.location.longitude,
  },
];

export const timelineFixtures: TimelineItem[] = [
  {
    id: '32000000-0000-4000-8000-000000000001',
    previousStatus: null,
    newStatus: 'PUBLISHED',
    publicMessage: 'Ocorrência publicada no mapa.',
    createdAt: '2026-07-20T14:10:00.000Z',
  },
  {
    id: '32000000-0000-4000-8000-000000000002',
    previousStatus: 'PUBLISHED',
    newStatus: 'IN_PROGRESS',
    publicMessage: 'Equipe responsável iniciou o atendimento.',
    createdAt: '2026-07-20T18:30:00.000Z',
  },
];

export const createdOccurrenceFixture: CreatedOccurrence = {
  ...publicOccurrenceFixture,
  id: '30000000-0000-4000-8000-000000000099',
  protocol: 'TNR-2026-000099',
  status: 'PENDING_REVIEW',
  createdBy: '50000000-0000-4000-8000-000000000001',
  location: {
    latitude: -12.9714,
    longitude: -38.5014,
    accuracy: 12,
    approximate: false,
  },
  nearbyCandidates: [],
};
