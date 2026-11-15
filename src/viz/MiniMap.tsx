import {useId, useMemo} from 'react';
import {reliefUrl, type Boundary, type NationMeta, type Preview} from '../lib/nationData';
import {divergingColor} from './color';
import {CHROME} from './chrome';
import {useMapGeometry} from './NationMap';

/** Shared limit so every nation in the strip is coloured on the same scale. */
export const STRIP_LIMIT = 0.6;

type Props = {meta: NationMeta; boundary: Boundary; preview: Preview; title: string};

/** A small, non-interactive nation map: relief, warming trend per cell, FDR stipple. */
export function MiniMap({meta, boundary, preview, title}: Props) {
  const id = useId().replace(/:/g, '');
  const geo = useMapGeometry(meta, boundary, 300, 300);
  const cells = useMemo(
    () =>
      geo.cellPaths.map((d, i) => (
        <path key={i} d={d} fill={divergingColor('temperature', preview.slope[i], STRIP_LIMIT)} stroke={CHROME.body} strokeWidth={0.3} />
      )),
    [geo, preview],
  );
  return (
    <svg viewBox={`0 0 ${geo.width.toFixed(0)} ${geo.height.toFixed(0)}`} width="100%" height="100%" role="img" aria-label={title} preserveAspectRatio="xMidYMid meet" style={{display: 'block'}}>
      <title>{title}</title>
      <defs>
        <clipPath id={`mclip-${id}`}>
          <path d={geo.boundaryPath} />
        </clipPath>
        <filter id={`mrelief-${id}`} colorInterpolationFilters="sRGB">
          <feColorMatrix type="saturate" values="0.4" />
          <feComponentTransfer>
            <feFuncR type="linear" slope="0.4" />
            <feFuncG type="linear" slope="0.42" />
            <feFuncB type="linear" slope="0.48" />
          </feComponentTransfer>
        </filter>
      </defs>
      {geo.image && <image href={reliefUrl(meta.iso3, true)} x={0} y={0} width={geo.width} height={geo.height} preserveAspectRatio="none" filter={`url(#mrelief-${id})`} />}
      <g clipPath={`url(#mclip-${id})`}>
        {cells}
        {geo.centers.map(([x, y], i) => (preview.significant[i] ? <circle key={i} cx={x} cy={y} r={0.9} fill={CHROME.ink} fillOpacity={0.8} /> : null))}
      </g>
      <path d={geo.boundaryPath} fill="none" stroke={CHROME.ink} strokeOpacity={0.7} strokeWidth={0.7} />
    </svg>
  );
}
