import {lazy, Suspense, type ReactNode} from 'react';
import {AppShell} from '@astryxdesign/core/AppShell';
import {Banner} from '@astryxdesign/core/Banner';
import {Button} from '@astryxdesign/core/Button';
import {Layout, LayoutContent} from '@astryxdesign/core/Layout';
import {Link} from '@astryxdesign/core/Link';
import {HStack} from '@astryxdesign/core/Stack';
import {Text} from '@astryxdesign/core/Text';
import {TopNav} from '@astryxdesign/core/TopNav';
import {useRoute, type Route} from './router';
import {APP_NAME, LogoMark} from '../brand/Logo';
import {Spinner} from '@astryxdesign/core/Spinner';

// Each page is its own chunk: the casebook does not download the atlas controls.
const Casebook = lazy(() => import('../pages/Casebook').then(m => ({default: m.Casebook})));
const CaseFile = lazy(() => import('../pages/CaseFile').then(m => ({default: m.CaseFile})));
const Atlas = lazy(() => import('../pages/Atlas').then(m => ({default: m.Atlas})));
const Method = lazy(() => import('../pages/Method').then(m => ({default: m.Method})));
const Brief = lazy(() => import('../pages/Brief').then(m => ({default: m.Brief})));
const World = lazy(() => import('../pages/World').then(m => ({default: m.World})));

const CHALLENGE = 'https://www.spaceappschallenge.org/2026/challenges/earth-system-trend-detective/';

function Navigation({route}: {route: Route}) {
  const current = route.page;
  return (
    <TopNav
      label="Bilad"
      heading={
        <Link href="#/" label={`${APP_NAME} home`}>
          <HStack gap={2} vAlign="center">
            <LogoMark size={30} />
            <Text type="large" weight="bold">
              {APP_NAME}
            </Text>
          </HStack>
        </Link>
      }
      startContent={
        <HStack gap={1}>
          <Button label="Casebook" size="sm" variant={current === 'home' || current === 'case' ? 'secondary' : 'ghost'} href="#/" />
          <Button label="World" size="sm" variant={current === 'world' ? 'secondary' : 'ghost'} href="#/world" />
          <Button label="Nations" size="sm" variant={current === 'atlas' ? 'secondary' : 'ghost'} href="#/atlas/CHL" />
          <Button label="Method" size="sm" variant={current === 'method' ? 'secondary' : 'ghost'} href="#/method" />
        </HStack>
      }
      endContent={<Button label="NASA challenge" size="sm" variant="ghost" href={CHALLENGE} />}
    />
  );
}

function page(route: Route): ReactNode {
  switch (route.page) {
    case 'home':
      return <Layout content={<Casebook />} />;
    case 'case':
      return <Layout contentWidth={1152} content={<CaseFile key={route.id} id={route.id} />} />;
    case 'atlas':
      return <Atlas key={route.iso3} iso3={route.iso3} params={route.params} />;
    case 'brief':
      return <Layout contentWidth={1400} content={<Brief key={route.iso3} iso3={route.iso3} />} />;
    case 'world':
      return <World params={route.params} />;
    case 'method':
      return <Layout contentWidth={960} content={<Method section={route.params.get('s')} />} />;
    default:
      return (
        <Layout
          content={
            <LayoutContent padding={8}>
              <Banner status="warning" title="Page not found" description={`Nothing lives at “${route.path}”.`} endContent={<Button label="Casebook" href="#/" />} />
            </LayoutContent>
          }
        />
      );
  }
}

export default function App() {
  const route = useRoute();
  return (
    <AppShell topNav={<Navigation route={route} />} variant="surface">
      <Suspense
        fallback={
          <LayoutContent padding={8}>
            <HStack gap={2} vAlign="center">
              <Spinner size="sm" />
              <Text color="secondary">Loading…</Text>
            </HStack>
          </LayoutContent>
        }
      >
        {page(route)}
      </Suspense>
    </AppShell>
  );
}
