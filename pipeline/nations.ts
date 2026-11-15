/**
 * Nation registry. Adding a nation is one entry here plus
 * `pnpm pipeline <ISO3>`; no application code changes.
 *
 * `atlasId` is the ISO 3166-1 numeric code used by Natural Earth /
 * world-atlas. `clip` optionally restricts the analysed area (for example to
 * leave out remote islands whose grid cells would be almost all ocean).
 */
export type NationConfig = {
  iso3: string;
  atlasId: string;
  name: string;
  /** Why this nation is in the shipped set, shown on the landing page. */
  rationale: string;
  clip?: {latMin: number; latMax: number; lonMin: number; lonMax: number};
  /** Optional sub-regions for named comparisons and validation. */
  regions?: {id: string; name: string; latMin: number; latMax: number}[];
};

export const NATIONS: NationConfig[] = [
  {
    iso3: 'CHL',
    atlasId: '152',
    name: 'Chile',
    rationale: '4,300 km from the Atacama to Patagonia: one nation spanning almost every climate zone, and home to a well-documented megadrought.',
    clip: {latMin: -56.5, latMax: -17, lonMin: -76.5, lonMax: -66},
    regions: [
      {id: 'north', name: 'Norte Grande (Atacama)', latMin: -28, latMax: -17},
      {id: 'central', name: 'Central Chile', latMin: -38, latMax: -30},
      {id: 'south', name: 'Sur and Patagonia', latMin: -56.5, latMax: -38},
    ],
  },
  {
    iso3: 'KEN',
    atlasId: '404',
    name: 'Kenya',
    rationale: 'Equatorial East Africa, where the reanalysis sees only about half the warming that weather stations record.',
  },
  {
    iso3: 'MAR',
    atlasId: '504',
    name: 'Morocco',
    rationale: 'A Mediterranean-to-Saharan gradient in a region climate assessments flag as a drying hotspot.',
  },
  {
    iso3: 'BGD',
    atlasId: '050',
    name: 'Bangladesh',
    rationale: 'A monsoon delta whose reanalysis record jumps in 1997–98: the case that shows why every trend needs an independent witness.',
  },
  {
    iso3: 'ESP',
    atlasId: '724',
    name: 'Spain',
    rationale: 'Mainland Spain and the Balearics: a high-data European benchmark against which other nations can be compared.',
    clip: {latMin: 35.5, latMax: 44, lonMin: -9.5, lonMax: 4.5},
  },
  {
    iso3: 'MEX',
    atlasId: '484',
    name: 'Mexico',
    rationale: 'A large, topographically complex nation with deserts, tropical forests and recurrent multi-year drought.',
  },
];

export function getNationConfig(iso3: string): NationConfig {
  const found = NATIONS.find(n => n.iso3 === iso3.toUpperCase());
  if (!found) throw new Error(`Unknown nation ${iso3}. Add it to pipeline/nations.ts.`);
  return found;
}
