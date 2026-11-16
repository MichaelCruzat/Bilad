import {HStack} from '@astryxdesign/core/Stack';
import {Text} from '@astryxdesign/core/Text';
import {VERDICT_ORDER, VERDICT_TEXT} from '../lib/evidence';
import {VERDICT_COLORS} from '../viz/color';

/** Map colour for a verdict label, matching the map legends; null when the verdict has none. */
export function verdictColor(label: string): string | null {
  const k = VERDICT_ORDER.findIndex(v => VERDICT_TEXT[v].label === label);
  if (k >= 0) return VERDICT_COLORS[k];
  if (label === 'Likely data artefact') return VERDICT_COLORS[VERDICT_ORDER.indexOf('contradicted')];
  if (label === 'No witness at this scale' || label === 'No verdict at this scale' || label === 'Significant, single-dataset claim') return VERDICT_COLORS[VERDICT_ORDER.indexOf('no-signal')];
  return null;
}

/** A verdict label with the swatch it takes on the maps, so the two read as one key. */
export function VerdictTag({label}: {label: string}) {
  const color = verdictColor(label);
  return (
    <HStack gap={2} vAlign="center">
      {color && (
        <svg width="12" height="12" aria-hidden="true">
          <rect width="12" height="12" rx="2" fill={color} />
        </svg>
      )}
      <Text weight="semibold">{label}</Text>
    </HStack>
  );
}
