import type {MonthlyObservation, Region, VariableDefinition} from '../data/trends';
import {getAnnualSeries} from './trendAnalysis';

export const POWER_API_URL = 'https://power.larc.nasa.gov/api/temporal/monthly/point';

type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;
export type PowerSeries = {observations: MonthlyObservation[]; sources: string[]; requestUrl: string};
const liveRequests = new Map<string, Promise<PowerSeries>>();
const REQUEST_TIMEOUT_MS = 25000;

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

  const parameters = payload.parameters;
  const parameter = isRecord(parameters) ? parameters[variable.parameter] : null;
  const unit = isRecord(parameter) ? parameter.units : null;
  const expectedUnit = variable.id === 'temperature' ? 'C' : variable.id === 'solar' ? 'MJ/m^2/day' : 'mm/day';
  if (unit !== expectedUnit) {
    throw new Error(`NASA POWER returned an unexpected unit for ${variable.parameter}: ${String(unit)}.`);
  }

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
        value: variable.id === 'solar' ? value / 3.6 : value,
      };
    })
    .filter((observation): observation is MonthlyObservation => observation !== null)
    .sort((left, right) => left.date.localeCompare(right.date));

  return observations;
}

export type FetchPowerOptions = {
  startYear?: number;
  endYear?: number;
  fetchImpl?: FetchLike;
};

async function requestPowerSeries(url: string, fetchImpl: FetchLike, variable: VariableDefinition, startYear: number, endYear: number): Promise<PowerSeries> {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      controller.abort();
      reject(new Error('NASA POWER timed out. Try loading again.'));
    }, REQUEST_TIMEOUT_MS);
  });

  try {
    const response = await Promise.race([fetchImpl(url, {headers: {Accept: 'application/json'}, signal: controller.signal}), timeout]);
    if (!response.ok) throw new Error(`NASA POWER request failed with status ${response.status}.`);
    const payload: unknown = await Promise.race([response.json(), timeout]);
    const observations = normalizePowerResponse(payload, variable)
      .filter(point => point.year >= startYear && point.year <= endYear);
    const annual = getAnnualSeries(observations);
    const minimumYears = Math.max(3, Math.ceil((endYear - startYear + 1) * 0.8));
    if (annual.length < minimumYears) {
      throw new Error('NASA POWER returned insufficient complete years for this comparison.');
    }
    const header = isRecord(payload) ? payload.header : null;
    const sources = isRecord(header) && Array.isArray(header.sources)
      ? header.sources.filter((source): source is string => typeof source === 'string')
      : [];
    return {observations, sources, requestUrl: url};
  } finally {
    clearTimeout(timer);
  }
}

export function fetchPowerSeries(
  region: Region,
  variable: VariableDefinition,
  options: FetchPowerOptions = {},
): Promise<PowerSeries> {
  const startYear = options.startYear ?? 2000;
  const endYear = options.endYear ?? 2024;
  const url = buildPowerUrl(region, variable, startYear, endYear);

  if (options.fetchImpl) {
    return requestPowerSeries(url, options.fetchImpl, variable, startYear, endYear);
  }

  let request = liveRequests.get(url);
  if (!request) {
    request = requestPowerSeries(url, fetch, variable, startYear, endYear).catch(error => {
      liveRequests.delete(url);
      throw error;
    });
    liveRequests.set(url, request);
  }

  return request;
}
