import {Component, lazy, Suspense, type ErrorInfo, type ReactNode} from 'react';
import {AppShell} from '@astryxdesign/core/AppShell';
import {Banner} from '@astryxdesign/core/Banner';
import {Button} from '@astryxdesign/core/Button';
import {Layout, LayoutContent} from '@astryxdesign/core/Layout';
import {Link} from '@astryxdesign/core/Link';
import {HStack, VStack} from '@astryxdesign/core/Stack';
import {Heading, Text} from '@astryxdesign/core/Text';
import {MotionStack} from '../features/MotionStack';
import {TopNav, TopNavItem} from '@astryxdesign/core/TopNav';
import {useRoute, type Route} from './router';
import {APP_NAME, LogoMark} from '../brand/Logo';
import {Glossary} from '../features/Glossary';
import {Spinner} from '@astryxdesign/core/Spinner';

// Each page is its own chunk: the casebook does not download the atlas controls.
const Casebook = lazy(() => import('../pages/Casebook').then(m => ({default: m.Casebook})));
const CaseFile = lazy(() => import('../pages/CaseFile').then(m => ({default: m.CaseFile})));
const Atlas = lazy(() => import('../pages/Atlas').then(m => ({default: m.Atlas})));
const Method = lazy(() => import('../pages/Method').then(m => ({default: m.Method})));
const Brief = lazy(() => import('../pages/Brief').then(m => ({default: m.Brief})));
const World = lazy(() => import('../pages/World').then(m => ({default: m.World})));
const Proof = lazy(() => import('../pages/Proof').then(m => ({default: m.Proof})));
const Impact = lazy(() => import('../pages/Impact').then(m => ({default: m.Impact})));

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
        <>
          <TopNavItem label="Explore" href="#/world" isSelected={current === 'world' || current === 'atlas' || current === 'brief'} />
          <TopNavItem label="Impact" href="#/impact" isSelected={current === 'impact'} />
          <TopNavItem label="How we know" href="#/proof" isSelected={current === 'proof'} />
          <TopNavItem label="Method" href="#/method" isSelected={current === 'method'} />
        </>
      }
      endContent={<TopNavItem label="NASA challenge" href={CHALLENGE} />}
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

/** Paneled pages (maps, and Method with its outline) size to the viewport so each panel scrolls on its own. */
function fillsViewport(route: Route): boolean {
  return route.page === 'atlas' || route.page === 'world' || route.page === 'method';
}

function page(route: Route): ReactNode {
  switch (route.page) {
    case 'home':
      return <Layout content={<Casebook section={route.section} />} />;
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
      return <Method section={route.params.get('s')} />;
    case 'impact':
      return <Layout contentWidth={1200} content={<Impact />} />;
    default:
      return (
        <Layout
          contentWidth={1200}
          content={
            <LayoutContent padding={8}>
              <VStack gap={4}>
                <Text type="label" color="accent">
                  Page not found
                </Text>
                <Heading level={1} type="display-3">
                  Nothing lives at “{route.path}”
                </Heading>
                <Text color="secondary">The link may be mistyped or out of date. Every covered country and cell is reachable from Explore.</Text>
                <HStack gap={2} wrap="wrap">
                  <Button variant="primary" label="Go to Explore" href="#/world" />
                  <Button variant="secondary" label="Home" href="#/" />
                </HStack>
              </VStack>
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
        <PageBoundary key={window.location.hash.split('?')[0]}><MotionStack key={window.location.hash.split('?')[0]} height={fillsViewport(route) ? '100%' : undefined}>{page(route)}</MotionStack></PageBoundary>
      </Suspense>
    </AppShell>
  );
}
