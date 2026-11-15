export const VARIABLE_IDS = ['temperature', 'precipitation', 'solar'] as const;
export type VariableId = (typeof VARIABLE_IDS)[number];

export type MonthlyObservation = {
  date: string;
  year: number;
  month: number;
  value: number;
};

export type Source = {
  label: string;
  url: string;
  note: string;
};

export const SOURCE_REGISTRY = {
  challenge: {
    label: 'NASA Space Apps challenge statement',
    url: 'https://www.spaceappschallenge.org/2026/challenges/earth-system-trend-detective/',
    note: 'Defines the Earth System Trend Detective questions Bilad is designed to explore.',
  },
  power: {
    label: 'NASA POWER',
    url: 'https://power.larc.nasa.gov/',
    note: 'Provides the monthly point-based climate and solar time series used by the prototype.',
  },
  powerApi: {
    label: 'NASA POWER API documentation',
    url: 'https://power.larc.nasa.gov/docs/services/api/temporal/monthly/',
    note: 'Documents the monthly endpoint and parameter response format.',
  },
  earthdata: {
    label: 'NASA Earthdata',
    url: 'https://www.earthdata.nasa.gov/',
    note: 'Provides the broader Earth-science data context for future mission-specific expansion.',
  },
} as const satisfies Record<string, Source>;

export type SourceId = keyof typeof SOURCE_REGISTRY;

export type VariableDefinition = {
  id: VariableId;
  label: string;
  shortLabel: string;
  parameter: string;
  unit: string;
  description: string;
  interpretation: string;
  sourceIds: SourceId[];
};

export const VARIABLE_DEFINITIONS: Record<VariableId, VariableDefinition> = {
  temperature: {
    id: 'temperature',
    label: 'Surface temperature',
    shortLabel: 'Temperature',
    parameter: 'T2M',
    unit: '°C',
    description: 'Average air temperature at 2 meters above the surface.',
    interpretation: 'Useful for screening warming or cooling signals across a region.',
    sourceIds: ['challenge', 'power', 'powerApi'],
  },
  precipitation: {
    id: 'precipitation',
    label: 'Precipitation',
    shortLabel: 'Precipitation',
    parameter: 'PRECTOTCORR',
    unit: 'mm/day',
    description: 'Bias-corrected average daily precipitation for each month.',
    interpretation: 'Useful for screening changes in water input and hydroclimate variability.',
    sourceIds: ['challenge', 'power', 'powerApi'],
  },
  solar: {
    id: 'solar',
    label: 'Solar energy',
    shortLabel: 'Solar energy',
    parameter: 'ALLSKY_SFC_SW_DWN',
    unit: 'kWh/m²/day',
    description: 'All-sky surface shortwave downward radiation.',
    interpretation: 'Useful for screening changes in the solar resource available at the surface.',
    sourceIds: ['challenge', 'power', 'powerApi'],
  },
};

export const REGION_IDS = ['atacama', 'amazon', 'sahel', 'arctic', 'chesapeake'] as const;
export type RegionId = (typeof REGION_IDS)[number];

export type Region = {
  id: RegionId;
  name: string;
  subtitle: string;
  latitude: number;
  longitude: number;
  description: string;
  sourceIds: SourceId[];
};

export const REGIONS: Region[] = [
  {
    id: 'atacama',
    name: 'Atacama Desert',
    subtitle: 'Hyper-arid · northern Chile',
    latitude: -23.5,
    longitude: -68.2,
    description: 'A dry, high-elevation region where small precipitation signals matter.',
    sourceIds: ['challenge', 'power', 'earthdata'],
  },
  {
    id: 'amazon',
    name: 'Amazon Basin',
    subtitle: 'Humid tropical · South America',
    latitude: -3.5,
    longitude: -60.0,
    description: 'A warm, wet region where temperature and rainfall are tightly connected.',
    sourceIds: ['challenge', 'power', 'earthdata'],
  },
  {
    id: 'sahel',
    name: 'Sahel',
    subtitle: 'Semi-arid transition · West Africa',
    latitude: 14.5,
    longitude: -2.0,
    description: 'A climate transition zone where seasonal water availability is central.',
    sourceIds: ['challenge', 'power', 'earthdata'],
  },
  {
    id: 'arctic',
    name: 'Canadian Arctic',
    subtitle: 'High latitude · Nunavut',
    latitude: 75.4,
    longitude: -89.7,
    description: 'A cold region where warming and seasonal light create a clear investigation.',
    sourceIds: ['challenge', 'power', 'earthdata'],
  },
  {
    id: 'chesapeake',
    name: 'New York / Chesapeake',
    subtitle: 'Temperate coast · eastern United States',
    latitude: 39.2,
    longitude: -75.5,
    description: 'A densely observed temperate region with useful public context for local audiences.',
    sourceIds: ['challenge', 'power', 'earthdata'],
  },
];

