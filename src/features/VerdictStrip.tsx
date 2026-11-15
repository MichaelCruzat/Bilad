import {Badge} from '@astryxdesign/core/Badge';
import {Button} from '@astryxdesign/core/Button';
import {Card} from '@astryxdesign/core/Card';
import {MetadataList, MetadataListItem} from '@astryxdesign/core/MetadataList';
import {HStack, VStack} from '@astryxdesign/core/Stack';
import {Text} from '@astryxdesign/core/Text';
import {getVariable} from '../data/variables';
import {overallVerdict, PRODUCTS, VERDICT_TEXT, type WitnessState} from '../lib/evidence';
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
  return (
    <Card variant="muted" padding={4}>
      <VStack gap={3}>
        <HStack gap={2} vAlign="center" wrap="wrap">
          <Text type="code" size="xsm" color="accent">
            VERDICT
          </Text>
          <Badge variant={TONE[verdict.tone]} label={verdict.label} />
        </HStack>
        <Text type="large" weight="semibold">
          {place}: {direction}, {signed(t.slope * 10, digits)} {unit} per decade (95% range {signed(t.slopeLow * 10, digits)} to {signed(t.slopeHigh * 10, digits)}), {window.from}–{window.to}.
        </Text>
        <Text color="secondary">{verdict.sentence}</Text>
        <HStack gap={2} wrap="wrap">
          <Badge variant={sig ? 'info' : 'neutral'} label={sig ? `Significant, ${pPhrase(t.p)}` : `Not significant, ${pPhrase(t.p)}`} />
          {fieldSignificant !== undefined && <Badge variant={fieldSignificant ? 'info' : 'neutral'} label={fieldSignificant ? 'Survives map-wide FDR' : 'Does not survive map-wide FDR'} />}
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
          <MetadataListItem label="Source">NASA POWER (MERRA-2){witness.kind === 'available' ? ` vs ${PRODUCTS[variable].name}` : ''}</MetadataListItem>
          <MetadataListItem label="Period">{`${window.from}–${window.to}, annual means`}</MetadataListItem>
          <MetadataListItem label="Resolution">{resolution}</MetadataListItem>
          <MetadataListItem label="Test">Theil–Sen, Mann–Kendall (Hamed–Rao)</MetadataListItem>
          <MetadataListItem label="Limitation">{limitation}</MetadataListItem>
        </MetadataList>
        {next && (
          <HStack gap={2}>
            <Button size="sm" variant="primary" label={next.label} href={next.href} onClick={next.onClick} />
          </HStack>
        )}
      </VStack>
    </Card>
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
      return <Badge variant="neutral" label={`${PRODUCTS[variable].name} has no coverage here`} />;
    case 'too-coarse':
      return <Badge variant="neutral" label={`${PRODUCTS[variable].name} is too coarse to tell these places apart`} />;
    default:
      return <Badge variant={TONE[VERDICT_TEXT[witness.exam.verdict].tone]} label={`${PRODUCTS[variable].name}: ${VERDICT_TEXT[witness.exam.verdict].label.toLowerCase()}`} />;
  }
}
