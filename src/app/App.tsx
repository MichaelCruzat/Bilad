import {Component, lazy, Suspense, type ErrorInfo, type ReactNode} from 'react';
import {AppShell} from '@astryxdesign/core/AppShell';
import {Banner} from '@astryxdesign/core/Banner';
import {Button} from '@astryxdesign/core/Button';
import {Layout, LayoutContent} from '@astryxdesign/core/Layout';
import {Link} from '@astryxdesign/core/Link';
import {HStack, VStack} from '@astryxdesign/core/Stack';
import {Text} from '@astryxdesign/core/Text';
import {MotionStack} from '../features/MotionStack';
import {TopNav} from '@astryxdesign/core/TopNav';
import {useRoute, type Route} from './router';
import {APP_NAME, LogoMark} from '../brand/Logo';
import {Glossary} from '../features/Glossary';
import {Spinner} from '@astryxdesign/core/Spinner';

// Each page is its own chunk: the casebook does not download the atlas controls.
const Casebook = lazy(() => import('../pages/Casebook').then(m => ({default: m.Casebook})));
const Cases = lazy(() => import('../pages/Cases').then(m => ({default: m.Cases})));
const CaseFile = lazy(() => import('../pages/CaseFile').then(m => ({default: m.CaseFile})));
const Atlas = lazy(() => import('../pages/Atlas').then(m => ({default: m.Atlas})));
const Method = lazy(() => import('../pages/Method').then(m => ({default: m.Method})));
const Brief = lazy(() => import('../pages/Brief').then(m => ({default: m.Brief})));
const World = lazy(() => import('../pages/World').then(m => ({default: m.World})));
const Proof = lazy(() => import('../pages/Proof').then(m => ({default: m.Proof})));

/**
 * One broken page must not take the site down: the boundary is keyed by the
 * route, so navigating anywhere else renders normally again.
 */
class PageBoundary extends Component<{children: ReactNode}, {error: Error | null}> {
  state = {error: null as Error | null};
  static getDerivedStateFromError(error: Error) {
    return {error};
  }
  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(error, info.componentStack);
  }
  render() {
    if (!this.state.error) return this.props.children;
    return (
      <LayoutContent padding={8}>
        <Banner
          status="error"
          title="Something went wrong on this page"
          description="The rest of the site still works. Reload to try again, or go back to the casebook."
          endContent={
            <HStack gap={2}>
              <Button label="Reload" variant="secondary" onClick={() => window.location.reload()} />
              <Button label="Casebook" href="#/" />
            </HStack>
          }
        />
      </LayoutContent>
    );
  }
}

const CHALLENGE = 'https://www.spaceappschallenge.org/2026/challenges/earth-system-trend-detective/';

function Navigation({route}: {route: Route}) {
  const current = route.page;
  return (
    <TopNav
      label="TRACE"
      heading={
        <Link href="#/" label={`${APP_NAME} home`}>
          <HStack gap={3} vAlign="center">
            <LogoMark size="2.9rem" />
            <Text type="display-3" weight="bold">
              {APP_NAME}
            </Text>
          </HStack>
        </Link>
      }
      startContent={
        <HStack gap={2}>
          <Button label="Cases" size="lg" variant={current === 'cases' || current === 'case' ? 'secondary' : 'ghost'} href="#/cases" />
          <Button label="Explore" size="lg" variant={current === 'world' || current === 'atlas' ? 'secondary' : 'ghost'} href="#/world" />
          <Button label="How we know" size="lg" variant={current === 'proof' ? 'secondary' : 'ghost'} href="#/proof" />
          <Button label="Method" size="lg" variant={current === 'method' ? 'secondary' : 'ghost'} href="#/method" />
        </HStack>
      }
      endContent={<Button label="NASA challenge" size="lg" variant="ghost" href={CHALLENGE} />}
    />
  );
}

function withGlossary(content: ReactNode): ReactNode {
  return (
    <VStack gap={0}>
      {content}
      <Glossary />
    </VStack>
  );
}

function page(route: Route): ReactNode {
  switch (route.page) {
    case 'home':
      return <Layout content={<Casebook />} />;
    case 'cases':
      return <Layout content={<Cases />} />;
    case 'case':
      return <Layout contentWidth={1760} content={withGlossary(<CaseFile key={route.id} id={route.id} />)} />;
    case 'atlas':
      return <Atlas key={route.iso3} iso3={route.iso3} params={route.params} />;
    case 'brief':
      return <Layout contentWidth={1760} content={withGlossary(<Brief key={route.iso3} iso3={route.iso3} />)} />;
    case 'world':
      return <World params={route.params} />;
    case 'proof':
      return <Layout contentWidth={1400} content={withGlossary(<Proof params={route.params} />)} />;
    case 'method':
      return <Layout contentWidth={1200} content={withGlossary(<Method section={route.params.get('s')} />)} />;
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
        <PageBoundary key={window.location.hash.split('?')[0]}><MotionStack key={window.location.hash.split('?')[0]}>{page(route)}</MotionStack></PageBoundary>
      </Suspense>
    </AppShell>
  );
}
