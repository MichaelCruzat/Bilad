import type {ReactNode} from 'react';
import {Button} from '@astryxdesign/core/Button';
import {Divider} from '@astryxdesign/core/Divider';
import {LayoutContent} from '@astryxdesign/core/Layout';
import {Link} from '@astryxdesign/core/Link';
import {HStack, VStack} from '@astryxdesign/core/Stack';
import {Heading, Text} from '@astryxdesign/core/Text';
import {MotionStack} from '../features/MotionStack';

export function Impact() {
  return <LayoutContent padding={8}><VStack gap={8}>
    <MotionStack gap={4}>
      <Text type="label" color="accent">Purpose and impact</Text>
      <Heading level={1} type="display-2">Why climate evidence needs a second look</Heading>
      <Text type="large">Water supplies, agriculture, public health, and infrastructure are exposed to changes in climate. Understanding long-term temperature and rainfall change is one input to assessing those risks. The evidence needs to be traceable before anyone uses it to support a decision. <Link href="https://science.nasa.gov/climate-change/effects/">NASA’s overview of climate effects</Link>.</Text>
      <Text type="large" color="secondary">TRACE helps people examine that evidence: estimate a trend, test its significance, look for abrupt jumps, and compare it with a differently constructed record on the same footprint.</Text>
    </MotionStack>

    <ImpactSection title="The problem: a significant result can still need scrutiny">
      <Text>A trend test asks whether a pattern is distinguishable from year-to-year variation under its assumptions. A small p-value does not rule out a systematic data error, an abrupt discontinuity, or an unsuitable spatial comparison. A convincing map can hide those distinctions.</Text>
      <Text>Climate records also differ in coverage, resolution, inputs, and processing. Those differences matter when a result is interpreted for one country or a small region. TRACE places the trend, uncertainty, source comparison, and limitations together so the reader can examine the claim.</Text>
    </ImpactSection>

    <ImpactSection title="Why cross-reference temperature records?">
      <Text>NASA’s MERRA-2 reanalysis combines a physical model with assimilated observations to estimate the atmosphere on a regular grid. GISTEMP v4 is built from weather-station records for land temperature and a sea-surface-temperature product for oceans. TRACE uses the land-station comparison. The two products approach the same question through different processing systems. <Link href="https://gmao.gsfc.nasa.gov/gmao-products/merra-2/">MERRA-2 overview</Link>; <Link href="https://data.giss.nasa.gov/gistemp/">GISTEMP overview</Link>.</Text>
      <Text>Comparing their trends helps distinguish a result supported by both records from one that depends strongly on the chosen product. If one record cools while the other warms, the disagreement deserves investigation before either becomes the basis of a claim. If both show significant warming, their rates and uncertainty ranges still matter.</Text>
      <Text>The comparison must use a consistent observation window, units, baseline, and geographic footprint. TRACE uses 1981–2024 and a 1991–2020 baseline, weights the selected land cells by area, and samples the witness over the same selection.</Text>
      <Text color="secondary">Neither record is ground truth. Their uncertainties can be related, and the coarser witness grid cannot independently resolve every fine cell. Agreement adds support; disagreement does not identify which source is responsible. NASA publishes an observational-uncertainty analysis for GISTEMP. <Link href="https://data.giss.nasa.gov/gistemp/uncertainty/">Read the uncertainty documentation</Link>.</Text>
      <HStack><Button variant="secondary" label="See a disagreement in Case 03" href="#/case/bangladesh-phantom-cooling" /></HStack>
    </ImpactSection>

    <ImpactSection title="Who can use the result?">
      <VStack gap={4}>
        <Heading level={3}>People, educators, and researchers</Heading>
        <Text>Explore a country or land cell without building a data pipeline. Follow a result to its source and calculation, examine why records disagree, and download evidence for further work. The open code and fixed data window make the analysis inspectable and reproducible.</Text>
        <Divider />
        <Heading level={3}>NASA and Earth-data teams</Heading>
        <Text>Make NASA’s open products easier to compare and communicate. Reproducible discrepancy cases can provide starting points for investigating processing, coverage, or sampling issues. This is a potential contribution to product interpretation and quality review; it is not a NASA-endorsed validation service.</Text>
        <Divider />
        <Heading level={3}>Governments and public agencies</Heading>
        <Text>Screen evidence of long-term warming or rainfall change before including it in an adaptation assessment. A shared receipt carries the selected footprint, trend, uncertainty, method, and limits, helping analysts inspect the evidence behind a map. It is a starting point for further assessment, not a site-specific risk model or an automatic recommendation about spending.</Text>
      </VStack>
    </ImpactSection>

    <ImpactSection title="What TRACE demonstrates today">
      <Text>A working global workflow for temperature and rainfall over covered land from 60°S to 84°N. Any covered country or cell can be examined, linked, and exported. Guided cases illustrate agreement, differences in rate, disagreement, and comparisons too coarse to resolve a local question.</Text>
      <Text>Implementation checks test whether separate code agrees with the shipped calculations. They cannot establish that the observations are correct. Rainfall is compared with GPCP, which shares some gauge inputs with MERRA-2; that comparison is only partly independent.</Text>
    </ImpactSection>

    <ImpactSection title="How meaningful impact would be established">
      <Text>Measure whether analysts reach a reviewed result faster, whether readers interpret uncertainty correctly, whether other teams can reproduce the work, and whether flagged discrepancies survive independent investigation. Coverage counts and a polished visualization do not measure policy benefit.</Text>
      <Text weight="semibold">Institutional adoption and policy outcomes have not yet been demonstrated.</Text>
      <Text color="secondary">TRACE does not forecast conditions, attribute causes, determine local hazards, or replace validated risk assessments. Its contribution is making climate evidence easier to question and review.</Text>
      <HStack gap={3} wrap="wrap"><Button variant="primary" label="Explore the global evidence" href="#/world" /><Button variant="secondary" label="Follow the calculation" href="#/proof" /><Button variant="ghost" label="Read the method" href="#/method" /></HStack>
    </ImpactSection>
  </VStack></LayoutContent>;
}

function ImpactSection({title, children}: {title: string; children: ReactNode}) {
  return <MotionStack reveal gap={4}><Divider /><Heading level={2}>{title}</Heading>{children}</MotionStack>;
}
