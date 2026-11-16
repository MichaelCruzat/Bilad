import type {ReactNode, SVGProps} from 'react';
import {Divider} from '@astryxdesign/core/Divider';
import {Icon} from '@astryxdesign/core/Icon';
import {IconButton} from '@astryxdesign/core/IconButton';
import {Link} from '@astryxdesign/core/Link';
import {Popover} from '@astryxdesign/core/Popover';
import {VStack} from '@astryxdesign/core/Stack';
import {Text} from '@astryxdesign/core/Text';

/**
 * What a chart, map or control is, written for two readers at once: a plain
 * account anyone can follow, then the technical basis an analyst or official
 * needs to rely on it, with a link into the Method page.
 */
export type Help = {
  /** Names the thing being explained, e.g. "Annual anomaly chart". */
  title: string;
  /** Plain language: what the reader is looking at. */
  what: ReactNode;
  /** Plain language: how to interact with it. */
  how?: ReactNode;
  /** For analysts: methods, resolution, thresholds and caveats. */
  detail?: ReactNode;
  /** Method page section id, e.g. 'theil-sen'. */
  method?: string;
};

/** A question mark in a circle, drawn to match the icon set's stroke. */
function QuestionCircle(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.6} {...props}>
      <circle cx="10" cy="10" r="8.2" />
      <path d="M7.7 7.7a2.4 2.4 0 1 1 3.5 2.1c-.8.4-1.2.9-1.2 1.7v.3" strokeLinecap="round" />
      <circle cx="10" cy="14.4" r="0.95" fill="currentColor" stroke="none" />
    </svg>
  );
}

function Part({label, children}: {label: string; children: ReactNode}) {
  return (
    <VStack gap={1}>
      <Text type="label" color="accent">
        {label}
      </Text>
      <Text type="supporting" color="primary">
        {children}
      </Text>
    </VStack>
  );
}

/** A small "?" that opens an explanation of the chart or map beside it. */
export function HelpTip({help, placement = 'below'}: {help: Help; placement?: 'above' | 'below' | 'start' | 'end'}) {
  return (
    <Popover
      label={help.title}
      placement={placement}
      width={380}
      padding={4}
      content={
        <VStack gap={3}>
          <Text weight="semibold">{help.title}</Text>
          <Part label="What this shows">{help.what}</Part>
          {help.how && <Part label="How to use it">{help.how}</Part>}
          {help.detail && (
            <>
              <Divider />
              <Part label="Technical detail">{help.detail}</Part>
            </>
          )}
          {help.method && <Link href={`#/method?s=${help.method}`}>Read the method</Link>}
        </VStack>
      }
    >
      <IconButton size="sm" variant="ghost" label={`About: ${help.title}`} icon={<Icon icon={QuestionCircle} />} />
    </Popover>
  );
}
