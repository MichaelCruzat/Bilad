import {render, screen} from '@testing-library/react';
import {describe, expect, it} from 'vitest';
import {getFallbackSeries} from '../src/data/trends';
import {TrendChart} from '../src/features/TrendChart';
import {analyzeTrend} from '../src/lib/trendAnalysis';

describe('TrendChart', () => {
  it('labels both regional annual series when comparison is enabled', () => {
    const primary = getFallbackSeries('atacama', 'temperature');
    const secondary = getFallbackSeries('arctic', 'temperature');

    render(
      <TrendChart
        observations={primary}
        result={analyzeTrend(primary)}
        unit="°C"
        label="Surface temperature"
        regionName="Atacama Desert"
        source="Synthetic demo"
        comparison={{observations: secondary, result: analyzeTrend(secondary), regionName: 'Canadian Arctic', source: 'NASA POWER live'}}
      />,
    );

    expect(screen.getByRole('img', {name: /surface temperature annual trend chart/i})).toHaveTextContent('Canadian Arctic');
    expect(screen.getByText(/— Atacama Desert/)).toBeInTheDocument();
    expect(screen.getByText(/— Canadian Arctic/)).toBeInTheDocument();
    expect(screen.getByText(/Mixed sources:/)).toBeInTheDocument();
    expect(screen.getByRole('img', {name: /Synthetic demo.*NASA POWER live/i})).toBeInTheDocument();
  });

  it('explains the reference period when showing baseline-relative change', () => {
    const observations = getFallbackSeries('atacama', 'temperature');
    render(
      <TrendChart
        observations={observations}
        result={analyzeTrend(observations)}
        unit="°C"
        label="Surface temperature"
        regionName="Atacama Desert"
        source="Synthetic demo"
        mode="anomaly"
      />,
    );

    expect(screen.getByRole('img', {name: /anomalies relative to the 2000–2004 mean/i})).toBeInTheDocument();
    expect(screen.getAllByText(/Change from 2000–2004 mean/).length).toBeGreaterThan(0);
  });

  it('shows missing years as gaps and supplies a table of annual values', () => {
    const observations = getFallbackSeries('atacama', 'temperature').filter(point => point.year !== 2012);
    const {container} = render(
      <TrendChart observations={observations} result={analyzeTrend(observations)}
        unit="°C" label="Surface temperature" regionName="Atacama Desert" source="Synthetic demo" />,
    );

    const observedPath = container.querySelector('svg path');
    expect(observedPath?.getAttribute('d')?.match(/M /g)).toHaveLength(2);
    expect(screen.getByText('Annual values and missing years')).toBeInTheDocument();
    expect(screen.getByRole('rowheader', {name: '2012'}).closest('tr')).toHaveTextContent('—');
  });

  it('switches the effective chart to absolute values without all five reference years', () => {
    const observations = getFallbackSeries('atacama', 'temperature').filter(point => point.year >= 2005);
    render(
      <TrendChart observations={observations} result={analyzeTrend(observations)}
        unit="°C" label="Surface temperature" regionName="Atacama Desert" source="Synthetic demo" mode="anomaly" />,
    );

    expect(screen.getByRole('img', {name: /Annual means from 2005/i})).toBeInTheDocument();
    expect(screen.getByText(/Reference period unavailable/)).toBeInTheDocument();
  });
});
