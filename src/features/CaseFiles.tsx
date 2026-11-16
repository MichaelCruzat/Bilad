import {Divider} from '@astryxdesign/core/Divider';
import {Link} from '@astryxdesign/core/Link';
import {HStack, StackItem, VStack} from '@astryxdesign/core/Stack';
import {Heading, Text} from '@astryxdesign/core/Text';
import {CASES} from '../data/cases';
import {getVariable} from '../data/variables';
import {VerdictTag} from './VerdictTag';
import {VERDICT_TEXT} from '../lib/evidence';

export function CaseFiles() {
  return (
      <VStack gap={4}>
        <Text type="label" color="accent">Case files</Text>
        <Heading id="case-files-heading" level={2} type="display-3">
          Four case files, four different outcomes
        </Heading>
        <VStack gap={0}>
          {CASES.map(c => {
            const label = c.expected === 'unwitnessed' ? 'No witness at this scale' : VERDICT_TEXT[c.expected].label;
            return (
              <VStack key={c.id} gap={0}>
                <Divider />
                <HStack gap={5} paddingBlock={4} vAlign="center" wrap="wrap">
                  <Text type="display-3" color="accent" hasTabularNumbers>
                    {c.number}
                  </Text>
                  <StackItem size="fill">
                    <VStack gap={1}>
                      <Link href={`#/case/${c.id}`}>
                        <Text type="large" weight="semibold">
                          {c.title}
                        </Text>
                      </Link>
                      <Text color="secondary">
                        {c.dek} · {getVariable(c.variable).short}
                      </Text>
                    </VStack>
                  </StackItem>
                  <VerdictTag label={label} />
                </HStack>
              </VStack>
            );
          })}
          <Divider />
        </VStack>
      </VStack>
  );
}
