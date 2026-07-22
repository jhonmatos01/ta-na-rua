import { useEffect, useMemo, useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import { Link } from 'react-router-dom';

import { Button } from '../components/button';
import { ReportLocationPicker, type ReportCoordinates } from '../components/report-location-picker';
import { env } from '../config/env';
import { useAuth } from '../features/auth/auth-context';
import {
  getReverseGeocodingErrorMessage,
  reverseGeocode,
  type ReverseGeocodedAddress,
} from '../features/geocoding/geocoding-api';
import type {
  CreatedOccurrence,
  PublicOccurrence,
} from '../features/occurrences/occurrence-contracts';
import {
  getConfirmationErrorMessage,
  getReportErrorMessage,
} from '../features/occurrences/report-errors';
import {
  reportDetailsSchema,
  reportFieldErrors,
  reportLocationSchema,
  type ReportFieldErrors,
} from '../features/occurrences/report-form-schema';
import {
  useConfirmExistingOccurrence,
  useCreateOccurrence,
  useNearbyOccurrences,
  useOccurrenceCatalog,
} from '../features/occurrences/occurrence-queries';
import {
  getNeighborhoodLabel,
  occurrenceStatusLabels,
} from '../features/occurrences/occurrence-presenters';

type ReportStep = 'details' | 'location' | 'review';

interface ReportDraft {
  title: string;
  description: string;
  categoryId: string;
  image: File | null;
  location: ReportCoordinates | null;
  neighborhoodText: string;
  address: string;
  anonymousPublication: boolean;
}

const stepOrder: ReportStep[] = ['details', 'location', 'review'];
const stepLabels: Record<ReportStep, string> = {
  details: 'Foto e relato',
  location: 'Localização',
  review: 'Revisão',
};

function formatFileSize(bytes: number): string {
  return `${(bytes / 1024 / 1024).toFixed(1).replace('.', ',')} MB`;
}

function Stepper({ current }: { current: ReportStep }) {
  const currentIndex = stepOrder.indexOf(current);
  return (
    <ol className="grid grid-cols-3 gap-2" aria-label="Etapas do registro">
      {stepOrder.map((step, index) => (
        <li
          key={step}
          className={`rounded-2xl border px-3 py-3 text-center text-xs font-extrabold sm:text-sm ${
            index <= currentIndex
              ? 'border-brand-200 bg-brand-50 text-brand-800'
              : 'border-slate-200 bg-white text-slate-500'
          }`}
          aria-current={step === current ? 'step' : undefined}
        >
          <span className="mr-1.5 inline-grid size-6 place-items-center rounded-full bg-current/10">
            {index + 1}
          </span>
          <span className="hidden sm:inline">{stepLabels[step]}</span>
        </li>
      ))}
    </ol>
  );
}

function FieldError({ children }: { children?: string }) {
  if (!children) return null;
  return <span className="text-sm font-semibold text-red-700">{children}</span>;
}

export function NewOccurrencePage() {
  const auth = useAuth();
  const [step, setStep] = useState<ReportStep>('details');
  const [draft, setDraft] = useState<ReportDraft>(() => ({
    title: '',
    description: '',
    categoryId: '',
    image: null,
    location: null,
    neighborhoodText: auth.user?.neighborhood ?? '',
    address: '',
    anonymousPublication: false,
  }));
  const [errors, setErrors] = useState<ReportFieldErrors>({});
  const [locationMessage, setLocationMessage] = useState<string | null>(null);
  const [locating, setLocating] = useState(false);
  const [geocoding, setGeocoding] = useState(false);
  const [geocodingMessage, setGeocodingMessage] = useState<string | null>(null);
  const [geocodingAttribution, setGeocodingAttribution] = useState<
    ReverseGeocodedAddress['provider'] | null
  >(null);
  const [allowNewOccurrence, setAllowNewOccurrence] = useState(false);
  const [requestError, setRequestError] = useState<string | null>(null);
  const [created, setCreated] = useState<CreatedOccurrence | null>(null);
  const [confirmedOccurrence, setConfirmedOccurrence] = useState<PublicOccurrence | null>(null);
  const submissionLock = useRef(false);
  const geocodingRequestSequence = useRef(0);
  const addressEdited = useRef(false);
  const neighborhoodEdited = useRef(false);

  const catalogQuery = useOccurrenceCatalog();
  const createMutation = useCreateOccurrence();
  const confirmationMutation = useConfirmExistingOccurrence();
  const nearbyQuery = useNearbyOccurrences(draft.location, step === 'review');

  const categoryOptions = useMemo(() => {
    const categories = new Map<string, string>();
    for (const occurrence of catalogQuery.data?.occurrences ?? []) {
      if (occurrence.category?.name) {
        categories.set(occurrence.category.id, occurrence.category.name);
      }
    }
    return [...categories].sort((a, b) => a[1].localeCompare(b[1], 'pt-BR'));
  }, [catalogQuery.data]);

  const selectedCategory = categoryOptions.find(([id]) => id === draft.categoryId)?.[1];
  const candidates = nearbyQuery.data ?? [];
  const locationAccuracyMeters =
    draft.location?.locationAccuracy !== undefined &&
    Number.isFinite(draft.location.locationAccuracy)
      ? Math.max(1, Math.round(draft.location.locationAccuracy))
      : null;
  const previewUrl = useMemo(() => {
    if (draft.image === null || typeof URL.createObjectURL !== 'function') return null;
    return URL.createObjectURL(draft.image);
  }, [draft.image]);

  useEffect(() => {
    return () => {
      if (previewUrl !== null) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  function handleImageChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;
    setDraft((current) => ({ ...current, image: file }));
    setErrors((current) => ({ ...current, image: undefined }));
  }

  function submitDetails(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const result = reportDetailsSchema.safeParse({
      title: draft.title,
      description: draft.description,
      categoryId: draft.categoryId,
      image: draft.image,
    });
    if (!result.success) {
      setErrors(reportFieldErrors(result.error));
      return;
    }
    setDraft((current) => ({ ...current, ...result.data }));
    setErrors({});
    setStep('location');
  }

  async function findApproximateAddress(
    location: ReportCoordinates,
    overwriteEditedFields: boolean,
  ) {
    const requestSequence = geocodingRequestSequence.current + 1;
    geocodingRequestSequence.current = requestSequence;
    setGeocoding(true);
    setGeocodingMessage('Buscando rua e bairro aproximados...');
    setGeocodingAttribution(null);
    try {
      const result = await reverseGeocode(location);
      if (geocodingRequestSequence.current !== requestSequence) return;
      if (result === null) {
        setGeocodingMessage(
          'Não encontramos um endereço para este ponto. Confira o mapa e informe uma referência manualmente.',
        );
        return;
      }
      setDraft((current) => {
        if (
          current.location === null ||
          current.location.latitude !== location.latitude ||
          current.location.longitude !== location.longitude
        ) {
          return current;
        }
        const suggestedAddress = result.streetAddress ?? result.formattedAddress;
        return {
          ...current,
          address:
            overwriteEditedFields || !addressEdited.current ? suggestedAddress : current.address,
          neighborhoodText:
            result.neighborhood !== null && (overwriteEditedFields || !neighborhoodEdited.current)
              ? result.neighborhood
              : current.neighborhoodText,
        };
      });
      setGeocodingAttribution(result.provider);
      setGeocodingMessage(`Endereço aproximado encontrado: ${result.formattedAddress}.`);
    } catch (error) {
      if (geocodingRequestSequence.current !== requestSequence) return;
      setGeocodingMessage(getReverseGeocodingErrorMessage(error));
    } finally {
      if (geocodingRequestSequence.current === requestSequence) setGeocoding(false);
    }
  }

  function useMyLocation() {
    if (!('geolocation' in navigator)) {
      setLocationMessage('A geolocalização não está disponível. Marque o ponto manualmente.');
      return;
    }
    setLocating(true);
    setLocationMessage('Solicitando sua localização ao navegador...');
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const accuracyMeters = Math.max(1, Math.round(position.coords.accuracy));
        const location = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          locationAccuracy: position.coords.accuracy,
        };
        setDraft((current) => ({
          ...current,
          location,
        }));
        setLocating(false);
        setLocationMessage(
          accuracyMeters <= 50
            ? `Localização encontrada com margem aproximada de ${accuracyMeters} m. Confira o marcador antes de continuar.`
            : `O dispositivo informou uma margem aproximada de ${accuracyMeters} m. O ponto pode estar deslocado; confira as ruas e ajuste o marcador antes de continuar.`,
        );
        void findApproximateAddress(location, false);
      },
      () => {
        setLocating(false);
        setLocationMessage(
          'Não foi possível acessar sua localização. Use o centro do município e corrija o ponto no mapa.',
        );
      },
      { enableHighAccuracy: true, timeout: 15_000, maximumAge: 0 },
    );
  }

  function useCityCenter() {
    geocodingRequestSequence.current += 1;
    setGeocoding(false);
    setGeocodingMessage(null);
    setGeocodingAttribution(null);
    setDraft((current) => ({
      ...current,
      location: {
        latitude: env.defaultMapLatitude,
        longitude: env.defaultMapLongitude,
      },
    }));
    setLocationMessage(
      `Ponto iniciado no centro de ${env.defaultMunicipalityName}. Corrija-o no mapa.`,
    );
  }

  function updateLocation(location: ReportCoordinates) {
    geocodingRequestSequence.current += 1;
    setGeocoding(false);
    setGeocodingMessage('O ponto foi alterado. Busque novamente o endereço aproximado.');
    setGeocodingAttribution(null);
    setDraft((current) => ({ ...current, location }));
    setErrors((current) => ({ ...current, latitude: undefined, longitude: undefined }));
  }

  function updateCoordinate(key: 'latitude' | 'longitude', rawValue: string) {
    const value = Number(rawValue);
    if (!Number.isFinite(value) || draft.location === null) return;
    updateLocation({ ...draft.location, [key]: value, locationAccuracy: undefined });
  }

  function submitLocation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (draft.location === null) {
      setErrors({ latitude: 'Selecione um ponto no mapa antes de continuar.' });
      return;
    }
    const result = reportLocationSchema.safeParse({
      ...draft.location,
      neighborhoodText: draft.neighborhoodText,
      address: draft.address,
    });
    if (!result.success) {
      setErrors(reportFieldErrors(result.error));
      return;
    }
    setDraft((current) => ({ ...current, ...result.data, location: result.data }));
    setErrors({});
    setAllowNewOccurrence(false);
    setRequestError(null);
    setStep('review');
  }

  async function confirmCandidate(candidate: PublicOccurrence) {
    setRequestError(null);
    try {
      await confirmationMutation.mutateAsync(candidate.id);
      setConfirmedOccurrence(candidate);
    } catch (error) {
      setRequestError(getConfirmationErrorMessage(error));
    }
  }

  async function submitNewOccurrence() {
    if (
      draft.image === null ||
      draft.location === null ||
      submissionLock.current ||
      confirmationMutation.isPending
    )
      return;
    if (candidates.length > 0 && !allowNewOccurrence) {
      setRequestError('Revise os problemas próximos e confirme que deseja criar um novo registro.');
      return;
    }
    submissionLock.current = true;
    setRequestError(null);
    try {
      const result = await createMutation.mutateAsync({
        title: draft.title,
        description: draft.description || undefined,
        categoryId: draft.categoryId || undefined,
        image: draft.image,
        latitude: draft.location.latitude,
        longitude: draft.location.longitude,
        locationAccuracy: draft.location.locationAccuracy,
        neighborhoodText: draft.neighborhoodText || undefined,
        address: draft.address || undefined,
        anonymousPublication: draft.anonymousPublication,
      });
      setCreated(result);
    } catch (error) {
      submissionLock.current = false;
      setRequestError(getReportErrorMessage(error));
    }
  }

  if (created !== null) {
    return (
      <section className="bg-canvas py-12 sm:py-20">
        <div className="mx-auto w-full max-w-3xl px-4 sm:px-6">
          <div className="rounded-[2rem] border border-emerald-200 bg-white p-7 text-center shadow-floating sm:p-12">
            <span
              className="mx-auto grid size-16 place-items-center rounded-full bg-emerald-100 text-3xl text-emerald-700"
              aria-hidden="true"
            >
              ✓
            </span>
            <p className="mt-6 text-xs font-extrabold uppercase tracking-[0.16em] text-emerald-700">
              Registro enviado
            </p>
            <h1 className="mt-3 text-4xl font-black tracking-[-0.04em] text-ink">
              Sua participação já virou protocolo.
            </h1>
            <p className="mt-4 text-lg leading-8 text-slate-600">
              A ocorrência entrou em revisão com o protocolo{' '}
              <strong className="text-ink">{created.protocol}</strong>. A imagem e o ponto foram
              recebidos com segurança.
            </p>
            <p className="mt-5 rounded-2xl border border-brand-100 bg-brand-50 p-4 text-sm font-semibold leading-6 text-brand-950">
              Enquanto estiver em revisão, este registro ainda não aparece no mapa nem na lista
              pública. Ele será exibido depois que a equipe responsável fizer a publicação.
            </p>
            {created.nearbyCandidates.length > 0 ? (
              <p className="mt-5 rounded-2xl bg-amber-50 p-4 text-sm font-semibold text-amber-900">
                O serviço encontrou registros próximos e fará a revisão de possível relação sem
                descartar seu envio.
              </p>
            ) : null}
            <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
              <Link
                to="/mapa"
                className="inline-flex min-h-12 items-center justify-center rounded-xl bg-brand-700 px-5 py-3 font-extrabold text-white shadow-sm hover:bg-brand-800"
              >
                Voltar ao mapa
              </Link>
              <Link
                to="/"
                className="inline-flex min-h-12 items-center justify-center rounded-xl border border-slate-300 bg-white px-5 py-3 font-extrabold text-slate-800 hover:bg-slate-50"
              >
                Ir para o início
              </Link>
            </div>
          </div>
        </div>
      </section>
    );
  }

  if (confirmedOccurrence !== null) {
    return (
      <section className="bg-canvas py-12 sm:py-20">
        <div className="mx-auto w-full max-w-3xl px-4 sm:px-6">
          <div className="rounded-[2rem] border border-brand-200 bg-white p-7 text-center shadow-floating sm:p-12">
            <span
              className="mx-auto grid size-16 place-items-center rounded-full bg-brand-100 text-3xl text-brand-700"
              aria-hidden="true"
            >
              ✓
            </span>
            <p className="mt-6 text-xs font-extrabold uppercase tracking-[0.16em] text-brand-700">
              Problema relacionado
            </p>
            <h1 className="mt-3 text-4xl font-black tracking-[-0.04em] text-ink">
              Sua confirmação fortaleceu o chamado existente.
            </h1>
            <p className="mt-4 text-lg leading-8 text-slate-600">
              Não criamos um registro duplicado. Sua participação foi associada a{' '}
              <strong className="text-ink">{confirmedOccurrence.protocol}</strong>.
            </p>
            <Link
              to={`/ocorrencias/${confirmedOccurrence.id}`}
              className="mt-8 inline-flex min-h-12 items-center justify-center rounded-xl bg-brand-700 px-5 py-3 font-extrabold text-white shadow-sm hover:bg-brand-800"
            >
              Ver ocorrência existente
            </Link>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="bg-canvas py-8 sm:py-12">
      <div className="mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8">
        <header className="grid gap-6 lg:grid-cols-[1fr_0.72fr] lg:items-end">
          <div>
            <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-brand-700">
              Novo registro · {env.defaultMunicipalityName}
            </p>
            <h1 className="mt-3 text-4xl font-black tracking-[-0.05em] text-ink sm:text-5xl">
              Mostre onde a cidade precisa de atenção.
            </h1>
            <p className="mt-4 max-w-3xl text-base leading-7 text-slate-600">
              Envie uma foto, confirme o ponto e revise os dados. Antes de criar um chamado,
              verificamos se o mesmo problema já foi registrado por outra pessoa.
            </p>
          </div>
          <Stepper current={step} />
        </header>

        {requestError ? (
          <div
            className="mt-6 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-800"
            role="alert"
          >
            {requestError}
          </div>
        ) : null}

        <div className="mt-8 rounded-[2rem] border border-slate-200 bg-white p-5 shadow-card sm:p-8 lg:p-10">
          {step === 'details' ? (
            <form
              className="grid gap-8 lg:grid-cols-[0.82fr_1.18fr]"
              onSubmit={submitDetails}
              noValidate
            >
              <div>
                <h2 className="text-2xl font-black text-ink">1. Adicione uma foto</h2>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  Use uma imagem nítida, sem expor rostos, placas ou documentos pessoais.
                </p>
                <label className="mt-5 grid min-h-72 cursor-pointer place-items-center overflow-hidden rounded-3xl border-2 border-dashed border-brand-200 bg-brand-50 text-center transition hover:border-brand-500">
                  {previewUrl ? (
                    <img
                      src={previewUrl}
                      alt="Prévia da foto selecionada"
                      className="h-full max-h-96 w-full object-cover"
                    />
                  ) : (
                    <span className="p-8">
                      <span
                        className="mx-auto grid size-14 place-items-center rounded-2xl bg-brand-600 text-2xl text-white shadow-brand"
                        aria-hidden="true"
                      >
                        +
                      </span>
                      <span className="mt-4 block font-extrabold text-ink">
                        Tirar ou escolher foto
                      </span>
                      <span className="mt-2 block text-sm text-slate-600">
                        JPEG, PNG ou WebP · até {env.maxImageSizeMb} MB
                      </span>
                    </span>
                  )}
                  <input
                    className="sr-only"
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    capture="environment"
                    onChange={handleImageChange}
                    aria-label="Foto do problema"
                  />
                </label>
                {draft.image ? (
                  <p className="mt-3 text-xs font-semibold text-slate-500">
                    {draft.image.name} · {formatFileSize(draft.image.size)}
                  </p>
                ) : null}
                <FieldError>{errors.image}</FieldError>
              </div>

              <div className="space-y-5">
                <div>
                  <h2 className="text-2xl font-black text-ink">Conte o que aconteceu</h2>
                  <p className="mt-2 text-sm leading-6 text-slate-600">
                    A classificação pode ser complementada automaticamente após o envio.
                  </p>
                </div>
                <label className="grid gap-2 text-sm font-extrabold text-ink">
                  Título do problema
                  <input
                    value={draft.title}
                    onChange={(event) =>
                      setDraft((current) => ({ ...current, title: event.target.value }))
                    }
                    maxLength={150}
                    placeholder="Ex.: Buraco grande próximo à faixa"
                    className="min-h-12 rounded-xl border border-slate-300 px-3 font-medium outline-none transition focus:border-brand-500 focus:ring-3 focus:ring-brand-100"
                    aria-invalid={Boolean(errors.title)}
                  />
                  <FieldError>{errors.title}</FieldError>
                </label>
                <label className="grid gap-2 text-sm font-extrabold text-ink">
                  Descrição <span className="font-medium text-slate-500">(opcional)</span>
                  <textarea
                    value={draft.description}
                    onChange={(event) =>
                      setDraft((current) => ({ ...current, description: event.target.value }))
                    }
                    maxLength={2000}
                    rows={6}
                    placeholder="Inclua referências que ajudem a localizar e entender o problema."
                    className="rounded-xl border border-slate-300 px-3 py-3 font-medium outline-none transition focus:border-brand-500 focus:ring-3 focus:ring-brand-100"
                    aria-invalid={Boolean(errors.description)}
                  />
                  <span className="text-right text-xs font-medium text-slate-500">
                    {draft.description.length}/2000
                  </span>
                  <FieldError>{errors.description}</FieldError>
                </label>
                <label className="grid gap-2 text-sm font-extrabold text-ink">
                  Categoria <span className="font-medium text-slate-500">(opcional)</span>
                  <select
                    value={draft.categoryId}
                    onChange={(event) =>
                      setDraft((current) => ({ ...current, categoryId: event.target.value }))
                    }
                    className="min-h-12 rounded-xl border border-slate-300 bg-white px-3 font-medium outline-none transition focus:border-brand-500 focus:ring-3 focus:ring-brand-100"
                  >
                    <option value="">Deixar a análise sugerir</option>
                    {categoryOptions.map(([id, name]) => (
                      <option key={id} value={id}>
                        {name}
                      </option>
                    ))}
                  </select>
                  {catalogQuery.isError ? (
                    <span className="text-xs font-medium text-slate-500">
                      As categorias não carregaram, mas você pode continuar sem selecionar.
                    </span>
                  ) : null}
                  <FieldError>{errors.categoryId}</FieldError>
                </label>
                <div className="flex justify-end pt-2">
                  <Button type="submit">Continuar para localização</Button>
                </div>
              </div>
            </form>
          ) : null}

          {step === 'location' ? (
            <form
              className="grid gap-8 lg:grid-cols-[1.2fr_0.8fr]"
              onSubmit={submitLocation}
              noValidate
            >
              <div>
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <h2 className="text-2xl font-black text-ink">2. Confirme o ponto</h2>
                    <p className="mt-2 text-sm leading-6 text-slate-600">
                      Sua posição é enviada à API ao buscar o endereço e ao concluir o registro. A
                      busca pode consultar o provedor configurado apenas para identificar o local
                      aproximado.
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={useMyLocation}
                      disabled={locating}
                    >
                      {locating
                        ? 'Localizando...'
                        : locationAccuracyMeters !== null
                          ? 'Tentar melhorar precisão'
                          : 'Usar minha localização'}
                    </Button>
                    <Button type="button" variant="secondary" onClick={useCityCenter}>
                      Marcar manualmente
                    </Button>
                  </div>
                </div>
                {locationMessage ? (
                  <p
                    className="my-4 rounded-2xl border border-brand-100 bg-brand-50 p-3 text-sm font-semibold text-brand-950"
                    role="status"
                  >
                    {locationMessage}
                  </p>
                ) : null}
                {locationAccuracyMeters !== null ? (
                  <div
                    className={`mb-4 rounded-2xl border p-4 text-sm ${
                      locationAccuracyMeters <= 50
                        ? 'border-emerald-200 bg-emerald-50 text-emerald-950'
                        : 'border-amber-200 bg-amber-50 text-amber-950'
                    }`}
                  >
                    <p className="font-extrabold">
                      Precisão informada pelo dispositivo: cerca de {locationAccuracyMeters} m
                    </p>
                    <p className="mt-1 leading-6">
                      {locationAccuracyMeters <= 50
                        ? 'A leitura é adequada, mas o marcador continua sendo a referência final.'
                        : 'A leitura está imprecisa. Use o mapa para mover o marcador ao ponto correto ou tente localizar novamente.'}
                    </p>
                  </div>
                ) : null}
                {draft.location ? (
                  <ReportLocationPicker value={draft.location} onChange={updateLocation} />
                ) : (
                  <div className="mt-5 grid min-h-80 place-items-center rounded-3xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center">
                    <div>
                      <span className="text-4xl" aria-hidden="true">
                        ⌖
                      </span>
                      <p className="mt-3 font-extrabold text-ink">Escolha como iniciar o ponto</p>
                      <p className="mt-2 text-sm text-slate-600">
                        Use sua localização ou comece pelo centro do município.
                      </p>
                    </div>
                  </div>
                )}
                <FieldError>{errors.latitude}</FieldError>
              </div>
              <div className="space-y-5">
                <div>
                  <h2 className="text-xl font-black text-ink">Referências do local</h2>
                  <p className="mt-2 text-sm leading-6 text-slate-600">
                    Esses dados ajudam a equipe a encontrar o ponto correto.
                  </p>
                </div>
                <label className="grid gap-2 text-sm font-extrabold text-ink">
                  Bairro <span className="font-medium text-slate-500">(opcional)</span>
                  <input
                    value={draft.neighborhoodText}
                    onChange={(event) => {
                      neighborhoodEdited.current = true;
                      setDraft((current) => ({ ...current, neighborhoodText: event.target.value }));
                    }}
                    maxLength={150}
                    autoComplete="address-level3"
                    className="min-h-12 rounded-xl border border-slate-300 px-3 font-medium outline-none focus:border-brand-500 focus:ring-3 focus:ring-brand-100"
                  />
                  <FieldError>{errors.neighborhoodText}</FieldError>
                </label>
                <label className="grid gap-2 text-sm font-extrabold text-ink">
                  Endereço ou referência{' '}
                  <span className="font-medium text-slate-500">(opcional)</span>
                  <input
                    value={draft.address}
                    onChange={(event) => {
                      addressEdited.current = true;
                      setDraft((current) => ({ ...current, address: event.target.value }));
                    }}
                    maxLength={500}
                    placeholder="Ex.: em frente à praça"
                    autoComplete="street-address"
                    className="min-h-12 rounded-xl border border-slate-300 px-3 font-medium outline-none focus:border-brand-500 focus:ring-3 focus:ring-brand-100"
                  />
                  <FieldError>{errors.address}</FieldError>
                </label>
                {draft.location ? (
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <Button
                      type="button"
                      variant="secondary"
                      disabled={geocoding}
                      onClick={() => void findApproximateAddress(draft.location!, true)}
                    >
                      {geocoding ? 'Buscando endereço...' : 'Buscar endereço deste ponto'}
                    </Button>
                    {geocodingMessage ? (
                      <p
                        className="mt-3 text-sm font-semibold leading-6 text-slate-700"
                        role="status"
                      >
                        {geocodingMessage}
                      </p>
                    ) : null}
                    {geocodingAttribution ? (
                      <p className="mt-2 text-xs text-slate-500">
                        Fonte:{' '}
                        <a
                          className="font-bold text-brand-700 underline"
                          href={geocodingAttribution.url}
                          target="_blank"
                          rel="noreferrer"
                        >
                          {geocodingAttribution.text}
                        </a>
                      </p>
                    ) : null}
                  </div>
                ) : null}
                {draft.location ? (
                  <fieldset className="rounded-2xl bg-slate-50 p-4">
                    <legend className="px-1 text-sm font-extrabold text-ink">
                      Ajuste acessível das coordenadas
                    </legend>
                    <div className="mt-2 grid gap-3 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
                      <label className="grid gap-1 text-xs font-bold text-slate-600">
                        Latitude
                        <input
                          type="number"
                          min={-90}
                          max={90}
                          step="0.000001"
                          value={draft.location.latitude}
                          onChange={(event) => updateCoordinate('latitude', event.target.value)}
                          className="min-h-11 rounded-xl border border-slate-300 bg-white px-3 text-sm text-ink"
                        />
                      </label>
                      <label className="grid gap-1 text-xs font-bold text-slate-600">
                        Longitude
                        <input
                          type="number"
                          min={-180}
                          max={180}
                          step="0.000001"
                          value={draft.location.longitude}
                          onChange={(event) => updateCoordinate('longitude', event.target.value)}
                          className="min-h-11 rounded-xl border border-slate-300 bg-white px-3 text-sm text-ink"
                        />
                      </label>
                    </div>
                  </fieldset>
                ) : null}
                <div className="flex flex-col-reverse gap-3 pt-2 sm:flex-row sm:justify-between">
                  <Button type="button" variant="secondary" onClick={() => setStep('details')}>
                    Voltar
                  </Button>
                  <Button type="submit">Revisar registro</Button>
                </div>
              </div>
            </form>
          ) : null}

          {step === 'review' && draft.image && draft.location ? (
            <div className="grid gap-8 lg:grid-cols-[0.9fr_1.1fr]">
              <div className="space-y-5">
                <div>
                  <h2 className="text-2xl font-black text-ink">3. Revise antes de enviar</h2>
                  <p className="mt-2 text-sm leading-6 text-slate-600">
                    Confira os dados e veja se o problema já existe nas proximidades.
                  </p>
                </div>
                {previewUrl ? (
                  <img
                    src={previewUrl}
                    alt="Foto que será enviada"
                    className="max-h-80 w-full rounded-3xl object-cover"
                  />
                ) : null}
                <dl className="grid gap-4 rounded-3xl bg-slate-50 p-5 text-sm">
                  <div>
                    <dt className="font-bold text-slate-500">Problema</dt>
                    <dd className="mt-1 text-lg font-black text-ink">{draft.title}</dd>
                  </div>
                  {draft.description ? (
                    <div>
                      <dt className="font-bold text-slate-500">Descrição</dt>
                      <dd className="mt-1 leading-6 text-slate-700">{draft.description}</dd>
                    </div>
                  ) : null}
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <dt className="font-bold text-slate-500">Categoria</dt>
                      <dd className="mt-1 font-extrabold text-ink">
                        {selectedCategory ?? 'Sugestão automática'}
                      </dd>
                    </div>
                    <div>
                      <dt className="font-bold text-slate-500">Bairro</dt>
                      <dd className="mt-1 font-extrabold text-ink">
                        {draft.neighborhoodText || 'Não informado'}
                      </dd>
                    </div>
                  </div>
                  <div>
                    <dt className="font-bold text-slate-500">Ponto</dt>
                    <dd className="mt-1 font-mono text-xs text-slate-700">
                      {draft.location.latitude.toFixed(6)}, {draft.location.longitude.toFixed(6)}
                    </dd>
                  </div>
                  {draft.address ? (
                    <div>
                      <dt className="font-bold text-slate-500">Endereço aproximado</dt>
                      <dd className="mt-1 font-extrabold text-ink">{draft.address}</dd>
                    </div>
                  ) : null}
                </dl>
                <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-slate-200 p-4">
                  <input
                    type="checkbox"
                    checked={draft.anonymousPublication}
                    onChange={(event) =>
                      setDraft((current) => ({
                        ...current,
                        anonymousPublication: event.target.checked,
                      }))
                    }
                    className="mt-1 size-5 accent-brand-600"
                  />
                  <span>
                    <span className="block font-extrabold text-ink">Publicar de forma anônima</span>
                    <span className="mt-1 block text-sm leading-6 text-slate-600">
                      A autoria nunca aparece no mapa público; esta opção também sinaliza anonimato
                      na publicação.
                    </span>
                  </span>
                </label>
              </div>

              <div className="space-y-5">
                <section
                  className="rounded-3xl border border-slate-200 p-5 sm:p-6"
                  aria-labelledby="nearby-title"
                >
                  <div className="flex items-start gap-3">
                    <span
                      className="grid size-11 shrink-0 place-items-center rounded-2xl bg-amber-100 text-xl"
                      aria-hidden="true"
                    >
                      ◎
                    </span>
                    <div>
                      <h2 id="nearby-title" className="text-xl font-black text-ink">
                        Problemas próximos
                      </h2>
                      <p className="mt-1 text-sm leading-6 text-slate-600">
                        Evitar duplicidades dá mais força ao registro correto.
                      </p>
                    </div>
                  </div>
                  {nearbyQuery.isPending ? (
                    <p
                      className="mt-5 rounded-2xl bg-slate-50 p-4 text-sm font-semibold text-slate-700"
                      role="status"
                    >
                      Verificando ocorrências nas proximidades...
                    </p>
                  ) : null}
                  {nearbyQuery.isError ? (
                    <p
                      className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-semibold text-amber-900"
                      role="alert"
                    >
                      Não foi possível verificar duplicidades agora. Você ainda pode revisar e
                      enviar o novo registro.
                    </p>
                  ) : null}
                  {nearbyQuery.isSuccess && candidates.length === 0 ? (
                    <p className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-semibold text-emerald-900">
                      Nenhum problema público foi encontrado nesse raio.
                    </p>
                  ) : null}
                  {candidates.length > 0 ? (
                    <div className="mt-5 space-y-3">
                      {candidates.map((candidate) => (
                        <article
                          key={candidate.id}
                          className="rounded-2xl border border-amber-200 bg-amber-50/60 p-4"
                        >
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div>
                              <p className="text-xs font-extrabold uppercase tracking-[0.12em] text-amber-800">
                                {candidate.protocol}
                              </p>
                              <h3 className="mt-1 font-black text-ink">{candidate.title}</h3>
                              <p className="mt-2 text-sm text-slate-600">
                                {getNeighborhoodLabel(candidate)} ·{' '}
                                {occurrenceStatusLabels[candidate.status]} ·{' '}
                                {candidate.confirmationCount} confirmações
                              </p>
                            </div>
                            <Button
                              type="button"
                              variant="secondary"
                              disabled={confirmationMutation.isPending}
                              onClick={() => void confirmCandidate(candidate)}
                            >
                              É o mesmo problema
                            </Button>
                          </div>
                        </article>
                      ))}
                    </div>
                  ) : null}
                </section>

                {candidates.length > 0 ? (
                  <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-brand-200 bg-brand-50 p-4">
                    <input
                      type="checkbox"
                      checked={allowNewOccurrence}
                      onChange={(event) => setAllowNewOccurrence(event.target.checked)}
                      className="mt-1 size-5 accent-brand-600"
                    />
                    <span>
                      <span className="block font-extrabold text-ink">É um problema diferente</span>
                      <span className="mt-1 block text-sm leading-6 text-slate-600">
                        Revisei os candidatos e quero continuar com um novo registro.
                      </span>
                    </span>
                  </label>
                ) : null}

                <div className="rounded-3xl bg-ink p-5 text-white sm:p-6">
                  <p className="text-xs font-extrabold uppercase tracking-[0.14em] text-brand-200">
                    Envio seguro
                  </p>
                  <h2 className="mt-2 text-xl font-black">Tudo pronto para registrar?</h2>
                  <p className="mt-2 text-sm leading-6 text-slate-300">
                    A foto e a localização serão enviadas em uma única requisição. O botão fica
                    bloqueado para impedir envios repetidos.
                  </p>
                  <Button
                    type="button"
                    className="mt-5 w-full bg-brand-600 hover:bg-brand-500"
                    disabled={
                      createMutation.isPending ||
                      confirmationMutation.isPending ||
                      nearbyQuery.isPending ||
                      (candidates.length > 0 && !allowNewOccurrence)
                    }
                    onClick={() => void submitNewOccurrence()}
                  >
                    {createMutation.isPending ? 'Enviando registro...' : 'Enviar ocorrência'}
                  </Button>
                </div>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setStep('location')}
                  disabled={createMutation.isPending}
                >
                  Voltar e corrigir
                </Button>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}
