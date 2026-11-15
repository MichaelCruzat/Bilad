import {afterEach, describe, expect, it, vi} from 'vitest';
import {getRegion, VARIABLE_DEFINITIONS} from '../src/data/trends';
import {buildPowerUrl, fetchPowerSeries, normalizePowerResponse} from '../src/lib/nasaPower';

afterEach(() => vi.unstubAllGlobals());

const monthlyResponse = {
  properties: {parameter: {T2M: {'200001': 12.4, '200002': 13.1, '200003': 13.7}}},
};

describe('NASA POWER adapter', () => {
  it('builds a public monthly point request with the selected variable and region', () => {
    const url = buildPowerUrl(
      {
        id: 'atacama',
        name: 'Atacama Desert',
        subtitle: 'Hyper-arid',
        latitude: -23.5,
        longitude: -68.2,
        description: 'Test region',
        sourceIds: ['challenge'],
      },
      VARIABLE_DEFINITIONS.temperature,
      2000,
      2024,
    );

    expect(url).toContain('parameters=T2M');
    expect(url).toContain('latitude=-23.5');
    expect(url).toContain('longitude=-68.2');
    expect(url).toContain('start=2000');
    expect(url).toContain('end=2024');
  });

  it('normalizes monthly POWER values and ignores missing sentinels', () => {
    const observations = normalizePowerResponse(
      {
        properties: {
          parameter: {
            T2M: {
              '200001': 12.4,
              '200002': -999,
              '200003': 13.1,
              '200004': 13.7,
              '200013': 13.5,
            },
          },
        },
      },
      VARIABLE_DEFINITIONS.temperature,
    );

    expect(observations).toEqual([
      {date: '2000-01', year: 2000, month: 1, value: 12.4},
      {date: '2000-03', year: 2000, month: 3, value: 13.1},
      {date: '2000-04', year: 2000, month: 4, value: 13.7},
    ]);
  });

  it('reuses a successful live request for the same region, variable, and years', async () => {
    const request = vi.fn(async () => ({ok: true, json: async () => monthlyResponse}) as Response);
    vi.stubGlobal('fetch', request);
    const region = getRegion('amazon');
    const variable = VARIABLE_DEFINITIONS.temperature;
    const options = {startYear: 2000, endYear: 2001};

    const [first, second] = await Promise.all([
      fetchPowerSeries(region, variable, options),
      fetchPowerSeries(region, variable, options),
    ]);
    const third = await fetchPowerSeries(region, variable, options);

    expect(request).toHaveBeenCalledTimes(1);
    expect(second).toEqual(first);
    expect(third).toEqual(first);
  });

  it('retries a failed live request instead of caching the failure', async () => {
    const request = vi.fn()
      .mockRejectedValueOnce(new Error('temporarily offline'))
      .mockResolvedValue({ok: true, json: async () => monthlyResponse} as Response);
    vi.stubGlobal('fetch', request);
    const region = getRegion('sahel');
    const variable = VARIABLE_DEFINITIONS.temperature;
    const options = {startYear: 2000, endYear: 2002};

    await expect(fetchPowerSeries(region, variable, options)).rejects.toThrow('temporarily offline');
    await expect(fetchPowerSeries(region, variable, options)).resolves.toHaveLength(3);
    expect(request).toHaveBeenCalledTimes(2);
  });
});
