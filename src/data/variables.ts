/**
 * NASA POWER variables Bilad tracks. Shared by the pipeline and the app,
 * so this file must not import anything.
 *
 * `scale` is the quantisation step used in the packed Int16 binaries.
 * `display` converts the stored unit to the unit people read (for example
 * precipitation is stored in mm/day and read in mm/year).
 */

export type PaletteName = 'temperature' | 'moisture' | 'wind';

export type VariableDef = {
  id: string;
  label: string;
  short: string;
  sphere: 'Atmosphere' | 'Hydrosphere' | 'Land surface';
  /** Unit returned by NASA POWER. */
  sourceUnit: string;
  /** Unit shown to readers after `display` is applied. */
  unit: string;
  display: number;
  scale: number;
  palette: PaletteName;
  /** Number of decimals for a per-decade change in display units. */
  digits: number;
  description: string;
  /** Unit for a change when it differs from the level's unit (percentage points). */
  changeUnit?: string;
  /** Map and headline trends as % of the 1991–2020 normal per decade. */
  relative?: boolean;
  /** Plain words for an increase / decrease. */
  up: string;
  down: string;
};

export const VARIABLES = [
  {
    id: 'T2M',
    label: 'Air temperature at 2 m',
    short: 'Temperature',
    sphere: 'Atmosphere',
    sourceUnit: '°C',
    unit: '°C',
    display: 1,
    scale: 0.01,
    palette: 'temperature',
    digits: 2,
    description: 'Monthly mean of the air temperature two metres above the ground, from the MERRA-2 reanalysis.',
    up: 'warming',
    down: 'cooling',
  },
  {
    id: 'T2M_MAX',
    label: 'Daily maximum temperature',
    short: 'Daytime highs',
    sphere: 'Atmosphere',
    sourceUnit: '°C',
    unit: '°C',
    display: 1,
    scale: 0.01,
    palette: 'temperature',
    digits: 2,
    description: 'Monthly average of each day’s highest 2 m air temperature: the heat people and crops feel at midday.',
    up: 'hotter days',
    down: 'cooler days',
  },
  {
    id: 'T2M_MIN',
    label: 'Daily minimum temperature',
    short: 'Night lows',
    sphere: 'Atmosphere',
    sourceUnit: '°C',
    unit: '°C',
    display: 1,
    scale: 0.01,
    palette: 'temperature',
    digits: 2,
    description: 'Monthly average of each day’s lowest 2 m air temperature, usually reached before dawn.',
    up: 'warmer nights',
    down: 'colder nights',
  },
  {
    id: 'PRECTOTCORR',
    label: 'Precipitation (bias-corrected)',
    short: 'Rainfall',
    sphere: 'Hydrosphere',
    sourceUnit: 'mm/day',
    unit: 'mm/yr',
    display: 365.25,
    scale: 0.01,
    palette: 'moisture',
    digits: 0,
    description: 'Rain and snow reaching the surface. MERRA-2 nudges its model precipitation toward gauge analyses (satellite–gauge over Africa), and the correction fades out poleward of about 42°, so trends there rest more on the model.',
    relative: true,
    up: 'wetter',
    down: 'drier',
  },
  {
    id: 'GWETROOT',
    label: 'Root-zone soil wetness',
    short: 'Soil moisture',
    sphere: 'Land surface',
    sourceUnit: '0–1',
    unit: '%',
    changeUnit: 'percentage points',
    display: 100,
    scale: 0.0001,
    palette: 'moisture',
    digits: 2,
    description: 'How saturated the root zone (top metre) of soil is, from 0% to 100%. It is modelled by MERRA-2’s land model from the corrected precipitation, so it is not an independent witness to a rainfall trend.',
    up: 'wetter soils',
    down: 'drier soils',
  },
  {
    id: 'RH2M',
    label: 'Relative humidity at 2 m',
    short: 'Humidity',
    sphere: 'Atmosphere',
    sourceUnit: '%',
    unit: '%',
    changeUnit: 'percentage points',
    display: 1,
    scale: 0.01,
    palette: 'moisture',
    digits: 2,
    description: 'How close the near-surface air is to saturation. Falling humidity while temperature rises raises evaporative demand on soils and plants.',
    up: 'more humid',
    down: 'less humid',
  },
  {
    id: 'WS2M',
    label: 'Wind speed at 2 m',
    short: 'Wind',
    sphere: 'Atmosphere',
    sourceUnit: 'm/s',
    unit: 'm/s',
    display: 1,
    scale: 0.001,
    palette: 'wind',
    digits: 3,
    description: 'Monthly mean wind speed two metres above the ground.',
    up: 'windier',
    down: 'calmer',
  },
] as const satisfies readonly VariableDef[];

export type VariableId = (typeof VARIABLES)[number]['id'];

export const VARIABLE_IDS = VARIABLES.map(v => v.id) as VariableId[];

export function getVariable(id: string): VariableDef {
  const found = VARIABLES.find(v => v.id === id);
  if (!found) throw new Error(`Unknown variable ${id}`);
  return found;
}

/** First and last calendar years shipped for every nation. */
export const FIRST_YEAR = 1981;
export const LAST_YEAR = 2024;
/** WMO 1991–2020 standard normal, used as the anomaly baseline. */
export const BASELINE: readonly [number, number] = [1991, 2020];
