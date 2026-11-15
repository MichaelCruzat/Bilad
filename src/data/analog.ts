export const DIMENSIONS = [
  'aridity',
  'thermalStability',
  'solarAccess',
  'terrain',
  'isolation',
] as const;

export type Dimension = (typeof DIMENSIONS)[number];
export type WeightMap = Record<Dimension, number>;
export type ProfileId = 'moon' | 'mars';
export type SourceId = keyof typeof SOURCE_REGISTRY;

export type Source = {
  label: string;
  url: string;
  note: string;
};

export type MissionProfile = {
  id: ProfileId;
  label: string;
  summary: string;
  weights: WeightMap;
};

export type AnalogCandidate = {
  id: string;
  name: string;
  region: string;
  country: string;
  terrain: 'arid' | 'polar' | 'volcanic' | 'cratered';
  coordinates: {latitude: number; longitude: number};
  targetProfiles: ProfileId[];
  summary: string;
  missionQuestion: string;
  dimensions: WeightMap;
  evidence: string[];
  limitations: string[];
  sources: SourceId[];
  fallbackWeather: {
    temperature: number;
    precipitation: number;
    solar: number;
    label: string;
  };
};

export type RankedCandidate = {
  candidate: AnalogCandidate;
  score: number;
  breakdown: WeightMap;
};

export const SOURCE_REGISTRY = {
  challenge: {
    label: 'NASA Space Apps challenge statement',
    url: 'https://www.spaceappschallenge.org/2026/challenges/permanent-moon-base-locations-and-mars/',
    note: 'Defines the terrestrial-analog problem Bilad is designed to explore.',
  },
  power: {
    label: 'NASA POWER project',
    url: 'https://power.larc.nasa.gov/',
    note: 'Provides point-based solar, temperature, and precipitation observations and model data.',
  },
  earthdata: {
    label: 'NASA Earthdata',
    url: 'https://www.earthdata.nasa.gov/',
    note: 'Open Earth science data context for future expansion beyond the prototype profiles.',
  },
  moon: {
    label: 'NASA Moon to Mars overview',
    url: 'https://science.nasa.gov/moon-to-mars/',
    note: 'Mission context for surface operations and sustained exploration.',
  },
  mars: {
    label: 'NASA Mars overview',
    url: 'https://science.nasa.gov/mars/',
    note: 'Mission context for the cold, dry, remote conditions of Mars.',
  },
} as const satisfies Record<string, Source>;

export const MISSION_PROFILES: Record<ProfileId, MissionProfile> = {
  moon: {
    id: 'moon',
    label: 'Moon base',
    summary: 'Prioritize dry, open, high-solar terrain for repeatable surface operations.',
    weights: {
      aridity: 0.25,
      thermalStability: 0.15,
      solarAccess: 0.3,
      terrain: 0.2,
      isolation: 0.1,
    },
  },
  mars: {
    id: 'mars',
    label: 'Mars outpost',
    summary: 'Prioritize cold, arid, isolated terrain that rehearses long-duration autonomy.',
    weights: {
      aridity: 0.3,
      thermalStability: 0.25,
      solarAccess: 0.1,
      terrain: 0.15,
      isolation: 0.2,
    },
  },
};

