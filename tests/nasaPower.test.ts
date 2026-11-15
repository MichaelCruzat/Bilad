import {afterEach, describe, expect, it, vi} from 'vitest';
import {getRegion, VARIABLE_DEFINITIONS} from '../src/data/trends';
import {buildPowerUrl, fetchPowerSeries, normalizePowerResponse} from '../src/lib/nasaPower';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

const monthlyResponse = {
  parameters: {T2M: {units: 'C'}},
  header: {sources: ['MERRA2']},
  properties: {parameter: {T2M: Object.fromEntries(Array.from({length: 60}, (_, index) => {
    const year = 2000 + Math.floor(index / 12);
    const month = (index % 12) + 1;
    return [`${year}${String(month).padStart(2, '0')}`, 12.4 + index * 0.01];
  }))}},
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
        parameters: {T2M: {units: 'C'}},
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

  it('converts NASA solar MJ/m²/day to the displayed kWh/m²/day and rejects changed units', () => {
    const payload = {
      parameters: {ALLSKY_SFC_SW_DWN: {units: 'MJ/m^2/day'}},
      properties: {parameter: {ALLSKY_SFC_SW_DWN: {'200001': 29.03}}},
    };
    expect(normalizePowerResponse(payload, VARIABLE_DEFINITIONS.solar)[0].value).toBeCloseTo(29.03 / 3.6);
    expect(() => normalizePowerResponse({...payload, parameters: {ALLSKY_SFC_SW_DWN: {units: 'kWh/m^2/day'}}}, VARIABLE_DEFINITIONS.solar)).toThrow('unexpected unit');
  });

  it('reuses a successful live request for the same region, variable, and years', async () => {
    const request = vi.fn(async () => ({ok: true, json: async () => monthlyResponse}) as Response);
    vi.stubGlobal('fetch', request);
    const region = getRegion('amazon');
    const variable = VARIABLE_DEFINITIONS.temperature;
    const options = {startYear: 2000, endYear: 2004};

    const [first, second] = await Promise.all([
      fetchPowerSeries(region, variable, options),
      fetchPowerSeries(region, variable, options),
    ]);
    const third = await fetchPowerSeries(region, variable, options);

    expect(request).toHaveBeenCalledTimes(1);
    expect(second).toEqual(first);
    expect(third).toEqual(first);
    expect(first.observations).toHaveLength(60);
    expect(first.sources).toEqual(['MERRA2']);
  });

  it('retries a failed live request instead of caching the failure', async () => {
    const request = vi.fn()
      .mockRejectedValueOnce(new Error('temporarily offline'))
      .mockResolvedValue({ok: true, json: async () => monthlyResponse} as Response);
    vi.stubGlobal('fetch', request);
    const region = getRegion('sahel');
    const variable = VARIABLE_DEFINITIONS.temperature;
    const options = {startYear: 2000, endYear: 2004};

    await expect(fetchPowerSeries(region, variable, options)).rejects.toThrow('temporarily offline');
    await expect(fetchPowerSeries(region, variable, options)).resolves.toMatchObject({observations: expect.any(Array)});
    expect(request).toHaveBeenCalledTimes(2);
  });

  it('rejects a partial live window rather than treating three months as an annual trend', async () => {
    const partial = {
      parameters: {T2M: {units: 'C'}},
      properties: {parameter: {T2M: {'200001': 12, '200002': 13, '200003': 14}}},
    };
    const fetchImpl = vi.fn(async () => ({ok: true, json: async () => partial}) as Response);
    await expect(fetchPowerSeries(getRegion('atacama'), VARIABLE_DEFINITIONS.temperature, {fetchImpl})).rejects.toThrow('insufficient complete years');
  });

  it('bounds a stalled NASA request', async () => {
    vi.useFakeTimers();
    const fetchImpl = vi.fn(() => new Promise<Response>(() => {}));
    const request = fetchPowerSeries(getRegion('arctic'), VARIABLE_DEFINITIONS.temperature, {fetchImpl});
    const outcome = expect(request).rejects.toThrow('timed out');
    await vi.advanceTimersByTimeAsync(25000);
    await outcome;
  });
});
