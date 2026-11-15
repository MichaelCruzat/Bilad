import {Section} from '@astryxdesign/core/Section';
import {VStack} from '@astryxdesign/core/Stack';
import {Heading, Text} from '@astryxdesign/core/Text';
import type {Region, VariableDefinition} from '../data/trends';
import type {TrendResult} from '../lib/trendAnalysis';

function number(value: number, digits = 2) {
  return value.toFixed(digits);
}

export function EvidenceReadout({region, variable, result, source, primary}: {
  region: Region;
  variable: VariableDefinition;
  result: TrendResult;
  source: string;
  primary: boolean;
}) {
  return (
    <Section variant="transparent" padding={4} dividers={['top']}>
      <VStack gap={3}>
        <Text type="supporting" color={primary ? 'primary' : 'accent'} style={{letterSpacing: '0.16em'}}>
          {primary ? 'A / PRIMARY' : 'B / COMPARISON'} · {region.name.toUpperCase()}
        </Text>
        <Text type="supporting">{primary ? 'Trend verdict' : 'Comparison verdict'}</Text>
        <Heading level={3} type="display-3">{number(result.slopePerYear)} {variable.unit}/yr</Heading>
        <Text>{result.direction === 'stable' ? 'Nearly flat' : result.direction === 'increasing' ? 'Increasing' : 'Decreasing'} · {result.significant ? 'passes' : 'does not pass'} the Mann–Kendall screen</Text>
        <Text type="supporting" color="secondary">
          Approx. 95% slope interval {number(result.confidenceInterval.lower)} to {number(result.confidenceInterval.upper)} {variable.unit}/yr · p {result.pValue < 0.001 ? '< 0.001' : `= ${number(result.pValue, 3)}`} · R² {number(result.rSquared, 3)}
        </Text>
        <Text type="supporting" color="secondary">{source} · {result.sampleCount} monthly values</Text>
      </VStack>
    </Section>
  );
}