export const CANDIDATES: AnalogCandidate[] = [
  {
    id: 'atacama-plateau',
    name: 'Atacama Plateau',
    region: 'Antofagasta Region',
    country: 'Chile',
    terrain: 'arid',
    coordinates: {latitude: -23.5, longitude: -68.2},
    targetProfiles: ['moon', 'mars'],
    summary: 'High, hyper-arid ground where sparse water and clear skies turn logistics into the experiment.',
    missionQuestion: 'How does a crew conserve water and maintain instruments where the landscape offers almost no margin?',
    dimensions: {aridity: 94, thermalStability: 90, solarAccess: 96, terrain: 90, isolation: 88},
    evidence: [
      'Hyper-arid conditions make water handling and dust mitigation tangible field constraints.',
      'High elevation and clear skies support repeatable solar and atmospheric observations.',
      'Remote terrain creates an operational rehearsal for limited resupply.',
    ],
    limitations: [
      'Earth gravity, atmosphere, and geology remain fundamentally different from Mars and the Moon.',
      'A point profile does not represent every elevation band across the plateau.',
    ],
    sources: ['challenge', 'power', 'earthdata', 'mars'],
    fallbackWeather: {temperature: 11, precipitation: 0.7, solar: 7.2, label: 'Prototype snapshot'},
  },
  {
    id: 'mcmurdo-dry-valleys',
    name: 'McMurdo Dry Valleys',
    region: 'Victoria Land',
    country: 'Antarctica',
    terrain: 'polar',
    coordinates: {latitude: -77.5, longitude: 162.0},
    targetProfiles: ['moon', 'mars'],
    summary: 'Cold desert valleys where wind, ice, and isolation expose the human cost of field operations.',
    missionQuestion: 'Which tools and routines keep a science crew productive when cold and distance dominate every task?',
    dimensions: {aridity: 88, thermalStability: 70, solarAccess: 62, terrain: 84, isolation: 98},
    evidence: [
      'Cold-desert logistics and isolation make crew support requirements visible.',
      'Dry valleys expose rock, ice, and terrain transitions useful for field science rehearsals.',
      'Limited access makes maintenance and redundancy real mission constraints.',
    ],
    limitations: [
      'Polar light cycles are not a proxy for lunar illumination or a Martian sol.',
      'The candidate is a broad region; local access and permitted research sites vary.',
    ],
    sources: ['challenge', 'power', 'earthdata', 'mars'],
    fallbackWeather: {temperature: -18, precipitation: 4, solar: 3.4, label: 'Prototype snapshot'},
  },
  {
    id: 'haughton-crater',
    name: 'Haughton Crater',
    region: 'Devon Island, Nunavut',
    country: 'Canada',
    terrain: 'cratered',
    coordinates: {latitude: 75.4, longitude: -89.7},
    targetProfiles: ['moon', 'mars'],
    summary: 'A large impact structure where geology, terrain, and isolation combine into a natural field laboratory.',
    missionQuestion: 'How should a crew move, sample, and communicate across a complex impact landscape?',
    dimensions: {aridity: 80, thermalStability: 68, solarAccess: 55, terrain: 96, isolation: 94},
    evidence: [
      'Impact geology gives field teams a concrete way to rehearse crater science and traverses.',
      'Remote access supports tests of autonomy, habitat operations, and communication routines.',
      'Surface materials vary enough to support structured sampling exercises.',
    ],
    limitations: [
      'Seasonal access and Earth weather introduce constraints unlike a lunar base site.',
      'The score emphasizes operational resemblance, not a complete geological match.',
    ],
    sources: ['challenge', 'power', 'earthdata', 'moon', 'mars'],
    fallbackWeather: {temperature: -12, precipitation: 18, solar: 2.8, label: 'Prototype snapshot'},
  },
  {
    id: 'mauna-loa',
    name: 'Mauna Loa Lava Fields',
    region: 'Hawaiʻi Island',
    country: 'United States',
    terrain: 'volcanic',
    coordinates: {latitude: 19.5, longitude: -155.6},
    targetProfiles: ['moon', 'mars'],
    summary: 'Young basaltic flows that let crews practice traverses, instruments, and sample plans on rough ground.',
    missionQuestion: 'Which field tools help a crew turn unfamiliar basalt into useful science under a tight traverse plan?',
    dimensions: {aridity: 78, thermalStability: 82, solarAccess: 92, terrain: 91, isolation: 76},
    evidence: [
      'Basaltic terrain is relevant to volcanic planetary surfaces and instrument practice.',
      'Accessible fieldwork makes repeatable crew training and public science education possible.',
      'Rough ground tests mobility, route planning, and instrument protection.',
    ],
    limitations: [
      'Accessibility increases logistical realism for training but reduces isolation relative to an off-world mission.',
      'Tropical atmospheric conditions are not representative of Mars.',
    ],
    sources: ['challenge', 'power', 'earthdata', 'moon', 'mars'],
    fallbackWeather: {temperature: 8, precipitation: 28, solar: 5.8, label: 'Prototype snapshot'},
  },
  {
    id: 'namib-gravel-plains',
    name: 'Namib Gravel Plains',
    region: 'Namib-Naukluft',
    country: 'Namibia',
    terrain: 'arid',
    coordinates: {latitude: -24.5, longitude: 15.3},
    targetProfiles: ['mars'],
    summary: 'Ancient gravel plains where dryness, heat, and long horizons sharpen the question of surface autonomy.',
    missionQuestion: 'How can a crew cover long traverses while preserving energy, water, and sample integrity?',
    dimensions: {aridity: 91, thermalStability: 76, solarAccess: 94, terrain: 83, isolation: 86},
    evidence: [
      'Extreme aridity makes resource stewardship a visible operational priority.',
      'Open horizons support route planning and long-baseline communications exercises.',
      'Gravel surfaces create a simple setting for rover and mobility experiments.',
    ],
    limitations: [
      'Heat and atmosphere differ substantially from the Martian surface environment.',
      'Local conservation rules and access conditions must guide any field deployment.',
    ],
    sources: ['challenge', 'power', 'earthdata', 'mars'],
    fallbackWeather: {temperature: 22, precipitation: 9, solar: 6.6, label: 'Prototype snapshot'},
  },
  {
    id: 'krafla-lava-fields',
    name: 'Krafla Lava Fields',
    region: 'Northeast Iceland',
    country: 'Iceland',
    terrain: 'volcanic',
    coordinates: {latitude: 65.7, longitude: -16.8},
    targetProfiles: ['moon', 'mars'],
    summary: 'Fresh lava, geothermal gradients, and weather-driven logistics make a compact analog for instrument testing.',
    missionQuestion: 'How should a science team adapt a traverse and instrument plan when terrain and weather shift together?',
    dimensions: {aridity: 68, thermalStability: 64, solarAccess: 51, terrain: 88, isolation: 72},
    evidence: [
      'Recent lava provides a clear test surface for field instruments and sampling workflows.',
      'Geothermal context invites comparison between surface measurements and subsurface energy clues.',
      'A compact site can support repeated educational and engineering campaigns.',
    ],
    limitations: [
      'Weather variability is a training constraint, not a planetary analog on its own.',
      'The site is more useful for instrument and traverse rehearsal than for full mission isolation.',
    ],
    sources: ['challenge', 'power', 'earthdata', 'moon', 'mars'],
    fallbackWeather: {temperature: 2, precipitation: 42, solar: 3.1, label: 'Prototype snapshot'},
  },
];

