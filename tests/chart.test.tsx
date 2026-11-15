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
        comparison={{observations: secondary, result: analyzeTrend(secondary), regionName: 'Canadian Arctic'}}
      />,
    );

    expect(screen.getByRole('img', {name: /surface temperature annual trend chart/i})).toHaveTextContent('Canadian Arctic');
    expect(screen.getByText(/— Atacama Desert/)).toBeInTheDocument();
    expect(screen.getByText(/— Canadian Arctic/)).toBeInTheDocument();
  });
});
