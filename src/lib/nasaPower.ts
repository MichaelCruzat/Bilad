import type {MonthlyObservation, Region, VariableDefinition} from '../data/trends';

export const POWER_API_URL = 'https://power.larc.nasa.gov/api/temporal/monthly/point';

type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;
const liveRequests = new Map<string, Promise<MonthlyObservation[]>>();

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

export function buildPowerUrl(
  region: Region,
  variable: VariableDefinition,
  startYear = 2000,
  endYear = 2024,
): string {
  const params = new URLSearchParams({
    parameters: variable.parameter,
    community: 'AG',
    longitude: String(region.longitude),
    latitude: String(region.latitude),
    start: String(startYear),
    end: String(endYear),
    format: 'JSON',
  });

  return `${POWER_API_URL}?${params.toString()}`;
}

export function normalizePowerResponse(payload: unknown, variable: VariableDefinition): MonthlyObservation[] {
  if (!isRecord(payload)) throw new Error('NASA POWER returned an invalid response.');

  const properties = payload.properties;
  if (!isRecord(properties) || !isRecord(properties.parameter)) {
    throw new Error('NASA POWER response did not include parameter data.');
  }

  const rawSeries = properties.parameter[variable.parameter];
  if (!isRecord(rawSeries)) {
    throw new Error(`NASA POWER did not return ${variable.parameter} for this location.`);
  }

  const observations = Object.entries(rawSeries)
    .map(([date, rawValue]) => {
      const year = Number(date.slice(0, 4));
      const month = Number(date.slice(4, 6));
      const value = rawValue === null || rawValue === undefined || rawValue === '' ? Number.NaN : Number(rawValue);

      if (!/^\d{6}$/.test(date) || !Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12 || !Number.isFinite(value) || value <= -900) {
        return null;
      }

      return {
        date: `${year}-${String(month).padStart(2, '0')}`,
        year,
        month,
        value,
      };
    })
    .filter((observation): observation is MonthlyObservation => observation !== null)
    .sort((left, right) => left.date.localeCompare(right.date));

  if (observations.length < 3) {
    throw new Error('NASA POWER returned too few valid monthly observations.');
  }

  return observations;
}

export type FetchPowerOptions = {
  startYear?: number;
  endYear?: number;
  fetchImpl?: FetchLike;
};

async function requestPowerSeries(url: string, fetchImpl: FetchLike, variable: VariableDefinition): Promise<MonthlyObservation[]> {
  const response = await fetchImpl(url, {headers: {Accept: 'application/json'}});

  if (!response.ok) {
    throw new Error(`NASA POWER request failed with status ${response.status}.`);
  }

  return normalizePowerResponse(await response.json(), variable);
}

export function fetchPowerSeries(
  region: Region,
  variable: VariableDefinition,
  options: FetchPowerOptions = {},
): Promise<MonthlyObservation[]> {
  const url = buildPowerUrl(region, variable, options.startYear, options.endYear);

  if (options.fetchImpl) {
    return requestPowerSeries(url, options.fetchImpl, variable);
  }

  let request = liveRequests.get(url);
  if (!request) {
    request = requestPowerSeries(url, fetch, variable).catch(error => {
      liveRequests.delete(url);
      throw error;
    });
    liveRequests.set(url, request);
  }

  return request;
}
