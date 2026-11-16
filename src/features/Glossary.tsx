import {Divider} from '@astryxdesign/core/Divider';
import {Grid} from '@astryxdesign/core/Grid';
import {LayoutContent} from '@astryxdesign/core/Layout';
import {VStack} from '@astryxdesign/core/Stack';
import {Text} from '@astryxdesign/core/Text';

/**
 * Every abbreviation or named test the site uses, spelled out once. Shown at
 * the foot of every page so no reader meets a term that is never explained.
 */
export const GLOSSARY: [term: string, meaning: string][] = [
  ['NASA POWER', 'Prediction Of Worldwide Energy Resources: the NASA data service TRACE downloads its monthly records from.'],
  ['MERRA-2', 'Modern-Era Retrospective analysis for Research and Applications, version 2. NASA’s reanalysis: a weather model re-run over past decades and steered by the observations available at each time.'],
  ['GISTEMP v4', 'NASA GISS Surface Temperature Analysis, version 4 (GISS: Goddard Institute for Space Studies). Built from weather-station thermometers, independently of MERRA-2.'],
  ['GPCP v2.3', 'Global Precipitation Climatology Project, version 2.3: monthly rainfall from rain gauges and satellites. Partly independent of MERRA-2, which also leans on gauges.'],
  ['Witness', 'A second record, built a different way, that TRACE checks each trend against: GISTEMP for temperature, GPCP for rainfall.'],
  ['Data artefact', 'A change that comes from how a dataset was produced, for example new satellites fed into the model, not from the climate.'],
  ['p-value', 'How often a trend this strong would appear by chance in a record with no real trend. Below 0.05 counts as significant.'],
  ['95% range', 'The span the true trend most likely lies in. If it excludes zero, the direction is clear.'],
  ['Map-wide check', 'With thousands of cells, some pass a significance test by luck. This check (Benjamini–Hochberg) sets the significance threshold so that at most about 1 in 10 of the cells it marks is expected to be a false alarm (a 10% false discovery rate).'],
  ['Theil–Sen, Mann–Kendall', 'The trend estimate (median of all pairwise slopes, so one extreme year cannot drag it) and the significance test, corrected for runs of similar years.'],
  ['Ramp or jump', 'Whether a record drifts steadily or shifts all at once in one year, scored with the Bayesian Information Criterion (BIC); a difference above 6 favours a jump.'],
  ['Change-point clue', 'The year a record most likely shifted (Pettitt test). A clue for where to look, never a cause.'],
  ['NASA GIBS', 'Global Imagery Browse Services: the source of the shaded relief under the maps.'],
  ['AMSU-A, NOAA-15', 'Advanced Microwave Sounding Unit-A, a satellite instrument first flown on NOAA-15, a weather satellite of the US National Oceanic and Atmospheric Administration.'],
  ['1991–2020 normal', 'The 30-year average that anomalies are measured from, the standard period of the World Meteorological Organization.'],
  ['Cell', 'One square of the reanalysis grid, 0.5° of latitude by 0.625° of longitude (about 55 × 70 km near the equator).'],
];

export function Glossary({compact = false}: {compact?: boolean}) {
  if (compact) {
    return (
      <VStack gap={3}>
        <Divider />
        <Text type="label" color="accent">
          Terms and abbreviations
        </Text>
        {GLOSSARY.map(([term, meaning]) => (
          <Text key={term} type="supporting">
            <Text weight="semibold" type="supporting" color="primary">
              {term}
            </Text>
            : {meaning}
          </Text>
        ))}
      </VStack>
    );
  }
  return (
    <LayoutContent padding={8}>
      <VStack gap={4}>
        <Divider />
        <Text type="label" color="accent">
          Terms and abbreviations
        </Text>
        <Grid columns={{minWidth: 360, max: 3}} gap={5}>
          {GLOSSARY.map(([term, meaning]) => (
            <VStack key={term} gap={1}>
              <Text weight="semibold">{term}</Text>
              <Text type="supporting">{meaning}</Text>
            </VStack>
          ))}
        </Grid>
      </VStack>
    </LayoutContent>
  );
}