type FallbackConfig = {
  base: number;
  slopePerYear: number;
  seasonalAmplitude: number;
  noiseAmplitude: number;
  phase: number;
};

const FALLBACK_CONFIG: Record<RegionId, Record<VariableId, FallbackConfig>> = {
  atacama: {
    temperature: {base: 17.4, slopePerYear: 0.035, seasonalAmplitude: 5.5, noiseAmplitude: 0.28, phase: 1},
    precipitation: {base: 0.62, slopePerYear: 0.008, seasonalAmplitude: 0.5, noiseAmplitude: 0.08, phase: 3},
    solar: {base: 7.15, slopePerYear: -0.006, seasonalAmplitude: 0.55, noiseAmplitude: 0.06, phase: 2},
  },
  amazon: {
    temperature: {base: 26.2, slopePerYear: 0.045, seasonalAmplitude: 1.2, noiseAmplitude: 0.22, phase: 4},
    precipitation: {base: 6.35, slopePerYear: -0.018, seasonalAmplitude: 1.9, noiseAmplitude: 0.34, phase: 0},
    solar: {base: 4.85, slopePerYear: 0.004, seasonalAmplitude: 0.7, noiseAmplitude: 0.09, phase: 5},
  },
  sahel: {
    temperature: {base: 29.1, slopePerYear: 0.052, seasonalAmplitude: 7.4, noiseAmplitude: 0.35, phase: 2},
    precipitation: {base: 2.85, slopePerYear: 0.014, seasonalAmplitude: 2.6, noiseAmplitude: 0.26, phase: 1},
    solar: {base: 5.95, slopePerYear: 0.006, seasonalAmplitude: 0.9, noiseAmplitude: 0.11, phase: 3},
  },
  arctic: {
    temperature: {base: -12.5, slopePerYear: 0.085, seasonalAmplitude: 12.6, noiseAmplitude: 0.38, phase: 0},
    precipitation: {base: 1.52, slopePerYear: 0.012, seasonalAmplitude: 0.8, noiseAmplitude: 0.13, phase: 4},
    solar: {base: 2.35, slopePerYear: 0.002, seasonalAmplitude: 1.25, noiseAmplitude: 0.12, phase: 2},
  },
  chesapeake: {
    temperature: {base: 14.8, slopePerYear: 0.04, seasonalAmplitude: 10.2, noiseAmplitude: 0.3, phase: 5},
    precipitation: {base: 3.15, slopePerYear: 0.006, seasonalAmplitude: 0.8, noiseAmplitude: 0.15, phase: 1},
    solar: {base: 4.2, slopePerYear: -0.003, seasonalAmplitude: 0.95, noiseAmplitude: 0.1, phase: 4},
  },
};

function createFallbackSeries(config: FallbackConfig): MonthlyObservation[] {
  return Array.from({length: 300}, (_, index) => {
    const year = 2000 + Math.floor(index / 12);
    const month = (index % 12) + 1;
    const yearsSinceStart = year - 2000 + (month - 1) / 12;
    const seasonal = config.seasonalAmplitude * Math.sin(((month - 1) / 12) * Math.PI * 2 + config.phase);
    const deterministicNoise =
      config.noiseAmplitude *
      (Math.sin(index * 1.71 + config.phase) + Math.cos(index * 0.37 + config.phase * 2)) /
      2;

    return {
      date: `${year}-${String(month).padStart(2, '0')}`,
      year,
      month,
      value: config.base + config.slopePerYear * yearsSinceStart + seasonal + deterministicNoise,
    };
  });
}

export const FALLBACK_SERIES: Record<RegionId, Record<VariableId, MonthlyObservation[]>> = Object.fromEntries(
  REGION_IDS.map(regionId => [
    regionId,
    Object.fromEntries(
      VARIABLE_IDS.map(variableId => [variableId, createFallbackSeries(FALLBACK_CONFIG[regionId][variableId])]),
    ),
  ]),
) as Record<RegionId, Record<VariableId, MonthlyObservation[]>>;

export function getRegion(regionId: RegionId): Region {
  const region = REGIONS.find(item => item.id === regionId);
  if (!region) throw new Error(`Unknown region: ${regionId}`);
  return region;
}

export function getFallbackSeries(regionId: RegionId, variableId: VariableId): MonthlyObservation[] {
  return FALLBACK_SERIES[regionId][variableId].map(observation => ({...observation}));
}
