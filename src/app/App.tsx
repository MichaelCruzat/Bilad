import {useState} from 'react';
import {AppShell} from '@astryxdesign/core/AppShell';
import {Badge} from '@astryxdesign/core/Badge';
import {Button} from '@astryxdesign/core/Button';
import {Card} from '@astryxdesign/core/Card';
import {Divider} from '@astryxdesign/core/Divider';
import {Grid} from '@astryxdesign/core/Grid';
import {Layout, LayoutContent} from '@astryxdesign/core/Layout';
import {NavIcon} from '@astryxdesign/core/NavIcon';
import {Icon} from '@astryxdesign/core/Icon';
import {
  SideNav,
  SideNavHeading,
  SideNavItem,
  SideNavSection,
} from '@astryxdesign/core/SideNav';
import {SegmentedControl, SegmentedControlItem} from '@astryxdesign/core/SegmentedControl';
import {Heading, Text} from '@astryxdesign/core/Text';
import {HStack, VStack} from '@astryxdesign/core/Stack';
import {
  BeakerIcon,
  BookOpenIcon,
  GlobeAmericasIcon,
  MapIcon,
  RocketLaunchIcon,
} from '@heroicons/react/24/outline';

type Profile = 'moon' | 'mars';

const PROFILE_COPY: Record<Profile, {label: string; summary: string}> = {
  moon: {
    label: 'Moon base',
    summary: 'Prioritize dry, open, high-solar terrain for repeatable surface operations.',
  },
  mars: {
    label: 'Mars outpost',
    summary: 'Prioritize cold, arid, isolated terrain that rehearses long-duration autonomy.',
  },
};

const MODULES = [
  {label: 'Discover analogs', description: 'Rank Earth locations against a mission profile.', icon: MapIcon},
  {label: 'Compare evidence', description: 'See the trade-offs behind each score.', icon: BeakerIcon},
  {label: 'Brief the mission', description: 'Turn a shortlist into a field-test plan.', icon: RocketLaunchIcon},
];

function Navigation() {
  return (
    <SideNav
      aria-label="Bilad navigation"
      collapsible
      header={
        <SideNavHeading
          heading="Bilad"
          icon={<NavIcon icon={<Icon icon={GlobeAmericasIcon} size="sm" />} />}
          headingHref="#top"
        />
      }
      footer={
        <SideNavSection title="Resources" isHeaderHidden>
          <SideNavItem label="Challenge brief" icon={BookOpenIcon} href="#method" />
        </SideNavSection>
      }>
      <SideNavSection title="Mission control" isHeaderHidden>
        <SideNavItem label="Briefing" icon={RocketLaunchIcon} href="#top" isSelected />
        <SideNavItem label="Analog explorer" icon={MapIcon} href="#explore" />
        <SideNavItem label="Method & sources" icon={BookOpenIcon} href="#method" />
      </SideNavSection>
    </SideNav>
  );
}

export default function App() {
  const [profile, setProfile] = useState<Profile>('moon');

  return (
    <AppShell contentPadding={0} height="auto" sideNav={<Navigation />} variant="elevated">
      <Layout
        height="auto"
        content={
          <LayoutContent padding={6}>
            <VStack gap={8}>
              <VStack gap={3}>
                <Badge label="NASA Space Apps 2026 · The Next Frontier" variant="blue" />
                <Heading level={1}>Where on Earth can we rehearse living beyond Earth?</Heading>
                <Text type="large" color="secondary">
                  Bilad turns open NASA Earth, Moon, and Mars data into a clear starting point for choosing terrestrial analogs—places where future crews can test tools, habits, and mission decisions before launch.
                </Text>
                <HStack gap={2}>
                  <Button label="Explore analog sites" variant="primary" href="#explore" />
                  <Button label="Read the method" variant="secondary" href="#method" />
                </HStack>
              </VStack>

              <Divider />

              <VStack gap={3} id="explore">
                <Heading level={2}>Choose a mission profile</Heading>
                <Text color="secondary">
                  Start with the conditions that matter most for the mission you want to rehearse.
                </Text>
                <SegmentedControl label="Mission profile" value={profile} onChange={value => setProfile(value as Profile)} layout="fill">
                  <SegmentedControlItem value="moon" label="Moon base" />
                  <SegmentedControlItem value="mars" label="Mars outpost" />
                </SegmentedControl>
                <Card variant="muted">
                  <VStack gap={2}>
                    <Heading level={3}>{PROFILE_COPY[profile].label}</Heading>
                    <Text>{PROFILE_COPY[profile].summary}</Text>
                    <Text type="supporting">This is a screening profile, not a landing-site recommendation.</Text>
                  </VStack>
                </Card>
              </VStack>

              <VStack gap={3}>
                <Heading level={2}>A mission briefing in three moves</Heading>
                <Grid columns={{minWidth: 240, max: 3}} gap={3}>
                  {MODULES.map(module => (
                    <Card key={module.label}>
                      <VStack gap={2}>
                        <Icon icon={module.icon} size="md" />
                        <Heading level={3}>{module.label}</Heading>
                        <Text color="secondary">{module.description}</Text>
                      </VStack>
                    </Card>
                  ))}
                </Grid>
              </VStack>

              <Card variant="muted" id="method">
                <VStack gap={2}>
                  <Heading level={2}>Built for evidence, not certainty</Heading>
                  <Text>
                    Bilad keeps curated analog context separate from live environmental observations, shows its scoring dimensions, and makes limitations visible. Every source will be linked at the moment it informs the story.
                  </Text>
                  <Text type="supporting">Challenge: Identify Earth Locations that Analog the Permanent Moon Base Locations and Mars.</Text>
                </VStack>
              </Card>
            </VStack>
          </LayoutContent>
        }
      />
    </AppShell>
  );
}
