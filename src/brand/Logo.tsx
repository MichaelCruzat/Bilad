import {CHROME} from '../viz/chrome';
import {divergingColor} from '../viz/color';

/** The product name lives here so a rename is one line. */
export const APP_NAME = 'Bilad';

// A 3 x 3 patch of trend cells: cool to warm, with two stippled (significant) cells.
const MARK: number[] = [-0.8, -0.2, 0.5, -0.4, 0.3, 0.9, 0.1, 0.7, 1];
const SIGNIFICANT = new Set([5, 8]);

export function LogoMark({size = 28}: {size?: number}) {
  return (
    <svg width={size} height={size} viewBox="0 0 30 30" aria-hidden="true" style={{display: 'block', flexShrink: 0}}>
      {MARK.map((v, i) => (
        <rect key={i} x={(i % 3) * 10} y={Math.floor(i / 3) * 10} width={9.2} height={9.2} rx={1.4} fill={divergingColor('temperature', v, 1)} />
      ))}
      {[...SIGNIFICANT].map(i => (
        <circle key={i} cx={(i % 3) * 10 + 4.6} cy={Math.floor(i / 3) * 10 + 4.6} r={1.3} fill={CHROME.ink} />
      ))}
    </svg>
  );
}

/** Wordmark that scales with its container: the mark plus the name, set large. */
export function Wordmark({title = APP_NAME}: {title?: string}) {
  const w = 120 + title.length * 92;
  return (
    <svg viewBox={`0 0 ${w} 150`} width="100%" role="img" aria-label={title} style={{display: 'block', maxWidth: '44rem'}}>
      <g transform="translate(0 15) scale(4)">
        {MARK.map((v, i) => (
          <rect key={i} x={(i % 3) * 10} y={Math.floor(i / 3) * 10} width={9.2} height={9.2} rx={1.4} fill={divergingColor('temperature', v, 1)} />
        ))}
        {[...SIGNIFICANT].map(i => (
          <circle key={i} cx={(i % 3) * 10 + 4.6} cy={Math.floor(i / 3) * 10 + 4.6} r={1.3} fill={CHROME.ink} />
        ))}
      </g>
      <text x={150} y={122} fontSize={150} fontWeight={700} fill={CHROME.ink} fontFamily="var(--font-family-heading)" letterSpacing="-4">
        {title}
      </text>
    </svg>
  );
}
