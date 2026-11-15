import {Badge} from '@astryxdesign/core/Badge';
import {Button} from '@astryxdesign/core/Button';
import {Card} from '@astryxdesign/core/Card';
import {MetadataList, MetadataListItem} from '@astryxdesign/core/MetadataList';
import {Link} from '@astryxdesign/core/Link';
import {HStack, VStack} from '@astryxdesign/core/Stack';
import {Text} from '@astryxdesign/core/Text';
import {getVariable} from '../data/variables';
import {overallVerdict, productName, VERDICT_TEXT, type WitnessState} from '../lib/evidence';
import type {SeriesAnalysis, StepScreen} from '../lib/stats';
import {pPhrase, signed} from '../lib/format';

type Props = {
  place: string;
  variable: string;
  window: {from: number; to: number};
  result: SeriesAnalysis;
  unit: string;
  witness: WitnessState;
  step: StepScreen | null;
  /** Significance after false-discovery control, for single cells; omit for areas. */
  fieldSignificant?: boolean;
  resolution: string;
  limitation: string;
  next?: {label: string; href?: string; onClick?: () => void};
};

const TONE = {success: 'success', warning: 'warning', error: 'error', neutral: 'neutral'} as const;

/**
 * The answer first: what changed, where, by how much, whether it is
 * significant, whether a second record agrees, one limitation and one next
 * step, with a five-field receipt. Everything shown is computed elsewhere;
 * this component only arranges it.
 */
export function VerdictStrip({place, variable, window, result, unit, witness, step, fieldSignificant, resolution, limitation, next}: Props) {
  const def = getVariable(variable);
  const t = result.trend;
  const digits = unit === '% of normal' ? 1 : def.digits;
  const verdict = overallVerdict(t.p, witness, Boolean(step?.stepDominated));
  const direction = !Number.isFinite(t.slope) ? 'no estimate' : t.slope > 0 ? def.up : def.down;
  const sig = t.p < 0.05;
  const exam = witness.kind === 'available' ? witness.exam : null;
  const witnessKind = variable === 'PRECTOTCORR' ? 'rain gauges and satellites' : 'weather stations';
  return (
    <Card variant="muted" padding={6}>
      <VStack gap={5}>
        <HStack gap={3} vAlign="center" wrap="wrap">
          <Text type="code" color="accent">
            VERDICT
          </Text>
          <Badge variant={TONE[verdict.tone]} label={verdict.label} />
          <Link href="#/method?s=verdicts">What the verdicts mean</Link>
        </HStack>
        <HStack gap={10} wrap="wrap" vAlign="end">
          <Figure value={signed(t.slope * 10, digits)} unit={`${unit} per decade`} caption={`NASA reanalysis (MERRA-2), ${pPhrase(t.p)}`} />
          {exam && (
            <Figure
              value={signed(exam.witness.slope * 10, digits)}
              unit={`${unit} per decade`}
              caption={`${productName(variable)}, ${witnessKind}, ${pPhrase(exam.witness.p)}`}
            />
          )}
        </HStack>
        <VStack gap={1}>
          <Text type="large" weight="semibold">
            {place}: {direction}, {signed(t.slope * 10, digits)} {unit} per decade (95% range {signed(t.slopeLow * 10, digits)} to {signed(t.slopeHigh * 10, digits)}), {window.from}–{window.to}.
          </Text>
          <Text type="large" color="secondary">
            {verdict.sentence}
          </Text>
        </VStack>
        <HStack gap={2} wrap="wrap">
          <Badge variant={sig ? 'info' : 'neutral'} label={sig ? `Significant, ${pPhrase(t.p)}` : `Not significant, ${pPhrase(t.p)}`} />
          {fieldSignificant !== undefined && <Badge variant={fieldSignificant ? 'info' : 'neutral'} label={fieldSignificant ? 'Still significant after the map-wide check' : 'Not significant after the map-wide check'} />}
          <WitnessBadge witness={witness} variable={variable} />
          {step && <Badge variant={step.stepDominated ? 'warning' : 'neutral'} label={step.stepDominated ? `Jump in ${step.breakAt}, not a ramp` : 'Gradual change, not a jump'} />}
        </HStack>
        {witness.kind === 'failed' && (
          <HStack gap={2} vAlign="center" wrap="wrap">
            <Text type="supporting">Witness unavailable: {witness.message}</Text>
            <Button size="sm" variant="secondary" label="Retry" onClick={witness.retry} />
          </HStack>
        )}
        <MetadataList orientation="horizontal">
          <MetadataListItem label="Source">NASA POWER (MERRA-2){witness.kind === 'available' ? ` vs ${productName(variable)}` : ''}</MetadataListItem>
          <MetadataListItem label="Period">{`${window.from}–${window.to}, annual means`}</MetadataListItem>
          <MetadataListItem label="Resolution">{resolution}</MetadataListItem>
          <MetadataListItem label="Test">Theil–Sen slope, Mann–Kendall test (corrected for runs of similar years)</MetadataListItem>
          <MetadataListItem label="Limitation">{limitation}</MetadataListItem>
        </MetadataList>
        {next && (
          <HStack gap={2}>
            <Button variant="primary" label={next.label} href={next.href} onClick={next.onClick} />
          </HStack>
        )}
      </VStack>
    </Card>
  );
}

/** One headline number, set large, with its unit and where it comes from. */
function Figure({value, unit, caption}: {value: string; unit: string; caption: string}) {
  return (
    <VStack gap={1}>
      <HStack gap={2} vAlign="end">
        <Text type="display-1" weight="bold" hasTabularNumbers>
          {value}
        </Text>
        <Text type="large" color="secondary">
          {unit}
        </Text>
      </HStack>
      <Text color="secondary">{caption}</Text>
    </VStack>
  );
}

function WitnessBadge({witness, variable}: {witness: WitnessState; variable: string}) {
  switch (witness.kind) {
    case 'unsupported':
      return <Badge variant="neutral" label="Single dataset: no witness in this release" />;
    case 'loading':
      return <Badge variant="neutral" label="Loading witness…" />;
    case 'failed':
      return <Badge variant="warning" label="Witness unavailable" />;
    case 'no-coverage':
      return <Badge variant="neutral" label={`${productName(variable)} has no coverage here`} />;
    case 'too-coarse':
      return <Badge variant="neutral" label={`${witness.product} is too coarse to tell these places apart`} />;
    default:
      return <Badge variant={TONE[VERDICT_TEXT[witness.exam.verdict].tone]} label={`${productName(variable)}: ${VERDICT_TEXT[witness.exam.verdict].label.toLowerCase()}`} />;
  }
}
