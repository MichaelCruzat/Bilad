import type {ReactNode} from 'react';
import {Button} from '@astryxdesign/core/Button';
import {Divider} from '@astryxdesign/core/Divider';
import {LayoutContent} from '@astryxdesign/core/Layout';
import {Link} from '@astryxdesign/core/Link';
import {HStack, VStack} from '@astryxdesign/core/Stack';
import {Heading, Text} from '@astryxdesign/core/Text';
import {MotionStack} from '../features/MotionStack';
import {Center} from '@astryxdesign/core/Center';
import {useMediaQuery} from '../lib/hooks';

export function Impact() {
  const narrow = useMediaQuery('(max-width: 1100px)');
  return <LayoutContent padding={8}><Center axis="horizontal" maxWidth={880}><VStack gap={8} width="100%">
    <MotionStack gap={4}>
      <Text type="label" color="accent">Purpose and impact</Text>
      <Heading level={1} type={narrow ? 'display-3' : 'display-2'}>Why climate evidence needs a second look</Heading>
      <Text type="large">Water supplies, farming, public health and infrastructure all feel the effects of a changing climate. Knowing how temperature and rainfall have changed over decades is one input to judging those risks, and that evidence should be traceable before anyone acts on it.</Text>
      <Text type="supporting">Background: <Link href="https://science.nasa.gov/climate-change/effects/">NASA’s overview of climate effects</Link></Text>
      <Text type="large" color="secondary">TRACE lets you check that evidence yourself: estimate the trend, test whether it is significant, look for sudden jumps, and compare it with a record built a different way for exactly the same area.</Text>
    </MotionStack>

    <ImpactSection title="The problem: a significant trend can still mislead">
      <Text>A trend test asks one question: is this pattern bigger than the normal ups and downs from year to year? A small p-value answers that, but it cannot tell you whether the data contain a systematic error, a sudden break, or a comparison drawn over the wrong area. A convincing map can hide all three.</Text>
      <Text>Climate records also differ in where they have data, how fine their grid is, what goes into them and how they are processed. Those differences matter most when a result is read for one country or a small region. TRACE shows the trend, its uncertainty, the comparison with a second source and the limits side by side, so you can weigh the claim.</Text>
    </ImpactSection>

    <ImpactSection title="Why cross-reference temperature records?">
      <Text>NASA’s MERRA-2 reanalysis combines a weather model with observations to estimate the atmosphere on a regular grid. GISTEMP v4 is built from weather-station records over land and sea-surface temperatures over the ocean; TRACE uses its land stations. The two answer the same question through entirely different processing. <Link href="https://gmao.gsfc.nasa.gov/gmao-products/merra-2/">MERRA-2 overview</Link>; <Link href="https://data.giss.nasa.gov/gistemp/">GISTEMP overview</Link>.</Text>
      <Text>Comparing them separates a result both records support from one that depends on which product you happened to pick. If one record shows cooling and the other warming, that needs explaining before either is used to make a claim. Even when both show significant warming, how fast and how certain still matter.</Text>
      <Text>A fair comparison needs the same years, units, baseline and area. TRACE uses 1981–2024 and a 1991–2020 baseline, weights each land cell by its area, and samples the second record over exactly the same cells.</Text>
      <Text color="secondary">Neither record is the truth. Their errors can be related, and the second record’s coarser grid cannot check every small cell on its own. Agreement adds support; disagreement tells you to look closer, but not which source is at fault. NASA publishes an analysis of GISTEMP’s uncertainty. <Link href="https://data.giss.nasa.gov/gistemp/uncertainty/">Read the uncertainty documentation</Link>.</Text>
      <HStack><Button variant="secondary" label="See a disagreement in Case 03" href="#/case/bangladesh-phantom-cooling" /></HStack>
    </ImpactSection>

    <ImpactSection title="Who can use the result?">
      <VStack gap={4}>
        <Heading level={3}>Citizens, teachers and researchers</Heading>
        <Text>Explore any country or land cell without building your own data pipeline. Follow a result back to its source and calculation, see why records disagree, and download the evidence. The code is open and the data window is fixed, so anyone can check and repeat the analysis.</Text>
        <Divider />
        <Heading level={3}>NASA and Earth-data teams</Heading>
        <Text>Make NASA’s open datasets easier to compare and explain. Each place where the records disagree is a repeatable case that could point product teams towards processing, coverage or sampling problems. TRACE could support quality review, but it is not a NASA-endorsed validation service.</Text>
        <Divider />
        <Heading level={3}>Governments and public agencies</Heading>
        <Text>Check evidence of long-term warming or rainfall change before it goes into an adaptation assessment. Each export records the area, trend, uncertainty, method and limits, so analysts can see exactly what lies behind a map. It is a starting point for a fuller assessment, not a local risk model or a recommendation on spending.</Text>
      </VStack>
    </ImpactSection>

    <ImpactSection title="What works today">
      <Text>A working worldwide tool for temperature and rainfall over land from 60°S to 84°N. Any covered country or cell can be examined, linked to and exported. The case files show the main outcomes: records that agree, records that differ in speed, records that contradict each other, and questions too local for the second record to answer.</Text>
      <Text>Separate test code confirms that the shipped numbers are calculated correctly. That cannot show the observations themselves are right. For rainfall, the second record (GPCP) shares some rain-gauge data with MERRA-2, so the comparison is only partly independent.</Text>
    </ImpactSection>

    <ImpactSection title="How we would know it helps">
      <Text>The real test is whether analysts reach a reviewed result faster, whether readers interpret uncertainty correctly, whether other teams can reproduce the work, and whether the disagreements TRACE flags hold up when someone investigates them. Coverage numbers and a polished map do not prove any of that.</Text>
      <Text weight="semibold">No institution has adopted TRACE yet, and it has no policy outcomes to show.</Text>
      <Text color="secondary">TRACE does not forecast, explain causes, map local hazards or replace a proper risk assessment. What it offers is climate evidence that is easier to question and review.</Text>
      <HStack gap={3} wrap="wrap"><Button variant="primary" label="Explore the global evidence" href="#/world" /><Button variant="secondary" label="Follow the calculation" href="#/proof" /><Button variant="secondary" label="Read the method" href="#/method" /></HStack>
    </ImpactSection>
  </VStack></Center></LayoutContent>;
}

function ImpactSection({title, children}: {title: string; children: ReactNode}) {
  return <MotionStack reveal gap={4}><Divider /><Heading level={2}>{title}</Heading>{children}</MotionStack>;
}
