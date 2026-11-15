import {Button} from '@astryxdesign/core/Button';
import {Divider} from '@astryxdesign/core/Divider';
import {Grid} from '@astryxdesign/core/Grid';
import {Section} from '@astryxdesign/core/Section';
import {HStack, VStack} from '@astryxdesign/core/Stack';
import {Heading, Text} from '@astryxdesign/core/Text';
import type {RegionId} from '../data/trends';
import {AtlasGraphic} from './AtlasGraphic';

export function AtlasHero({primaryId, comparisonId}: {primaryId: RegionId; comparisonId: RegionId | null}) {
  return (
    <Section variant="transparent" padding={8} minHeight="78dvh">
      <VStack gap={8} id="top">
        <Grid columns={{minWidth: 360, max: 2}} gap={8} align="center">
          <VStack gap={6}>
            <Text type="supporting" color="accent" style={{letterSpacing: '0.22em', fontWeight: 700}}>
              NASA SPACE APPS 2026 / TREND DETECTIVE
            </Text>
            <Heading level={1} type="display-1" style={{maxWidth: '11ch', letterSpacing: '-0.055em', lineHeight: 0.95}}>
              25 years. Five places. What changed?
            </Heading>
            <Text type="large" color="secondary" style={{maxWidth: '50ch'}}>
              Choose a NASA Earth-system variable, place two locations side by side, and test the long-term signal. Every slope comes with its source, uncertainty, and limits.
            </Text>
            <HStack gap={2} wrap="wrap">
              <Button label="Open the investigation" variant="primary" href="#explore" size="lg" />
              <Button label="How the evidence works" variant="ghost" href="#method" size="lg" />
            </HStack>
            <Text type="supporting" color="secondary">01 / POINT SAMPLES &nbsp; · &nbsp; 2000—2024 &nbsp; · &nbsp; GLOBAL COORDINATES</Text>
          </VStack>
          <AtlasGraphic primaryId={primaryId} comparisonId={comparisonId} />
        </Grid>
        <Divider />
        <Grid columns={{minWidth: 200, max: 3}} gap={6}>
          <VStack gap={1}>
            <Heading level={2} type="display-3">300</Heading>
            <Text color="secondary">monthly points in each complete series</Text>
          </VStack>
          <VStack gap={1}>
            <Heading level={2} type="display-3">03</Heading>
            <Text color="secondary">NASA POWER variables to investigate</Text>
          </VStack>
          <VStack gap={1}>
            <Heading level={2} type="display-3">02</Heading>
            <Text color="secondary">regions visible on one shared scale</Text>
          </VStack>
        </Grid>
      </VStack>
    </Section>
  );
}
