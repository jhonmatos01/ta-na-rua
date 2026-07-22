export interface ReverseGeocodingInput {
  latitude: number;
  longitude: number;
}

export interface GeocodingProviderAttribution {
  name: string;
  text: string;
  url: string;
}

export interface ReverseGeocodedAddress {
  street: string | null;
  houseNumber: string | null;
  streetAddress: string | null;
  neighborhood: string | null;
  city: string | null;
  state: string | null;
  postcode: string | null;
  countryCode: string | null;
  formattedAddress: string;
  provider: GeocodingProviderAttribution;
}

export interface ReverseGeocodingService {
  reverse(input: ReverseGeocodingInput): Promise<ReverseGeocodedAddress | null>;
}