export function normalizeWeights(weights: Partial<WeightMap>): WeightMap {
  const total = DIMENSIONS.reduce((sum, dimension) => sum + Math.max(0, weights[dimension] ?? 0), 0);

  if (total === 0) {
    return Object.fromEntries(DIMENSIONS.map(dimension => [dimension, 1 / DIMENSIONS.length])) as WeightMap;
  }

  return Object.fromEntries(
    DIMENSIONS.map(dimension => [dimension, Math.max(0, weights[dimension] ?? 0) / total]),
  ) as WeightMap;
}

export function scoreCandidate(candidate: AnalogCandidate, profile: MissionProfile): number {
  const weights = normalizeWeights(profile.weights);
  const rawScore = DIMENSIONS.reduce(
    (sum, dimension) => sum + candidate.dimensions[dimension] * weights[dimension],
    0,
  );

  return Math.round(rawScore);
}

export function rankCandidates(
  candidates: AnalogCandidate[],
  profile: MissionProfile,
): RankedCandidate[] {
  const weights = normalizeWeights(profile.weights);

  return candidates
    .map(candidate => ({
      candidate,
      score: scoreCandidate(candidate, profile),
      breakdown: Object.fromEntries(
        DIMENSIONS.map(dimension => [dimension, candidate.dimensions[dimension] * weights[dimension]]),
      ) as WeightMap,
    }))
    .sort((left, right) => right.score - left.score || left.candidate.name.localeCompare(right.candidate.name));
}
